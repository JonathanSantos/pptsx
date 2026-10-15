import { B, Box, Chart, Deck, Shape, Slide, Text, defineDeck, type DeckContext } from 'pptsx';

// Galeria · Pitch de hardware: Tara T1, uma balança conectada que conta o estoque de uma padaria.
//
// Paleta: o próprio aparelho.
//   cobalto #2340C8 — a carcaça pintada; títulos de destaque e a coluna do produto
//   gelo    #E9EEF5 — fundo frio de bancada, sem cara de "tema"
//   grafite #14171D — tinta e o slide do pedido
//   visor   #1E2A22 com dígitos #B9F27C — o LCD da balança, a única cor ácida, presa ao visor
//   aço     #8792A3 — texto secundário e o que ainda não aconteceu
// Tipografia: só Arial. Números de visor em negrito com letterSpacing largo e rótulos de status
// minúsculos ("TARA", "LÍQ", "ESTÁVEL"), como numa balança de verdade; títulos curtos em 30 pt.
// Assinatura: o visor LCD. Ele é a tela do aparelho na capa (desenhado com Box, girado com o
// corpo e com sombra nativa) e volta como a forma de mostrar todo número do pitch.

const C = {
  cobalto: '#2340C8',
  cobaltoEscuro: '#1A2F96',
  gelo: '#E9EEF5',
  grafite: '#14171D',
  visor: '#1E2A22',
  digito: '#B9F27C',
  aco: '#8792A3',
  chapa: '#C9D3E3',
  branco: '#FFFFFF',
} as const;

type ReadoutProps = { value: string; unit: string; status?: string; size?: number | { base: number; tall: number }; grow?: boolean };

/** O visor: dígitos verdes num fundo quase preto, status em cima e unidade ao lado (baseline). */
const Readout = ({ value, unit, status = 'LÍQ · ESTÁVEL', size = 30, grow = false }: ReadoutProps) => (
  <Box
    backgroundColor={C.visor} borderRadius={8} padding="8 14 10" gap={2} color={C.digito}
    flexGrow={grow ? 1 : 0} justifyContent="space-between"
  >
    <Text fontSize={7} fontWeight="bold" letterSpacing={1.5} color="#6E8F55">
      {status}
    </Text>
    <Box display="flex" alignItems="baseline" justifyContent="flex-end" gap={6}>
      <Text fontSize={size} fontWeight="bold" letterSpacing={2} nowrap>
        {value}
      </Text>
      <Text fontSize={11} fontWeight="bold" nowrap>
        {unit}
      </Text>
    </Box>
  </Box>
);

const Label = ({ children, color = C.aco }: { children: string; color?: string }) => (
  <Text fontSize={9} fontWeight="bold" letterSpacing={2} textTransform="uppercase" color={color}>
    {children}
  </Text>
);

const Title = ({ children }: { children: string }) => (
  <Text fontSize={{ base: 28, tall: 32 }} fontWeight="bold" lineHeight={1.1}>
    {children}
  </Text>
);

const SPECS = [
  { value: '±2', unit: 'g', label: 'Precisão até 30 kg', status: 'ZERO · ESTÁVEL' },
  { value: '150', unit: 'kg', label: 'Capacidade', status: 'BRUTO' },
  { value: '14', unit: 'meses', label: 'Bateria LiFePO4', status: 'BAT 100%' },
  { value: 'IP65', unit: '', label: 'Lava com mangueira', status: 'VEDAÇÃO' },
  { value: '15', unit: 'min', label: 'Envio por Wi-Fi ou LTE', status: 'SINC' },
  { value: '4', unit: 's', label: 'Até estabilizar', status: 'ESTÁVEL' },
  { value: '304', unit: 'inox', label: 'Plataforma removível', status: 'CHAPA' },
  { value: '−10/50', unit: '°C', label: 'Da câmara fria ao forno', status: 'TEMP' },
  { value: 'III', unit: 'classe', label: 'Inmetro, em certificação', status: 'METRO' },
] as const;

const OPTIONS = [
  { name: 'Tara T1', cost: 'R$ 89/mês', error: '0,4%', freq: 'a cada 15 min', erp: 'nativa' },
  { name: 'Balança + planilha', cost: '6 h de equipe', error: '3 a 5%', freq: 'semanal', erp: 'digitação' },
  { name: 'Contagem manual', cost: '10 h de equipe', error: '8 a 12%', freq: 'mensal', erp: 'não tem' },
] as const;
const ROWS = [
  ['Custo por loja', 'cost'],
  ['Erro de estoque', 'error'],
  ['Saldo atualizado', 'freq'],
  ['Integração com ERP', 'erp'],
] as const;

