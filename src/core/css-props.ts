/**
 * M11 — o que o AUTOR escreve no JSX: as props atuais de cada primitiva mais as propriedades
 * CSS suportadas (camelCase). Números são pt; strings passam como em CSS ('50%', '1fr',
 * '2px solid #2F6FED', 'repeat(3, 1fr)'); 'px' vale como pt. Toda prop aceita valor
 * responsivo ({ base, tall, wide, ... }).
 */
import type {
  BoxProps,
  ChartProps,
  Color,
  ImageProps,
  Responsive,
  ResponsiveProps,
  ShapeProps,
  SlideProps,
  SpanProps,
  TableProps,
  TextProps,
} from './types.ts';

type Num = number;
/** Comprimento CSS: número (pt), 'Npx', 'Npt' ou 'N%'. */
export type CssLengthInput = Num | `${number}px` | `${number}pt` | `${number}%`;
type MarginInput = CssLengthInput | 'auto';
/** Shorthand de 1 a 4 valores ('8 16', '8px auto') ou número. */
type BoxShorthand = Num | string;

export interface CssBoxProps {
  readonly display?: 'flex' | 'block' | 'grid' | 'none';
  readonly position?: 'static' | 'relative' | 'absolute';
  readonly top?: CssLengthInput;
  readonly right?: CssLengthInput;
  readonly bottom?: CssLengthInput;
  readonly left?: CssLengthInput;
  readonly inset?: BoxShorthand;
  readonly width?: CssLengthInput;
  readonly height?: CssLengthInput;
  readonly minWidth?: CssLengthInput;
  readonly maxWidth?: CssLengthInput;
  readonly minHeight?: CssLengthInput;
  readonly maxHeight?: CssLengthInput;
  readonly aspectRatio?: Num | string;
  readonly boxSizing?: 'border-box';
  readonly flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
  readonly flexWrap?: 'nowrap' | 'wrap' | 'wrap-reverse';
  readonly justifyContent?: 'flex-start' | 'start' | 'center' | 'flex-end' | 'end' | 'space-between' | 'space-around' | 'space-evenly';
  readonly alignItems?: 'flex-start' | 'start' | 'center' | 'flex-end' | 'end' | 'stretch' | 'baseline';
  readonly alignContent?: 'flex-start' | 'start' | 'center' | 'flex-end' | 'end' | 'stretch' | 'space-between' | 'space-around' | 'space-evenly';
  readonly alignSelf?: 'auto' | 'flex-start' | 'start' | 'center' | 'flex-end' | 'end' | 'stretch' | 'baseline';
  readonly justifySelf?: 'auto' | 'start' | 'center' | 'end' | 'stretch';
  readonly justifyItems?: 'start' | 'center' | 'end' | 'stretch';
  readonly placeItems?: string;
  readonly placeSelf?: string;
  readonly flex?: Num | string;
  readonly flexGrow?: Num;
  readonly flexShrink?: Num;
  readonly flexBasis?: CssLengthInput | 'auto';
  readonly order?: Num;
  readonly gap?: Num | string;
  readonly rowGap?: CssLengthInput;
  readonly columnGap?: CssLengthInput;
  readonly margin?: Num | string | { readonly top?: Num; readonly right?: Num; readonly bottom?: Num; readonly left?: Num };
  readonly marginTop?: MarginInput;
  readonly marginRight?: MarginInput;
  readonly marginBottom?: MarginInput;
  readonly marginLeft?: MarginInput;
  readonly paddingTop?: CssLengthInput;
  readonly paddingRight?: CssLengthInput;
  readonly paddingBottom?: CssLengthInput;
  readonly paddingLeft?: CssLengthInput;
  readonly border?: Num | string;
  readonly borderTop?: Num | string;
  readonly borderRight?: Num | string;
  readonly borderBottom?: Num | string;
  readonly borderLeft?: Num | string;
  readonly borderWidth?: Num | string;
  readonly borderColor?: Color;
  readonly borderStyle?: 'solid' | 'dashed' | 'dotted' | 'none';
  readonly borderRadius?: Num | string;
  /** Contorno que não ocupa espaço ('1px solid #ccc'; número = largura). Só sólido no PPTX. */
  readonly outline?: Num | string;
  readonly outlineColor?: Color;
  readonly outlineWidth?: CssLengthInput;
  readonly backgroundColor?: Color;
  readonly backgroundImage?: string;
  readonly boxShadow?: string;
  readonly opacity?: Num;
  readonly transform?: string;
  readonly rotate?: Num | string;
  readonly zIndex?: Num;
  readonly overflow?: 'visible' | 'hidden';
  readonly gridTemplateColumns?: string;
  readonly gridTemplateRows?: string;
  readonly gridAutoRows?: string;
  readonly gridAutoColumns?: string;
  readonly gridAutoFlow?: 'row';
  readonly gridColumn?: Num | string;
  readonly gridRow?: Num | string;
  readonly gridColumnStart?: Num | string;
  readonly gridColumnEnd?: Num | string;
  readonly gridRowStart?: Num | string;
  readonly gridRowEnd?: Num | string;
  /** Escape: qualquer CSS; o que não tem de/para vira diagnóstico css-not-emitted. */
  readonly style?: Readonly<Record<string, unknown>>;
}

/** Propriedades de texto herdadas (valem em Slide/Box e descem para os Text). */
export interface CssTextProps {
  readonly fontFamily?: string;
  readonly fontSize?: CssLengthInput;
  readonly fontWeight?: 'normal' | 'bold' | 'regular' | Num;
  readonly fontStyle?: 'normal' | 'italic';
  readonly color?: Color;
  readonly lineHeight?: Num | 'normal';
  readonly textAlign?: 'left' | 'center' | 'right' | 'start' | 'end';
  readonly letterSpacing?: CssLengthInput;
  readonly textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  readonly textDecoration?: 'none' | 'underline' | 'line-through' | 'underline line-through';
}

type Css = CssBoxProps & CssTextProps;
// `padding`/`margin` das props antigas são objetos; em CSS também aceitam string.
type Legacy<P> = Omit<P, 'padding'> & { readonly padding?: Num | string | { readonly top?: Num; readonly right?: Num; readonly bottom?: Num; readonly left?: Num } };
type WithCss<P> = ResponsiveProps<Omit<Legacy<P>, keyof Css> & Css> & { readonly children?: unknown };

export type CssSlideProps = WithCss<SlideProps>;
export type CssBoxPropsAuthor = WithCss<BoxProps>;
export type CssTextPropsAuthor = WithCss<TextProps> & {
  readonly whiteSpace?: Responsive<'normal' | 'nowrap'>;
};
export type CssImagePropsAuthor = WithCss<ImageProps> & { readonly objectFit?: Responsive<'contain' | 'cover'> };
export type CssShapePropsAuthor = WithCss<ShapeProps>;
export type CssChartPropsAuthor = WithCss<ChartProps>;
/** Em Table, `border` continua sendo a cor das linhas da grade (prop da engine). */
export type CssTablePropsAuthor = ResponsiveProps<Omit<TableProps, keyof Css | 'border'> & Omit<Css, 'border'>> & {
  readonly border?: Responsive<Color>;
};
export interface CssSpanProps extends SpanProps {
  readonly fontWeight?: 'normal' | 'bold' | 'regular' | Num;
  readonly fontStyle?: 'normal' | 'italic';
  readonly textDecoration?: 'none' | 'underline' | 'line-through' | 'underline line-through';
}
