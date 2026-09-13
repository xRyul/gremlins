import {
  RangeSet,
  RangeSetBuilder,
  type Extension,
} from '@codemirror/state';
import {
  Decoration,
  EditorView,
  GutterMarker,
  ViewPlugin,
  gutter,
  hoverTooltip,
  type DecorationSet,
  type PluginValue,
  type ViewUpdate,
} from '@codemirror/view';
import { setIcon } from 'obsidian';

import { createCodeBlockScanner, type CodeBlockFix } from './code-blocks.ts';
import {
  captureVisibleGremlins,
  GremlinCascade,
  showGremlinExplosion,
} from './gremlin-animation.ts';
import { detectLineGremlins } from './detect.ts';
import {
  buildGremlinFixChangesForDocument,
  isGremlinFixable,
} from './fix.ts';
import { findGremlinAtPosition } from './match-position.ts';
import {
  detectEditorListItemEndingGremlins,
  getMarkdownListContext,
  markdownSyntaxTreeChanged,
} from './markdown-context.ts';
import { GREMLIN_ICON_ID } from './gremlin-icon.ts';
import {
  formatGremlinTooltip,
  highestSeverity,
} from './presentation.ts';
import type { GremlinsSettings } from './settings-model.ts';
import type { GremlinMatch, GremlinSeverity } from './types.ts';

class GremlinGutterMarker extends GutterMarker {
  constructor(
    private readonly severity: GremlinSeverity,
    private readonly interactive: boolean,
  ) {
    super();
  }

  eq(other: GremlinGutterMarker) {
    return (
      this.severity === other.severity &&
      this.interactive === other.interactive
    );
  }

  toDOM(view: EditorView) {
    const marker = view.dom.ownerDocument.createElement('span');
    marker.className = `gremlins-gutter-marker gremlins-severity-${this.severity}`;

    if (this.interactive) {
      marker.classList.add('gremlins-gutter-marker-interactive');
    }

    const label = this.interactive
      ? 'Fix highlighted gremlins'
      : 'Line contains one or more gremlins';
    marker.setAttribute('aria-label', label);
    setIcon(marker, GREMLIN_ICON_ID);
    return marker;
  }
}

class CodeBlockGutterMarker extends GutterMarker {
  constructor(
    private readonly from: number,
    private readonly affectedLineCount: number,
    private readonly fixBlock: (view: EditorView, from: number) => void,
  ) {
    super();
  }

  eq(other: CodeBlockGutterMarker) {
    return this.from === other.from &&
      this.affectedLineCount === other.affectedLineCount &&
      this.fixBlock === other.fixBlock;
  }

  toDOM(view: EditorView) {
    const button = view.dom.ownerDocument.createElement('button');
    button.type = 'button';
    button.className = 'gremlins-block-marker';
    // Obsidian uses aria-label for tooltips. A title would add a second tooltip.
    button.setAttribute('aria-label', `Fix code block (${this.affectedLineCount} affected lines)`);
    setIcon(button, GREMLIN_ICON_ID);
    button.addEventListener('mousedown', (event) => event.preventDefault());
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.fixBlock(view, this.from);
    });
    return button;
  }
}

function createGutterMarkers(interactive: boolean) {
  return {
    error: new GremlinGutterMarker('error', interactive),
    info: new GremlinGutterMarker('info', interactive),
    warning: new GremlinGutterMarker('warning', interactive),
  };
}

const GUTTER_MARKERS = {
  interactive: createGutterMarkers(true),
  passive: createGutterMarkers(false),
};

function getGutterMarkers(interactive: boolean) {
  return GUTTER_MARKERS[interactive ? 'interactive' : 'passive'];
}

