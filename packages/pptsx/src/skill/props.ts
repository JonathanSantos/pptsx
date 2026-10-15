/**
 * M18-8: `references/props.md` da skill, gerado do mesmo schema do `schema()` do MCP (nunca à mão):
 * uma tabela por primitiva (ou componente de DS) com a prop, o tipo e a descrição.
 */

interface RawProp {
  readonly type?: string;
  readonly description?: string;
  readonly examples?: readonly unknown[];
}

interface RawObject {
  readonly properties?: Readonly<Record<string, RawProp>>;
  readonly required?: readonly string[];
}

const MAX_TYPE = 140;

// O responsivo vale para toda prop e repete o tipo inteiro: a tabela mostra só o valor fixo.
const shortType = (type: string): string => {
  const fixed = type.replace(/\s*\|\s*ResponsiveValue<.*$/s, '').replace(/\s+/g, ' ').trim();
  return fixed.length <= MAX_TYPE ? fixed : `${fixed.slice(0, MAX_TYPE - 1)}…`;
};

const cell = (text: string): string => text.replace(/\|/g, '\\|').replace(/\n+/g, ' ');

// A 1ª frase basta na tabela; o guia (references/guide.md) tem o resto.
const firstSentence = (text: string): string => {
  const match = /^(.+?[.!?])(\s|$)/s.exec(text.trim());
  return (match?.[1] ?? text).trim();
};

const rowOf = (name: string, prop: RawProp, required: boolean): string => {
  const examples = prop.examples === undefined || prop.examples.length === 0 ? '' : ` Ex.: ${prop.examples.map((value) => `\`${JSON.stringify(value)}\``).join(', ')}.`;
  const note = `${prop.description === undefined ? '' : firstSentence(prop.description)}${examples}`.trim();
  return `| \`${name}\`${required ? ' *' : ''} | \`${cell(shortType(prop.type ?? 'unknown'))}\` | ${cell(note)} |`;
};

export const propsSectionOf = (title: string, schema: RawObject): string => {
  const properties = Object.entries(schema.properties ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const required = new Set(schema.required ?? []);
  return [`## ${title}`, '', '| prop | tipo | nota |', '|---|---|---|', ...properties.map(([name, prop]) => rowOf(name, prop, required.has(name))), ''].join('\n');
};

/** Toda prop aceita também `{ base, tall, wide }` (responsivo); `*` = obrigatória. */
export const propsMarkdown = (heading: string, schema: Readonly<Record<string, RawObject>>, names: Readonly<Record<string, string>> = {}): string =>
  [
    `# ${heading}`,
    '',
    'Gerado do schema do pptsx (o mesmo do `schema()` no MCP). `*` = obrigatória. Toda prop aceita também um valor por breakpoint, `{ base, tall, wide }` (guia §2).',
    '',
    ...Object.entries(schema).map(([key, value]) => propsSectionOf(names[key] ?? key, value)),
  ].join('\n');
