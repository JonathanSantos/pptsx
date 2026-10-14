// Spike M8-S: gera variantes de .pptx com/sem fonte embutida a partir do pptx base do projeto.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { render } from '/Users/jovivo/Developer/projects/pptsx/src/render.ts';
import { Deck, Slide, Text } from '/Users/jovivo/Developer/projects/pptsx/src/primitives/index.ts';
import { jsx } from '/Users/jovivo/Developer/projects/pptsx/src/jsx/jsx-runtime.ts';

const REPO = '/Users/jovivo/Developer/projects/pptsx';
const req = createRequire(join(REPO, 'package.json'));
const JSZip: any = req('jszip');

const OUT = process.argv[2] ?? join(import.meta.dirname, 'out');
mkdirSync(OUT, { recursive: true });

const REG = join(REPO, 'fonts/LiberationSans-Regular.ttf');
const BOLD = join(REPO, 'fonts/LiberationSans-Bold.ttf');
const SAMPLE = '1 I l | Q G R a g @ & % 7 Æ ß';

const deck = () =>
  jsx(Deck, {
    children: jsx(Slide, {
      background: '#FFFFFF',
      children: [
        jsx(Text, { position: 'absolute', left: 20, top: 20, width: 680, size: 60, font: 'Liberation Sans', children: SAMPLE }),
        jsx(Text, { position: 'absolute', left: 20, top: 210, width: 680, size: 60, font: 'Liberation Sans', weight: 'bold', children: SAMPLE }),
      ],
    }),
  });

const [result] = await render(deck as any, {
  fonts: [
    { family: 'Liberation Sans', weight: 'regular', file: REG },
    { family: 'Liberation Sans', weight: 'bold', file: BOLD },
  ],
  preview: { mode: 'native', width: 1440 },
});
if (!result) throw new Error('sem resultado');
console.log('diagnostics', JSON.stringify(result.diagnostics));
writeFileSync(join(OUT, 'reference.png'), result.preview!.slides[0]!);
const base: Buffer = result.buffer;

// ---------- formatos de fonte ----------

/** GUID "{XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}" → 16 bytes na ordem em que aparecem na string. */
const guidStringBytes = (guid: string): number[] => {
  const hex = guid.replace(/[{}-]/g, '');
  return Array.from({ length: 16 }, (_, i) => parseInt(hex.slice(i * 2, i * 2 + 2), 16));
};

/** ECMA-376 Part 1 §17.8.1: XOR dos 32 primeiros bytes com a chave de 16 bytes, repetida. */
const obfuscate = (ttf: Buffer, key: readonly number[]): Buffer => {
  const out = Buffer.from(ttf);
  for (let i = 0; i < 32; i++) out[i] = out[i]! ^ key[i % 16]!;
  return out;
};

/** Diretório de tabelas sfnt → offset da tabela. */
const tableOffset = (ttf: Buffer, tag: string): number => {
  const n = ttf.readUInt16BE(4);
  for (let i = 0; i < n; i++) {
    const rec = 12 + i * 16;
    if (ttf.toString('latin1', rec, rec + 4) === tag) return ttf.readUInt32BE(rec + 8);
  }
  throw new Error(`tabela ${tag} ausente`);
};

const utf16le = (s: string) => Buffer.from(s, 'utf16le');

/** EOT v2.1 (0x00020001) sem compressão MTX e sem XOR: cabeçalho + TTF inteiro. */
const toEot = (ttf: Buffer, names: { family: string; style: string; version: string; full: string }): Buffer => {
  const os2 = tableOffset(ttf, 'OS/2');
  const head = tableOffset(ttf, 'head');
  const fixed = Buffer.alloc(80);
  let o = 0;
  const u32 = (v: number) => { fixed.writeUInt32LE(v >>> 0, o); o += 4; };
  const u16 = (v: number) => { fixed.writeUInt16LE(v, o); o += 2; };
  const u8 = (v: number) => { fixed.writeUInt8(v, o); o += 1; };
  u32(0); // EOTSize, preenchido no fim
  u32(ttf.length); // FontDataSize
  u32(0x00020001); // Version
  u32(0); // Flags: sem subset, sem MTX, sem XOR
  ttf.copy(fixed, o, os2 + 32, os2 + 42); o += 10; // PANOSE
  u8(1); // Charset DEFAULT_CHARSET
  u8(ttf.readUInt16BE(os2 + 62) & 1); // Italic (fsSelection bit 0)
  u32(ttf.readUInt16BE(os2 + 4)); // Weight
  u16(ttf.readUInt16BE(os2 + 8)); // fsType
  u16(0x504c); // MagicNumber
  for (let k = 0; k < 4; k++) u32(ttf.readUInt32BE(os2 + 42 + k * 4)); // UnicodeRange1-4
  for (let k = 0; k < 2; k++) u32(ttf.readUInt32BE(os2 + 78 + k * 4)); // CodePageRange1-2
  u32(ttf.readUInt32BE(head + 8)); // CheckSumAdjustment
  for (let k = 0; k < 4; k++) u32(0); // Reserved1-4
  if (o !== 80) throw new Error(`cabeçalho EOT com ${o} bytes`);
  const str = (s: string) => { const b = utf16le(s); const h = Buffer.alloc(4); h.writeUInt16LE(0, 0); h.writeUInt16LE(b.length, 2); return Buffer.concat([h, b]); };
  // Padding1 + FamilyName, Padding2 + StyleName, Padding3 + VersionName, Padding4 + FullName, Padding5 + RootString (vazio)
  const parts = [fixed, str(names.family), str(names.style), str(names.version), str(names.full), str(''), ttf];
  const eot = Buffer.concat(parts);
  eot.writeUInt32LE(eot.length, 0);
  return eot;
};

