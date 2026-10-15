import type { DeckDefinition, PositionedNode, PrimitiveKind, RenderOptions, Severity, SizeSpec, Theme } from '../core/types.ts';
import { groupDiagnostics } from '../fit/index.ts';
import { render } from '../render.ts';
import type { Diagnostic } from '../core/types.ts';
import { createResolveEnv, resolveDeck, ResolveError, resolveTheme } from '../resolve/index.ts';
import { createContext, resolveSize } from '../sizes.ts';
import { aliasRuleOf, suggestionOf } from './aliases.ts';

/**
 * M16-5: `pptsx lint` — carrega e resolve o deck (sem gravar nada) e aponta o que vai dar trabalho:
 * props antigas (com a troca), CSS sem de/para, `lineHeight` numérico alto (o Keynote desce a 1ª linha),
 * `fr` solto em grid, cores fora do tema e erro de estrutura. Mensagens para LLM, como os diagnósticos.
 */

export type LintCode = 'structure' | 'legacy-prop' | 'css-not-emitted' | 'keynote-line-height' | 'grid-fr' | 'off-theme-color';

export interface LintFinding {
  readonly severity: Severity;
  readonly code: LintCode;
  /** Ausente quando vale para todos os tamanhos. */
  readonly size?: string;
  readonly slide: number;
  readonly path: string;
  readonly message: string;
}

export interface LintOptions {
  readonly sizes: readonly SizeSpec[];
  readonly baseDir: string;
  readonly theme?: Theme;
  readonly render?: Omit<RenderOptions, 'sizes' | 'preview' | 'includePositioned' | 'baseDir' | 'theme'>;
}

/** lineHeight numérico a partir daqui desloca a 1ª linha no Keynote de forma visível (M11-G: até 2,3 pt com 1.5). */
const KEYNOTE_LINE_HEIGHT = 1.5;

const formatValue = (value: unknown): string => {
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'number' || typeof value === 'boolean') return `{${String(value)}}`;
  return '{…}';
};

interface Observed {
  readonly kind: PrimitiveKind;
  readonly path: string;
  readonly slide: number;
  readonly props: Readonly<Record<string, unknown>>;
}

const legacyFindingsOf = (observed: readonly Observed[]): readonly LintFinding[] =>
  observed.flatMap(({ kind, path, slide, props }) =>
    Object.entries(props).flatMap(([prop, value]): readonly LintFinding[] => {
      const rule = aliasRuleOf(kind, prop);
      if (rule === undefined) return [];
      return [{
        severity: 'warning',
        code: 'legacy-prop',
        slide,
        path,
        message: `Prop antiga ${prop}=${formatValue(value)} em <${kind}>: troque por ${suggestionOf(rule, value)}. As props antigas saem na 1.0; \`pptsx lint --fix\` reescreve o arquivo do deck.`,
      }];
    }),
  );

const nodesOf = (nodes: readonly PositionedNode[]): readonly PositionedNode[] =>
  nodes.flatMap((node) => (node.kind === 'box' ? [node, ...nodesOf(node.children)] : [node]));

const BARE_FR = /(^|[\s(,])(\d*\.?\d+)fr\b/;

/** `1fr` fora de `minmax(0, …)`: o track cresce até a palavra mais longa (guia §9). */
const hasBareFr = (template: string | undefined): boolean =>
  template !== undefined && BARE_FR.test(template.replace(/minmax\(\s*0\s*,[^)]*\)/g, ''));

const colorsOf = (node: PositionedNode): readonly string[] => {
  const css = node.css;
  const borders = (['top', 'right', 'bottom', 'left'] as const).flatMap((side) => (css.border[side].width > 0 ? [css.border[side].color] : []));
  const runs = node.kind === 'text' ? (node.runs ?? []).map((run) => run.color) : [];
  const own = (node.props as { readonly color?: unknown; readonly fill?: unknown; readonly stroke?: unknown });
  const props = [own.color, own.fill, own.stroke].filter((value): value is string => typeof value === 'string');
  return [css.backgroundColor, css.outline?.color, ...borders, ...runs, ...props].filter((value): value is string => typeof value === 'string');
};

