import { syntaxTreeAvailable } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { detectGremlins } from '../src/detect.ts';
import { buildGremlinFixChanges } from '../src/fix.ts';
import { detectListItemEndingGremlins } from '../src/list-item-endings.ts';
import {
  detectEditorListItemEndingGremlins,
  getMarkdownListLineContext,
} from '../src/markdown-context.ts';
import { DEFAULT_SETTINGS } from '../src/settings-model.ts';

const mixed = '- One\n- Two;\n- Three.';
const literal = '---\naliases:\n  - Hidden\n---\n```md\n- Hidden\n```\n    - Hidden\n- Visible';
const scenarios = [
  {
    name: 'disabled defaults', text: mixed, settings: {}, warnings: [], fixed: mixed,
  },
  {
    name: 'periods', text: mixed, settings: { listItemPunctuationPolicy: 'period' },
    warnings: [[0, 'list-item-punctuation', '.', 1], [1, 'list-item-punctuation', '.', 1]],
    fixed: '- One.\n- Two.\n- Three.',
  },
  {
    name: 'semicolons', text: mixed, settings: { listItemPunctuationPolicy: 'semicolon' },
    warnings: [[0, 'list-item-punctuation', ';', 1], [2, 'list-item-punctuation', ';', 1]],
    fixed: '- One;\n- Two;\n- Three;',
  },
  {
    name: 'remove punctuation including a complete run', text: mixed + ';', settings: { listItemPunctuationPolicy: 'none' },
    warnings: [[1, 'list-item-punctuation', '', 1], [2, 'list-item-punctuation', '', 2]],
    fixed: '- One\n- Two\n- Three',
  },
  {
    name: 'formal punctuation', text: '- One.\n- Two\n- Three;',
    settings: { listItemPunctuationPolicy: 'semicolon-final-period' },
    warnings: [[0, 'list-item-punctuation', ';', 1], [1, 'list-item-punctuation', ';', 1], [2, 'list-item-punctuation', '.', 1]],
    fixed: '- One;\n- Two;\n- Three.',
  },
  {
    name: 'inference with unavailable syntax', text: '- First.\n- Second\n- Third.',
    settings: { listItemPunctuationPolicy: 'consistent' },
    warnings: [[1, 'list-item-punctuation', '.', 1]],
    fixed: '- First.\n- Second.\n- Third.',
  },
  {
    name: 'literal exclusions without a parser', text: literal,
    settings: { listItemPunctuationPolicy: 'period' },
    warnings: [[8, 'list-item-punctuation', '.', 1]], fixed: literal + '.',
  },
  {
    name: 'punctuation counts, ordering and simultaneous multi-line changes', text: '- Done.;\n- Item',
    settings: { listItemPunctuationPolicy: 'period', listItemLineEndingPolicy: 'two-spaces' },
    warnings: [
      [0, 'list-item-punctuation', '.', 2], [0, 'list-item-line-ending', 'two-spaces', 1],
      [1, 'list-item-punctuation', '.', 1], [1, 'list-item-line-ending', 'two-spaces', 1],
    ],
    fixed: '- Done.  \n- Item.  ',
  },
  {
    name: 'trailing whitespace', text: '- First  \n- Second\t\n\nNot a list  ',
    settings: { listItemLineEndingPolicy: 'no-trailing-whitespace' },
    warnings: [[0, 'list-item-line-ending', 'no-trailing-whitespace', 2], [1, 'list-item-line-ending', 'no-trailing-whitespace', 1]],
    fixed: '- First\n- Second\n\nNot a list  ',
  },
  {
    name: 'sibling separators', text: '- First\n- Second\n\n- Third',
    settings: { listItemLineEndingPolicy: 'blank-line' },
    warnings: [[0, 'list-item-line-ending', 'blank-line', 1]],
    fixed: '- First\n\n- Second\n\n- Third',
  },
] as const;

describe('list-ending fallback contracts', () => {
  for (const mode of ['parserless', 'whole-document', 'unparsed-editor']) {
    it(`detects and fixes without a parser: ${mode}`, () => {
      for (const scenario of scenarios) {
        const label = `${mode}: ${scenario.name}`;
        const state = EditorState.create({ doc: scenario.text });
        const settings = { ...DEFAULT_SETTINGS, ...scenario.settings };
        if (mode === 'unparsed-editor') {
          // A real state without a language extension; no injected classifications.
          assert.equal(syntaxTreeAvailable(state, state.doc.length), false, label);
          assert.equal(getMarkdownListLineContext(state, state.doc.line(1).text, 0).context, 'unknown', label);
        }
        const matches = mode === 'parserless'
          ? detectListItemEndingGremlins(scenario.text, settings)
          : mode === 'whole-document'
            ? detectGremlins(scenario.text, settings)
            : detectEditorListItemEndingGremlins(state, settings);
        assert.deepEqual(matches.map(match => [
          match.line, match.kind, 'expected' in match ? match.expected : null, match.count,
        ]), scenario.warnings, label);

        // Apply every original-source edit in one transaction, as the old helper did.
        const changes = Array.from({ length: state.doc.lines }, (_, index) => {
          const line = state.doc.line(index + 1);
          return buildGremlinFixChanges(matches.filter(match => match.line === index), line.text, line.from);
        }).flat();
        assert.equal(state.update({ changes }).state.doc.toString(), scenario.fixed, label);
      }
    });
  }
});
