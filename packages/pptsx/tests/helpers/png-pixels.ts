import { inflateSync } from 'node:zlib';

/**
 * M18-7: decodifica o PNG que o resvg grava (8 bits por canal, RGB ou RGBA, sem entrelaçamento) para
 * comparar pixels entre o rasterizador nativo e o wasm. Não é um decodificador geral.
 */

export interface Pixels {
  readonly width: number;
  readonly height: number;
  /** RGBA, 4 bytes por pixel. */
  readonly data: Uint8Array;
}

const CHANNELS: Readonly<Record<number, number>> = { 2: 3, 6: 4 };

const paeth = (a: number, b: number, c: number): number => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

export const decodePng = (png: Buffer): Pixels => {
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idat: Buffer[] = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    const body = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      if (body[8] !== 8 || body[12] !== 0) throw new Error('decodePng: só 8 bits sem entrelaçamento');
      colorType = body[9]!;
    }
    if (type === 'IDAT') idat.push(body);
    offset += 12 + length;
  }
  const channels = CHANNELS[colorType];
  if (channels === undefined) throw new Error(`decodePng: tipo de cor ${colorType} não suportado`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const rows = new Uint8Array(height * stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)]!;
    for (let x = 0; x < stride; x += 1) {
      const value = raw[y * (stride + 1) + 1 + x]!;
      const left = x >= channels ? rows[y * stride + x - channels]! : 0;
      const up = y > 0 ? rows[(y - 1) * stride + x]! : 0;
      const upLeft = y > 0 && x >= channels ? rows[(y - 1) * stride + x - channels]! : 0;
      const predictor = [0, left, up, (left + up) >> 1, paeth(left, up, upLeft)][filter] ?? 0;
      rows[y * stride + x] = (value + predictor) & 0xff;
    }
  }
  if (channels === 4) return { width, height, data: rows };
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    data.set(rows.subarray(i * 3, i * 3 + 3), i * 4);
    data[i * 4 + 3] = 255;
  }
  return { width, height, data };
};

/** Fração de pixels com algum canal diferente por mais de `tolerance` (0–255). */
export const pixelDiffRatio = (a: Pixels, b: Pixels, tolerance = 8): number => {
  if (a.width !== b.width || a.height !== b.height) return 1;
  let different = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    const off = [0, 1, 2, 3].some((c) => Math.abs(a.data[i + c]! - b.data[i + c]!) > tolerance);
    if (off) different += 1;
  }
  return different / (a.width * a.height);
};
