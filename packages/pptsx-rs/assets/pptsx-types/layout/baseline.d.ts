import { type Node as YogaNode } from 'yoga-layout';
import type { FlexDirection } from '../core/types.ts';
import type { BuiltNode } from './tree.ts';
export declare const settleBaselineRows: (root: YogaNode, children: readonly BuiltNode[], rootDirection: FlexDirection, size: {
    readonly width: number | undefined;
    readonly height: number | undefined;
}) => void;
