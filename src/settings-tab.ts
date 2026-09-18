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

    const addToggle = (
      key: Exclude<
        keyof GremlinsSettings,
        'listItemLineEndingPolicy' | 'listItemPunctuationPolicy'
      >,
      name: string,
      description: string,
    ) =>
      new Setting(containerEl)
        .setName(name)
        .setDesc(description)
        .addToggle((toggle) =>
          toggle
            .setValue(this.controller.settings[key])
            .onChange((value) => this.updateSettings({ [key]: value })),
        );

    addToggle(
      'showDangerousCharacters',
      'Dangerous and invisible characters',
      'Highlight zero-width characters, non-breaking spaces, soft hyphens, and bidirectional controls.',
    );
    addToggle(
      'showMixedIndentation',
      'Mixed indentation',
      'Highlight leading indentation that contains both tabs and ordinary spaces.',
    );
    addToggle(
      'showListIndentation',
      'List indentation',
      'Highlight malformed list indentation and indented list markers without parent items, including markers parsed as indented code.',
    );
    addToggle(
      'showDuplicateListMarkers',
      'Duplicate list markers',
      'Highlight consecutive unordered list markers such as “- - item”.',
    );
    addToggle(
      'showListMarkerSpacing',
      'List marker spacing',
      'Highlight unordered or ordered list markers followed by extra spaces or a tab.',
    );
    addToggle(
      'showAmbiguousEmptyListMarkers',
      'Ambiguous empty list markers',
      'Highlight lone hyphens that appear to be empty list items but may make Obsidian parse the preceding line as a heading.',
    );
    addToggle(
      'showMissingListMarkers',
      'Missing list markers',
      'Highlight under-indented text that appears to have lost an unordered-list marker before deeper sibling items.',
    );

    new Setting(containerEl)
      .setName('List item punctuation')
      .setDesc(
        'Enforce style punctuation within each list while preserving meaningful sentence endings and display math. The period policy skips standalone wikilinks, single-token all-caps labels, and unpunctuated items that introduce nested lists. Automatic matching infers each list independently.',
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

    addToggle(
      'showTypographicCharacters',
      'Typographic punctuation',
      'Highlight curly quotation marks, en dashes, and em dashes. Disabled by default because these are common in prose.',
    );
    addToggle(
      'showGutterIcons',
      'Gutter icons',
      'Show a bug icon beside each visible line that contains a gremlin.',
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
