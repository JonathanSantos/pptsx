import type { PathCommand, PathProps, Rect } from '../core/types.ts';
/** Path (M12-3): `d` normalizado e viewBox efetivo. `d` fora do subconjunto não derruba o build: vira `problem`. */
type PathResolvedProps = Omit<PathProps, 'children'>;
export interface PathGeometry {
    readonly commands: readonly PathCommand[];
    readonly viewBox: Rect;
    readonly problem?: string;
}
export declare const pathGeometryOf: (props: PathResolvedProps, path: string) => PathGeometry;
export {};
