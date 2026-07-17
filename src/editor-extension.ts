import { RangeSet, RangeSetBuilder, type Extension } from '@codemirror/state';
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

import { detectLineGremlins } from './detect.ts';
import { findGremlinAtPosition } from './match-position.ts';
import {
  formatGremlinTooltip,
  highestSeverity,
} from './presentation.ts';
import type { GremlinsSettings } from './settings-model.ts';
import type { GremlinMatch, GremlinSeverity } from './types.ts';

class GremlinGutterMarker extends GutterMarker {
  constructor(private readonly severity: GremlinSeverity) {
    super();
  }

  eq(other: GremlinGutterMarker) {
    return this.severity === other.severity;
  }

  toDOM(view: EditorView) {
    const marker = view.dom.ownerDocument.createElement('span');
    marker.className = `gremlins-gutter-marker gremlins-severity-${this.severity}`;
    marker.setAttribute('aria-label', 'Line contains one or more gremlins');
    marker.title = 'Line contains one or more gremlins';
    setIcon(marker, 'bug');
    return marker;
  }
}

const GUTTER_MARKERS: Record<GremlinSeverity, GremlinGutterMarker> = {
  error: new GremlinGutterMarker('error'),
  info: new GremlinGutterMarker('info'),
  warning: new GremlinGutterMarker('warning'),
};

export function createGremlinsEditorExtension(
  settings: GremlinsSettings,
): Extension[] {
  const gremlinsViewPlugin = ViewPlugin.fromClass(
    class implements PluginValue {
      decorations: DecorationSet = Decoration.none;
      markers = RangeSet.empty as RangeSet<GutterMarker>;
      matches: GremlinMatch[] = [];

      constructor(view: EditorView) {
        this.refresh(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.refresh(update.view);
        }
      }

      private refresh(view: EditorView) {
        const result = buildVisibleGremlins(view, settings);
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
        initialSpacer: () => GUTTER_MARKERS.info,
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
): VisibleGremlins {
  const decorationBuilder = new RangeSetBuilder<Decoration>();
  const markerBuilder = new RangeSetBuilder<GutterMarker>();
  const matches: GremlinMatch[] = [];
  const visitedLines = new Set<number>();

  for (const visibleRange of view.visibleRanges) {
    let line = view.state.doc.lineAt(visibleRange.from);

    while (line.from <= visibleRange.to) {
      if (!visitedLines.has(line.number)) {
        visitedLines.add(line.number);
        const lineMatches = detectLineGremlins(
          line.text,
          line.from,
          line.number - 1,
          settings,
        );
        matches.push(...lineMatches);

        for (const match of lineMatches) {
          decorationBuilder.add(
            match.from,
            match.to,
            Decoration.mark({
              attributes: {
                'aria-label': formatGremlinTooltip(match),
                'data-gremlin': match.kind,
              },
              class: decorationClasses(match),
            }),
          );
        }

        if (lineMatches.length > 0) {
          const severity = highestSeverity(
            lineMatches.map((match) => match.severity),
          );
          markerBuilder.add(line.from, line.from, GUTTER_MARKERS[severity]);
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

function decorationClasses(match: GremlinMatch) {
  return [
    'gremlins-character',
    `gremlins-severity-${match.severity}`,
    match.zeroWidth ? 'gremlins-zero-width' : 'gremlins-visible-width',
    match.kind === 'mixed-indentation' ? 'gremlins-mixed-indentation' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

