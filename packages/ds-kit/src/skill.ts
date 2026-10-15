import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createSkillFiles, skillNameOf, writeSkill, type SkillFile } from 'pptsx';
import type { Ds } from './ds.ts';

/**
 * M18-8: `pptsx-ds skill <ds.ts> --out <pasta>` — a skill de um design system: a do pptsx (mesmo script,
 * guia e props) com `references/ds.md`, a config que registra o DS e o nome `pptsx-<pacote>`. Cada DS vira
 * uma skill que o agente usa sem outra documentação.
 */

export interface DsSkillOptions {
  /** Como o deck importa o DS; padrão: o `name` do package.json mais próximo do módulo do DS. */
  readonly importFrom?: string;
  readonly name?: string;
  readonly releaseBase?: string;
}

export const packageNameNear = (file: string): string | undefined => {
  const search = (dir: string): string | undefined => {
    const pkg = join(dir, 'package.json');
    if (existsSync(pkg)) return (JSON.parse(readFileSync(pkg, 'utf8')) as { readonly name?: string }).name;
    const parent = dirname(dir);
    return parent === dir ? undefined : search(parent);
  };
  return search(dirname(resolve(file)));
};

export const dsSkillFiles = (ds: Ds, dsFile: string, options: DsSkillOptions = {}): readonly SkillFile[] => {
  const importFrom = options.importFrom ?? packageNameNear(dsFile) ?? ds.name;
  return createSkillFiles({
    ds: { manifest: ds, importFrom },
    name: options.name ?? skillNameOf(importFrom),
    ...(options.releaseBase === undefined ? {} : { releaseBase: options.releaseBase }),
  });
};

export const writeDsSkill = (out: string, ds: Ds, dsFile: string, options: DsSkillOptions = {}): { readonly name: string; readonly files: readonly string[] } => {
  const files = dsSkillFiles(ds, dsFile, options);
  const name = files[0]!.path.split('/')[2]!;
  return { name, files: writeSkill(resolve(out), files) };
};
