export interface GremlinsSettings {
  enableClickToFix: boolean;
  showDangerousCharacters: boolean;
  showGutterIcons: boolean;
  showListIndentation: boolean;
  showMixedIndentation: boolean;
  showTypographicCharacters: boolean;
}

export const DEFAULT_SETTINGS: GremlinsSettings = {
  enableClickToFix: false,
  showDangerousCharacters: true,
  showGutterIcons: true,
  showListIndentation: false,
  showMixedIndentation: true,
  showTypographicCharacters: false,
};
