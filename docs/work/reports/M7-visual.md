# M7-G — Validação visual: pacote fora do repo, `init`, `--watch`, `lineBreaks` auto × forced

**Veredito: PASSA COM RESSALVAS.**

O critério "Pronto quando" do M7 está cumprido:
- O tarball do `npm pack`, instalado num diretório vazio fora do repo, faz `npx pptsx init` + `npx pptsx build deck.tsx` com exit 0.
- O `.pptx` abre e exporta no Keynote.
- `--watch` regenera o overview quando um arquivo é salvo.
- `lineBreaks: 'auto'` emite o texto sem `<a:br/>`.
- `npm test` roda sem o aviso do vitest.

O deck completo (`demo.tsx` com componentes, layouts, tokens e imagem) gera fora do repo PNGs **idênticos byte a byte** aos gerados dentro do repo.

As ressalvas são dois bugs de onboarding e um de `--watch` (ver "Bugs"):
1. Sem `tsconfig.json` no projeto, o build falha com `React is not defined`: o tsconfig de fallback do pacote não vale para arquivos fora de `node_modules/pptsx`.
2. O `init` mantém um `tsconfig.json` existente sem `jsx`/`jsxImportSource` e não avisa. O build depois falha com a mesma mensagem, sem pista.
3. `--watch` só passa a observar depois do build inicial. Uma gravação feita durante esse build se perde até a próxima.

Calibração no Keynote:
- `forced`: 42/42 caixas com as mesmas quebras do preview nativo, como no M3.
- `auto`: 10 das 34 amostras (mais a legenda) quebram em outro lugar e 2 delas ficam com uma linha a menos. **Nenhuma vaza do frame.** Em todas as divergências o Keynote põe *mais* texto por linha, nunca menos.

## Comandos

Tudo em `<S>` = `<scratchpad>/m7g`. O projeto externo fica em `<S>/proj`.

```
npm pack --pack-destination <S>                       # roda prepack → build; 122 arquivos, 942 kB (1,9 MB descompactado)
cd <S>/proj && npm init -y && npm install <S>/pptsx-0.0.0.tgz
npx pptsx init                                        # exit 0; troca "commonjs" → "module" com aviso
npx pptsx build deck.tsx --size 16x9,4x3              # exit 0, "Nenhum diagnóstico."
npm install -D typescript && npx tsc --noEmit         # limpo (TS 7.0.2)
# demo copiado de examples/ (demo.tsx, tokens.ts, components/, layouts/, assets/*)
npx pptsx build demo.tsx --size 16x9,4x3,wide         # exit 0, "Nenhum diagnóstico."
node bin/pptsx.mjs build examples/demo.tsx --size 16x9,4x3,wide --out <S>/repo-demo   # no repo, para comparar
npx pptsx build demo.tsx --watch --preview none --json   # em background (scripts <S>/watch-test*.sh)
node bin/pptsx.mjs build examples/calibration.tsx --size 16x9 --line-breaks forced --out <S>/calib-forced
node bin/pptsx.mjs build examples/calibration.tsx --size 16x9 --line-breaks auto   --out <S>/calib-auto
scripts/keynote-export.sh <S>/calib-{forced,auto}/calibration.16x9.pptx <S>/keynote-calib-{forced,auto}
```

Como comparei (ferramentas em `<S>/tools/`):
- O `keynote-export.sh` exporta a 720×405 px (1 px = 1 pt), pouco para texto de 8 pt. Por isso também exportei os dois `.pptx` para **PDF** pelo Keynote (`keynote-pdf.sh`) e rasterizei em 4× com CoreGraphics (`pdf2png.swift`, 2880×1620). Conferi que o PDF reduzido bate com o PNG do Keynote: diferença média 1,6–2,7 de 255, que é só antialiasing.
- `lines.py`:
  - pega o frame de cada caixa de texto no XML do `.pptx`;
  - acha as linhas pelo perfil horizontal de tinta (núcleo da altura-x, com limiar local);
  - mede o x inicial e final de cada linha no nativo (1280 px), no Keynote forced e no Keynote auto.

  Quebra igual = mesmo número de linhas e extremos a ≤ 2,5 pt (nativo × Keynote) ou ≤ 1 pt (Keynote × Keynote). A contagem de linhas detectadas bate com a do XML forced nas 42 caixas. Vazamento = tinta abaixo do fundo ou à direita do frame.
