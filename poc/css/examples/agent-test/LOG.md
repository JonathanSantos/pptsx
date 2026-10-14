# LOG — teste de usabilidade do guia (poc/css/README.md)

## Build 1

**O que escrevi antes:** o slide completo de uma vez, a partir do exemplo do guia.
- `import … from '../../index.ts'` (o guia mostra `'../index.ts'` com o comentário "de poc/css/examples/"; como meu arquivo está em `examples/agent-test/`, subi um nível a mais).
- `<Slide padding={32} fontFamily="Arial" color=…>` com título `<Text fontSize={28} fontWeight="bold" marginBottom={16}>`.
- Grade: `<Box display="grid" gridTemplateColumns="repeat(3, 1fr)" gap={12}>` com 6 cartões `<Box padding={10} backgroundColor="#F4F6FA" borderTop="3px solid <cor>">` contendo três `<Text>` (nome, responsável, status).
- Tags: `<Box display="flex" flexWrap="wrap" gap={8} marginTop={18}>` com 10 `<Text padding="4 12" backgroundColor borderRadius={10}>` (o guia diz que "Caixa" vale em Text).
- Rodapé: `<Text marginTop="auto" fontSize={10}>Fonte: …</Text>`.
- Margens além do rodapé: `marginBottom` no título, `marginTop` nas tags e em linhas dos cartões.

**Saída:** `Nenhum diagnóstico.` (render em 123 ms), exit 0.

**PNG:** título no topo; grade 3×2 com cartões de fundo cinza-claro, padding e faixa colorida só no topo (cores por status); linha de 10 pílulas arredondadas que quebrou em 2 linhas (6 + 4); rodapé encostado no fim do slide, respeitando o padding. Layout exatamente como pedido.

## Total

**1 build** até o slide correto.

## Atritos com o guia

1. **Caminho do import.** O exemplo traz `from '../index.ts'; // de poc/css/examples/`. Funciona, mas só se o arquivo estiver diretamente em `examples/`; para uma subpasta é preciso deduzir `'../../index.ts'`. Seria mais claro dizer "caminho relativo até `poc/css/index.ts`".
2. **Pílulas como `Text` ou como `Box`?** O guia diz que as props de caixa "Valem em Box, Text, Image, Table", mas não deixa explícito se `backgroundColor`/`borderRadius` (tabela "Pintura") também valem em `Text`. Funcionou, mas foi aposta. Também não diz se `Text` dentro de um flex row encolhe para o conteúdo (largura intrínseca) — funcionou como no CSS.
3. **Pequenas lacunas:** `borderRadius` aceita só número? (só existe a dica "raio por canto" não sai); `defineDeck((ctx) => …)` — não fica claro se `ctx` é obrigatório; `key` em listas `.map` não é mencionado (não usei e não houve aviso). O guia não diz onde ficam os PNGs com nome exato antes de rodar (diz `<deck>.<size>/slide-NN.png`, o que bastou). Também não explica a saída `overview.png` que aparece no build.
