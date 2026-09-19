export type ListItemPunctuationPolicy =
  | 'disabled'
  | 'consistent'
  | 'by-list-type'
  | 'none'
  | 'period'
  | 'semicolon'
  | 'semicolon-final-period';

export type ListItemLineEndingPolicy =
  | 'disabled'
  | 'no-trailing-whitespace'
  | 'two-spaces'
  | 'blank-line';

export interface GremlinsSettings {
  enableClickToFix: boolean;
  listItemLineEndingPolicy: ListItemLineEndingPolicy;
  listItemPunctuationPolicy: ListItemPunctuationPolicy;
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
  listItemLineEndingPolicy: 'disabled',
  listItemPunctuationPolicy: 'disabled',
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