- `montage.py` gera `calib-auto-vs-forced.png`: cada amostra divergente com forced em cima, auto embaixo e o frame em vermelho.

## Por cenário

| # | Cenário | Resultado | OK? |
|---|---|---|---|
| 1a | `npm pack` | `dist/**/*.js` + `.d.ts`, `bin/pptsx.mjs`, `fonts/` (4 TTF + LICENSE), `tsconfig.deck.json`, `package.json`. Nenhum `.pptx`/`.png`. O `README.md` ainda não existia no meu pack; num 2º pack, depois do M7-F, entram `README.md` e `LICENSE` | ✔ |
| 1b | `npm init -y` + install do tarball | `npm init -y` grava `"type": "commonjs"`. A instalação passa; o `npm audit` acusa 3 *high* (transitivas: `pptxgenjs` → `image-size`) | ✔ (ver Observações) |
| 1c | `npx pptsx init` | Cria `deck.tsx`, `tsconfig.json` (`jsx: react-jsx`, `jsxImportSource: pptsx`, `module/moduleResolution: NodeNext`, `strict`, `skipLibCheck`), `pptsx.config.ts` (`defineConfig({})` com as opções comentadas), `assets/.gitkeep` e `.gitignore` (`dist/`). `package.json` vira `"type": "module"`, com aviso `▲ package.json: "type" trocado de "commonjs" para "module" …` e o resto preservado. Imprime os próximos passos | ✔ |
| 1d | `npx pptsx build deck.tsx --size 16x9,4x3` | Exit 0, "Nenhum diagnóstico.". Saem 2 `.pptx`, 2 overviews, 4 PNGs e `deck.diagnostics.json` | ✔ |
| 1e | Overviews do `init` | **16x9**: capa azul-marinho com a barra laranja, "Meu primeiro deck" em 44 pt branco e o subtítulo, alinhados embaixo (`justify="end"`); slide 2 com "Como funciona" e dois cartões cinza lado a lado ("Layout automático" / "Texto que cabe"), texto de 16 pt em 3 linhas. **4x3**: os cartões viram coluna (`ctx.aspect < 1.5`) e o texto cabe em 1–2 linhas. Nada vaza nem é cortado. O Keynote (`keynote-init-16x9/`, `keynote-init-4x3/`) mostra as mesmas quebras | ✔ |
| 1f | `npx tsc --noEmit` no projeto | Limpo. Com erros de propósito: `size="44"` → TS2322 string→number; `weight="heavy"` → TS2322 `FontWeight`; `colour=` → "Property 'colour' does not exist … Did you mean 'color'?"; `justify="middle"` → TS2322 `Justify`. Os tipos do pacote funcionam. `defineConfig({ lineBreaks: 'automatic' })` → TS2322 `LineBreaks` | ✔ |
| 2 | `demo.tsx` + componentes + imagem fora do repo | Build `16x9,4x3,wide` com exit 0, "Nenhum diagnóstico.". **Os 18 PNGs (15 slides + 3 overviews) têm md5 igual** aos do build no repo, e o `diagnostics.json` é igual. Nos 3 `.pptx` só muda `docProps/core.xml` (a data). O gráfico entra em `ppt/media/image-3-1.png`. Keynote 16x9 (`keynote-demo-16x9/`): slide 3 com o gráfico e as 3 bullets corretos. `tsc --noEmit` também passa com o demo copiado | ✔ |
| 3 | `--watch --preview none --json` fora do repo | O build inicial gera 1 linha NDJSON (`{files, diagnostics}`). Trocar `accent` em `tokens.ts` gera **1** linha nova, e o `slide2.xml` passa de `2F6FED` para `E4572E` (6×). Desfazer gera 1 linha nova e a cor volta. SIGINT → exit 0, stderr vazio | ✔ |
| 3b | `--watch` sem `--json`, com preview | Cada build termina com `[HH:MM:SS] Nenhum diagnóstico.`, e depois do inicial vem `[…] observando <dir> (Ctrl-C para sair)`. O **overview muda** quando `tokens.ts` é salvo (md5 diferente; `watch-overview-red.png`) e volta ao original quando a mudança é desfeita. Um erro de sintaxe em `tokens.ts` sai no stderr (`[…] erro: Transform failed … Unexpected ";"`) e o watch continua: o build seguinte sai normal. Uma mudança gravada durante um rebuild é enfileirada e gera mais um build, com o resultado final correto (`00AA55`) | ✔ (ver bug 3) |
| 4 | `--line-breaks auto` × `forced` no Keynote | Ver a tabela própria. `forced` bate com o nativo em 42/42 caixas. `auto` diverge em 10 de 34 amostras, sem vazamento | ✔ |
| 4b | Contrato do emissor `auto` | 0 `<a:br/>` em todos os slides do `auto` (18 só no slide 2 do `forced`). Um `<a:p>` por parágrafo, com o texto num run. `overflow.tsx` (truncado): o run termina em `…`. `cause.tsx`: "Indisponibilidade 0" sai inteiro (sem os pedaços da quebra por caractere). Config `lineBreaks: 'auto'` → 0 `<a:br/>`; `--line-breaks forced` vence a config (5 `<a:br/>` no demo). Valor inválido na flag ou na config → exit 1 com mensagem clara | ✔ |
| 5a | `init <dir>` com diretório inexistente | Cria `initA/sub/deck/` (com os pais) e um `package.json` mínimo (`name`, `private`, `"type": "module"`). Os próximos passos incluem `cd initA/sub/deck` | ✔ |
| 5b | `package.json` já `"type": "module"` | "mantido package.json"; **byte a byte igual** (`cmp`) | ✔ |
| 5c | 2º `init` sem `--force` | Exit 1: `…/deck.tsx já existe; use --force para sobrescrever (pptsx init <dir> --force)` | ✔ |
| 5d | `init --force` | Exit 0. Regrava deck, tsconfig, config, `.gitkeep` e `.gitignore`; mantém o `package.json` | ✔ (ver Sugestões) |
| 5e | `init --json` | stdout só com `{ "files": [ …6 caminhos absolutos ] }`. Com `commonjs`, o aviso vai para o **stderr** e o stdout continua só JSON | ✔ |
| 5f | `package.json` sem `type` | `"type": "module"` acrescentado; `dependencies` preservadas | ✔ |
| 5g | `tsconfig.json`/`.gitignore`/config já existentes (sem `deck.tsx`) | "mantido tsconfig.json", "mantido pptsx.config.ts"; o `.gitignore` é mesclado (`dist/` no fim). Mas um tsconfig sem `jsx` fica como está e sem aviso, e o build falha | ✖ bug 2 |
| 5h | `init slides` dentro de um projeto com pptsx instalado | Cria `slides/package.json` próprio. `cd slides && npx --no-install pptsx build deck.tsx` acha o bin do pai e passa | ✔ |
| 6 | Projeto `commonjs` sem `init` | Exit 1 nos três casos (com o tsconfig do init, sem tsconfig, sem `type`): `<deck>: O deck foi carregado como CommonJS, mas o pptsx usa top-level await e só roda como ESM: adicione "type": "module" ao package.json do projeto (\`pptsx init\` já cria assim).` Com `--json`: `{"error": "…"}` e exit 1 | ✔ |
| 6b | Projeto ESM **sem** `tsconfig.json` | Exit 1: `React is not defined` no build e no `--watch` | ✖ bug 1 |
| 7 | `npm test` / `npm run typecheck` / `npm run test:package` | 49 arquivos (1 pulado), **904 testes passando** (5 pulados), sem o aviso "Both esbuild and oxc". Typecheck com exit 0. `test:package`: 5/5 em 19 s | ✔ |

