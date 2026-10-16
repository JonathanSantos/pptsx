#!/usr/bin/env node
// Regenera a galeria dos READMEs a partir dos seis design systems de examples/gallery/.
// Para cada DS: tsc, build 16:9 (com --json) e recusa qualquer warning ou error; depois monta
// a capa (as seis capas em 3 × 2) e um painel por DS (nome na fonte do DS, paleta, quatro slides).
//   node scripts/gallery.mjs     grava packages/pptsx/docs/readme/gallery-ds/*.png
// Requer macOS: Georgia, DIN Condensed, Big Caslon e Andale Mono vêm do sistema (nenhuma é copiada para o repositório).
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const repo = fileURLToPath(new URL('../', import.meta.url));
const src = join(repo, 'examples/gallery');
const build = join(repo, 'dist/gallery');
const out = join(repo, 'packages/pptsx/docs/readme/gallery-ds');
const tsc = join(repo, 'node_modules/.bin/tsc');
const pptsx = join(repo, 'packages/pptsx/bin/pptsx.mjs');

const SANS = "Inter, 'Helvetica Neue', Arial, sans-serif";

/** O que o painel mostra de cada DS: nome, fonte do nome, paleta e cores do fundo. */
const DS = [
  { id: 'nebula', name: 'Nebula', kind: 'lançamento de produto', bg: '#07080F', ink: '#F2F3FA', dim: '#8D92B2', accent: '#8B5CF6', font: 'Inter', weight: 700, fonts: 'Inter · Andale Mono', colors: ['#07080F', '#8B5CF6', '#22D3EE', '#A3E635', '#F472B6', '#F2F3FA'] },
  { id: 'gazeta', name: 'A Gazeta', kind: 'editorial de jornal', bg: '#F3EEE4', ink: '#17140F', dim: '#6D675C', accent: '#C2311B', font: 'Georgia', weight: 700, fonts: 'Georgia · Inter', colors: ['#F3EEE4', '#17140F', '#C2311B', '#6D675C', '#CFC6B5', '#E8E0D0'] },
  { id: 'forma', name: 'FORMA', kind: 'congresso de design', bg: '#EFE8DA', ink: '#141414', dim: '#55504A', accent: '#E1341E', font: 'DIN Condensed', weight: 700, fonts: 'DIN Condensed · Inter', colors: ['#EFE8DA', '#141414', '#E1341E', '#1F4FBF', '#F2B705', '#FFFFFF'] },
  { id: 'brisa', name: 'Brisa', kind: 'app de finanças', bg: '#FBF7F2', ink: '#2B2340', dim: '#7A7290', accent: '#6B55D9', font: 'Inter', weight: 700, fonts: 'Inter', colors: ['#C9EEDD', '#FFDCCB', '#E2DAFF', '#FFF0B8', '#6B55D9', '#2B2340'] },
  { id: 'terminal', name: '~/terminal', kind: 'pós-mortem de incidente', bg: '#0A0D09', ink: '#D5E2CF', dim: '#6E7F68', accent: '#5EE38B', font: 'Andale Mono', weight: 400, fonts: 'Andale Mono', colors: ['#0A0D09', '#263021', '#5EE38B', '#F5C152', '#FF6B6B', '#7AB8FF'] },
  { id: 'botanica', name: 'Botânica', kind: 'relatório de impacto', bg: '#EFE6D4', ink: '#1E3A2A', dim: '#6B5640', accent: '#5E8A4A', font: 'Big Caslon', weight: 400, fonts: 'Big Caslon · Inter', colors: ['#1E3A2A', '#5E8A4A', '#B7C9A2', '#EFE6D4', '#C2623C', '#6B5640'] },
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

// ─── Build ───────────────────────────────────────────────────────────────────
const buildDs = ({ id }) => {
  execFileSync(tsc, ['--noEmit', '-p', join(src, id)], { stdio: 'inherit' });
  const run = spawnSync(process.execPath, [pptsx, 'build', join(src, id, 'deck.tsx'), '--size', '16x9', '--out', join(build, id), '--preview-width', '1600', '--json'], { encoding: 'utf8' });
  const { diagnostics = [], error } = JSON.parse(run.stdout || '{}');
  if (error) throw new Error(`${id}: ${error}`);
  const blocking = diagnostics.filter((d) => d.severity !== 'info');
  if (blocking.length > 0) throw new Error(`${id}: ${blocking.map((d) => `${d.severity} ${d.code} em ${d.path}`).join('; ')}`);
  console.log(`${id}: ok (${diagnostics.length} info)`);
};

// ─── Montagem ────────────────────────────────────────────────────────────────
const slide = (id, n) => `data:image/png;base64,${readFileSync(join(build, id, `deck.16x9/slide-0${n}.png`)).toString('base64')}`;
const isDark = (hex) => parseInt(hex.slice(1, 3), 16) < 60;
const defs = '<filter id="blur" x="-10%" y="-10%" width="120%" height="140%"><feGaussianBlur stdDeviation="14"/></filter>';

/** Um slide com cantos arredondados e sombra. */
const shot = (href, x, y, w, id, dark) => {
  const h = (w * 9) / 16;
  return `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14"/></clipPath>` +
    `<rect x="${x}" y="${y + 10}" width="${w}" height="${h}" rx="14" fill="#000" opacity="${dark ? 0.5 : 0.12}" filter="url(#blur)"/>` +
    `<image href="${href}" x="${x}" y="${y}" width="${w}" height="${h}" clip-path="url(#${id})" preserveAspectRatio="xMidYMid slice"/>` +
    `<rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" rx="13.5" fill="none" stroke="${dark ? '#FFFFFF' : '#000000'}" stroke-opacity="${dark ? 0.12 : 0.08}"/>`;
};

const svgOf = (W, H, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${defs}</defs>${body}</svg>`;

/** Painel de um DS: cabeçalho com o nome na própria fonte e a paleta; a capa grande e três slides ao lado. */
const panel = (ds) => {
  const W = 1600;
  const pad = 48;
  const g = 22;
  const head = 128;
  const w2 = (W - pad * 2 - g - g * (16 / 9) * 2) / 4;
  const w1 = W - pad * 2 - g - w2;
  const H = pad + head + (w1 * 9) / 16 + pad;
  const dark = isDark(ds.bg);
  const swatches = ds.colors.map((c, i) => `<circle cx="${W - pad - 20 - (ds.colors.length - 1 - i) * 34}" cy="${pad + 34}" r="14" fill="${c}" stroke="${dark ? '#FFFFFF33' : '#00000022'}" stroke-width="1.5"/>`).join('');
  return svgOf(W, H, [
    `<rect width="${W}" height="${H}" rx="28" fill="${ds.bg}"/>`,
    `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="27" fill="none" stroke="${dark ? '#FFFFFF' : '#000000'}" stroke-opacity="0.08" stroke-width="2"/>`,
    `<text x="${pad}" y="${pad + 50}" font-family="${ds.font}" font-weight="${ds.weight}" font-size="56" fill="${ds.ink}" letter-spacing="-1">${esc(ds.name)}</text>`,
    `<text x="${pad}" y="${pad + 88}" font-family="${SANS}" font-size="20" fill="${ds.dim}">${esc(`design system de ${ds.kind}  ·  ${ds.fonts}`)}</text>`,
    swatches,
    `<text x="${W - pad}" y="${pad + 88}" font-family="${SANS}" font-size="16" fill="${ds.dim}" text-anchor="end">feito com @pptsx/ds-kit · 4 slides · 0 avisos</text>`,
    shot(slide(ds.id, 1), pad, pad + head, w1, `${ds.id}1`, dark),
    ...[2, 3, 4].map((n, i) => shot(slide(ds.id, n), pad + w1 + g, pad + head + i * ((w2 * 9) / 16 + g), w2, `${ds.id}${n}`, dark)),
  ].join('\n'));
};

/** Capa da galeria: as seis capas em 3 × 2, com o nome e o tipo de cada DS embaixo. */
const hero = () => {
  const W = 1600;
  const pad = 40;
  const g = 28;
  const w = (W - pad * 2 - g * 2) / 3;
  const h = (w * 9) / 16;
  const label = 40;
  const H = pad * 2 + (h + label) * 2 + g;
  const cells = DS.map((ds, i) => {
    const x = pad + (i % 3) * (w + g);
    const y = pad + Math.floor(i / 3) * (h + label + g);
    return shot(slide(ds.id, 1), x, y, w, `h${i}`, false) +
      `<circle cx="${x + 8}" cy="${y + h + 26}" r="6" fill="${ds.accent}"/>` +
      `<text x="${x + 22}" y="${y + h + 32}" font-family="${SANS}" font-size="17"><tspan font-weight="700" fill="#0B1020">${esc(ds.name.replace('~/', ''))}</tspan><tspan dx="10" font-size="16" fill="#5A6385">${esc(ds.kind)}</tspan></text>`;
  }).join('\n');
  return svgOf(W, H, `<rect width="${W}" height="${H}" rx="28" fill="#F7F8FD"/><rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="27" fill="none" stroke="#E2E6F3" stroke-width="2"/>${cells}`);
};

const render = (name, svg) => {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1600 }, font: { loadSystemFonts: true, fontDirs: [join(repo, 'packages/ds-base/fonts/inter')], defaultFontFamily: 'Inter' } }).render().asPng();
  writeFileSync(join(out, `${name}.png`), png);
  console.log(`${name}.png ${(png.length / 1024).toFixed(0)} KB`);
};

DS.forEach(buildDs);
mkdirSync(out, { recursive: true });
render('hero', hero());
DS.forEach((ds) => render(ds.id, panel(ds)));
