import { defineConfig } from 'pptsx';
import { ds } from '@pptsx/ds-base';

// Builds e lint rodados em packages/ds-base/examples conhecem o DS: as regras de marca entram no
// `pptsx lint` e o guia/schema no MCP. (Sem tema aqui: o arquivo sai como antes; arquivo/ tem o dele.)
export default defineConfig({ ds: [ds] });
