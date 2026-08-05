import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';

import type {
  GremlinsSettings,
  ListItemLineEndingPolicy,
  ListItemPunctuationPolicy,
} from './settings-model.ts';

export interface GremlinsSettingsController {
  settings: GremlinsSettings;
  updateSettings(patch: Partial<GremlinsSettings>): Promise<void>;
}

export class GremlinsSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly controller: Plugin & GremlinsSettingsController,
  ) {
    super(app, controller);
  }

  private async updateSettings(patch: Partial<GremlinsSettings>) {
    await this.controller.updateSettings(patch);
    this.display();
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName('Dangerous and invisible characters')
      .setDesc(
        'Highlight zero-width characters, non-breaking spaces, soft hyphens, and bidirectional controls.',
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.controller.settings.showDangerousCharacters)
          .onChange((value) =>
            this.updateSettings({
              showDangerousCharacters: value,
            }),
          ),
      );

    new Setting(containerEl)
      .setName('Mixed indentation')
      .setDesc(
        'Highlight leading indentation that contains both tabs and ordinary spaces.',
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.controller.settings.showMixedIndentation)
          .onChange((value) =>
            this.updateSettings({ showMixedIndentation: value }),
          ),
      );

    new Setting(containerEl)
      .setName('List indentation')
      .setDesc(
        'Highlight malformed list indentation and indented list markers without parent items, including markers parsed as indented code.',
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.controller.settings.showListIndentation)
          .onChange((value) =>
            this.updateSettings({ showListIndentation: value }),
          ),
      );

    new Setting(containerEl)
      .setName('Duplicate list markers')
      .setDesc(
        'Highlight consecutive unordered list markers such as “- - item”.',
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.controller.settings.showDuplicateListMarkers)
          .onChange((value) =>
            this.updateSettings({ showDuplicateListMarkers: value }),
          ),
      );

    new Setting(containerEl)
      .setName('List marker spacing')
      .setDesc(
        'Highlight unordered or ordered list markers followed by extra spaces or a tab.',
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.controller.settings.showListMarkerSpacing)
          .onChange((value) =>
            this.updateSettings({ showListMarkerSpacing: value }),
          ),
      );

    new Setting(containerEl)
      .setName('Ambiguous empty list markers')
      .setDesc(
        'Highlight lone hyphens that appear to be empty list items but may make Obsidian parse the preceding line as a heading.',
      )
      .addToggle((toggle) =>
        toggle
          .setValue(
            this.controller.settings.showAmbiguousEmptyListMarkers,
          )
          .onChange((value) =>
            this.updateSettings({
              showAmbiguousEmptyListMarkers: value,
            }),
          ),
      );

    new Setting(containerEl)
      .setName('Missing list markers')
      .setDesc(
        'Highlight under-indented text that appears to have lost an unordered-list marker before deeper sibling items.',
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.controller.settings.showMissingListMarkers)
          .onChange((value) =>
            this.updateSettings({ showMissingListMarkers: value }),
          ),
      );

    new Setting(containerEl)
      .setName('List item punctuation')
      .setDesc(
        'Enforce style punctuation within each list while preserving questions, exclamations, ellipses, display math, standalone wikilinks, and single-token all-caps labels under the period policy. Automatic matching infers each list independently.',
      )
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({
            disabled: 'Disabled',
            consistent: 'Match each list automatically',
            none: 'No terminal punctuation',
            period: 'Period',
            semicolon: 'Semicolon',
            'semicolon-final-period': 'Semicolons, then a final period',
          })
          .setValue(this.controller.settings.listItemPunctuationPolicy)
          .onChange((value) =>
            this.updateSettings({
              listItemPunctuationPolicy:
                value as ListItemPunctuationPolicy,
            }),
          ),
      );

    new Setting(containerEl)
      .setName('List item line endings')
      .setDesc(
        'Enforce trailing whitespace or blank-line separation. Hard breaks skip nested-list parents, block ids, and display math.',
      )
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({
            disabled: 'Disabled',
            'no-trailing-whitespace': 'No trailing whitespace',
            'two-spaces': 'Two spaces (Markdown hard break)',
            'blank-line': 'Blank line between items',
          })
          .setValue(this.controller.settings.listItemLineEndingPolicy)
          .onChange((value) =>
            this.updateSettings({
              listItemLineEndingPolicy:
                value as ListItemLineEndingPolicy,
            }),
          ),
      );

    new Setting(containerEl)
      .setName('Typographic punctuation')
      .setDesc(
        'Highlight curly quotation marks, en dashes, and em dashes. Disabled by default because these are common in prose.',
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.controller.settings.showTypographicCharacters)
          .onChange((value) =>
            this.updateSettings({
              showTypographicCharacters: value,
            }),
          ),
      );

    new Setting(containerEl)
      .setName('Gutter icons')
      .setDesc('Show a bug icon beside each visible line that contains a gremlin.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.controller.settings.showGutterIcons)
          .onChange((value) =>
            this.updateSettings({ showGutterIcons: value }),
          ),
      );

    new Setting(containerEl)
      .setName('Click gutter icons to fix')
      .setDesc(
        'Fix highlighted gremlins. List fixes can normalize indentation, markers, punctuation, and line endings.',
      )
      .addToggle((toggle) =>
        toggle
          .setDisabled(!this.controller.settings.showGutterIcons)
          .setValue(this.controller.settings.enableClickToFix)
          .onChange((value) =>
            this.updateSettings({ enableClickToFix: value }),
          ),
      );
  }
}
