# Changelog — @pptsx/ds-kit

## 0.2.0 — M18

- **Variantes tipadas pela primitiva-alvo** (`createVariants({ for: 'box' | 'text' | 'image' | 'shape' })`): nome CSS errado, valor do tipo errado, opção ou padrão inexistentes não compilam; o retorno tem só as props definidas. `catalog` e `defaults` do `defineComponent` tipados pelas props.
- `createDs` sem `schema`/`guide` monta os dois a partir dos metas (`schemaFromMeta`, `componentGuides`).
- Catálogo em `.pptx` (`catalog({ pptx: true })`, `pptsx-ds catalog --pptx`); o catálogo imprime os avisos de contraste do DS.
- `pptsx-ds init <pasta>`: um DS pronto (tokens, tema, componente com variante/slot/catálogo/guia, regras, manifesto, config) e `tsconfig.base.json` exportado para o `tsconfig` do DS só estender.
- `pptsx-ds skill <ds.ts> --out`: a skill do DS para Claude e Copilot.
- README reescrito na ordem de criação de um DS, com os trechos compilados por teste.
- Peer: `pptsx >=1.0.0`.

## 0.1.0 — M17

Primeira versão: `defineTokens` (validação e normalização das cores, `tokenAt`, `scale`), `themeOf` + `checkTheme` (WCAG AA como aviso), `createVariants` (variantes responsivas), `slot`/`filledSlots`/`Slots`, `defineRule` e as regras `colorsFromTokens`, `fontsFromTheme`, `maxChildren`, `onlyOnSlide`, `createDs`/`guideOf`, `catalog` (PNGs, overview por componente, fixtures; `check` ±1 pt), `schemaOf` e o bin `pptsx-ds catalog`. Peer: `pptsx >=0.7.0`.