## Calibração: `lineBreaks` auto × forced (Keynote, 16x9)

O `forced` reproduz o M3: as **42 caixas** de texto (34 amostras, 7 títulos de seção/capa e a legenda) têm no Keynote o mesmo número de linhas do preview nativo, e cada linha começa e termina a ≤ 2,5 pt do nativo. Nenhuma caixa vaza.

No `auto`, os slides 3, 4 e 5 (C08–C20) saem **pixel a pixel idênticos** ao `forced`. As divergências ficam nos slides 1, 2, 6 e 7:

| Amostra | Tamanho · largura · estilo | Linhas forced → auto | O que muda no auto | Vaza? |
|---|---|---|---|---|
| Legenda (slide 1) | 14 pt · 600 · lh 1.2 | 9 → 9 | "8 pt **e,**" sobe para a linha 1. Na linha 5, o Keynote quebra **depois da barra** ("No Keynote/" ∣ "PowerPoint …"). "contorno." sobe para a linha 8 | Não (sobra 4 pt à direita) |
| C02 | 10 · 180 | 5 → 5 | "atividades **de**" ∣ "maior valor estratégico e" | Não |
| C05 | 10 · 600 · 3 parágrafos | 4 → 4 | "planejamento anual **da**" ∣ "companhia." | Não |
| C06 | 14 · 320 · lh 1.2 | 3 → 3 | "experiência do **consumidor**" ∣ "final." | Não |
| C07 | 12 · 330 · lh 1.5 · right | 2 → 2 | "acima da meta **em**" ∣ "todas as unidades…" | Não |
| C23 | 10 · 180 | **4 → 3** | "NPS 72 **—**" ∣ "meta 2026 ≥ 75. Ver nota nº 4, item (ii).": o travessão fica no fim da linha (no forced ele abria a linha 3) e "(ii)." deixa de ficar sozinha | Não; sobra 1 linha vazia (~11,5 pt) no fundo |
| C24 | 14 · 300 · I · lh 1.5 | 4 → 4 | "colaboração **em**" ∣ "todas as relações." | Não |
| C26 / C27 / C28 | 14 · 200 · left / center / right | 3 → 3 | "financeira **e**" ∣ "de operações." (igual nos três alinhamentos) | Não (a linha 2 chega a 0,75–3 pt da borda) |
| C33 | 8 · 160 · I | **7 → 6** | Todas as linhas rebalanceadas; cada uma ganha 1–2 palavras | Não; sobra 1 linha vazia (~9 pt) no fundo |
| As outras 24 (C01, C03, C04, C08–C22, C25, C29–C32, C34) | — | iguais | Mesmas quebras, pixel a pixel no Keynote | Não |

