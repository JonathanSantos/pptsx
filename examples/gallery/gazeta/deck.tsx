import { Box, Chart, Deck, Slide, Table, Text, defineDeck } from 'pptsx';
import { Columns, DoubleRule, DropCap, Kicker, PullQuote } from './components.tsx';
import { tokens } from './tokens.ts';

const { color, font, space } = tokens;

const page = { backgroundColor: color.paper, color: color.ink, fontFamily: 'Georgia' } as const;

const Folio = ({ left, right }: { left: string; right: string }) => (
  <Box display="flex" justifyContent="space-between" paddingTop={6} borderTop={`0.75px solid ${color.ink}`} marginTop="auto">
    <Kicker tone="gray">{left}</Kicker>
    <Kicker tone="gray">{right}</Kicker>
  </Box>
);

export default defineDeck(() => (
  <Deck>
    {/* 1 · Primeira página: cabeçalho com fio duplo, manchete e três colunas com fio entre elas. */}
    <Slide {...page} padding={`22 ${space.page} 20`} gap={8}>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Kicker tone="gray">Edição nº 412</Kicker>
        <Kicker tone="gray">Recife, quinta-feira, 15 de outubro de 2026</Kicker>
        <Kicker tone="gray">R$ 4,50</Kicker>
      </Box>
      <Text fontSize={font.mast} fontWeight="bold" textAlign="center" letterSpacing={-1.2} lineHeight={1}>A Gazeta dos Dados</Text>
      <DoubleRule />
      <Box display="flex" gap={space.col} marginTop={4} flex={1}>
        <Box flex={2.1} gap={7}>
          <Kicker>Economia solidária</Kicker>
          <Text fontSize={font.head} fontWeight="bold" lineHeight={1.02} letterSpacing={-0.6}>Cooperativas do Agreste dobram a renda em três safras</Text>
          <Text fontSize={font.deck} fontStyle="italic" color={color.gray} lineHeight={1.25}>
            Levantamento inédito com 4.800 famílias mostra que crédito próprio e venda direta valem mais que a chuva.
          </Text>
          <Columns
            texts={[
              'Em 2023, a renda média de uma família associada era de 1,1 salário mínimo. Três safras depois, chegou a 2,3. O salto não veio de uma colheita excepcional: o inverno de 2025 foi o mais seco da década.',
              'O que mudou foi a quem se vende. As cooperativas passaram a entregar direto para escolas e restaurantes, e o atravessador, que ficava com até 40% do preço, saiu da conta.',
            ]}
          />
        </Box>
        <Box flex={1} gap={8} paddingLeft={space.col / 2} borderLeft={`0.75px solid ${color.rule}`}>
          <Kicker tone="ink">Nesta edição</Kicker>
          {[
            ['Clima', 'O mapa da estiagem, município por município', '4'],
            ['Crédito', 'Fundos rotativos emprestam a 0,5% ao mês', '7'],
            ['Perfil', 'Dona Lia, 71, e a fábrica de doces de Gravatá', '11'],
            ['Opinião', 'O banco que a gente nunca teve', '14'],
          ].map(([tag, title, pageNo]) => (
            <Box gap={2} paddingBottom={7} borderBottom={`0.75px solid ${color.rule}`}>
              <Kicker>{tag}</Kicker>
              <Box display="flex" gap={8} alignItems="flex-start">
                <Text flex={1} fontSize={11.5} fontWeight="bold" lineHeight={1.2}>{title}</Text>
                <Text fontSize={11.5} color={color.gray}>{pageNo}</Text>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    </Slide>

    {/* 2 · Número grande: 73% em vermelho, capitular e citação entre fios. */}
    <Slide {...page} padding={`30 ${space.page} 20`} gap={10}>
      <Box display="flex" gap={28} flex={1}>
        <Box width={250} gap={10} justifyContent="center">
          <Kicker>A virada</Kicker>
          <Text fontSize={118} fontWeight="bold" color={color.red} letterSpacing={-6} lineHeight={1.08}>73%</Text>
          <Text fontSize={16} fontStyle="italic" lineHeight={1.3}>das famílias associadas passaram de dois salários mínimos de renda.</Text>
        </Box>
        <Box flex={1} gap={12} paddingLeft={24} borderLeft={`0.75px solid ${color.rule}`}>
          <Text fontSize={22} fontWeight="bold" lineHeight={1.1} letterSpacing={-0.4}>Quando a venda é direta, a seca pesa menos</Text>
          <DropCap text="Os municípios que mais cresceram não foram os que mais choveram. Foram os que tinham uma cooperativa com contrato fechado antes do plantio: a família sabia por quanto ia vender e plantava o que já tinha comprador." />
          <PullQuote quote="“A cooperativa virou o banco que a gente nunca teve.”" by="Severina Alves, 54, presidente da Coopagreste" />
          <Box display="flex" marginTop="auto">
            {[
              ['4.800', 'famílias ouvidas'],
              ['38', 'cooperativas'],
              ['R$\u00A061\u00A0mi', 'em venda direta'],
            ].map(([n, label], i) => (
              <Box flex={1} gap={3} paddingLeft={i === 0 ? 0 : 14} borderLeft={i === 0 ? undefined : `0.75px solid ${color.rule}`}>
                <Text fontSize={26} fontWeight="bold" letterSpacing={-0.8}>{n}</Text>
                <Kicker tone="gray">{label}</Kicker>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
      <Folio left="A Gazeta dos Dados · Economia" right="Página 3" />
    </Slide>

    {/* 3 · Dados: gráfico de linha em tinta e vermelho e uma tabela nativa com fios de jornal. */}
    <Slide {...page} padding={`26 ${space.page} 20`} gap={10}>
      <Kicker>Os números</Kicker>
      <Text fontSize={24} fontWeight="bold" letterSpacing={-0.4}>Renda média por família, em salários mínimos</Text>
      <Box display="grid" flex={1} gridTemplateColumns="minmax(0, 1.2fr) minmax(0, 1fr)" gridTemplateRows="minmax(0, 1fr)" gap={22}>
        <Chart
          kind="line" font="Georgia" size={9} color={color.gray} markers
          colors={[color.red, color.ink]}
          data={{ categories: ['2023', '2024', '2025', '2026'], series: [{ name: 'Associadas', values: [1.1, 1.5, 1.9, 2.3] }, { name: 'Não associadas', values: [1.0, 1.0, 0.9, 1.1] }] }}
        />
        <Table
          fontSize={11} cellPadding={8} border={color.rule} stripe={color.tint}
          header={{ fill: color.ink, color: color.paper }}
          columns={[{ header: 'Região', width: '44%' }, { header: '2023', align: 'right' }, { header: '2026', align: 'right' }, { header: 'Δ', align: 'right' }]}
          rows={[
            ['Agreste central', '1,0', '2,4', '+140%'],
            ['Sertão do Pajeú', '1,2', '2,1', '+75%'],
            ['Mata Sul', '1,3', '2,0', '+54%'],
            ['Agreste meridional', '0,9', '2,6', '+189%'],
            ['São Francisco', '1,1', '2,2', '+100%'],
          ]}
        />
      </Box>
      <Folio left="Fonte: Censo das Cooperativas de Pernambuco, 2026" right="Página 5" />
    </Slide>

    {/* 4 · Opinião: página invertida, aspas gigantes em vermelho atrás do texto. */}
    <Slide backgroundColor={color.ink} color={color.paper} fontFamily="Georgia" padding={`34 ${space.page * 1.6} 24`} gap={14} justifyContent="center">
      <Text position="absolute" zIndex={-1} left={40} top={-28} fontSize={230} fontWeight="bold" color={color.red} lineHeight={1}>“</Text>
      <Kicker tone="paper">Opinião</Kicker>
      <Text fontSize={28} fontStyle="italic" lineHeight={1.25} letterSpacing={-0.3}>
        Não faltou chuva ao Agreste. Faltava alguém que comprasse antes de colher. As cooperativas resolveram isso sem esperar ninguém.
      </Text>
      <Box display="flex" gap={10} alignItems="center">
        <Box width={28} height={0} borderTop={`1.5px solid ${color.red}`} />
        <Kicker tone="paper">Marta Cavalcanti, editora de Economia</Kicker>
      </Box>
    </Slide>
  </Deck>
));
