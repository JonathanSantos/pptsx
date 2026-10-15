import { DEFAULTS } from '../core/defaults.ts';
import type { ResolvedText, TextRun } from '../core/types.ts';

/**
 * M13-5: corte de um Text em linhas já quebradas. Puro. As linhas do medidor perdem espaços
 * (o de quebra é consumido; espaços repetidos viram um), então o corte alinha pelos caracteres
 * que não são espaço e devolve o deslocamento no `content` original: o texto restante sai dos
 * runs do autor, com estilos, NBSP e quebras de parágrafo intactos.
 */

// NBSP é cola (faz parte da palavra), não espaço de quebra.
const isBreakSpace = (char: string): boolean => /[^\S ]/.test(char);

/** Deslocamento em `content` logo depois das `count` primeiras linhas. */
export const offsetAfterLines = (content: string, lines: readonly string[], count: number): number =>
  lines.slice(0, count).reduce((cursor, line) => {
    const visible = [...line].filter((char) => !isBreakSpace(char));
    return visible.reduce((at, char) => {
      let next = at;
      while (next < content.length && isBreakSpace(content[next]!)) next += 1;
      // Linha e conteúdo têm os mesmos caracteres visíveis; um desencontro seria bug do medidor.
      if (content[next] !== char) throw new Error(`Corte de texto desalinhado em ${next}: "${content[next]}" ≠ "${char}"`);
      return next + 1;
    }, cursor);
  }, 0);

const trimRunsEnd = (runs: readonly TextRun[]): readonly TextRun[] => {
  const last = runs[runs.length - 1];
  if (last === undefined) return runs;
  const text = last.text.replace(/[^\S ]+$/, '');
  if (text === last.text) return runs;
  return text === '' ? trimRunsEnd(runs.slice(0, -1)) : [...runs.slice(0, -1), { ...last, text }];
};

const trimRunsStart = (runs: readonly TextRun[]): readonly TextRun[] => {
  const [first, ...rest] = runs;
  if (first === undefined) return runs;
  const text = first.text.replace(/^[^\S ]+/, '');
  if (text === first.text) return runs;
  return text === '' ? trimRunsStart(rest) : [{ ...first, text }, ...rest];
};

interface SplitRuns {
  readonly head: readonly TextRun[];
  readonly tail: readonly TextRun[];
}

/** Runs divididos no deslocamento; o espaço (e o '\n') da fronteira some dos dois lados. */
export const splitRunsAt = (runs: readonly TextRun[], offset: number): SplitRuns => {
  const { head, tail } = runs.reduce<{ readonly head: readonly TextRun[]; readonly tail: readonly TextRun[]; readonly at: number }>(
    (acc, run) => {
      const start = acc.at;
      const end = start + run.text.length;
      const cut = Math.min(Math.max(offset - start, 0), run.text.length);
      const before = cut > 0 ? [{ ...run, text: run.text.slice(0, cut) }] : [];
      const after = cut < run.text.length ? [{ ...run, text: run.text.slice(cut) }] : [];
      return { head: [...acc.head, ...before], tail: [...acc.tail, ...after], at: end };
    },
    { head: [], tail: [], at: 0 },
  );
  return { head: trimRunsEnd(head), tail: trimRunsStart(tail) };
};

const contentOf = (runs: readonly TextRun[]): string => runs.map((run) => run.text).join('');

/** O mesmo Text só com estes runs (path, props e css intactos). */
export const withRuns = (text: ResolvedText, runs: readonly TextRun[]): ResolvedText => ({ ...text, runs, content: contentOf(runs) });

/** Linha (1-based) em que cada parágrafo do autor termina. */
const paragraphEndsOf = (paragraphs: readonly (readonly string[])[]): readonly number[] =>
  paragraphs.reduce<readonly number[]>((ends, lines) => [...ends, (ends[ends.length - 1] ?? 0) + lines.length], []);

/**
 * Onde cortar, dado que `fitting` linhas cabem: no fim de parágrafo mais próximo abaixo, se a parte
 * não ficar com menos da metade de `fitting`; senão dentro do parágrafo, com pelo menos
 * `orphanLines` linhas dele em cada lado (recuando para o início do parágrafo se não der).
 * Nunca menos de 1 linha.
 */
export const cutLineOf = (paragraphs: readonly (readonly string[])[], fitting: number): number => {
  const ends = paragraphEndsOf(paragraphs);
  const total = ends[ends.length - 1] ?? 0;
  if (fitting >= total) return total;
  const atParagraph = [...ends].reverse().find((end) => end <= fitting);
  if (atParagraph !== undefined && atParagraph >= Math.ceil(fitting / 2)) return atParagraph;
  const orphans = DEFAULTS.text.orphanLines;
  const end = ends.find((value) => value > fitting)!;
  const start = (ends[ends.indexOf(end) - 1] ?? 0) + 1;
  const keepAfter = Math.min(fitting, end - orphans);
  if (keepAfter - start + 1 >= orphans) return keepAfter;
  // O parágrafo é curto demais para dividir com órfãs: começa inteiro na próxima parte.
  return start - 1 >= 1 ? start - 1 : Math.max(1, fitting);
};
