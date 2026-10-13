/** Escape de texto e valores de atributo; aspas incluídas para servir aos dois. */
export const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export type AttrValue = string | number | undefined;
export type Attrs = Readonly<Record<string, AttrValue>>;

/** Números saem com no máximo 3 casas: SVG legível e estável para snapshot. */
const formatValue = (value: string | number): string =>
  typeof value === 'number' ? String(Math.round(value * 1000) / 1000) : escapeXml(value);

/** Atributos undefined são omitidos, o que simplifica props opcionais nos builders. */
export const attrs = (record: Attrs): string =>
  Object.entries(record)
    .filter((entry): entry is [string, string | number] => entry[1] !== undefined)
    .map(([key, value]) => ` ${key}="${formatValue(value)}"`)
    .join('');

/** children é XML já montado (não é escapado de novo). */
export const element = (tag: string, record: Attrs, children?: string): string =>
  children === undefined ? `<${tag}${attrs(record)}/>` : `<${tag}${attrs(record)}>${children}</${tag}>`;
