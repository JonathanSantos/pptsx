import type { FontWeight, RunFace, TextMeasurer } from '../core/types.ts';
import type { FaceMatch, FontRegistry } from './registry.ts';
export interface FontkitMeasurerOptions {
    /** Fator sobre maxWidth na quebra; padrão DEFAULTS.textSafety. */
    readonly safety?: number;
}
/**
 * M13: o que o PPTX recebe para a face escolhida. 400/700 = família do autor + flag negrito;
 * outro peso = nome de família da própria face (name ID 1, ex.: "Inter SemiBold") sem negrito,
 * que é como PowerPoint/Keynote acham a face instalada ou embutida.
 */
export declare const runFaceOf: (family: string, match: FaceMatch, wanted: FontWeight) => RunFace;
/** Medidor com métricas reais (fontkit). Alguma face dos runs não registrada → estimativa com fontMissing. */
export declare const createFontkitMeasurer: (registry: FontRegistry, options?: FontkitMeasurerOptions) => TextMeasurer;
