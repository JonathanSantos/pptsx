`<KpiCard label value delta? trend? sentiment? size? inlineDelta? />` — indicador: rótulo, valor grande e variação. `trend` ('up' | 'down') dá a seta; `sentiment` ('positive' | 'negative' | 'neutral') dá a cor (padrão: up = positivo). `size` 'sm' | 'md' | 'lg' (variantes; aceita `{ base: 'md', tall: 'lg' }`). `inlineDelta` põe a variação na linha do valor.

Armadilha: valor longo ("R$ 52.400.000,00") quebra; abrevie e ponha a unidade no rótulo ("Receita (R$ mi)", "52,4").
