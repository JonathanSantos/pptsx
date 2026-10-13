#!/usr/bin/env node
// Registra o loader do tsx para carregar o deck .tsx e o próprio código-fonte em TS.
import { register } from 'tsx/esm/api';

register();
await import('../src/cli.ts');
