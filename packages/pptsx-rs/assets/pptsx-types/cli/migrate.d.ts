import { type CodemodSkip } from '../lint/codemod.ts';
/**
 * M18-6: `pptsx lint --from 0.x <pasta|arquivo>` — o codemod do `--fix` em todos os .ts/.tsx da pasta
 * (componentes e layouts também, não só o deck). Arquivo sem prop antiga não é regravado.
 */
export declare const MIGRATION_SOURCES: readonly ['0.x'];
export interface MigratedFile {
    readonly file: string;
    readonly changes: number;
    readonly skipped: readonly CodemodSkip[];
}
export declare const migrateTree: (target: string) => Promise<readonly MigratedFile[]>;
export declare const migrationSummaryOf: (target: string, files: readonly MigratedFile[]) => string;
