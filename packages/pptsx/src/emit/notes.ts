import JSZip from 'jszip';
import { weightValueOf } from '../core/defaults.ts';
import { DEFAULTS } from '../core/defaults.ts';
import type { ResolvedNotes, TextRun } from '../core/types.ts';
import { hexOf } from './runs.ts';

/**
 * M15: notas do apresentador com estilo. O pptxgenjs só grava texto puro (`addNotes(string)`); quando
 * as notas têm negrito, itálico, cor, sublinhado ou link, o corpo do placeholder de notas
 * (`<p:ph type="body">`) é reescrito aqui com um `<a:p>` por parágrafo e um `<a:r>` por trecho.
 * Link de nota só para URL externa (relacionamento no `notesSlideN.xml.rels`); `slide:N` sai como texto.
 */

const HYPERLINK_RELATIONSHIP = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink';
const BOLD_FROM = 600;

const escapeXml = (value: string): string => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const isExternal = (href: string | undefined): href is string => href !== undefined && !href.startsWith('slide:');

const isBold = (run: TextRun): boolean => weightValueOf(run.weight) >= BOLD_FROM;

/** Notas que precisam do caminho rico: algum trecho com estilo além do texto puro preto. */
export const isRichNotes = (notes: ResolvedNotes): boolean =>
  notes.runs.some(
    (run) =>
      isBold(run) || run.italic || run.underline === true || run.lineThrough === true || isExternal(run.href) ||
      hexOf(run.color) !== hexOf(DEFAULTS.text.color) || (run.verticalAlign !== undefined && run.verticalAlign !== 'baseline'),
  );

/** Trechos de cada parágrafo ('\n' separa, como no Text); parágrafo vazio fica com zero trechos. */
export const notesParagraphsOf = (runs: readonly TextRun[]): readonly (readonly TextRun[])[] =>
  runs.reduce<readonly (readonly TextRun[])[]>(
    (paragraphs, run) => {
      const [first, ...rest] = run.text.split('\n');
      const pieces = (text: string): readonly TextRun[] => (text === '' ? [] : [{ ...run, text }]);
      const head = [...paragraphs.slice(0, -1), [...(paragraphs[paragraphs.length - 1] ?? []), ...pieces(first ?? '')]];
      return [...head, ...rest.map((text) => pieces(text))];
    },
    [[]],
  );

const BASELINE = { super: 30000, sub: -25000 } as const;

/** Relacionamento de link de um trecho: id já atribuído por URL. */
type LinkIds = ReadonlyMap<string, string>;

const runXmlOf = (run: TextRun, lang: string, links: LinkIds): string => {
  const attributes = [
    `lang="${lang}"`,
    isBold(run) ? 'b="1"' : '',
    run.italic ? 'i="1"' : '',
    run.underline === true ? 'u="sng"' : '',
    run.lineThrough === true ? 'strike="sngStrike"' : '',
    run.verticalAlign === 'super' || run.verticalAlign === 'sub' ? `baseline="${BASELINE[run.verticalAlign]}"` : '',
    'dirty="0"',
  ].filter((attribute) => attribute !== '');
  const fill = hexOf(run.color) === hexOf(DEFAULTS.text.color) ? '' : `<a:solidFill><a:srgbClr val="${hexOf(run.color)}"/></a:solidFill>`;
  const link = isExternal(run.href) ? `<a:hlinkClick r:id="${links.get(run.href)}"/>` : '';
  return `<a:r><a:rPr ${attributes.join(' ')}>${fill}${link}</a:rPr><a:t>${escapeXml(run.text)}</a:t></a:r>`;
};

export const notesBodyXmlOf = (notes: ResolvedNotes, lang: string, links: LinkIds): string =>
  notesParagraphsOf(notes.runs)
    .map((runs) => `<a:p>${runs.map((run) => runXmlOf(run, lang, links)).join('')}<a:endParaRPr lang="${lang}" dirty="0"/></a:p>`)
    .join('');

/** URLs externas das notas, cada uma com um id novo (não colide com os do pptxgenjs, que usam rIdN). */
export const linkIdsOf = (notes: ResolvedNotes): LinkIds =>
  new Map(
    [...new Set(notes.runs.map((run) => run.href).filter(isExternal))].map((href, index) => [href, `rIdNotesLink${index + 1}`]),
  );

// O corpo das notas é o <p:sp> do placeholder `body`; o txBody dele tem bodyPr, lstStyle e os parágrafos.
const NOTES_BODY = /(<p:ph type="body"[^>]*\/>[\s\S]*?<p:txBody>[\s\S]*?<a:lstStyle\/>)[\s\S]*?(<\/p:txBody>)/;

export const withRichNotes = (xml: string, body: string): string => xml.replace(NOTES_BODY, `$1${body}$2`);

export const withLinkRelationships = (rels: string, links: LinkIds): string =>
  [...links.entries()].reduce(
    (xml, [href, id]) => xml.replace('</Relationships>', `<Relationship Id="${id}" Type="${HYPERLINK_RELATIONSHIP}" Target="${escapeXml(href)}" TargetMode="External"/></Relationships>`),
    rels,
  );

/** Reescreve as notas ricas; `notes[i]` = notas do slide de saída i (o pptxgenjs numera notesSlide como o slide). */
export const applyRichNotes = async (buffer: Buffer, notes: readonly (ResolvedNotes | undefined)[], lang: string): Promise<Buffer> => {
  const rich = notes.flatMap((item, index) => (item !== undefined && isRichNotes(item) ? [{ item, number: index + 1 }] : []));
  if (rich.length === 0) return buffer;
  const zip = await JSZip.loadAsync(buffer);
  await Promise.all(
    rich.map(async ({ item, number }) => {
      const name = `ppt/notesSlides/notesSlide${number}.xml`;
      const relsName = `ppt/notesSlides/_rels/notesSlide${number}.xml.rels`;
      const links = linkIdsOf(item);
      const xml = await zip.file(name)?.async('string');
      if (xml === undefined) return;
      zip.file(name, withRichNotes(xml, notesBodyXmlOf(item, lang, links)));
      const rels = await zip.file(relsName)?.async('string');
      if (rels !== undefined && links.size > 0) zip.file(relsName, withLinkRelationships(rels, links));
    }),
  );
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
};