Leitura:
- **10/34 amostras** quebram em lugar diferente (29 %), mais a legenda. **2/34** mudam o número de linhas, sempre para **menos**. **0/34** vazam do frame, para baixo ou para o lado.
- A direção é sempre a mesma: o Keynote encaixa uma palavra a mais por linha. Isso é o `TEXT_SAFETY` (0,97). A engine quebra com 97 % da largura e o renderizador usa 100 %. No `auto`, o renderizador só pode ganhar linha se a métrica dele for > 3 % mais larga, e no Keynote isso não aconteceu nenhuma vez. O PowerPoint não foi conferido; essa validação é do dono.
- Efeito visível: o texto fica mais "cheio" à direita, e nas amostras que perdem uma linha sobra espaço vazio no fundo da caixa. Num texto centralizado na vertical por um contêiner, ele ficaria até meia linha acima do centro, porque o frame continua com a altura calculada.
- **O preview nativo não muda com `auto`**: os 7 PNGs do `calib-auto` são idênticos aos do `calib-forced`. No `auto`, o overview mostra as quebras da engine, não as do aplicativo, e nessas 10 amostras o preview difere do resultado final.

## Bugs

1. **Sem `tsconfig.json` no projeto, o build falha com `React is not defined`** (`bin/pptsx.mjs` e `src/cli/loader.ts`, tsconfig de fallback). Gravidade **média**: é o caminho de quem não usa o `init`, e o contrato promete o fallback (M7.md §Build e CONTRACTS §cli "M7 bin": sem tsconfig no cwd vale o `tsconfig.deck.json` do pacote).
   - Repro: `<S>/cjs`, ESM com pptsx instalado, só `deck.tsx` e sem tsconfig. `npx pptsx build deck.tsx` → `React is not defined`, exit 1. Com `--watch --json` → `{"error":"React is not defined"}`.
   - Causa (confirmada): o tsx só aplica um tsconfig aos arquivos que casam com o `include` dele. O `tsconfig.deck.json` não tem `include`, então vale o padrão `**/*` **relativo a `node_modules/pptsx/`**, e o deck do usuário fica fora. Prova: com `"include": ["<S>/cjs/**/*"]` acrescentado à cópia instalada do `tsconfig.deck.json`, o mesmo build sai com exit 0. Depois desfiz a mudança.
   - O `test:package` não pega isso, porque sempre roda o `init` antes, e o `init` cria o tsconfig.
   - Sugestões:
     - (a) gerar em tempo de execução um tsconfig temporário com `include` absoluto do diretório do deck (ou do cwd);
     - (b) ou `extends` do `tsconfig.deck.json` num arquivo gerado no cwd;
     - (c) de qualquer forma, traduzir `React is not defined` / `Cannot find package 'react'` para uma dica (ver bug 2).
   - Pragma `/** @jsxImportSource pptsx */` sozinho **não** resolve: o esbuild continua no modo clássico. Precisaria também de `/** @jsxRuntime automatic */`.
