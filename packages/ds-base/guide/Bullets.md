`<Bullets items={[…]} size? gap? paginate? />` — lista com marcador; os itens encolhem juntos até 14 pt. `items` aceita rich text (`['Receita subiu ', <B>14%</B>]`). `size` (padrão 20) e `gap` (padrão 0,7 × size) aceitam valores responsivos. `paginate` continua a lista no slide seguinte em vez de encolher.

Armadilha: com 6+ itens longos num 16:9, prefira `paginate` a baixar o `size`.
