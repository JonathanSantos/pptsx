// PoC CSS: cópia de src/fit/scope.ts com os tipos da PoC (nós com css); adaptações marcadas com 'PoC:'.
import type { PrimitiveKind } from '../types.ts';
import { primitiveName } from '../../../src/primitives/index.ts';

// Funções puras sobre o path do resolve ('Slide > Bullets > Box[1] > Text').

const SEPARATOR = ' > ';
const SIBLING_INDEX = /\[\d+\]$/;

const PRIMITIVE_KINDS: readonly PrimitiveKind[] = ['slide', 'box', 'text', 'image', 'shape', 'chart', 'table'];
const PRIMITIVE_SEGMENTS: ReadonlySet<string> = new Set(PRIMITIVE_KINDS.map(primitiveName));

export const segmentsOf = (path: string): readonly string[] => path.split(SEPARATOR);

const joinSegments = (segments: readonly string[]): string => segments.join(SEPARATOR);

/** Segmento que não é primitiva = nome de componente (o sufixo [i] não conta). */
export const isComponentSegment = (segment: string): boolean =>
  !PRIMITIVE_SEGMENTS.has(segment.replace(SIBLING_INDEX, ''));

/** O próprio nó e seus ancestrais, do mais próximo ao mais distante, sem o slide. */
export const selfAndAncestors = (path: string): readonly string[] => {
  const segments = segmentsOf(path);
  return segments.slice(1).map((_, index) => joinSegments(segments.slice(0, segments.length - index)));
};

/** Ancestrais estritos, do mais próximo ao mais distante, incluindo o slide. */
export const ancestorsOf = (path: string): readonly string[] => {
  const segments = segmentsOf(path);
  return segments.slice(1).map((_, index) => joinSegments(segments.slice(0, segments.length - 1 - index)));
};

/** O nó é o próprio escopo ou está dentro dele. */
export const isWithin = (path: string, scope: string): boolean =>
  path === scope || path.startsWith(`${scope}${SEPARATOR}`);

const lastSegment = (path: string): string => segmentsOf(path).at(-1) ?? path;

/**
 * Escopo do shrink: a raiz de componente mais próxima (o próprio Text conta se for
 * raiz de um componente), excluindo o slide; sem nenhuma, o filho de primeiro nível
 * do slide. Assim um título num componente separado não encolhe junto com o corpo.
 */
export const scopeOf = (path: string): string => {
  const candidates = selfAndAncestors(path);
  return candidates.find((candidate) => isComponentSegment(lastSegment(candidate))) ?? candidates.at(-1) ?? path;
};
