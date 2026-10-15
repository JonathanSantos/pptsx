import JSZip from 'jszip';
import { DEFAULTS, textStyleOf, weightValueOf } from '../core/defaults.ts';
import type { PlaceholderName, PositionedDeck, PositionedNode, PositionedSlide, Pt, Rect, TextAlign } from '../core/types.ts';
import { contentRectOf } from '../layout/index.ts';
import { ptToInches } from '../sizes.ts';
import type * as Pptx from './pptx.ts';
import { hexOf } from './runs.ts';

/**
 * Masters e layouts (M15-4). Cada `defineLayout` usado no deck vira um slide layout do pptxgenjs
 * (`defineSlideMaster`, título = nome do layout). O resto é pós-processamento do zip, porque o
 * placeholder do pptxgenjs copia posição e estilo do layout para o objeto do slide (o frame calculado
 * de cada slide se perderia):
 *  - placeholders: `<p:sp>` com `<p:ph>` no layout, no frame e no estilo do 1º slide que usa o layout;
 *    nos slides, o shape do nó marcado (nome `ph:<nome>`) ganha o mesmo `<p:ph>` e guarda o próprio xfrm;
 *  - conteúdo fixo: emitido por último no 1º slide do layout (os N últimos elementos do spTree) e
 *    movido para o layout com os relacionamentos (imagens, links); nos outros slides não é emitido.
 */

const EMU_PER_INCH = 914400;
const emu = (pt: Pt): number => Math.round(ptToInches(pt) * EMU_PER_INCH);

export const PLACEHOLDER_PREFIX = 'ph:';

export interface PlaceholderText {
  readonly family: string;
  readonly size: Pt;
  readonly color: string;
  readonly bold: boolean;
  readonly italic: boolean;
  readonly align: TextAlign;
}

export interface PlaceholderSpec {
  readonly name: PlaceholderName;
  readonly type: string;
  /** Ausente no título (o PowerPoint casa o título pelo tipo). */
  readonly idx?: number;
  readonly frame: Rect;
  readonly text?: PlaceholderText;
}

export interface LayoutPlan {
  readonly name: string;
  readonly background?: string | { readonly image: string };
  /** Índice (base 0) do slide de saída de onde saem as posições e o conteúdo fixo. */
  readonly first: number;
  /** Índices de todos os slides de saída do layout. */
  readonly slides: readonly number[];
  readonly placeholders: readonly PlaceholderSpec[];
}

const placeholderTypeOf = (name: PlaceholderName): string => DEFAULTS.placeholder.types[name] ?? DEFAULTS.placeholder.fallbackType;

const findMarked = (nodes: readonly PositionedNode[], name: PlaceholderName): PositionedNode | undefined =>
  nodes.reduce<PositionedNode | undefined>((found, node) => {
    if (found !== undefined) return found;
    if ((node.props as { readonly placeholder?: string }).placeholder === name && (node.kind === 'text' || node.kind === 'image' || node.kind === 'box')) return node;
    return node.kind === 'box' ? findMarked(node.children, name) : undefined;
  }, undefined);

const textSpecOf = (node: PositionedNode): PlaceholderText | undefined => {
  if (node.kind !== 'text') return undefined;
  const style = textStyleOf(node.props);
  const first = node.runs?.[0];
  return {
    family: style.family,
    size: node.text.fontSize,
    color: first?.color ?? node.props.color ?? DEFAULTS.text.color,
    bold: weightValueOf(first?.weight ?? style.weight) >= weightValueOf('bold'),
    italic: first?.italic ?? style.italic,
    align: node.props.align ?? DEFAULTS.text.align,
  };
};

/** O frame que o emissor usa para o conteúdo do nó (texto e imagem na área de conteúdo; Box inteiro). */
const frameOf = (node: PositionedNode): Rect => (node.kind === 'box' ? node.frame : contentRectOf(node.frame, node.box));

