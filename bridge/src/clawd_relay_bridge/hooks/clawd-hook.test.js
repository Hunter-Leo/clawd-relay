/**
 * Tests for clawd-hook.js event collection and permission handling.
 *
 * @module clawd-hook-test
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');

const clawdHook = require('./clawd-hook');

describe('sanitize', () => {
  it('truncates strings to maxChars', () => {
    assert.strictEqual(clawdHook.sanitize('hello world', 5), 'hello');
  });

  it('removes control characters', () => {
    assert.strictEqual(clawdHook.sanitize('line1\nline2\t', 20), 'line1line2');
  });

  it('returns empty string for non-string input', () => {
    assert.strictEqual(clawdHook.sanitize(null, 10), '');
    assert.strictEqual(clawdHook.sanitize(undefined, 10), '');
    assert.strictEqual(clawdHook.sanitize(42, 10), '');
  });
});

describe('extractTitle', () => {
  it('extracts conversation_title from Elicitation', () => {
    assert.strictEqual(
      clawdHook.extractTitle('Elicitation', { conversation_title: 'Fix login bug' }),
      'Fix login bug',
    );
  });

  it('returns empty for other event types', () => {
    assert.strictEqual(clawdHook.extractTitle('Notification', {}), '');
  });
});

describe('extractToolName', () => {
  it('prefers toolName camelCase', () => {
    assert.strictEqual(clawdHook.extractToolName({ toolName: 'Bash' }), 'Bash');
  });

  it('falls back to tool_name', () => {
    assert.strictEqual(clawdHook.extractToolName({ tool_name: 'Edit' }), 'Edit');
  });
});

describe('extractToolInput', () => {
  it('truncates long command inputs', () => {
    const longCmd = 'x'.repeat(600);
    const result = clawdHook.extractToolInput({ toolInput: { command: longCmd } });
    assert.ok(result.command.endsWith('...'));
    assert.ok(result.command.length < 510);
  });
});

describe('buildStatePayload', () => {
  it('maps Elicitation to thinking', () => {
    var r = clawdHook.buildStatePayload('Elicitation', { session_id: 's1' });
    assert.strictEqual(r.type, 'session_state');
    assert.strictEqual(r.session.state, 'thinking');
    assert.ok(r.device.id);
    assert.ok(typeof r.session.updatedAt === 'number');
  });

  it('maps PostToolUse to working', () => {
    var r = clawdHook.buildStatePayload('PostToolUse', { tool_name: 'Bash', session_id: 's2' });
    assert.strictEqual(r.session.state, 'working');
  });

  it('defaults unknown events to idle', () => {
    var r = clawdHook.buildStatePayload('Unknown', { session_id: 's3' });
    assert.strictEqual(r.session.state, 'idle');
  });
});

describe('handlePermission', () => {
  function startMockServer(handler) {
    return new Promise((resolve) => {
      const srv = http.createServer(handler);
      srv.listen(0, '127.0.0.1', () => resolve(srv));
    });
  }

  it('returns "allow" on approved=true', async () => {
    const server = await startMockServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ approved: true, permissionId: 'p1' }));
    });
    const result = await clawdHook.handlePermission({ permission_id: 'p1' }, server.address().port);
    server.close();
    assert.strictEqual(result, 'allow');
  });

  it('returns "deny" on approved=false', async () => {
    const server = await startMockServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ approved: false, permissionId: 'p2' }));
    });
    const result = await clawdHook.handlePermission({ permission_id: 'p2' }, server.address().port);
    server.close();
    assert.strictEqual(result, 'deny');
  });

  it('returns null on 204 (no clients)', async () => {
    const server = await startMockServer((_req, res) => { res.writeHead(204); res.end(); });
    const result = await clawdHook.handlePermission({ permission_id: 'p3' }, server.address().port);
    server.close();
    assert.strictEqual(result, null);
  });

  it('returns null on 408 (timeout)', async () => {
    const server = await startMockServer((_req, res) => { res.writeHead(408); res.end(); });
    const result = await clawdHook.handlePermission({ permission_id: 'p4' }, server.address().port);
    server.close();
    assert.strictEqual(result, null);
  });

  it('returns null on unreachable port', async () => {
    const result = await clawdHook.handlePermission({ permission_id: 'p5' }, 1);
    assert.strictEqual(result, null);
  });
});
