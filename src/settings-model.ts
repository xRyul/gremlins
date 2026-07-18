export interface GremlinsSettings {
  enableClickToFix: boolean;
  showDangerousCharacters: boolean;
  showGutterIcons: boolean;
  showMixedIndentation: boolean;
  showTypographicCharacters: boolean;
}

export const DEFAULT_SETTINGS: GremlinsSettings = {
  enableClickToFix: false,
  showDangerousCharacters: true,
  showGutterIcons: true,
  showMixedIndentation: true,
  showTypographicCharacters: false,
};
