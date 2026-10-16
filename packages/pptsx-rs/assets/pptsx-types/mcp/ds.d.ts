import type { DsManifest } from '../ds.ts';
/** M17/M18: de onde o MCP tira os design systems — `--ds`, a config do cwd e a config da pasta de um deck. */
/** `--ds <pacote>` (repetível) na linha de comando do servidor. */
export declare const dsArgsOf: (argv: readonly string[]) => readonly string[];
/** M17: o pacote é resolvido a partir do cwd (onde o DS está instalado), não do pptsx. */
export declare const importDs: (specifier: string, cwd: string) => Promise<DsManifest>;
/** DS do pptsx.config.ts do cwd e dos `--ds`; o mesmo nome duas vezes vale uma. */
export declare const dsOfServer: (cwd: string, argv: readonly string[]) => Promise<readonly DsManifest[]>;
/** M18: os DS da config da pasta de um deck (ou acima), como o build e o lint já fazem. */
export declare const dsOfDeck: (deckPath: string, cwd: string) => Promise<readonly DsManifest[]>;
/** Junta listas de DS sem repetir nome (a primeira vence). */
export declare const mergeDs: (...lists: readonly (readonly DsManifest[])[]) => readonly DsManifest[];
