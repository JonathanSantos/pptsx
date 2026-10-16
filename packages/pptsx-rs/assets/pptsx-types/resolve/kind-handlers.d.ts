import type { PrimitiveKind } from '../core/types.ts';
import type { Handler } from './draft.ts';
export declare const KIND_HANDLERS: Readonly<Record<PrimitiveKind, Readonly<Record<string, Handler>>>>;
