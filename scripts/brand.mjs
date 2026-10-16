#!/usr/bin/env node
// Gera a identidade visual do pptsx (logo, banners, ícones e diagramas dos READMEs) em SVG.
// O wordmark sai em contornos da Inter Bold: o GitHub mostra SVG como <img>, sem fontes web,
// então só os contornos garantem o mesmo desenho em qualquer máquina.
//   node scripts/brand.mjs            grava em packages/pptsx/docs/readme/brand/
//   node scripts/brand.mjs --png dir  também rasteriza cada SVG (conferência visual)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fontkit from 'fontkit';

const repo = fileURLToPath(new URL('../', import.meta.url));
const out = join(repo, 'packages/pptsx/docs/readme/brand');
const interDir = join(repo, 'packages/ds-base/fonts/inter');
const inter = {
  bold: fontkit.create(readFileSync(join(interDir, 'Inter-Bold.ttf'))),
  semibold: fontkit.create(readFileSync(join(interDir, 'Inter-SemiBold.ttf'))),
  regular: fontkit.create(readFileSync(join(interDir, 'Inter-Regular.ttf'))),
};

// ─── Paleta ──────────────────────────────────────────────────────────────────
// TSX (índigo) → PPTX (coral): o gradiente é a própria transformação que a lib faz.
export const C = {
  ink: '#0B1020',
  ink2: '#121834',
  ink3: '#1A2246',
  line: '#283160',
  slate: '#8A93B8',
  slateDark: '#5A6385',
  mist: '#EEF1FA',
  paper: '#FFFFFF',
  paper2: '#F7F8FD',
  border: '#E2E6F3',
  indigo: '#4F5BFF',
  magenta: '#C246D8',
  coral: '#FF6A3D',
  green: '#14B87F',
  amber: '#F5A524',
  red: '#F0445A',
};

const SANS = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const measure = (text, size, weight = 'regular', tracking = 0) => {
  const font = inter[weight];
  const run = font.layout(text);
  const units = run.positions.reduce((sum, p) => sum + p.xAdvance, 0);
  return (units / font.unitsPerEm) * size + tracking * Math.max(0, text.length - 1);
};
const monoWidth = (text, size) => text.length * size * 0.6;

/** Avisa no console quando um texto passa da largura que o desenho reservou. */
const fits = (label, size, max, weight = 'regular') => {
  const w = measure(label, size, weight);
  if (w > max) console.warn(`estoura ${(w - max).toFixed(1)}px: "${label}"`);
  return label;
};

const gradient = (id, { x1 = 0, y1 = 0, x2 = 1, y2 = 1, units } = {}) =>
  `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${units ? ` gradientUnits="${units}"` : ''}>` +
  `<stop offset="0" stop-color="${C.indigo}"/><stop offset=".55" stop-color="${C.magenta}"/><stop offset="1" stop-color="${C.coral}"/></linearGradient>`;

const shadow = (id, opacity = 0.18, dy = 6, blur = 10, color = C.ink) =>
  `<filter id="${id}" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="${dy}" stdDeviation="${blur}" flood-color="${color}" flood-opacity="${opacity}"/></filter>`;

const svg = (w, h, title, body, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="${SANS}">\n` +
  `<title>${esc(title)}</title>\n<defs>${defs}</defs>\n${body}\n</svg>\n`;

const text = (x, y, content, { size = 14, weight = 400, fill = C.ink, anchor, spacing, family, opacity } = {}) =>
  `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}"` +
  (anchor ? ` text-anchor="${anchor}"` : '') +
  (spacing ? ` letter-spacing="${spacing}"` : '') +
  (family ? ` font-family="${family}"` : '') +
  (opacity !== undefined ? ` opacity="${opacity}"` : '') +
  ` xml:space="preserve">${esc(content)}</text>`;

/** Pílula com texto; devolve o SVG e a largura, para enfileirar. */
const pill = (x, y, label, { size = 13, h = 28, fill = 'none', stroke, color = C.ink, weight = 'semibold', mono = false, pad = 13 } = {}) => {
  const w = (mono ? monoWidth(label, size) : measure(label, size, weight)) + pad * 2;
  const body =
    `<rect x="${x}" y="${y}" width="${w.toFixed(1)}" height="${h}" rx="${h / 2}" fill="${fill}"${stroke ? ` stroke="${stroke}"` : ''}/>` +
    text(x + w / 2, y + h / 2 + size * 0.36, label, { size, weight: weight === 'semibold' ? 600 : 400, fill: color, anchor: 'middle', family: mono ? MONO : undefined });
  return { body, w };
};

const pillRow = (x, y, labels, opts = {}, gap = 8) => {
  let cursor = x;
  return labels
    .map((label) => {
      const p = pill(cursor, y, label, opts);
      cursor += p.w + gap;
      return p.body;
    })
    .join('');
};

// ─── Wordmark em contornos ───────────────────────────────────────────────────
/** Glifos de `word` como paths; `paint(char, i)` escolhe o preenchimento de cada letra. */
const wordmark = (word, x, baseline, size, paint, tracking = -0.035) => {
  const font = inter.bold;
  const scale = size / font.unitsPerEm;
  const run = font.layout(word);
  let cursor = x;
  const parts = run.glyphs.map((glyph, i) => {
    const gx = cursor;
    cursor += run.positions[i].xAdvance * scale + tracking * size;
    return `<path transform="translate(${gx.toFixed(2)} ${baseline}) scale(${scale.toFixed(5)} ${(-scale).toFixed(5)})" d="${glyph.path.toSVG()}" fill="${paint(word[i], i)}"/>`;
  });
  return { body: parts.join(''), width: cursor - x - tracking * size };
};

// O "s" é o TSX entrando no PPTX: ppt·s·x. Ele leva o gradiente.
const brandWord = (x, baseline, size, ink, gradId) => wordmark('pptsx', x, baseline, size, (ch) => (ch === 's' ? `url(#${gradId})` : ink));

// ─── Símbolo ─────────────────────────────────────────────────────────────────
/** Ladrilho com gradiente, um slide atrás (o deck) e um slide na frente com </> . */
const mark = (x, y, size, id) => {
  const k = size / 64;
  return (
    `<g transform="translate(${x} ${y}) scale(${k})">` +
    `<rect width="64" height="64" rx="16" fill="url(#${id}-tile)"/>` +
    `<rect x="14.5" y="11" width="40" height="27" rx="5" fill="#FFFFFF" opacity=".38"/>` +
    `<rect x="9" y="18" width="46" height="31" rx="6" fill="#FFFFFF"/>` +
    `<g fill="none" stroke="url(#${id}-ink)" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">` +
    `<polyline points="22,27.5 17,33.5 22,39.5"/><polyline points="42,27.5 47,33.5 42,39.5"/><line x1="35" y1="25.5" x2="29" y2="41.5"/></g>` +
    `</g>`
  );
};
const markDefs = (id) =>
  gradient(`${id}-tile`, { x1: 0, y1: 0, x2: 64, y2: 64, units: 'userSpaceOnUse' }) +
  gradient(`${id}-ink`, { x1: 9, y1: 18, x2: 55, y2: 49, units: 'userSpaceOnUse' });

const markSvg = () => svg(64, 64, 'pptsx', mark(0, 0, 64, 'm'), markDefs('m'));

const logoSvg = (theme) => {
  const ink = theme === 'dark' ? '#FFFFFF' : C.ink;
  const word = brandWord(84, 51, 58, ink, 'w');
  const width = Math.ceil(84 + word.width + 4);
  return svg(width, 68, 'pptsx', mark(0, 2, 64, 'm') + word.body, markDefs('m') + gradient('w'));
};

// ─── Fundo escuro comum aos banners ──────────────────────────────────────────
const darkBackdrop = (w, h) =>
  `<rect width="${w}" height="${h}" rx="22" fill="${C.ink}"/>` +
  `<g clip-path="url(#clip)">` +
  `<rect width="${w}" height="${h}" fill="url(#dots)"/>` +
  `<circle cx="${w * 0.12}" cy="${-h * 0.05}" r="${h * 1.05}" fill="url(#glowA)"/>` +
  `<circle cx="${w * 0.95}" cy="${h * 1.05}" r="${h * 0.95}" fill="url(#glowB)"/>` +
  `<circle cx="${w * 0.7}" cy="${h * 0.2}" r="${h * 0.6}" fill="url(#glowC)"/>` +
  `</g>` +
  `<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="21.5" fill="none" stroke="#FFFFFF" stroke-opacity=".08"/>`;

const darkDefs = (w, h) =>
  `<clipPath id="clip"><rect width="${w}" height="${h}" rx="22"/></clipPath>` +
  `<pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.1" fill="#FFFFFF" fill-opacity=".07"/></pattern>` +
  `<radialGradient id="glowA"><stop offset="0" stop-color="${C.indigo}" stop-opacity=".42"/><stop offset="1" stop-color="${C.indigo}" stop-opacity="0"/></radialGradient>` +
  `<radialGradient id="glowB"><stop offset="0" stop-color="${C.coral}" stop-opacity=".30"/><stop offset="1" stop-color="${C.coral}" stop-opacity="0"/></radialGradient>` +
  `<radialGradient id="glowC"><stop offset="0" stop-color="${C.magenta}" stop-opacity=".16"/><stop offset="1" stop-color="${C.magenta}" stop-opacity="0"/></radialGradient>`;

// ─── Código com destaque de sintaxe ──────────────────────────────────────────
const SYN = { tag: '#7EA6FF', attr: '#D9B8FF', str: '#FFB08F', num: '#FFD479', punct: '#7C86AE', plain: '#E3E8FA', fn: '#7FE3C4' };

/** Linhas como listas de [texto, cor]; vira <text> com <tspan>. */
const codeBlock = (x, y, lines, { size = 14, lh = 22 } = {}) =>
  lines
    .map(
      (tokens, i) =>
        `<text x="${x}" y="${y + i * lh}" font-family="${MONO}" font-size="${size}" xml:space="preserve">` +
        tokens.map(([t, c]) => `<tspan fill="${SYN[c] ?? c}">${esc(t)}</tspan>`).join('') +
        `</text>`,
    )
    .join('\n');

const windowCard = (x, y, w, h, title) =>
  `<g filter="url(#cardShadow)"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="${C.ink2}"/></g>` +
  `<rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" rx="15.5" fill="none" stroke="#FFFFFF" stroke-opacity=".1"/>` +
  `<path d="M${x} ${y + 40} h${w}" stroke="#FFFFFF" stroke-opacity=".08"/>` +
  [C.red, C.amber, C.green].map((c, i) => `<circle cx="${x + 22 + i * 18}" cy="${y + 20}" r="5.5" fill="${c}" opacity=".9"/>`).join('') +
  text(x + w / 2, y + 25, title, { size: 12.5, fill: C.slate, anchor: 'middle', family: MONO });

/** Slide de mentira (720×405 em escala) com título, três KPIs e barras. */
const slideMock = (x, y, w) => {
  const s = w / 360;
  const h = 202.5;
  const kpis = [
    ['Receita (R$ mi)', '52,4', '▲ 14,2%', C.green],
    ['Clientes', '1.284', '▲ 86', C.green],
    ['NPS', '62', '▼ 4 pts', C.red],
  ];
  const cardW = 100;
  const bars = [38, 46, 41, 55, 61, 58, 70, 84];
  return (
    `<g transform="translate(${x} ${y}) scale(${s})">` +
    `<g filter="url(#slideShadow)"><rect width="360" height="${h}" rx="10" fill="#FFFFFF"/></g>` +
    `<rect x="20" y="20" width="4" height="22" rx="2" fill="url(#gradV)"/>` +
    text(32, 37, 'Resultados do Q3', { size: 17, weight: 700, fill: C.ink }) +
    text(32, 52, 'Diretoria · outubro de 2026', { size: 8, fill: C.slateDark }) +
    kpis
      .map(([label, value, delta, color], i) => {
        const cx = 20 + i * (cardW + 10);
        return (
          `<rect x="${cx}" y="66" width="${cardW}" height="62" rx="7" fill="${C.paper2}" stroke="${C.border}" stroke-width=".8"/>` +
          text(cx + 10, 81, label, { size: 7.5, fill: C.slateDark }) +
          text(cx + 10, 104, value, { size: 20, weight: 700, fill: C.ink }) +
          text(cx + 10, 119, delta, { size: 7.5, weight: 600, fill: color })
        );
      })
      .join('') +
    bars.map((v, i) => `<rect x="${20 + i * 40}" y="${184 - v * 0.55}" width="30" height="${v * 0.55}" rx="3" fill="url(#gradV)" opacity="${0.45 + i * 0.07}"/>`).join('') +
    `<path d="M20 184.5 H340" stroke="${C.border}"/>` +
    `</g>`
  );
};

