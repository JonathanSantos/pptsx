import { B, Box, Chart, Deck, I, Image, Shape, Slide, SlideNumber, Span, Text, defineDeck, defineLayout } from 'pptsx';
import type { Children } from 'pptsx';
import { tokens } from '@pptsx/ds-base';

// M15: um deck pensado para quem vai editar no PowerPoint — tema dos tokens (pptsx.config.ts desta
// pasta), layouts com placeholders e conteúdo fixo no master, seções, slide oculto, notas formatadas.
// Build: cd examples/arquivo && npx tsx ../../src/cli.ts build arquivo.tsx --size 16x9,4x3 --out ../../dist/arquivo

const { color, font, space } = tokens;

/** Faixa e assinatura que ficam no master: o usuário não arrasta sem querer. */
const BRAND = (
  <>
    <Box position="absolute" left={0} top={0} bottom={0} width={8} backgroundColor={color.accent} />
    <Text position="absolute" left={space.page} bottom={14} fontSize={font.caption} color={color.muted}>Exemplos pptsx · Relatório do 3º trimestre</Text>
  </>
);

const Capa = defineLayout('Capa', { placeholders: ['title', 'subtitle'] }, ({ title, subtitle }: { title: string; subtitle: string }) => (
  <Slide backgroundColor={color.brand} color={color.white} padding={`${space.page * 1.25} ${space.page * 1.5} ${space.page * 1.5}`}>
    <Shape kind="rect" width={56} height={6} backgroundColor={color.accent} marginTop="auto" marginBottom={space.gap} />
    <Text placeholder="title" fontSize={font.display} fontWeight="bold" minSize={32}>{title}</Text>
    <Text placeholder="subtitle" fontSize={font.body} color={color.accentSoft} marginTop={space.tight}>{subtitle}</Text>
  </Slide>
));

interface ConteudoProps {
  readonly title: string;
  readonly notes?: Children;
  readonly hidden?: boolean;
  readonly children?: Children;
}

const Conteudo = defineLayout('Conteúdo', { placeholders: ['title', 'body'], fixed: BRAND },
  ({ title, notes, hidden, children }: ConteudoProps) => (
    <Slide backgroundColor={color.white} color={color.ink} padding={`${space.page} ${space.page} ${space.page + 16}`} gap={space.gap} notes={notes} hidden={hidden}>
      <Text placeholder="title" fontSize={font.h1} fontWeight="bold">{title}</Text>
      <Box placeholder="body" flex={1} gap={space.tight}>{children}</Box>
    </Slide>
  ),
);

const Bullet = ({ children }: { readonly children?: Children }) => (
  <Box display="flex" gap={12} alignItems="baseline">
    <Shape kind="ellipse" width={8} height={8} backgroundColor={color.accent} flexShrink={0} />
    <Text fontSize={font.body}>{children}</Text>
  </Box>
);

export default defineDeck(() => (
  <Deck
    sections={[{ title: 'Abertura', from: 1 }, { title: 'Resultados', from: 2 }, { title: 'Anexos', from: 4 }]}
    footer={<SlideNumber format="n / total" position="absolute" right={space.page} bottom={14} fontSize={font.caption} color={color.muted} />}
  >
    <Capa title="Relatório do 3º trimestre" subtitle="Receita, custo e o que vem no 4º trimestre" />
    <Conteudo
      title="Destaques do trimestre"
      notes={<>Comece pelo <B>crescimento de 14 %</B>: é o número que a diretoria quer ouvir.{'\n'}Depois cite o cache, <I>sem entrar em detalhe técnico</I>. Relatório completo: <Span href="https://example.com/q3" color={color.accent}>example.com/q3</Span>.</>}
    >
      <Bullet>Receita recorrente cresceu <B>14 %</B> sobre o 2º trimestre.</Bullet>
      <Bullet>Custo por consulta caiu 22 % com o novo cache.</Bullet>
      <Bullet>Três novas áreas passaram a usar o catálogo de dados.</Bullet>
    </Conteudo>
    <Conteudo title="Receita contra a meta" notes="Os dados do gráfico abrem na planilha embutida (clique duas vezes no gráfico).">
      <Chart kind="bar" flex={1} legend={{ position: 'top' }} yAxis={{ title: 'R$ mi' }} colors={[color.accent, color.muted]}
        data={{ categories: ['T4 2025', 'T1 2026', 'T2 2026', 'T3 2026'], series: [
          { name: 'Realizado', values: [38.2, 41.5, 45.9, 52.4] }, { name: 'Meta', values: [40, 42, 45, 50] }] }} />
    </Conteudo>
    <Conteudo title="Reserva: metodologia" hidden notes="Slide oculto: só mostre se perguntarem como a receita foi calculada.">
      <Bullet>Receita recorrente = contratos ativos no último dia do mês.</Bullet>
      <Bullet>Meta revisada em julho (comitê de 12/07).</Bullet>
      <Image src="../assets/chart.png" height={120} objectFit="contain" />
    </Conteudo>
  </Deck>
));
