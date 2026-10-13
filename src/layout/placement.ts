import { edgesOf } from '../core/defaults.ts';
import type { FlexItemProps, Length, Pt, Rect, Spacing } from '../core/types.ts';

/** Tamanho que o nó pede explicitamente (ausente = o nó decide pelo conteúdo). */
export interface ExplicitSize {
  readonly width?: Pt;
  readonly height?: Pt;
}

/** Onde e com quanto espaço um nó pode ser posicionado dentro do pai. */
export interface Placement {
  readonly explicit: ExplicitSize;
  /** Espaço disponível quando o nó não tem tamanho explícito. */
  readonly available: { readonly width: Pt; readonly height: Pt };
  readonly place: (width: Pt, height: Pt) => Rect;
}

interface AxisSpec {
  readonly start?: Pt;
  readonly end?: Pt;
  readonly size?: Pt;
}

export const resolveLength = (value: Length | undefined, reference: Pt): Pt | undefined => {
  if (value === undefined) return undefined;
  if (typeof value === 'number') return value;
  return (Number.parseFloat(value) / 100) * reference;
};

const explicitOnAxis = ({ start, end, size }: AxisSpec, parentSize: Pt): Pt | undefined => {
  if (size !== undefined) return size;
  if (start === undefined || end === undefined) return undefined;
  return parentSize - start - end;
};

const availableOnAxis = ({ start, end }: AxisSpec, parentSize: Pt): Pt => parentSize - (start ?? 0) - (end ?? 0);

// Com start, end e size ao mesmo tempo, start vence (como no CSS em LTR).
const originOnAxis = ({ start, end }: AxisSpec, parentOrigin: Pt, parentSize: Pt, size: Pt): Pt => {
  if (start !== undefined) return parentOrigin + start;
  if (end !== undefined) return parentOrigin + parentSize - end - size;
  return parentOrigin;
};

const horizontalSpec = (props: FlexItemProps, parent: Rect): AxisSpec => ({
  start: resolveLength(props.left, parent.width),
  end: resolveLength(props.right, parent.width),
  size: resolveLength(props.width, parent.width),
});

const verticalSpec = (props: FlexItemProps, parent: Rect): AxisSpec => ({
  start: resolveLength(props.top, parent.height),
  end: resolveLength(props.bottom, parent.height),
  size: resolveLength(props.height, parent.height),
});

const absolutePlacement = (props: FlexItemProps, parent: Rect): Placement => {
  const h = horizontalSpec(props, parent);
  const v = verticalSpec(props, parent);
  return {
    explicit: { width: explicitOnAxis(h, parent.width), height: explicitOnAxis(v, parent.height) },
    available: { width: availableOnAxis(h, parent.width), height: availableOnAxis(v, parent.height) },
    place: (width, height) => ({
      x: originOnAxis(h, parent.x, parent.width, width),
      y: originOnAxis(v, parent.y, parent.height, height),
      width,
      height,
    }),
  };
};

// Provisório (M1): sem Yoga, nó em fluxo ocupa a área de conteúdo inteira do pai.
const flowPlacement = (content: Rect): Placement => ({
  explicit: { width: content.width, height: content.height },
  available: { width: content.width, height: content.height },
  place: () => content,
});

/** Área de conteúdo do pai: seu frame menos o padding. */
export interface ParentArea {
  readonly frame: Rect;
  readonly content: Rect;
}

export const parentAreaOf = (frame: Rect, padding: Spacing | undefined): ParentArea => {
  const edges = edgesOf(padding);
  return {
    frame,
    content: {
      x: frame.x + edges.left,
      y: frame.y + edges.top,
      width: frame.width - edges.left - edges.right,
      height: frame.height - edges.top - edges.bottom,
    },
  };
};

export const placementOf = (props: FlexItemProps, parent: ParentArea): Placement =>
  props.position === 'absolute' ? absolutePlacement(props, parent.frame) : flowPlacement(parent.content);
