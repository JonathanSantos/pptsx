/**
 * M18-8: o `scripts/pptsx.mjs` da skill — JS puro, sem dependências, Node 18+. Acha o runtime nesta ordem:
 * `PPTSX_BUNDLE`, o bundle no cache (`~/.cache/pptsx/<versão>/pptsx.mjs`, o mesmo do bundle), o download
 * da release com o SHA256 conferido e, por último, `npx pptsx@<versão>`. Nunca instala nada global. No
 * `build`, roda com `--json` e imprime o resumo que o modelo lê. O texto não usa crase nem `${` para caber
 * num String.raw sem escapes.
 */

export interface SkillScriptOptions {
  readonly version: string;
  /** `https://github.com/<dono>/<repo>/releases/download/v<versão>`; sem ele, não há download. */
  readonly releaseBase?: string;
  /** SHA256 do pptsx.mjs desta versão; sem ele, o script baixa o SHA256SUMS da release. */
  readonly bundleSha256?: string;
}

const TEMPLATE = String.raw`#!/usr/bin/env node
// pptsx — script da skill (gerado por "pptsx skill"). Roda o pptsx sem instalar nada global.
// Runtime, nesta ordem: PPTSX_BUNDLE, bundle no cache, download da release (SHA256 conferido), npx pptsx@VERSÃO.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, relative } from 'node:path';

const VERSION = __VERSION__;
const RELEASE_BASE = __RELEASE_BASE__;
const BUNDLE_SHA256 = __BUNDLE_SHA256__;
const IS_WINDOWS = process.platform === 'win32';

const cacheRoot = () => {
  if (process.env.PPTSX_CACHE) return process.env.PPTSX_CACHE;
  if (IS_WINDOWS) return join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'pptsx', 'Cache');
  return join(process.env.XDG_CACHE_HOME || join(homedir(), '.cache'), 'pptsx');
};

const cachedBundle = () => join(cacheRoot(), VERSION, 'pptsx.mjs');
const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

const expectedSha = async () => {
  if (BUNDLE_SHA256) return BUNDLE_SHA256;
  if (!RELEASE_BASE) return null;
  const response = await fetch(RELEASE_BASE + '/SHA256SUMS');
  if (!response.ok) return null;
  const line = (await response.text()).split('\n').find((item) => item.trim().endsWith('pptsx.mjs'));
  return line ? line.trim().split(/\s+/)[0] : null;
};

const download = async () => {
  if (!RELEASE_BASE || typeof fetch !== 'function') return null;
  try {
    const response = await fetch(RELEASE_BASE + '/pptsx.mjs');
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    const expected = await expectedSha();
    if (!expected || sha256(buffer) !== expected) {
      console.error('pptsx: o pptsx.mjs baixado não confere com o SHA256 da release; descartado.');
      return null;
    }
    const file = cachedBundle();
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file + '.tmp', buffer);
    renameSync(file + '.tmp', file);
    return file;
  } catch {
    return null;
  }
};

const hasNpm = () => {
  const probe = spawnSync(IS_WINDOWS ? 'npm.cmd' : 'npm', ['--version'], { encoding: 'utf8', shell: IS_WINDOWS });
  return probe.status === 0;
};

// Última falha do npx (1ª linha útil do stderr), para a mensagem de ajuda dizer o motivo real.
let npxFailure = '';

// O npx só serve se a versão existir no registro (ou no cache do npm): sonda antes de confiar nele,
// senão o erro cru do npm apareceria no lugar da instrução.
const npxRuntime = () => {
  if (!hasNpm()) return null;
  const command = IS_WINDOWS ? 'npx.cmd' : 'npx';
  const prefix = ['--yes', 'pptsx@' + VERSION];
  const probe = spawnSync(command, [...prefix, '--version'], { encoding: 'utf8', shell: IS_WINDOWS });
  if (probe.status === 0) return { command, prefix, shell: IS_WINDOWS };
  const lines = (probe.stderr || '').split('\n').map((line) => line.replace(/^npm (error|ERR!) ?/, '').trim()).filter((line) => line && !line.startsWith('A complete log'));
  npxFailure = lines[0] || 'npx pptsx@' + VERSION + ' falhou';
  return null;
};

const bundleRuntime = (file) => ({ command: process.execPath, prefix: [file], shell: false });

const findRuntime = async () => {
  const forced = process.env.PPTSX_BUNDLE;
  if (forced && existsSync(forced)) return bundleRuntime(forced);
  const cached = cachedBundle();
  if (existsSync(cached) && (!BUNDLE_SHA256 || sha256(readFileSync(cached)) === BUNDLE_SHA256)) return bundleRuntime(cached);
  const downloaded = await download();
  if (downloaded) return bundleRuntime(downloaded);
  return npxRuntime();
};

const HELP = [
  'uso: node scripts/pptsx.mjs <comando> [argumentos]',
  '  init [pasta]                     cria deck.tsx, tsconfig.json e pptsx.config.ts',
  '  build <deck.tsx> [--size 16x9,4x3] [--out dist]   gera o .pptx e os PNGs; imprime o resumo',
  '  lint <deck.tsx>                  aponta riscos antes do build',
  '  preview <deck.tsx> --serve       prévia ao vivo no navegador',
  '  doctor                           Node, fontes e cache',
  '  mcp                              servidor MCP por stdio',
].join('\n');

const offlineHelp = () =>
  [
    'pptsx: não achei o runtime do pptsx ' + VERSION + ' (sem cache, ' + (RELEASE_BASE ? 'sem download' : 'download desligado: a skill foi gerada sem a URL da release') + (npxFailure ? ', e o npx falhou: ' + npxFailure : ', sem npm') + ').',
    'Para resolver, uma destas:',
    '  1. Baixe pptsx.mjs ' + (RELEASE_BASE ? 'de ' + RELEASE_BASE + '/pptsx.mjs' : 'da release v' + VERSION + ' do pptsx') + ' e grave em ' + cachedBundle(),
    '     (ou aponte o arquivo com PPTSX_BUNDLE=/caminho/pptsx.mjs). Precisa de Node 20.6 ou mais novo.',
    '  2. Com Node e npm e a versão ' + VERSION + ' publicada no npm, rode de novo: o script usa npx pptsx@' + VERSION + ', sem instalar nada global.',
    '  Antes da publicação (release no GitHub e npm) só as opções do item 1 funcionam.',
  ].join('\n');

const SEVERITY_MARK = { error: '✖', warning: '▲', info: '•' };

const show = (file) => {
  const rel = relative(process.cwd(), file);
  return rel.startsWith('..') ? file : rel;
};

const summaryOf = (result) => {
  if (result.error) return 'Build falhou: ' + result.error;
  const files = result.files || [];
  const pptx = files.filter((file) => file.endsWith('.pptx'));
  const overviews = files.filter((file) => file.endsWith('.overview.png'));
  const slides = files.filter((file) => file.endsWith('.png') && !file.endsWith('.overview.png'));
  const diagnostics = result.diagnostics || [];
  const count = (severity) => diagnostics.filter((item) => item.severity === severity).length;
  const lines = [
    'Arquivos:',
    ...pptx.map((file) => '  ' + show(file)),
    ...overviews.map((file) => '  ' + show(file) + '  (todos os slides numa imagem: confira o layout aqui)'),
    ...(slides.length > 0 ? ['  ' + slides.length + ' PNGs de slide, ex.: ' + show(slides[0])] : []),
    '',
  ];
  if (diagnostics.length === 0) return [...lines, 'Nenhum diagnóstico.'].join('\n');
  return [
    ...lines,
    'Diagnósticos: ' + count('error') + ' error, ' + count('warning') + ' warning, ' + count('info') + ' info',
    ...diagnostics.map((item) => '  ' + (SEVERITY_MARK[item.severity] || '-') + ' [' + item.size + ' · slide ' + item.slide + '] ' + item.code + ' em ' + item.path + '\n    ' + item.message),
    '',
    count('error') > 0 ? 'Corrija os error (e de preferência os warning) e rode o build de novo.' : 'Sem error: o .pptx está pronto.',
  ].join('\n');
};

const main = async () => {
  const args = process.argv.slice(2);
  const command = args[0];
  if (!command || command === 'help' || command === '--help') {
    console.log(HELP);
    return 0;
  }
  const runtime = await findRuntime();
  if (!runtime) {
    console.error(offlineHelp());
    return 2;
  }
  if (command !== 'build' || args.includes('--json')) {
    const proc = spawnSync(runtime.command, [...runtime.prefix, ...args], { stdio: 'inherit', shell: runtime.shell });
    return proc.status === null ? 1 : proc.status;
  }
  const proc = spawnSync(runtime.command, [...runtime.prefix, ...args, '--json'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, shell: runtime.shell });
  if (proc.stderr) process.stderr.write(proc.stderr);
  try {
    console.log(summaryOf(JSON.parse(proc.stdout)));
  } catch {
    process.stdout.write(proc.stdout || '');
  }
  return proc.status === null ? 1 : proc.status;
};

process.exitCode = await main();
`;

const literal = (value: string | undefined): string => (value === undefined ? 'null' : JSON.stringify(value));

export const skillScript = (options: SkillScriptOptions): string =>
  TEMPLATE.replace('__VERSION__', JSON.stringify(options.version))
    .replace('__RELEASE_BASE__', literal(options.releaseBase))
    .replace('__BUNDLE_SHA256__', literal(options.bundleSha256));

/** `scripts/pptsx.cmd`: o mesmo script no Windows (o Explorer e o cmd não leem o shebang). */
export const SKILL_SCRIPT_CMD = '@echo off\r\nnode "%~dp0pptsx.mjs" %*\r\n';
