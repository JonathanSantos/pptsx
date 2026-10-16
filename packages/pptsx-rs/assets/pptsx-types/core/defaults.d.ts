import type { Color, CssStyle, Align, ChartProps, FitPolicy, FlexDirection, FontWeight, ImageFit, ImageProps, Justify, LineBreaks, Pt, ArrowType, ShapeKind, ShapeProps, Spacing, TableFitPolicy, TableHeaderStyle, TableProps, TextAlign, TextProps, TextStyle } from './types.ts';
/**
 * Padrões únicos da engine. Os módulos nunca repetem esses valores:
 * importam daqui ou usam os helpers abaixo.
 */
export declare const DEFAULTS: {
    readonly text: {
        readonly font: 'Arial';
        readonly size: 18;
        readonly weight: 'regular';
        readonly italic: false;
        readonly color: '#000000';
        /** M11 (CSS): 'normal' = altura natural da face; número = múltiplo do size. */
        readonly lineHeight: number | 'normal';
        readonly align: TextAlign;
        readonly fit: FitPolicy;
        /** minSize = max(floor(size * minSizeRatio), minLegibleSize) quando não informado */
        readonly minSizeRatio: 0.75;
        /**
         * Piso de legibilidade (pt). O shrink sem minSize explícito não desce abaixo;
         * com minSize explícito menor, desce e avisa com text-illegible.
         */
        readonly minLegibleSize: 10;
        /**
         * M13: corpo do sobrescrito/subscrito em relação ao do texto. O renderizador reduz sozinho quando
         * o run tem `baseline` (o emissor não grava `sz` menor); 2/3 medido no Keynote (relatório M13-3).
         */
        readonly superscriptRatio: number;
        /** M13: deslocamento da baseline em % do corpo (OOXML `baseline` = valor × 1000). */
        readonly superscriptBaseline: 30;
        readonly subscriptBaseline: -25;
        /** M13: Text paginate nunca deixa menos que isto de um parágrafo num lado do corte. */
        readonly orphanLines: 2;
        /** M13: pesos canônicos e a distância (em unidades de peso) a partir da qual a face escolhida avisa. */
        readonly weights: {
            readonly regular: 400;
            readonly bold: 700;
        };
        readonly weightTolerance: 100;
        /** M13: conteúdo usado para medir um SlideNumber antes de saber o número (pior caso). */
        readonly slideNumberSample: {
            readonly n: '88';
            readonly total: '88 / 88';
        };
    };
    readonly container: {
        readonly direction: FlexDirection;
        readonly gap: 0;
        readonly padding: 0;
        readonly align: Align;
        readonly justify: Justify;
    };
    /**
     * Item flex: shrink 1 como no CSS (texto numa row quebra em vez de vazar) e
     * grow > 0 implica basis 0 (grow={1} = flex: 1, colunas iguais).
     */
    readonly item: {
        readonly shrink: 1;
    };
    readonly strokeWidth: 1;
    /** Shape 'line' sem stroke seria invisível; recebe esta cor. */
    readonly lineStroke: '#000000';
    readonly imageFit: ImageFit;
    readonly lang: 'pt-BR';
    /** Quebra forçada por padrão: o renderizador desenha exatamente as linhas calculadas. */
    readonly lineBreaks: LineBreaks;
    /** M8: fontes embutidas desligadas por padrão (tamanho do arquivo e licença da fonte). */
    readonly embedFonts: false;
    /**
     * M15: tema do arquivo. Cores ausentes do autor = as do tema Office (as que o pptxgenjs grava);
     * `schemes` é o nome de cada cor no XML (`<a:schemeClr val>`, nos slides: tx1/bg1 em vez de dk1/lt1)
     * e a ordem é a de desempate quando duas cores do tema têm o mesmo hex (acentos primeiro).
     */
    readonly theme: {
        readonly name: 'pptsx';
        readonly colors: {
            readonly dark1: '#000000';
            readonly light1: '#FFFFFF';
            readonly dark2: '#44546A';
            readonly light2: '#E7E6E6';
            readonly accent1: '#4472C4';
            readonly accent2: '#ED7D31';
            readonly accent3: '#A5A5A5';
            readonly accent4: '#FFC000';
            readonly accent5: '#5B9BD5';
            readonly accent6: '#70AD47';
            readonly hyperlink: '#0563C1';
            readonly followedHyperlink: '#954F72';
        };
        readonly schemes: readonly (readonly [string, string])[];
    };
    /** M15: seção que recebe os slides antes da 1ª seção do autor (o PowerPoint exige todo slide numa seção). */
    readonly defaultSection: 'Seção padrão';
    /**
     * M15: placeholder do autor → tipo do PowerPoint (`<p:ph type>`); outros nomes → 'body'.
     * `firstIndex`: idx dos placeholders que não são título (o título não leva idx).
     */
    readonly placeholder: {
        readonly types: Readonly<Record<string, string>>;
        readonly fallbackType: 'body';
        readonly firstIndex: 10;
        /** Texto de exemplo do placeholder vazio ("Novo slide" no PowerPoint); outros nomes usam o próprio nome. */
        readonly prompts: Readonly<Record<string, string>>;
        /** Ids dos shapes que o pós-processamento põe no layout (longe dos que o pptxgenjs numera a partir de 2). */
        readonly firstShapeId: 1000;
    };
    /** Largura de quebra = disponível * textSafety; a caixa sai com a largura cheia. */
    readonly textSafety: 0.97;
    /** Limite de RODADAS do loop de ajuste (uma rodada = uma busca binária por escopo disparado). */
    readonly maxFitIterations: 12;
    /** epsilon: tolerância (pt) na detecção de overflow. shrinkStep: granularidade (pt) do size na busca. */
    readonly fit: {
        readonly epsilon: 0.5;
        readonly shrinkStep: 1;
    };
    /** M8: debounce do --watch (ms). */
    readonly watchDebounceMs: 150;
    /** M9: 'tall' ⇔ aspect < tallAspect; 'wide' ⇔ scale > wideScale (ver core/responsive.ts). */
    readonly breakpoints: {
        readonly tallAspect: 1.5;
        readonly wideScale: 1.2;
    };
    /**
     * M19: `<Container>`. `narrow`/`short` = limites (pt) da largura/altura medidas para os breakpoints de contêiner;
     * `maxDepth` = níveis de Container aninhado (uma passada de layout a mais por nível); passou → container-depth.
     */
    readonly containerQuery: {
        readonly narrow: 480;
        readonly short: 240;
        readonly maxDepth: 3;
    };
    /** M9: máximo de partes em que um slide com Box paginate pode se dividir; passou → box-overflow. */
    readonly paginate: {
        readonly maxParts: 10;
    };
    /** M10: gráfico nativo. Paleta cíclica por série/categoria; tipografia de rótulos, eixos, legenda e título. */
    readonly chart: {
        readonly palette: readonly string[];
        readonly labelSize: 12;
        readonly labelColor: '#333333';
        /** Espaço entre grupos de barras em % da largura da barra (OOXML gapWidth). */
        readonly barGapWidthPct: 80;
        /** Espessura da linha (pt) no gráfico de linhas. */
        readonly lineSize: 2;
        /** Largura da borda (pt) ao redor do gráfico; 0 = sem borda. */
        readonly borderWidth: 0;
        /** M14: furo do doughnut em % do diâmetro. */
        readonly holeSize: 50;
        /** M14: tamanho (pt) do marcador de ponto (scatter, line/combo com markers). */
        readonly markerSize: 6;
        /** M14: área preenchida com esta opacidade (0..1) no preview e no PPTX. */
        readonly areaOpacity: 0.85;
    };
    /** M10: tabela nativa. Células com o mesmo size; margem interna por lado; cabeçalho em negrito sem fundo. */
    readonly table: {
        readonly size: 14;
        readonly cellPadding: 4;
        readonly header: TableHeaderStyle;
        readonly fit: TableFitPolicy;
        /** Espessura das bordas (pt) quando `border` é informado. */
        readonly borderWidth: 0.5;
        /**
         * M11: passo (pt) a que a altura de cada linha é arredondada PARA CIMA já no layout, porque o
         * Keynote/PowerPoint só crescem a linha quando falta espaço; assim frame, fit, emissão e preview
         * usam a mesma altura (achado M10-H: drift de até 0,4 pt por linha).
         */
        readonly rowHeightStep: 0.5;
        /** M14: espaço (pt) entre o ícone de uma célula e o texto. */
        readonly iconGap: 4;
    };
    /** 16:9 de referência para ctx.scale */
    readonly referenceSize: {
        readonly width: 720;
        readonly height: 405;
    };
    /** M11: padrões do modelo CSS (vindos da PoC). */
    readonly css: {
        /** Box sem `display` continua flex column (a única diferença intencional em relação ao browser); `display: 'flex'` explícito é row. */
        readonly boxDisplay: 'flex';
        readonly legacyDirection: 'column';
        readonly cssFlexDirection: 'row';
        readonly flexShrink: 1;
        readonly flexGrow: 0;
        readonly order: 0;
        readonly opacity: 1;
        /** Espessura de `border: solid #000` sem largura (CSS: medium). */
        readonly borderMediumWidth: 3;
        readonly degreesPerTurn: 360;
        readonly radiansToDegrees: number;
        /** `font-weight` numérico a partir do qual a face é bold (a engine tem só regular/bold). */
        readonly boldWeightFrom: 600;
        readonly regularWeight: 400;
        readonly boldWeight: 700;
        readonly percentBase: 100;
        readonly colorChannelMax: 255;
        /** Ruído de ponto flutuante do Yoga ao comparar frames. */
        readonly layoutNoise: 0.000001;
        /** Tolerância (pt) das comparações com fixtures do browser. */
        readonly frameTolerance: 1;
        /** PPTX: transparência é 0..100. */
        readonly transparencyScale: 100;
    };
    readonly preview: {
        readonly width: 1280;
        readonly thumbWidth: 320;
        readonly overviewColumns: 4;
    };
    /** M17: `renderFragment` — margem do slide em volta do elemento isolado (catálogo de componentes). */
    readonly fragment: {
        readonly padding: 24;
        readonly labelSize: 9;
        readonly labelColor: '#5B6680';
        readonly labelTop: 6;
    };
    /** M16-4: `pptsx preview --serve` — porta padrão, tamanhos do seletor e largura do SVG servido. */
    readonly previewServer: {
        readonly port: 4321;
        readonly sizes: readonly string[];
        readonly widthPx: 960;
    };
    /**
     * M12: formas. `pptx[kind]` = `prstGeom` emitido e os ajustes (`adj`, em 1/100000 como no
     * OOXML) que o PPTX usa por padrão; o preview (src/preview/shapes.ts) desenha com esses mesmos
     * números para bater com o Keynote/PowerPoint. A engine não muda os ajustes (só `roundRect`/`pill`,
     * pelo raio).
     */
    readonly shape: {
        readonly pptx: Readonly<Record<ShapeKind, {
            readonly prst: string;
            readonly adj: Readonly<Record<string, number>>;
        }>>;
        /** Escala dos `adj` do OOXML (100000 = 100 %). */
        readonly adjScale: 100000;
        /**
         * Ponta de seta OOXML `w="med" len="med"`: largura e comprimento = 3 × a espessura da linha,
         * com um mínimo para linhas finas não sumirem com a seta (o PowerPoint/Keynote fazem igual).
         */
        readonly arrow: {
            readonly widthFactor: 3;
            readonly lengthFactor: 3;
            readonly minSize: 4.5;
        };
    };
    /** M12: Path sem fill nem stroke recebe este fill (como o SVG, que pinta de preto). */
    readonly path: {
        readonly fill: '#000000';
    };
    /** M12: ícone SVG. `rasterScale`: a imagem sai com 2× a largura final em px, para ficar nítida. */
    readonly icon: {
        readonly size: 24;
        readonly rasterScale: 2;
        readonly pxPerPt: number;
    };
    /** M12: conector entre nós. */
    readonly connector: {
        readonly stroke: '#333333';
        readonly strokeWidth: 1.5;
        readonly endArrow: ArrowType;
        readonly startArrow: ArrowType;
        /** Cotovelo com o mesmo lado nas duas pontas: a dobra sai para fora dos nós esta distância (pt). */
        readonly elbowOffset: 16;
        /** Rótulo: tipografia, respiro (pt) entre o texto e o fundo. */
        readonly label: {
            readonly size: 12;
            readonly color: '#333333';
            readonly padding: 3;
        };
    };
};
export declare const PT_PER_INCH = 72;
/** Imagens: 1 px CSS = 1/96 pol; é o tamanho "natural" e o limite de upscale. */
export declare const PT_PER_PX: number;
export declare const textStyleOf: (props: TextProps) => TextStyle;
/** M13: peso numérico de um FontWeight ('regular' = 400, 'bold' = 700). */
export declare const weightValueOf: (weight: FontWeight) => number;
/** M13: forma canônica: 400 → 'regular', 700 → 'bold', o resto numérico. */
export declare const canonicalWeightOf: (weight: FontWeight) => FontWeight;
export declare const fitPolicyOf: (props: TextProps) => FitPolicy;
/** Sem minSize do autor, o piso é o maior entre a proporção e o mínimo legível; com minSize, vale o do autor. */
export declare const minSizeOf: (props: TextProps) => Pt;
export declare const imageFitOf: (props: ImageProps) => ImageFit;
export interface Edges {
    readonly top: Pt;
    readonly right: Pt;
    readonly bottom: Pt;
    readonly left: Pt;
}
export declare const edgesOf: (spacing: Spacing | undefined) => Edges;
/** M16: eixo principal de um contêiner, lido do CSS (row-reverse conta como row). */
export declare const flexDirectionOf: (css: CssStyle) => FlexDirection;
/** M16: gap no eixo principal (columnGap numa row, rowGap numa column). */
export declare const mainGapOf: (css: CssStyle) => Pt;
/** M16: fundo do slide pelo CSS: imagem vence cor; nenhum dos dois = sem fundo. */
export declare const slideBackgroundOf: (css: CssStyle) => Color | {
    readonly image: string;
} | undefined;
/** Cor de contorno efetiva: linha e colchetes sempre têm cor, os demais só se o autor pediu. */
export declare const strokeColorOf: (props: ShapeProps) => string | undefined;
/** M12: pintura efetiva de um Path: o do autor; sem fill nem stroke, fill preto (como o SVG). */
export declare const pathPaintOf: (props: {
    readonly fill?: string;
    readonly stroke?: string;
}) => {
    readonly fill?: string;
    readonly stroke?: string;
};
/** M12: tamanho de uma ponta de seta (pt) para uma linha de espessura `width`. */
export declare const arrowSizeOf: (width: Pt) => {
    readonly width: Pt;
    readonly length: Pt;
};
/** M10: estilo de texto efetivo das células da tabela (todas iguais). */
export declare const tableStyleOf: (props: TableProps) => TextStyle;
export declare const tableFitOf: (props: TableProps) => TableFitPolicy;
/** Mesma regra do Text: 75% do size com piso legível, salvo minSize do autor. */
export declare const tableMinSizeOf: (props: TableProps) => Pt;
/** Cabeçalho efetivo; `false` = sem linha de cabeçalho (undefined aqui). */
export declare const tableHeaderOf: (props: TableProps) => TableHeaderStyle | undefined;
/** M10: tipografia dos rótulos do gráfico. */
export declare const chartLabelStyleOf: (props: ChartProps) => {
    family: string;
    size: Pt;
    color: string;
};
/** Cor da i-ésima série/categoria: as do autor e, faltando, a paleta cíclica. */
export declare const chartColorOf: (props: ChartProps, index: number) => string;
/** Legenda: explícita, senão só com mais de uma série (pie sempre). */
export declare const chartLegendOf: (props: ChartProps) => boolean;
