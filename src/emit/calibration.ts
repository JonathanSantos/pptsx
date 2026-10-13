/**
 * Ponto único de calibração da emissão de texto. O M3 mede a diferença entre
 * a altura de linha calculada (fontkit) e a que o renderizador aplica, e
 * ajusta este fator; até lá, o multiplicador vai direto para o pptx.
 */
export const LINE_SPACING_CALIBRATION = 1;

export const lineSpacingMultipleOf = (lineHeight: number): number => lineHeight * LINE_SPACING_CALIBRATION;
