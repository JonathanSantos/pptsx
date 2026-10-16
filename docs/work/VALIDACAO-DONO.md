# Validação do dono — PowerPoint, Google Slides e o que não roda aqui

Tudo o que ficou para o dono desde o M3, num arquivo só. A máquina de trabalho só tem o Keynote, onde tudo foi conferido; o que segue depende de PowerPoint, Google Slides, GitHub ou Copilot. **O que o dono reportar vira a última correção antes do gate do M18** (pptsx 1.0.0).

## Como gerar os arquivos

```sh
scripts/validacao-dono.sh
```

Grava em `dist/validacao/<deck>/` o `.pptx` em 16x9 e 4x3, o overview PNG e um PNG por slide, que é a referência (o layout que o pptsx calculou). Abra o `.pptx` com o PNG do mesmo slide ao lado. Para cada item, anote ✅, ❌ (com print) ou "difere: …".

## 1. PowerPoint (desktop, Windows ou Mac; o web onde indicado)

### Texto e calibração (M3, M8, M11)
| # | arquivo · slide | o que olhar |
|---|---|---|
| 1.1 | `calibracao/calibration.16x9.pptx`, todos (com `--debug`, o contorno vermelho é a caixa calculada) | as palavras no fim de cada linha são as do PNG (quebra forçada: deve bater 34/34); a última linha fica dentro do contorno |
| 1.2 | `calibracao`, slide 7 (C29–C31) e C07/C12 | **regra 0,8 × espaçamento:** com `lineHeight` 1.5, a 1ª linha cai ~2 pt abaixo do topo esperado, como no Keynote? Se cair, o M11-G (subir a caixa) entra antes da 1.0; se não, só fica documentado |
| 1.3 | `calibracao`, C06 (`lineHeight` 1.2 em 14 pt) | o PowerPoint usa 16,8 pt exato (o Keynote trunca para 16)? Veja em Parágrafo → Espaçamento → Exatamente |
| 1.4 | `calibracao`, C11, C12 e C31 | a 1ª linha começa no topo do contorno |
| 1.5 | `pesos/pesos.16x9.pptx` (gerado com `--embed-fonts`), no **PowerPoint web** e no desktop | abre sem "fontes embutidas não podem ser instaladas"; Light/SemiBold aparecem como Inter, e não substituídos |

### Gráficos e tabelas (M10, M14)
| # | arquivo · slide | o que olhar |
|---|---|---|
| 1.6 | `demo` e `charts` (16x9 e 4x3) | os gráficos são **gráficos** ("Editar dados" abre a planilha), não imagens; sem "PowerPoint encontrou um problema no conteúdo" |
| 1.7 | `charts.4x3.pptx`, slides 1–3 | bar/line/pie nessa ordem; "Editar dados" de cada um abre a planilha **dele** |
| 1.8 | `demo`, gráfico | com o Office em pt-BR, os rótulos mostram "38,2 … 52,4" e o eixo "60,0"; em inglês, com ponto |
| 1.9 | `graficos`, o combo com eixo secundário e os formatos de eixo | a 2ª série no eixo da direita; formatos (%, R$) e mín/máx como no PNG |
| 1.10 | `demo`, slide 5, e `tabelas` | a altura das linhas é a do PNG (Layout da Tabela → Altura); nenhuma linha cresce; sem estilo de tema (a zebra vem das células); nenhuma célula requebra (o PowerPoint respeita a margem de 4 pt) |
| 1.11 | `tabelas`, as células mescladas | os merges aparecem como no PNG e "Mesclar/Dividir células" funciona |

### Formas, diagramas e pintura (M11, M12)
| # | arquivo · slide | o que olhar |
|---|---|---|
| 1.12 | `formas`, `fluxo`, `icones` | as formas custom, as setas, os conectores e os ícones (custGeom) iguais ao PNG; as pontas e as junções de linha |
| 1.13 | `showcase`, slide 2 e capa | sombra suave nos cartões; caixa girada de 18° e translúcida na capa |
| 1.14 | `showcase`, slide 4 | borda azul só em cima, tracejada embaixo, pontilhada por dentro; a caixa cinza girada de −8° por cima das outras |
| 1.15 | `demo` 16x9, títulos | a barra do título (`borderLeft` de 6 pt) colada à esquerda do texto, dentro da caixa |
| 1.16 | `layout-test`, slide 2 | a borda de 1 px fica por dentro da caixa; a elipse fica atrás das imagens (`zIndex`) |

