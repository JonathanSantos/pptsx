import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { eotOf, fsTypeOf, isEmbeddable } from '../../src/fonts/index.ts';

/**
 * M8-D: EOT v2.1 sem compressão e sem XOR (formato aceito pelo PowerPoint no
 * spike M8-S): cabeçalho fixo de 80 bytes + nomes UTF-16LE + o TTF inteiro.
 */

const ttfOf = (name: string): Buffer =>
  readFileSync(fileURLToPath(new URL(`../../fonts/LiberationSans-${name}.ttf`, import.meta.url)));

const REGULAR = ttfOf('Regular');
const BOLD = ttfOf('Bold');
const ITALIC = ttfOf('Italic');

/** Offset de uma tabela sfnt pelo diretório de tabelas. */
const tableOffset = (ttf: Buffer, tag: string): number => {
  const count = ttf.readUInt16BE(4);
  for (let i = 0; i < count; i++) {
    const record = 12 + i * 16;
    if (ttf.toString('latin1', record, record + 4) === tag) return ttf.readUInt32BE(record + 8);
  }
  throw new Error(`no ${tag} table`);
};

/** Cópia do TTF com OS/2.fsType trocado. */
const withFsType = (ttf: Buffer, fsType: number): Buffer => {
  const copy = Buffer.from(ttf);
  copy.writeUInt16BE(fsType, tableOffset(copy, 'OS/2') + 8);
  return copy;
};

describe('eotOf', () => {
  const eot = eotOf(REGULAR, 'X');

  it('has the EOT magic number 0x504C at bytes 34..35', () => {
    expect(eot.readUInt16LE(34)).toBe(0x504c);
  });

  it('EOTSize equals the buffer length', () => {
    expect(eot.readUInt32LE(0)).toBe(eot.length);
  });

  it('FontDataSize equals the TTF length', () => {
    expect(eot.readUInt32LE(4)).toBe(REGULAR.length);
  });

  it('version 2.1 (0x00020001), no flags (no subset, no MTX, no XOR)', () => {
    expect(eot.readUInt32LE(8)).toBe(0x00020001);
    expect(eot.readUInt32LE(12)).toBe(0);
  });

  it('ends with the TTF bytes unchanged', () => {
    expect(eot.subarray(eot.length - REGULAR.length).equals(REGULAR)).toBe(true);
  });

  it('writes the family name in UTF-16LE right after the fixed header', () => {
    const size = eot.readUInt16LE(82);
    expect(eot.subarray(84, 84 + size).toString('utf16le')).toBe('X');
  });

  it('copies weight, italic and fsType from the font', () => {
    const os2 = tableOffset(REGULAR, 'OS/2');
    expect(eot.readUInt32LE(28)).toBe(REGULAR.readUInt16BE(os2 + 4));
    expect(eot.readUInt16LE(32)).toBe(REGULAR.readUInt16BE(os2 + 8));
    expect(eotOf(BOLD, 'X').readUInt32LE(28)).toBeGreaterThanOrEqual(600);
    expect(eot.readUInt8(27)).toBe(0);
    expect(eotOf(ITALIC, 'X').readUInt8(27)).toBe(1);
  });

  it('is deterministic', () => {
    expect(eotOf(REGULAR, 'X').equals(eot)).toBe(true);
  });
});

describe('fsTypeOf / isEmbeddable', () => {
  it('Liberation Sans is embeddable', () => {
    expect(isEmbeddable(fsTypeOf(REGULAR))).toBe(true);
  });

  it('reads OS/2.fsType', () => {
    expect(fsTypeOf(withFsType(REGULAR, 0x0002))).toBe(0x0002);
    expect(fsTypeOf(withFsType(REGULAR, 0x0008))).toBe(0x0008);
  });

  it('fsType with the restricted bit (0x0002) is not embeddable', () => {
    expect(isEmbeddable(0x0002)).toBe(false);
    expect(isEmbeddable(fsTypeOf(withFsType(REGULAR, 0x0002)))).toBe(false);
  });

  it('installable (0), preview & print (0x0004) and editable (0x0008) are embeddable', () => {
    expect(isEmbeddable(0)).toBe(true);
    expect(isEmbeddable(0x0004)).toBe(true);
    expect(isEmbeddable(0x0008)).toBe(true);
  });
});
