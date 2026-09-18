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

interface StructuralGremlinMatch {
  codePoint: null;
  count: number;
  from: number;
  line: number;
  severity: 'warning';
  to: number;
  zeroWidth: false;
}

export interface AmbiguousEmptyListMarkerGremlinMatch extends StructuralGremlinMatch {
  count: 1;
  kind: 'ambiguous-empty-list-marker';
  name: 'ambiguous empty list marker';
}

export interface DuplicateListMarkerGremlinMatch extends StructuralGremlinMatch {
  count: 1;
  kind: 'duplicate-list-marker';
  name: 'duplicate list marker';
}

export interface MixedIndentationGremlinMatch extends StructuralGremlinMatch {
  kind: 'mixed-indentation';
  name: 'mixed indentation';
}

export interface ListIndentationGremlinMatch extends StructuralGremlinMatch {
  kind: 'list-indentation';
  name: 'list indentation';
  reason: 'misaligned' | 'orphaned';
}

export interface ListMarkerSpacingGremlinMatch extends StructuralGremlinMatch {
  kind: 'list-marker-spacing';
  name: 'list marker spacing';
}

export interface ListItemPunctuationGremlinMatch extends StructuralGremlinMatch {
  expected: string;
  kind: 'list-item-punctuation';
  name: 'list item punctuation';
  replacement: string;
  replacementFrom: number;
  replacementTo: number;
}

export interface ListItemLineEndingGremlinMatch extends StructuralGremlinMatch {
  expected:
    | 'blank-line'
    | 'no-trailing-whitespace'
    | 'two-spaces';
  kind: 'list-item-line-ending';
  name: 'list item line ending';
  replacement: string;
  replacementFrom: number;
  replacementTo: number;
}

export interface MissingListMarkerGremlinMatch extends StructuralGremlinMatch {
  kind: 'missing-list-marker';
  marker: '-' | '+' | '*';
  name: 'missing list marker';
  targetIndentation: string;
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
