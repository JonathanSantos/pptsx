import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { tsconfigForFile } from '../../src/cli/loader.ts';

// M16-1 (M9-E): deck fora do cwd compila com o tsconfig da própria pasta.
describe('tsconfigForFile', () => {
  it('usa o tsconfig mais próximo do deck, não o do cwd', () => {
    const root = mkdtempSync(join(tmpdir(), 'pptsx-loader-'));
    const deckDir = join(root, 'decks', 'q3');
    mkdirSync(deckDir, { recursive: true });
    writeFileSync(join(root, 'decks', 'tsconfig.json'), '{}');
    const cwd = join(root, 'cwd');
    mkdirSync(cwd);
    writeFileSync(join(cwd, 'tsconfig.json'), '{}');
    expect(tsconfigForFile(join(deckDir, 'deck.tsx'), cwd)).toBe(join(root, 'decks', 'tsconfig.json'));
  });

  it('sem tsconfig acima do deck, cai para o do cwd', () => {
    const root = mkdtempSync(join(tmpdir(), 'pptsx-loader-'));
    const cwd = join(root, 'cwd');
    mkdirSync(cwd);
    writeFileSync(join(cwd, 'tsconfig.json'), '{}');
    // tmpdir não tem tsconfig acima (a busca sobe até a raiz).
    expect(tsconfigForFile(join(root, 'solto', 'deck.tsx'), cwd)).toBe(join(cwd, 'tsconfig.json'));
  });
});

describe('configDirOf (M17)', () => {
  it('a config da pasta do deck (ou acima) vence o cwd; sem nenhuma, o cwd', async () => {
    const { configDirOf } = await import('../../src/config.ts');
    const root = mkdtempSync(join(tmpdir(), 'pptsx-config-'));
    const ds = join(root, 'meu-ds');
    mkdirSync(join(ds, 'decks'), { recursive: true });
    writeFileSync(join(ds, 'pptsx.config.ts'), 'export default {};');
    expect(configDirOf(join(ds, 'decks', 'deck.tsx'), root)).toBe(ds);
    expect(configDirOf(join(root, 'solto', 'deck.tsx'), '/cwd')).toBe('/cwd');
  });
});
