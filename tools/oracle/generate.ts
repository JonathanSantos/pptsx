import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CASES } from '../../tests/layout/__fixtures__/css-cases.ts';
import { caseHtml } from './html.ts';

/**
 * Gera tests/layout/__fixtures__/css-cases.json com os frames que um browser real calcula para cada
 * caso da suíte H4. Só em desenvolvimento: precisa de `playwright-core` (devDependency da PoC)
 * e de um Chrome/Chromium local. O teste da PoC lê o JSON versionado, sem abrir browser.
 * uso: npx tsx poc/css/oracle/generate.ts
 */

type Frames = Readonly<Record<string, { x: number; y: number; width: number; height: number }>>;

interface Page {
  setContent(html: string): Promise<void>;
  evaluate<T>(fn: () => T | Promise<T>): Promise<T>;
}
interface Browser {
  newPage(options: { viewport: { width: number; height: number } }): Promise<Page>;
  version(): string;
  close(): Promise<void>;
}
interface Playwright {
  readonly chromium: { launch(options: { channel?: string; headless: boolean }): Promise<Browser> };
}

const fontFile = (name: string): string => fileURLToPath(new URL(`../../fonts/${name}`, import.meta.url));
const FONTS = {
  regular: fontFile('LiberationSans-Regular.ttf'),
  bold: fontFile('LiberationSans-Bold.ttf'),
  italic: fontFile('LiberationSans-Italic.ttf'),
  boldItalic: fontFile('LiberationSans-BoldItalic.ttf'),
};
const OUT = fileURLToPath(new URL('../../tests/layout/__fixtures__/css-cases.json', import.meta.url));

const framesOf = (page: Page): Promise<Frames> =>
  page.evaluate(async () => {
    await document.fonts.ready;
    const slide = document.getElementById('slide')!.getBoundingClientRect();
    const entries = [...document.querySelectorAll<HTMLElement>('[data-id]')].map((el) => {
      const r = el.getBoundingClientRect();
      return [el.dataset.id!, { x: r.x - slide.x, y: r.y - slide.y, width: r.width, height: r.height }] as const;
    });
    return Object.fromEntries(entries);
  });

const main = async (): Promise<void> => {
  // Import dinâmico: sem playwright-core instalado a PoC continua compilando e testando com o JSON versionado.
  const playwright = (await import('playwright-core' as string)) as Playwright;
  const browser = await playwright.chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    const cases: Record<string, Frames> = {};
    for (const test of CASES) {
      await page.setContent(caseHtml(test, FONTS));
      cases[test.name] = await framesOf(page);
    }
    writeFileSync(OUT, `${JSON.stringify({ browser: `Chrome ${browser.version()}`, generatedAt: new Date().toISOString().slice(0, 10), cases }, null, 1)}\n`);
    console.log(`${CASES.length} casos → ${OUT} (Chrome ${browser.version()})`);
  } finally {
    await browser.close();
  }
};

await main();
