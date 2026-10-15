/** Erro de estrutura do deck; `path` aponta onde o problema foi encontrado. */
export class ResolveError extends Error {
  readonly path: string;
  /** M18-6: o erro é uma prop da 0.x removida (o lint o mostra como `legacy-prop`, com a troca). */
  readonly removedProp: boolean;

  constructor(message: string, path: string, removedProp: boolean = false) {
    super(path === '' ? message : `${message} (em ${path})`);
    this.name = 'ResolveError';
    this.path = path;
    this.removedProp = removedProp;
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

/** M18-6: prop antiga (alias da 0.x) removida na 1.0; a mensagem traz a troca e o comando que migra. */
export class RemovedPropError extends InvalidPropError {
  constructor(property: string, value: unknown, suggestion: string) {
    super(property, value, '');
    this.name = 'RemovedPropError';
    this.message = `removida na 1.0; troque por ${suggestion} (\`pptsx lint --fix\` reescreve o deck; \`pptsx lint --from 0.x <pasta>\` migra uma pasta inteira)`;
  }
}
