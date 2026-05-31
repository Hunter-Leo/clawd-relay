/**
 * Tests for install.js hook registration and unregistration.
 *
 * Uses a temporary settings.json to avoid touching the real ~/.claude.
 * Follows clawd-on-desk pattern: inject settingsPath via options.
 *
 * @module install-test
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const install = require('./install');

const MARKER = 'clawd-relay-hook';
const HOOK_EVENTS = [
  'SessionStart', 'SessionEnd', 'UserPromptSubmit',
  'PreToolUse', 'PostToolUse', 'Stop',
];

describe('buildCommand', () => {
  it('includes the marker string', () => {
    const cmd = install.buildCommand('/usr/bin/node', '/hooks/clawd-hook.js', 'Stop');
    assert.ok(cmd.includes(MARKER));
    assert.ok(cmd.includes('/usr/bin/node'));
    assert.ok(cmd.includes('Stop'));
  });
});

describe('isOurHook', () => {
  it('returns true for commands with marker', () => {
    assert.strictEqual(install.isOurHook(`node "hook.js" Stop # ${MARKER}`), true);
  });

  it('returns false for commands without marker', () => {
    assert.strictEqual(install.isOurHook('node "other-hook.js" Stop'), false);
  });

  it('returns false for non-string input', () => {
    assert.strictEqual(install.isOurHook(null), false);
    assert.strictEqual(install.isOurHook(undefined), false);
  });
});

describe('registerHooks', () => {
  let tmpDir;
  let settingsPath;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'install-test-'));
    settingsPath = path.join(tmpDir, 'settings.json');
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates settings.json when it does not exist', () => {
    const result = install.registerHooks({
      settingsPath,
      nodeBin: '/usr/bin/node',
      hookScriptPath: '/hooks/clawd-hook.js',
    });

    assert.ok(fs.existsSync(settingsPath));
    assert.strictEqual(result.added, HOOK_EVENTS.length);
    assert.strictEqual(result.removed, 0);
  });

  it('registers all hook events', () => {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    assert.ok(settings.hooks);

    for (const event of HOOK_EVENTS) {
      assert.ok(Array.isArray(settings.hooks[event]), `Missing hook: ${event}`);
      assert.ok(settings.hooks[event].length > 0, `Empty hook: ${event}`);
      assert.ok(
        settings.hooks[event].some((entry) => entry.includes(MARKER)),
        `Missing marker in ${event}`,
      );
    }
  });

  it('is idempotent — running twice does not duplicate entries', () => {
    const result = install.registerHooks({
      settingsPath,
      nodeBin: '/usr/bin/node',
      hookScriptPath: '/hooks/clawd-hook.js',
    });

    assert.strictEqual(result.added, HOOK_EVENTS.length);
    assert.strictEqual(result.removed, HOOK_EVENTS.length); // removed stale then re-added

    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    for (const event of HOOK_EVENTS) {
      const entries = settings.hooks[event];
      const ourCount = entries.filter((e) => e.includes(MARKER)).length;
      assert.strictEqual(ourCount, 1, `Duplicate entries in ${event}`);
    }
  });

  it('preserves existing non-our hooks', () => {
    // Pre-populate with a third-party hook entry
    fs.writeFileSync(settingsPath, JSON.stringify({
      hooks: {
        PreToolUse: ['node "third-party.js" PreToolUse'],
      },
    }) + '\n');

    const result = install.registerHooks({
      settingsPath,
      nodeBin: '/usr/bin/node',
      hookScriptPath: '/hooks/clawd-hook.js',
    });

    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    const preToolUse = settings.hooks.PreToolUse;
    assert.ok(preToolUse.some((e) => e.includes('third-party')), 'Third-party hook lost');
    assert.ok(preToolUse.some((e) => e.includes(MARKER)), 'Our hook missing');
  });
});

describe('unregisterHooks', () => {
  let tmpDir;
  let settingsPath;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uninstall-test-'));
    settingsPath = path.join(tmpDir, 'settings.json');

    // Pre-register hooks first
    install.registerHooks({
      settingsPath,
      nodeBin: '/usr/bin/node',
      hookScriptPath: '/hooks/clawd-hook.js',
    });
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('removes all our hooks', () => {
    const result = install.unregisterHooks({ settingsPath });
    assert.strictEqual(result.removed, HOOK_EVENTS.length);

    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    for (const event of HOOK_EVENTS) {
      assert.strictEqual(
        settings.hooks[event] === undefined ||
        !settings.hooks[event].some((e) => e.includes(MARKER)),
        true,
        `Marker still present in ${event}`,
      );
    }
  });

  it('is idempotent — running twice returns 0 removed', () => {
    const result = install.unregisterHooks({ settingsPath });
    assert.strictEqual(result.removed, 0);
  });

  it('returns 0 removed when settings.json does not exist', () => {
    const result = install.unregisterHooks({
      settingsPath: path.join(tmpDir, 'nonexistent.json'),
    });
    assert.strictEqual(result.removed, 0);
  });

  it('preserves third-party hooks when uninstalling', () => {
    fs.writeFileSync(settingsPath, JSON.stringify({
      hooks: {
        PreToolUse: [
          'node "third-party.js" PreToolUse',
          `node "hook.js" PreToolUse # ${MARKER}`,
        ],
      },
    }) + '\n');

    install.unregisterHooks({ settingsPath });

    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    const entries = settings.hooks.PreToolUse;
    assert.strictEqual(entries.length, 1);
    assert.ok(entries[0].includes('third-party'));
    assert.ok(!entries[0].includes(MARKER));
  });
});
