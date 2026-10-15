import { defineConfig } from 'pptsx';
import { ds, theme } from '@pptsx/ds-base';

// M15: builds rodados nesta pasta saem com o tema dos tokens e as propriedades do documento.
export default defineConfig({
  theme,
  ds: [ds],
  document: { author: 'pptsx', company: 'Exemplos pptsx', subject: 'Arquivo pronto para editar', keywords: ['pptsx', 'tema', 'exemplo'] },
});
