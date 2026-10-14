/** Erro de estrutura do deck; `path` aponta onde o problema foi encontrado. */
export class ResolveError extends Error {
  readonly path: string;

  constructor(message: string, path: string) {
    super(path === '' ? message : `${message} (em ${path})`);
    this.name = 'ResolveError';
    this.path = path;
  }
}

/**
 * Valor de prop que não pode seguir nem como diagnóstico (ex.: cor ilegível: o pptxgenjs
 * trocaria por preto e o preview mostraria outra coisa). A normalização não conhece o path;
 * o resolve converte em ResolveError com o path e a primitiva.
 */
export class InvalidPropError extends Error {
  readonly property: string;
  readonly value: unknown;

  constructor(property: string, value: unknown, expected: string) {
    super(`valor ${JSON.stringify(value)} inválido; ${expected}`);
    this.name = 'InvalidPropError';
    this.property = property;
    this.value = value;
  }
}