const placeholdersOf = (slide: PositionedSlide): readonly PlaceholderSpec[] => {
  const declared = slide.layout?.placeholders ?? [];
  return declared.flatMap((name, index) => {
    const node = findMarked(slide.children, name);
    if (node === undefined) return [];
    const type = placeholderTypeOf(name);
    const text = textSpecOf(node);
    return [{
      name,
      type,
      ...(type === 'title' ? {} : { idx: DEFAULTS.placeholder.firstIndex + index }),
      frame: frameOf(node),
      ...(text === undefined ? {} : { text }),
    }];
  });
};

/** Um plano por layout, na ordem em que aparecem no deck de saída. */
export const layoutPlansOf = (deck: PositionedDeck): readonly LayoutPlan[] =>
  deck.slides.reduce<readonly LayoutPlan[]>((plans, slide, index) => {
    const layout = slide.layout;
    if (layout === undefined) return plans;
    const existing = plans.find((plan) => plan.name === layout.name);
    if (existing !== undefined) return plans.map((plan) => (plan === existing ? { ...plan, slides: [...plan.slides, index] } : plan));
    return [...plans, {
      name: layout.name,
      ...(layout.background === undefined ? {} : { background: layout.background }),
      first: index,
      slides: [index],
      placeholders: placeholdersOf(slide),
    }];
  }, []);

/** Opções do `defineSlideMaster`: fundo do layout (o conteúdo fixo e os placeholders entram no pós-processamento). */
export const slideMasterPropsOf = (plan: LayoutPlan, baseDir: string, resolvePath: (baseDir: string, src: string) => string): Pptx.SlideMasterProps => {
  const background = plan.background;
  if (background === undefined) return { title: plan.name };
  if (typeof background === 'string') return { title: plan.name, background: { color: hexOf(background) } };
  return { title: plan.name, background: { path: resolvePath(baseDir, background.image) } };
};

// ───────────── slides: o shape marcado vira placeholder ─────────────

const escapeXml = (value: string): string => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const phXmlOf = (spec: Pick<PlaceholderSpec, 'type' | 'idx'>): string =>
  `<p:ph type="${spec.type}"${spec.idx === undefined ? '' : ` idx="${spec.idx}"`}/>`;

const promptOf = (name: PlaceholderName): string => DEFAULTS.placeholder.prompts[name] ?? name;

const DRAWING = /<p:(sp|pic)>[\s\S]*?<\/p:\1>/g;

/**
 * Num placeholder, atributo ausente no run herda do estilo do placeholder (o Keynote põe o subtítulo
 * em negrito, por exemplo): negrito e itálico ficam explícitos em cada run.
 */
export const explicitRunStyle = (element: string): string =>
  element.replace(/<a:rPr\b([^>]*?)(\/?)>/g, (_whole, attributes: string, close: string) => {
    const bold = /\sb="/.test(attributes) ? '' : ' b="0"';
    const italic = /\si="/.test(attributes) ? '' : ' i="0"';
    return `<a:rPr${attributes}${bold}${italic}${close}>`;
  });

/** O 1º `<p:sp>`/`<p:pic>` com o nome `ph:<nome>` recebe o `<p:ph>`; xfrm e estilo do slide ficam. */
export const linkPlaceholder = (xml: string, spec: PlaceholderSpec): string => {
  const marker = `name="${escapeXml(PLACEHOLDER_PREFIX + spec.name)}"`;
  const element = (xml.match(DRAWING) ?? []).find((drawing) => drawing.includes(marker));
  if (element === undefined) return xml;
  const linked = explicitRunStyle(element)
    .replace(marker, `name="${escapeXml(promptOf(spec.name))}"`)
    .replace(/<p:cNvSpPr[^>]*\/>|<p:cNvSpPr>[\s\S]*?<\/p:cNvSpPr>/, '<p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>')
    .replace(/<p:nvPr\s*\/>|<p:nvPr>\s*<\/p:nvPr>/, `<p:nvPr>${phXmlOf(spec)}</p:nvPr>`);
  return xml.replace(element, () => linked);
};

