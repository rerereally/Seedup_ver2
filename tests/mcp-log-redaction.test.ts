import assert from 'node:assert/strict';
import test from 'node:test';
import { redactMcpLogValue } from '../instrumentation';

test('MCP error logging masks URL keys and standalone tokens', () => {
  const token = 'sdp_' + 'a'.repeat(48);
  assert.equal(redactMcpLogValue(`/api/mcp/${token}`), '/api/mcp/[key]');
  assert.equal(redactMcpLogValue(`failed for https://seedup.example.com/api/mcp/%73${token.slice(1)}?a=b`), 'failed for https://seedup.example.com/api/mcp/[key]?a=b');
  assert.equal(redactMcpLogValue(`invalid MCP credential ${token}`), 'invalid MCP credential [redacted]');
  assert.equal(redactMcpLogValue('/api/mcp/token'), '/api/mcp/token');
  assert.equal(redactMcpLogValue('/api/opportunities/prd'), '/api/opportunities/prd');
});
