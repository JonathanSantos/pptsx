import { defineConfig } from 'pptsx';
import { tokens } from '../tokens.ts';
import { themeOf } from '../theme.ts';

// M15: builds rodados nesta pasta saem com o tema dos tokens e as propriedades do documento.
export default defineConfig({
  theme: themeOf(tokens),
  document: { author: 'pptsx', company: 'Exemplos pptsx', subject: 'Arquivo pronto para editar', keywords: ['pptsx', 'tema', 'exemplo'] },
});