// ---------- montagem do zip ----------

interface FontPart { readonly path: string; readonly data: Buffer; readonly style: 'regular' | 'bold' }

const FONT_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/font';

const embed = async (parts: readonly FontPart[], contentType: string): Promise<Buffer> => {
  const zip = await JSZip.loadAsync(base);
  parts.forEach((p) => zip.file(`ppt/${p.path}`, p.data));

  const ct: string = await zip.file('[Content_Types].xml').async('string');
  const ext = parts[0]!.path.split('.').pop()!;
  const ctNext = ct.includes(`Extension="${ext}"`)
    ? ct
    : ct.replace(/(<Types[^>]*>)/, `$1<Default Extension="${ext}" ContentType="${contentType}"/>`);
  zip.file('[Content_Types].xml', ctNext);

  const relsPath = 'ppt/_rels/presentation.xml.rels';
  const rels: string = await zip.file(relsPath).async('string');
  const ids = parts.map((_, i) => `rIdFont${i + 1}`);
  const relXml = parts.map((p, i) => `<Relationship Id="${ids[i]}" Type="${FONT_REL}" Target="${p.path}"/>`).join('');
  zip.file(relsPath, rels.replace('</Relationships>', `${relXml}</Relationships>`));

  const presPath = 'ppt/presentation.xml';
  const pres: string = await zip.file(presPath).async('string');
  const styleRefs = parts.map((p, i) => `<p:${p.style} r:id="${ids[i]}"/>`).join('');
  const list = `<p:embeddedFontLst><p:embeddedFont><p:font typeface="Liberation Sans" pitchFamily="34" charset="0"/>${styleRefs}</p:embeddedFont></p:embeddedFontLst>`;
  const anchor = pres.match(/<p:notesSz\b[^>]*\/>/) ?? pres.match(/<p:sldSz\b[^>]*\/>/);
  if (!anchor) throw new Error('sem sldSz/notesSz');
  let presNext = pres.replace(anchor[0], anchor[0] + list);
  presNext = presNext.replace(/<p:presentation\b([^>]*)>/, (m, attrs: string) =>
    attrs.includes('embedTrueTypeFonts') ? m : `<p:presentation${attrs} embedTrueTypeFonts="1">`);
  zip.file(presPath, presNext);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
};

const ttfReg = readFileSync(REG);
const ttfBold = readFileSync(BOLD);
const guid = () => randomUUID().toUpperCase(); // sem chaves: "{" e "}" não são válidos em part names OPC (XPS usa o GUID puro)

const variants: Record<string, () => Promise<Buffer>> = {
  'A-sem-embed': async () => base,
  'B-ttf-cru': () =>
    embed(
      [
        { path: 'fonts/font1.fntdata', data: ttfReg, style: 'regular' },
        { path: 'fonts/font2.fntdata', data: ttfBold, style: 'bold' },
      ],
      'application/x-fontdata',
    ),
  'C1-ofuscado-invertido': () => {
    const g1 = guid(); const g2 = guid();
    console.log('C1 guids', g1, g2);
    return embed(
      [
        { path: `fonts/${g1}.fntdata`, data: obfuscate(ttfReg, guidStringBytes(g1).reverse()), style: 'regular' },
        { path: `fonts/${g2}.fntdata`, data: obfuscate(ttfBold, guidStringBytes(g2).reverse()), style: 'bold' },
      ],
      'application/x-fontdata',
    );
  },
  'C2-ofuscado-direto': () => {
    const g1 = guid(); const g2 = guid();
    console.log('C2 guids', g1, g2);
    return embed(
      [
        { path: `fonts/${g1}.fntdata`, data: obfuscate(ttfReg, guidStringBytes(g1)), style: 'regular' },
        { path: `fonts/${g2}.fntdata`, data: obfuscate(ttfBold, guidStringBytes(g2)), style: 'bold' },
      ],
      'application/x-fontdata',
    );
  },
  'E-eot': () =>
    embed(
      [
        { path: 'fonts/font1.fntdata', data: toEot(ttfReg, { family: 'Liberation Sans', style: 'Regular', version: 'Version 2.1.5', full: 'Liberation Sans' }), style: 'regular' },
        { path: 'fonts/font2.fntdata', data: toEot(ttfBold, { family: 'Liberation Sans', style: 'Bold', version: 'Version 2.1.5', full: 'Liberation Sans Bold' }), style: 'bold' },
      ],
      'application/x-fontdata',
    ),
};

for (const [name, make] of Object.entries(variants)) {
  const buf = await make();
  writeFileSync(join(OUT, `${name}.pptx`), buf);
  console.log(name, buf.length);
}
