/**
 * Tests for clawd-hook.js pure helper functions.
 * Tests buildStatePayload, readTranscriptTail, extractApiError, extractSessionTitle.
 * The main() path (stdin read, HTTP post, process.exit) is not tested here.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const clawdHook = require('./clawd-hook');

function writeTmpJsonl(entries) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawd-hook-test-'));
  const file = path.join(dir, 'transcript.jsonl');
  const body = entries.map((e) => JSON.stringify(e)).join('\n') + '\n';
  fs.writeFileSync(file, body);
  return { dir, file };
}

function cleanupTmp(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

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

// ─── Event → State mapping tests ──────────────────────────────────────────

describe('buildStatePayload — event mappings', () => {
  it('maps SessionStart to idle', () => {
    const r = clawdHook.buildStatePayload('SessionStart', { session_id: 's1' });
    assert.strictEqual(r.session.state, 'idle');
  });

  it('maps SessionEnd to sleeping', () => {
    const r = clawdHook.buildStatePayload('SessionEnd', { session_id: 's2' });
    assert.strictEqual(r.session.state, 'sleeping');
  });

  it('maps UserPromptSubmit to thinking', () => {
    const r = clawdHook.buildStatePayload('UserPromptSubmit', { session_id: 's3' });
    assert.strictEqual(r.session.state, 'thinking');
  });

  it('maps PreToolUse to working', () => {
    const r = clawdHook.buildStatePayload('PreToolUse', { session_id: 's4', tool_name: 'Bash' });
    assert.strictEqual(r.session.state, 'working');
  });

  it('maps PostToolUse to working', () => {
    const r = clawdHook.buildStatePayload('PostToolUse', { session_id: 's5', tool_name: 'Edit' });
    assert.strictEqual(r.session.state, 'working');
  });

  it('maps PostToolUseFailure to error', () => {
    const r = clawdHook.buildStatePayload('PostToolUseFailure', { session_id: 's6' });
    assert.strictEqual(r.session.state, 'error');
  });

  it('maps Stop to attention', () => {
    const r = clawdHook.buildStatePayload('Stop', { session_id: 's7' });
    assert.strictEqual(r.session.state, 'attention');
  });

  it('maps StopFailure to error', () => {
    const r = clawdHook.buildStatePayload('StopFailure', { session_id: 's8' });
    assert.strictEqual(r.session.state, 'error');
  });

  it('maps SubagentStart to thinking', () => {
    const r = clawdHook.buildStatePayload('SubagentStart', { session_id: 's9' });
    assert.strictEqual(r.session.state, 'thinking');
  });

  it('maps SubagentStop to working', () => {
    const r = clawdHook.buildStatePayload('SubagentStop', { session_id: 's10' });
    assert.strictEqual(r.session.state, 'working');
  });

  it('maps PreCompact to working', () => {
    const r = clawdHook.buildStatePayload('PreCompact', { session_id: 's11' });
    assert.strictEqual(r.session.state, 'working');
  });

  it('maps PostCompact to attention', () => {
    const r = clawdHook.buildStatePayload('PostCompact', { session_id: 's12' });
    assert.strictEqual(r.session.state, 'attention');
  });

  it('maps Notification to notification', () => {
    const r = clawdHook.buildStatePayload('Notification', { session_id: 's13' });
    assert.strictEqual(r.session.state, 'notification');
  });

  it('maps Elicitation to thinking', () => {
    const r = clawdHook.buildStatePayload('Elicitation', { session_id: 's14' });
    assert.strictEqual(r.session.state, 'thinking');
    assert.strictEqual(r.type, 'session_state');
    assert.ok(r.device.id);
    assert.ok(typeof r.session.updatedAt === 'number');
  });

  it('maps WorktreeCreate to working', () => {
    const r = clawdHook.buildStatePayload('WorktreeCreate', { session_id: 's15' });
    assert.strictEqual(r.session.state, 'working');
  });

  it('defaults unknown events to idle', () => {
    const r = clawdHook.buildStatePayload('UnknownEvent', { session_id: 's16' });
    assert.strictEqual(r.session.state, 'idle');
  });

  it('upgrades Stop to error when transcript has current-turn API error', () => {
    const { dir, file } = writeTmpJsonl([
      { type: 'user', content: 'hello' },
      { isApiErrorMessage: true, sessionId: 's17', error: 'rate_limit' },
    ]);
    try {
      const r = clawdHook.buildStatePayload('Stop', { session_id: 's17', transcript_path: file });
      assert.strictEqual(r.session.state, 'error');
      assert.strictEqual(r.session.failureKind, 'api_error');
      assert.strictEqual(r.session.apiErrorType, 'rate_limit');
    } finally { cleanupTmp(dir); }
  });

  it('keeps Stop as attention when transcript has no API error', () => {
    const { dir, file } = writeTmpJsonl([
      { type: 'user', content: 'hello' },
      { type: 'assistant', content: 'ok' },
    ]);
    try {
      const r = clawdHook.buildStatePayload('Stop', { session_id: 's18', transcript_path: file });
      assert.strictEqual(r.session.state, 'attention');
      assert.ok(!r.session.failureKind);
    } finally { cleanupTmp(dir); }
  });
});

describe('buildStatePayload — fields', () => {
  it('includes toolUseId when present', () => {
    const r = clawdHook.buildStatePayload('PostToolUse', { session_id: 's', tool_use_id: 'tu-123' });
    assert.strictEqual(r.session.toolUseId, 'tu-123');
  });

  it('omits toolUseId when absent', () => {
    const r = clawdHook.buildStatePayload('PostToolUse', { session_id: 's' });
    assert.strictEqual(r.session.toolUseId, null);
  });

  it('includes toolName and toolInput on PostToolUse', () => {
    const r = clawdHook.buildStatePayload('PostToolUse', { session_id: 's', tool_name: 'Bash', toolInput: { command: 'ls' } });
    assert.strictEqual(r.session.toolName, 'Bash');
    assert.deepStrictEqual(r.session.toolInput, { command: 'ls' });
  });

  it('includes session_title from eventData', () => {
    const r = clawdHook.buildStatePayload('Elicitation', { session_id: 's', conversation_title: 'My Session' });
    assert.strictEqual(r.session.title, 'My Session');
  });
});

// ─── Transcript analysis tests ────────────────────────────────────────────

describe('readTranscriptTail', () => {
  it('returns parsed entries from JSONL file', () => {
    const { dir, file } = writeTmpJsonl([
      { type: 'user', content: 'hi' },
      { type: 'assistant', content: 'hello' },
    ]);
    try {
      const entries = clawdHook.readTranscriptTail(file);
      assert.strictEqual(entries.length, 2);
      assert.strictEqual(entries[0].type, 'user');
      assert.strictEqual(entries[1].type, 'assistant');
    } finally { cleanupTmp(dir); }
  });

  it('returns null for non-existent file', () => {
    assert.strictEqual(clawdHook.readTranscriptTail('/nonexistent/file.jsonl'), null);
  });

  it('returns null for null/undefined path', () => {
    assert.strictEqual(clawdHook.readTranscriptTail(null), null);
    assert.strictEqual(clawdHook.readTranscriptTail(undefined), null);
  });

  it('skips malformed JSON lines', () => {
    const { dir, file } = (() => {
      const d = fs.mkdtempSync(path.join(os.tmpdir(), 'clawd-hook-test-'));
      const f = path.join(d, 'transcript.jsonl');
      fs.writeFileSync(f, '{"valid": true}\n{invalid}\n{"valid": false}\n');
      return { dir: d, file: f };
    })();
    try {
      const entries = clawdHook.readTranscriptTail(file);
      assert.strictEqual(entries.length, 2);
    } finally { cleanupTmp(dir); }
  });
});

describe('extractApiError', () => {
  it('returns null when no API error in entries', () => {
    const entries = [{ type: 'user' }, { type: 'assistant' }];
    assert.strictEqual(clawdHook.extractApiError(entries, 's1'), null);
  });

  it('returns null when API error is followed by user input', () => {
    const entries = [
      { isApiErrorMessage: true, sessionId: 's1', error: 'rate_limit' },
      { type: 'user', content: 'hello' },
    ];
    assert.strictEqual(clawdHook.extractApiError(entries, 's1'), null);
  });

  it('returns apiError when API error is the latest entry', () => {
    const entries = [
      { type: 'user', content: 'hi' },
      { isApiErrorMessage: true, sessionId: 's1', error: 'rate_limit' },
    ];
    const result = clawdHook.extractApiError(entries, 's1');
    assert.deepStrictEqual(result, { failureKind: 'api_error', apiErrorType: 'rate_limit' });
  });

  it('uses "unknown" for unrecognized error types', () => {
    const entries = [
      { isApiErrorMessage: true, sessionId: 's1', error: 'weird_new_error' },
    ];
    const result = clawdHook.extractApiError(entries, 's1');
    assert.strictEqual(result.apiErrorType, 'unknown');
  });
});

describe('extractSessionTitle', () => {
  it('extracts title from custom-title entries', () => {
    const entries = [{ type: 'custom-title', customTitle: 'My Project' }];
    assert.strictEqual(clawdHook.extractSessionTitle(entries), 'My Project');
  });

  it('returns null when no title entries', () => {
    assert.strictEqual(clawdHook.extractSessionTitle([{ type: 'user' }]), null);
  });

  it('returns null for null input', () => {
    assert.strictEqual(clawdHook.extractSessionTitle(null), null);
  });
});

// ─── Permission handling tests ────────────────────────────────────────────

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

  it('includes device info in POST payload', async () => {
    const server = await startMockServer((req, res) => {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        const parsed = JSON.parse(body);
        assert.ok(parsed.device, 'device field missing');
        assert.ok(parsed.device.id, 'device.id missing');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ approved: true, permissionId: 'p6' }));
      });
    });
    const result = await clawdHook.handlePermission({ permission_id: 'p6' }, server.address().port);
    server.close();
    assert.strictEqual(result, 'allow');
  });
});
