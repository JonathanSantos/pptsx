import * as fontkit from 'fontkit';

/**
 * EOT v2.1 (0x00020001) sem compressão MTX e sem XOR: cabeçalho + TTF inteiro.
 * É o único formato de `.fntdata` que o PowerPoint aceitou no spike M8-S (TTF cru e
 * TTF ofuscado fazem ele recusar o arquivo inteiro).
 */
const EOT_VERSION = 0x00020001;
const EOT_MAGIC = 0x504c;
const EOT_FIXED_HEADER = 80;
const DEFAULT_CHARSET = 1;
/** OS/2.fsType bit 1: "Restricted License embedding" (a fonte não pode ser embutida). */
const FS_TYPE_RESTRICTED = 0x0002;

// fontkit decodifica fsType como bitfield; remonta o número a partir dos nomes que ele conhece.
const FS_TYPE_BITS: Readonly<Record<string, number>> = {
  noEmbedding: 0x0002,
  viewOnly: 0x0004,
  editable: 0x0008,
  noSubsetting: 0x0100,
  bitmapOnly: 0x0200,
};

const SFNT_TRUETYPE = 0x00010000;
const SFNT_TRUE = 0x74727565; // 'true' (TrueType da Apple)

const fontOf = (ttf: Buffer): fontkit.Font => {
  const loaded = fontkit.create(ttf);
  if ('fonts' in loaded) throw new Error('Esperava um TTF de uma face só, não uma coleção (.ttc).');
  return loaded;
};

/** Diretório de tabelas sfnt → offset da tabela. */
const tableOffset = (ttf: Buffer, tag: string): number => {
  const count = ttf.readUInt16BE(4);
  const record = Array.from({ length: count }, (_, i) => 12 + i * 16).find(
    (offset) => ttf.toString('latin1', offset, offset + 4) === tag,
  );
  if (record === undefined) throw new Error(`Fonte sem a tabela ${tag}; não dá para gerar EOT.`);
  return ttf.readUInt32BE(record + 8);
};

/** TrueType de uma face só: o que cabe num EOT sem conversão (CFF/.otf e .ttc ficam de fora). */
export const isTrueTypeFont = (ttf: Buffer): boolean => {
  if (ttf.length < 12) return false;
  const version = ttf.readUInt32BE(0);
  return version === SFNT_TRUETYPE || version === SFNT_TRUE;
};

export const fsTypeOf = (ttf: Buffer): number => {
  const fsType = (fontOf(ttf)['OS/2'] as fontkit.Os2Table | undefined)?.fsType;
  if (fsType === undefined) return 0;
  return Object.entries(fsType).reduce((acc, [name, on]) => (on === true ? acc | (FS_TYPE_BITS[name] ?? 0) : acc), 0);
};

export const isEmbeddable = (fsType: number): boolean => (fsType & FS_TYPE_RESTRICTED) === 0;

const fixedHeaderOf = (ttf: Buffer): Buffer => {
  const os2 = tableOffset(ttf, 'OS/2');
  const head = tableOffset(ttf, 'head');
  const header = Buffer.alloc(EOT_FIXED_HEADER);
  header.writeUInt32LE(0, 0); // EOTSize: preenchido depois de concatenar
  header.writeUInt32LE(ttf.length, 4); // FontDataSize
  header.writeUInt32LE(EOT_VERSION, 8);
  header.writeUInt32LE(0, 12); // Flags: sem subset, sem MTX, sem XOR
  ttf.copy(header, 16, os2 + 32, os2 + 42); // PANOSE
  header.writeUInt8(DEFAULT_CHARSET, 26);
  header.writeUInt8(ttf.readUInt16BE(os2 + 62) & 1, 27); // Italic = fsSelection bit 0
  header.writeUInt32LE(ttf.readUInt16BE(os2 + 4), 28); // Weight = usWeightClass
  header.writeUInt16LE(ttf.readUInt16BE(os2 + 8), 32); // fsType
  header.writeUInt16LE(EOT_MAGIC, 34);
  [0, 1, 2, 3].forEach((k) => header.writeUInt32LE(ttf.readUInt32BE(os2 + 42 + k * 4), 36 + k * 4)); // UnicodeRange1-4
  [0, 1].forEach((k) => header.writeUInt32LE(ttf.readUInt32BE(os2 + 78 + k * 4), 52 + k * 4)); // CodePageRange1-2
  header.writeUInt32LE(ttf.readUInt32BE(head + 8), 60); // CheckSumAdjustment
  // 64..79: Reserved1-4, já zerados pelo alloc.
  return header;
};

/** Padding (uint16 = 0) + tamanho em bytes (uint16) + UTF-16LE. */
const eotString = (text: string): Buffer => {
  const bytes = Buffer.from(text, 'utf16le');
  const prefix = Buffer.alloc(4);
  prefix.writeUInt16LE(bytes.length, 2);
  return Buffer.concat([prefix, bytes]);
};

const isRegularStyle = (style: string): boolean => /^(regular|normal|roman|book)$/i.test(style.trim());

/**
 * `familyName` é o nome com que o deck usa a fonte (o `typeface` do `<p:embeddedFont>`);
 * estilo e versão vêm da tabela `name` do TTF. Função pura sobre o Buffer.
 */
export const eotOf = (ttf: Buffer, familyName: string): Buffer => {
  const font = fontOf(ttf);
  const style = font.subfamilyName?.trim() || 'Regular';
  const version = font.getName('version', 'en')?.trim() || 'Version 1.0';
  const fullName = isRegularStyle(style) ? familyName : `${familyName} ${style}`;
  const eot = Buffer.concat([
    fixedHeaderOf(ttf),
    eotString(familyName),
    eotString(style),
    eotString(version),
    eotString(fullName),
    eotString(''), // RootString vazio: a fonte vale para qualquer origem
    ttf,
  ]);
  eot.writeUInt32LE(eot.length, 0);
  return eot;
};
