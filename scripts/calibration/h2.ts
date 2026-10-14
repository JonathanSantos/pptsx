import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { render } from '../../src/render.ts';
import type { DeckDefinition, PositionedNode as EngineNode } from '../../src/core/types.ts';
import type { PositionedNode, PositionedText } from '../types.ts';

/**
 * Calibração no Keynote pela metodologia do M3-F/M8-H (vinda da PoC CSS, M11): gera o .pptx pela
 * engine, exporta PDF pelo Keynote, lê as linhas de cada amostra pelo PDFKit e compara com as
 * linhas calculadas. Amostra = Box cujo 1º filho é o rótulo "C01 · …"/"R01 · …".
 * uso: npx tsx scripts/calibration/h2.ts <deck.tsx> <pasta-saida>
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const RETRIES = 3;
const RETRY_DELAY_MS = 30_000;
/**
 * Quanto do retângulo passa da base do texto (em linhas). Zero: uma linha a mais no renderizador
 * aparece como texto faltando na comparação, sem o retângulo invadir a amostra de baixo.
 */
const BELOW_LINES = 0;
const SAMPLE_LABEL = /^([CR]\d\d) · /;

type AnyNode = PositionedNode | EngineNode;

const flatten = (nodes: readonly AnyNode[]): readonly AnyNode[] =>
  nodes.flatMap((node) => [node, ...(node.kind === 'box' ? flatten(node.children as readonly AnyNode[]) : [])]);

const textsOf = (node: AnyNode): readonly PositionedText[] => flatten([node]).filter((n): n is PositionedText => n.kind === 'text');

interface Sample {
  readonly id: string;
  readonly page: number;
  readonly bodies: readonly PositionedText[];
}

const samplesOf = (slides: readonly { readonly children: readonly AnyNode[] }[]): readonly Sample[] =>
  slides.flatMap((slide, page) =>
    flatten(slide.children).flatMap((node) => {
      if (node.kind !== 'box') return [];
      const [label, body] = node.children as readonly AnyNode[];
      if (label?.kind !== 'text' || body === undefined) return [];
      const match = SAMPLE_LABEL.exec(label.content);
      return match?.[1] === undefined ? [] : [{ id: match[1], page, bodies: textsOf(body) }];
    }),
  );

// O PDF não guarda espaço como glifo: compara a linha sem espaços (o que importa é onde ela termina).
const normalize = (line: string): string => line.replace(/[\s\u00A0]+/g, '');

const keyOf = (page: number, text: PositionedText): string => `${page}|${text.path}`;

// A caixa de texto do PPTX é a área de conteúdo (frame sem padding/borda).
const boxOf = (page: number, text: PositionedText) => {
  const box = (text as Partial<PositionedText>).box;
  const left = (box?.padding.left ?? 0) + (box?.border.left ?? 0);
  const top = (box?.padding.top ?? 0) + (box?.border.top ?? 0);
  return {
    key: keyOf(page, text),
    page,
    x: text.frame.x + left,
    y: text.frame.y + top,
    // nowrap pode passar da caixa de propósito (R20): a linha inteira tem que entrar no retângulo.
    width: Math.max(text.frame.width - left - (box?.padding.right ?? 0) - (box?.border.right ?? 0), text.props.nowrap === true ? text.text.width : 0),
    height: text.text.height + text.text.lineHeight * BELOW_LINES,
    fontSize: text.text.fontSize,
  };
};

const exportPdf = async (pptx: string, pdf: string, attempt = 1): Promise<void> => {
  try {
    execFileSync(join(HERE, 'keynote-pdf.sh'), [pptx, pdf], { stdio: 'pipe' });
  } catch (error) {
    // AppleEvent -1712/-1700/-609: o Keynote ocupado; espera e tenta de novo (sem matar processos).
    if (attempt >= RETRIES) throw error;
    console.error(`Keynote falhou (tentativa ${attempt}): ${String((error as { stderr?: Buffer }).stderr ?? error).trim()}`);
    await sleep(RETRY_DELAY_MS);
    await exportPdf(pptx, pdf, attempt + 1);
  }
};

const main = async (): Promise<void> => {
  const [deckArg, outArg] = process.argv.slice(2);
  if (deckArg === undefined || outArg === undefined) throw new Error('uso: h2.ts <deck.tsx> <pasta-saida>');
  const deckPath = resolve(deckArg);
  const out = resolve(outArg);
  mkdirSync(out, { recursive: true });
  const deck = ((await import(pathToFileURL(deckPath).href)) as { default: DeckDefinition }).default;
  const options = { sizes: ['16x9'] as const, preview: false as const, includePositioned: true, baseDir: dirname(deckPath) };
  const [result] = await render(deck, options);
  const slides = result!.positioned!.slides as readonly { readonly children: readonly AnyNode[]; readonly frame: { width: number } }[];
  const name = basename(deckPath, extname(deckPath));
  const pptx = join(out, `${name}.pptx`);
  const pdf = join(out, `${name}.pdf`);
  writeFileSync(pptx, result!.buffer);
  const samples = samplesOf(slides);
  const boxes = samples.flatMap((sample) => sample.bodies.map((text) => boxOf(sample.page, text)));
  writeFileSync(join(out, `${name}.boxes.json`), JSON.stringify(boxes));
  // H2_REUSE_PDF=1 reaproveita o PDF já exportado (só refaz a extração e a comparação).
  if (process.env.H2_REUSE_PDF !== '1' || !existsSync(pdf)) await exportPdf(pptx, pdf);
  const raw = execFileSync('swift', [join(HERE, 'pdflines.swift'), pdf, join(out, `${name}.boxes.json`), String(slides[0]!.frame.width)], { encoding: 'utf8' });
  const keynote = JSON.parse(raw) as Readonly<Record<string, readonly string[]>>;
  const rows = samples.map((sample) => {
    const texts = sample.bodies.map((text) => {
      const ours = text.text.lines.map(normalize).filter((line) => line !== '');
      const theirs = (keynote[keyOf(sample.page, text)] ?? []).map(normalize).filter((line) => line !== '');
      return { ours, theirs, same: ours.join('\n') === theirs.join('\n') };
    });
    return { id: sample.id, same: texts.every((t) => t.same), texts };
  });
  writeFileSync(join(out, `${name}.h2.json`), `${JSON.stringify(rows, null, 1)}\n`);
  const same = rows.filter((row) => row.same).length;
  rows.filter((row) => !row.same).forEach((row) => {
    console.log(`≠ ${row.id}`);
    row.texts.filter((t) => !t.same).forEach((t) => console.log(`   engine: ${JSON.stringify(t.ours)}\n   keynote: ${JSON.stringify(t.theirs)}`));
  });
  console.log(`${name}: ${same}/${rows.length} amostras com as mesmas linhas no Keynote (${pptx})`);
};

await main();
