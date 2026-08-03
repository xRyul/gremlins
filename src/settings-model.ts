export interface GremlinsSettings {
  enableClickToFix: boolean;
  showAmbiguousEmptyListMarkers: boolean;
  showDangerousCharacters: boolean;
  showDuplicateListMarkers: boolean;
  showGutterIcons: boolean;
  showListIndentation: boolean;
  showListMarkerSpacing: boolean;
  showMissingListMarkers: boolean;
  showMixedIndentation: boolean;
  showTypographicCharacters: boolean;
}

export const DEFAULT_SETTINGS: GremlinsSettings = {
  enableClickToFix: false,
  showAmbiguousEmptyListMarkers: false,
  showDangerousCharacters: true,
  showDuplicateListMarkers: false,
  showGutterIcons: true,
  showListIndentation: false,
  showListMarkerSpacing: false,
  showMissingListMarkers: false,
  showMixedIndentation: true,
  showTypographicCharacters: false,
};
