import { isResponsive, mapResponsive } from 'pptsx';
const optionOf = (variants, name, option) => {
    const props = variants[name]?.[option];
    if (props === undefined)
        throw new Error(`variante ${name}="${option}" não existe; use ${Object.keys(variants[name] ?? {}).join(', ')}`);
    return props;
};
const propsOfChoice = (variants, name, choice, base) => {
    if (!isResponsive(choice))
        return optionOf(variants, name, choice);
    // Responsiva: cada prop que alguma opção define vira um valor responsivo; quem não define herda a base.
    const options = Object.values(choice).map((option) => optionOf(variants, name, option));
    const keys = [...new Set(options.flatMap((props) => Object.keys(props)))];
    return Object.fromEntries(keys.map((key) => [key, mapResponsive(choice, (option) => optionOf(variants, name, option)[key] ?? base[key])]));
};
export const createVariants = (config) => {
    const base = config.base ?? {};
    return (selection = {}) => Object.keys(config.variants).reduce((props, name) => {
        const choice = selection[name] ?? config.defaults?.[name];
        return choice === undefined ? props : { ...props, ...propsOfChoice(config.variants, name, choice, base) };
    }, base);
};
