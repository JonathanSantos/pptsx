import { toHexColor } from 'pptsx';
const COLOR_GROUPS = new Set(['color', 'colors']);
const isTree = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const normalize = (tree, path, inColor) => Object.fromEntries(Object.entries(tree).map(([key, value]) => {
    const here = [...path, key];
    if (isTree(value))
        return [key, normalize(value, here, inColor || COLOR_GROUPS.has(key))];
    if (inColor) {
        try {
            return [key, toHexColor(value)];
        }
        catch (error) {
            throw new Error(`defineTokens: ${here.join('.')} não é uma cor (${error.message})`);
        }
    }
    if (typeof value === 'number' && !Number.isFinite(value))
        throw new Error(`defineTokens: ${here.join('.')} não é um número finito`);
    return [key, value];
}));
const deepFreeze = (value) => {
    if (isTree(value))
        Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
};
const at = (tree, path) => {
    const value = path.split('.').reduce((node, key) => (isTree(node) ? node[key] : undefined), tree);
    if (value === undefined || isTree(value))
        throw new Error(`token "${path}" não existe (ou é um grupo)`);
    return value;
};
const HALF_POINT = 2;
export const defineTokens = (tokens) => {
    const tree = normalize(tokens, [], false);
    const tokenAt = (path) => at(tree, path);
    const scale = (path, factor) => {
        const value = tokenAt(path);
        if (typeof value !== 'number')
            throw new Error(`token "${path}" não é numérico`);
        return Math.round(value * factor * HALF_POINT) / HALF_POINT;
    };
    return deepFreeze({ ...tree, tokenAt, scale });
};
/** Todas as cores dos tokens (já '#RRGGBB'): a paleta permitida das regras de cor. */
export const colorsOf = (tokens) => {
    const walk = (tree, inColor) => Object.entries(tree).flatMap(([key, value]) => {
        if (isTree(value))
            return walk(value, inColor || COLOR_GROUPS.has(key));
        // As funções de defineTokens (tokenAt, scale) não são tokens.
        return inColor && typeof value === 'string' ? [value] : [];
    });
    return [...new Set(walk(tokens, false))];
};
