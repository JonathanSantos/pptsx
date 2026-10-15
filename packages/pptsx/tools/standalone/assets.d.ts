// M18-7: módulo virtual que o build.ts gera na hora do bundle (nada disto existe em disco).
declare module 'pptsx-standalone:assets' {
  export const VERSION: string;
  /** docs/AGENT_GUIDE.md. */
  export const GUIDE: string;
  /** hooks.ts já empacotado (com o sucrase), para registrar como data: URL. */
  export const HOOKS_SOURCE: string;
  export const RESVG_WASM_BASE64: string;
  /** Nome do arquivo → TTF em base64 (as Liberation Sans de fonts/). */
  export const FONTS: Readonly<Record<string, string>>;
}
