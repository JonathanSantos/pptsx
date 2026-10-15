import { describe, expect, it } from 'vitest';
// @ts-expect-error módulo JS de hooks do Node, sem tipos
import { initialize, resolve } from '../../bin/fresh-hooks.mjs';

// M16-1 (M7-B): a versão do rebuild desce só para os arquivos do usuário; o motor fica com uma URL só.
type Resolved = { url: string };
const next = (url: string) => async (): Promise<Resolved> => ({ url });

describe('fresh-hooks', () => {
  it('propaga ?pptsx-fresh do pai para arquivo do usuário, não para o motor nem node_modules', async () => {
    await initialize({ engineRoots: ['file:///repo/src/'] });
    const parent = { parentURL: 'file:///proj/deck.tsx?pptsx-fresh=7' };
    expect(((await resolve('./tokens.ts', parent, next('file:///proj/tokens.ts'))) as Resolved).url).toBe('file:///proj/tokens.ts?pptsx-fresh=7');
    expect(((await resolve('pptsx', parent, next('file:///repo/src/index.ts'))) as Resolved).url).toBe('file:///repo/src/index.ts');
    expect(((await resolve('x', parent, next('file:///proj/node_modules/x/i.js'))) as Resolved).url).toBe('file:///proj/node_modules/x/i.js');
    expect(((await resolve('node:fs', parent, next('node:fs'))) as Resolved).url).toBe('node:fs');
  });

  it('sem versão no pai, não mexe', async () => {
    await initialize({ engineRoots: [] });
    expect(((await resolve('./a.ts', { parentURL: 'file:///proj/deck.tsx' }, next('file:///proj/a.ts'))) as Resolved).url).toBe('file:///proj/a.ts');
  });
});
