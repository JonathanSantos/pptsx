#!/usr/bin/env node
// Servidor MCP do pptsx (stdio). Mesmo registro do tsx do bin/pptsx.mjs: decks e config são .tsx/.ts.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'tsx/esm/api';

const fromPackage = (path) => new URL(`../${path}`, import.meta.url);
const inRepo = existsSync(fileURLToPath(fromPackage('src/mcp/main.ts')));
const packageTsconfig = fileURLToPath(fromPackage(inRepo ? 'tsconfig.json' : 'tsconfig.deck.json'));
const tsconfig = existsSync(join(process.cwd(), 'tsconfig.json')) ? undefined : packageTsconfig;

register(tsconfig ? { tsconfig } : undefined);

try {
  const { runMcpServer } = await import(fromPackage(inRepo ? 'src/mcp/main.ts' : 'dist/mcp/main.js').href);
  await runMcpServer();
} catch (error) {
  // stderr: o stdout é do protocolo MCP.
  if (error?.code === 'ERR_MODULE_NOT_FOUND' && String(error.message).includes('@modelcontextprotocol')) {
    console.error('pptsx-mcp: o SDK do MCP não está instalado (dependência opcional). Rode: npm install @modelcontextprotocol/sdk zod');
  } else {
    console.error(`pptsx-mcp: ${error instanceof Error ? error.message : String(error)}`);
  }
  process.exit(1);
}
