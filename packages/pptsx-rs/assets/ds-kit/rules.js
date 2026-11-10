import { colorsOf } from './tokens.js';
export const defineRule = (id, severity, check) => {
    if (id.trim() === '')
        throw new Error('defineRule: id vazio');
    return Object.freeze({ id, severity, check });
};
/** Cores que o nó pinta: fundo, bordas, contorno, cor de texto e dos trechos, fill/stroke de forma. */
export const paintedColorsOf = (node) => {
    const css = node.css;
    const borders = ['top', 'right', 'bottom', 'left'].flatMap((side) => (css.border[side].width > 0 ? [css.border[side].color] : []));
    const own = node.props;
    const runs = node.kind === 'text' ? node.runs.map((run) => run.color) : [];
    return [css.backgroundColor, css.outline?.color, ...borders, own.color, own.fill, own.stroke, ...runs]
        .filter((value) => typeof value === 'string')
        .map((value) => value.toUpperCase());
};
/** Toda cor pintada tem que estar nos tokens (hex solto no deck vira achado). */
export const colorsFromTokens = (id, tokens, severity = 'warning') => {
    const allowed = new Set(colorsOf(tokens).map((color) => color.toUpperCase()));
    return defineRule(id, severity, (node) => {
        const off = [...new Set(paintedColorsOf(node))].filter((color) => !allowed.has(color));
        return off.length === 0 ? [] : [{ message: `Cor fora dos tokens: ${off.join(', ')}. Use uma cor de tokens.color.` }];
    });
};
/** Texto só nas famílias do tema (título/corpo). */
export const fontsFromTheme = (id, theme, severity = 'warning') => {
    const families = [theme.fonts?.heading, theme.fonts?.body].filter((family) => family !== undefined);
    return defineRule(id, severity, (node) => {
        if (node.kind !== 'text' || families.length === 0)
            return [];
        const family = node.props.font;
        return family === undefined || families.includes(family) ? [] : [{ message: `Fonte "${family}" fora do tema (${families.join(', ')}).` }];
    });
};
/** O componente aceita no máximo n filhos. */
export const maxChildren = (id, component, max, severity = 'warning') => defineRule(id, severity, (node, ctx) => {
    if (ctx.component?.name !== component || !('children' in node))
        return [];
    return node.children.length <= max ? [] : [{ message: `${component} tem ${node.children.length} itens; o máximo é ${max}. Divida em dois ou use outro componente.` }];
});
/** O componente só pode aparecer no slide `index` do autor (base 1). */
export const onlyOnSlide = (id, component, index, severity = 'warning') => defineRule(id, severity, (_node, ctx) => ctx.component?.name === component && ctx.slide !== index
    ? [{ message: `${component} só vai no slide ${index}; está no slide ${ctx.slide}.` }]
    : []);
