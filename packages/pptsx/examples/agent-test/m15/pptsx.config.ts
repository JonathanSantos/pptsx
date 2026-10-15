import { defineConfig } from 'pptsx';
import { tokens } from '../../tokens.ts';

const { color } = tokens;

// brand e ink têm o mesmo hex (#1B2A4A): um único slot (dark1) cobre os dois.
// Cada slot recebe um hex distinto para a troca de cor no PowerPoint ser previsível.
export default defineConfig({
  theme: {
    name: 'Plataforma de Dados',
    colors: {
      dark1: color.ink, // = brand
      light1: color.white,
      dark2: color.brandDark,
      light2: color.surface,
      accent1: color.accent,
      accent2: color.positive,
      accent3: color.negative,
      accent4: color.muted,
      accent5: color.accentSoft,
    },
    fonts: { heading: 'Arial', body: 'Arial' },
  },
  document: {
    author: 'Time da Plataforma de Dados',
    company: 'Empresa S.A.',
    subject: 'Revisão trimestral Q3 2026',
    keywords: ['resultados', 'q3-2026', 'plataforma de dados'],
  },
});
