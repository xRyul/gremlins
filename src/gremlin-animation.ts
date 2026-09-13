import type { EditorView } from '@codemirror/view';

export interface CapturedGremlin {
  marker: HTMLElement;
  bounds: DOMRect;
}

export function captureVisibleGremlins(
  view: EditorView,
  affectedLines: readonly number[],
): CapturedGremlin[] {
  const captures: CapturedGremlin[] = [];
  const markers = Array.from(view.dom.querySelectorAll<HTMLElement>(
    '.gremlins-gutter-marker-interactive',
  ));
  const viewport = view.scrollDOM.getBoundingClientRect();
  for (const number of affectedLines) {
    const line = view.state.doc.line(number);
    if (!view.visibleRanges.some((range) => line.from <= range.to && line.to >= range.from)) {
      continue;
    }
    const coordinates = view.coordsAtPos(line.from);
    if (!coordinates) continue;
    const marker = markers.find((element) => {
      const bounds = element.getBoundingClientRect();
      const center = (bounds.top + bounds.bottom) / 2;
      return center >= coordinates.top - 2 && center <= coordinates.bottom + 2;
    });
    if (!marker) continue;
    const bounds = marker.getBoundingClientRect();
    if (bounds.bottom < viewport.top || bounds.top > viewport.bottom) continue;
    captures.push({ marker, bounds });
  }
  return captures;
}

/** The original explosion, shared by single-line and code-block fixes. */
export function showGremlinExplosion(
  view: EditorView,
  marker: Element,
  event: Event,
) {
  const bounds = marker.getBoundingClientRect();
  const pointerEvent = event as MouseEvent;
  showExplosionAt(
    view.dom.ownerDocument,
    pointerEvent.detail > 0 ? pointerEvent.clientX : bounds.left + bounds.width / 2,
    pointerEvent.detail > 0 ? pointerEvent.clientY : bounds.top + bounds.height / 2,
  );
}

function showExplosionAt(document: Document, left: number, top: number) {
  const ownerWindow = document.defaultView;
  if (!ownerWindow || ownerWindow.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return undefined;
  }
  const explosion = document.createElement('span');
  explosion.className = 'gremlins-explosion';
  explosion.setAttribute('aria-hidden', 'true');
  explosion.style.left = `${left}px`;
  explosion.style.top = `${top}px`;
  document.body.appendChild(explosion);
  const timer = ownerWindow.setTimeout(() => explosion.remove(), 500);
  explosion.addEventListener('animationend', () => {
    ownerWindow.clearTimeout(timer);
    explosion.remove();
  }, { once: true });
  return () => {
    ownerWindow.clearTimeout(timer);
    explosion.remove();
  };
}

/** Owned by a ViewPlugin so closing an editor also clears pending animation. */
export class GremlinCascade {
  private stopAnimation: (() => void) | undefined;

  stop() {
    this.stopAnimation?.();
    this.stopAnimation = undefined;
  }

  play(view: EditorView, captures: readonly CapturedGremlin[]) {
    this.stop();
    const document = view.dom.ownerDocument;
    const ownerWindow = document.defaultView;
    if (!ownerWindow || !captures.length ||
      ownerWindow.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const timers: number[] = [];
    const explosions: (() => void)[] = [];
    const ghosts = captures.map(({ marker, bounds }) => {
      const ghost = marker.cloneNode(true) as HTMLElement;
      ghost.classList.add('gremlins-block-ghost');
      ghost.removeAttribute('aria-label');
      ghost.setAttribute('aria-hidden', 'true');
      Object.assign(ghost.style, {
        left: `${bounds.left}px`, top: `${bounds.top}px`,
        width: `${bounds.width}px`, height: `${bounds.height}px`,
      });
      document.body.appendChild(ghost);
      return ghost;
    });
    const stop = () => {
      timers.forEach((timer) => ownerWindow.clearTimeout(timer));
      ghosts.forEach((ghost) => ghost.remove());
      explosions.forEach((remove) => remove());
      document.removeEventListener('scroll', stop, true);
      ownerWindow.removeEventListener('resize', stop);
      this.stopAnimation = undefined;
    };
    this.stopAnimation = stop;
    document.addEventListener('scroll', stop, true);
    ownerWindow.addEventListener('resize', stop);
    const interval = Math.min(85, 1200 / Math.max(1, captures.length - 1));
    captures.forEach(({ bounds }, index) => {
      timers.push(ownerWindow.setTimeout(() => {
        ghosts[index]?.remove();
        const remove = showExplosionAt(
          document, bounds.left + bounds.width / 2, bounds.top + bounds.height / 2,
        );
        if (remove) explosions.push(remove);
      }, 35 + index * interval));
    });
    timers.push(ownerWindow.setTimeout(stop, 550 + (captures.length - 1) * interval));
  }
}
