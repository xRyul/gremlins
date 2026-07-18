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

import { detectLineGremlins } from './detect.ts';
import {
  buildGremlinFixChanges,
  isGremlinFixable,
} from './fix.ts';
import { findGremlinAtPosition } from './match-position.ts';
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
      ? 'Fix all gremlins on this line'
      : 'Line contains one or more gremlins';
    marker.setAttribute('aria-label', label);
    marker.title = label;
    setIcon(marker, 'bug');
    return marker;
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
  const changes = buildGremlinFixChanges(
    lineMatches,
    line.text,
    line.from,
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

function showGremlinExplosion(
  view: EditorView,
  marker: Element,
  event: Event,
) {
  const document = view.dom.ownerDocument;
  const ownerWindow = document.defaultView;
  if (ownerWindow?.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  const markerBounds = marker.getBoundingClientRect();
  const pointerEvent = event as MouseEvent;
  const fromPointer = pointerEvent.detail > 0;
  const left = fromPointer
    ? pointerEvent.clientX
    : markerBounds.left + markerBounds.width / 2;
  const top = fromPointer
    ? pointerEvent.clientY
    : markerBounds.top + markerBounds.height / 2;
  const explosion = document.createElement('span');
  explosion.className = 'gremlins-explosion';
  explosion.setAttribute('aria-hidden', 'true');
  explosion.style.left = `${left}px`;
  explosion.style.top = `${top}px`;
  document.body.appendChild(explosion);

  explosion.addEventListener('animationend', () => explosion.remove(), {
    once: true,
  });
  ownerWindow?.setTimeout(() => explosion.remove(), 500);
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

