import { readFileSync } from 'node:fs';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { dsOfServer } from './ds.ts';
import { createPptsxMcpServer } from './server.ts';

/** M16-3: `pptsx-mcp` por stdio. O stdout é do protocolo: nada aqui (nem nas ferramentas) imprime nele. */
const packageVersion = (): string => {
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { readonly version?: string };
  return pkg.version ?? '0.0.0';
};

export { dsArgsOf, dsOfServer, importDs } from './ds.ts';

export const runMcpServer = async (cwd: string = process.cwd(), argv: readonly string[] = process.argv.slice(2)): Promise<void> => {
  const server = createPptsxMcpServer({ cwd, ds: await dsOfServer(cwd, argv) }, packageVersion());
  await server.connect(new StdioServerTransport());
};