// ─── Banner principal ────────────────────────────────────────────────────────
const bannerSvg = () => {
  const W = 1280;
  const H = 500;
  const code = [
    [['export default ', 'tag'], ['defineDeck', 'fn'], ['(() => (', 'punct']],
    [['  <', 'punct'], ['Slide', 'tag'], [' padding', 'attr'], ['={', 'punct'], ['48', 'num'], ['}', 'punct'], [' gap', 'attr'], ['={', 'punct'], ['20', 'num'], ['}>', 'punct']],
    [['    <', 'punct'], ['Text', 'tag'], [' fontSize', 'attr'], ['={', 'punct'], ['40', 'num'], ['}', 'punct'], [' fontWeight', 'attr'], ['=', 'punct'], ['"bold"', 'str'], ['>', 'punct']],
    [['      Resultados do Q3', 'plain']],
    [['    </', 'punct'], ['Text', 'tag'], ['>', 'punct']],
    [['    <', 'punct'], ['Box', 'tag'], [' display', 'attr'], ['=', 'punct'], ['"grid"', 'str'], [' gap', 'attr'], ['={', 'punct'], ['16', 'num'], ['}', 'punct']],
    [['      gridTemplateColumns', 'attr'], ['=', 'punct'], ['"repeat(3, 1fr)"', 'str'], ['>', 'punct']],
    [['      {', 'punct'], ['kpis', 'plain'], ['.', 'punct'], ['map', 'fn'], ['(', 'punct'], ['Kpi', 'tag'], [')}', 'punct']],
    [['    </', 'punct'], ['Box', 'tag'], ['>', 'punct']],
    [['  </', 'punct'], ['Slide', 'tag'], ['>', 'punct']],
    [['));', 'punct']],
  ];
  const word = brandWord(168, 172, 88, '#FFFFFF', 'grad');
  const body = [
    darkBackdrop(W, H),
    pill(72, 58, 'v1.0  ·  TypeScript  ·  MIT', { size: 12.5, h: 28, stroke: '#FFFFFF33', color: C.slate, weight: 'regular', fill: '#FFFFFF08' }).body,
    mark(72, 106, 78, 'm'),
    word.body,
    text(72, 252, 'Slides em TSX, layout em CSS,', { size: 34, weight: 700, fill: '#FFFFFF', spacing: -0.6 }),
    text(72, 294, 'PPTX nativo e editável.', { size: 34, weight: 700, fill: 'url(#grad)', spacing: -0.6 }),
    text(72, 338, 'Flexbox, grid e box model como props, sem coordenadas.', { size: 17, fill: C.slate }),
    text(72, 362, 'Um arquivo vira 16:9, 4:3 e wide, com diagnósticos legíveis.', { size: 17, fill: C.slate }),
    pillRow(72, 396, ['flex · grid', '12 gráficos nativos', 'diagnósticos', 'MCP para agentes'], { size: 13, h: 30, fill: '#FFFFFF0D', stroke: '#FFFFFF1F', color: '#DCE2F7' }),
    windowCard(612, 58, 486, 300, 'deck.tsx'),
    codeBlock(636, 126, code, { size: 13.5, lh: 21.5 }),
    slideMock(872, 262, 360),
    pill(1052, 240, '→ deck.16x9.pptx', { size: 12.5, h: 28, fill: 'url(#gradH)', color: '#FFFFFF', mono: true }).body,
  ].join('\n');
  const defs =
    darkDefs(W, H) +
    markDefs('m') +
    gradient('grad', { x1: 0, y1: 0, x2: 1, y2: 0 }) +
    gradient('gradH', { x1: 0, y1: 0, x2: 1, y2: 0 }) +
    gradient('gradV', { x1: 0, y1: 1, x2: 0, y2: 0 }) +
    shadow('cardShadow', 0.5, 14, 20, '#000000') +
    shadow('slideShadow', 0.45, 16, 18, '#000000');
  return svg(W, H, 'pptsx — slides em TSX, layout em CSS, PPTX nativo e editável', body, defs);
};

// ─── Banners dos pacotes ─────────────────────────────────────────────────────
const packageBanner = ({ name, tagline, sub, chips, art }) => {
  const W = 1280;
  const H = 300;
  const scope = brandWord(72, 128, 44, '#FFFFFF', 'grad');
  const body = [
    darkBackdrop(W, H),
    mark(72, 66, 48, 'm'),
    wordmark('pptsx', 132, 105, 34, (ch) => (ch === 's' ? 'url(#grad)' : '#FFFFFF')).body,
    text(132 + measure('pptsx', 34, 'bold', -1.2) + 8, 105, `/ ${name}`, { size: 34, weight: 700, fill: '#FFFFFF', spacing: -0.8 }),
    text(72, 168, tagline, { size: 24, weight: 700, fill: '#FFFFFF', spacing: -0.3 }),
    text(72, 200, sub, { size: 15.5, fill: C.slate }),
    pillRow(72, 226, chips, { size: 12.5, h: 28, fill: '#FFFFFF0D', stroke: '#FFFFFF1F', color: '#DCE2F7' }),
    art,
  ].join('\n');
  void scope;
  const defs = darkDefs(W, H) + markDefs('m') + gradient('grad', { x1: 0, y1: 0, x2: 1, y2: 0 }) + gradient('gradV', { x1: 0, y1: 1, x2: 0, y2: 0 }) + shadow('slideShadow', 0.45, 12, 14, '#000000') + shadow('cardShadow', 0.5, 12, 16, '#000000');
  return svg(W, H, `@pptsx/${name}`, body, defs);
};

/** Ilustração do ds-kit: tokens → variantes → componente. */
const kitArt = () => {
  const x = 800;
  const swatches = [C.ink, C.indigo, C.magenta, C.coral, '#F1F3FB'];
  const card = (cx, cy, fill, ink, label, value) =>
    `<g filter="url(#slideShadow)"><rect x="${cx}" y="${cy}" width="120" height="74" rx="10" fill="${fill}"/></g>` +
    text(cx + 14, cy + 24, label, { size: 10.5, fill: ink, opacity: 0.75 }) +
    text(cx + 14, cy + 56, value, { size: 26, weight: 700, fill: ink });
  return (
    text(x, 66, 'TOKENS', { size: 11, weight: 700, fill: C.slate, spacing: 2 }) +
    swatches.map((c, i) => `<rect x="${x + i * 46}" y="80" width="36" height="36" rx="9" fill="${c}" stroke="#FFFFFF" stroke-opacity=".18"/>`).join('') +
    text(x + 246, 104, 'font · space · color', { size: 12.5, fill: C.slate, family: MONO }) +
    text(x, 160, 'VARIANTES → COMPONENTE', { size: 11, weight: 700, fill: C.slate, spacing: 2 }) +
    card(x, 176, '#F1F3FB', C.ink, 'tone="neutral"', '52,4') +
    card(x + 136, 176, 'url(#grad)', '#FFFFFF', 'tone="strong"', '62') +
    `<g filter="url(#slideShadow)"><rect x="${x + 272}" y="176" width="120" height="74" rx="10" fill="${C.ink3}" stroke="#FFFFFF" stroke-opacity=".14"/></g>` +
    text(x + 286, 200, 'size="lg"', { size: 10.5, fill: '#DCE2F7', opacity: 0.8 }) +
    text(x + 286, 236, '1.284', { size: 28, weight: 700, fill: '#FFFFFF' })
  );
};

/** Ilustração do ds-base: três slides da marca de exemplo em leque. */
const baseArt = () => {
  const mini = (tx, ty, rot, bg, ink, accent, title) =>
    `<g transform="translate(${tx} ${ty}) rotate(${rot})">` +
    `<g filter="url(#slideShadow)"><rect width="240" height="135" rx="9" fill="${bg}"/></g>` +
    `<rect x="16" y="18" width="4" height="18" rx="2" fill="${accent}"/>` +
    text(28, 32, title, { size: 13, weight: 700, fill: ink }) +
    [0, 1, 2].map((i) => `<rect x="${16 + i * 72}" y="52" width="64" height="40" rx="6" fill="${ink}" opacity=".08"/><rect x="${24 + i * 72}" y="62" width="30" height="5" rx="2.5" fill="${ink}" opacity=".35"/><rect x="${24 + i * 72}" y="74" width="40" height="10" rx="3" fill="${accent}"/>`).join('') +
    `<rect x="16" y="104" width="208" height="5" rx="2.5" fill="${ink}" opacity=".12"/><rect x="16" y="104" width="130" height="5" rx="2.5" fill="${accent}"/>` +
    `</g>`;
  return mini(780, 92, -8, '#FFFFFF', '#1B2A4A', '#2F6FED', 'Resultados do trimestre') + mini(900, 70, 2, '#1B2A4A', '#FFFFFF', '#5A8BFF', 'Indicadores') + mini(1000, 120, 9, '#F4F6FA', '#1B2A4A', '#1E9E6A', 'Próximos passos');
};

// ─── Ícones das funcionalidades ──────────────────────────────────────────────
const ICON_GLYPHS = {
  css: '<rect x="16" y="16" width="14" height="14" rx="3"/><rect x="34" y="16" width="14" height="14" rx="3" opacity=".7"/><rect x="16" y="34" width="32" height="14" rx="3" opacity=".85"/>',
  responsive: '<rect x="12" y="20" width="28" height="18" rx="3" fill="none" stroke="#fff" stroke-width="3.4"/><rect x="31" y="27" width="21" height="17" rx="3" fill="#fff"/>',
  native: '<rect x="15" y="34" width="8" height="14" rx="2"/><rect x="28" y="24" width="8" height="24" rx="2"/><rect x="41" y="16" width="8" height="32" rx="2"/>',
  diagnostics: '<circle cx="29" cy="29" r="12" fill="none" stroke="#fff" stroke-width="3.6"/><line x1="38" y1="38" x2="48" y2="48" stroke="#fff" stroke-width="4" stroke-linecap="round"/><circle cx="29" cy="29" r="4"/>',
  ds: '<path d="M32 13 L50 22 L32 31 L14 22 Z"/><path d="M14 31 L32 40 L50 31" fill="none" stroke="#fff" stroke-width="3.4" stroke-linejoin="round" stroke-linecap="round" opacity=".85"/><path d="M14 40 L32 49 L50 40" fill="none" stroke="#fff" stroke-width="3.4" stroke-linejoin="round" stroke-linecap="round" opacity=".65"/>',
  agents: '<path d="M30 12 C31.5 22 34 24.5 44 26 C34 27.5 31.5 30 30 40 C28.5 30 26 27.5 16 26 C26 24.5 28.5 22 30 12 Z"/><path d="M45 36 C45.8 41 47 42.2 52 43 C47 43.8 45.8 45 45 50 C44.2 45 43 43.8 38 43 C43 42.2 44.2 41 45 36 Z" opacity=".75"/>',
};
const iconSvg = (key) => svg(64, 64, key, `<rect width="64" height="64" rx="16" fill="url(#t)"/><g fill="#FFFFFF">${ICON_GLYPHS[key]}</g>`, gradient('t', { x1: 0, y1: 0, x2: 64, y2: 64, units: 'userSpaceOnUse' }));

// ─── Cartão claro comum aos diagramas ────────────────────────────────────────
const lightCard = (w, h) => `<rect width="${w}" height="${h}" rx="22" fill="${C.paper2}"/><rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="21.5" fill="none" stroke="${C.border}"/>`;
const eyebrow = (x, y, label, fill = C.slateDark) => text(x, y, label, { size: 12, weight: 700, fill, spacing: 1.8 });
const numBadge = (cx, cy, n, r = 13) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#grad)"/>` + text(cx, cy + 4.5, String(n), { size: 13, weight: 700, fill: '#FFFFFF', anchor: 'middle' });

const stageCard = (x, y, w, h, { n, title, lines, dark = false }) =>
  `<g filter="url(#sh)"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="${dark ? C.ink : C.paper}"/></g>` +
  (dark ? '' : `<rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" rx="15.5" fill="none" stroke="${C.border}"/>`) +
  (n !== undefined ? numBadge(x + w - 24, y + 26, n) : '') +
  text(x + 20, y + 33, title, { size: 19, weight: 700, fill: dark ? '#FFFFFF' : C.ink, spacing: -0.3 }) +
  `<rect x="${x + 20}" y="${y + 44}" width="28" height="3.5" rx="1.75" fill="url(#grad)"/>` +
  lines.map((line, i) => text(x + 20, y + 72 + i * 21, fits(line, 13, w - 36), { size: 13, fill: dark ? '#C3CAE6' : C.slateDark })).join('');

