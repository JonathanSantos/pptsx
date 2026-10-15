import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { buildTool, diagnoseTool, guideTool, initTool, lintTool, previewTool, schemaTool, type McpContext, type ToolResult } from './tools.ts';

/**
 * M16-3: servidor MCP do pptsx. Um agente constrói, lê diagnósticos e vê PNGs sem shell. As
 * ferramentas estão em tools.ts (testáveis sem o SDK); aqui só o registro com os schemas.
 */

const SIZES = z.array(z.string()).optional().describe('Tamanhos: "16x9", "4x3", "16x10", "wide" ou "10x7.5in". Padrão: os da config, senão 16x9.');
const DECK = z.string().describe('Caminho do deck .tsx (relativo ao diretório do servidor ou absoluto).');

// O SDK tipa o retorno com arrays mutáveis; nossos resultados são readonly.
const asResult = (result: ToolResult) => result as unknown as { content: { type: 'text'; text: string }[]; isError?: boolean };

export const createPptsxMcpServer = (ctx: McpContext, version: string): McpServer => {
  const server = new McpServer({ name: 'pptsx', version });
  server.registerTool('build', {
    title: 'Construir o deck',
    description: 'Gera .pptx, PNGs e diagnostics.json (como `pptsx build`) e devolve os diagnósticos e o overview de cada tamanho. isError = o deck tem diagnóstico de severidade error (a ferramenta funcionou; corrija o deck).',
    inputSchema: {
      deck: DECK,
      sizes: SIZES,
      debug: z.boolean().optional().describe('Contornos e estouros desenhados no PNG.'),
      lineBreaks: z.enum(['forced', 'auto']).optional(),
      out: z.string().optional().describe('Pasta de saída. Padrão: dist/ no diretório do servidor.'),
    },
  }, async (input) => asResult(await buildTool(input, ctx)));
  server.registerTool('diagnose', {
    title: 'Diagnosticar o deck',
    description: 'Só os diagnósticos (sem PNG, sem gravar arquivos): o caminho rápido para iterar. isError = o deck tem diagnóstico de severidade error.',
    inputSchema: { deck: DECK, sizes: SIZES },
  }, async (input) => asResult(await diagnoseTool(input, ctx)));
  server.registerTool('preview', {
    title: 'PNG de um slide',
    description: 'O PNG de um slide (número do deck de saída, base 1, depois da paginação) num tamanho, com os diagnósticos dele.',
    inputSchema: { deck: DECK, size: z.string().describe('Um tamanho ("16x9").'), slide: z.number().int().min(1) },
  }, async (input) => asResult(await previewTool(input, ctx)));
  server.registerTool('init', {
    title: 'Criar projeto',
    description: 'Cria deck.tsx, tsconfig.json, pptsx.config.ts, assets/ e .gitignore numa pasta (como `pptsx init`).',
    inputSchema: { dir: z.string(), force: z.boolean().optional().describe('Sobrescreve um deck.tsx existente.') },
  }, async (input) => asResult(initTool(input, ctx)));
  server.registerTool('guide', {
    title: 'Guia do agente',
    description: 'Trechos do guia. Fonte padrão "pptsx" (docs/AGENT_GUIDE.md); um DS registrado é outra fonte (`source` = nome do DS). Sem `section`: o índice (e as fontes). Com "§8", "6.17" ou parte do título: a seção.',
    inputSchema: {
      source: z.string().optional().describe('"pptsx" (padrão) ou o nome de um DS registrado.'),
      section: z.string().optional(),
      deck: z.string().optional().describe('Um deck: os DS da config da pasta dele (ou acima) viram fontes.'),
    },
  }, async (input) => asResult(await guideTool(input, ctx)));
  server.registerTool('schema', {
    title: 'Props das primitivas',
    description: 'Props aceitas por primitiva, em JSON Schema 2020-12 (`$id` por fonte; o tipo TypeScript em `x-tsType`); Com `source` = nome de um DS: as props dos componentes dele. Sem `primitive`: todas.',
    inputSchema: {
      source: z.string().optional().describe('"pptsx" (padrão) ou o nome de um DS registrado.'),
      primitive: z.string().optional().describe('"box", "text", "chart"… ou o nome de um componente do DS'),
      deck: z.string().optional().describe('Um deck: os DS da config da pasta dele (ou acima) viram fontes.'),
    },
  }, async (input) => asResult(await schemaTool(input, ctx)));
  server.registerTool('lint', {
    title: 'Lint do deck',
    description: 'As regras da engine (props antigas, CSS sem de/para, lineHeight alto, fr solto, cores fora do tema, estrutura) e as dos design systems da config da pasta do deck (e dos `ds` passados). isError = há achado error ou warning.',
    inputSchema: { deck: DECK, sizes: SIZES, ds: z.array(z.string()).optional().describe('DS a mais: caminho do ds.ts ou nome do pacote.') },
  }, async (input) => asResult(await lintTool(input, ctx)));
  return server;
};
