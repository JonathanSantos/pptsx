/**
 * Cliente MCP mínimo para testes manuais e para o agente virgem do M16-3: inicia `bin/pptsx-mcp.mjs`
 * por stdio, chama UMA ferramenta e imprime o resultado. Imagens vão para arquivos (o caminho é impresso).
 * Uso: npx tsx tools/mcp/call.ts <ferramenta> '<json dos argumentos>' [pasta-das-imagens] [--ds <pacote-ou-arquivo> …]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const [tool, rawArgs = '{}', imageDir = 'dist/mcp-images', ...serverArgs] = process.argv.slice(2);
if (tool === undefined) {
  console.error("uso: npx tsx tools/mcp/call.ts <build|diagnose|preview|init|guide|schema> '<json>' [pasta]");
  process.exit(2);
}
const bin = resolve(import.meta.dirname, '../../bin/pptsx-mcp.mjs');
const client = new Client({ name: 'pptsx-call', version: '1' });
await client.connect(new StdioClientTransport({ command: process.execPath, args: [bin, ...serverArgs], stderr: 'inherit' }));
const result = (await client.callTool({ name: tool, arguments: JSON.parse(rawArgs) as Record<string, unknown> })) as {
  readonly content: readonly { readonly type: string; readonly text?: string; readonly data?: string }[];
  readonly isError?: boolean;
};
mkdirSync(imageDir, { recursive: true });
result.content.forEach((item, index) => {
  if (item.type === 'text') return console.log(item.text);
  const file = join(imageDir, `${tool}-${Date.now()}-${index}.png`);
  writeFileSync(file, Buffer.from(item.data ?? '', 'base64'));
  console.log(`[imagem: ${resolve(file)}]`);
});
console.log(`\nisError: ${result.isError === true}`);
await client.close();
