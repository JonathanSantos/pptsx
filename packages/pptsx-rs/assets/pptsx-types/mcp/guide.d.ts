/**
 * M16-3: trechos do docs/AGENT_GUIDE.md por seção, para a ferramenta `guide` do MCP. Puro (recebe o
 * texto). Seção = um `## ` ou `### ` até o próximo cabeçalho do mesmo nível ou acima.
 */
export interface GuideSection {
    readonly heading: string;
    readonly level: 2 | 3;
    readonly body: string;
}
export declare const guideSectionsOf: (markdown: string) => readonly GuideSection[];
/** Sem consulta: o índice (títulos). Com consulta: a 1ª seção que casa, ou undefined. */
export declare const guideLookup: (markdown: string, query?: string, title?: string) => {
    readonly text: string;
    readonly found: boolean;
};
