import type { ComponentMeta } from '../core/types.ts';

/**
 * 1.0.5: `<Nome prop=valor … />` de uma instância de componente do autor, para o diagnóstico apontar onde
 * mexer (`data.component`). Resumido de propósito: strings até 40 caracteres, arrays e objetos só pelo
 * tamanho ou pelas chaves. Mesmo formato do pptsx-rs (model/resolve.rs `author_source`).
 */

const MAX_STRING = 40;
const MAX_KEYS = 4;

const isElement = (value: object): boolean => 'type' in value && 'props' in value;

const shownValueOf = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return `"${[...value].slice(0, MAX_STRING).join('')}${[...value].length > MAX_STRING ? '…' : ''}"`;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'function') return 'fn';
  if (Array.isArray(value)) return `[${value.length} itens]`;
  if (value instanceof RegExp) return 'regex';
  if (typeof value === 'object') return isElement(value) ? '<…>' : `{${Object.keys(value).slice(0, MAX_KEYS).join(', ')}}`;
  return undefined;
};

/** Ausente para componente sem nome (função anônima): não há o que apontar. */
export const authorSourceOf = (meta: ComponentMeta, props: Readonly<Record<string, unknown>>): string | undefined => {
  const name = meta.name;
  if (name === '' || name === 'Anonymous') return undefined;
  const parts = Object.entries(props).flatMap(([key, value]) => {
    if (key === 'children') return [];
    const shown = shownValueOf(value);
    return shown === undefined ? [] : [`${key}=${shown}`];
  });
  return parts.length === 0 ? `<${name} />` : `<${name} ${parts.join(' ')} />`;
};
