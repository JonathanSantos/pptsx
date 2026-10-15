import { afterAll, describe, expect, it } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSkillFiles, writeSkill } from '../../src/skill/index.ts';

/**
 * M18-8: a skill com o bundle de verdade — o script acha o pptsx.mjs no cache (SHA256 conferido), o build
 * de hello.tsx devolve o resumo e o `.vscode/mcp.json` sobe o servidor MCP que responde `schema`.
 * Precisa do bundle: só no `npm run test:standalone`.
 */

const ENABLED = Boolean(process.env.PPTSX_STANDALONE_TEST);
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const BUNDLE = join(ROOT, 'dist', 'standalone', 'pptsx.mjs');
const VERSION = (JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { readonly version: string }).version;
const TIMEOUT = 120_000;

const dirs: string[] = [];
const freshDir = (prefix: string): string => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
};
afterAll(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

// Repositório do agente: a skill instalada, o bundle no cache e nada de npm no PATH.
const workspace = (): { readonly dir: string; readonly env: NodeJS.ProcessEnv } => {
  const dir = freshDir('pptsx-skill-ws-');
  writeSkill(dir, createSkillFiles());
  const cache = join(dir, 'cache');
  mkdirSync(join(cache, VERSION), { recursive: true });
  cpSync(BUNDLE, join(cache, VERSION, 'pptsx.mjs'));
  cpSync(join(ROOT, 'examples', 'hello.tsx'), join(dir, 'hello.tsx'));
  cpSync(join(ROOT, 'examples', 'assets'), join(dir, 'assets'), { recursive: true });
  return { dir, env: { PATH: '', PPTSX_CACHE: cache } };
};

describe.skipIf(!ENABLED)('skill × bundle', () => {
  it(
    'com o bundle no cache, build de hello.tsx devolve o resumo e grava o .pptx',
    () => {
      const { dir, env } = workspace();
      const script = join(dir, '.claude', 'skills', 'pptsx', 'scripts', 'pptsx.mjs');
      const result = spawnSync(process.execPath, [script, 'build', 'hello.tsx', '--size', '16x9'], { cwd: dir, encoding: 'utf8', env });
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
      expect(result.stdout).toContain('Arquivos:');
      expect(result.stdout).toContain(join('dist', 'hello.16x9.pptx'));
      expect(result.stdout).toMatch(/Nenhum diagnóstico|Diagnósticos:/);
      expect(existsSync(join(dir, 'dist', 'hello.16x9.pptx'))).toBe(true);
    },
    TIMEOUT,
  );

  it(
    'o .vscode/mcp.json sobe o servidor pelo script e ele responde schema',
    async () => {
      const { dir, env } = workspace();
      const config = JSON.parse(readFileSync(join(dir, '.vscode', 'mcp.json'), 'utf8')) as { servers: { pptsx: { command: string; args: string[] } } };
      const { command, args } = config.servers.pptsx;
      const server = spawn(command === 'node' ? process.execPath : command, args.map((arg) => arg.replace('${workspaceFolder}', dir)), { cwd: dir, env });
      const messages: unknown[] = [];
      let buffer = '';
      server.stdout.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('utf8');
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        lines.filter((line) => line.trim() !== '').forEach((line) => messages.push(JSON.parse(line)));
      });
      const send = (message: object) => server.stdin.write(`${JSON.stringify(message)}\n`);
      const reply = (id: number) =>
        new Promise<{ result?: { content?: { text?: string }[] } }>((resolveReply, reject) => {
          const started = Date.now();
          const poll = setInterval(() => {
            const found = messages.find((message) => (message as { id?: number }).id === id);
            if (found !== undefined) {
              clearInterval(poll);
              resolveReply(found as { result?: { content?: { text?: string }[] } });
            } else if (Date.now() - started > 30_000) {
              clearInterval(poll);
              reject(new Error(`sem resposta ${id}`));
            }
          }, 50);
        });
      try {
        send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'teste', version: '1' } } });
        await reply(1);
        send({ jsonrpc: '2.0', method: 'notifications/initialized' });
        send({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'schema', arguments: { primitive: 'text' } } });
        const schema = await reply(2);
        expect(schema.result?.content?.[0]?.text).toContain('fontSize');
      } finally {
        server.kill();
      }
    },
    TIMEOUT,
  );
});