// ───────────── layout: placeholders e conteúdo fixo ─────────────

const ALIGNS: Readonly<Record<TextAlign, string>> = { left: 'l', center: 'ctr', right: 'r' };

const lstStyleOf = (text: PlaceholderText | undefined): string => {
  if (text === undefined) return '<a:lstStyle/>';
  const attributes = `sz="${Math.round(text.size * 100)}"${text.bold ? ' b="1"' : ' b="0"'}${text.italic ? ' i="1"' : ''}`;
  return (
    `<a:lstStyle><a:lvl1pPr marL="0" indent="0" algn="${ALIGNS[text.align]}"><a:buNone/>` +
    `<a:defRPr ${attributes}><a:solidFill><a:srgbClr val="${hexOf(text.color)}"/></a:solidFill><a:latin typeface="${escapeXml(text.family)}"/></a:defRPr>` +
    '</a:lvl1pPr></a:lstStyle>'
  );
};

export const layoutPlaceholderXmlOf = (spec: PlaceholderSpec, id: number, lang: string): string =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${escapeXml(promptOf(spec.name))}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr>${phXmlOf(spec)}</p:nvPr></p:nvSpPr>` +
  `<p:spPr><a:xfrm><a:off x="${emu(spec.frame.x)}" y="${emu(spec.frame.y)}"/><a:ext cx="${emu(spec.frame.width)}" cy="${emu(spec.frame.height)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>` +
  // Inset 0 e sem autoajuste, como os textos do slide: o PowerPoint não reposiciona nem encolhe.
  `<p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="t"><a:noAutofit/></a:bodyPr>${lstStyleOf(spec.text)}` +
  `<a:p><a:r><a:rPr lang="${lang}" dirty="0"/><a:t>${escapeXml(promptOf(spec.name))}</a:t></a:r></a:p></p:txBody></p:sp>`;

const TOP_LEVEL = /<p:(sp|pic|graphicFrame|cxnSp)>[\s\S]*?<\/p:\1>/g;
const SPTREE_END = '</p:spTree>';

/** Separa os `count` últimos elementos de desenho do spTree (o conteúdo fixo emitido por último). */
export const takeLastDrawings = (xml: string, count: number): { readonly rest: string; readonly taken: readonly string[] } => {
  if (count === 0) return { rest: xml, taken: [] };
  const all = xml.match(TOP_LEVEL) ?? [];
  const taken = all.slice(-count);
  const rest = taken.reduce((current, element) => {
    const at = current.lastIndexOf(element);
    return at === -1 ? current : current.slice(0, at) + current.slice(at + element.length);
  }, xml);
  return { rest, taken };
};

interface Relationship {
  readonly id: string;
  readonly xml: string;
}

const relationshipsOf = (rels: string): readonly Relationship[] =>
  [...rels.matchAll(/<Relationship\b[^>]*\bId="([^"]+)"[^>]*\/>/g)].map(([xml, id]) => ({ id: id!, xml }));

const REL_REFS = /\br:(?:embed|id|link)="([^"]+)"/g;

/**
 * Elementos movidos do slide para o layout: ids de shape novos (únicos no layout) e cada `r:embed`/`r:id`
 * apontando para uma cópia do relacionamento no `.rels` do layout.
 */
