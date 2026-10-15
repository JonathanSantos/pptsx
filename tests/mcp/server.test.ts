import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { createPptsxMcpServer } from '../../src/mcp/server.ts';

// M16-3: um cliente MCP de verdade (transporte em memória) chamando as ferramentas do pptsx-mcp.
type Content = { type: string; text?: string; data?: string; mimeType?: string };
type CallResult = { content: Content[]; isError?: boolean };

const ROOT = resolve(import.meta.dirname, '../..');
const PNG_SIGNATURE = '89504e470d0a1a0a';

const connect = async () => {
  const server = createPptsxMcpServer({ cwd: ROOT }, 'test');
  const client = new Client({ name: 'teste', version: '1' });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  return client;
};

describe('pptsx-mcp', () => {
  let client: Client;
  beforeAll(async () => {
    client = await connect();
  });
  const call = async (name: string, args: Record<string, unknown>) => (await client.callTool({ name, arguments: args })) as unknown as CallResult;

  it('lista as seis ferramentas', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual(['build', 'diagnose', 'guide', 'init', 'preview', 'schema']);
  });

  it('build num deck com erro: isError, diagnósticos com as mensagens da engine e o overview em PNG', async () => {
    const out = mkdtempSync(join(tmpdir(), 'pptsx-mcp-'));
    const result = await call('build', { deck: 'examples/agent-test/broken-original.tsx', sizes: ['16x9'], out });
    expect(result.isError).toBe(true);
    const report = result.content[0]!.text!;
    expect(report).toMatch(/error/);
    const json = JSON.parse(report.slice(report.indexOf('\n\n{\n') + 2)) as { diagnostics: { severity: string; message: string }[]; files: string[] };
    expect(json.diagnostics.some((d) => d.severity === 'error')).toBe(true);
    expect(json.files.some((file) => file.endsWith('.pptx'))).toBe(true);
    const image = result.content.find((item) => item.type === 'image')!;
    expect(image.mimeType).toBe('image/png');
    expect(Buffer.from(image.data!, 'base64').subarray(0, 8).toString('hex')).toBe(PNG_SIGNATURE);
  }, 60000);

  it('diagnose num deck limpo: sem isError, sem imagem', async () => {
    const result = await call('diagnose', { deck: 'examples/hello.tsx', sizes: ['16x9', '4x3'] });
    expect(result.isError).toBeFalsy();
    expect(result.content.every((item) => item.type === 'text')).toBe(true);
    expect(result.content[0]!.text).toContain('16x9');
  }, 60000);

  it('preview devolve o PNG do slide; slide fora do deck é erro com o total', async () => {
    const ok = await call('preview', { deck: 'examples/hello.tsx', size: '16x9', slide: 1 });
    expect(Buffer.from(ok.content[1]!.data!, 'base64').subarray(0, 8).toString('hex')).toBe(PNG_SIGNATURE);
    const out = await call('preview', { deck: 'examples/hello.tsx', size: '16x9', slide: 99 });
    expect(out.isError).toBe(true);
    expect(out.content[0]!.text).toMatch(/peça de 1 a \d+/);
  }, 60000);

  it('deck inexistente: isError com a mensagem', async () => {
    const result = await call('diagnose', { deck: 'nao-existe.tsx' });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('deck não encontrado');
  });

  it("guide('§8') devolve a seção de diagnósticos; sem argumento, o índice", async () => {
    const section = await call('guide', { section: '§8' });
    expect(section.content[0]!.text).toMatch(/^## 8\. Diagnósticos/);
    expect(section.content[0]!.text).not.toContain('## 9.');
    const index = await call('guide', {});
    expect(index.content[0]!.text).toContain('- 8. Diagnósticos');
    expect((await call('guide', { section: 'nada disso' })).isError).toBe(true);
  });

  it('schema por primitiva', async () => {
    const chart = JSON.parse((await call('schema', { primitive: 'chart' })).content[0]!.text!) as { required: string[]; properties: Record<string, { type: string }> };
    expect(chart.required).toEqual(['data', 'kind']);
    expect(chart.properties.kind!.type).toContain('"stackedBar100"');
    expect((await call('schema', { primitive: 'xyz' })).isError).toBe(true);
    expect((await call('schema', { primitive: 'Text' })).isError).toBeFalsy();
  });

  it('init cria o projeto', async () => {
    const dir = join(mkdtempSync(join(tmpdir(), 'pptsx-mcp-init-')), 'novo');
    const result = await call('init', { dir });
    expect(result.content[0]!.text).toContain('deck.tsx');
  });
});
