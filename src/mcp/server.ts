import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { buildTool, diagnoseTool, guideTool, initTool, previewTool, schemaTool, type McpContext, type ToolResult } from './tools.ts';

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
    description: 'Gera .pptx, PNGs e diagnostics.json (como `pptsx build`) e devolve os diagnósticos e o overview de cada tamanho. isError quando há diagnóstico de severidade error.',
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
    description: 'Só os diagnósticos (sem PNG, sem gravar arquivos): o caminho rápido para iterar.',
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
    description: 'Trechos do docs/AGENT_GUIDE.md. Sem `section`: o índice. Com "§8", "6.17" ou parte do título: a seção.',
    inputSchema: { section: z.string().optional() },
  }, async (input) => asResult(guideTool(input, ctx)));
  server.registerTool('schema', {
    title: 'Props das primitivas',
    description: 'Props aceitas por primitiva (gerado dos tipos): tipo e descrição de cada uma. Sem `primitive`: todas.',
    inputSchema: { primitive: z.string().optional().describe('"box", "text", "chart"…') },
  }, async (input) => asResult(schemaTool(input)));
  return server;
};