### Texto rico, links e numeração (M13)
| # | arquivo · slide | o que olhar |
|---|---|---|
| 1.17 | `relatorio` | os links externos abrem o navegador; os internos (`slide:N`) vão para o slide certo, no modo de apresentação |
| 1.18 | `relatorio` | reordene dois slides: o número de slide (`SlideNumber`) atualiza sozinho |

### O arquivo para editar (M15)
| # | arquivo · slide | o que olhar |
|---|---|---|
| 1.19 | `arquivo` | Design → Variantes → Cores mostra a paleta do tema; mudar o tema repinta só as cores que vêm dele |
| 1.20 | `arquivo` | as seções aparecem no painel de slides |
| 1.21 | `arquivo` | "Novo slide" oferece os layouts "Capa" e "Conteúdo"; "Redefinir slide" volta ao layout |
| 1.22 | `arquivo` | as notas do apresentador com a formatação (negrito, parágrafos); o slide oculto é pulado na apresentação |

### Catálogo (M18-3)
| # | arquivo | o que olhar |
|---|---|---|
| 1.23 | `catalogo/<Componente>.16x9.pptx` | um slide por caso, com o rótulo `Componente · caso`; igual ao `catalogo/<Componente>.overview.png` |

## 2. Google Slides (importar o `.pptx` pelo Drive)

| # | arquivo | o que olhar |
|---|---|---|
| 2.1 | `demo`, `charts`, `showcase`, `arquivo` | **abre** sem erro; anote o que degrada (o esperado: entrelinha vira múltiplo, ±1 pt por linha; as quebras de linha batem por serem forçadas; sombra e rotação podem sumir) |
| 2.2 | `demo`, `charts` | os gráficos viram gráficos ou imagens? |
| 2.3 | `pesos` | qual fonte aparece (o esperado: substituição, embed ignorado) |
| 2.4 | `relatorio` | os links funcionam |

## 3. Fora do Office

| # | o quê | como conferir |
|---|---|---|
| 3.1 | **CI em matriz** (macOS, Ubuntu, Windows × Node 20/22) | o workflow `CI` roda uma vez por commit, no push da `main` e em cada PR (tags não disparam o CI): typecheck, lint, testes, `test:package`, `publish:check`, a paridade do bundle e `npm audit` nas 6 combinações, e depois a galeria |
| 3.2 | **Publicação** | `repository`/`homepage`/`bugs` apontam para `github.com/JonathanSantos/pptsx`. Fluxo: commit com a versão nova em `packages/pptsx/package.json` → push da `main` → tag `v<versão>` → push da tag. O workflow `Release` não roda a suíte de novo: o job `gate` exige o `CI` verde no mesmo commit (espera o run, se ainda roda; sem run, falha antes de publicar qualquer coisa). Depois cria a release com `pptsx.mjs`, `SHA256SUMS`, `pptsx-skill.zip` e `ds-base-skill.zip` e, com o segredo `NPM_TOKEN`, publica os três no npm (escopo `@pptsx` = organização `pptsx` no npmjs.com) |
| 3.3 | **Skill no Copilot (VS Code, agent mode)** | `node packages/pptsx/bin/pptsx.mjs skill --out /tmp/skill`, copiar `.github/skills/pptsx/` e `.vscode/mcp.json` para um repositório vazio, abrir no VS Code e pedir "um deck de 4 slides (grid, tabela, gráfico, lista longa com paginate) sobre resultados do trimestre". Critério: ≤ 2 builds, `.pptx` entregue, sem outra documentação. O mesmo teste no Claude Code passou em 1 build ([M18-skill](reports/M18-skill.md)) |
| 3.4 | **Download da skill** | depois da release: apagar `~/.cache/pptsx/1.0.0/` e rodar `node .claude/skills/pptsx/scripts/pptsx.mjs doctor`; ele deve baixar o `pptsx.mjs`, conferir o SHA256 e rodar |
