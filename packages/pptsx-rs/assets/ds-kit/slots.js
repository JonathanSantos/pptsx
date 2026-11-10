/** O conteúdo do slot, ou o padrão quando ele não veio (null, undefined ou false). */
export const slot = (value, fallback = null) => value === undefined || value === null || value === false ? fallback : value;
/** Os slots que vieram preenchidos (para o componente decidir o layout: com ou sem aside). */
export const filledSlots = (props, names) => names.filter((name) => props[name] !== undefined && props[name] !== null && props[name] !== false);
