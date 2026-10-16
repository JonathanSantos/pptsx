import type { PrimitiveKind, PrimitivePropsMap } from '../core/types.ts';
import type { Normalized } from './normalize.ts';
export type LegacyProps<K extends PrimitiveKind> = Omit<PrimitivePropsMap[K], 'children'>;
export declare const legacyPropsOf: <K extends PrimitiveKind>(kind: K, normalized: Normalized) => LegacyProps<K>;
