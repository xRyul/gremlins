import { ensureSyntaxTree } from '@codemirror/language';
import type { EditorState, Extension } from '@codemirror/state';
import {
  addIcon,
  Notice,
  Plugin,
  removeIcon,
  type Editor,
  type EditorChange,
} from 'obsidian';

import { detectLineGremlins } from './detect.ts';
import { detectListItemEndingGremlins } from './list-item-endings.ts';
import { createGremlinsEditorExtension } from './editor-extension.ts';
import { buildGremlinFixChangesForDocument, type GremlinFixChange } from './fix.ts';
import { findGremlinAtPosition } from './match-position.ts';
import { GREMLIN_ICON_ID, GREMLIN_ICON_SVG } from './gremlin-icon.ts';
import {
  detectEditorListItemEndingGremlins,
  getMarkdownListContext,
} from './markdown-context.ts';
import { formatGremlinTooltip } from './presentation.ts';
import {
  DEFAULT_SETTINGS,
  type GremlinsSettings,
} from './settings-model.ts';
import { GremlinsSettingTab } from './settings-tab.ts';
import type { GremlinMatch } from './types.ts';

const DEFAULT_INDENT_SIZE = 4;

export default class GremlinsPlugin extends Plugin {
  settings: GremlinsSettings = DEFAULT_SETTINGS;
  private readonly editorExtensions: Extension[] = [];

  async onload() {
    addIcon(GREMLIN_ICON_ID, GREMLIN_ICON_SVG);
    this.register(() => removeIcon(GREMLIN_ICON_ID));
    await this.loadSettings();
    this.rebuildEditorExtensions();
    this.registerEditorExtension(this.editorExtensions);
    this.addSettingTab(new GremlinsSettingTab(this.app, this));
    this.addCommand({
      id: 'inspect-gremlin-at-cursor',
      name: 'Inspect current gremlin',
      editorCheckCallback: (checking, editor) =>
        this.inspectGremlinAtCursor(editor, checking),
    });
    this.addCommand({
      id: 'fix-current-line',
      name: 'Fix current line or list block',
      editorCheckCallback: (checking, editor) =>
        this.fixGremlinsOnCurrentLine(editor, checking),
    });
    this.addCommand({
      id: 'fix-current-note',
      name: 'Fix all in current note',
      editorCallback: (editor) => this.fixGremlinsInCurrentNote(editor),
    });
  }

  async updateSettings(patch: Partial<GremlinsSettings>) {
    const nextSettings = { ...this.settings, ...patch };

    try {
      await this.saveData(nextSettings);
    } catch {
      new Notice('Unable to save gremlins settings.');
      return;
    }

    this.settings = nextSettings;
    this.rebuildEditorExtensions();
    this.app.workspace.updateOptions();
  }

