/** Captura console.log/console.error para testar runCli em processo. */
import { vi } from 'vitest';

export interface CapturedConsole {
  /** Uma entrada por chamada de console.log (argumentos unidos por espaço). */
  readonly logs: string[];
  readonly errors: string[];
  readonly restore: () => void;
}

const joinArgs = (args: readonly unknown[]): string => args.map(String).join(' ');

export const captureConsole = (): CapturedConsole => {
  const logs: string[] = [];
  const errors: string[] = [];
  const log = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => void logs.push(joinArgs(args)));
  const error = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => void errors.push(joinArgs(args)));
  return {
    logs,
    errors,
    restore: () => {
      log.mockRestore();
      error.mockRestore();
    },
  };
};

/** Espera uma condição com timers reais; falha com a mensagem dada. */
export const waitFor = async (condition: () => boolean, timeoutMs: number, message: string): Promise<void> => {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) throw new Error(`timeout (${timeoutMs} ms): ${message}`);
    await sleep(10);
  }
};

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
