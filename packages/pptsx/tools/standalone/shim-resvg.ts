import { readFileSync } from 'node:fs';
import { initWasm, Resvg as WasmResvg } from '@resvg/resvg-wasm';
import { RESVG_WASM_BASE64 } from 'pptsx-standalone:assets';

/**
 * M18-7: no bundle, `@resvg/resvg-js` (addon nativo, um binário por plataforma) vira o resvg-wasm, com a
 * mesma superfície que o núcleo usa: `new Resvg(svg, { fitTo, font }).render().asPng()`. O wasm não lê
 * arquivos: as fontes viram buffers (com cache, o preview rasteriza dezenas de slides com as mesmas).
 */

await initWasm(Buffer.from(RESVG_WASM_BASE64, 'base64'));

interface FontOptions {
  readonly fontFiles?: readonly string[];
  readonly loadSystemFonts?: boolean;
  readonly defaultFontFamily?: string;
}

interface ResvgOptions {
  readonly fitTo?: { readonly mode: 'original' } | { readonly mode: 'width' | 'height' | 'zoom'; readonly value: number };
  readonly font?: FontOptions;
}

const buffers = new Map<string, Uint8Array>();

const bufferOf = (file: string): Uint8Array => {
  const cached = buffers.get(file);
  if (cached !== undefined) return cached;
  const buffer = new Uint8Array(readFileSync(file));
  buffers.set(file, buffer);
  return buffer;
};

export class Resvg {
  private readonly inner: InstanceType<typeof WasmResvg>;

  constructor(svg: string, options: ResvgOptions = {}) {
    const font = options.font;
    this.inner = new WasmResvg(svg, {
      ...(options.fitTo === undefined ? {} : { fitTo: options.fitTo }),
      font: {
        fontBuffers: (font?.fontFiles ?? []).map(bufferOf),
        loadSystemFonts: false,
        ...(font?.defaultFontFamily === undefined ? {} : { defaultFontFamily: font.defaultFontFamily }),
      },
    } as ConstructorParameters<typeof WasmResvg>[1]);
  }

  render(): { readonly width: number; readonly height: number; asPng: () => Buffer } {
    const image = this.inner.render();
    return { width: image.width, height: image.height, asPng: () => Buffer.from(image.asPng()) };
  }
}