2. **O `init` mantém um `tsconfig.json` sem `jsx`/`jsxImportSource` e não avisa** (`src/cli/init.ts`/`scaffold.ts`). Gravidade **baixa-média**.
   - Repro: `<S>/initF` com `tsconfig.json` = `{ "compilerOptions": { "strict": false, "module": "NodeNext" } }` → `init` diz "mantido tsconfig.json" → `build` dá `React is not defined`. Com `"jsx": "react-jsx"` e sem `jsxImportSource` → `Cannot find package 'react' imported from …/deck.tsx`.
   - É o caso comum de pôr um deck num projeto TS existente.
   - Sugestões:
     - o `init` avisar (`▲ tsconfig.json existente não tem "jsxImportSource": "pptsx"; …`), ou mesclar só `jsx` e `jsxImportSource`;
     - a CLI trocar essas duas mensagens por uma que cite `jsx: react-jsx` + `jsxImportSource: pptsx`.
   - Observação: com um tsconfig que tem `paths` sem `baseUrl`, a mensagem crua do tsx (`Non-relative paths are not allowed when 'baseUrl' is not set…`) também sai sem dizer que veio do tsconfig.
3. **O `--watch` só observa depois do build inicial** (`src/cli.ts`, `watchBuild`: `await rebuild()` vem antes de `runWatchLoop`). Gravidade **baixa**.
   - Uma gravação feita depois de o deck ser importado e antes de o build inicial terminar não dispara rebuild. O preview fica velho até a próxima gravação.
   - Pela leitura do código o efeito é certo. Ele também apareceu na prática: em `watch-test2.sh`, a 1ª execução trocou `accent` logo ao fim do build inicial e não houve rebuild ("overview changed: no"). Com espera maior, funcionou.
   - Com a máquina carregada (load ~120 durante a validação), o build inicial do demo em 3 tamanhos levou 9–15 s, e a janela fica grande.
   - Sugestão: ligar o `watch` antes do build inicial, com o mesmo `pending`, ou comparar mtimes depois do build inicial.
4. (menor) `pptsx --help`, `-h` e `--version` saem com exit 1 e a mensagem crua do `parseArgs` em inglês (`Unknown option '--help'. To specify a positional argument…`). Só `pptsx` sem argumentos imprime o uso. Sugestão: `--help`/`-h` imprimem o uso com exit 0, e `--version` imprime a versão do `package.json`.

Conferido sem bug:
- O watch ignora `dist/` (sem realimentação: um build por mudança).
- Erro de sintaxe não derruba o watch.
- Mudanças durante um rebuild são enfileiradas.
- SIGINT encerra com 0.
- `init` em subpasta de um projeto com pptsx funciona.
- O aviso de CJS vai para o stderr no `--json`.

Divergência de contrato (sem impacto): o `M7.md` fala em observar "os `src` de imagens referenciados", mas o CONTRACTS.md (e a implementação) observam só o diretório do deck e a config. Imagens dentro da pasta do deck são cobertas pelo watch recursivo. Imagens fora dela não, e isso não testei.

## Observações (não são bugs do M7)

- `package.json` tem `"private": true`: o `npm publish` vai recusar. O nome `pptsx` está **livre** no registro (`npm view pptsx` → 404).
- `npm audit` no projeto instalado: 3 *high*, todos de `image-size` (DoS em parsers JXL/HEIF/ICNS) dentro de `pptxgenjs`, "No fix available". O pptsx só lê imagens do próprio autor do deck, então o risco é baixo, mas o aviso aparece para todo usuário no `npm install`.
- Tempo: com a máquina sob carga, `build` do demo com 3 tamanhos e preview levou 15 s de relógio e 2,5 s de CPU (com `--preview none`, 5,7 s / 1,5 s). Não é indicador confiável. Num momento menos carregado, o `deck.tsx` do init levou 2,6 s.

## Sugestões para o README / AGENT_GUIDE (não editei; o M7-F está escrevendo)

