export declare const segmentsOf: (path: string) => readonly string[];
/** Segmento que não é primitiva = nome de componente (o sufixo [i] não conta). */
export declare const isComponentSegment: (segment: string) => boolean;
/** O próprio nó e seus ancestrais, do mais próximo ao mais distante, sem o slide. */
export declare const selfAndAncestors: (path: string) => readonly string[];
/** Ancestrais estritos, do mais próximo ao mais distante, incluindo o slide. */
export declare const ancestorsOf: (path: string) => readonly string[];
/** O nó é o próprio escopo ou está dentro dele. */
export declare const isWithin: (path: string, scope: string) => boolean;
/**
 * Escopo do shrink: a raiz de componente mais próxima (o próprio Text conta se for
 * raiz de um componente), excluindo o slide; sem nenhuma, o filho de primeiro nível
 * do slide. Assim um título num componente separado não encolhe junto com o corpo.
 */
export declare const scopeOf: (path: string) => string;