// Pontas de seta como polígono explícito, nunca <marker>: `orient="auto-start-reverse"` não renderiza em
// todo visualizador (o painel do app mostrava as setas quebradas), e um polígono sai igual em qualquer lugar.
const HEAD_LENGTH = 11;
const HEAD_HALF_WIDTH = 5;
/** Último ponto e a direção de chegada de um `d` com comandos absolutos M, L, H, V e C. */
const pathEndOf = (d) => {
  const tokens = d.match(/[MLHVC]|-?\d*\.?\d+/g) || [];
  let command = 'M';
  let point = null;
  let previous = null;
  for (let i = 0; i < tokens.length; ) {
    const token = tokens[i];
    if (/^[MLHVC]$/.test(token)) { command = token; i += 1; continue; }
    const read = (n) => tokens.slice(i, i + n).map(Number);
    if (command === 'H') { previous = point; point = { x: read(1)[0], y: point.y }; i += 1; continue; }
    if (command === 'V') { previous = point; point = { x: point.x, y: read(1)[0] }; i += 1; continue; }
    if (command === 'C') { const [, , x2, y2, x, y] = read(6); previous = { x: x2, y: y2 }; point = { x, y }; i += 6; continue; }
    const [x, y] = read(2); previous = point; point = { x, y }; i += 2;
  }
  return { point, previous };
};
const headOf = (d, color) => {
  const { point, previous } = pathEndOf(d);
  if (!point || !previous) return '';
  const dx = point.x - previous.x, dy = point.y - previous.y;
  const n = Math.hypot(dx, dy) || 1, ux = dx / n, uy = dy / n;
  const bx = point.x - ux * HEAD_LENGTH, by = point.y - uy * HEAD_LENGTH;
  const px = -uy, py = ux;
  const pt = (x, y) => `${round(x)},${round(y)}`;
  return `<polygon points="${pt(point.x, point.y)} ${pt(bx + px * HEAD_HALF_WIDTH, by + py * HEAD_HALF_WIDTH)} ${pt(bx - px * HEAD_HALF_WIDTH, by - py * HEAD_HALF_WIDTH)}" fill="${color}"/>`;
};
const round = (v) => Math.round(v * 100) / 100;
const arrowPath = (d, { color = C.slate, dashed = false, width = 2, head = true } = {}) =>
  `<path d="${d}" stroke="${color}" stroke-width="${width}" fill="none" stroke-linecap="round"${dashed ? ' stroke-dasharray="5 5"' : ''}/>` + (head ? headOf(d, color) : '');
const arrow = (x1, y1, x2, y2, options = {}) => arrowPath(`M${x1} ${y1} L${x2} ${y2}`, options);
const arrowHead = () => '';

const diagramDefs = () => gradient('grad') + gradient('gradH', { x1: 0, y1: 0, x2: 1, y2: 0 }) + shadow('sh', 0.08, 4, 8) + arrowHead();

const typeTag = (cx, y, label) => {
  const w = monoWidth(label, 12) + 20;
  return `<rect x="${cx - w / 2}" y="${y}" width="${w}" height="24" rx="6" fill="${C.mist}" stroke="${C.border}"/>` + text(cx, y + 16.5, label, { size: 12, fill: C.indigo, anchor: 'middle', family: MONO });
};

// ─── Pipeline ────────────────────────────────────────────────────────────────
const pipelineSvg = () => {
  const W = 1280;
  const H = 690;
  const cw = 184;
  const top = 160;
  const ch = 214;
  const xs = [44, 256, 468, 680];
  const stages = [
    { n: 1, title: 'deck.tsx', lines: ['defineDeck(ctx => …)', 'JSX próprio, sem React', 'roda 1× por tamanho', 'ctx.pick · ctx.scale'] },
    { n: 2, title: 'resolve', lines: ['componentes → nós', 'shorthands e cascata', 'herança de texto', 'breakpoints e path'] },
    { n: 3, title: 'layout', lines: ['Yoga (flex, WASM)', 'motor de grid próprio', 'texto via fontkit', 'frames em pt'] },
    { n: 4, title: 'fit', lines: ['shrink por escopo', 'truncate e paginate', 'refaz o layout', 'diagnóstico + causa'] },
  ];
  const types = ['SlideElement', 'ResolvedDeck', 'PositionedDeck', 'PositionedDeck'];
  const ex = 900;
  const ew = 166;
  const ox = 1090;
  const ow = 150;
  const outs = [
    ['.pptx', 'nativo e editável'],
    ['PNG + overview', 'um por slide'],
    ['diagnostics.json', 'code · path · message'],
  ];
  const zoneBottom = top + ch + 112;
  const body = [
    lightCard(W, H),
    eyebrow(44, 50, 'COMO UM DECK VIRA PPTX'),
    text(44, 82, 'Um passe por tamanho de slide; cada etapa é uma função pura: árvore entra, árvore sai.', { size: 17, fill: C.ink, weight: 600 }),
    pillRow(W - 44 - 236, 34, ['16x9', '4x3', '16x10', 'wide'], { size: 12, h: 26, fill: C.paper, stroke: C.border, color: C.slateDark, mono: true }, 6),
    // Zona pura
    `<rect x="236" y="${top - 26}" width="${ex + ew + 14 - 236}" height="${zoneBottom - top + 26}" rx="18" fill="${C.indigo}" fill-opacity=".04" stroke="${C.indigo}" stroke-opacity=".35" stroke-dasharray="6 6"/>`,
    text(256, zoneBottom - 16, 'NÚCLEO PURO · sem IO, sem estado global, dependências injetadas (LayoutEnv)', { size: 11.5, weight: 700, fill: C.indigo, spacing: 1.2 }),
    ...stages.map((s, i) => stageCard(xs[i], top, cw, ch, { ...s, dark: i === 0 })),
    ...types.map((t, i) => typeTag(xs[i] + cw / 2, top + ch + 14, t)),
    ...xs.slice(0, 3).map((x, i) => arrow(x + cw + 4, top + 96, xs[i + 1] - 6, top + 96)),
    // layout ⇄ fit
    arrowPath(`M${xs[3] + 50} ${top - 4} C ${xs[3] + 20} ${top - 40}, ${xs[2] + cw - 20} ${top - 40}, ${xs[2] + cw - 50} ${top - 6}`, { color: C.magenta }),
    `<rect x="${(xs[2] + cw + xs[3]) / 2 - 52}" y="${top - 46}" width="104" height="22" rx="11" fill="${C.paper}" stroke="${C.magenta}" stroke-opacity=".5"/>`,
    text((xs[2] + cw + xs[3]) / 2, top - 31, 'até 12 rodadas', { size: 11.5, weight: 600, fill: C.magenta, anchor: 'middle' }),
    // emit + preview
    stageCard(ex, top, ew, 100, { n: 5, title: 'emit', lines: ['pptxgenjs', 'XML corrigido'] }),
    stageCard(ex, top + 114, ew, 100, { n: 6, title: 'preview', lines: ['frames → SVG', 'resvg → PNG'] }),
    arrow(xs[3] + cw + 4, top + 96, ex - 6, top + 50),
    arrow(xs[3] + cw + 4, top + 96, ex - 6, top + 164),
    // Saídas
    eyebrow(ox, top - 10, 'SAÍDAS'),
    ...outs.map(([name, desc], i) => {
      const y = top + 4 + i * 72;
      return (
        `<rect x="${ox}" y="${y}" width="${ow}" height="60" rx="12" fill="${C.paper}" stroke="${C.border}"/>` +
        `<rect x="${ox}" y="${y}" width="4" height="60" rx="2" fill="url(#grad)"/>` +
        text(ox + 14, y + 25, name, { size: 12.5, weight: 700, fill: C.ink, family: MONO }) +
        text(ox + 14, y + 45, fits(desc, 11.5, ow - 22), { size: 11.5, fill: C.slateDark })
      );
    }),
    arrow(ex + ew + 4, top + 34, ox - 6, top + 34),
    arrow(ex + ew + 4, top + 148, ox - 6, top + 106),
    arrowPath(`M${xs[3] + cw - 14} ${top + ch} V ${top + ch + 62} H ${ox - 18} V ${top + 178} H ${ox - 6}`, { dashed: true }),
    // Estratégias
    eyebrow(44, 524, 'ESTRATÉGIAS DE CÓDIGO'),
    ...[
      ['Funções puras', 'árvore entra, árvore sai', 'dados readonly, sem classes'],
      ['IO só nas bordas', 'fontes, imagens e arquivos', 'em render.ts e cli.ts'],
      ['Despacho por kind', 'um emissor por primitiva;', 'Strategy para medidores'],
      ['Determinístico', 'zip renumerado:', 'mesmo deck, mesmos bytes'],
    ].map(([title, l1, l2], i) => {
      const x = 44 + i * 300;
      return (
        `<rect x="${x}" y="540" width="288" height="112" rx="14" fill="${C.paper}" stroke="${C.border}"/>` +
        numBadge(x + 32, 572, '✓', 12) +
        text(x + 54, 577, title, { size: 15.5, weight: 700, fill: C.ink }) +
        text(x + 20, 610, fits(l1, 13, 252), { size: 13, fill: C.slateDark }) +
        text(x + 20, 630, fits(l2, 13, 252), { size: 13, fill: C.slateDark })
      );
    }),
  ].join('\n');
  return svg(W, H, 'pptsx: pipeline de renderização', body, diagramDefs());
};

// ─── Ecossistema ─────────────────────────────────────────────────────────────
const ecosystemSvg = () => {
  const W = 1280;
  const H = 660;
  const layer = (y, h, { title, sub, chips, dark = false, dashed = false, x = 44, w = W - 88 }) =>
    `<g filter="url(#sh)"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="${dark ? C.ink : C.paper}"${dashed ? ` stroke="${C.slate}" stroke-dasharray="6 6"` : ''}/></g>` +
    (dark || dashed ? '' : `<rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" rx="17.5" fill="none" stroke="${C.border}"/>`) +
    text(x + 24, y + 36, title, { size: 20, weight: 700, fill: dark ? '#FFFFFF' : C.ink, family: title.startsWith('@') || title === 'pptsx' ? MONO : undefined }) +
    text(x + 24, y + 60, sub, { size: 13.5, fill: dark ? '#AEB6D6' : C.slateDark }) +
    (chips ? pillRow(x + 24, y + 76, chips, { size: 12.5, h: 28, fill: dark ? '#FFFFFF10' : C.mist, stroke: dark ? '#FFFFFF22' : C.border, color: dark ? '#E3E8FA' : C.ink, mono: true }, 7) : '');
  const hooks = ['defineComponent', 'LintRule', 'renderFragment', 'defineDs'];
  const consumers = [
    ['CLI', 'build · init · lint · preview'],
    ['API', 'render(deck, { sizes })'],
    ['MCP', 'pptsx-mcp para agentes'],
    ['Skill', 'Claude e Copilot'],
    ['Arquivo único', 'pptsx.mjs, sem npm'],
  ];
  const body = [
    lightCard(W, H),
    eyebrow(44, 50, 'O ECOSSISTEMA'),
    text(44, 82, 'Como o React é a base de bibliotecas de componentes, o pptsx é a base de design systems.', { size: 17, fill: C.ink, weight: 600 }),
    layer(108, 92, { title: '@pptsx/ds-base', sub: 'DS de exemplo: tokens, tema, layouts, componentes, regras e a galeria', w: 560 }),
    layer(108, 92, { title: '@sua-marca/ds', sub: 'o seu design system, só com a API pública', x: 676, w: 560, dashed: true }),
    layer(222, 118, { title: '@pptsx/ds-kit', sub: 'ferramentas para criar um DS em cima do núcleo', chips: ['defineTokens', 'themeOf', 'createVariants', 'slot', 'regras prontas', 'catálogo', 'createDs', 'pptsx-ds'] }),
    // Ganchos
    text(W / 2, 374, 'API PÚBLICA · GANCHOS DO NÚCLEO', { size: 11.5, weight: 700, fill: C.magenta, anchor: 'middle', spacing: 1.6 }),
    (() => {
      const widths = hooks.map((h) => monoWidth(h, 13) + 30);
      const total = widths.reduce((a, b) => a + b, 0) + 12 * (hooks.length - 1);
      let x = (W - total) / 2;
      return hooks.map((h, i) => { const p = pill(x, 386, h, { size: 13, h: 30, fill: C.paper, stroke: C.magenta, color: C.magenta, mono: true, pad: 15 }); x += widths[i] + 12; return p.body; }).join('');
    })(),
    layer(434, 118, { title: 'pptsx', sub: 'o núcleo, sem marca: render puro de TSX para PPTX', chips: ['primitivas', 'resolve', 'layout', 'fit', 'diagnósticos', 'emit PPTX', 'preview PNG', 'lint'], dark: true }),
    // Consumidores
    ...consumers.map(([title, desc], i) => {
      const w = 228;
      const x = 44 + i * (w + 10);
      return `<rect x="${x}" y="572" width="${w}" height="60" rx="12" fill="${C.paper}" stroke="${C.border}"/>` + `<rect x="${x}" y="572" width="${w}" height="4" rx="2" fill="url(#gradH)"/>` + text(x + 16, 598, title, { size: 14.5, weight: 700, fill: C.ink }) + text(x + 16, 619, fits(desc, 12.5, w - 24), { size: 12.5, fill: C.slateDark });
    }),
  ].join('\n');
  return svg(W, H, 'pptsx: o núcleo, o kit de design system e o DS de exemplo', body, diagramDefs());
};

