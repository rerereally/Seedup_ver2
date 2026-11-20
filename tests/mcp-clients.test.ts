import assert from 'node:assert/strict';
import test from 'node:test';
import { mcpClients } from '../lib/mcp/clients';

const token = `sdp_${'a'.repeat(48)}`;
const clients = mcpClients('https://seedup.example/', token);

test('every client setup carries the endpoint and the token', () => {
  for (const client of clients) {
    assert.ok(client.snippet.includes('https://seedup.example/api/mcp'), client.id);
    assert.ok(client.snippet.includes(token), client.id);
    if (client.keyUrl) assert.equal(client.snippet, `https://seedup.example/api/mcp/${token}`);
    if (client.snippet.startsWith('{')) assert.doesNotThrow(() => JSON.parse(client.snippet), client.id);
  }
});

test('the Codex snippet raises the tool timeout above the 60 s default', () => {
  const codex = clients.find((client) => client.id === 'codex')!;
  assert.ok(codex.snippet.includes('tool_timeout_sec = 180'));
});

test('install links decode back to the same server', () => {
  const cursor = clients.find((client) => client.id === 'cursor')!;
  const config = new URL(cursor.link!).searchParams.get('config')!;
  assert.deepEqual(JSON.parse(Buffer.from(config, 'base64').toString()), { url: 'https://seedup.example/api/mcp', headers: { Authorization: `Bearer ${token}` } });
  const vscode = clients.find((client) => client.id === 'vscode')!;
  assert.equal(JSON.parse(decodeURIComponent(vscode.link!.split('?')[1])).type, 'http');
});

test('the placeholder token survives the base64 link', () => {
  assert.doesNotThrow(() => mcpClients('https://seedup.example', '[토큰]'));
});
