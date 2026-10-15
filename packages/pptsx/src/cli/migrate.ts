import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadTypeScriptApi, migrateSource, type CodemodSkip } from '../lint/codemod.ts';

/**
 * M18-6: `pptsx lint --from 0.x <pasta|arquivo>` — o codemod do `--fix` em todos os .ts/.tsx da pasta
 * (componentes e layouts também, não só o deck). Arquivo sem prop antiga não é regravado.
 */

export const MIGRATION_SOURCES = ['0.x'] as const;

export interface MigratedFile {
  readonly file: string;
  readonly changes: number;
  readonly skipped: readonly CodemodSkip[];
}

const SKIPPED_DIRS: ReadonlySet<string> = new Set(['node_modules', 'dist', '.git']);
const SOURCE_FILE = /\.tsx?$/;

const sourceFilesOf = (path: string): readonly string[] => {
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path)
    .sort()
    .flatMap((name) => {
      const child = join(path, name);
      if (statSync(child).isDirectory()) return SKIPPED_DIRS.has(name) ? [] : sourceFilesOf(child);
      return SOURCE_FILE.test(name) && !name.endsWith('.d.ts') ? [child] : [];
    });
};

export const migrateTree = async (target: string): Promise<readonly MigratedFile[]> => {
  const ts = await loadTypeScriptApi();
  return sourceFilesOf(target).flatMap((file): readonly MigratedFile[] => {
    const result = migrateSource(ts, file, readFileSync(file, 'utf8'));
    if (result.changes > 0) writeFileSync(file, result.source);
    return result.changes === 0 && result.skipped.length === 0 ? [] : [{ file, changes: result.changes, skipped: result.skipped }];
  });
};

export const migrationSummaryOf = (target: string, files: readonly MigratedFile[]): string => {
  const changes = files.reduce((sum, file) => sum + file.changes, 0);
  const skips = files.flatMap((file) => file.skipped.map((skip) => `  ▲ ${file.file}:${skip.line}: ${skip.prop} não migrado — ${skip.reason}`));
  return [
    `--from 0.x: ${changes} ${changes === 1 ? 'troca' : 'trocas'} em ${files.filter((file) => file.changes > 0).length} arquivo(s) de ${target}`,
    ...files.filter((file) => file.changes > 0).map((file) => `  ${file.changes}\t${file.file}`),
    ...skips,
    ...(skips.length === 0 ? [] : ['Os itens com ▲ ficaram como estavam: troque à mão (o build aponta cada um com a troca).']),
  ].join('\n');
};
