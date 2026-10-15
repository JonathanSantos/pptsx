# M18-8 — skill: o agente virgem

## Claude Code (subagente sem contexto, 2026-10-15)

Montagem: uma pasta vazia com só `.claude/skills/pptsx/`, gerada por `pptsx skill` (SKILL.md, references/guide.md, references/props.md, scripts/pptsx.mjs), e o bundle `pptsx.mjs` 0.7.0 no cache documentado (`~/.cache/pptsx/0.7.0/`), como depois do primeiro download. Regras dadas ao agente: ler só a skill; o único comando de shell é o script; criar os arquivos com a ferramenta de escrita.

Tarefa: 4 slides sobre "Resultados do 3º trimestre": um grid de 3 KPIs, uma tabela de 4 linhas, um gráfico de barras Q2 × Q3 e uma lista de 14 próximos passos com paginate, em 16x9.

**Resultado: 1 build, 0 error, 0 warning.**
- O único diagnóstico foi o info `slide-continued`: a lista virou 2 slides (9 + 5 itens).
- O agente conferiu o overview PNG e entregou `dist/deck.16x9.pptx`, com 5 slides.

Log do agente:
1. **Desvio confessado:** usou `ls`/`cat` no shell para ler a skill. Leu só arquivos da skill, mas fora do protocolo; daí em diante, só a ferramenta Read.
2. Leu `references/guide.md`, linhas 1–625. O Read corta em cerca de 25 mil tokens, e o guia tem cerca de 41 mil.
3. Escreveu `apresentacao/deck.tsx`, só com primitivas.
4. Rodou `node .claude/skills/pptsx/scripts/pptsx.mjs build apresentacao/deck.tsx --size 16x9`.
5. Abriu o overview PNG.

Lacunas relatadas e o que foi aplicado no gerador:
- **O guia fala com quem trabalha no repo** (`packages/…`, `@pptsx/ds-base`, MCP), e as receitas usam `ContentLayout`, `Bullets` e `tokens`. → `references/guide.md` ganhou um aviso no topo: esses nomes não existem no projeto, a menos que a skill traga um DS, e nas receitas valem as primitivas.
- **O guia é longo demais para um Read:** a §8 (diagnósticos) e a §9 (armadilhas) ficaram de fora. → Entrou um índice no topo com a linha de cada seção, para ler só a que importa, e o SKILL.md aponta o índice e as §8/§9. Teste: cada linha do índice cai no título certo.
- **Não estava claro se escrever o deck direto dispensa o tsconfig e a config.** → O SKILL.md agora diz que o script compila sem eles, e quando a config é necessária.
- A receita 6.19 ("tabela longa") existe, mas estava fora da parte lida. Isso foi coberto pelo índice.

## GitHub Copilot no VS Code (agent mode)

**Pendente do dono:** não há VS Code com Copilot nesta máquina de trabalho. Como conferir: copie `.github/skills/pptsx/` e `.vscode/mcp.json` (de `pptsx skill --out`) para um repositório vazio, abra no VS Code com o Copilot em agent mode e dê a mesma tarefa acima, sem outra documentação. O critério é o mesmo: ≤ 2 builds e o `.pptx` entregue. Está listado em `docs/work/VALIDACAO-DONO.md` (M18-9).
