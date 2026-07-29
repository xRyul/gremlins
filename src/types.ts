export type GremlinSeverity = 'info' | 'warning' | 'error';

export type GremlinCategory = 'dangerous' | 'typographic';

export type MarkdownListContext =
  | 'indented-code'
  | 'literal'
  | 'nested-list-item'
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
  | CharacterGremlinMatch
  | ListIndentationGremlinMatch
  | MissingListMarkerGremlinMatch
  | MixedIndentationGremlinMatch;