// ─── Loop de ajuste ──────────────────────────────────────────────────────────
const fitLoopSvg = () => {
  const W = 1280;
  const H = 470;
  const node = (x, y, w, h, title, sub, { dark = false, accent } = {}) =>
    `<g filter="url(#sh)"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${dark ? C.ink : C.paper}"/></g>` +
    (dark ? '' : `<rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" rx="13.5" fill="none" stroke="${accent ?? C.border}"/>`) +
    text(x + w / 2, y + h / 2 - 3, title, { size: 15.5, weight: 700, fill: dark ? '#FFFFFF' : C.ink, anchor: 'middle' }) +
    text(x + w / 2, y + h / 2 + 18, sub, { size: 12, fill: dark ? '#AEB6D6' : C.slateDark, anchor: 'middle' });
  const diamond = (cx, cy, rw, rh, label1, label2) =>
    `<g filter="url(#sh)"><path d="M${cx} ${cy - rh} L${cx + rw} ${cy} L${cx} ${cy + rh} L${cx - rw} ${cy} Z" fill="${C.paper}" stroke="${C.magenta}" stroke-width="1.5"/></g>` +
    text(cx, cy - 3, label1, { size: 13.5, weight: 700, fill: C.ink, anchor: 'middle' }) +
    text(cx, cy + 15, label2, { size: 12, fill: C.slateDark, anchor: 'middle' });
  const tag = (x, y, label, color = C.slateDark) => text(x, y, label, { size: 12, weight: 700, fill: color, anchor: 'middle' });
  const codes = [['text-shrunk', C.indigo], ['slide-continued', C.indigo], ['text-truncated', C.amber], ['text-overflow', C.red], ['box-overflow', C.red]];
  const body = [
    lightCard(W, H),
    eyebrow(44, 50, 'O LOOP DE AJUSTE (fit)'),
    text(44, 82, 'Cada tentativa é um layout completo; o shrink é uma busca binária por escopo de componente.', { size: 17, fill: C.ink, weight: 600 }),
    node(44, 130, 170, 76, 'slide resolvido', 'por tamanho', { dark: true }),
    diamond(330, 168, 92, 54, 'Box paginate', 'não cabe?'),
    node(470, 130, 170, 76, 'layout', 'Yoga + grid + texto'),
    diamond(780, 168, 100, 58, 'algum Text', 'estourou?'),
    node(1040, 130, 196, 76, 'diagnósticos', 'com path e causedBy', { dark: true }),
    arrow(214, 168, 236, 168),
    arrow(422, 168, 464, 168),
    tag(443, 158, 'não'),
    arrow(640, 168, 678, 168),
    arrow(880, 168, 1034, 168),
    tag(957, 158, 'não'),
    // paginate
    node(245, 270, 170, 70, 'clona o slide', 'título, fundo, rodapé'),
    arrow(330, 222, 330, 264),
    tag(346, 248, 'sim'),
    arrowPath('M415 305 H 520 V 212', {}),
    // shrink
    node(695, 270, 170, 70, 'shrink por escopo', 'busca binária da fonte', { accent: C.magenta }),
    arrow(780, 226, 780, 264),
    tag(796, 248, 'sim'),
    arrowPath('M695 305 H 600 V 212', { color: C.magenta }),
    text(648, 326, '< 12 rodadas', { size: 11.5, weight: 600, fill: C.magenta, anchor: 'middle' }),
    node(935, 270, 170, 70, 'truncate / erro', 'quando minSize não basta', { accent: C.red }),
    arrowPath('M865 305 H 929', { color: C.red, dashed: true }),
    arrowPath('M1105 305 H 1138 V 212', { dashed: true }),
    // Códigos
    eyebrow(44, 400, 'CÓDIGOS QUE SAEM DAQUI'),
    ...(() => {
      let x = 44;
      return codes.map(([c, color]) => { const p = pill(x, 414, c, { size: 12.5, h: 28, fill: C.paper, stroke: color, color: C.ink, mono: true }); x += p.w + 8; return p.body; });
    })(),
    text(W - 44, 432, 'azul = info · âmbar = warning · vermelho = error', { size: 12, fill: C.slateDark, anchor: 'end' }),
  ].join('\n');
  return svg(W, H, 'pptsx: loop de ajuste (paginate, layout, shrink, truncate, diagnósticos)', body, diagramDefs());
};

// ─── De/para CSS → PPTX ──────────────────────────────────────────────────────
const cssToPptxSvg = () => {
  const W = 1280;
  const H = 560;
  const cols = [
    { title: 'Sai nativo', color: C.green, mark: '✓', items: ['backgroundColor · rgba', 'border sólida, tracejada, pontilhada', 'bordas por lado · borderRadius', 'boxShadow (uma, externa)', 'opacity · rotate · translate · zIndex', 'backgroundImage url() · objectFit', 'fonte, peso 100–900, itálico, cor', 'rich text, links, sobrescrito', 'Chart (12 kinds) · Table', '24 formas · Path · Icon · Connector'] },
    { title: 'Sai com diferença', color: C.amber, mark: '≈', items: ['fundo/borda de Text = forma atrás', 'opacity por forma, não por grupo', 'letterSpacing desliga o kerning', 'lineHeight no Keynote (± 2 pt)', 'Icon com gradiente vira imagem'] },
    { title: 'Avisa: css-not-emitted', color: C.red, mark: '!', items: ['overflow: hidden', 'gradiente · filter · textShadow', 'transform: scale / skew / matrix', 'sombra inset, spread ou múltipla', 'raio diferente por canto', 'auto-fill e áreas nomeadas no grid'] },
  ];
  const cw = 384;
  const body = [
    lightCard(W, H),
    eyebrow(44, 50, 'DE/PARA CSS → PPTX'),
    text(44, 82, 'O preview desenha só o que o .pptx tem: o PNG nunca promete mais do que o arquivo entrega.', { size: 17, fill: C.ink, weight: 600 }),
    ...cols.map((col, i) => {
      const x = 44 + i * (cw + 20);
      return (
        `<g filter="url(#sh)"><rect x="${x}" y="108" width="${cw}" height="${H - 140}" rx="16" fill="${C.paper}"/></g>` +
        `<rect x="${x + 0.5}" y="108.5" width="${cw - 1}" height="${H - 141}" rx="15.5" fill="none" stroke="${C.border}"/>` +
        `<path d="M${x} 124 a16 16 0 0 1 16 -16 h${cw - 32} a16 16 0 0 1 16 16 v6 h-${cw} z" fill="${col.color}"/>` +
        `<circle cx="${x + 34}" cy="164" r="16" fill="${col.color}" fill-opacity=".14"/>` +
        text(x + 34, 170, col.mark, { size: 17, weight: 700, fill: col.color, anchor: 'middle' }) +
        text(x + 60, 170, col.title, { size: 18, weight: 700, fill: C.ink }) +
        col.items.map((item, j) => `<circle cx="${x + 30}" cy="${210 + j * 31}" r="3.5" fill="${col.color}"/>` + text(x + 44, 215 + j * 31, item, { size: 14, fill: C.ink })).join('')
      );
    }),
  ].join('\n');
  return svg(W, H, 'pptsx: de/para CSS → PPTX', body, diagramDefs());
};

// ─── Ciclo de um DS (ds-kit) ─────────────────────────────────────────────────
const dsFlowSvg = () => {
  const W = 1280;
  const H = 272;
  const steps = [
    ['Montar', 'pptsx-ds init'],
    ['Tokens e tema', 'tokens.ts · theme.ts'],
    ['Componente', 'StatCard.tsx'],
    ['Regras', 'rules.ts'],
    ['Manifesto', 'ds.ts'],
    ['Usar num deck', 'deck.tsx'],
    ['Conferir', 'lint · catalog'],
    ['Publicar', 'npm · skill'],
  ];
  const step = (W - 88) / steps.length;
  const cy = 150;
  const body = [
    lightCard(W, H),
    eyebrow(44, 50, 'COMO UM DESIGN SYSTEM NASCE'),
    text(44, 82, 'A ordem desta página: cada passo é um arquivo, e os trechos formam um DS que compila.', { size: 17, fill: C.ink, weight: 600 }),
    `<rect x="${44 + step / 2}" y="${cy - 2}" width="${step * (steps.length - 1)}" height="4" rx="2" fill="url(#gradH)"/>`,
    ...steps.map(([title, file], i) => {
      const cx = 44 + step / 2 + i * step;
      return (
        `<circle cx="${cx}" cy="${cy}" r="24" fill="${C.paper}" stroke="url(#grad)" stroke-width="3"/>` +
        text(cx, cy + 6, String(i + 1), { size: 17, weight: 700, fill: C.ink, anchor: 'middle' }) +
        text(cx, cy + 56, title, { size: 15, weight: 700, fill: C.ink, anchor: 'middle' }) +
        text(cx, cy + 80, file, { size: 12, fill: C.indigo, anchor: 'middle', family: MONO })
      );
    }),
  ].join('\n');
  return svg(W, H, '@pptsx/ds-kit: os passos de um design system', body, diagramDefs());
};

// ─── Paletas ─────────────────────────────────────────────────────────────────
/** Faixa de amostras: nome, hex e (opcional) papel de cada cor. */
const paletteSvg = (title, entries) => {
  const W = 1280;
  const gap = 12;
  const cw = (W - 88 - gap * (entries.length - 1)) / entries.length;
  const H = 228;
  const body = [
    lightCard(W, H),
    eyebrow(44, 50, title),
    ...entries.map(([name, hex, role], i) => {
      const x = 44 + i * (cw + gap);
      return (
        `<rect x="${x}" y="72" width="${cw}" height="84" rx="12" fill="${hex}" stroke="${C.border}"/>` +
        text(x + 2, 182, fits(name, 14, cw, 'semibold'), { size: 14, weight: 600, fill: C.ink }) +
        text(x + 2, 202, hex.toUpperCase() + (role ? ` · ${role}` : ''), { size: 11.5, fill: C.slateDark, family: MONO })
      );
    }),
  ].join('\n');
  return svg(W, H, title, body, diagramDefs());
};

const brandPalette = () =>
  paletteSvg('PALETA DA MARCA PPTSX', [
    ['Ink', C.ink, 'fundo'],
    ['Índigo', C.indigo, 'TSX'],
    ['Magenta', C.magenta, 'meio'],
    ['Coral', C.coral, 'PPTX'],
    ['Slate', C.slateDark, 'texto'],
    ['Mist', C.mist, 'superfície'],
  ]);

// As cores do ds-base vêm do próprio tokens.ts, para a faixa não divergir do DS.
const dsBasePalette = () => {
  const source = readFileSync(join(repo, 'packages/ds-base/src/tokens.ts'), 'utf8');
  const block = source.match(/color:\s*\{([\s\S]*?)\}/)?.[1] ?? '';
  const entries = [...block.matchAll(/(\w+):\s*'(#[0-9A-Fa-f]{6})'/g)].map(([, name, hex]) => [name, hex]);
  const unique = entries.filter(([, hex], i) => entries.findIndex(([, h]) => h === hex) === i);
  return paletteSvg('TOKENS DE COR DO @pptsx/ds-base', unique);
};

// ─── Por dentro: diagramas dos mecanismos internos ───────────────────────────
const head = (label, line) => eyebrow(44, 50, label) + text(44, 82, line, { size: 17, fill: C.ink, weight: 600 });
const insideDefs = () => diagramDefs() + gradient('gradV', { x1: 0, y1: 1, x2: 0, y2: 0 }) + shadow('cardShadow', 0.28, 10, 14, '#0B1020') + shadow('slideShadow', 0.14, 5, 8, '#0B1020');
const panel = (x, y, w, h, { fill = C.paper, stroke = C.border, rx = 16, dashed = false, opacity } = {}) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"${opacity !== undefined ? ` fill-opacity="${opacity}"` : ''} stroke="${stroke}"${dashed ? ' stroke-dasharray="6 6"' : ''}/>`;
const small = (x, y, s, opts = {}) => text(x, y, s, { size: 12.5, fill: C.slateDark, ...opts });
const mono = (x, y, s, opts = {}) => text(x, y, s, { size: 12.5, fill: C.ink, family: MONO, ...opts });
const panelTitle = (x, y, s, fill = C.slateDark) => text(x, y, s, { size: 11.5, weight: 700, fill, spacing: 1.6 });

/** Quebra gulosa com as métricas da Inter: as mesmas contas que a engine faz, em miniatura. */
const wrap = (str, size, maxW, weight = 'regular') =>
  str.split(' ').reduce((lines, word) => {
    const last = lines.at(-1);
    if (last !== undefined && measure(`${last} ${word}`, size, weight) <= maxW) return [...lines.slice(0, -1), `${last} ${word}`];
    return [...lines, word];
  }, []);

/** Mini slide: moldura, barra de título, itens (ponto + barra) e rodapé. */
const miniSlide = (x, y, w, h, { items = [], title = true, footer = true, highlight = false, ghost = [] } = {}) => {
  const row = 15;
  const itemRow = (n, i, color = C.indigo, bar = C.mist, dashed = false) => {
    const yy = y + 34 + i * row;
    return `<circle cx="${x + 16}" cy="${yy}" r="3" fill="${color}"/>` +
      `<rect x="${x + 25}" y="${yy - 3.5}" width="${w * 0.55 + (n % 3) * 14}" height="7" rx="3.5" fill="${bar}"${dashed ? ` stroke="${C.red}" stroke-dasharray="3 3"` : ''}/>` +
      text(x + w - 14, yy + 3.5, String(n), { size: 9, fill: C.slateDark, anchor: 'end', family: MONO });
  };
  return (
    `<g filter="url(#slideShadow)"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="#FFFFFF"/></g>` +
    `<rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" rx="5.5" fill="none" stroke="${C.border}"/>` +
    (title ? `<rect x="${x + 12}" y="${y + 10}" width="4" height="12" rx="2" fill="url(#grad)"/><rect x="${x + 21}" y="${y + 12}" width="${w * 0.45}" height="8" rx="4" fill="${C.ink}" opacity=".8"/>` : '') +
    (highlight && title ? `<rect x="${x + 6}" y="${y + 5}" width="${w * 0.45 + 22}" height="22" rx="5" fill="none" stroke="${C.magenta}" stroke-width="1.5"/>` : '') +
    items.map((n, i) => itemRow(n, i)).join('') +
    ghost.map((n, i) => itemRow(n, items.length + i, C.red, '#FDE4E8', true)).join('') +
    (footer ? `<rect x="${x + 12}" y="${y + h - 12}" width="${w * 0.35}" height="4" rx="2" fill="${C.slate}" opacity=".6"/>` : '') +
    (highlight && footer ? `<rect x="${x + 6}" y="${y + h - 17}" width="${w * 0.35 + 12}" height="14" rx="4" fill="none" stroke="${C.magenta}" stroke-width="1.5"/>` : '')
  );
};

