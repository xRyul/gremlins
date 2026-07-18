export type GremlinSeverity = 'info' | 'warning' | 'error';

export type GremlinCategory = 'dangerous' | 'typographic';

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

export type GremlinMatch =
  | CharacterGremlinMatch
  | MixedIndentationGremlinMatch;
