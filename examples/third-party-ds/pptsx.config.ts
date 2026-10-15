import { defineConfig } from 'pptsx';
import ds from './ds.ts';
import { theme } from './tokens.ts';

export default defineConfig({ ds: [ds], theme });
