import type { IconContent, IconProps, Rect } from '../core/types.ts';
/**
 * Icon (M12-4): a leitura do arquivo é a única IO do resolve e vem injetada (`ResolveEnv`); o
 * render passa uma que resolve `src` contra o baseDir. Sem env, relativo ao cwd.
 */
export interface ResolveEnv {
    /** Conteúdo (texto) de um asset do deck, ex.: o SVG de um Icon. */
    readonly readAsset: (src: string) => string;
}
export declare const createResolveEnv: (baseDir?: string) => ResolveEnv;
type IconResolvedProps = Omit<IconProps, 'children'>;
export interface IconGeometry {
    readonly viewBox: Rect;
    readonly content: IconContent;
}
export declare const iconGeometryOf: (props: IconResolvedProps, path: string, env: ResolveEnv) => IconGeometry;
export {};
