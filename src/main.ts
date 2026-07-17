import type { Extension } from '@codemirror/state';
import { Notice, Plugin, type Editor } from 'obsidian';

import { detectLineGremlins } from './detect.ts';
import { createGremlinsEditorExtension } from './editor-extension.ts';
import { findGremlinAtPosition } from './match-position.ts';
import { formatGremlinTooltip } from './presentation.ts';
import {
  DEFAULT_SETTINGS,
  type GremlinsSettings,
} from './settings-model.ts';
import { GremlinsSettingTab } from './settings-tab.ts';

export default class GremlinsPlugin extends Plugin {
  settings: GremlinsSettings = DEFAULT_SETTINGS;
  private readonly editorExtensions: Extension[] = [];

  async onload() {
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

  private inspectGremlinAtCursor(editor: Editor, checking: boolean) {
    const cursor = editor.getCursor();
    const matches = detectLineGremlins(
      editor.getLine(cursor.line),
      0,
      cursor.line,
      this.settings,
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
