import type { EditorState, Extension } from '@codemirror/state';
import {
  addIcon,
  Notice,
  Plugin,
  removeIcon,
  type Editor,
} from 'obsidian';

import { detectLineGremlins } from './detect.ts';
import { createGremlinsEditorExtension } from './editor-extension.ts';
import { buildGremlinFixChangesForDocument } from './fix.ts';
import { findGremlinAtPosition } from './match-position.ts';
import { GREMLIN_ICON_ID, GREMLIN_ICON_SVG } from './gremlin-icon.ts';
import { getMarkdownListContext } from './markdown-context.ts';
import { formatGremlinTooltip } from './presentation.ts';
import {
  DEFAULT_SETTINGS,
  type GremlinsSettings,
} from './settings-model.ts';
import { GremlinsSettingTab } from './settings-tab.ts';

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

  private fixGremlinsOnCurrentLine(editor: Editor, checking: boolean) {
    if (!this.settings.enableClickToFix) {
      return false;
    }

    const cursor = editor.getCursor();
    const lineText = editor.getLine(cursor.line);
    const [previousLine, nextLine] = getSurroundingLines(
      editor,
      cursor.line,
    );
    const lineFrom = editor.posToOffset({ ch: 0, line: cursor.line });
    const editorState = getEditorState(editor);
    const indentSize = getEditorIndentSize(editorState);
    const listContext = editorState
      ? getMarkdownListContext(editorState, lineText, lineFrom)
      : 'unknown';
    const matches = detectLineGremlins(
      lineText,
      lineFrom,
      cursor.line,
      this.settings,
      indentSize,
      listContext,
      previousLine,
      nextLine,
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
      editor.getValue(),
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
      }
      new Notice(
        `Fixed ${fixedTarget} at line ${cursor.line + 1}.`,
      );
    }
    return true;
  }

  private inspectGremlinAtCursor(editor: Editor, checking: boolean) {
    const cursor = editor.getCursor();
    const lineText = editor.getLine(cursor.line);
    const [previousLine, nextLine] = getSurroundingLines(
      editor,
      cursor.line,
    );
    const editorState = getEditorState(editor);
    const indentSize = getEditorIndentSize(editorState);
    const listContext = editorState
      ? getMarkdownListContext(
          editorState,
          lineText,
          editor.posToOffset({ ch: 0, line: cursor.line }),
        )
      : 'unknown';
    const matches = detectLineGremlins(
      lineText,
      0,
      cursor.line,
      this.settings,
      indentSize,
      listContext,
      previousLine,
      nextLine,
    );
    const match =
      findGremlinAtPosition(matches, cursor.ch, 1) ??
      findGremlinAtPosition(matches, cursor.ch, -1);

    if (!match) {
      return false;
    }
    if (!checking) {
      new Notice(formatGremlinTooltip(match));
    }
    return true;
  }
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
