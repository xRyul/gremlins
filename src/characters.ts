import type { GremlinDefinition } from './types.ts';

export const GREMLIN_DEFINITIONS: readonly GremlinDefinition[] = [
  dangerous(0x0003, 'end of text', 'warning', true, ''),
  dangerous(0x000b, 'line tabulation', 'warning', true, '\n'),
  dangerous(0x00a0, 'non-breaking space', 'warning', false, ' '),
  dangerous(0x00ad, 'soft hyphen', 'warning', true, ''),
  dangerous(0x180e, 'Mongolian vowel separator', 'warning', true, ''),
  dangerous(0x2007, 'figure space', 'warning', false, ' '),
  dangerous(0x200b, 'zero-width space', 'error', true, ''),
  dangerous(0x200c, 'zero-width non-joiner', 'warning', true, ''),
  dangerous(0x200e, 'left-to-right mark', 'error', true, ''),
  dangerous(0x200f, 'right-to-left mark', 'error', true, ''),
  dangerous(0x2028, 'line separator', 'error', true, '\n'),
  dangerous(0x2029, 'paragraph separator', 'error', true, '\n\n'),
  dangerous(0x202a, 'left-to-right embedding', 'error', true, ''),
  dangerous(0x202b, 'right-to-left embedding', 'error', true, ''),
  dangerous(0x202c, 'pop directional formatting', 'error', true, ''),
  dangerous(0x202d, 'left-to-right override', 'error', true, ''),
  dangerous(0x202e, 'right-to-left override', 'error', true, ''),
  dangerous(0x202f, 'narrow non-breaking space', 'warning', false, ' '),
  dangerous(0x2060, 'word joiner', 'error', true, ''),
  dangerous(0x2066, 'left-to-right isolate', 'error', true, ''),
  dangerous(0x2067, 'right-to-left isolate', 'error', true, ''),
  dangerous(0x2068, 'first strong isolate', 'error', true, ''),
  dangerous(0x2069, 'pop directional isolate', 'error', true, ''),
  dangerous(0xfeff, 'zero-width no-break space', 'error', true, ''),
  dangerous(0xfffc, 'object replacement character', 'error', true, ''),
  typographic(0x2013, 'en dash', '-'),
  typographic(0x2018, 'left single quotation mark', "'"),
  typographic(0x2019, 'right single quotation mark', "'"),
  typographic(0x201c, 'left double quotation mark', '"'),
  typographic(0x201d, 'right double quotation mark', '"'),
];

export const GREMLIN_DEFINITIONS_BY_CODE_POINT = new Map(
  GREMLIN_DEFINITIONS.map((definition) => [definition.codePoint, definition]),
);

function dangerous(
  codePoint: number,
  name: string,
  severity: 'warning' | 'error',
  zeroWidth: boolean,
  replacement: string,
): GremlinDefinition {
  return {
    category: 'dangerous',
    codePoint,
    name,
    replacement,
    severity,
    zeroWidth,
  };
}

function typographic(
  codePoint: number,
  name: string,
  replacement: string,
): GremlinDefinition {
  return {
    category: 'typographic',
    codePoint,
    name,
    replacement,
    severity: 'info',
    zeroWidth: false,
  };
}
