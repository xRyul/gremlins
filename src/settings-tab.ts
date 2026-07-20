import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';

import type { GremlinsSettings } from './settings-model.ts';

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
        "Highlight space-indented Markdown list items whose indentation is not a multiple of Obsidian's indent visual width.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.controller.settings.showListIndentation)
          .onChange((value) =>
            this.updateSettings({ showListIndentation: value }),
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
        'Replace every gremlin on a line with normalized text when its bug icon is selected.',
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