const STEPS = [
  { when: 'jan–mar 2026', figure: '30', what: 'protótipos', note: 'Célula de carga e firmware próprios.', state: 'feito' },
  { when: 'abr–ago 2026', figure: '12', what: 'padarias no piloto', note: 'Perda de farinha caiu de 9% para 2,1%.', state: 'feito' },
  { when: 'set–dez 2026', figure: 'III', what: 'classe Inmetro', note: 'Ensaios no laboratório em novembro.', state: 'agora' },
  { when: '1º sem. 2027', figure: '1.000', what: 'balanças em série', note: 'Montagem contratada em Manaus.', state: 'depois' },
] as const;

const stepBorder = (state: string) =>
  state === 'feito' ? `4px solid ${C.cobalto}` : state === 'agora' ? `4px solid ${C.grafite}` : `4px dashed ${C.aco}`;

export default defineDeck((ctx: DeckContext) => (
  <Deck>
    {/* 1 · Capa: o aparelho é um Box girado (-8°) com sombra; chapa e visor giram junto com ele. */}
    <Slide backgroundColor={C.gelo} color={C.grafite} padding={{ base: 44, tall: 52 }}>
      <Shape
        kind="ellipse" position="absolute" zIndex={-1}
        right={{ base: 34, tall: 30 }} top={{ base: 300, tall: 372 }}
        width={330} height={34} backgroundColor={C.grafite} opacity={0.12}
      />
      <Box
        position="absolute" rotate={-8}
        right={{ base: 46, tall: 44 }} top={{ base: 92, tall: 150 }}
        width={300} height={206} padding={16}
        backgroundColor={C.cobalto} borderRadius={22} boxShadow="0 10px 24px rgba(20,23,29,0.35)"
      >
        <Box flex={1} backgroundColor={C.chapa} borderRadius={10} border="1px solid #AEB9CC" alignItems="center" justifyContent="center">
          <Box width="58%" height="72%" backgroundColor="#E4D3AE" borderRadius={14} justifyContent="center" gap={2} boxShadow="0 3px 6px rgba(20,23,29,0.18)">
            <Text fontSize={8} fontWeight="bold" letterSpacing={2} textAlign="center" color="#7A5B2E">
              FARINHA DE TRIGO
            </Text>
            <Text fontSize={7} textAlign="center" color="#7A5B2E">
              tipo 1 · saco aberto
            </Text>
          </Box>
        </Box>
        <Box display="flex" alignItems="flex-end" justifyContent="space-between" marginTop={12}>
          <Box gap={6} paddingBottom={4}>
            <Box display="flex" gap={6}>
              <Shape kind="ellipse" width={14} height={14} backgroundColor={C.cobaltoEscuro} />
              <Shape kind="ellipse" width={14} height={14} backgroundColor={C.cobaltoEscuro} />
            </Box>
            <Text fontSize={8} fontWeight="bold" letterSpacing={3} color="#AFC0FF">
              TARA T1
            </Text>
          </Box>
          <Readout value="12,480" unit="kg" status="LÍQ · ESTÁVEL · ERP OK" size={24} />
        </Box>
      </Box>
      <Box width={{ base: '46%', tall: '52%' }} marginTop={{ base: 'auto', tall: 0 }} gap={12}>
        <Label color={C.cobalto}>Tara T1 · rodada seed</Label>
        <Text fontSize={{ base: 38, tall: 44 }} fontWeight="bold" lineHeight={1.05}>
          A balança que conta o estoque da padaria
        </Text>
        <Text fontSize={{ base: 15, tall: 17 }} color="#4A5160" lineHeight={1.3}>
          Pesa sacos, baldes e caixas e manda o saldo para o ERP a cada 15 minutos. Ninguém precisa digitar nada.
        </Text>
      </Box>
      <Text fontSize={9} color={C.aco} marginTop={{ base: 26, tall: 'auto' }}>
        Tara Equipamentos · Campinas · outubro de 2026
      </Text>
    </Slide>

    {/* 2 · Problema: um número enorme e três causas com borda à esquerda. */}
    <Slide backgroundColor={C.branco} color={C.grafite} padding={{ base: 44, tall: 52 }} gap={{ base: 18, tall: 28 }}>
      <Label>O problema</Label>
      <Box display="flex" gap={{ base: 36, tall: 40 }} flex={1} alignItems="center">
        <Box width={{ base: 250, tall: 260 }} flexShrink={0}>
          <Text fontSize={{ base: 132, tall: 150 }} fontWeight="bold" color={C.cobalto} lineHeight={1} letterSpacing={-4} nowrap>
            9%
          </Text>
          <Text fontSize={{ base: 16, tall: 18 }} fontWeight="bold" lineHeight={1.25} marginTop={8}>
            da farinha some entre a nota fiscal e o forno.
          </Text>
        </Box>
        <Box flex={1} gap={{ base: 16, tall: 22 }}>
          {[
            ['Contagem semanal, de cabeça', 'O padeiro estima sacos abertos “pela metade”.'],
            ['Saco aberto não entra na planilha', 'O estoque só vê unidades fechadas de 25 kg.'],
            ['Compra chega sem conferência', 'Ninguém pesa a entrega; a nota manda.'],
          ].map(([cause, detail]) => (
            <Box borderLeft={`3px solid ${C.chapa}`} paddingLeft={14} gap={3}>
              <Text fontSize={{ base: 17, tall: 19 }} fontWeight="bold">
                {cause!}
              </Text>
              <Text fontSize={{ base: 13, tall: 15 }} color="#4A5160">
                {detail!}
              </Text>
            </Box>
          ))}
        </Box>
      </Box>
      <Text fontSize={9} color={C.aco}>
        Média de 12 padarias do piloto, abril de 2026, antes da instalação. Farinha, açúcar e manteiga somam 61% do custo de insumos.
      </Text>
    </Slide>

    {/* 3 · Especificações: cada número é um visor; em 4:3 cabem três linhas (ctx.pick). */}
    <Slide backgroundColor={C.gelo} color={C.grafite} padding={{ base: 40, tall: 48 }} gap={{ base: 18, tall: 24 }}>
      <Box display="flex" justifyContent="space-between" alignItems="baseline">
        <Title>Feita para farinha, água e pancada</Title>
        <Label>Ficha técnica</Label>
      </Box>
      <Box display="grid" flex={1} gap={14} gridTemplateColumns="repeat(3, minmax(0, 1fr))" gridAutoRows="minmax(0, 1fr)">
        {SPECS.slice(0, ctx.pick({ base: 6, tall: 9 })).map((s) => (
          <Box backgroundColor={C.branco} borderRadius={12} padding={12} gap={8} justifyContent="space-between" boxShadow="0 2px 6px rgba(20,23,29,0.10)">
            <Readout value={s.value} unit={s.unit} status={s.status} size={{ base: 34, tall: 28 }} grow />
            <Text fontSize={12} fontWeight="bold" paddingLeft={2}>
              {s.label}
            </Text>
          </Box>
        ))}
      </Box>
    </Slide>

    {/* 4 · Comparação: grid de 4 colunas; a coluna do produto sobe com sombra e borda cobalto. */}
    <Slide backgroundColor={C.branco} color={C.grafite} padding={{ base: 40, tall: 48 }} gap={{ base: 18, tall: 26 }}>
      <Title>Contar à mão custa mais que a balança</Title>
      <Box display="grid" flex={1} columnGap={10} gridTemplateColumns="1.1fr repeat(3, minmax(0, 1fr))" gridTemplateRows="minmax(0, 1fr)">
        <Box paddingTop={{ base: 52, tall: 66 }}>
          {ROWS.map(([label]) => (
            <Box flex={1} justifyContent="center" borderTop="1px solid #DDE3EC">
              <Text fontSize={{ base: 12, tall: 14 }} color={C.aco} fontWeight="bold">
                {label}
              </Text>
            </Box>
          ))}
        </Box>
        {OPTIONS.map((o, i) => (
          <Box
            backgroundColor={i === 0 ? C.branco : '#F4F6FA'}
            border={i === 0 ? `2px solid ${C.cobalto}` : '2px solid #F4F6FA'}
            borderRadius={12}
            boxShadow={i === 0 ? '0 8px 20px rgba(35,64,200,0.22)' : undefined}
            padding="0 12"
          >
            <Box height={{ base: 50, tall: 64 }} justifyContent="center">
              <Text fontSize={{ base: 14, tall: 16 }} fontWeight="bold" color={i === 0 ? C.cobalto : C.grafite}>
                {o.name}
              </Text>
            </Box>
            {ROWS.map(([, key]) => (
              <Box flex={1} justifyContent="center" borderTop="1px solid #DDE3EC">
                <Text fontSize={{ base: 15, tall: 17 }} fontWeight={i === 0 ? 'bold' : 'normal'}>
                  {o[key]}
                </Text>
              </Box>
            ))}
          </Box>
        ))}
      </Box>
      <Text fontSize={9} color={C.aco}>
        Por loja de 300 m², 1,2 t de insumos secos por mês. Custo de equipe a R$ 28/h.
      </Text>
    </Slide>

    {/* 5 · Linha do tempo: o estado de cada etapa é a borda de cima (sólida, escura ou tracejada). */}
    <Slide backgroundColor={C.gelo} color={C.grafite} padding={{ base: 40, tall: 48 }} gap={{ base: 22, tall: 30 }}>
      <Title>Do protótipo ao primeiro lote</Title>
      <Box
        display="grid" gap={{ base: 14, tall: 18 }} marginTop="auto"
        gridTemplateColumns="repeat(4, minmax(0, 1fr))"
      >
        {STEPS.map((s) => (
          <Box borderTop={stepBorder(s.state)} paddingTop={14} gap={4}>
            <Box display="flex" justifyContent="space-between" alignItems="center" height={16}>
              <Label color={s.state === 'depois' ? C.aco : C.cobalto}>{s.when}</Label>
              <Text
                fontSize={8} fontWeight="bold" letterSpacing={1} padding="2 6" borderRadius={4}
                display={s.state === 'agora' ? 'flex' : 'none'}
                backgroundColor={C.visor} color={C.digito}
              >
                AGORA
              </Text>
            </Box>
            <Text
              fontSize={{ base: 50, tall: 56 }} fontWeight="bold" letterSpacing={-1} nowrap marginTop={{ base: 8, tall: 24 }}
              color={s.state === 'feito' ? C.cobalto : s.state === 'agora' ? C.grafite : C.aco}
            >
              {s.figure}
            </Text>
            <Text fontSize={{ base: 15, tall: 16 }} fontWeight="bold">
              {s.what}
            </Text>
            <Text fontSize={{ base: 12, tall: 14 }} color="#4A5160" lineHeight={1.3}>
              {s.note}
            </Text>
          </Box>
        ))}
      </Box>
      <Text fontSize={{ base: 13, tall: 15 }} lineHeight={1.3} padding="12 16" backgroundColor={C.branco} borderRadius={10} marginTop="auto">
        No piloto, <B>11 das 12 padarias</B> pediram para ficar com o aparelho depois do teste.
      </Text>
    </Slide>

    {/* 6 · Pedido: fundo cobalto (a cor do aparelho), visor grande e pizza nativa num cartão. */}
    <Slide backgroundColor={C.cobalto} color={C.branco} padding={{ base: 44, tall: 52 }} gap={{ base: 16, tall: 24 }}>
      <Label color="#AFC0FF">O pedido</Label>
      <Box
        display="grid" gap={{ base: 28, tall: 22 }} flex={1}
        gridTemplateColumns={{ base: 'minmax(0, 1fr) minmax(0, 1fr)', tall: 'minmax(0, 1fr)' }}
        gridTemplateRows={{ base: 'minmax(0, 1fr)', tall: 'auto minmax(0, 1fr)' }}
      >
        <Box justifyContent="center" gap={14}>
          <Readout value="6.000.000" unit="R$" status="RODADA SEED · 18 MESES" size={{ base: 34, tall: 40 }} />
          <Text fontSize={{ base: 16, tall: 18 }} lineHeight={1.3} color="#DCE3FF">
            Para fabricar o lote de 1.000 balanças, certificar no Inmetro e abrir vendas em três capitais.
          </Text>
        </Box>
        <Box backgroundColor={C.branco} borderRadius={14} padding={14} boxShadow="0 8px 20px rgba(10,20,80,0.35)">
          <Chart
            kind="pie" flex={1} legend showValues size={10} color={C.grafite} title="Uso do dinheiro (R$ mi)"
            colors={[C.grafite, C.cobalto, C.aco, C.chapa]}
            data={{
              categories: ['Lote de 1.000', 'Vendas', 'Certificação', 'Firmware'],
              series: [{ name: 'Uso', values: [2.6, 1.8, 0.7, 0.9] }],
            }}
          />
        </Box>
      </Box>
      <Text fontSize={9} color="#AFC0FF">
        contato@tara.example
      </Text>
    </Slide>
  </Deck>
));