1. **Instalação** (README linha 8): `npm install pptsx` ainda não funciona (pacote privado, fora do registro). Até publicar, vale mostrar `npm install /caminho/pptsx-0.0.0.tgz` (gerado por `npm pack`), ou avisar que o comando vale depois da publicação.
2. **tsconfig**: dizer explicitamente que o projeto **precisa** de `jsx: "react-jsx"` e `jsxImportSource: "pptsx"`, e que `React is not defined` / `Cannot find package 'react'` significam tsconfig sem essas opções. Enquanto o bug 1 existir, não prometer o fallback sem tsconfig. Mesmo com ele corrigido, a dica ajuda quem já tem um tsconfig (bug 2).
3. **`init --force`**: a tabela já diz "sobrescreve os demais arquivos gerados". Vale deixar explícito que isso inclui `tsconfig.json` e `pptsx.config.ts` personalizados.
4. **`lineBreaks: 'auto'`** (Limitações): "pode divergir em uma linha" está correto, mas dá para ser mais preciso com os dados deste relatório:
   - no Keynote, ~30 % das amostras quebram em outra palavra;
   - o renderizador sempre encaixa **mais** por linha (a folga de 3 % do `textSafety`), então o texto não vaza;
   - pode sobrar uma linha vazia no fim da caixa;
   - **o preview PNG continua mostrando as quebras da engine**, não as do aplicativo.
5. **`--watch`**: avisar que a primeira gravação só conta depois da linha `observando …` (enquanto o bug 3 existir). Dizer também que a saída sem `--json` traz `[HH:MM:SS]` por build e que erros vão para o stderr.
6. **Saída do `init`**: o README pode reproduzir o aviso real de `commonjs` (`▲ package.json: "type" trocado de "commonjs" para "module" …`), porque `npm init -y` é o caminho mais comum.
7. AGENT_GUIDE §7 (deck fora do repo): incluir o passo `npx tsc --noEmit` (os tipos do pacote pegam prop errada, enum inválido e `colour` → "Did you mean 'color'?") e a mensagem real de CJS.

## Artefatos

Em `<S>` = `<scratchpad>/m7g/`:
- `pptsx-0.0.0.tgz`: o tarball validado. `repack/` é o 2º pack, já com README e LICENSE.
- `proj/`: projeto externo com `init`, `deck.tsx`, demo copiado e `dist/`. `proj/slides/` é o `init` em subpasta.
- `repo-demo/`: build do demo dentro do repo, para o md5.
- `keynote-init-16x9/`, `keynote-init-4x3/`, `keynote-demo-16x9/`: exports do Keynote.
- `calib-forced/`, `calib-auto/`: builds da calibração. `keynote-calib-*/` são os PNGs do Keynote a 720 px; `kpdf-*.pdf` e `kpdf-*/` são o PDF do Keynote rasterizado em 4×.
- `calib-lines.json`: linhas por caixa (nativo, Keynote forced e auto).
- `calib-auto-vs-forced.png`, `cmp-a.png`, `cmp-b.png`: as amostras divergentes, forced em cima e auto embaixo.
- `watch*.out`/`.err` e `watch-test*.sh`: os cenários de `--watch`. `watch-overview-red.png` é o overview regenerado com `accent` vermelho.
- `initA`–`initG`, `cjs/`: cenários de `init` e de CommonJS/sem tsconfig.
- `tools/`: `lines.py`, `montage.py`, `keynote-pdf.sh`, `pdf2png.swift`.

## Adendo do orquestrador (gate do M7)

Os quatro bugs acima foram corrigidos na mesma onda, com contrato em `CONTRACTS.md` §cli e testes (936 no total + 5 do pacote):
1. Deck sem `tsconfig.json` com `jsx`/`jsxImportSource=pptsx` → erro legível que manda rodar `pptsx init` (validação pura antes do import; `extends` é aceito).
2. `init` mescla `jsx`/`jsxImportSource` num tsconfig existente e avisa; valores conflitantes não são alterados.
3. `--watch` registra o observador antes do build inicial; mudanças durante um build entram na fila.
4. `--help`/`-h`/`--version` saem com 0.

Decisões do dono que ficam em aberto: `private: true` e `version 0.0.0` (publicar é decisão dele); `npm audit` acusa `image-size` via pptxgenjs, sem correção disponível. O resultado da calibração `auto` × `forced` foi registrado no README (Limitações). A versão com fontes embutidas e `nowrap` (M8) deve reduzir as divergências do modo `auto`.
