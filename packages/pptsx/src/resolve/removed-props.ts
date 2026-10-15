import type { PrimitiveKind } from '../core/types.ts';

/**
 * M16-5/M18-6: as props da 0.x removidas na 1.0 e a troca por CSS. O resolve recusa cada uma com a troca
 * (`RemovedPropError`) e o `pptsx lint --fix` / `--from 0.x` reescreve o fonte com esta tabela. Sem
 * `values`, só o nome muda; com `values`, o codemod só reescreve valor literal. Os casos especiais
 * (direction no Box, stroke/strokeWidth, background={{ image }}, italic) ficam no codemod.
 */

export interface AliasRule {
  readonly prop: string;
  readonly kinds: readonly PrimitiveKind[];
  /** Nome CSS que substitui. */
  readonly css: string;
  /** Valor antigo → valor CSS (literal). Ausente = mesmo valor. */
  readonly values?: Readonly<Record<string, string>>;
  /** Precisa de tratamento próprio no codemod. */
  readonly special?: 'direction-box' | 'stroke' | 'background' | 'italic' | 'grow';
}

const ITEMS: readonly PrimitiveKind[] = ['box', 'text', 'image', 'shape', 'chart', 'table', 'path', 'icon', 'slideNumber'];
const TEXTS: readonly PrimitiveKind[] = ['text', 'slideNumber'];
const ALIGN = { start: 'flex-start', end: 'flex-end', center: 'center', stretch: 'stretch', baseline: 'baseline' };
const JUSTIFY = { start: 'flex-start', end: 'flex-end', center: 'center', between: 'space-between', around: 'space-around', evenly: 'space-evenly' };

export const ALIAS_RULES: readonly AliasRule[] = [
  { prop: 'direction', kinds: ['box'], css: 'display', special: 'direction-box' },
  { prop: 'direction', kinds: ['slide'], css: 'flexDirection' },
  { prop: 'align', kinds: ['box', 'slide'], css: 'alignItems', values: ALIGN },
  { prop: 'align', kinds: TEXTS, css: 'textAlign' },
  { prop: 'justify', kinds: ['box', 'slide'], css: 'justifyContent', values: JUSTIFY },
  { prop: 'grow', kinds: ITEMS, css: 'flex', special: 'grow' },
  { prop: 'shrink', kinds: ITEMS, css: 'flexShrink' },
  { prop: 'fill', kinds: ['box', 'slide'], css: 'backgroundColor' },
  { prop: 'stroke', kinds: ['box'], css: 'outline', special: 'stroke' },
  { prop: 'strokeWidth', kinds: ['box'], css: 'outline', special: 'stroke' },
  { prop: 'radius', kinds: ['box'], css: 'borderRadius' },
  { prop: 'background', kinds: ['slide'], css: 'backgroundColor', special: 'background' },
  { prop: 'size', kinds: [...TEXTS, 'table'], css: 'fontSize' },
  { prop: 'weight', kinds: [...TEXTS, 'span'], css: 'fontWeight' },
  { prop: 'italic', kinds: [...TEXTS, 'span'], css: 'fontStyle', special: 'italic' },
  { prop: 'font', kinds: [...TEXTS, 'table'], css: 'fontFamily' },
  { prop: 'fit', kinds: ['image'], css: 'objectFit' },
  // Não é CSS: o nome da 1.0 no Chart (labels também aceita boolean).
  { prop: 'showValues', kinds: ['chart'], css: 'labels' },
];

export const aliasRuleOf = (kind: PrimitiveKind, prop: string): AliasRule | undefined =>
  ALIAS_RULES.find((rule) => rule.prop === prop && rule.kinds.includes(kind));

/** Como o lint escreve a troca sugerida ("direction="row" → display="flex""). */
export const suggestionOf = (rule: AliasRule, value: unknown): string => {
  if (rule.special === 'direction-box') return value === 'row' ? 'display="flex"' : 'flexDirection="column" (ou nada: Box sem display já é coluna)';
  if (rule.special === 'stroke') return 'outline="<largura>px solid <cor>" (como o stroke antigo, não ocupa espaço)';
  if (rule.special === 'background') return typeof value === 'object' ? 'backgroundImage="url(…)"' : 'backgroundColor';
  if (rule.special === 'italic') return 'fontStyle="italic"';
  // grow={0} era basis auto (altura do conteúdo); flex={0} do CSS é `0 1 0%` e zera o item.
  if (rule.special === 'grow') return value === 0 ? 'flexGrow={0}' : typeof value === 'number' ? `flex={${value}}` : 'flex={n} quando n > 0, flexGrow={0} (ou flex="0 1 auto") quando 0';
  if (rule.values !== undefined && typeof value === 'string' && rule.values[value] !== undefined) return `${rule.css}="${rule.values[value]}"`;
  return rule.css;
};