const sizeFindingsOf = async (deck: DeckDefinition, size: SizeSpec, options: LintOptions, declared: ReadonlySet<string> | undefined): Promise<readonly LintFinding[]> => {
  const [result] = await render(deck, { ...options.render, sizes: [size], preview: false, includePositioned: true, baseDir: options.baseDir });
  const name = result!.size;
  const notEmitted = result!.diagnostics
    .filter((diagnostic) => diagnostic.code === 'css-not-emitted')
    .map((diagnostic): LintFinding => ({ severity: 'warning', code: 'css-not-emitted', slide: diagnostic.slide, path: diagnostic.path, message: diagnostic.message }));
  const slides = result!.positioned!.slides;
  const perNode = slides.flatMap((slide, index) =>
    nodesOf(slide.children).flatMap((node): readonly LintFinding[] => {
      const findings: LintFinding[] = [];
      const lineHeight = (node.props as { readonly lineHeight?: unknown }).lineHeight;
      if ((node.kind === 'text' || node.kind === 'table') && typeof lineHeight === 'number' && lineHeight >= KEYNOTE_LINE_HEIGHT) {
        findings.push({ severity: 'warning', code: 'keynote-line-height', slide: slide.sourceSlide, path: node.path, message: `lineHeight={${lineHeight}}: no Keynote a 1ª linha desce até ~2 pt (guia §4). Se a posição exata importa, use até 1.4 ou confira no Keynote.` });
      }
      if (node.kind === 'box' && node.css.display === 'grid' && hasBareFr(node.css.gridTemplateColumns)) {
        findings.push({ severity: 'info', code: 'grid-fr', slide: slide.sourceSlide, path: node.path, message: `gridTemplateColumns="${node.css.gridTemplateColumns}": \`1fr\` cresce até a palavra mais longa; com valores longos o grid sai do slide. Use repeat(n, minmax(0, 1fr)) (guia §3).` });
      }
      if (declared !== undefined) {
        const off = [...new Set(colorsOf(node).map((color) => color.toUpperCase()))].filter((color) => !declared.has(color));
        if (off.length > 0) findings.push({ severity: 'info', code: 'off-theme-color', size: name, slide: index + 1, path: node.path, message: `Cor fora do tema: ${off.join(', ')}. Ela fica fixa no arquivo (trocar o tema não a repinta); use uma cor do tema se ela faz parte da marca.` });
      }
      return findings;
    }),
  );
  return [...notEmitted.map((finding) => ({ ...finding, size: name })), ...perNode];
};

const keyOf = (finding: LintFinding): string => `${finding.code}|${finding.path}|${finding.message}`;

/** Achados de todos os tamanhos, sem repetir o que é igual em todos (sem `size` quando vale para todos). */
const mergeSizes = (perSize: readonly (readonly LintFinding[])[]): readonly LintFinding[] => {
  const all = perSize.flat();
  const keys = [...new Set(all.map(keyOf))];
  return keys.map((key) => {
    const same = all.filter((finding) => keyOf(finding) === key);
    const first = same[0]!;
    if (same.length < perSize.length) return first;
    const { size: _size, ...rest } = first;
    return rest;
  });
};

export const lintDeck = async (deck: DeckDefinition, options: LintOptions): Promise<readonly LintFinding[]> => {
  const observed: Observed[] = [];
  const env = {
    ...createResolveEnv(options.baseDir),
    observe: (kind: PrimitiveKind, path: string, props: Readonly<Record<string, unknown>>) => {
      const slide = observed.filter((item) => item.kind === 'slide').length + (kind === 'slide' ? 1 : 0);
      observed.push({ kind, path, slide, props });
    },
  };
  const first = resolveSize(options.sizes[0] ?? '16x9');
  try {
    const ctx = createContext(first);
    resolveDeck(deck(ctx), ctx, env);
  } catch (error) {
    if (!(error instanceof ResolveError)) throw error;
    return [{ severity: 'error', code: 'structure', slide: 0, path: error.path, message: error.message }];
  }
  const theme = options.theme === undefined ? undefined : resolveTheme(options.theme);
  const declared = theme === undefined ? undefined : new Set(theme.declared.map((name) => theme.colors[name].toUpperCase()));
  const perSize = await Promise.all(options.sizes.map((size) => sizeFindingsOf(deck, size, options, declared)));
  return groupFindings([...legacyFindingsOf(observed), ...mergeSizes(perSize)]);
};

/**
 * Irmãos com a mesma mensagem viram um achado com o path agrupado (`Box[0..3]`), como os diagnósticos:
 * quatro cartões de um `.map` com `fill` antigo são um conserto, não quatro.
 */
const groupFindings = (findings: readonly LintFinding[]): readonly LintFinding[] => {
  const asDiagnostic = (finding: LintFinding): Diagnostic => ({ ...finding, size: finding.size ?? '', code: 'css-not-emitted' }) as Diagnostic;
  const messages = [...new Set(findings.map((finding) => `${finding.code}\u0000${finding.message}`))];
  return messages.flatMap((key) => {
    const same = findings.filter((finding) => `${finding.code}\u0000${finding.message}` === key);
    const code = same[0]!.code;
    return groupDiagnostics(same.map(asDiagnostic)).map((grouped): LintFinding => {
      const { size, data: _data, ...rest } = grouped;
      return { ...rest, code, ...(size === '' ? {} : { size }) } as LintFinding;
    });
  });
};

const ORDER: Readonly<Record<Severity, number>> = { error: 0, warning: 1, info: 2 };

export const lintSummaryOf = (findings: readonly LintFinding[]): string => {
  if (findings.length === 0) return 'Lint: nada a apontar.';
  const counts = (['error', 'warning', 'info'] as const).map((severity) => `${findings.filter((f) => f.severity === severity).length} ${severity}`).join(', ');
  const lines = [...findings]
    .sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || a.slide - b.slide)
    .map((f) => `  ${f.severity === 'error' ? '✖' : f.severity === 'warning' ? '▲' : '•'} [${f.size === undefined ? '' : `${f.size} · `}slide ${f.slide}] ${f.code} em ${f.path}\n    ${f.message}`);
  return [`Lint: ${counts}`, ...lines].join('\n');
};
