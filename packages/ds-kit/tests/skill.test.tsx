import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { Box, Text } from 'pptsx';
import { createDs, defineComponent, dsSkillFiles, packageNameNear, writeDsSkill } from '@pptsx/ds-kit';

// M18-8: `pptsx-ds skill` — a skill de um DS (a do pptsx + references/ds.md e a config que registra o DS).
const Card = defineComponent(
  { name: 'Card', guide: '`<Card title />`', catalog: [{ name: 'um', props: { title: 'Receita' } }] },
  ({ title }: { title: string }) => <Box><Text>{title}</Text></Box>,
);
const ds = createDs({ name: 'marca', version: '0.3.0', components: [Card] });
const here = fileURLToPath(import.meta.url);

const dirs: string[] = [];
afterAll(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

describe('dsSkillFiles', () => {
  it('importa pelo nome do pacote mais próximo do módulo do DS e nomeia a skill pptsx-<pacote>', () => {
    expect(packageNameNear(here)).toBe('@pptsx/ds-kit');
    const files = dsSkillFiles(ds, here);
    const root = '.claude/skills/pptsx-ds-kit';
    const ds_md = files.find((file) => file.path === `${root}/references/ds.md`)!.content;
    expect(ds_md).toContain('# marca 0.3.0');
    expect(ds_md).toContain('<Card title="Receita" />');
    expect(files.find((file) => file.path === `${root}/references/pptsx.config.ts`)!.content).toContain("from '@pptsx/ds-kit'");
    expect(files.some((file) => file.path === `.github/skills/pptsx-ds-kit/scripts/pptsx.mjs`)).toBe(true);
  });

  it('--import-from e --name vencem; writeDsSkill grava os arquivos', () => {
    const out = mkdtempSync(join(tmpdir(), 'ds-skill-'));
    dirs.push(out);
    const result = writeDsSkill(out, ds, here, { importFrom: '@marca/ds', name: 'marca-slides' });
    expect(result.name).toBe('marca-slides');
    const skill = readFileSync(join(out, '.claude', 'skills', 'marca-slides', 'SKILL.md'), 'utf8');
    expect(skill).toContain('name: marca-slides');
    expect(skill).toContain('`@marca/ds`');
  });
});