// 1. A mesma árvore em três estados
const treeStagesSvg = () => {
  const W = 1280;
  const H = 600;
  const cols = [
    { title: 'JSX', type: 'SlideElement', rows: [[0, 'Slide', 'padding={40} gap={20}'], [1, 'Text', 'fontSize={32}'], [1, 'KpiRow', 'items={kpis}'], [2, '( )', 'componente: ainda uma função', true]], note: 'jsx() só cria objetos congelados: nada foi calculado ainda' },
    { title: 'resolvido', type: 'ResolvedDeck', rows: [[0, 'Slide', 'padding 40 · 40 · 40 · 40'], [1, 'Text', '32 pt · cor herdada'], [1, 'KpiRow > Box', 'display: grid'], [2, 'KpiCard[0] > Box', 'gap 4'], [3, 'Text', 'rótulo'], [3, 'Text[1]', 'valor', false, true], [2, 'KpiCard[1] > Box', '…']] },
    { title: 'posicionado', type: 'PositionedDeck', rows: [[0, 'Slide', '0, 0 · 720 × 405'], [1, 'Text', '40, 40 · 640 × 38'], [1, 'Box', '40, 98 · 640 × 267'], [2, 'Box', '40, 98 · 203 × 267'], [3, 'Text', '58, 116 · 167 × 17'], [3, 'Text[1]', '58, 137 · 167 × 46', false, true], [2, 'Box', '259, 98 · 203 × 267']] },
  ];
  const cw = 360;
  const gap = 56;
  const top = 116;
  const ch = 360;
  const column = ({ title, type, rows, note }, i) => {
    const x = 44 + i * (cw + gap);
    const y0 = top + 86;
    return (
      `<g filter="url(#sh)">${panel(x, top, cw, ch, { fill: i === 0 ? C.ink : C.paper, stroke: i === 0 ? C.ink : C.border })}</g>` +
      numBadge(x + 30, top + 32, i + 1) +
      text(x + 52, top + 38, title, { size: 18, weight: 700, fill: i === 0 ? '#FFFFFF' : C.ink }) +
      mono(x + cw - 20, top + 37, type, { fill: i === 0 ? '#9DB0FF' : C.indigo, anchor: 'end' }) +
      `<path d="M${x + 20} ${top + 56} H${x + cw - 20}" stroke="${i === 0 ? '#FFFFFF22' : C.border}"/>` +
      rows
        .map(([d, name, detail, ghost, hot], r) => {
          const ry = y0 + r * 38;
          const ix = x + 20 + d * 20;
          const w = monoWidth(name, 12.5) + 18;
          const dark = i === 0;
          const guide = d > 0 ? `<path d="M${ix - 13} ${ry - 26} V${ry - 4} H${ix - 3}" fill="none" stroke="${dark ? '#FFFFFF33' : C.slate}" stroke-opacity=".7"/>` : '';
          const chip = `<rect x="${ix}" y="${ry - 16}" width="${w}" height="24" rx="6" fill="${ghost ? 'none' : dark ? '#FFFFFF14' : hot ? '#EEF0FF' : C.mist}" stroke="${hot ? C.indigo : ghost ? C.slate : dark ? '#FFFFFF22' : C.border}"${ghost ? ' stroke-dasharray="4 4"' : ''}/>`;
          return guide + chip + mono(ix + 9, ry + 0.5, name, { fill: dark ? '#E3E8FA' : hot ? C.indigo : C.ink, weight: 600 }) + text(x + cw - 20, ry + 0.5, detail, { size: 12, fill: dark ? '#AEB6D6' : C.slateDark, anchor: 'end' });
        })
        .join('') +
      (note ? wrap(note, 13, cw - 40).map((l, j) => small(x + 20, top + ch - 46 + j * 19, l, { fill: '#AEB6D6', size: 13 })).join('') : '')
    );
  };
  const arrows = [0, 1].map((i) => {
    const x = 44 + (i + 1) * cw + i * gap;
    return arrow(x + 4, top + 180, x + gap - 6, top + 180, { color: C.magenta, width: 2.5 }) + text(x + gap / 2, top + 166, i === 0 ? 'resolve' : 'layout', { size: 11, weight: 700, fill: C.magenta, anchor: 'middle' });
  });
  const path = 'Slide > KpiRow > Box > KpiCard[0] > Text[1]';
  const body = [
    lightCard(W, H),
    head('A MESMA ÁRVORE EM TRÊS ESTADOS', 'O JSX vira primitivas com props normalizadas, e as primitivas ganham frames absolutos em pt.'),
    ...cols.map(column),
    ...arrows,
    panel(44, 498, W - 88, 70, { fill: C.paper }),
    pill(64, 519, 'path', { size: 12, h: 28, fill: 'url(#gradH)', color: '#FFFFFF', mono: true }).body,
    mono(140, 538, path, { size: 14, fill: C.indigo, weight: 700 }),
    small(140 + monoWidth(path, 14) + 24, 538, 'é o endereço do nó: diagnósticos, lint e regras de DS apontam por ele.', { size: 13.5 }),
  ].join('\n');
  return svg(W, H, 'pptsx: a mesma árvore como JSX, resolvida e posicionada', body, insideDefs());
};

// 2. Resolve: shorthands, cascata e herança
const resolveSvg = () => {
  const W = 1280;
  const H = 640;
  const rows = [
    ['padding="8 16"', ['paddingTop 8', 'paddingRight 16', 'paddingBottom 8', 'paddingLeft 16']],
    ['margin="0 auto"', ['marginTop 0', 'marginRight auto', 'marginBottom 0', 'marginLeft auto']],
    ['flex={1}', ['flexGrow 1', 'flexShrink 1', 'flexBasis 0']],
    ['border="2px solid #CCD3E0"', ['borderTop', 'borderRight', 'borderBottom', 'borderLeft', '2 · solid · #CCD3E0']],
  ];
  const ladder = [
    ['style={{ … }}', 'vence tudo', C.coral],
    ['longhand', 'paddingTop={12}', C.magenta],
    ['shorthand', 'padding="8 16"', '#8A55E6'],
    ['herdado do pai', 'color, fontSize… (só texto)', C.indigo],
    ['padrão da engine', 'core/defaults.ts', C.slate],
  ];
  const node = (x, y, w, title, props, accent) =>
    `<g filter="url(#sh)">${panel(x, y, w, 96, { rx: 12 })}</g><rect x="${x}" y="${y}" width="${w}" height="4" rx="2" fill="${accent}"/>` +
    mono(x + 14, y + 28, title, { size: 14, weight: 700 }) +
    props.map((p, i) => mono(x + 14, y + 52 + i * 19, p, { size: 12, fill: C.slateDark })).join('');
  const body = [
    lightCard(W, H),
    head('RESOLVE: SHORTHANDS, CASCATA E HERANÇA', 'Antes do layout, toda prop vira longhand, os conflitos são decididos e o texto herda do pai.'),
    panel(44, 110, W - 88, 236),
    panelTitle(68, 140, 'SHORTHANDS VIRAM LONGHANDS'),
    ...rows.map(([input, outs], i) => {
      const y = 158 + i * 44;
      const inPill = pill(68, y, input, { size: 12.5, h: 30, fill: '#F1F2FF', stroke: C.indigo, color: C.indigo, mono: true });
      return inPill.body + arrow(68 + inPill.w + 10, y + 15, 376, y + 15, { color: C.slate }) + pillRow(384, y + 1, outs, { size: 12, h: 28, fill: C.paper2, stroke: C.border, color: C.ink, mono: true }, 6);
    }),
    // Precedência
    panel(44, 366, 580, 246),
    panelTitle(68, 396, 'QUEM VENCE (DE CIMA PARA BAIXO)'),
    ...ladder.map(([name, example, color], i) => {
      const y = 414 + i * 38;
      const w = 520 - i * 40;
      return `<rect x="68" y="${y}" width="${w}" height="30" rx="8" fill="${color}" fill-opacity=".12" stroke="${color}" stroke-opacity=".5"/>` +
        `<circle cx="86" cy="${y + 15}" r="9" fill="${color}"/>` + text(86, y + 19, String(i + 1), { size: 10.5, weight: 700, fill: '#FFFFFF', anchor: 'middle' }) +
        text(104, y + 20, name, { size: 13.5, weight: 700, fill: C.ink }) + mono(68 + w - 12, y + 20, example, { size: 11.5, fill: C.slateDark, anchor: 'end' });
    }),
    // Herança
    panel(644, 366, 592, 246),
    panelTitle(668, 396, 'HERANÇA DE TEXTO'),
    node(668, 414, 166, 'Slide', ['color #1B2A4A', 'fontSize 16'], C.ink),
    node(870, 414, 166, 'Box', ['color #FFFFFF', 'textAlign center'], C.indigo),
    node(1072, 414, 144, 'Text', ['fontSize 56'], C.coral),
    arrow(838, 462, 864, 462),
    arrow(1040, 462, 1066, 462),
    small(668, 540, 'O Text computado:', { weight: 700, fill: C.ink }),
    mono(668, 564, 'fontSize 56', { fill: C.coral, weight: 700 }), small(760, 564, 'próprio'),
    mono(668, 588, 'color #FFFFFF', { fill: C.indigo, weight: 700 }), small(782, 588, 'do Box'),
    mono(900, 564, 'textAlign center', { fill: C.indigo, weight: 700 }), small(1036, 564, 'do Box'),
    mono(900, 588, 'fontFamily Arial', { fill: C.slateDark, weight: 700 }), small(1036, 588, 'padrão'),
  ].join('\n');
  return svg(W, H, 'pptsx: resolve expande shorthands, decide a cascata e aplica a herança de texto', body, insideDefs());
};

// 3. Breakpoints em escala
const breakpointsSvg = () => {
  const W = 1280;
  const H = 512;
  const k = 0.34;
  const sizes = [
    ['16x9', 720, 405, ['16x9'], 3, '1,78', '1,00'],
    ['16x10', 720, 450, ['16x10'], 3, '1,60', '1,00'],
    ['4x3', 720, 540, ['4x3', 'tall'], 2, '1,33', '1,00'],
    ['wide', 960, 540, ['wide'], 3, '1,78', '1,33'],
  ];
  const total = sizes.reduce((s, [, w]) => s + w * k, 0);
  const gap = (W - 88 - total) / (sizes.length - 1);
  const bottom = 336;
  let x = 44;
  const frames = sizes.map(([name, pw, ph, keys, cols, aspect, scale]) => {
    const w = pw * k;
    const h = ph * k;
    const fx = x;
    const fy = bottom - h;
    x += w + gap;
    const rowsN = 6 / cols;
    const pad = 10;
    const top = fy + 28;
    const cg = 6;
    const cwid = (w - pad * 2 - cg * (cols - 1)) / cols;
    const chh = (bottom - pad - top - cg * (rowsN - 1)) / rowsN;
    const cells = Array.from({ length: 6 }, (_, i) => {
      const cx = fx + pad + (i % cols) * (cwid + cg);
      const cy = top + Math.floor(i / cols) * (chh + cg);
      return `<rect x="${cx}" y="${cy}" width="${cwid}" height="${chh}" rx="4" fill="${C.paper2}" stroke="${C.border}"/><rect x="${cx}" y="${cy}" width="3" height="${chh}" rx="1.5" fill="url(#gradV)"/>`;
    }).join('');
    const tall = keys.includes('tall');
    return (
      `<g filter="url(#slideShadow)"><rect x="${fx}" y="${fy}" width="${w}" height="${h}" rx="7" fill="#FFFFFF"/></g>` +
      `<rect x="${fx}" y="${fy}" width="${w}" height="${h}" rx="7" fill="none" stroke="${tall ? 'url(#grad)' : C.border}" stroke-width="${tall ? 2.5 : 1}"/>` +
      `<rect x="${fx + 10}" y="${fy + 10}" width="${w * 0.4}" height="8" rx="4" fill="${C.ink}" opacity=".8"/>` +
      cells +
      text(fx, bottom + 30, name, { size: 18, weight: 700, fill: C.ink, family: MONO }) +
      mono(fx + w, bottom + 30, `${pw} × ${ph} pt`, { anchor: 'end', fill: C.slateDark, size: 12 }) +
      small(fx, bottom + 52, `aspecto ${aspect} · escala ${scale}`) +
      pillRow(fx, bottom + 64, keys, { size: 12, h: 26, fill: tall ? '#FBEFFD' : C.paper, stroke: tall ? C.magenta : C.border, color: tall ? C.magenta : C.ink, mono: true }, 6) +
      mono(fx, bottom + 118, `→ repeat(${cols}, 1fr)`, { fill: tall ? C.magenta : C.indigo, weight: 700, size: 13 }) +
      small(fx, bottom + 138, tall ? 'usou a chave tall' : 'caiu no base', { size: 12 })
    );
  });
  const code = 'gridTemplateColumns={{ base: "repeat(3, 1fr)", tall: "repeat(2, 1fr)" }}';
  const body = [
    lightCard(W, H),
    head('BREAKPOINTS, EM ESCALA', 'Os quatro presets desenhados no tamanho real relativo; a mesma prop escolhe um valor por tamanho.'),
    `<rect x="44" y="102" width="${monoWidth(code, 13) + 28}" height="32" rx="8" fill="${C.ink}"/>`,
    mono(58, 123, code, { fill: '#E3E8FA', size: 13 }),
    small(W - 44, 116, 'tall ⇔ largura ÷ altura < 1,5  ·  wide ⇔ escala > 1,2', { anchor: 'end', weight: 600, fill: C.ink }),
    small(W - 44, 134, 'precedência: nome exato > wide > tall > base', { anchor: 'end' }),
    ...frames,
  ].join('\n');
  return svg(W, H, 'pptsx: breakpoints dos quatro presets em escala', body, insideDefs());
};