export const movedDrawingsOf = (
  drawings: readonly string[],
  slideRels: string,
  layoutRels: string,
  firstId: number,
): { readonly xml: string; readonly rels: string } => {
  const source = relationshipsOf(slideRels);
  const used = [...new Set(drawings.flatMap((element) => [...element.matchAll(REL_REFS)].map(([, id]) => id!)))];
  const renamed = new Map(used.map((id, index) => [id, `rIdFixed${index + 1}`]));
  const copies = used.flatMap((id) => {
    const rel = source.find((item) => item.id === id);
    return rel === undefined ? [] : [rel.xml.replace(`Id="${id}"`, `Id="${renamed.get(id)}"`)];
  });
  const xml = drawings
    .map((element, index) => element.replace(/<p:cNvPr id="\d+"/, `<p:cNvPr id="${firstId + index}"`))
    .map((element) => element.replace(REL_REFS, (whole, id: string) => (renamed.has(id) ? whole.replace(id, renamed.get(id)!) : whole)))
    .join('');
  return { xml, rels: copies.length === 0 ? layoutRels : layoutRels.replace('</Relationships>', `${copies.join('')}</Relationships>`) };
};

const LAYOUT_PART = /^ppt\/slideLayouts\/slideLayout\d+\.xml$/;

const layoutPartOf = async (zip: JSZip, name: string): Promise<string | undefined> => {
  const parts = Object.keys(zip.files).filter((part) => LAYOUT_PART.test(part));
  const contents = await Promise.all(parts.map(async (part) => [part, await zip.file(part)!.async('string')] as const));
  const wanted = [`<p:cSld name="${escapeXml(name)}"`, `<p:cSld name="${name}"`];
  return contents.find(([, xml]) => wanted.some((head) => xml.includes(head)))?.[0];
};

const relsPathOf = (part: string): string => part.replace(/([^/]+)$/, '_rels/$1.rels');

const EMPTY_RELS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';

/** `fixedCounts[i]` = elementos fixos emitidos por último no slide de saída i (só no 1º de cada layout). */
export const applyLayouts = async (buffer: Buffer, plans: readonly LayoutPlan[], fixedCounts: ReadonlyMap<number, number>, lang: string): Promise<Buffer> => {
  if (plans.length === 0) return buffer;
  const zip = await JSZip.loadAsync(buffer);
  // Em sequência: cada layout mexe no mesmo zip (o 1º slide de um layout pode ser lido por outro).
  await plans.reduce((previous, plan) => previous.then(() => applyLayout(zip, plan, fixedCounts, lang)), Promise.resolve());
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
};

const applyLayout = async (zip: JSZip, plan: LayoutPlan, fixedCounts: ReadonlyMap<number, number>, lang: string): Promise<void> => {
  const layoutPart = await layoutPartOf(zip, plan.name);
  if (layoutPart === undefined) return;
  const slidePart = `ppt/slides/slide${plan.first + 1}.xml`;
  const slideXml = await zip.file(slidePart)!.async('string');
  const { rest, taken } = takeLastDrawings(slideXml, fixedCounts.get(plan.first) ?? 0);
  const layoutRelsPart = relsPathOf(layoutPart);
  const moved = movedDrawingsOf(
    taken,
    (await zip.file(relsPathOf(slidePart))?.async('string')) ?? EMPTY_RELS,
    (await zip.file(layoutRelsPart)?.async('string')) ?? EMPTY_RELS,
    DEFAULTS.placeholder.firstShapeId,
  );
  const placeholders = plan.placeholders
    .map((spec, index) => layoutPlaceholderXmlOf(spec, DEFAULTS.placeholder.firstShapeId + taken.length + index, lang))
    .join('');
  const layoutXml = await zip.file(layoutPart)!.async('string');
  // Conteúdo fixo antes dos placeholders: no PowerPoint o que vem depois fica por cima.
  zip.file(layoutPart, layoutXml.replace(SPTREE_END, `${moved.xml}${placeholders}${SPTREE_END}`));
  zip.file(layoutRelsPart, moved.rels);
  zip.file(slidePart, rest);
  await Promise.all(
    plan.slides.map(async (index) => {
      const part = `ppt/slides/slide${index + 1}.xml`;
      const xml = await zip.file(part)!.async('string');
      zip.file(part, plan.placeholders.reduce(linkPlaceholder, xml));
    }),
  );
};
