/** Erro de estrutura do deck; `path` aponta onde o problema foi encontrado. */
export class ResolveError extends Error {
  readonly path: string;

  constructor(message: string, path: string) {
    super(path === '' ? message : `${message} (em ${path})`);
    this.name = 'ResolveError';
    this.path = path;
  }
}
