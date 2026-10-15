/**
 * M16-3: trechos do docs/AGENT_GUIDE.md por seção, para a ferramenta `guide` do MCP. Puro (recebe o
 * texto). Seção = um `## ` ou `### ` até o próximo cabeçalho do mesmo nível ou acima.
 */

export interface GuideSection {
  readonly heading: string;
  readonly level: 2 | 3;
  readonly body: string;
}

const HEADING = /^(#{2,3}) (.+)$/;

export const guideSectionsOf = (markdown: string): readonly GuideSection[] => {
  const lines = markdown.split('\n');
  const starts = lines.flatMap((line, index) => {
    const match = HEADING.exec(line);
    return match === null ? [] : [{ index, level: match[1]!.length as 2 | 3, heading: match[2]!.trim() }];
  });
  return starts.map((start) => {
    const end = starts.find((next) => next.index > start.index && next.level <= start.level)?.index ?? lines.length;
    return { heading: start.heading, level: start.level, body: lines.slice(start.index, end).join('\n').trimEnd() };
  });
};

/** "§8", "8", "6.17" casam pelo número no início do título; outro texto, por trecho do título (sem caixa). */
const matches = (query: string) => (section: GuideSection): boolean => {
  const number = /^§?\s*(\d+(?:\.\d+)?)\.?$/.exec(query.trim());
  if (number !== null) return section.heading.startsWith(`${number[1]}.`) || section.heading.startsWith(`${number[1]} `);
  return section.heading.toLowerCase().includes(query.trim().toLowerCase());
};

/** Sem consulta: o índice (títulos). Com consulta: a 1ª seção que casa, ou undefined. */
export const guideLookup = (markdown: string, query?: string, title = 'docs/AGENT_GUIDE.md'): { readonly text: string; readonly found: boolean } => {
  const sections = guideSectionsOf(markdown);
  if (query === undefined || query.trim() === '') {
    const index = sections.map((section) => `${section.level === 2 ? '' : '  '}- ${section.heading}`).join('\n');
    return { text: `Seções do ${title} (peça uma com section: "§8", "6.17" ou um trecho do título):\n${index}`, found: true };
  }
  const section = sections.find(matches(query));
  if (section === undefined) return { text: `Nenhuma seção do guia casa com "${query}". Chame guide() sem argumento para ver o índice.`, found: false };
  return { text: section.body, found: true };
};
