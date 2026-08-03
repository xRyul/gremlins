export type GremlinSeverity = 'info' | 'warning' | 'error';

export type GremlinCategory = 'dangerous' | 'typographic';

export type MarkdownListContext =
  | 'blockquote'
  | 'indented-code'
  | 'list-continuation'
  | 'literal'
  | 'nested-list-item'
  | 'parserless'
  | 'plain-text'
  | 'root-list-item'
  | 'unknown';

export interface GremlinDefinition {
  category: GremlinCategory;
  codePoint: number;
  name: string;
  replacement: string;
  severity: GremlinSeverity;
  zeroWidth: boolean;
}

export interface CharacterGremlinMatch {
  codePoint: number;
  count: number;
  from: number;
  kind: 'character';
  line: number;
  name: string;
  severity: GremlinSeverity;
  to: number;
  zeroWidth: boolean;
}

export interface AmbiguousEmptyListMarkerGremlinMatch {
  codePoint: null;
  count: 1;
  from: number;
  kind: 'ambiguous-empty-list-marker';
  line: number;
  name: 'ambiguous empty list marker';
  severity: 'warning';
  to: number;
  zeroWidth: false;
}

export interface DuplicateListMarkerGremlinMatch {
  codePoint: null;
  count: 1;
  from: number;
  kind: 'duplicate-list-marker';
  line: number;
  name: 'duplicate list marker';
  severity: 'warning';
  to: number;
  zeroWidth: false;
}

export interface MixedIndentationGremlinMatch {
  codePoint: null;
  count: number;
  from: number;
  kind: 'mixed-indentation';
  line: number;
  name: 'mixed indentation';
  severity: 'warning';
  to: number;
  zeroWidth: false;
}

export interface ListIndentationGremlinMatch {
  codePoint: null;
  count: number;
  from: number;
  kind: 'list-indentation';
  line: number;
  name: 'list indentation';
  reason: 'misaligned' | 'orphaned';
  severity: 'warning';
  to: number;
  zeroWidth: false;
}

export interface ListMarkerSpacingGremlinMatch {
  codePoint: null;
  count: number;
  from: number;
  kind: 'list-marker-spacing';
  line: number;
  name: 'list marker spacing';
  severity: 'warning';
  to: number;
  zeroWidth: false;
}

export interface ListItemPunctuationGremlinMatch {
  codePoint: null;
  count: number;
  expected: string;
  from: number;
  kind: 'list-item-punctuation';
  line: number;
  name: 'list item punctuation';
  replacement: string;
  replacementFrom: number;
  replacementTo: number;
  severity: 'warning';
  to: number;
  zeroWidth: false;
}

export interface ListItemLineEndingGremlinMatch {
  codePoint: null;
  count: number;
  expected:
    | 'blank-line'
    | 'no-trailing-whitespace'
    | 'two-spaces';
  from: number;
  kind: 'list-item-line-ending';
  line: number;
  name: 'list item line ending';
  replacement: string;
  replacementFrom: number;
  replacementTo: number;
  severity: 'warning';
  to: number;
  zeroWidth: false;
}

export interface MissingListMarkerGremlinMatch {
  codePoint: null;
  count: number;
  from: number;
  kind: 'missing-list-marker';
  line: number;
  marker: '-' | '+' | '*';
  name: 'missing list marker';
  severity: 'warning';
  targetIndentation: string;
  to: number;
  zeroWidth: false;
}

export type GremlinMatch =
  | AmbiguousEmptyListMarkerGremlinMatch
  | CharacterGremlinMatch
  | DuplicateListMarkerGremlinMatch
  | ListIndentationGremlinMatch
  | ListItemLineEndingGremlinMatch
  | ListItemPunctuationGremlinMatch
  | ListMarkerSpacingGremlinMatch
  | MissingListMarkerGremlinMatch
  | MixedIndentationGremlinMatch;