  private async loadSettings() {
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...((await this.loadData()) as Partial<GremlinsSettings> | null),
    };
  }

  private rebuildEditorExtensions() {
    this.editorExtensions.length = 0;
    this.editorExtensions.push(
      ...createGremlinsEditorExtension(this.settings),
    );
  }

  private fixGremlinsInCurrentNote(editor: Editor) {
    let state = getEditorState(editor);
    if (!state) {
      new Notice('Open the note in an editing mode to fix gremlins.');
      return;
    }
    let combinedChanges = state.changes([]);

    for (let pass = 0; ; pass += 1) {
      // ponytail: cap cascading fixes at 100 passes; use cancellable async work if this ceiling matters.
      if (pass === 100 || !ensureSyntaxTree(state, state.doc.length, 1000)) {
        new Notice('Could not finish fixing gremlins safely. The note was not changed.');
        return;
      }
      // Publish the completed parse into this working state, including offscreen lines.
      state = state.update({ filter: false }).state;
      const documentText = state.doc.toString();
      const endingsByLine = new Map<number, GremlinMatch[]>();
      for (const match of detectEditorListItemEndingGremlins(state, this.settings)) {
        const matches = endingsByLine.get(match.line) ?? [];
        matches.push(match);
        endingsByLine.set(match.line, matches);
      }
      const candidates: GremlinFixChange[] = [];
      let changedThrough = -1;
      for (let number = 1; number <= state.doc.lines; number += 1) {
        const line = state.doc.line(number);
        // A preceding block fix changes this line's context; detect it on the next pass.
        if (line.from < changedThrough) continue;
        const matches = [
          ...detectLineGremlins(
            line.text, line.from, number - 1, this.settings, state.tabSize,
            getMarkdownListContext(state, line.text, line.from),
            number > 1 ? state.doc.line(number - 1).text : undefined,
            number < state.doc.lines ? state.doc.line(number + 1).text : undefined,
          ),
          ...(endingsByLine.get(number - 1) ?? []),
        ].sort((left, right) => left.from - right.from || left.to - right.to);
        const lineChanges = buildGremlinFixChangesForDocument(
          matches, documentText, line.text, line.from, number - 1, state.tabSize,
        );
        candidates.push(...lineChanges);
        changedThrough = lineChanges[lineChanges.length - 1]?.to ?? changedThrough;
      }

      const changes: GremlinFixChange[] = [];
      for (const change of candidates.sort((left, right) => left.from - right.from || left.to - right.to)) {
        const previous = changes[changes.length - 1];
        // Apply each range once and retry conflicting rules after reparsing.
        if (previous && (change.from < previous.to ||
          (change.from === previous.from && change.to === previous.to))) continue;
        if (documentText.slice(change.from, change.to) === change.insert) continue;
        changes.push(change);
      }
      if (changes.length === 0) break;
      const transaction = state.update({ changes, filter: false });
      combinedChanges = combinedChanges.compose(transaction.changes);
      state = transaction.state;
    }

    if (combinedChanges.empty) {
      new Notice('No gremlins to fix in this note.');
      return;
    }
    const changes: EditorChange[] = [];
    combinedChanges.iterChanges((from, to, _fromNew, _toNew, inserted) => {
      changes.push({
        from: editor.offsetToPos(from),
        to: editor.offsetToPos(to),
        text: inserted.toString(),
      });
    });
    editor.transaction({ changes }, 'gremlins');
    editor.focus();
    new Notice('Fixed all gremlins in this note.');
  }

  private fixGremlinsOnCurrentLine(editor: Editor, checking: boolean) {
    if (!this.settings.enableClickToFix) {
      return false;
    }

    const {
      cursor,
      documentText,
      indentSize,
      lineFrom,
      lineText,
      matches,
    } = this.collectCurrentLineGremlins(editor);
    const hasAmbiguousEmptyListMarker = matches.some(
      (match) => match.kind === 'ambiguous-empty-list-marker',
    );
    const hasOrphanedList = matches.some(
      (match) =>
        match.kind === 'list-indentation' &&
        match.reason === 'orphaned',
    );
    const hasMissingListMarker = matches.some(
      (match) => match.kind === 'missing-list-marker',
    );
    const changes = buildGremlinFixChangesForDocument(
      matches,
      documentText,
      lineText,
      lineFrom,
      cursor.line,
      indentSize,
    );
    if (changes.length === 0) {
      return false;
    }

    if (!checking) {
      editor.transaction(
        {
          changes: changes.map((change) => ({
            from: editor.offsetToPos(change.from),
            text: change.insert,
            to: editor.offsetToPos(change.to),
          })),
        },
        'gremlins',
      );
      editor.focus();
      let fixedTarget = 'gremlins';
      if (hasOrphanedList) {
        fixedTarget = 'orphaned list block';
      } else if (hasMissingListMarker) {
        fixedTarget = 'missing list marker';
      } else if (hasAmbiguousEmptyListMarker) {
        fixedTarget = 'ambiguous empty list marker';
      }
      new Notice(
        `Fixed ${fixedTarget} at line ${cursor.line + 1}.`,
      );
    }
    return true;
  }

  private collectCurrentLineGremlins(editor: Editor) {
    const cursor = editor.getCursor();
    const lineText = editor.getLine(cursor.line);
    const [previousLine, nextLine] = getSurroundingLines(
      editor,
      cursor.line,
    );
    const lineFrom = editor.posToOffset({ ch: 0, line: cursor.line });
    const editorState = getEditorState(editor);
    const indentSize = getEditorIndentSize(editorState);
    const documentText = editor.getValue();
    const listContext = editorState
      ? getMarkdownListContext(editorState, lineText, lineFrom)
      : 'unknown';
    const matches = [
      ...detectLineGremlins(
        lineText,
        lineFrom,
        cursor.line,
        this.settings,
        indentSize,
        listContext,
        previousLine,
        nextLine,
      ),
      ...detectDocumentListItemEndings(
        editorState,
        documentText,
        this.settings,
        indentSize,
      ).filter((match) => match.line === cursor.line),
    ].sort((left, right) => left.from - right.from || left.to - right.to);
    return { cursor, documentText, indentSize, lineFrom, lineText, matches };
  }

  private inspectGremlinAtCursor(editor: Editor, checking: boolean) {
    const { cursor, matches } = this.collectCurrentLineGremlins(editor);
    const cursorOffset = editor.posToOffset(cursor);
    const match =
      findGremlinAtPosition(matches, cursorOffset, 1) ??
      findGremlinAtPosition(matches, cursorOffset, -1);

    if (!match) {
      return false;
    }
    if (!checking) {
      new Notice(formatGremlinTooltip(match));
    }
    return true;
  }
}

function detectDocumentListItemEndings(
  state: EditorState | null,
  documentText: string,
  settings: GremlinsSettings,
  indentSize: number,
) {
  return state
    ? detectEditorListItemEndingGremlins(state, settings)
    : detectListItemEndingGremlins(documentText, settings, { indentSize });
}

function getSurroundingLines(editor: Editor, line: number) {
  return [
    line > 0 ? editor.getLine(line - 1) : undefined,
    line + 1 < editor.lineCount()
      ? editor.getLine(line + 1)
      : undefined,
  ] as const;
}

function getEditorState(editor: Editor) {
  return (editor as Editor & { cm?: { state?: EditorState } }).cm?.state ?? null;
}

function getEditorIndentSize(state: EditorState | null) {
  const tabSize = state?.tabSize;
  return tabSize && Number.isInteger(tabSize)
    ? tabSize
    : DEFAULT_INDENT_SIZE;
}
