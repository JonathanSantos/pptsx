import { Deck, Slide, Table, Text, defineDeck } from 'pptsx';

export default defineDeck(() => (
  <Deck>
    <Slide padding={40} gap={20} color="#1B2A4A">
      <Text fontSize={28} fontWeight="bold">Receita por área</Text>
      <Table
        fontSize={15}
        header={{ fill: '#1B2A4A', color: '#FFFFFF' }}
        stripe="#F4F6FA"
        border="#CCD3E0"
        cellPadding={6}
        columns={[
          { header: 'Área', width: '40%' },
          { header: 'Q2 (R$\u00A0mi)', align: 'right' },
          { header: 'Q3 (R$\u00A0mi)', align: 'right' },
          { header: 'Δ', align: 'right' },
        ]}
        rows={[
          ['Varejo', '18,6', '22,6', '+21,5%'],
          ['Crédito', '9,8', '10,4', '+6,1%'],
          ['Seguros', '6,1', '6,8', '+11,5%'],
          ['Logística', '4,7', '5,0', '+6,4%'],
          ['Marketing', '3,9', '4,2', '+7,7%'],
        ]}
      />
    </Slide>
  </Deck>
));
