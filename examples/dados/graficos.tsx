import { Box, Chart, Deck, Slide, Text, defineDeck } from 'pptsx';
import type { ChartProps } from 'pptsx';

// M14-2: os gráficos nativos novos, um por slide, com eixos, legenda e rótulos configurados.
// Tudo editável no PowerPoint/Keynote (os dados vão no xlsx embutido do gráfico).

const QUARTERS = ['T1', 'T2', 'T3', 'T4'];
const REGIONS = ['Sul', 'Sudeste', 'Centro-Oeste', 'Nordeste', 'Norte'];

const ChartSlide = ({ title, note, children }: { title: string; note: string; children: unknown }) => (
  <Slide padding="24 32" gap={8} backgroundColor="#FFFFFF" color="#1B2A4A">
    <Text fontSize={22} fontWeight="bold">{title}</Text>
    <Text fontSize={12} color="#5B6680">{note}</Text>
    <Box display="flex" gap={20} flex={1}>{children as never}</Box>
  </Slide>
);

const chart = (props: Omit<ChartProps, 'flex'>) => <Chart flex={1} {...(props as ChartProps)} />;

export default defineDeck(() => (
  <Deck>
    <ChartSlide title="Barra horizontal" note="kind barH: ranking com rótulos fora da barra e eixo de valores oculto">
      {chart({ kind: 'barH', data: { categories: REGIONS, series: [{ name: 'Receita (R$ mi)', values: [42.1, 88.4, 31.7, 27.9, 12.3] }] },
        labels: { position: 'outside' }, yAxis: { hidden: true, grid: false }, legend: false })}
    </ChartSlide>
    <ChartSlide title="Barras empilhadas" note="kind stackedBar: composição por trimestre, legenda no topo, título no eixo">
      {chart({ kind: 'stackedBar', data: { categories: QUARTERS, series: [
        { name: 'Varejo', values: [18, 20, 22, 26] }, { name: 'Atacado', values: [12, 13, 15, 14] }, { name: 'Online', values: [6, 8, 9, 12] }] },
        legend: { position: 'top' }, yAxis: { title: 'R$ mi', step: 10 }, labels: { position: 'center' } })}
    </ChartSlide>
    <ChartSlide title="Empilhada horizontal" note="kind stackedBarH: tempo por etapa em cada projeto">
      {chart({ kind: 'stackedBarH', data: { categories: ['Projeto A', 'Projeto B', 'Projeto C'], series: [
        { name: 'Desenho', values: [3, 5, 2] }, { name: 'Construção', values: [8, 6, 9] }, { name: 'Testes', values: [2, 3, 4] }] },
        yAxis: { title: 'semanas' }, legend: { position: 'right' } })}
    </ChartSlide>
    <ChartSlide title="Empilhada 100 %" note="kind stackedBar100: participação de cada canal; eixo em %">
      {chart({ kind: 'stackedBar100', data: { categories: QUARTERS, series: [
        { name: 'Varejo', values: [18, 20, 22, 26] }, { name: 'Atacado', values: [12, 13, 15, 14] }, { name: 'Online', values: [6, 8, 9, 12] }] },
        legend: { position: 'bottom' } })}
    </ChartSlide>
    <ChartSlide title="Área e área empilhada" note="kinds area e stackedArea: o mesmo dado, sobreposto e somado">
      {chart({ kind: 'area', title: 'area', data: { categories: QUARTERS, series: [{ name: 'Planejado', values: [20, 28, 35, 40] }, { name: 'Realizado', values: [18, 25, 37, 44] }] } })}
      {chart({ kind: 'stackedArea', title: 'stackedArea', data: { categories: QUARTERS, series: [{ name: 'Sul', values: [10, 12, 14, 15] }, { name: 'Sudeste', values: [20, 22, 25, 29] }] } })}
    </ChartSlide>
    <ChartSlide title="Linha suavizada com marcadores" note="kind line: smooth, markers, eixo de 0 a 100 com formato e grade">
      {chart({ kind: 'line', smooth: true, markers: true, data: { categories: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'], series: [
        { name: 'NPS', values: [52, 58, 61, 57, 66, 72] }, { name: 'Meta', values: [60, 60, 60, 65, 65, 65], color: '#94A3B8' }] },
        yAxis: { min: 0, max: 100, step: 20, title: 'pontos' } })}
    </ChartSlide>
    <ChartSlide title="Rosca" note="kind doughnut: furo de 60 %, legenda à direita, rótulos com uma casa">
      {chart({ kind: 'doughnut', holeSize: 60, data: { categories: ['Varejo', 'Crédito', 'Seguros', 'Outros'], series: [{ name: 'Q3', values: [42.5, 28.1, 18.4, 11] }] },
        legend: { position: 'right' }, labels: { format: '0.0' } })}
    </ChartSlide>
    <ChartSlide title="Dispersão" note="kind scatter: duas séries de pares (x, y) com eixos titulados">
      {chart({ kind: 'scatter', data: { series: [
        { name: 'Lojas de rua', points: [[120, 3.1], [180, 4.0], [240, 4.6], [300, 5.8], [360, 6.1]] },
        { name: 'Shopping', points: [[150, 4.2], [210, 5.1], [270, 6.4], [330, 7.2]] }] },
        xAxis: { title: 'área (m²)', min: 100 }, yAxis: { title: 'receita (R$ mi)' } })}
    </ChartSlide>
    <ChartSlide title="Barra + linha" note="kind combo: receita em barras (eixo esquerdo) e margem em linha (eixo direito, %)">
      {chart({ kind: 'combo', data: { categories: QUARTERS, series: [
        { name: 'Receita (R$ mi)', values: [36, 41, 46, 52], as: 'bar' },
        { name: 'Margem', values: [0.12, 0.14, 0.15, 0.18], as: 'line', axis: 'secondary' }] },
        yAxis: { title: 'R$ mi' }, y2Axis: { format: '0%', min: 0, max: 0.25, step: 0.05 }, markers: true })}
    </ChartSlide>
  </Deck>
));
