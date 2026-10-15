// Gerado por tools/schema.ts (npm run schema). Não edite à mão.
export const PROPS_SCHEMA: Readonly<Record<string, unknown>> = {
  "Bullets": {
    "type": "object",
    "properties": {
      "items": {
        "type": "readonly TextChildren[]",
        "description": "Um item por marcador: string ou rich text (`['Receita subiu ', <B>14%</B>]`)."
      },
      "size": {
        "type": "Responsive<number>",
        "description": "fontSize dos itens em pt; padrão tokens.font.body. Aceita `{ base: 20, wide: 24 }`."
      },
      "gap": {
        "type": "Responsive<number>",
        "description": "pt entre itens; padrão 0.7 × size. Aumente para ocupar slides mais altos (`{ base: 14, tall: 25 }`)."
      },
      "paginate": {
        "type": "boolean",
        "description": "Itens que não cabem continuam num slide clonado (Box paginate) em vez de encolher. Padrão false. Só um por slide; o resto do slide se repete em cada parte."
      }
    },
    "required": [
      "items"
    ]
  },
  "TwoColumn": {
    "type": "object",
    "properties": {
      "stacked": {
        "type": "Responsive<boolean>",
        "description": "true empilha (left em cima, right embaixo); padrão false (lado a lado). Responsivo: `stacked={{ base: false, tall: true }}` empilha em 4:3."
      },
      "ratio": {
        "type": "number",
        "description": "Fração da largura da coluna esquerda lado a lado; padrão 0.5. Empilhado, a de cima fica com a altura do conteúdo."
      },
      "left": {
        "type": "string | number | boolean | SlideElement | readonly Child[]"
      },
      "right": {
        "type": "string | number | boolean | SlideElement | readonly Child[]"
      }
    },
    "required": []
  },
  "KpiCard": {
    "type": "object",
    "properties": {
      "label": {
        "type": "string"
      },
      "value": {
        "type": "string"
      },
      "delta": {
        "type": "string"
      },
      "trend": {
        "type": "KpiTrend",
        "description": "Direção da variação: só define a seta (▲/▼)."
      },
      "sentiment": {
        "type": "KpiSentiment",
        "description": "Se a variação é boa ou ruim: define a cor. Padrão: up → positive, down → negative, sem trend → neutral."
      },
      "size": {
        "type": "Responsive<KpiSize>",
        "description": "Escala do cartão; padrão 'md'. Use 'sm' para 4+ cartões ou valores longos, 'lg' com largura/altura sobrando. Aceita `{ base: 'md', tall: 'lg' }`."
      },
      "inlineDelta": {
        "type": "boolean",
        "description": "Variação na mesma linha do valor, alinhada pela baseline (\"52,4 ▲ +14,2%\"). Padrão false (variação embaixo). Use com variações curtas: a linha precisa caber valor + variação."
      }
    },
    "required": [
      "label",
      "value"
    ]
  },
  "KpiRow": {
    "type": "object",
    "properties": {
      "items": {
        "type": "readonly KpiCardProps[]"
      },
      "size": {
        "type": "Responsive<KpiSize>",
        "description": "Tamanho de todos os cartões (o size de um item vence); padrão 'md'. Aceita `{ base: 'md', wide: 'lg' }`."
      }
    },
    "required": [
      "items"
    ]
  },
  "CoverLayout": {
    "type": "object",
    "properties": {
      "title": {
        "type": "string"
      },
      "subtitle": {
        "type": "string"
      },
      "caption": {
        "type": "string",
        "description": "Linha pequena no topo (área, data, evento)."
      },
      "ctx": {
        "type": "DeckContext",
        "description": "Contexto do deck: mantém a elipse circular e proporcional em qualquer tamanho."
      }
    },
    "required": [
      "title"
    ]
  },
  "ContentLayout": {
    "type": "object",
    "properties": {
      "title": {
        "type": "string"
      },
      "justify": {
        "type": "\"start\" | \"center\"",
        "description": "Posição vertical do conteúdo no corpo; padrão 'start' (logo abaixo do título)."
      },
      "notes": {
        "type": "string | number | boolean | SlideElement | readonly TextChildren[]",
        "description": "Notas do apresentador (texto ou rich text); numa paginação vão para todas as partes."
      },
      "hidden": {
        "type": "boolean",
        "description": "M15: slide oculto (reserva)."
      },
      "children": {
        "type": "string | number | boolean | SlideElement | readonly Child[]"
      }
    },
    "required": [
      "title"
    ]
  },
  "ClosingLayout": {
    "type": "object",
    "properties": {
      "title": {
        "type": "string"
      },
      "subtitle": {
        "type": "string"
      },
      "contact": {
        "type": "string"
      },
      "ctx": {
        "type": "DeckContext",
        "description": "Contexto do deck: mantém a elipse circular e proporcional em qualquer tamanho."
      }
    },
    "required": [
      "title"
    ]
  }
};