// 4. Motor de grid: tracks e posicionamento
const gridSvg = () => {
  const W = 1280;
  const H = 600;
  const x0 = 140;
  const s = 1000 / 640;
  const tracks = [
    ['200', 200, C.slate, 'fixo'],
    ['minmax(0, 1fr)', 136, C.indigo, '1fr'],
    ['2fr', 272, C.magenta, '2fr'],
  ];
  const gapPt = 16;
  let cursor = x0;
  const xs = [];
  const trackSvg = tracks.map(([label, pt, color, kind], i) => {
    const w = pt * s;
    const tx = cursor;
    xs.push([tx, w]);
    cursor += w + (i < tracks.length - 1 ? gapPt * s : 0);
    const gapRect = i < tracks.length - 1 ? `<rect x="${tx + w}" y="176" width="${gapPt * s}" height="46" fill="url(#hatch)"/>` : '';
    return (
      `<rect x="${tx}" y="176" width="${w}" height="46" rx="8" fill="${color}" fill-opacity=".12" stroke="${color}" stroke-opacity=".6"/>` +
      mono(tx + w / 2, 166, label, { anchor: 'middle', fill: color, weight: 700, size: 12.5 }) +
      text(tx + w / 2, 204, `${pt} pt`, { size: 15, weight: 700, fill: C.ink, anchor: 'middle' }) +
      small(tx + w / 2, 240, kind, { anchor: 'middle', size: 11.5 }) +
      gapRect
    );
  });
  const cell = (x, y, w, h, label, sub, color = C.indigo) =>
    `<g filter="url(#sh)"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#FFFFFF"/></g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="none" stroke="${color}" stroke-opacity=".5"/>` +
    text(x + 14, y + 25, label, { size: 15, weight: 700, fill: C.ink }) + (sub ? mono(x + 14, y + 44, sub, { size: 11.5, fill: color }) : '');
  const [[a, aw], [b, bw], [c, cw]] = xs;
  const steps = [
    ['1 · fixos primeiro', '200 pt'],
    ['2 · gaps', '2 × 16 = 32 pt'],
    ['3 · o que sobra', '640 − 200 − 32 = 408 pt'],
    ['4 · frações', '1fr = 408 ÷ 3 = 136 pt'],
  ];
  const body = [
    lightCard(W, H),
    head('O MOTOR DE GRID', 'Os tracks seguem o algoritmo do CSS Grid; depois, cada item ocupa a sua célula (com span).'),
    `<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="${C.paper2}"/><line x1="0" y1="0" x2="0" y2="6" stroke="${C.slate}" stroke-width="1.5" opacity=".5"/></pattern></defs>`,
    mono(44, 120, '<Box display="grid" width={640} gap={16} gridTemplateColumns="200 minmax(0, 1fr) 2fr">', { size: 13, fill: C.indigo }),
    panelTitle(44, 204, 'TRACKS'),
    ...trackSvg,
    `<path d="M${x0} 254 v6 H${x0 + 1000} v-6" fill="none" stroke="${C.slate}"/>`,
    small(x0 + 500, 278, '640 pt', { anchor: 'middle', weight: 700, fill: C.ink }),
    panelTitle(44, 330, 'ITENS'),
    cell(a, 300, aw, 54, 'A', null), cell(b, 300, bw, 54, 'B', null), cell(c, 300, cw, 54, 'C', null),
    cell(a, 300 + 54 + 16, aw + gapPt * s + bw, 54, 'D', 'gridColumn="span 2"', C.magenta), cell(c, 370, cw, 54, 'E', null),
    small(x0 + 1000 + 14, 332, 'linha 1', { size: 11.5 }), small(x0 + 1000 + 14, 402, 'linha 2', { size: 11.5 }),
    ...steps.map(([title, value], i) => {
      const x = 44 + i * 300;
      return panel(x, 456, 288, 80, { rx: 14 }) + text(x + 18, 486, title, { size: 13, weight: 700, fill: C.slateDark }) + mono(x + 18, 516, value, { size: 15, weight: 700, fill: i === 3 ? C.indigo : C.ink });
    }),
    small(44, 572, 'minmax(0, 1fr) deixa a coluna encolher abaixo do conteúdo; um 1fr solto tem mínimo auto (o lint avisa). Contra o Chrome: 47/48 casos em ±1 pt.', { size: 13 }),
  ].join('\n');
  return svg(W, H, 'pptsx: motor de grid, cálculo dos tracks e posicionamento com span', body, insideDefs());
};

// 5. Texto: métricas e quebras forçadas
const textSvg = () => {
  const W = 1280;
  const H = 620;
  const size = 32;
  const lh = 46;
  const fw = 440;
  const safe = fw * 0.97;
  const fx = 76;
  const fy = 150;
  const sentence = 'A receita subiu 14% em todas as regiões, exceto no Norte, e fechou em R$ 52,4 mi.';
  const lines = wrap(sentence, size, safe);
  const font = inter.regular;
  const asc = (font.ascent / font.unitsPerEm) * size;
  const desc = (-font.descent / font.unitsPerEm) * size;
  const baselineOf = (i) => fy + i * lh + (lh - (asc + desc)) / 2 + asc;
  const fh = lines.length * lh;
  const run = font.layout(lines[0]);
  let gx = fx;
  const ticks = run.positions.map((p) => {
    const t = `<line x1="${gx.toFixed(1)}" y1="${baselineOf(0) + desc + 3}" x2="${gx.toFixed(1)}" y2="${baselineOf(0) + desc + 9}" stroke="${C.coral}" stroke-width="1"/>`;
    gx += (p.xAdvance / font.unitsPerEm) * size;
    return t;
  });
  const b0 = baselineOf(0);
  const guides = [
    [b0 - asc, 'ascender', C.slate, 4],
    [b0, 'baseline', C.indigo, 0],
    [b0 + desc, 'descender', C.slate, 14],
  ];
  const xml = [
    [['<a:p>', 'punct']],
    [['  <a:pPr><a:lnSpc><a:spcPts ', 'tag'], ['val', 'attr'], ['="', 'punct'], [String(lh * 100), 'num'], ['"/>', 'punct'], ['</a:lnSpc></a:pPr>', 'tag']],
    ...lines.flatMap((line, i) => [
      [['  <a:r><a:t>', 'tag'], [line, 'str'], ['</a:t></a:r>', 'tag']],
      ...(i < lines.length - 1 ? [[['  <a:br/>', 'fn']]] : []),
    ]),
    [['</a:p>', 'punct']],
  ];
  const stats = [
    ['34/34', 'amostras de texto simples com as mesmas linhas no Keynote'],
    ['30/30', 'amostras de rich text (negrito, itálico, cor por trecho)'],
    ['43/43', 'rich text com sobrescrito e corpo por trecho'],
    ['0,97', 'textSafety: quebra com 3 % de folga, a caixa sai cheia'],
  ];
  const body = [
    lightCard(W, H),
    head('TEXTO: MEDIDO COM A FONTE, QUEBRADO PELA ENGINE', 'O fontkit mede cada glifo; cada linha medida vira uma quebra manual no .pptx, para sair igual ao PNG.'),
    panel(44, 110, 640, 340),
    `<rect x="${fx}" y="${fy}" width="${fw}" height="${fh}" fill="${C.paper2}" stroke="${C.slate}" stroke-dasharray="4 3"/>`,
    `<line x1="${fx + safe}" y1="${fy - 14}" x2="${fx + safe}" y2="${fy + fh + 12}" stroke="${C.coral}" stroke-width="1.5" stroke-dasharray="5 4"/>`,
    small(fx + safe, fy - 20, '97 %', { anchor: 'middle', fill: C.coral, weight: 700, size: 11.5 }),
    ...lines.map((_, i) => `<line x1="${fx}" y1="${baselineOf(i)}" x2="${fx + fw}" y2="${baselineOf(i)}" stroke="${C.indigo}" stroke-opacity=".35"/>`),
    ...guides.map(([y, , color]) => `<line x1="${fx - 8}" y1="${y}" x2="${fx + fw + 8}" y2="${y}" stroke="${color}" stroke-dasharray="2 3" stroke-opacity=".9"/>`),
    ...lines.map((line, i) => text(fx, baselineOf(i), line, { size, fill: C.ink })),
    ...ticks,
    ...guides.map(([y, label, color, dy]) => small(fx + fw + 16, y + dy, label, { fill: color, weight: 600, size: 11.5 })),
    `<path d="M${fx + fw + 104} ${fy} v${lh}" stroke="${C.magenta}" stroke-width="2"/><path d="M${fx + fw + 91} ${fy} h10 M${fx + fw + 91} ${fy + lh} h10" stroke="${C.magenta}" stroke-width="2"/>`,
    small(fx + fw + 112, fy + lh / 2 + 4, `${lh} pt`, { fill: C.magenta, weight: 600, size: 11.5 }),
    small(64, 424, 'traços coral: o avanço de cada glifo (com kerning) da 1ª linha', { size: 12 }),
    small(64, 440, `${lines.length} linhas medidas → ${lines.length - 1} quebras <a:br/> no arquivo`, { size: 12, weight: 600, fill: C.ink }),
    windowCard(704, 110, 532, 340, 'ppt/slides/slide1.xml'),
    codeBlock(726, 182, xml, { size: 12, lh: 22 }),
    small(726, 432, 'altura de linha exata (spcPts), não múltiplo: o Keynote e o PowerPoint não reinterpretam', { size: 11.5, fill: '#AEB6D6' }),
    ...stats.map(([value, desc], i) => {
      const x = 44 + i * 300;
      return panel(x, 474, 288, 112, { rx: 14 }) + text(x + 20, 518, value, { size: 30, weight: 800, fill: 'url(#gradH)' }) + wrap(desc, 12.5, 250).map((l, j) => small(x + 20, 546 + j * 18, l)).join('');
    }),
  ].join('\n');
  return svg(W, H, 'pptsx: medição de texto com o fontkit e quebras forçadas no PPTX', body, insideDefs() + shadow('cardShadow', 0.28, 10, 14, '#0B1020'));
};