export function createGremlinsEditorExtension(
  settings: GremlinsSettings,
): Extension[] {
  const gremlinsViewPlugin = ViewPlugin.fromClass(
    class implements PluginValue {
      decorations: DecorationSet = Decoration.none;
      markers = RangeSet.empty as RangeSet<GutterMarker>;
      matches: GremlinMatch[] = [];
      private readonly scanBlocks = createCodeBlockScanner(settings);
      private readonly cascade = new GremlinCascade();

      private readonly fixBlock = (view: EditorView, from: number) => {
        if (!settings.showGutterIcons || !settings.enableClickToFix) return;
        // Look up current positions instead of applying a stale button's changes.
        const block = this.scanBlocks(view.state.doc, view.state.tabSize)
          .find((candidate) => candidate.from === from);
        if (!block) return;
        const captures = captureVisibleGremlins(view, block.affectedLines);
        view.focus();
        view.dispatch({ changes: block.changes, userEvent: 'input.gremlins.fix' });
        this.cascade.play(view, captures);
      };

      constructor(view: EditorView) {
        this.refresh(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged) {
          this.cascade.stop();
        }
        if (
          update.docChanged ||
          update.viewportChanged ||
          update.startState.tabSize !== update.state.tabSize ||
          markdownSyntaxTreeChanged(update.startState, update.state)
        ) {
          this.refresh(update.view);
        }
      }

      destroy() {
        this.cascade.stop();
      }

      private refresh(view: EditorView) {
        const blocks = settings.showGutterIcons && settings.enableClickToFix
          ? this.scanBlocks(view.state.doc, view.state.tabSize)
          : [];
        const result = buildVisibleGremlins(view, settings, blocks, this.fixBlock);
        this.decorations = result.decorations;
        this.markers = result.markers;
        this.matches = result.matches;
      }
    },
    {
      decorations: (value) => value.decorations,
    },
  );

  const extensions: Extension[] = [
    gremlinsViewPlugin,
    hoverTooltip(
      (view, position, side) => {
        const match = findGremlinAtPosition(
          view.plugin(gremlinsViewPlugin)?.matches ?? [],
          position,
          side,
        );
        if (!match) {
          return null;
        }

        return {
          above: true,
          end: match.to,
          pos: match.from,
          create(editorView) {
            const tooltip = editorView.dom.ownerDocument.createElement('div');
            tooltip.className = 'gremlins-tooltip';
            tooltip.textContent = formatGremlinTooltip(match);
            return { dom: tooltip };
          },
        };
      },
      { hoverTime: 200 },
    ),
  ];

  if (settings.showGutterIcons) {
    extensions.push(
      gutter({
        class: 'gremlins-gutter',
        domEventHandlers: settings.enableClickToFix
          ? {
              click(view, line, event) {
                const matches =
                  view.plugin(gremlinsViewPlugin)?.matches ?? [];
                return fixGremlinsOnLine(view, line.from, matches, event);
              },
            }
          : undefined,
        initialSpacer: () => GUTTER_MARKERS.passive.info,
        markers: (view) =>
          view.plugin(gremlinsViewPlugin)?.markers ?? RangeSet.empty,
      }),
    );
  }

  return extensions;
}

interface VisibleGremlins {
  decorations: DecorationSet;
  markers: RangeSet<GutterMarker>;
  matches: GremlinMatch[];
}

