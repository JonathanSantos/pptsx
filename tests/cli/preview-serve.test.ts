import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCli, type CliDeps } from '../../src/cli.ts';
import type { PreviewState } from '../../src/cli/preview/state.ts';

// M16-4: `pptsx preview --serve` com o watch injetado (como no M7), a porta 0 e o loader real (tsx + ?pptsx-fresh).
const ROOT = resolve(import.meta.dirname, '../..');

const fakeWatch = () => {
  const calls: (() => void)[] = [];
  const registered = async (): Promise<void> => {
    while (calls.length === 0) await new Promise((done) => setTimeout(done, 10));
  };
  return { watch: (_paths: readonly string[], onChange: () => void) => (calls.push(onChange), () => undefined), fire: () => calls.at(-1)?.(), registered };
};

describe('preview --serve', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  const start = async (deck: string) => {
    const controller = new AbortController();
    const fake = fakeWatch();
    const rebuilds: PreviewState[] = [];
    let url = '';
    let exit: Promise<number> = Promise.resolve(0);
    const listening = new Promise<void>((done) => {
      const deps: CliDeps = { watch: fake.watch, signal: controller.signal, onListening: (u) => ((url = u), done()), onRebuild: (s) => rebuilds.push(s) };
      exit = runCli(['preview', deck, '--serve', '--port', '0', '--size', '16x9,4x3'], ROOT, deps);
    });
    await listening;
    return { url: () => url, fake, rebuilds, stop: async () => (controller.abort(), exit) };
  };

  it('serve a página, o estado com frames, o SVG de cada slide e os diagnósticos', async () => {
    const server = await start('examples/demo.tsx');
    try {
      const page = await fetch(server.url());
      expect(page.headers.get('content-type')).toContain('text/html');
      expect(await page.text()).toContain('new EventSource');
      const state = (await (await fetch(`${server.url()}state.json`)).json()) as { sizes: { size: string; slides: { nodes: { path: string }[] }[] }[] };
      expect((state as { error?: string }).error).toBeUndefined();
      expect(state.sizes.map((size) => size.size)).toEqual(['16x9', '4x3']);
      expect(state.sizes[0]!.slides[1]!.nodes.length).toBeGreaterThan(0);
      const svg = await fetch(`${server.url()}svg/16x9/1`);
      expect(svg.headers.get('content-type')).toBe('image/svg+xml');
      expect(await svg.text()).toMatch(/^<svg/);
      expect((await fetch(`${server.url()}svg/16x9/99`)).status).toBe(404);
      expect(Array.isArray(await (await fetch(`${server.url()}diagnostics.json`)).json())).toBe(true);
    } finally {
      expect(await server.stop()).toBe(0);
    }
  }, 60000);

  it('de ponta a ponta (bin real, fs.watch): salvar atualiza o SVG e o SSE avisa em menos de 1 s', async () => {
    const dir = mkdtempSync(join(ROOT, 'examples', 'tmp-preview-'));
    const deck = join(dir, 'deck.tsx');
    const source = (title: string) => `import { Deck, Slide, Text, defineDeck } from 'pptsx';\nexport default defineDeck(() => <Deck><Slide padding={30}><Text>${title}</Text></Slide></Deck>);\n`;
    writeFileSync(deck, source('um'));
    const child = spawn(process.execPath, ['bin/pptsx.mjs', 'preview', deck, '--serve', '--port', '0', '--size', '16x9'], { cwd: ROOT });
    try {
      const url = await new Promise<string>((done, fail) => {
        let output = '';
        child.stdout.on('data', (chunk: Buffer) => {
          output += chunk.toString();
          const match = /preview em (http:\/\/\S+)/.exec(output);
          if (match) done(match[1]!);
        });
        child.on('exit', () => fail(new Error(output)));
      });
      expect(await (await fetch(`${url}svg/16x9/1`)).text()).toContain('um');
      const events = await fetch(`${url}events`);
      const reader = events.body!.getReader();
      await reader.read();
      const started = performance.now();
      writeFileSync(deck, source('dois'));
      const chunk = new TextDecoder().decode((await reader.read()).value);
      const elapsed = performance.now() - started;
      expect(chunk).toContain('event: update');
      expect(elapsed).toBeLessThan(1000);
      expect(await (await fetch(`${url}svg/16x9/1`)).text()).toContain('dois');
      await reader.cancel();
    } finally {
      child.kill('SIGTERM');
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60000);

  it('erro no deck não derruba o servidor: o estado traz o erro', async () => {
    const dir = mkdtempSync(join(ROOT, 'examples', 'tmp-preview-'));
    const deck = join(dir, 'deck.tsx');
    writeFileSync(deck, `import { Deck, Slide, defineDeck } from 'pptsx';\nexport default defineDeck(() => <Deck><Slide><Slide /></Slide></Deck>);\n`);
    const server = await start(deck);
    try {
      const state = (await (await fetch(`${server.url()}state.json`)).json()) as { error?: string };
      expect(state.error).toBeDefined();
    } finally {
      await server.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60000);
});
