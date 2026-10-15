// Gerado por tools/schema/generate.ts a partir de AuthorPropsMap (src/core/types.ts). Não edite à mão.
/* eslint-disable */
export const PROPS_SCHEMA = {
  "deck": {
    "type": "object",
    "properties": {
      "footer": {
        "type": "string | number | boolean | SlideElement | readonly Child[]",
        "description": "M13: conteúdo repetido em todo slide (rodapé, número), entra como último filho de cada slide com `position: absolute` (o autor posiciona com bottom/left/right). Repete nas partes paginadas."
      },
      "sections": {
        "type": "readonly DeckSection[]",
        "description": "M15: seções do arquivo (painel de slides do PowerPoint), em ordem crescente de `from`. Os números são do <Deck> do autor; a paginação é traduzida. Slides antes da 1ª seção vão numa seção padrão."
      }
    },
    "required": []
  },
  "slide": {
    "type": "object",
    "properties": {
      "align": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | \"baseline\" | ResponsiveValue<Align>",
        "description": "align-items; padrão 'stretch'"
      },
      "alignContent": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | \"flex-start\" | \"flex-end\" | \"space-between\" | \"space-around\" | \"space-evenly\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\" | \"flex-start\" | \"flex-end\" | \"space-between\" | \"space-around\" | \"space-evenly\">"
      },
      "alignItems": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | \"baseline\" | \"flex-start\" | \"flex-end\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\" | \"baseline\" | \"flex-start\" | \"flex-end\">"
      },
      "alignSelf": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | \"baseline\" | \"flex-start\" | \"flex-end\" | \"auto\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\" | \"baseline\" | \"flex-start\" | \"flex-end\" | \"auto\">"
      },
      "aspectRatio": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "background": {
        "type": "string | { readonly image: string; } | ResponsiveValue<string | { readonly image: string; }>",
        "description": "Cor hex ou caminho de imagem."
      },
      "backgroundColor": {
        "type": "string | ResponsiveValue<string>"
      },
      "backgroundImage": {
        "type": "string | ResponsiveValue<string>"
      },
      "border": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderBottom": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderColor": {
        "type": "string | ResponsiveValue<string>"
      },
      "borderLeft": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderRadius": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderRight": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderStyle": {
        "type": "\"none\" | \"solid\" | \"dashed\" | \"dotted\" | ResponsiveValue<\"none\" | \"solid\" | \"dashed\" | \"dotted\">"
      },
      "borderTop": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderWidth": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "bottom": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "boxShadow": {
        "type": "string | ResponsiveValue<string>"
      },
      "boxSizing": {
        "type": "\"border-box\" | ResponsiveValue<\"border-box\">"
      },
      "color": {
        "type": "string | ResponsiveValue<string>"
      },
      "columnGap": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "direction": {
        "type": "\"row\" | \"column\" | ResponsiveValue<FlexDirection>",
        "description": "padrão 'column'"
      },
      "display": {
        "type": "\"flex\" | \"block\" | \"grid\" | \"none\" | ResponsiveValue<\"flex\" | \"block\" | \"grid\" | \"none\">"
      },
      "flex": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "flexBasis": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<CssLengthInput | \"auto\">"
      },
      "flexDirection": {
        "type": "\"row\" | \"column\" | \"row-reverse\" | \"column-reverse\" | ResponsiveValue<\"row\" | \"column\" | \"row-reverse\" | \"column-reverse\">"
      },
      "flexGrow": {
        "type": "number | ResponsiveValue<number>"
      },
      "flexShrink": {
        "type": "number | ResponsiveValue<number>"
      },
      "flexWrap": {
        "type": "\"nowrap\" | \"wrap\" | \"wrap-reverse\" | ResponsiveValue<\"nowrap\" | \"wrap\" | \"wrap-reverse\">"
      },
      "fontFamily": {
        "type": "string | ResponsiveValue<string>"
      },
      "fontSize": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "fontStyle": {
        "type": "\"normal\" | \"italic\" | ResponsiveValue<\"normal\" | \"italic\">"
      },
      "fontWeight": {
        "type": "number | \"normal\" | \"bold\" | \"regular\" | ResponsiveValue<number | \"normal\" | \"bold\" | \"regular\">"
      },
      "gap": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridAutoColumns": {
        "type": "string | ResponsiveValue<string>"
      },
      "gridAutoFlow": {
        "type": "\"row\" | ResponsiveValue<\"row\">"
      },
      "gridAutoRows": {
        "type": "string | ResponsiveValue<string>"
      },
      "gridColumn": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridColumnEnd": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridColumnStart": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridRow": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridRowEnd": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridRowStart": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridTemplateColumns": {
        "type": "string | ResponsiveValue<string>"
      },
      "gridTemplateRows": {
        "type": "string | ResponsiveValue<string>"
      },
      "height": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "hidden": {
        "type": "boolean | ResponsiveValue<boolean>",
        "description": "M15: slide oculto (pulado na apresentação; continua no arquivo). Padrão false."
      },
      "inset": {
        "type": "string | number | ResponsiveValue<BoxShorthand>"
      },
      "justify": {
        "type": "\"start\" | \"center\" | \"end\" | \"between\" | \"around\" | \"evenly\" | ResponsiveValue<Justify>",
        "description": "justify-content; padrão 'start'"
      },
      "justifyContent": {
        "type": "\"start\" | \"center\" | \"end\" | \"flex-start\" | \"flex-end\" | \"space-between\" | \"space-around\" | \"space-evenly\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"flex-start\" | \"flex-end\" | \"space-between\" | \"space-around\" | \"space-evenly\">"
      },
      "justifyItems": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\">"
      },
      "justifySelf": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | \"auto\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\" | \"auto\">"
      },
      "left": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "letterSpacing": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "lineHeight": {
        "type": "number | \"normal\" | ResponsiveValue<number | \"normal\">"
      },
      "margin": {
        "type": "string | number | { readonly top?: number | undefined; readonly right?: number | undefined; readonly bottom?: number | undefined; readonly left?: number | undefined; } | ResponsiveValue<string | number | { readonly top?: number | undefined; readonly right?: number | undefined; readonly bottom?: number | undefined; readonly left?: number | undefined; }>"
      },
      "marginBottom": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<MarginInput>"
      },
      "marginLeft": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<MarginInput>"
      },
      "marginRight": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<MarginInput>"
      },
      "marginTop": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<MarginInput>"
      },
      "maxHeight": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "maxWidth": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "minHeight": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "minWidth": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "notes": {
        "type": "string | number | boolean | SlideElement | readonly TextChildren[]",
        "description": "Notas do apresentador. M15: rich text (`B`/`I`/`Span`, links externos; `\\n` = parágrafo) além de string."
      },
      "opacity": {
        "type": "number | ResponsiveValue<number>"
      },
      "order": {
        "type": "number | ResponsiveValue<number>"
      },
      "outline": {
        "type": "string | number | ResponsiveValue<string | number>",
        "description": "Contorno que não ocupa espaço ('1px solid #ccc'; número = largura). Só sólido no PPTX."
      },
      "outlineColor": {
        "type": "string | ResponsiveValue<string>"
      },
      "outlineWidth": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "overflow": {
        "type": "\"hidden\" | \"visible\" | ResponsiveValue<\"hidden\" | \"visible\">"
      },
      "padding": {
        "type": "string | number | { readonly top?: number | undefined; readonly right?: number | undefined; readonly bottom?: number | undefined; readonly left?: number | undefined; } | ResponsiveValue<string | number | { readonly top?: number | undefined; readonly right?: number | undefined; readonly bottom?: number | undefined; readonly left?: number | undefined; }>"
      },
      "paddingBottom": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "paddingLeft": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "paddingRight": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "paddingTop": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "placeItems": {
        "type": "string | ResponsiveValue<string>"
      },
      "placeSelf": {
        "type": "string | ResponsiveValue<string>"
      },
      "position": {
        "type": "\"static\" | \"relative\" | \"absolute\" | ResponsiveValue<\"static\" | \"relative\" | \"absolute\">"
      },
      "right": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "rotate": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "rowGap": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "style": {
        "type": "Readonly<Record<string, unknown>> | ResponsiveValue<Readonly<Record<string, unknown>>>",
        "description": "Escape: qualquer CSS; o que não tem de/para vira diagnóstico css-not-emitted."
      },
      "textAlign": {
        "type": "\"right\" | \"left\" | \"start\" | \"center\" | \"end\" | ResponsiveValue<\"right\" | \"left\" | \"start\" | \"center\" | \"end\">"
      },
      "textDecoration": {
        "type": "\"none\" | \"underline\" | \"line-through\" | \"underline line-through\" | ResponsiveValue<\"none\" | \"underline\" | \"line-through\" | \"underline line-through\">"
      },
      "textTransform": {
        "type": "\"none\" | \"uppercase\" | \"lowercase\" | \"capitalize\" | ResponsiveValue<\"none\" | \"uppercase\" | \"lowercase\" | \"capitalize\">"
      },
      "top": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "transform": {
        "type": "string | ResponsiveValue<string>"
      },
      "width": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "zIndex": {
        "type": "number | ResponsiveValue<number>"
      }
    },
    "required": []
  },
  "box": {
    "type": "object",
    "properties": {
      "align": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | \"baseline\" | ResponsiveValue<Align>",
        "description": "align-items; padrão 'stretch'"
      },
      "alignContent": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | \"flex-start\" | \"flex-end\" | \"space-between\" | \"space-around\" | \"space-evenly\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\" | \"flex-start\" | \"flex-end\" | \"space-between\" | \"space-around\" | \"space-evenly\">"
      },
      "alignItems": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | \"baseline\" | \"flex-start\" | \"flex-end\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\" | \"baseline\" | \"flex-start\" | \"flex-end\">"
      },
      "alignSelf": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | \"baseline\" | \"flex-start\" | \"flex-end\" | \"auto\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\" | \"baseline\" | \"flex-start\" | \"flex-end\" | \"auto\">"
      },
      "aspectRatio": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "backgroundColor": {
        "type": "string | ResponsiveValue<string>"
      },
      "backgroundImage": {
        "type": "string | ResponsiveValue<string>"
      },
      "border": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderBottom": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderColor": {
        "type": "string | ResponsiveValue<string>"
      },
      "borderLeft": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderRadius": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderRight": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderStyle": {
        "type": "\"none\" | \"solid\" | \"dashed\" | \"dotted\" | ResponsiveValue<\"none\" | \"solid\" | \"dashed\" | \"dotted\">"
      },
      "borderTop": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderWidth": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "bottom": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "boxShadow": {
        "type": "string | ResponsiveValue<string>"
      },
      "boxSizing": {
        "type": "\"border-box\" | ResponsiveValue<\"border-box\">"
      },
      "color": {
        "type": "string | ResponsiveValue<string>"
      },
      "columnGap": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "direction": {
        "type": "\"row\" | \"column\" | ResponsiveValue<FlexDirection>",
        "description": "padrão 'column'"
      },
      "display": {
        "type": "\"flex\" | \"block\" | \"grid\" | \"none\" | ResponsiveValue<\"flex\" | \"block\" | \"grid\" | \"none\">"
      },
      "fill": {
        "type": "string | ResponsiveValue<string>"
      },
      "flex": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "flexBasis": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<CssLengthInput | \"auto\">"
      },
      "flexDirection": {
        "type": "\"row\" | \"column\" | \"row-reverse\" | \"column-reverse\" | ResponsiveValue<\"row\" | \"column\" | \"row-reverse\" | \"column-reverse\">"
      },
      "flexGrow": {
        "type": "number | ResponsiveValue<number>"
      },
      "flexShrink": {
        "type": "number | ResponsiveValue<number>"
      },
      "flexWrap": {
        "type": "\"nowrap\" | \"wrap\" | \"wrap-reverse\" | ResponsiveValue<\"nowrap\" | \"wrap\" | \"wrap-reverse\">"
      },
      "fontFamily": {
        "type": "string | ResponsiveValue<string>"
      },
      "fontSize": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "fontStyle": {
        "type": "\"normal\" | \"italic\" | ResponsiveValue<\"normal\" | \"italic\">"
      },
      "fontWeight": {
        "type": "number | \"normal\" | \"bold\" | \"regular\" | ResponsiveValue<number | \"normal\" | \"bold\" | \"regular\">"
      },
      "gap": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridAutoColumns": {
        "type": "string | ResponsiveValue<string>"
      },
      "gridAutoFlow": {
        "type": "\"row\" | ResponsiveValue<\"row\">"
      },
      "gridAutoRows": {
        "type": "string | ResponsiveValue<string>"
      },
      "gridColumn": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridColumnEnd": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridColumnStart": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridRow": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridRowEnd": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridRowStart": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridTemplateColumns": {
        "type": "string | ResponsiveValue<string>"
      },
      "gridTemplateRows": {
        "type": "string | ResponsiveValue<string>"
      },
      "grow": {
        "type": "number | ResponsiveValue<number>"
      },
      "height": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "href": {
        "type": "string | ResponsiveValue<string>",
        "description": "M13: hyperlink no fundo da caixa: URL externa ou `slide:N` (N = slide do autor, base 1)."
      },
      "id": {
        "type": "string | ResponsiveValue<string>",
        "description": "M12: identificador do nó para `Connector from/to`. Único no slide (duplicado → ResolveError); não muda layout nem pintura."
      },
      "inset": {
        "type": "string | number | ResponsiveValue<BoxShorthand>"
      },
      "justify": {
        "type": "\"start\" | \"center\" | \"end\" | \"between\" | \"around\" | \"evenly\" | ResponsiveValue<Justify>",
        "description": "justify-content; padrão 'start'"
      },
      "justifyContent": {
        "type": "\"start\" | \"center\" | \"end\" | \"flex-start\" | \"flex-end\" | \"space-between\" | \"space-around\" | \"space-evenly\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"flex-start\" | \"flex-end\" | \"space-between\" | \"space-around\" | \"space-evenly\">"
      },
      "justifyItems": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\">"
      },
      "justifySelf": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | \"auto\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\" | \"auto\">"
      },
      "left": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "letterSpacing": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "lineHeight": {
        "type": "number | \"normal\" | ResponsiveValue<number | \"normal\">"
      },
      "margin": {
        "type": "string | number | { readonly top?: number | undefined; readonly right?: number | undefined; readonly bottom?: number | undefined; readonly left?: number | undefined; } | ResponsiveValue<string | number | { readonly top?: number | undefined; readonly right?: number | undefined; readonly bottom?: number | undefined; readonly left?: number | undefined; }>"
      },
      "marginBottom": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<MarginInput>"
      },
      "marginLeft": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<MarginInput>"
      },
      "marginRight": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<MarginInput>"
      },
      "marginTop": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<MarginInput>"
      },
      "maxHeight": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "maxWidth": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "minHeight": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "minWidth": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "opacity": {
        "type": "number | ResponsiveValue<number>"
      },
      "order": {
        "type": "number | ResponsiveValue<number>"
      },
      "outline": {
        "type": "string | number | ResponsiveValue<string | number>",
        "description": "Contorno que não ocupa espaço ('1px solid #ccc'; número = largura). Só sólido no PPTX."
      },
      "outlineColor": {
        "type": "string | ResponsiveValue<string>"
      },
      "outlineWidth": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "overflow": {
        "type": "\"hidden\" | \"visible\" | ResponsiveValue<\"hidden\" | \"visible\">"
      },
      "padding": {
        "type": "string | number | { readonly top?: number | undefined; readonly right?: number | undefined; readonly bottom?: number | undefined; readonly left?: number | undefined; } | ResponsiveValue<string | number | { readonly top?: number | undefined; readonly right?: number | undefined; readonly bottom?: number | undefined; readonly left?: number | undefined; }>"
      },
      "paddingBottom": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "paddingLeft": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "paddingRight": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "paddingTop": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "paginate": {
        "type": "boolean | ResponsiveValue<boolean>",
        "description": "M9: Box cujos filhos em fluxo, quando não cabem, continuam num slide clonado (ver CONTRACTS §M9 \"Slide de continuação\"). Só um Box paginate por slide. Padrão false."
      },
      "placeholder": {
        "type": "\"title\" | \"subtitle\" | \"body\" | \"footer\" | \"pictures\" | string & {} | ResponsiveValue<PlaceholderName>",
        "description": "M15: a área desta caixa vira um placeholder do layout (o conteúdo continua como objetos do slide)."
      },
      "placeItems": {
        "type": "string | ResponsiveValue<string>"
      },
      "placeSelf": {
        "type": "string | ResponsiveValue<string>"
      },
      "position": {
        "type": "\"static\" | \"relative\" | \"absolute\" | ResponsiveValue<\"static\" | \"relative\" | \"absolute\">"
      },
      "radius": {
        "type": "number | ResponsiveValue<number>",
        "description": "Raio dos cantos em pt; > 0 emite roundRect."
      },
      "right": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "rotate": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "rowGap": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "shape": {
        "type": "\"rect\" | \"roundRect\" | \"ellipse\" | \"line\" | \"triangle\" | \"rightTriangle\" | \"diamond\" | \"parallelogram\" | \"trapezoid\" | \"pentagon\" | \"hexagon\" | \"octagon\" | \"chevron\" | \"arrowRight\" | \"arrowLeft\" | \"arrowUp\" | \"arrowDown\" | \"doubleArrow\" | \"pill\" | \"star\" | \"cloud\" | \"callout\" | \"bracketPair\" | \"cylinder\" | ResponsiveValue<ShapeKind>",
        "description": "M12: geometria do fundo/borda da caixa (padrão 'rect'; com borderRadius vira 'roundRect'). Os filhos continuam posicionados pelo padding, como numa caixa retangular: a forma não recalcula o layout. 'line' não é aceito."
      },
      "shrink": {
        "type": "number | ResponsiveValue<number>"
      },
      "stroke": {
        "type": "string | ResponsiveValue<string>"
      },
      "strokeWidth": {
        "type": "number | ResponsiveValue<number>",
        "description": "padrão 1 pt quando stroke definido"
      },
      "style": {
        "type": "Readonly<Record<string, unknown>> | ResponsiveValue<Readonly<Record<string, unknown>>>",
        "description": "Escape: qualquer CSS; o que não tem de/para vira diagnóstico css-not-emitted."
      },
      "textAlign": {
        "type": "\"right\" | \"left\" | \"start\" | \"center\" | \"end\" | ResponsiveValue<\"right\" | \"left\" | \"start\" | \"center\" | \"end\">"
      },
      "textDecoration": {
        "type": "\"none\" | \"underline\" | \"line-through\" | \"underline line-through\" | ResponsiveValue<\"none\" | \"underline\" | \"line-through\" | \"underline line-through\">"
      },
      "textTransform": {
        "type": "\"none\" | \"uppercase\" | \"lowercase\" | \"capitalize\" | ResponsiveValue<\"none\" | \"uppercase\" | \"lowercase\" | \"capitalize\">"
      },
      "top": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "transform": {
        "type": "string | ResponsiveValue<string>"
      },
      "width": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "zIndex": {
        "type": "number | ResponsiveValue<number>"
      }
    },
    "required": []
  },
  "text": {
    "type": "object",
    "properties": {
      "align": {
        "type": "\"right\" | \"left\" | \"center\" | ResponsiveValue<TextAlign>"
      },
      "alignContent": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | \"flex-start\" | \"flex-end\" | \"space-between\" | \"space-around\" | \"space-evenly\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\" | \"flex-start\" | \"flex-end\" | \"space-between\" | \"space-around\" | \"space-evenly\">"
      },
      "alignItems": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | \"baseline\" | \"flex-start\" | \"flex-end\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\" | \"baseline\" | \"flex-start\" | \"flex-end\">"
      },
      "alignSelf": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | \"baseline\" | \"flex-start\" | \"flex-end\" | \"auto\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\" | \"baseline\" | \"flex-start\" | \"flex-end\" | \"auto\">"
      },
      "aspectRatio": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "backgroundColor": {
        "type": "string | ResponsiveValue<string>"
      },
      "backgroundImage": {
        "type": "string | ResponsiveValue<string>"
      },
      "border": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderBottom": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderColor": {
        "type": "string | ResponsiveValue<string>"
      },
      "borderLeft": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderRadius": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderRight": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderStyle": {
        "type": "\"none\" | \"solid\" | \"dashed\" | \"dotted\" | ResponsiveValue<\"none\" | \"solid\" | \"dashed\" | \"dotted\">"
      },
      "borderTop": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderWidth": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "bottom": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "boxShadow": {
        "type": "string | ResponsiveValue<string>"
      },
      "boxSizing": {
        "type": "\"border-box\" | ResponsiveValue<\"border-box\">"
      },
      "color": {
        "type": "string | ResponsiveValue<string>"
      },
      "columnGap": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "display": {
        "type": "\"flex\" | \"block\" | \"grid\" | \"none\" | ResponsiveValue<\"flex\" | \"block\" | \"grid\" | \"none\">"
      },
      "fit": {
        "type": "\"shrink\" | \"truncate\" | \"error\" | ResponsiveValue<FitPolicy>",
        "description": "padrão 'shrink'"
      },
      "flex": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "flexBasis": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<CssLengthInput | \"auto\">"
      },
      "flexDirection": {
        "type": "\"row\" | \"column\" | \"row-reverse\" | \"column-reverse\" | ResponsiveValue<\"row\" | \"column\" | \"row-reverse\" | \"column-reverse\">"
      },
      "flexGrow": {
        "type": "number | ResponsiveValue<number>"
      },
      "flexShrink": {
        "type": "number | ResponsiveValue<number>"
      },
      "flexWrap": {
        "type": "\"nowrap\" | \"wrap\" | \"wrap-reverse\" | ResponsiveValue<\"nowrap\" | \"wrap\" | \"wrap-reverse\">"
      },
      "font": {
        "type": "string | ResponsiveValue<string>",
        "description": "Família registrada; padrão 'Arial'."
      },
      "fontFamily": {
        "type": "string | ResponsiveValue<string>"
      },
      "fontSize": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "fontStyle": {
        "type": "\"normal\" | \"italic\" | ResponsiveValue<\"normal\" | \"italic\">"
      },
      "fontWeight": {
        "type": "number | \"normal\" | \"bold\" | \"regular\" | ResponsiveValue<number | \"normal\" | \"bold\" | \"regular\">"
      },
      "gap": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridAutoColumns": {
        "type": "string | ResponsiveValue<string>"
      },
      "gridAutoFlow": {
        "type": "\"row\" | ResponsiveValue<\"row\">"
      },
      "gridAutoRows": {
        "type": "string | ResponsiveValue<string>"
      },
      "gridColumn": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridColumnEnd": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridColumnStart": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridRow": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridRowEnd": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridRowStart": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridTemplateColumns": {
        "type": "string | ResponsiveValue<string>"
      },
      "gridTemplateRows": {
        "type": "string | ResponsiveValue<string>"
      },
      "grow": {
        "type": "number | ResponsiveValue<number>"
      },
      "height": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "href": {
        "type": "string | ResponsiveValue<string>",
        "description": "M13: hyperlink no texto inteiro (URL ou `slide:N`); um Span pode ter o próprio."
      },
      "id": {
        "type": "string | ResponsiveValue<string>",
        "description": "M12: identificador do nó para `Connector from/to`. Único no slide (duplicado → ResolveError); não muda layout nem pintura."
      },
      "inset": {
        "type": "string | number | ResponsiveValue<BoxShorthand>"
      },
      "italic": {
        "type": "boolean | ResponsiveValue<boolean>"
      },
      "justifyContent": {
        "type": "\"start\" | \"center\" | \"end\" | \"flex-start\" | \"flex-end\" | \"space-between\" | \"space-around\" | \"space-evenly\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"flex-start\" | \"flex-end\" | \"space-between\" | \"space-around\" | \"space-evenly\">"
      },
      "justifyItems": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\">"
      },
      "justifySelf": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | \"auto\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\" | \"auto\">"
      },
      "left": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "letterSpacing": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "lineHeight": {
        "type": "number | \"normal\" | ResponsiveValue<number | \"normal\">"
      },
      "margin": {
        "type": "string | number | { readonly top?: number | undefined; readonly right?: number | undefined; readonly bottom?: number | undefined; readonly left?: number | undefined; } | ResponsiveValue<string | number | { readonly top?: number | undefined; readonly right?: number | undefined; readonly bottom?: number | undefined; readonly left?: number | undefined; }>"
      },
      "marginBottom": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<MarginInput>"
      },
      "marginLeft": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<MarginInput>"
      },
      "marginRight": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<MarginInput>"
      },
      "marginTop": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<MarginInput>"
      },
      "maxHeight": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "maxLines": {
        "type": "number | ResponsiveValue<number>"
      },
      "maxWidth": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "minHeight": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "minSize": {
        "type": "number | ResponsiveValue<number>",
        "description": "padrão: 75% de size (arredondado para baixo)"
      },
      "minWidth": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "nowrap": {
        "type": "boolean | ResponsiveValue<boolean>",
        "description": "M8: nunca quebra linha (um parágrafo = uma linha); estouro de largura vira diagnóstico."
      },
      "opacity": {
        "type": "number | ResponsiveValue<number>"
      },
      "order": {
        "type": "number | ResponsiveValue<number>"
      },
      "outline": {
        "type": "string | number | ResponsiveValue<string | number>",
        "description": "Contorno que não ocupa espaço ('1px solid #ccc'; número = largura). Só sólido no PPTX."
      },
      "outlineColor": {
        "type": "string | ResponsiveValue<string>"
      },
      "outlineWidth": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "overflow": {
        "type": "\"hidden\" | \"visible\" | ResponsiveValue<\"hidden\" | \"visible\">"
      },
      "padding": {
        "type": "string | number | { readonly top?: number | undefined; readonly right?: number | undefined; readonly bottom?: number | undefined; readonly left?: number | undefined; } | ResponsiveValue<string | number | { readonly top?: number | undefined; readonly right?: number | undefined; readonly bottom?: number | undefined; readonly left?: number | undefined; }>"
      },
      "paddingBottom": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "paddingLeft": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "paddingRight": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "paddingTop": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "paginate": {
        "type": "boolean | ResponsiveValue<boolean>",
        "description": "M13: o texto que não cabe continua num clone do slide (divide as linhas já quebradas). Só um nó paginate (Box ou Text) por slide; enquanto pagina, este Text não encolhe. Padrão false."
      },
      "placeholder": {
        "type": "\"title\" | \"subtitle\" | \"body\" | \"footer\" | \"pictures\" | string & {} | ResponsiveValue<PlaceholderName>",
        "description": "M15: o texto sai ligado ao placeholder deste nome do layout do slide (`defineLayout`)."
      },
      "placeItems": {
        "type": "string | ResponsiveValue<string>"
      },
      "placeSelf": {
        "type": "string | ResponsiveValue<string>"
      },
      "position": {
        "type": "\"static\" | \"relative\" | \"absolute\" | ResponsiveValue<\"static\" | \"relative\" | \"absolute\">"
      },
      "right": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "rotate": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "rowGap": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "shrink": {
        "type": "number | ResponsiveValue<number>"
      },
      "size": {
        "type": "number | ResponsiveValue<number>",
        "description": "pt; padrão 18"
      },
      "style": {
        "type": "Readonly<Record<string, unknown>> | ResponsiveValue<Readonly<Record<string, unknown>>>",
        "description": "Escape: qualquer CSS; o que não tem de/para vira diagnóstico css-not-emitted."
      },
      "textAlign": {
        "type": "\"right\" | \"left\" | \"start\" | \"center\" | \"end\" | ResponsiveValue<\"right\" | \"left\" | \"start\" | \"center\" | \"end\">"
      },
      "textDecoration": {
        "type": "\"none\" | \"underline\" | \"line-through\" | \"underline line-through\" | ResponsiveValue<\"none\" | \"underline\" | \"line-through\" | \"underline line-through\">"
      },
      "textTransform": {
        "type": "\"none\" | \"uppercase\" | \"lowercase\" | \"capitalize\" | ResponsiveValue<\"none\" | \"uppercase\" | \"lowercase\" | \"capitalize\">"
      },
      "top": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "transform": {
        "type": "string | ResponsiveValue<string>"
      },
      "weight": {
        "type": "number | \"bold\" | \"regular\" | ResponsiveValue<FontWeight>"
      },
      "whiteSpace": {
        "type": "\"nowrap\" | \"normal\" | ResponsiveValue<\"nowrap\" | \"normal\">"
      },
      "width": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "zIndex": {
        "type": "number | ResponsiveValue<number>"
      }
    },
    "required": []
  },
  "image": {
    "type": "object",
    "properties": {
      "alignContent": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | \"flex-start\" | \"flex-end\" | \"space-between\" | \"space-around\" | \"space-evenly\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\" | \"flex-start\" | \"flex-end\" | \"space-between\" | \"space-around\" | \"space-evenly\">"
      },
      "alignItems": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | \"baseline\" | \"flex-start\" | \"flex-end\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\" | \"baseline\" | \"flex-start\" | \"flex-end\">"
      },
      "alignSelf": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | \"baseline\" | \"flex-start\" | \"flex-end\" | \"auto\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\" | \"baseline\" | \"flex-start\" | \"flex-end\" | \"auto\">"
      },
      "aspectRatio": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "backgroundColor": {
        "type": "string | ResponsiveValue<string>"
      },
      "backgroundImage": {
        "type": "string | ResponsiveValue<string>"
      },
      "border": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderBottom": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderColor": {
        "type": "string | ResponsiveValue<string>"
      },
      "borderLeft": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderRadius": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderRight": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderStyle": {
        "type": "\"none\" | \"solid\" | \"dashed\" | \"dotted\" | ResponsiveValue<\"none\" | \"solid\" | \"dashed\" | \"dotted\">"
      },
      "borderTop": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderWidth": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "bottom": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "boxShadow": {
        "type": "string | ResponsiveValue<string>"
      },
      "boxSizing": {
        "type": "\"border-box\" | ResponsiveValue<\"border-box\">"
      },
      "color": {
        "type": "string | ResponsiveValue<string>"
      },
      "columnGap": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "display": {
        "type": "\"flex\" | \"block\" | \"grid\" | \"none\" | ResponsiveValue<\"flex\" | \"block\" | \"grid\" | \"none\">"
      },
      "fit": {
        "type": "\"contain\" | \"cover\" | ResponsiveValue<ImageFit>",
        "description": "padrão 'contain'"
      },
      "flex": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "flexBasis": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<CssLengthInput | \"auto\">"
      },
      "flexDirection": {
        "type": "\"row\" | \"column\" | \"row-reverse\" | \"column-reverse\" | ResponsiveValue<\"row\" | \"column\" | \"row-reverse\" | \"column-reverse\">"
      },
      "flexGrow": {
        "type": "number | ResponsiveValue<number>"
      },
      "flexShrink": {
        "type": "number | ResponsiveValue<number>"
      },
      "flexWrap": {
        "type": "\"nowrap\" | \"wrap\" | \"wrap-reverse\" | ResponsiveValue<\"nowrap\" | \"wrap\" | \"wrap-reverse\">"
      },
      "fontFamily": {
        "type": "string | ResponsiveValue<string>"
      },
      "fontSize": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "fontStyle": {
        "type": "\"normal\" | \"italic\" | ResponsiveValue<\"normal\" | \"italic\">"
      },
      "fontWeight": {
        "type": "number | \"normal\" | \"bold\" | \"regular\" | ResponsiveValue<number | \"normal\" | \"bold\" | \"regular\">"
      },
      "gap": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridAutoColumns": {
        "type": "string | ResponsiveValue<string>"
      },
      "gridAutoFlow": {
        "type": "\"row\" | ResponsiveValue<\"row\">"
      },
      "gridAutoRows": {
        "type": "string | ResponsiveValue<string>"
      },
      "gridColumn": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridColumnEnd": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridColumnStart": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridRow": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridRowEnd": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridRowStart": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridTemplateColumns": {
        "type": "string | ResponsiveValue<string>"
      },
      "gridTemplateRows": {
        "type": "string | ResponsiveValue<string>"
      },
      "grow": {
        "type": "number | ResponsiveValue<number>"
      },
      "height": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "href": {
        "type": "string | ResponsiveValue<string>",
        "description": "M13: hyperlink da imagem (URL ou `slide:N`)."
      },
      "id": {
        "type": "string | ResponsiveValue<string>",
        "description": "M12: identificador do nó para `Connector from/to`. Único no slide (duplicado → ResolveError); não muda layout nem pintura."
      },
      "inset": {
        "type": "string | number | ResponsiveValue<BoxShorthand>"
      },
      "justifyContent": {
        "type": "\"start\" | \"center\" | \"end\" | \"flex-start\" | \"flex-end\" | \"space-between\" | \"space-around\" | \"space-evenly\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"flex-start\" | \"flex-end\" | \"space-between\" | \"space-around\" | \"space-evenly\">"
      },
      "justifyItems": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\">"
      },
      "justifySelf": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | \"auto\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\" | \"auto\">"
      },
      "left": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "letterSpacing": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "lineHeight": {
        "type": "number | \"normal\" | ResponsiveValue<number | \"normal\">"
      },
      "margin": {
        "type": "string | number | { readonly top?: number | undefined; readonly right?: number | undefined; readonly bottom?: number | undefined; readonly left?: number | undefined; } | ResponsiveValue<string | number | { readonly top?: number | undefined; readonly right?: number | undefined; readonly bottom?: number | undefined; readonly left?: number | undefined; }>"
      },
      "marginBottom": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<MarginInput>"
      },
      "marginLeft": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<MarginInput>"
      },
      "marginRight": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<MarginInput>"
      },
      "marginTop": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<MarginInput>"
      },
      "maxHeight": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "maxWidth": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "minHeight": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "minWidth": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "objectFit": {
        "type": "\"contain\" | \"cover\" | ResponsiveValue<\"contain\" | \"cover\">"
      },
      "opacity": {
        "type": "number | ResponsiveValue<number>"
      },
      "order": {
        "type": "number | ResponsiveValue<number>"
      },
      "outline": {
        "type": "string | number | ResponsiveValue<string | number>",
        "description": "Contorno que não ocupa espaço ('1px solid #ccc'; número = largura). Só sólido no PPTX."
      },
      "outlineColor": {
        "type": "string | ResponsiveValue<string>"
      },
      "outlineWidth": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "overflow": {
        "type": "\"hidden\" | \"visible\" | ResponsiveValue<\"hidden\" | \"visible\">"
      },
      "padding": {
        "type": "string | number | { readonly top?: number | undefined; readonly right?: number | undefined; readonly bottom?: number | undefined; readonly left?: number | undefined; } | ResponsiveValue<string | number | { readonly top?: number | undefined; readonly right?: number | undefined; readonly bottom?: number | undefined; readonly left?: number | undefined; }>"
      },
      "paddingBottom": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "paddingLeft": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "paddingRight": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "paddingTop": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "placeholder": {
        "type": "\"title\" | \"subtitle\" | \"body\" | \"footer\" | \"pictures\" | string & {} | ResponsiveValue<PlaceholderName>",
        "description": "M15: a imagem sai ligada ao placeholder deste nome do layout do slide."
      },
      "placeItems": {
        "type": "string | ResponsiveValue<string>"
      },
      "placeSelf": {
        "type": "string | ResponsiveValue<string>"
      },
      "position": {
        "type": "\"static\" | \"relative\" | \"absolute\" | ResponsiveValue<\"static\" | \"relative\" | \"absolute\">"
      },
      "right": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "rotate": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "rowGap": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "shrink": {
        "type": "number | ResponsiveValue<number>"
      },
      "src": {
        "type": "string"
      },
      "style": {
        "type": "Readonly<Record<string, unknown>> | ResponsiveValue<Readonly<Record<string, unknown>>>",
        "description": "Escape: qualquer CSS; o que não tem de/para vira diagnóstico css-not-emitted."
      },
      "textAlign": {
        "type": "\"right\" | \"left\" | \"start\" | \"center\" | \"end\" | ResponsiveValue<\"right\" | \"left\" | \"start\" | \"center\" | \"end\">"
      },
      "textDecoration": {
        "type": "\"none\" | \"underline\" | \"line-through\" | \"underline line-through\" | ResponsiveValue<\"none\" | \"underline\" | \"line-through\" | \"underline line-through\">"
      },
      "textTransform": {
        "type": "\"none\" | \"uppercase\" | \"lowercase\" | \"capitalize\" | ResponsiveValue<\"none\" | \"uppercase\" | \"lowercase\" | \"capitalize\">"
      },
      "top": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "transform": {
        "type": "string | ResponsiveValue<string>"
      },
      "width": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "zIndex": {
        "type": "number | ResponsiveValue<number>"
      }
    },
    "required": [
      "src"
    ]
  },
  "shape": {
    "type": "object",
    "properties": {
      "alignContent": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | \"flex-start\" | \"flex-end\" | \"space-between\" | \"space-around\" | \"space-evenly\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\" | \"flex-start\" | \"flex-end\" | \"space-between\" | \"space-around\" | \"space-evenly\">"
      },
      "alignItems": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | \"baseline\" | \"flex-start\" | \"flex-end\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\" | \"baseline\" | \"flex-start\" | \"flex-end\">"
      },
      "alignSelf": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | \"baseline\" | \"flex-start\" | \"flex-end\" | \"auto\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\" | \"baseline\" | \"flex-start\" | \"flex-end\" | \"auto\">"
      },
      "aspectRatio": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "backgroundColor": {
        "type": "string | ResponsiveValue<string>"
      },
      "backgroundImage": {
        "type": "string | ResponsiveValue<string>"
      },
      "border": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderBottom": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderColor": {
        "type": "string | ResponsiveValue<string>"
      },
      "borderLeft": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderRadius": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderRight": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderStyle": {
        "type": "\"none\" | \"solid\" | \"dashed\" | \"dotted\" | ResponsiveValue<\"none\" | \"solid\" | \"dashed\" | \"dotted\">"
      },
      "borderTop": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderWidth": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "bottom": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "boxShadow": {
        "type": "string | ResponsiveValue<string>"
      },
      "boxSizing": {
        "type": "\"border-box\" | ResponsiveValue<\"border-box\">"
      },
      "color": {
        "type": "string | ResponsiveValue<string>"
      },
      "columnGap": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "display": {
        "type": "\"flex\" | \"block\" | \"grid\" | \"none\" | ResponsiveValue<\"flex\" | \"block\" | \"grid\" | \"none\">"
      },
      "endArrow": {
        "type": "\"none\" | \"triangle\" | \"diamond\" | \"arrow\" | \"stealth\" | \"oval\" | ResponsiveValue<ArrowType>"
      },
      "fill": {
        "type": "string | ResponsiveValue<string>"
      },
      "flex": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "flexBasis": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<CssLengthInput | \"auto\">"
      },
      "flexDirection": {
        "type": "\"row\" | \"column\" | \"row-reverse\" | \"column-reverse\" | ResponsiveValue<\"row\" | \"column\" | \"row-reverse\" | \"column-reverse\">"
      },
      "flexGrow": {
        "type": "number | ResponsiveValue<number>"
      },
      "flexShrink": {
        "type": "number | ResponsiveValue<number>"
      },
      "flexWrap": {
        "type": "\"nowrap\" | \"wrap\" | \"wrap-reverse\" | ResponsiveValue<\"nowrap\" | \"wrap\" | \"wrap-reverse\">"
      },
      "flipH": {
        "type": "boolean | ResponsiveValue<boolean>",
        "description": "M12: espelha a forma no eixo vertical (horizontal) — `flipH`/`flipV` do PPTX."
      },
      "flipV": {
        "type": "boolean | ResponsiveValue<boolean>"
      },
      "fontFamily": {
        "type": "string | ResponsiveValue<string>"
      },
      "fontSize": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "fontStyle": {
        "type": "\"normal\" | \"italic\" | ResponsiveValue<\"normal\" | \"italic\">"
      },
      "fontWeight": {
        "type": "number | \"normal\" | \"bold\" | \"regular\" | ResponsiveValue<number | \"normal\" | \"bold\" | \"regular\">"
      },
      "gap": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridAutoColumns": {
        "type": "string | ResponsiveValue<string>"
      },
      "gridAutoFlow": {
        "type": "\"row\" | ResponsiveValue<\"row\">"
      },
      "gridAutoRows": {
        "type": "string | ResponsiveValue<string>"
      },
      "gridColumn": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridColumnEnd": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridColumnStart": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridRow": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridRowEnd": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridRowStart": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridTemplateColumns": {
        "type": "string | ResponsiveValue<string>"
      },
      "gridTemplateRows": {
        "type": "string | ResponsiveValue<string>"
      },
      "grow": {
        "type": "number | ResponsiveValue<number>"
      },
      "height": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "id": {
        "type": "string | ResponsiveValue<string>",
        "description": "M12: identificador do nó para `Connector from/to`. Único no slide (duplicado → ResolveError); não muda layout nem pintura."
      },
      "inset": {
        "type": "string | number | ResponsiveValue<BoxShorthand>"
      },
      "justifyContent": {
        "type": "\"start\" | \"center\" | \"end\" | \"flex-start\" | \"flex-end\" | \"space-between\" | \"space-around\" | \"space-evenly\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"flex-start\" | \"flex-end\" | \"space-between\" | \"space-around\" | \"space-evenly\">"
      },
      "justifyItems": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\">"
      },
      "justifySelf": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | \"auto\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\" | \"auto\">"
      },
      "kind": {
        "type": "\"rect\" | \"roundRect\" | \"ellipse\" | \"line\" | \"triangle\" | \"rightTriangle\" | \"diamond\" | \"parallelogram\" | \"trapezoid\" | \"pentagon\" | \"hexagon\" | \"octagon\" | \"chevron\" | \"arrowRight\" | \"arrowLeft\" | \"arrowUp\" | \"arrowDown\" | \"doubleArrow\" | \"pill\" | \"star\" | \"cloud\" | \"callout\" | \"bracketPair\" | \"cylinder\""
      },
      "left": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "letterSpacing": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "lineCap": {
        "type": "\"flat\" | \"round\" | ResponsiveValue<LineCap>",
        "description": "M12: padrão 'flat'."
      },
      "lineHeight": {
        "type": "number | \"normal\" | ResponsiveValue<number | \"normal\">"
      },
      "lineStyle": {
        "type": "\"solid\" | \"dashed\" | \"dotted\" | ResponsiveValue<LineStyle>",
        "description": "M12: padrão 'solid'."
      },
      "margin": {
        "type": "string | number | { readonly top?: number | undefined; readonly right?: number | undefined; readonly bottom?: number | undefined; readonly left?: number | undefined; } | ResponsiveValue<string | number | { readonly top?: number | undefined; readonly right?: number | undefined; readonly bottom?: number | undefined; readonly left?: number | undefined; }>"
      },
      "marginBottom": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<MarginInput>"
      },
      "marginLeft": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<MarginInput>"
      },
      "marginRight": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<MarginInput>"
      },
      "marginTop": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<MarginInput>"
      },
      "maxHeight": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "maxWidth": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "minHeight": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "minWidth": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "opacity": {
        "type": "number | ResponsiveValue<number>"
      },
      "order": {
        "type": "number | ResponsiveValue<number>"
      },
      "outline": {
        "type": "string | number | ResponsiveValue<string | number>",
        "description": "Contorno que não ocupa espaço ('1px solid #ccc'; número = largura). Só sólido no PPTX."
      },
      "outlineColor": {
        "type": "string | ResponsiveValue<string>"
      },
      "outlineWidth": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "overflow": {
        "type": "\"hidden\" | \"visible\" | ResponsiveValue<\"hidden\" | \"visible\">"
      },
      "padding": {
        "type": "string | number | { readonly top?: number | undefined; readonly right?: number | undefined; readonly bottom?: number | undefined; readonly left?: number | undefined; } | ResponsiveValue<string | number | { readonly top?: number | undefined; readonly right?: number | undefined; readonly bottom?: number | undefined; readonly left?: number | undefined; }>"
      },
      "paddingBottom": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "paddingLeft": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "paddingRight": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "paddingTop": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "placeItems": {
        "type": "string | ResponsiveValue<string>"
      },
      "placeSelf": {
        "type": "string | ResponsiveValue<string>"
      },
      "position": {
        "type": "\"static\" | \"relative\" | \"absolute\" | ResponsiveValue<\"static\" | \"relative\" | \"absolute\">"
      },
      "radius": {
        "type": "number | ResponsiveValue<number>",
        "description": "Raio para roundRect, em pt."
      },
      "right": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "rotate": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "rowGap": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "shrink": {
        "type": "number | ResponsiveValue<number>"
      },
      "startArrow": {
        "type": "\"none\" | \"triangle\" | \"diamond\" | \"arrow\" | \"stealth\" | \"oval\" | ResponsiveValue<ArrowType>",
        "description": "M12: pontas de seta; só em `kind=\"line\"` (senão ResolveError). Padrão 'none'."
      },
      "stroke": {
        "type": "string | ResponsiveValue<string>"
      },
      "strokeWidth": {
        "type": "number | ResponsiveValue<number>",
        "description": "padrão 1 pt quando stroke definido"
      },
      "style": {
        "type": "Readonly<Record<string, unknown>> | ResponsiveValue<Readonly<Record<string, unknown>>>",
        "description": "Escape: qualquer CSS; o que não tem de/para vira diagnóstico css-not-emitted."
      },
      "textAlign": {
        "type": "\"right\" | \"left\" | \"start\" | \"center\" | \"end\" | ResponsiveValue<\"right\" | \"left\" | \"start\" | \"center\" | \"end\">"
      },
      "textDecoration": {
        "type": "\"none\" | \"underline\" | \"line-through\" | \"underline line-through\" | ResponsiveValue<\"none\" | \"underline\" | \"line-through\" | \"underline line-through\">"
      },
      "textTransform": {
        "type": "\"none\" | \"uppercase\" | \"lowercase\" | \"capitalize\" | ResponsiveValue<\"none\" | \"uppercase\" | \"lowercase\" | \"capitalize\">"
      },
      "top": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "transform": {
        "type": "string | ResponsiveValue<string>"
      },
      "width": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "zIndex": {
        "type": "number | ResponsiveValue<number>"
      }
    },
    "required": [
      "kind"
    ]
  },
  "span": {
    "type": "object",
    "properties": {
      "color": {
        "type": "string"
      },
      "fontFamily": {
        "type": "string",
        "description": "M13-7: família do trecho (registrada em `fonts`, como a do Text)."
      },
      "fontSize": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%`",
        "description": "M13-7: corpo do trecho (a linha cresce para caber)."
      },
      "fontStyle": {
        "type": "\"normal\" | \"italic\""
      },
      "fontWeight": {
        "type": "number | \"normal\" | \"bold\" | \"regular\"",
        "description": "M13: pesos numéricos 100–900 usam a face registrada mais próxima."
      },
      "href": {
        "type": "string",
        "description": "M13: hyperlink do trecho (URL ou `slide:N`)."
      },
      "italic": {
        "type": "boolean"
      },
      "textDecoration": {
        "type": "\"none\" | \"underline\" | \"line-through\" | \"underline line-through\""
      },
      "verticalAlign": {
        "type": "\"baseline\" | \"super\" | \"sub\"",
        "description": "M13: sobrescrito/subscrito: corpo × DEFAULTS.text.superscriptRatio, sem mudar a altura da linha."
      },
      "weight": {
        "type": "number | \"bold\" | \"regular\""
      }
    },
    "required": []
  },
  "chart": {
    "type": "object",
    "properties": {
      "alignContent": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | \"flex-start\" | \"flex-end\" | \"space-between\" | \"space-around\" | \"space-evenly\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\" | \"flex-start\" | \"flex-end\" | \"space-between\" | \"space-around\" | \"space-evenly\">"
      },
      "alignItems": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | \"baseline\" | \"flex-start\" | \"flex-end\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\" | \"baseline\" | \"flex-start\" | \"flex-end\">"
      },
      "alignSelf": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | \"baseline\" | \"flex-start\" | \"flex-end\" | \"auto\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\" | \"baseline\" | \"flex-start\" | \"flex-end\" | \"auto\">"
      },
      "aspectRatio": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "backgroundColor": {
        "type": "string | ResponsiveValue<string>"
      },
      "backgroundImage": {
        "type": "string | ResponsiveValue<string>"
      },
      "border": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderBottom": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderColor": {
        "type": "string | ResponsiveValue<string>"
      },
      "borderLeft": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderRadius": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderRight": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderStyle": {
        "type": "\"none\" | \"solid\" | \"dashed\" | \"dotted\" | ResponsiveValue<\"none\" | \"solid\" | \"dashed\" | \"dotted\">"
      },
      "borderTop": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderWidth": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "bottom": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "boxShadow": {
        "type": "string | ResponsiveValue<string>"
      },
      "boxSizing": {
        "type": "\"border-box\" | ResponsiveValue<\"border-box\">"
      },
      "color": {
        "type": "string | ResponsiveValue<string>"
      },
      "colors": {
        "type": "readonly string[] | ResponsiveValue<readonly string[]>",
        "description": "Por série (bar/line) ou por categoria (pie/doughnut); padrão DEFAULTS.chart.palette (cíclica)."
      },
      "columnGap": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "data": {
        "type": "ChartData | ResponsiveValue<ChartData>"
      },
      "display": {
        "type": "\"flex\" | \"block\" | \"grid\" | \"none\" | ResponsiveValue<\"flex\" | \"block\" | \"grid\" | \"none\">"
      },
      "flex": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "flexBasis": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<CssLengthInput | \"auto\">"
      },
      "flexDirection": {
        "type": "\"row\" | \"column\" | \"row-reverse\" | \"column-reverse\" | ResponsiveValue<\"row\" | \"column\" | \"row-reverse\" | \"column-reverse\">"
      },
      "flexGrow": {
        "type": "number | ResponsiveValue<number>"
      },
      "flexShrink": {
        "type": "number | ResponsiveValue<number>"
      },
      "flexWrap": {
        "type": "\"nowrap\" | \"wrap\" | \"wrap-reverse\" | ResponsiveValue<\"nowrap\" | \"wrap\" | \"wrap-reverse\">"
      },
      "font": {
        "type": "string | ResponsiveValue<string>",
        "description": "Tipografia de rótulos, eixos, legenda e título; padrão DEFAULTS.chart (família = DEFAULTS.text.font)."
      },
      "fontFamily": {
        "type": "string | ResponsiveValue<string>"
      },
      "fontSize": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "fontStyle": {
        "type": "\"normal\" | \"italic\" | ResponsiveValue<\"normal\" | \"italic\">"
      },
      "fontWeight": {
        "type": "number | \"normal\" | \"bold\" | \"regular\" | ResponsiveValue<number | \"normal\" | \"bold\" | \"regular\">"
      },
      "gap": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridAutoColumns": {
        "type": "string | ResponsiveValue<string>"
      },
      "gridAutoFlow": {
        "type": "\"row\" | ResponsiveValue<\"row\">"
      },
      "gridAutoRows": {
        "type": "string | ResponsiveValue<string>"
      },
      "gridColumn": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridColumnEnd": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridColumnStart": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridRow": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridRowEnd": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridRowStart": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridTemplateColumns": {
        "type": "string | ResponsiveValue<string>"
      },
      "gridTemplateRows": {
        "type": "string | ResponsiveValue<string>"
      },
      "grow": {
        "type": "number | ResponsiveValue<number>"
      },
      "height": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "holeSize": {
        "type": "number | ResponsiveValue<number>",
        "description": "M14 (doughnut): furo em % do diâmetro; padrão DEFAULTS.chart.holeSize."
      },
      "id": {
        "type": "string | ResponsiveValue<string>",
        "description": "M12: identificador do nó para `Connector from/to`. Único no slide (duplicado → ResolveError); não muda layout nem pintura."
      },
      "inset": {
        "type": "string | number | ResponsiveValue<BoxShorthand>"
      },
      "justifyContent": {
        "type": "\"start\" | \"center\" | \"end\" | \"flex-start\" | \"flex-end\" | \"space-between\" | \"space-around\" | \"space-evenly\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"flex-start\" | \"flex-end\" | \"space-between\" | \"space-around\" | \"space-evenly\">"
      },
      "justifyItems": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\">"
      },
      "justifySelf": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | \"auto\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\" | \"auto\">"
      },
      "kind": {
        "type": "\"line\" | \"bar\" | \"barH\" | \"stackedBar\" | \"stackedBarH\" | \"stackedBar100\" | \"area\" | \"stackedArea\" | \"pie\" | \"doughnut\" | \"scatter\" | \"combo\""
      },
      "labels": {
        "type": "boolean | ChartLabels | ResponsiveValue<boolean | ChartLabels>",
        "description": "M14: rótulos de valor com formato e posição; vence `showValues`."
      },
      "left": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "legend": {
        "type": "boolean | { readonly position: ChartLegendPosition; } | ResponsiveValue<boolean | { readonly position: ChartLegendPosition; }>",
        "description": "Padrão: `series.length > 1` (pie/doughnut: true). M14: objeto escolhe a posição (padrão 'bottom')."
      },
      "letterSpacing": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "lineHeight": {
        "type": "number | \"normal\" | ResponsiveValue<number | \"normal\">"
      },
      "margin": {
        "type": "string | number | { readonly top?: number | undefined; readonly right?: number | undefined; readonly bottom?: number | undefined; readonly left?: number | undefined; } | ResponsiveValue<string | number | { readonly top?: number | undefined; readonly right?: number | undefined; readonly bottom?: number | undefined; readonly left?: number | undefined; }>"
      },
      "marginBottom": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<MarginInput>"
      },
      "marginLeft": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<MarginInput>"
      },
      "marginRight": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<MarginInput>"
      },
      "marginTop": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<MarginInput>"
      },
      "markers": {
        "type": "boolean | ResponsiveValue<boolean>",
        "description": "M14 (line/scatter/combo): marcadores nos pontos; padrão: só no scatter."
      },
      "maxHeight": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "maxWidth": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "minHeight": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "minWidth": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "opacity": {
        "type": "number | ResponsiveValue<number>"
      },
      "order": {
        "type": "number | ResponsiveValue<number>"
      },
      "outline": {
        "type": "string | number | ResponsiveValue<string | number>",
        "description": "Contorno que não ocupa espaço ('1px solid #ccc'; número = largura). Só sólido no PPTX."
      },
      "outlineColor": {
        "type": "string | ResponsiveValue<string>"
      },
      "outlineWidth": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "overflow": {
        "type": "\"hidden\" | \"visible\" | ResponsiveValue<\"hidden\" | \"visible\">"
      },
      "padding": {
        "type": "string | number | { readonly top?: number | undefined; readonly right?: number | undefined; readonly bottom?: number | undefined; readonly left?: number | undefined; } | ResponsiveValue<string | number | { readonly top?: number | undefined; readonly right?: number | undefined; readonly bottom?: number | undefined; readonly left?: number | undefined; }>"
      },
      "paddingBottom": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "paddingLeft": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "paddingRight": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "paddingTop": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "placeItems": {
        "type": "string | ResponsiveValue<string>"
      },
      "placeSelf": {
        "type": "string | ResponsiveValue<string>"
      },
      "position": {
        "type": "\"static\" | \"relative\" | \"absolute\" | ResponsiveValue<\"static\" | \"relative\" | \"absolute\">"
      },
      "right": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "rotate": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "rowGap": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "showValues": {
        "type": "boolean | ResponsiveValue<boolean>",
        "description": "Rótulos de valor sobre as barras/pontos/fatias; padrão false (alias antigo de `labels`)."
      },
      "shrink": {
        "type": "number | ResponsiveValue<number>"
      },
      "size": {
        "type": "number | ResponsiveValue<number>"
      },
      "smooth": {
        "type": "boolean | ResponsiveValue<boolean>",
        "description": "M14 (line/area/combo): linha suavizada."
      },
      "style": {
        "type": "Readonly<Record<string, unknown>> | ResponsiveValue<Readonly<Record<string, unknown>>>",
        "description": "Escape: qualquer CSS; o que não tem de/para vira diagnóstico css-not-emitted."
      },
      "textAlign": {
        "type": "\"right\" | \"left\" | \"start\" | \"center\" | \"end\" | ResponsiveValue<\"right\" | \"left\" | \"start\" | \"center\" | \"end\">"
      },
      "textDecoration": {
        "type": "\"none\" | \"underline\" | \"line-through\" | \"underline line-through\" | ResponsiveValue<\"none\" | \"underline\" | \"line-through\" | \"underline line-through\">"
      },
      "textTransform": {
        "type": "\"none\" | \"uppercase\" | \"lowercase\" | \"capitalize\" | ResponsiveValue<\"none\" | \"uppercase\" | \"lowercase\" | \"capitalize\">"
      },
      "title": {
        "type": "string | ResponsiveValue<string>"
      },
      "top": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "transform": {
        "type": "string | ResponsiveValue<string>"
      },
      "width": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "xAxis": {
        "type": "ChartAxis | ResponsiveValue<ChartAxis>",
        "description": "M14: eixo de categorias (no barH, o vertical), eixo de valores e o secundário (combo)."
      },
      "y2Axis": {
        "type": "ChartAxis | ResponsiveValue<ChartAxis>"
      },
      "yAxis": {
        "type": "ChartAxis | ResponsiveValue<ChartAxis>"
      },
      "zIndex": {
        "type": "number | ResponsiveValue<number>"
      }
    },
    "required": [
      "data",
      "kind"
    ]
  },
  "table": {
    "type": "object",
    "properties": {
      "alignContent": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | \"flex-start\" | \"flex-end\" | \"space-between\" | \"space-around\" | \"space-evenly\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\" | \"flex-start\" | \"flex-end\" | \"space-between\" | \"space-around\" | \"space-evenly\">"
      },
      "alignItems": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | \"baseline\" | \"flex-start\" | \"flex-end\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\" | \"baseline\" | \"flex-start\" | \"flex-end\">"
      },
      "alignSelf": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | \"baseline\" | \"flex-start\" | \"flex-end\" | \"auto\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\" | \"baseline\" | \"flex-start\" | \"flex-end\" | \"auto\">"
      },
      "aspectRatio": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "backgroundColor": {
        "type": "string | ResponsiveValue<string>"
      },
      "backgroundImage": {
        "type": "string | ResponsiveValue<string>"
      },
      "border": {
        "type": "string | ResponsiveValue<string>"
      },
      "borderBottom": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderColor": {
        "type": "string | ResponsiveValue<string>"
      },
      "borderLeft": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderRadius": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderRight": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderStyle": {
        "type": "\"none\" | \"solid\" | \"dashed\" | \"dotted\" | ResponsiveValue<\"none\" | \"solid\" | \"dashed\" | \"dotted\">"
      },
      "borderTop": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderWidth": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "bottom": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "boxShadow": {
        "type": "string | ResponsiveValue<string>"
      },
      "boxSizing": {
        "type": "\"border-box\" | ResponsiveValue<\"border-box\">"
      },
      "cell": {
        "type": "(ctx: TableCellContext) => Partial<TableCellSpec> | undefined | ResponsiveValue<(ctx: TableCellContext) => Partial<TableCellSpec> | undefined>",
        "description": "M14: estilo por célula calculado (cor por valor); o que a célula declara vence."
      },
      "cellPadding": {
        "type": "number | ResponsiveValue<number>",
        "description": "Margem interna da célula em pt; padrão DEFAULTS.table.cellPadding."
      },
      "color": {
        "type": "string | ResponsiveValue<string>"
      },
      "columnGap": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "columns": {
        "type": "readonly TableColumn[] | ResponsiveValue<readonly TableColumn[]>"
      },
      "display": {
        "type": "\"flex\" | \"block\" | \"grid\" | \"none\" | ResponsiveValue<\"flex\" | \"block\" | \"grid\" | \"none\">"
      },
      "fit": {
        "type": "\"shrink\" | \"error\" | ResponsiveValue<TableFitPolicy>",
        "description": "padrão 'shrink'"
      },
      "flex": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "flexBasis": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<CssLengthInput | \"auto\">"
      },
      "flexDirection": {
        "type": "\"row\" | \"column\" | \"row-reverse\" | \"column-reverse\" | ResponsiveValue<\"row\" | \"column\" | \"row-reverse\" | \"column-reverse\">"
      },
      "flexGrow": {
        "type": "number | ResponsiveValue<number>"
      },
      "flexShrink": {
        "type": "number | ResponsiveValue<number>"
      },
      "flexWrap": {
        "type": "\"nowrap\" | \"wrap\" | \"wrap-reverse\" | ResponsiveValue<\"nowrap\" | \"wrap\" | \"wrap-reverse\">"
      },
      "font": {
        "type": "string | ResponsiveValue<string>",
        "description": "Família registrada; padrão 'Arial'."
      },
      "fontFamily": {
        "type": "string | ResponsiveValue<string>"
      },
      "fontSize": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "fontStyle": {
        "type": "\"normal\" | \"italic\" | ResponsiveValue<\"normal\" | \"italic\">"
      },
      "fontWeight": {
        "type": "number | \"normal\" | \"bold\" | \"regular\" | ResponsiveValue<number | \"normal\" | \"bold\" | \"regular\">"
      },
      "gap": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridAutoColumns": {
        "type": "string | ResponsiveValue<string>"
      },
      "gridAutoFlow": {
        "type": "\"row\" | ResponsiveValue<\"row\">"
      },
      "gridAutoRows": {
        "type": "string | ResponsiveValue<string>"
      },
      "gridColumn": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridColumnEnd": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridColumnStart": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridRow": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridRowEnd": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridRowStart": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridTemplateColumns": {
        "type": "string | ResponsiveValue<string>"
      },
      "gridTemplateRows": {
        "type": "string | ResponsiveValue<string>"
      },
      "grow": {
        "type": "number | ResponsiveValue<number>"
      },
      "header": {
        "type": "false | TableHeaderStyle | ResponsiveValue<false | TableHeaderStyle>",
        "description": "Estilo da linha de cabeçalho (padrão DEFAULTS.table.header); `false` = sem cabeçalho."
      },
      "headerRows": {
        "type": "readonly (readonly TableCellValue[])[] | ResponsiveValue<readonly (readonly TableCellValue[])[]>",
        "description": "M14: linhas de cabeçalho acima da linha de `columns[].header` (cabeçalho de dois níveis): cada linha cobre todas as colunas (com `colSpan`). Estilo do cabeçalho; repetem nas partes paginadas."
      },
      "height": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "id": {
        "type": "string | ResponsiveValue<string>",
        "description": "M12: identificador do nó para `Connector from/to`. Único no slide (duplicado → ResolveError); não muda layout nem pintura."
      },
      "inset": {
        "type": "string | number | ResponsiveValue<BoxShorthand>"
      },
      "justifyContent": {
        "type": "\"start\" | \"center\" | \"end\" | \"flex-start\" | \"flex-end\" | \"space-between\" | \"space-around\" | \"space-evenly\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"flex-start\" | \"flex-end\" | \"space-between\" | \"space-around\" | \"space-evenly\">"
      },
      "justifyItems": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\">"
      },
      "justifySelf": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | \"auto\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\" | \"auto\">"
      },
      "left": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "letterSpacing": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "lineHeight": {
        "type": "number | \"normal\" | ResponsiveValue<number | \"normal\">"
      },
      "margin": {
        "type": "string | number | { readonly top?: number | undefined; readonly right?: number | undefined; readonly bottom?: number | undefined; readonly left?: number | undefined; } | ResponsiveValue<string | number | { readonly top?: number | undefined; readonly right?: number | undefined; readonly bottom?: number | undefined; readonly left?: number | undefined; }>"
      },
      "marginBottom": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<MarginInput>"
      },
      "marginLeft": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<MarginInput>"
      },
      "marginRight": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<MarginInput>"
      },
      "marginTop": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<MarginInput>"
      },
      "maxHeight": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "maxWidth": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "minHeight": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "minSize": {
        "type": "number | ResponsiveValue<number>",
        "description": "padrão: como no Text (75% de size, piso minLegibleSize)"
      },
      "minWidth": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "opacity": {
        "type": "number | ResponsiveValue<number>"
      },
      "order": {
        "type": "number | ResponsiveValue<number>"
      },
      "outline": {
        "type": "string | number | ResponsiveValue<string | number>",
        "description": "Contorno que não ocupa espaço ('1px solid #ccc'; número = largura). Só sólido no PPTX."
      },
      "outlineColor": {
        "type": "string | ResponsiveValue<string>"
      },
      "outlineWidth": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "overflow": {
        "type": "\"hidden\" | \"visible\" | ResponsiveValue<\"hidden\" | \"visible\">"
      },
      "paddingBottom": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "paddingLeft": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "paddingRight": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "paddingTop": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "paginate": {
        "type": "boolean | ResponsiveValue<boolean>",
        "description": "M14: linhas que não cabem continuam num clone do slide (corte entre linhas, nunca num rowSpan)."
      },
      "placeItems": {
        "type": "string | ResponsiveValue<string>"
      },
      "placeSelf": {
        "type": "string | ResponsiveValue<string>"
      },
      "position": {
        "type": "\"static\" | \"relative\" | \"absolute\" | ResponsiveValue<\"static\" | \"relative\" | \"absolute\">"
      },
      "repeatHeader": {
        "type": "boolean | ResponsiveValue<boolean>",
        "description": "M14: repete o cabeçalho em cada parte paginada; padrão true."
      },
      "right": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "rotate": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "rowGap": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "rows": {
        "type": "readonly (readonly TableCellValue[])[] | ResponsiveValue<readonly (readonly TableCellValue[])[]>",
        "description": "rows[i].length === columns.length; números viram texto na resolução."
      },
      "shrink": {
        "type": "number | ResponsiveValue<number>"
      },
      "size": {
        "type": "number | ResponsiveValue<number>",
        "description": "pt; padrão 18"
      },
      "stripe": {
        "type": "string | ResponsiveValue<string>",
        "description": "Fundo das linhas de dados pares (2ª, 4ª…); ausente = sem zebra."
      },
      "style": {
        "type": "Readonly<Record<string, unknown>> | ResponsiveValue<Readonly<Record<string, unknown>>>",
        "description": "Escape: qualquer CSS; o que não tem de/para vira diagnóstico css-not-emitted."
      },
      "textAlign": {
        "type": "\"right\" | \"left\" | \"start\" | \"center\" | \"end\" | ResponsiveValue<\"right\" | \"left\" | \"start\" | \"center\" | \"end\">"
      },
      "textDecoration": {
        "type": "\"none\" | \"underline\" | \"line-through\" | \"underline line-through\" | ResponsiveValue<\"none\" | \"underline\" | \"line-through\" | \"underline line-through\">"
      },
      "textTransform": {
        "type": "\"none\" | \"uppercase\" | \"lowercase\" | \"capitalize\" | ResponsiveValue<\"none\" | \"uppercase\" | \"lowercase\" | \"capitalize\">"
      },
      "top": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "transform": {
        "type": "string | ResponsiveValue<string>"
      },
      "valign": {
        "type": "\"top\" | \"bottom\" | \"middle\" | ResponsiveValue<CellVerticalAlign>",
        "description": "M14: alinhamento vertical padrão das células; padrão 'top'."
      },
      "width": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "zIndex": {
        "type": "number | ResponsiveValue<number>"
      }
    },
    "required": [
      "columns",
      "rows"
    ]
  },
  "path": {
    "type": "object",
    "properties": {
      "alignContent": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | \"flex-start\" | \"flex-end\" | \"space-between\" | \"space-around\" | \"space-evenly\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\" | \"flex-start\" | \"flex-end\" | \"space-between\" | \"space-around\" | \"space-evenly\">"
      },
      "alignItems": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | \"baseline\" | \"flex-start\" | \"flex-end\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\" | \"baseline\" | \"flex-start\" | \"flex-end\">"
      },
      "alignSelf": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | \"baseline\" | \"flex-start\" | \"flex-end\" | \"auto\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\" | \"baseline\" | \"flex-start\" | \"flex-end\" | \"auto\">"
      },
      "aspectRatio": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "backgroundColor": {
        "type": "string | ResponsiveValue<string>"
      },
      "backgroundImage": {
        "type": "string | ResponsiveValue<string>"
      },
      "border": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderBottom": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderColor": {
        "type": "string | ResponsiveValue<string>"
      },
      "borderLeft": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderRadius": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderRight": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderStyle": {
        "type": "\"none\" | \"solid\" | \"dashed\" | \"dotted\" | ResponsiveValue<\"none\" | \"solid\" | \"dashed\" | \"dotted\">"
      },
      "borderTop": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderWidth": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "bottom": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "boxShadow": {
        "type": "string | ResponsiveValue<string>"
      },
      "boxSizing": {
        "type": "\"border-box\" | ResponsiveValue<\"border-box\">"
      },
      "color": {
        "type": "string | ResponsiveValue<string>"
      },
      "columnGap": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "d": {
        "type": "string | ResponsiveValue<string>"
      },
      "display": {
        "type": "\"flex\" | \"block\" | \"grid\" | \"none\" | ResponsiveValue<\"flex\" | \"block\" | \"grid\" | \"none\">"
      },
      "fill": {
        "type": "string | ResponsiveValue<string>"
      },
      "flex": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "flexBasis": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<CssLengthInput | \"auto\">"
      },
      "flexDirection": {
        "type": "\"row\" | \"column\" | \"row-reverse\" | \"column-reverse\" | ResponsiveValue<\"row\" | \"column\" | \"row-reverse\" | \"column-reverse\">"
      },
      "flexGrow": {
        "type": "number | ResponsiveValue<number>"
      },
      "flexShrink": {
        "type": "number | ResponsiveValue<number>"
      },
      "flexWrap": {
        "type": "\"nowrap\" | \"wrap\" | \"wrap-reverse\" | ResponsiveValue<\"nowrap\" | \"wrap\" | \"wrap-reverse\">"
      },
      "fontFamily": {
        "type": "string | ResponsiveValue<string>"
      },
      "fontSize": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "fontStyle": {
        "type": "\"normal\" | \"italic\" | ResponsiveValue<\"normal\" | \"italic\">"
      },
      "fontWeight": {
        "type": "number | \"normal\" | \"bold\" | \"regular\" | ResponsiveValue<number | \"normal\" | \"bold\" | \"regular\">"
      },
      "gap": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridAutoColumns": {
        "type": "string | ResponsiveValue<string>"
      },
      "gridAutoFlow": {
        "type": "\"row\" | ResponsiveValue<\"row\">"
      },
      "gridAutoRows": {
        "type": "string | ResponsiveValue<string>"
      },
      "gridColumn": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridColumnEnd": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridColumnStart": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridRow": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridRowEnd": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridRowStart": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridTemplateColumns": {
        "type": "string | ResponsiveValue<string>"
      },
      "gridTemplateRows": {
        "type": "string | ResponsiveValue<string>"
      },
      "grow": {
        "type": "number | ResponsiveValue<number>"
      },
      "height": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "id": {
        "type": "string | ResponsiveValue<string>",
        "description": "M12: identificador do nó para `Connector from/to`. Único no slide (duplicado → ResolveError); não muda layout nem pintura."
      },
      "inset": {
        "type": "string | number | ResponsiveValue<BoxShorthand>"
      },
      "justifyContent": {
        "type": "\"start\" | \"center\" | \"end\" | \"flex-start\" | \"flex-end\" | \"space-between\" | \"space-around\" | \"space-evenly\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"flex-start\" | \"flex-end\" | \"space-between\" | \"space-around\" | \"space-evenly\">"
      },
      "justifyItems": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\">"
      },
      "justifySelf": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | \"auto\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\" | \"auto\">"
      },
      "left": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "letterSpacing": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "lineCap": {
        "type": "\"flat\" | \"round\" | ResponsiveValue<LineCap>",
        "description": "Padrão 'flat' e 'miter' (os do PPTX)."
      },
      "lineHeight": {
        "type": "number | \"normal\" | ResponsiveValue<number | \"normal\">"
      },
      "lineJoin": {
        "type": "\"round\" | \"miter\" | \"bevel\" | ResponsiveValue<LineJoin>"
      },
      "lineStyle": {
        "type": "\"solid\" | \"dashed\" | \"dotted\" | ResponsiveValue<LineStyle>"
      },
      "margin": {
        "type": "string | number | { readonly top?: number | undefined; readonly right?: number | undefined; readonly bottom?: number | undefined; readonly left?: number | undefined; } | ResponsiveValue<string | number | { readonly top?: number | undefined; readonly right?: number | undefined; readonly bottom?: number | undefined; readonly left?: number | undefined; }>"
      },
      "marginBottom": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<MarginInput>"
      },
      "marginLeft": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<MarginInput>"
      },
      "marginRight": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<MarginInput>"
      },
      "marginTop": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<MarginInput>"
      },
      "maxHeight": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "maxWidth": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "minHeight": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "minWidth": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "opacity": {
        "type": "number | ResponsiveValue<number>"
      },
      "order": {
        "type": "number | ResponsiveValue<number>"
      },
      "outline": {
        "type": "string | number | ResponsiveValue<string | number>",
        "description": "Contorno que não ocupa espaço ('1px solid #ccc'; número = largura). Só sólido no PPTX."
      },
      "outlineColor": {
        "type": "string | ResponsiveValue<string>"
      },
      "outlineWidth": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "overflow": {
        "type": "\"hidden\" | \"visible\" | ResponsiveValue<\"hidden\" | \"visible\">"
      },
      "padding": {
        "type": "string | number | { readonly top?: number | undefined; readonly right?: number | undefined; readonly bottom?: number | undefined; readonly left?: number | undefined; } | ResponsiveValue<string | number | { readonly top?: number | undefined; readonly right?: number | undefined; readonly bottom?: number | undefined; readonly left?: number | undefined; }>"
      },
      "paddingBottom": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "paddingLeft": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "paddingRight": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "paddingTop": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "placeItems": {
        "type": "string | ResponsiveValue<string>"
      },
      "placeSelf": {
        "type": "string | ResponsiveValue<string>"
      },
      "position": {
        "type": "\"static\" | \"relative\" | \"absolute\" | ResponsiveValue<\"static\" | \"relative\" | \"absolute\">"
      },
      "right": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "rotate": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "rowGap": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "shrink": {
        "type": "number | ResponsiveValue<number>"
      },
      "stroke": {
        "type": "string | ResponsiveValue<string>"
      },
      "strokeWidth": {
        "type": "number | ResponsiveValue<number>",
        "description": "padrão 1 pt quando stroke definido"
      },
      "style": {
        "type": "Readonly<Record<string, unknown>> | ResponsiveValue<Readonly<Record<string, unknown>>>",
        "description": "Escape: qualquer CSS; o que não tem de/para vira diagnóstico css-not-emitted."
      },
      "textAlign": {
        "type": "\"right\" | \"left\" | \"start\" | \"center\" | \"end\" | ResponsiveValue<\"right\" | \"left\" | \"start\" | \"center\" | \"end\">"
      },
      "textDecoration": {
        "type": "\"none\" | \"underline\" | \"line-through\" | \"underline line-through\" | ResponsiveValue<\"none\" | \"underline\" | \"line-through\" | \"underline line-through\">"
      },
      "textTransform": {
        "type": "\"none\" | \"uppercase\" | \"lowercase\" | \"capitalize\" | ResponsiveValue<\"none\" | \"uppercase\" | \"lowercase\" | \"capitalize\">"
      },
      "top": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "transform": {
        "type": "string | ResponsiveValue<string>"
      },
      "viewBox": {
        "type": "readonly [number, number] | ResponsiveValue<readonly [number, number]>",
        "description": "[largura, altura] com origem em 0,0; padrão: a caixa envolvente do `d`."
      },
      "width": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "zIndex": {
        "type": "number | ResponsiveValue<number>"
      }
    },
    "required": [
      "d"
    ]
  },
  "icon": {
    "type": "object",
    "properties": {
      "alignContent": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | \"flex-start\" | \"flex-end\" | \"space-between\" | \"space-around\" | \"space-evenly\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\" | \"flex-start\" | \"flex-end\" | \"space-between\" | \"space-around\" | \"space-evenly\">"
      },
      "alignItems": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | \"baseline\" | \"flex-start\" | \"flex-end\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\" | \"baseline\" | \"flex-start\" | \"flex-end\">"
      },
      "alignSelf": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | \"baseline\" | \"flex-start\" | \"flex-end\" | \"auto\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\" | \"baseline\" | \"flex-start\" | \"flex-end\" | \"auto\">"
      },
      "aspectRatio": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "backgroundColor": {
        "type": "string | ResponsiveValue<string>"
      },
      "backgroundImage": {
        "type": "string | ResponsiveValue<string>"
      },
      "border": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderBottom": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderColor": {
        "type": "string | ResponsiveValue<string>"
      },
      "borderLeft": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderRadius": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderRight": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderStyle": {
        "type": "\"none\" | \"solid\" | \"dashed\" | \"dotted\" | ResponsiveValue<\"none\" | \"solid\" | \"dashed\" | \"dotted\">"
      },
      "borderTop": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderWidth": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "bottom": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "boxShadow": {
        "type": "string | ResponsiveValue<string>"
      },
      "boxSizing": {
        "type": "\"border-box\" | ResponsiveValue<\"border-box\">"
      },
      "color": {
        "type": "string | ResponsiveValue<string>"
      },
      "columnGap": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "display": {
        "type": "\"flex\" | \"block\" | \"grid\" | \"none\" | ResponsiveValue<\"flex\" | \"block\" | \"grid\" | \"none\">"
      },
      "flex": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "flexBasis": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<CssLengthInput | \"auto\">"
      },
      "flexDirection": {
        "type": "\"row\" | \"column\" | \"row-reverse\" | \"column-reverse\" | ResponsiveValue<\"row\" | \"column\" | \"row-reverse\" | \"column-reverse\">"
      },
      "flexGrow": {
        "type": "number | ResponsiveValue<number>"
      },
      "flexShrink": {
        "type": "number | ResponsiveValue<number>"
      },
      "flexWrap": {
        "type": "\"nowrap\" | \"wrap\" | \"wrap-reverse\" | ResponsiveValue<\"nowrap\" | \"wrap\" | \"wrap-reverse\">"
      },
      "fontFamily": {
        "type": "string | ResponsiveValue<string>"
      },
      "fontSize": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "fontStyle": {
        "type": "\"normal\" | \"italic\" | ResponsiveValue<\"normal\" | \"italic\">"
      },
      "fontWeight": {
        "type": "number | \"normal\" | \"bold\" | \"regular\" | ResponsiveValue<number | \"normal\" | \"bold\" | \"regular\">"
      },
      "gap": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridAutoColumns": {
        "type": "string | ResponsiveValue<string>"
      },
      "gridAutoFlow": {
        "type": "\"row\" | ResponsiveValue<\"row\">"
      },
      "gridAutoRows": {
        "type": "string | ResponsiveValue<string>"
      },
      "gridColumn": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridColumnEnd": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridColumnStart": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridRow": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridRowEnd": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridRowStart": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridTemplateColumns": {
        "type": "string | ResponsiveValue<string>"
      },
      "gridTemplateRows": {
        "type": "string | ResponsiveValue<string>"
      },
      "grow": {
        "type": "number | ResponsiveValue<number>"
      },
      "height": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "id": {
        "type": "string | ResponsiveValue<string>",
        "description": "M12: identificador do nó para `Connector from/to`. Único no slide (duplicado → ResolveError); não muda layout nem pintura."
      },
      "inset": {
        "type": "string | number | ResponsiveValue<BoxShorthand>"
      },
      "justifyContent": {
        "type": "\"start\" | \"center\" | \"end\" | \"flex-start\" | \"flex-end\" | \"space-between\" | \"space-around\" | \"space-evenly\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"flex-start\" | \"flex-end\" | \"space-between\" | \"space-around\" | \"space-evenly\">"
      },
      "justifyItems": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\">"
      },
      "justifySelf": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | \"auto\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\" | \"auto\">"
      },
      "left": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "letterSpacing": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "lineHeight": {
        "type": "number | \"normal\" | ResponsiveValue<number | \"normal\">"
      },
      "margin": {
        "type": "string | number | { readonly top?: number | undefined; readonly right?: number | undefined; readonly bottom?: number | undefined; readonly left?: number | undefined; } | ResponsiveValue<string | number | { readonly top?: number | undefined; readonly right?: number | undefined; readonly bottom?: number | undefined; readonly left?: number | undefined; }>"
      },
      "marginBottom": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<MarginInput>"
      },
      "marginLeft": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<MarginInput>"
      },
      "marginRight": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<MarginInput>"
      },
      "marginTop": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<MarginInput>"
      },
      "maxHeight": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "maxWidth": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "minHeight": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "minWidth": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "opacity": {
        "type": "number | ResponsiveValue<number>"
      },
      "order": {
        "type": "number | ResponsiveValue<number>"
      },
      "outline": {
        "type": "string | number | ResponsiveValue<string | number>",
        "description": "Contorno que não ocupa espaço ('1px solid #ccc'; número = largura). Só sólido no PPTX."
      },
      "outlineColor": {
        "type": "string | ResponsiveValue<string>"
      },
      "outlineWidth": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "overflow": {
        "type": "\"hidden\" | \"visible\" | ResponsiveValue<\"hidden\" | \"visible\">"
      },
      "padding": {
        "type": "string | number | { readonly top?: number | undefined; readonly right?: number | undefined; readonly bottom?: number | undefined; readonly left?: number | undefined; } | ResponsiveValue<string | number | { readonly top?: number | undefined; readonly right?: number | undefined; readonly bottom?: number | undefined; readonly left?: number | undefined; }>"
      },
      "paddingBottom": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "paddingLeft": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "paddingRight": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "paddingTop": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "placeItems": {
        "type": "string | ResponsiveValue<string>"
      },
      "placeSelf": {
        "type": "string | ResponsiveValue<string>"
      },
      "position": {
        "type": "\"static\" | \"relative\" | \"absolute\" | ResponsiveValue<\"static\" | \"relative\" | \"absolute\">"
      },
      "recolor": {
        "type": "boolean | ResponsiveValue<boolean>",
        "description": "Troca também fills/strokes pretos por `color`; padrão true."
      },
      "render": {
        "type": "\"auto\" | \"shape\" | \"image\" | ResponsiveValue<\"auto\" | \"shape\" | \"image\">",
        "description": "'shape' exige vetor (senão ResolveError); 'image' força a imagem. Padrão 'auto'."
      },
      "right": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "rotate": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "rowGap": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "shrink": {
        "type": "number | ResponsiveValue<number>"
      },
      "size": {
        "type": "number | ResponsiveValue<number>",
        "description": "Altura em pt quando o autor não dá width/height; padrão DEFAULTS.icon.size."
      },
      "src": {
        "type": "string"
      },
      "style": {
        "type": "Readonly<Record<string, unknown>> | ResponsiveValue<Readonly<Record<string, unknown>>>",
        "description": "Escape: qualquer CSS; o que não tem de/para vira diagnóstico css-not-emitted."
      },
      "textAlign": {
        "type": "\"right\" | \"left\" | \"start\" | \"center\" | \"end\" | ResponsiveValue<\"right\" | \"left\" | \"start\" | \"center\" | \"end\">"
      },
      "textDecoration": {
        "type": "\"none\" | \"underline\" | \"line-through\" | \"underline line-through\" | ResponsiveValue<\"none\" | \"underline\" | \"line-through\" | \"underline line-through\">"
      },
      "textTransform": {
        "type": "\"none\" | \"uppercase\" | \"lowercase\" | \"capitalize\" | ResponsiveValue<\"none\" | \"uppercase\" | \"lowercase\" | \"capitalize\">"
      },
      "top": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "transform": {
        "type": "string | ResponsiveValue<string>"
      },
      "width": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "zIndex": {
        "type": "number | ResponsiveValue<number>"
      }
    },
    "required": [
      "src"
    ]
  },
  "connector": {
    "type": "object",
    "properties": {
      "endArrow": {
        "type": "\"none\" | \"triangle\" | \"diamond\" | \"arrow\" | \"stealth\" | \"oval\" | ResponsiveValue<ArrowType>"
      },
      "from": {
        "type": "string | ResponsiveValue<string>"
      },
      "fromSide": {
        "type": "\"top\" | \"right\" | \"bottom\" | \"left\" | \"auto\" | ResponsiveValue<ConnectorSide>",
        "description": "Padrão 'auto': o par de lados (pontos médios) mais próximo."
      },
      "label": {
        "type": "string | number | boolean | SlideElement | readonly TextChildren[] | ResponsiveValue<string | number | boolean | SlideElement | readonly TextChildren[] | null>",
        "description": "Texto simples ou Span/B/I, como num Text; centrado no segmento mais longo."
      },
      "labelStyle": {
        "type": "ConnectorLabelStyle | ResponsiveValue<ConnectorLabelStyle>"
      },
      "lineStyle": {
        "type": "\"solid\" | \"dashed\" | \"dotted\" | ResponsiveValue<LineStyle>"
      },
      "route": {
        "type": "\"straight\" | \"elbow\" | ResponsiveValue<ConnectorRoute>",
        "description": "Padrão 'straight'."
      },
      "startArrow": {
        "type": "\"none\" | \"triangle\" | \"diamond\" | \"arrow\" | \"stealth\" | \"oval\" | ResponsiveValue<ArrowType>",
        "description": "Padrão 'none' e DEFAULTS.connector.endArrow."
      },
      "stroke": {
        "type": "string | ResponsiveValue<string>",
        "description": "Padrão DEFAULTS.connector.stroke / strokeWidth."
      },
      "strokeWidth": {
        "type": "number | ResponsiveValue<number>"
      },
      "to": {
        "type": "string | ResponsiveValue<string>"
      },
      "toSide": {
        "type": "\"top\" | \"right\" | \"bottom\" | \"left\" | \"auto\" | ResponsiveValue<ConnectorSide>"
      }
    },
    "required": [
      "from",
      "to"
    ]
  },
  "slideNumber": {
    "type": "object",
    "properties": {
      "align": {
        "type": "\"right\" | \"left\" | \"center\" | ResponsiveValue<TextAlign>"
      },
      "alignContent": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | \"flex-start\" | \"flex-end\" | \"space-between\" | \"space-around\" | \"space-evenly\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\" | \"flex-start\" | \"flex-end\" | \"space-between\" | \"space-around\" | \"space-evenly\">"
      },
      "alignItems": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | \"baseline\" | \"flex-start\" | \"flex-end\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\" | \"baseline\" | \"flex-start\" | \"flex-end\">"
      },
      "alignSelf": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | \"baseline\" | \"flex-start\" | \"flex-end\" | \"auto\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\" | \"baseline\" | \"flex-start\" | \"flex-end\" | \"auto\">"
      },
      "aspectRatio": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "backgroundColor": {
        "type": "string | ResponsiveValue<string>"
      },
      "backgroundImage": {
        "type": "string | ResponsiveValue<string>"
      },
      "border": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderBottom": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderColor": {
        "type": "string | ResponsiveValue<string>"
      },
      "borderLeft": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderRadius": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderRight": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderStyle": {
        "type": "\"none\" | \"solid\" | \"dashed\" | \"dotted\" | ResponsiveValue<\"none\" | \"solid\" | \"dashed\" | \"dotted\">"
      },
      "borderTop": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "borderWidth": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "bottom": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "boxShadow": {
        "type": "string | ResponsiveValue<string>"
      },
      "boxSizing": {
        "type": "\"border-box\" | ResponsiveValue<\"border-box\">"
      },
      "color": {
        "type": "string | ResponsiveValue<string>"
      },
      "columnGap": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "display": {
        "type": "\"flex\" | \"block\" | \"grid\" | \"none\" | ResponsiveValue<\"flex\" | \"block\" | \"grid\" | \"none\">"
      },
      "flex": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "flexBasis": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<CssLengthInput | \"auto\">"
      },
      "flexDirection": {
        "type": "\"row\" | \"column\" | \"row-reverse\" | \"column-reverse\" | ResponsiveValue<\"row\" | \"column\" | \"row-reverse\" | \"column-reverse\">"
      },
      "flexGrow": {
        "type": "number | ResponsiveValue<number>"
      },
      "flexShrink": {
        "type": "number | ResponsiveValue<number>"
      },
      "flexWrap": {
        "type": "\"nowrap\" | \"wrap\" | \"wrap-reverse\" | ResponsiveValue<\"nowrap\" | \"wrap\" | \"wrap-reverse\">"
      },
      "font": {
        "type": "string | ResponsiveValue<string>",
        "description": "Família registrada; padrão 'Arial'."
      },
      "fontFamily": {
        "type": "string | ResponsiveValue<string>"
      },
      "fontSize": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "fontStyle": {
        "type": "\"normal\" | \"italic\" | ResponsiveValue<\"normal\" | \"italic\">"
      },
      "fontWeight": {
        "type": "number | \"normal\" | \"bold\" | \"regular\" | ResponsiveValue<number | \"normal\" | \"bold\" | \"regular\">"
      },
      "format": {
        "type": "\"n\" | \"n / total\" | ResponsiveValue<SlideNumberFormat>",
        "description": "Padrão 'n'."
      },
      "gap": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridAutoColumns": {
        "type": "string | ResponsiveValue<string>"
      },
      "gridAutoFlow": {
        "type": "\"row\" | ResponsiveValue<\"row\">"
      },
      "gridAutoRows": {
        "type": "string | ResponsiveValue<string>"
      },
      "gridColumn": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridColumnEnd": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridColumnStart": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridRow": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridRowEnd": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridRowStart": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "gridTemplateColumns": {
        "type": "string | ResponsiveValue<string>"
      },
      "gridTemplateRows": {
        "type": "string | ResponsiveValue<string>"
      },
      "grow": {
        "type": "number | ResponsiveValue<number>"
      },
      "height": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "id": {
        "type": "string | ResponsiveValue<string>",
        "description": "M12: identificador do nó para `Connector from/to`. Único no slide (duplicado → ResolveError); não muda layout nem pintura."
      },
      "inset": {
        "type": "string | number | ResponsiveValue<BoxShorthand>"
      },
      "italic": {
        "type": "boolean | ResponsiveValue<boolean>"
      },
      "justifyContent": {
        "type": "\"start\" | \"center\" | \"end\" | \"flex-start\" | \"flex-end\" | \"space-between\" | \"space-around\" | \"space-evenly\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"flex-start\" | \"flex-end\" | \"space-between\" | \"space-around\" | \"space-evenly\">"
      },
      "justifyItems": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\">"
      },
      "justifySelf": {
        "type": "\"start\" | \"center\" | \"end\" | \"stretch\" | \"auto\" | ResponsiveValue<\"start\" | \"center\" | \"end\" | \"stretch\" | \"auto\">"
      },
      "left": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "letterSpacing": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "lineHeight": {
        "type": "number | \"normal\" | ResponsiveValue<number | \"normal\">"
      },
      "margin": {
        "type": "string | number | { readonly top?: number | undefined; readonly right?: number | undefined; readonly bottom?: number | undefined; readonly left?: number | undefined; } | ResponsiveValue<string | number | { readonly top?: number | undefined; readonly right?: number | undefined; readonly bottom?: number | undefined; readonly left?: number | undefined; }>"
      },
      "marginBottom": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<MarginInput>"
      },
      "marginLeft": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<MarginInput>"
      },
      "marginRight": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<MarginInput>"
      },
      "marginTop": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | \"auto\" | ResponsiveValue<MarginInput>"
      },
      "maxHeight": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "maxWidth": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "minHeight": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "minWidth": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "opacity": {
        "type": "number | ResponsiveValue<number>"
      },
      "order": {
        "type": "number | ResponsiveValue<number>"
      },
      "outline": {
        "type": "string | number | ResponsiveValue<string | number>",
        "description": "Contorno que não ocupa espaço ('1px solid #ccc'; número = largura). Só sólido no PPTX."
      },
      "outlineColor": {
        "type": "string | ResponsiveValue<string>"
      },
      "outlineWidth": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "overflow": {
        "type": "\"hidden\" | \"visible\" | ResponsiveValue<\"hidden\" | \"visible\">"
      },
      "padding": {
        "type": "string | number | { readonly top?: number | undefined; readonly right?: number | undefined; readonly bottom?: number | undefined; readonly left?: number | undefined; } | ResponsiveValue<string | number | { readonly top?: number | undefined; readonly right?: number | undefined; readonly bottom?: number | undefined; readonly left?: number | undefined; }>"
      },
      "paddingBottom": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "paddingLeft": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "paddingRight": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "paddingTop": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "placeItems": {
        "type": "string | ResponsiveValue<string>"
      },
      "placeSelf": {
        "type": "string | ResponsiveValue<string>"
      },
      "position": {
        "type": "\"static\" | \"relative\" | \"absolute\" | ResponsiveValue<\"static\" | \"relative\" | \"absolute\">"
      },
      "right": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "rotate": {
        "type": "string | number | ResponsiveValue<string | number>"
      },
      "rowGap": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "shrink": {
        "type": "number | ResponsiveValue<number>"
      },
      "size": {
        "type": "number | ResponsiveValue<number>",
        "description": "pt; padrão 18"
      },
      "style": {
        "type": "Readonly<Record<string, unknown>> | ResponsiveValue<Readonly<Record<string, unknown>>>",
        "description": "Escape: qualquer CSS; o que não tem de/para vira diagnóstico css-not-emitted."
      },
      "textAlign": {
        "type": "\"right\" | \"left\" | \"start\" | \"center\" | \"end\" | ResponsiveValue<\"right\" | \"left\" | \"start\" | \"center\" | \"end\">"
      },
      "textDecoration": {
        "type": "\"none\" | \"underline\" | \"line-through\" | \"underline line-through\" | ResponsiveValue<\"none\" | \"underline\" | \"line-through\" | \"underline line-through\">"
      },
      "textTransform": {
        "type": "\"none\" | \"uppercase\" | \"lowercase\" | \"capitalize\" | ResponsiveValue<\"none\" | \"uppercase\" | \"lowercase\" | \"capitalize\">"
      },
      "top": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "transform": {
        "type": "string | ResponsiveValue<string>"
      },
      "weight": {
        "type": "number | \"bold\" | \"regular\" | ResponsiveValue<FontWeight>"
      },
      "width": {
        "type": "number | `${number}px` | `${number}pt` | `${number}%` | ResponsiveValue<CssLengthInput>"
      },
      "zIndex": {
        "type": "number | ResponsiveValue<number>"
      }
    },
    "required": []
  }
} as const;