function buildVisibleGremlins(
  view: EditorView,
  settings: GremlinsSettings,
  codeBlocks: readonly CodeBlockFix[],
  fixBlock: (view: EditorView, from: number) => void,
): VisibleGremlins {
  const decorationBuilder = new RangeSetBuilder<Decoration>();
  const markerBuilder = new RangeSetBuilder<GutterMarker>();
  const matches: GremlinMatch[] = [];
  const visitedLines = new Set<number>();
  const codeBlocksByLine = new Map(codeBlocks.map((block) => [block.openingLine, block]));
  const listItemEndingMatchesByLine = new Map<number, GremlinMatch[]>();
  for (const match of detectEditorListItemEndingGremlins(
    view.state,
    settings,
  )) {
    const lineMatches = listItemEndingMatchesByLine.get(match.line) ?? [];
    lineMatches.push(match);
    listItemEndingMatchesByLine.set(match.line, lineMatches);
  }

  for (const visibleRange of view.visibleRanges) {
    let line = view.state.doc.lineAt(visibleRange.from);

    while (line.from <= visibleRange.to) {
      if (!visitedLines.has(line.number)) {
        visitedLines.add(line.number);
        const lineMatches = [
          ...detectLineGremlins(
            line.text,
            line.from,
            line.number - 1,
            settings,
            view.state.tabSize,
            getMarkdownListContext(view.state, line.text, line.from),
            line.number > 1
              ? view.state.doc.line(line.number - 1).text
              : undefined,
            line.number < view.state.doc.lines
              ? view.state.doc.line(line.number + 1).text
              : undefined,
          ),
          ...(listItemEndingMatchesByLine.get(line.number - 1) ?? []),
        ].sort((left, right) =>
          left.from - right.from || left.to - right.to,
        );
        matches.push(...lineMatches);

        for (const match of lineMatches) {
          decorationBuilder.add(
            match.from,
            match.to,
            Decoration.mark({
              attributes: {
                'data-gremlin': match.kind,
              },
              class: decorationClasses(match),
            }),
          );
        }

        const codeBlock = codeBlocksByLine.get(line.number);
        if (codeBlock) {
          markerBuilder.add(line.from, line.from, new CodeBlockGutterMarker(
            codeBlock.from, codeBlock.affectedLines.length, fixBlock,
          ));
        } else if (lineMatches.length > 0) {
          const severity = highestSeverity(
            lineMatches.map((match) => match.severity),
          );
          const isInteractive =
            settings.enableClickToFix &&
            lineMatches.some(isGremlinFixable);
          const gutterMarkers = getGutterMarkers(isInteractive);
          markerBuilder.add(
            line.from,
            line.from,
            gutterMarkers[severity],
          );
        }
      }

      if (line.number === view.state.doc.lines || line.to >= visibleRange.to) {
        break;
      }
      line = view.state.doc.line(line.number + 1);
    }
  }

  return {
    decorations: decorationBuilder.finish(),
    markers: markerBuilder.finish(),
    matches,
  };
}

function fixGremlinsOnLine(
  view: EditorView,
  lineFrom: number,
  matches: readonly GremlinMatch[],
  event: Event,
) {
  const eventTarget = event.target as Element | null;
  if (typeof eventTarget?.closest !== 'function') {
    return false;
  }

  const marker = eventTarget.closest(
    '.gremlins-gutter-marker-interactive',
  );
  if (!marker) {
    return false;
  }

  const line = view.state.doc.lineAt(lineFrom);
  const lineMatches = matches.filter(
    (match) => match.line === line.number - 1,
  );
  const changes = buildGremlinFixChangesForDocument(
    lineMatches,
    view.state.doc.toString(),
    line.text,
    line.from,
    line.number - 1,
    view.state.tabSize,
  );
  if (changes.length === 0) {
    return true;
  }

  showGremlinExplosion(view, marker, event);
  view.dispatch({
    changes,
    userEvent: 'input.gremlins.fix',
  });
  view.focus();
  return true;
}

function decorationClasses(match: GremlinMatch) {
  return [
    'gremlins-character',
    `gremlins-severity-${match.severity}`,
    match.zeroWidth ? 'gremlins-zero-width' : 'gremlins-visible-width',
    match.kind === 'ambiguous-empty-list-marker'
      ? 'gremlins-ambiguous-empty-list-marker'
      : '',
    match.kind === 'duplicate-list-marker'
      ? 'gremlins-duplicate-list-marker'
      : '',
    match.kind === 'mixed-indentation' ? 'gremlins-mixed-indentation' : '',
    match.kind === 'list-indentation' ? 'gremlins-list-indentation' : '',
    match.kind === 'list-marker-spacing'
      ? 'gremlins-list-marker-spacing'
      : '',
    match.kind === 'list-item-line-ending'
      ? 'gremlins-list-item-line-ending'
      : '',
    match.kind === 'list-item-punctuation'
      ? 'gremlins-list-item-punctuation'
      : '',
    match.kind === 'missing-list-marker'
      ? 'gremlins-missing-list-marker'
      : '',
  ]
    .filter(Boolean)
    .join(' ');
}

