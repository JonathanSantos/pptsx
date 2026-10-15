Cada layout devolve um `<Slide>` e é filho direto de `<Deck>`.

- `CoverLayout { title; subtitle?; caption?; ctx? }` — capa na cor da marca, círculo decorativo, título embaixo. Passe `ctx` para o círculo ficar redondo em 4:3. Só no 1º slide (regra `cover-only-first`).
- `ContentLayout { title; justify?: 'start' | 'center'; notes?; hidden?; children }` — título com barra de destaque e corpo `flex={1}` (coluna). `justify="center"` centraliza conteúdo curto.
- `ClosingLayout { title; subtitle?; contact?; ctx? }` — encerramento centralizado.
