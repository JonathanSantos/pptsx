import { type Theme, type ThemeColorName } from 'pptsx';
import type { TokenSource } from './tokens.ts';
/**
 * Tokens → `Theme` do núcleo (o contrato do arquivo PPTX). O mapa diz qual token vai em cada slot
 * (`accent1: 'color.accent'`) ou dá a cor direto. `checkTheme` avisa contraste abaixo do WCAG AA.
 */
export interface ThemeMap {
    readonly name?: string;
    readonly colors: Partial<Record<ThemeColorName, string>>;
    readonly fonts?: {
        readonly heading?: string;
        readonly body?: string;
    };
}
export declare const themeOf: (tokens: TokenSource, map: ThemeMap) => Theme;
export declare const contrastOf: (a: string, b: string) => number;
/** WCAG AA: 4,5 para texto normal; 3 para texto grande (títulos, números de KPI). */
export declare const AA_TEXT = 4.5;
export declare const AA_LARGE = 3;
/** Avisos de contraste (só entre slots declarados): texto (dark1/dark2) sobre fundo (light1/light2), 4,5:1; cada acento (accent1…6) sobre light1, 3:1. */
export declare const checkTheme: (theme: Theme) => readonly string[];
