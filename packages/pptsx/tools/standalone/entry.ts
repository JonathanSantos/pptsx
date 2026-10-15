import { FONT_DIR, HOOKS_AVAILABLE, cacheRoot } from './setup.ts';
import { existsSync, readdirSync, realpathSync, statfsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isMainThread } from 'node:worker_threads';
import { VERSION } from 'pptsx-standalone:assets';
import { runCli } from '../../src/cli.ts';
import { defaultFontDirs } from '../../src/fonts/system.ts';
import { runMcpServer } from '../../src/mcp/main.ts';

/**
 * M18-7: entrada do bundle de arquivo único `dist/standalone/pptsx.mjs`. Como módulo, é o `pptsx` (API
 * pública e runtime de JSX: o deck do usuário importa daqui pelos hooks); executado, é a CLI —
 * `build`, `init`, `lint`, `preview`, `mcp` e `doctor`.
 */

export * from '../../src/index.ts';
export { Fragment, jsx, jsxs } from '../../src/jsx/jsx-runtime.ts';
export { jsxDEV } from '../../src/jsx/jsx-dev-runtime.ts';

const FONT_FILE = /\.(ttf|otf|ttc)$/i;
const MB = 1024 * 1024;

const fontCountOf = (dir: string): number => {
  try {
    return readdirSync(dir).filter((name) => FONT_FILE.test(name)).length;
  } catch {
    return 0;
  }
};

const freeSpaceOf = (dir: string): string => {
  try {
    const stats = statfsSync(dir);
    return `${Math.round((stats.bavail * stats.bsize) / MB)} MB`;
  } catch {
    return 'desconhecido';
  }
};

/** Node, plataforma, fontes e espaço: o que costuma explicar um build que não roda. */
export const doctorReport = (): string => {
  const dirs = defaultFontDirs();
  return [
    `pptsx ${VERSION} (standalone)`,
    `Node ${process.version} em ${process.platform}-${process.arch}${HOOKS_AVAILABLE ? '' : ' — sem module.register: atualize para Node 20.6 ou mais novo para compilar o deck'}`,
    `Fontes embutidas (Liberation Sans, métricas de Arial): ${FONT_DIR}`,
    `Cache: ${cacheRoot()}`,
    'Fontes do sistema:',
    ...(dirs.length === 0 ? ['  nenhuma pasta conhecida nesta plataforma'] : dirs.map((dir) => `  ${dir}: ${existsSync(dir) ? `${fontCountOf(dir)} arquivos` : 'não existe'}`)),
    `Espaço livre em ${process.cwd()}: ${freeSpaceOf(process.cwd())}`,
  ].join('\n');
};

const main = async (argv: readonly string[]): Promise<number | undefined> => {
  const [command, ...rest] = argv;
  if (command === 'doctor') {
    console.log(doctorReport());
    return HOOKS_AVAILABLE ? 0 : 1;
  }
  if (command === 'mcp') {
    // O servidor fica vivo no stdio; nada é impresso no stdout fora do protocolo.
    await runMcpServer(process.cwd(), rest);
    return undefined;
  }
  return runCli(argv);
};

const isMain = (): boolean => {
  const entry = process.argv[1];
  if (!isMainThread || !entry) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
};

// Sem top-level await: o deck importa este mesmo módulo, que precisa terminar de avaliar antes.
if (isMain()) {
  void main(process.argv.slice(2)).then((code) => {
    if (code !== undefined) process.exitCode = code;
  });
}