// 6. Shrink: escopos e busca binária
const shrinkSvg = () => {
  const W = 1280;
  const H = 600;
  const quote = 'O catálogo de dados reduziu pela metade o tempo para achar uma tabela confiável.';
  const k = 0.82;
  const quoteBox = (x, y, wPt, sizePt, label, sub, hot) => {
    const w = wPt * k;
    const h = 150 * k;
    const pad = 16 * k;
    const fs = sizePt * k;
    const lines = wrap(quote, fs, w - pad * 2);
    return (
      `<rect x="${x - 10}" y="${y - 30}" width="${w + 20}" height="${h + 40}" rx="12" fill="none" stroke="${hot ? C.magenta : C.slate}" stroke-dasharray="5 4"/>` +
      text(x - 2, y - 12, label, { size: 11.5, weight: 700, fill: hot ? C.magenta : C.slateDark, family: MONO }) +
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${C.mist}"/>` +
      lines.map((l, i) => text(x + pad, y + pad + fs + i * fs * 1.2 - 3, l, { size: fs, fill: C.ink })).join('') +
      small(x, y + h + 26, sub, { weight: 700, fill: hot ? C.magenta : C.ink, size: 13 })
    );
  };
  const nx0 = 720;
  const nx1 = 1200;
  const sx = (pt) => nx0 + ((22 - pt) / 10) * (nx1 - nx0);
  const tries = [
    [22, 12, 17, true],
    [22, 17, 20, false],
    [20, 17, 19, false],
    [19, 17, 18, false],
  ];
  const rules = [
    ['Escopo', 'a instância de componente mais próxima: os textos dela encolhem juntos'],
    ['Passo', '1 pt, a partir do tamanho do autor (shrinkStep)'],
    ['Piso', 'minSize, ou max(⌊75 % do tamanho⌋, 10 pt) sem ele'],
    ['Custo', 'cada tentativa é um layout completo do slide'],
  ];
  const body = [
    lightCard(W, H),
    head('SHRINK: ESCOPO + BUSCA BINÁRIA', 'Só encolhe quem estourou, e o menor passo que resolve é achado por busca binária.'),
    panel(44, 110, 604, 300),
    panelTitle(68, 140, 'O MESMO COMPONENTE EM DUAS LARGURAS'),
    quoteBox(78, 196, 400 * 0.62, 22, 'Quote[0]', '22 pt: coube, não mexe', false),
    quoteBox(330, 196, 180, 17, 'Quote[1]', '22 → 17 pt (text-shrunk)', true),
    panel(668, 110, 568, 300),
    panelTitle(692, 140, 'BUSCA DO FONTSIZE DE Quote[1] (ILUSTRAÇÃO)'),
    ...[22, 20, 18, 16, 14, 12].map((pt) => small(sx(pt), 168, `${pt}`, { anchor: 'middle', size: 11, fill: C.slate })),
    ...tries.map(([hi, lo, test, ok], i) => {
      const y = 196 + i * 46;
      return (
        `<rect x="${sx(hi)}" y="${y - 7}" width="${sx(lo) - sx(hi)}" height="14" rx="7" fill="${C.indigo}" fill-opacity=".12"/>` +
        `<circle cx="${sx(test)}" cy="${y}" r="11" fill="${ok ? C.green : C.red}"/>` +
        text(sx(test), y + 4.5, ok ? '✓' : '✗', { size: 12, weight: 700, fill: '#FFFFFF', anchor: 'middle' }) +
        small(692, y + 4, `${i + 1}ª`, { weight: 700, fill: C.ink })
      );
    }),
    `<line x1="${sx(17)}" y1="378" x2="${sx(17)}" y2="186" stroke="${C.green}" stroke-dasharray="4 4"/>`,
    small(sx(17), 396, 'menor passo que cabe: 17 pt · 4 layouts', { anchor: 'middle', weight: 700, fill: C.green }),
    ...rules.map(([title, desc], i) => {
      const x = 44 + i * 300;
      return panel(x, 432, 288, 132, { rx: 14 }) + text(x + 20, 466, title, { size: 16, weight: 700, fill: C.ink }) + `<rect x="${x + 20}" y="476" width="24" height="3" rx="1.5" fill="url(#gradH)"/>` + wrap(desc, 13, 250).map((l, j) => small(x + 20, 502 + j * 19, l, { size: 13 })).join('');
    }),
  ].join('\n');
  return svg(W, H, 'pptsx: shrink por escopo de componente com busca binária', body, insideDefs());
};

// 7. Paginação
const paginateSvg = () => {
  const W = 1280;
  const H = 460;
  const w = 238;
  const h169 = w * 405 / 720;
  const h43 = w * 540 / 720;
  const y = 146;
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  const label = (x, s, sub) => text(x, 132, s, { size: 14, weight: 700, fill: C.ink }) + (sub ? small(x + measure(s, 14, 'semibold') + 8, 132, sub, { size: 12 }) : '');
  const body = [
    lightCard(W, H),
    head('PAGINAÇÃO: <Box paginate>', 'O que não cabe continua num clone do slide, em vez de encolher a fonte.'),
    label(44, 'slide do autor', '9 itens'),
    miniSlide(44, y, w, h169, { items: range(1, 6), ghost: range(7, 9) }),
    small(44, y + h169 + 70, 'os itens 7–9 passam da base', { fill: C.red, weight: 600, size: 12 }),
    arrow(44 + w + 10, y + 60, 340, y + 60, { color: C.magenta, width: 2.5 }),
    label(352, '16:9', 'parte 1'),
    miniSlide(352, y, w, h169, { items: range(1, 6), highlight: true }),
    label(614, '16:9', 'parte 2'),
    miniSlide(614, y, w, h169, { items: range(7, 9), highlight: true }),
    small(352, y + h169 + 24, 'em magenta, o que é clonado: título, fundo, decoração, rodapé e notas', { fill: C.magenta, weight: 600, size: 12 }),
    `<line x1="900" y1="116" x2="900" y2="${y + h43 + 10}" stroke="${C.border}" stroke-dasharray="5 5"/>`,
    label(938, '4:3', 'mesmo arquivo'),
    miniSlide(938, y, w, h43, { items: range(1, 9) }),
    small(938, y + h43 + 24, 'mais altura: os 9 cabem num slide só', { weight: 600, size: 12, fill: C.ink }),
    panel(44, 372, 836, 58, { rx: 12, fill: '#F1F2FF', stroke: '#D9DCFF' }),
    `<circle cx="68" cy="401" r="5" fill="${C.indigo}"/>`,
    mono(84, 397, 'slide-continued', { weight: 700, fill: C.indigo }),
    small(84, 416, 'Slide 1 do autor virou 2 slides (6 de 9 itens no 1º, 3 no 2º). Os paths não mudam; data.sourceSlide aponta o original.', { size: 12 }),
  ].join('\n');
  return svg(W, H, 'pptsx: paginação de um Box em clones do slide', body, insideDefs());
};

// 8. Anatomia de um diagnóstico
const diagnosticSvg = () => {
  const W = 1280;
  const H = 660;
  const lh = 36;
  const y0 = 172;
  const json = [
    [['{', 'punct']],
    [['  "size"', 'attr'], [': ', 'punct'], ['"16x9"', 'str'], [', ', 'punct'], ['"slide"', 'attr'], [': ', 'punct'], ['1', 'num'], [',', 'punct']],
    [['  "severity"', 'attr'], [': ', 'punct'], ['"error"', 'str'], [',', 'punct']],
    [['  "code"', 'attr'], [': ', 'punct'], ['"text-overflow"', 'str'], [',', 'punct']],
    [['  "path"', 'attr'], [': ', 'punct'], ['"Slide > Box > Text"', 'str'], [',', 'punct']],
    [['  "message"', 'attr'], [': ', 'punct'], ['"Texto estourou 17.9%…"', 'str'], [',', 'punct']],
    [['  "data"', 'attr'], [': ', 'punct'], ['{ ', 'punct'], ['"overflowPt"', 'attr'], [': ', 'punct'], ['14', 'num'], [' }', 'punct']],
    [['}', 'punct']],
  ];
  const notes = [
    [1, 'onde', 'tamanho e número do slide no arquivo gerado'],
    [2, 'gravidade', 'error corrige · warning se intencional · info avisa'],
    [3, 'o quê', 'um dos 13 códigos estáveis'],
    [4, 'em qual nó', 'o path, com o nome do componente'],
    [5, 'o que fazer', 'mensagem que propõe a correção'],
    [6, 'números', 'overflowPt, causedBy, count, paths…'],
  ];
  const term = [
    ['✖ ', C.red, 'box-overflow em Slide > Box[1]'],
    ['  ↳ ', C.slate, 'out-of-slide em Slide > Box[2]'],
    ['    ', C.slate, '…corrija Slide > Box[1] primeiro'],
  ];
  const body = [
    lightCard(W, H),
    head('ANATOMIA DE UM DIAGNÓSTICO', 'Cada campo existe para alguém (pessoa ou agente) decidir o que corrigir sem abrir o PowerPoint.'),
    windowCard(44, 110, 560, 340, 'deck.diagnostics.json'),
    codeBlock(68, y0, json, { size: 14, lh }),
    ...notes.map(([line, title, desc]) => {
      const y = y0 + line * lh - 5;
      return `<circle cx="604" cy="${y}" r="4" fill="${C.magenta}"/><path d="M608 ${y} H690" stroke="${C.magenta}" stroke-dasharray="3 3"/>` +
        numBadge(708, y, line, 12) + text(730, y + 5, title, { size: 15, weight: 700, fill: C.ink }) + small(730 + measure(title, 15, 'bold') + 12, y + 5, desc, { size: 13 });
    }),
    panel(44, 474, 580, 156),
    panelTitle(68, 504, 'CAUSA ANTES DO EFEITO (causedBy)'),
    `<rect x="68" y="518" width="532" height="92" rx="10" fill="${C.ink}"/>`,
    ...term.map(([mark, color, s], i) => `<text x="86" y="${546 + i * 24}" font-family="${MONO}" font-size="13" xml:space="preserve"><tspan fill="${color}">${esc(mark)}</tspan><tspan fill="${i === 2 ? '#8A93B8' : '#E3E8FA'}">${esc(s)}</tspan></text>`),
    panel(644, 474, 592, 156),
    panelTitle(668, 504, 'GRUPOS: IRMÃOS COM O MESMO PROBLEMA'),
    ...Array.from({ length: 8 }, (_, i) => `<rect x="${668 + i * 30}" y="528" width="24" height="24" rx="5" fill="#FDE4E8" stroke="${C.red}" stroke-opacity=".6"/>` + text(680 + i * 30, 544, String(i), { size: 10, fill: C.red, anchor: 'middle', family: MONO })),
    arrow(912, 540, 950, 540, { color: C.slate }),
    pill(958, 526, 'Box[0..7] · count 8', { size: 13, h: 30, fill: '#FDE4E8', stroke: C.red, color: C.red, mono: true }).body,
    small(668, 590, 'Um item só, com data.count e data.paths: corrija uma vez, no .map ou no componente.', { size: 13 }),
  ].join('\n');
  return svg(W, H, 'pptsx: anatomia de um diagnóstico, causa e grupos', body, insideDefs());
};

// 9. Anatomia do .pptx e o pós-processo
const pptxSvg = () => {
  const W = 1280;
  const H = 640;
  const tree = [
    [0, '[Content_Types].xml', null],
    [0, 'docProps/core.xml · app.xml', null],
    [0, 'ppt/presentation.xml', 1],
    [0, 'ppt/slides/slide1.xml …', 2],
    [0, 'ppt/slideLayouts/ · slideMasters/', null],
    [0, 'ppt/theme/theme1.xml', null],
    [0, 'ppt/charts/chart1.xml …', 3],
    [0, 'ppt/embeddings/', null],
    [1, 'Microsoft_Excel_Worksheet1.xlsx', 4],
    [2, 'xl/tables/table1.xml', 4],
  ];
  const fixes = [
    ['presentation.xml', 'listas na ordem do schema', 'sldIdLst depois de notesMasterIdLst; fora de ordem, o PowerPoint pede para "reparar"'],
    ['slideN.xml', 'um <a:pPr> por parágrafo', 'o pptxgenjs repete o pPr a cada run; também aplica marcadores de linha e o campo do nº do slide'],
    ['chartN.xml', 'renumerado 1..n · sem ponto vazio', 'o contador do pptxgenjs não zera entre arquivos; o Keynote lia <c:v></c:v> como 0'],
    ['Worksheet.xlsx', 'zip dentro do zip', 'ref="A1:B4\'" vira ref="A1:B4"; com o apóstrofo, o Keynote descarta o gráfico'],
  ];
  const flow = ['pptxgenjs', 'JSZip.loadAsync', 'renumberCharts', 'fixPart × partes', 'DEFLATE → Buffer'];
  let fx = 44;
  const flowSvg = flow.map((s, i) => {
    const p = pill(fx, 104, s, { size: 12.5, h: 30, fill: i === 0 ? C.ink : C.paper, stroke: i === 0 ? C.ink : C.border, color: i === 0 ? '#FFFFFF' : C.ink, mono: true });
    const out = p.body + (i < flow.length - 1 ? arrow(fx + p.w + 6, 119, fx + p.w + 30, 119) : '');
    fx += p.w + 36;
    return out;
  });
  const body = [
    lightCard(W, H),
    head('POR DENTRO DO .pptx', 'O pptxgenjs escreve o pacote; a engine reabre o zip e corrige o que o PowerPoint e o Keynote recusariam.'),
    ...flowSvg,
    panel(44, 158, 520, 446),
    panelTitle(68, 188, 'deck.16x9.pptx (UM ZIP)'),
    ...tree.map(([d, name, fix], i) => {
      const y = 222 + i * 37;
      const x = 76 + d * 26;
      const icon = name.endsWith('/') || name.includes('/ ·') ? '▸' : '·';
      return (fix ? `<rect x="60" y="${y - 20}" width="488" height="30" rx="8" fill="#F1F2FF"/>` : '') +
        (d > 0 ? `<path d="M${x - 14} ${y - 26} V${y - 5} H${x - 4}" fill="none" stroke="${C.slate}"/>` : '') +
        mono(x, y, `${icon} ${name}`, { size: 13, fill: fix ? C.indigo : C.ink, weight: fix ? 700 : 400 }) +
        (fix ? numBadge(526, y - 5, fix, 11) : '');
    }),
    ...fixes.map(([part, title, why], i) => {
      const y = 158 + i * 114;
      return `<g filter="url(#sh)">${panel(588, y, 648, 100, { rx: 14 })}</g>` + numBadge(616, y + 30, i + 1, 13) +
        mono(640, y + 35, part, { size: 13, fill: C.indigo, weight: 700 }) + text(640 + monoWidth(part, 13) + 14, y + 35, title, { size: 15, weight: 700, fill: C.ink }) +
        wrap(why, 13, 590).map((l, j) => small(616, y + 62 + j * 19, l, { size: 13 })).join('');
    }),
  ].join('\n');
  return svg(W, H, 'pptsx: estrutura do .pptx e as correções do pós-processo', body, insideDefs());
};

