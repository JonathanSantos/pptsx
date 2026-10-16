import type { DocumentProperties, LineBreaks, PositionedDeck, ResolvedTheme } from '../core/types.ts';
import type { LineSpacingStrategy } from './calibration.ts';
import { type EmbeddedFont } from './embed.ts';
export interface EmitOptions {
    readonly debug?: boolean;
    readonly baseDir: string;
    /** Sobrescreve ACTIVE_LINE_SPACING (ex.: o script de calibração gera as duas variantes). */
    readonly lineSpacing?: LineSpacingStrategy;
    /** Idioma dos textos; padrão DEFAULTS.lang. */
    readonly lang?: string;
    /** 'forced' (padrão DEFAULTS.lineBreaks) ou 'auto'; ver runsOf em options.ts. */
    readonly lineBreaks?: LineBreaks;
    /** M8: faces a embutir (EOT pronto, ver src/emit/embed.ts); ausente ou vazio = sem embed. */
    readonly embedFonts?: readonly EmbeddedFont[];
    /** M15: tema do arquivo (cores e fontes); ausente = arquivo como antes. */
    readonly theme?: ResolvedTheme;
    /** M15: título, autor, empresa, assunto e palavras-chave do arquivo. */
    readonly document?: DocumentProperties;
}
export type { EmbeddedFont } from './embed.ts';
export { outputSectionsOf, type OutputSection } from './sections.ts';
export { paintOrderOf, placementOf, type PaintItem, type Placement, type Rotation } from './paint.ts';
export { boxShapeOf, decorationOf, uniformBorderOf, type Decoration } from './decoration.ts';
export { ACTIVE_LINE_SPACING, LINE_SPACING_CALIBRATION, type LineSpacingStrategy } from './calibration.ts';
export declare const emitPptx: (deck: PositionedDeck, options: EmitOptions) => Promise<Buffer>;
