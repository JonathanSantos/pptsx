import { InvalidPropError } from './errors.ts';
import { parseColor } from './values.ts';

/** Toda cor de entrada sai daqui como '#RRGGBB' maiúsculo: emissor e preview recebem o mesmo valor. */

const EXPECTED = 'use #RGB, #RRGGBB, rgb()/rgba(), transparent ou um nome básico (black, white, red…)';

export interface StrictColor {
  readonly hex: string;
  readonly alpha: number;
}

/** Cor do autor ou InvalidPropError (nunca segue crua nem vira diagnóstico). */
export const strictColorOf = (property: string, value: unknown): StrictColor => {
  const color = parseColor(value);
  if (color === undefined) throw new InvalidPropError(property, value, EXPECTED);
  return color;
};

export const hexOf = (property: string, value: unknown): string => strictColorOf(property, value).hex;

/** Lista de cores (Chart `colors`); o índice entra no nome da prop do erro. */
export const hexListOf = (property: string, value: unknown): readonly string[] => {
  if (!Array.isArray(value)) throw new InvalidPropError(property, value, 'use uma lista de cores');
  return value.map((item, index) => hexOf(`${property}[${index}]`, item));
};

/** Objeto com campos de cor (Table `header`): só os campos listados são normalizados. */
export const withHexFields = <T>(property: string, value: T, fields: readonly string[]): T => {
  if (typeof value !== 'object' || value === null) return value;
  const record = value as Readonly<Record<string, unknown>>;
  const entries = Object.entries(record).map(([key, item]) =>
    fields.includes(key) && item !== undefined ? [key, hexOf(`${property}.${key}`, item)] : [key, item],
  );
  return Object.fromEntries(entries) as T;
};

/** M17: cor CSS (#RGB, #RRGGBB, rgb(), nome básico) → '#RRGGBB'; lança Error com o motivo. API pública. */
export const toHexColor = (value: unknown): string => hexOf('cor', value);
