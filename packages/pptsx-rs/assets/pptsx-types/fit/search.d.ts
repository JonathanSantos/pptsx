import type { LayoutInput, Pass, Plans } from './pass.ts';
/**
 * Rodadas: uma busca por escopo disparado, do mais interno ao mais externo. Repete
 * enquanto alguma busca mudou algo (sizes só descem, então termina) ou até o limite.
 */
export declare const shrinkRounds: (pass: Pass, plans: Plans, input: LayoutInput, remaining: number) => Pass;
