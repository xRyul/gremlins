export interface GremlinsSettings {
  showDangerousCharacters: boolean;
  showGutterIcons: boolean;
  showMixedIndentation: boolean;
  showTypographicCharacters: boolean;
}

export const DEFAULT_SETTINGS: GremlinsSettings = {
  showDangerousCharacters: true,
  showGutterIcons: true,
  showMixedIndentation: true,
  showTypographicCharacters: false,
};