// 10. De Box a formas OOXML
const boxShapesSvg = () => {
  const W = 1280;
  const H = 620;
  const tsx = [
    [['<', 'punct'], ['Box', 'tag'], [' padding', 'attr'], ['={', 'punct'], ['18', 'num'], ['}', 'punct'], [' borderRadius', 'attr'], ['={', 'punct'], ['10', 'num'], ['}', 'punct']],
    [['  backgroundColor', 'attr'], ['=', 'punct'], ['"#FFFFFF"', 'str']],
    [['  border', 'attr'], ['=', 'punct'], ['"1px solid #E2E6F3"', 'str']],
    [['  boxShadow', 'attr'], ['=', 'punct'], ['"0 3px 10px …"', 'str'], ['>', 'punct']],
    [['  <', 'punct'], ['Text', 'tag'], [' fontSize', 'attr'], ['={', 'punct'], ['13', 'num'], ['}>', 'punct'], ['Receita', 'plain'], ['</', 'punct'], ['Text', 'tag'], ['>', 'punct']],
    [['  <', 'punct'], ['Text', 'tag'], [' fontSize', 'attr'], ['={', 'punct'], ['38', 'num'], ['}', 'punct']],
    [['    fontWeight', 'attr'], ['=', 'punct'], ['"bold"', 'str'], ['>', 'punct'], ['52,4', 'plain'], ['</', 'punct'], ['Text', 'tag'], ['>', 'punct']],
    [['</', 'punct'], ['Box', 'tag'], ['>', 'punct']],
  ];
  const map = [
    ['backgroundColor', '<a:solidFill>'],
    ['border 1px', '<a:ln w="12700">'],
    ['borderRadius', 'prstGeom roundRect'],
    ['boxShadow', '<a:outerShdw>'],
    ['padding 18', 'vira posição dos filhos'],
    ['fontSize 38', '<a:rPr sz="3800">'],
    ['fontWeight bold', 'b="1"'],
  ];
  // Vista explodida: três planos isométricos, a forma embaixo e as caixas de texto acima.
  const px = 456;
  const pw = 250;
  const depth = 140;
  const skew = 74;
  const rise = 76;
  const plane = (top, inner, label, sub) =>
    `<g transform="matrix(1 0 ${(-skew / depth).toFixed(4)} ${(rise / depth).toFixed(4)} ${px + skew} ${top})">${inner}</g>` +
    mono(px + skew + pw + 12, top + 18, label, { size: 12, fill: C.indigo, weight: 700 }) + small(px + skew + pw + 12, top + 36, sub, { size: 11.5 });
  const shapeLayer = `<rect width="${pw}" height="${depth}" rx="12" fill="#FFFFFF" stroke="${C.border}" stroke-width="2"/><rect x="8" y="${depth}" width="${pw - 16}" height="10" rx="5" fill="${C.ink}" opacity=".08"/>`;
  const glass = `<rect width="${pw}" height="${depth}" rx="12" fill="${C.indigo}" fill-opacity=".04" stroke="${C.indigo}" stroke-opacity=".35" stroke-dasharray="6 5"/>`;
  const labelLayer = glass + `<rect x="20" y="22" width="150" height="26" rx="3" fill="#FFFFFF" stroke="${C.indigo}"/>` + text(26, 41, 'Receita (R$ mi)', { size: 15, fill: C.slateDark });
  const valueLayer = glass + `<rect x="20" y="58" width="150" height="58" rx="3" fill="#FFFFFF" stroke="${C.indigo}"/>` + text(26, 104, '52,4', { size: 44, weight: 800, fill: C.ink });
  const guidesV = [0, pw].map((dx) => `<path d="M${px + skew + dx} 132 V 360" stroke="${C.slate}" stroke-dasharray="2 5" opacity=".5"/>`).join('');
  const units = [['40 pt', C.ink], ['÷ 72', C.slateDark], ['0,556 pol', C.ink], ['× 914 400', C.slateDark], ['508 000 EMU', C.indigo]];
  let ux = 68;
  const unitsSvg = units.map(([s, color], i) => {
    const op = i % 2 === 1;
    const w = op ? measure(s, 14) + 16 : measure(s, 15, 'semibold') + 32;
    const out = op ? text(ux + w / 2, 574, s, { size: 14, fill: color, anchor: 'middle' }) : `<rect x="${ux}" y="552" width="${w}" height="32" rx="8" fill="${C.paper2}" stroke="${C.border}"/>` + text(ux + w / 2, 573, s, { size: 15, weight: 700, fill: color, anchor: 'middle' });
    ux += w + 8;
    return out;
  });
  const body = [
    lightCard(W, H),
    head('DE UM BOX A FORMAS NATIVAS', 'Um cartão vira três objetos editáveis: uma forma com fundo, borda e sombra, e duas caixas de texto.'),
    windowCard(44, 110, 392, 290, 'KpiCard.tsx'),
    codeBlock(64, 176, tsx, { size: 12.5, lh: 26 }),
    guidesV,
    plane(356, shapeLayer, '<p:sp>', 'forma'),
    plane(244, labelLayer, 'txBox', 'rótulo'),
    plane(132, valueLayer, 'txBox', 'valor'),
    panel(910, 110, 326, 380),
    panelTitle(934, 140, 'CSS → OOXML'),
    ...map.map(([css, xml], i) => {
      const y = 176 + i * 44;
      return `<path d="M934 ${y + 16} H1212" stroke="${C.border}"/>` + mono(934, y, css, { size: 12, weight: 700 }) + mono(1212, y, xml, { size: 11.5, fill: C.indigo, anchor: 'end' });
    }),
    panel(44, 510, 1192, 90),
    panelTitle(68, 538, 'UNIDADES: pt DENTRO DA ENGINE, POLEGADAS SÓ NO EMISSOR'),
    ...unitsSvg,
    small(W - 68, 573, 'opacity efetiva = produto dos ancestrais (o PPTX não tem opacidade de grupo)', { anchor: 'end', size: 12.5 }),
  ].join('\n');
  return svg(W, H, 'pptsx: como um Box com texto vira formas OOXML', body, insideDefs());
};

// 11. Ordem de pintura em camadas
const stackingSvg = () => {
  const W = 1280;
  const H = 620;
  const x0 = 70;
  const pw = 480;
  const depth = 150;
  const skew = 150;
  const rise = 64;
  const gap = 84;
  const base = 560;
  const m = (y) => `matrix(1 0 ${(skew / depth).toFixed(4)} ${(-rise / depth).toFixed(4)} ${x0} ${y})`;
  const levels = [
    { n: 1, title: 'fundo do slide', sub: 'backgroundColor do Slide', color: C.slate, draw: `<rect width="${pw}" height="${depth}" fill="#1B2A4A" fill-opacity=".9"/>` },
    { n: 2, title: 'zIndex negativo', sub: 'decoração atrás do conteúdo', color: C.indigo, draw: `<ellipse cx="${pw - 90}" cy="${depth - 50}" rx="80" ry="60" fill="${C.indigo}" fill-opacity=".85"/>` },
    { n: 3, title: 'fluxo normal', sub: 'Box, Text, Chart na ordem do código', color: C.ink, draw: `<rect x="40" y="86" width="250" height="30" rx="4" fill="${C.ink}" fill-opacity=".85"/><rect x="40" y="40" width="170" height="20" rx="4" fill="${C.ink}" fill-opacity=".5"/>` },
    { n: 4, title: 'posicionados, opacity, rotate', sub: 'sobem de camada (z 0/auto), na ordem do código', color: C.magenta, draw: `<rect x="300" y="40" width="80" height="80" rx="8" fill="${C.magenta}" fill-opacity=".55" transform="rotate(18 340 80)"/>` },
    { n: 5, title: 'zIndex positivo', sub: 'por último, z crescente', color: C.coral, draw: `<rect x="${pw - 120}" y="${depth - 40}" width="96" height="28" rx="14" fill="${C.coral}"/>` },
  ];
  const planes = levels.map((lv, i) => {
    const y = base - i * gap;
    return `<g transform="${m(y)}"><rect width="${pw}" height="${depth}" rx="6" fill="#FFFFFF" fill-opacity=".55" stroke="${lv.color}" stroke-opacity=".7"/>${lv.draw}</g>` +
      `<circle cx="${x0 - 22}" cy="${y - 4}" r="12" fill="${lv.color}"/>` + text(x0 - 22, y + 0.5, String(lv.n), { size: 12, weight: 700, fill: '#FFFFFF', anchor: 'middle' });
  });
  const body = [
    lightCard(W, H),
    head('ORDEM DE PINTURA', 'As regras do CSS (Apêndice E) decidem a camada; no .pptx, a camada vira a ordem dos objetos no slide.'),
    ...planes,
    ...levels.map((lv, i) => {
      const y = 132 + (levels.length - 1 - i) * 62;
      return `<rect x="760" y="${y}" width="476" height="50" rx="12" fill="${C.paper}" stroke="${C.border}"/><rect x="760" y="${y}" width="5" height="50" rx="2.5" fill="${lv.color}"/>` +
        text(782, y + 22, `${lv.n} · ${lv.title}`, { size: 14.5, weight: 700, fill: C.ink }) + small(782, y + 40, lv.sub, { size: 12.5 });
    }),
    panel(760, 452, 476, 136, { fill: '#F1F2FF', stroke: '#D9DCFF' }),
    text(782, 482, 'Uma lista, dois desenhistas', { size: 15, weight: 700, fill: C.indigo }),
    ...wrap('O emissor e o preview percorrem os mesmos PaintItems (nó, opacidade efetiva, rotações herdadas), nunca a árvore: o PNG e o .pptx pintam igual, na mesma ordem.', 13, 430).map((l, i) => small(782, 508 + i * 19, l, { size: 13 })),
  ].join('\n');
  return svg(W, H, 'pptsx: ordem de pintura em camadas (zIndex, fluxo, posicionados)', body, insideDefs());
};

// ─── Divisor de seção ────────────────────────────────────────────────────────
const dividerSvg = () => svg(1280, 8, 'divisor', `<rect width="1280" height="4" y="2" rx="2" fill="url(#g)"/>`, gradient('g', { x1: 0, y1: 0, x2: 1, y2: 0 }));

// ─── Saída ───────────────────────────────────────────────────────────────────
const files = {
  'mark.svg': markSvg(),
  'logo-light.svg': logoSvg('light'),
  'logo-dark.svg': logoSvg('dark'),
  'banner.svg': bannerSvg(),
  'banner-ds-kit.svg': packageBanner({
    name: 'ds-kit',
    tagline: 'Ferramentas para criar o seu design system.',
    sub: 'Tokens, tema, variantes tipadas, slots, regras de lint, catálogo e o manifesto.',
    chips: ['defineTokens', 'createVariants', 'createDs', 'pptsx-ds catalog'],
    art: kitArt(),
  }),
  'banner-ds-base.svg': packageBanner({
    name: 'ds-base',
    tagline: 'Um design system completo, de exemplo.',
    sub: 'Tokens, tema, layouts, componentes, regras de marca e a galeria.',
    chips: ['CoverLayout', 'KpiRow', 'TwoColumn', 'rules'],
    art: baseArt(),
  }),
  'pipeline.svg': pipelineSvg(),
  'ecosystem.svg': ecosystemSvg(),
  'fit-loop.svg': fitLoopSvg(),
  'css-to-pptx.svg': cssToPptxSvg(),
  'ds-flow.svg': dsFlowSvg(),
  'divider.svg': dividerSvg(),
  'palette.svg': brandPalette(),
  'palette-ds-base.svg': dsBasePalette(),
  'inside-tree.svg': treeStagesSvg(),
  'inside-resolve.svg': resolveSvg(),
  'inside-breakpoints.svg': breakpointsSvg(),
  'inside-grid.svg': gridSvg(),
  'inside-text.svg': textSvg(),
  'inside-shrink.svg': shrinkSvg(),
  'inside-paginate.svg': paginateSvg(),
  'inside-diagnostic.svg': diagnosticSvg(),
  'inside-pptx.svg': pptxSvg(),
  'inside-box-shapes.svg': boxShapesSvg(),
  'inside-stacking.svg': stackingSvg(),
  ...Object.fromEntries(Object.keys(ICON_GLYPHS).map((key) => [`icon-${key}.svg`, iconSvg(key)])),
};

mkdirSync(out, { recursive: true });
Object.entries(files).forEach(([name, content]) => writeFileSync(join(out, name), content));
console.log(`${Object.keys(files).length} SVGs em ${out}`);

const pngIndex = process.argv.indexOf('--png');
if (pngIndex !== -1) {
  const pngDir = process.argv[pngIndex + 1];
  const { Resvg } = await import('@resvg/resvg-js');
  mkdirSync(pngDir, { recursive: true });
  Object.entries(files).forEach(([name, content]) => {
    const png = new Resvg(content, { fitTo: { mode: 'zoom', value: 1.5 }, font: { loadSystemFonts: true, fontDirs: [interDir], defaultFontFamily: 'Inter' }, background: '#FFFFFF' }).render().asPng();
    writeFileSync(join(pngDir, name.replace('.svg', '.png')), png);
  });
  console.log(`PNGs em ${pngDir}`);
}
