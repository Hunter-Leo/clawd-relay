/**
 * Tests for install.js hook registration and unregistration.
 *
 * Uses a temporary settings.json to avoid touching the real ~/.claude.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const install = require('./install');

const MARKER = 'clawd-relay-hook';
const EVENTS = ['Elicitation', 'Notification', 'PostToolUse'];

describe('buildEntry', () => {
  it('includes the marker string', () => {
    const entry = install.buildEntry('/usr/bin/node', '/hooks/clawd-hook.js', 'PostToolUse');
    assert.ok(entry.command.includes(MARKER));
    assert.ok(entry.command.includes('/usr/bin/node'));
    assert.ok(entry.command.includes('PostToolUse'));
    assert.strictEqual(entry.type, 'command');
    assert.strictEqual(entry.timeout, 5);
    assert.strictEqual(entry.async, true);
  });
});

describe('isOurs', () => {
  it('returns true for entries with marker', () => {
    assert.strictEqual(install.isOurs({ command: 'node "hook.js" PostToolUse # ' + MARKER }), true);
  });

  it('returns false for entries without marker', () => {
    assert.strictEqual(install.isOurs({ command: 'node "other-hook.js" PostToolUse' }), false);
  });

  it('returns false for non-object input', () => {
    assert.strictEqual(install.isOurs(null), false);
    assert.strictEqual(install.isOurs(undefined), false);
    assert.strictEqual(install.isOurs(42), false);
  });
});

describe('registerHooks', () => {
  let tmpDir, sp;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'install-test-'));
    sp = path.join(tmpDir, 'settings.json');
  });

  after(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('creates settings.json when it does not exist', () => {
    var result = install.registerHooks({ settingsPath: sp, nodeBin: '/usr/bin/node', hookScriptPath: '/hooks/clawd-hook.js' });
    assert.ok(fs.existsSync(sp));
    assert.strictEqual(result.added, EVENTS.length);
    assert.strictEqual(result.removed, 0);
  });

  it('registers all hook events in the new format', () => {
    var settings = JSON.parse(fs.readFileSync(sp, 'utf-8'));
    assert.ok(settings.hooks);
    for (var ev of EVENTS) {
      assert.ok(Array.isArray(settings.hooks[ev]), 'Missing: ' + ev);
      assert.ok(settings.hooks[ev].length > 0, 'Empty: ' + ev);
      // Each group has matcher + hooks array
      var group = settings.hooks[ev][0];
      assert.ok(group.matcher === '', 'matcher missing in ' + ev);
      assert.ok(Array.isArray(group.hooks), 'hooks array missing in ' + ev);
      assert.ok(group.hooks.some(function(e) { return e.command.indexOf(MARKER) !== -1; }), 'marker missing in ' + ev);
    }
  });

  it('is idempotent — running twice does not duplicate entries', () => {
    var result = install.registerHooks({ settingsPath: sp, nodeBin: '/usr/bin/node', hookScriptPath: '/hooks/clawd-hook.js' });
    assert.strictEqual(result.added, EVENTS.length);
    assert.strictEqual(result.removed, EVENTS.length);

    var settings = JSON.parse(fs.readFileSync(sp, 'utf-8'));
    for (var ev of EVENTS) {
      var matches = 0;
      var groups = settings.hooks[ev];
      for (var g of groups) {
        for (var h of g.hooks) {
          if (h.command.indexOf(MARKER) !== -1) matches++;
        }
      }
      assert.strictEqual(matches, 1, 'Duplicate entries in ' + ev);
    }
  });

  it('preserves existing non-our hooks', () => {
    fs.writeFileSync(sp, JSON.stringify({
      hooks: {
        PostToolUse: [
          { matcher: '', hooks: [{ type: 'command', command: 'node "third-party.js" PostToolUse', timeout: 5, async: true }] },
        ],
      },
    }) + '\n');

    install.registerHooks({ settingsPath: sp, nodeBin: '/usr/bin/node', hookScriptPath: '/hooks/clawd-hook.js' });

    var settings = JSON.parse(fs.readFileSync(sp, 'utf-8'));
    var groups = settings.hooks.PostToolUse;
    assert.ok(groups.some(function(g) {
      return g.hooks.some(function(h) { return h.command.indexOf('third-party') !== -1; });
    }), 'Third-party hook lost');
    assert.ok(groups.some(function(g) {
      return g.hooks.some(function(h) { return h.command.indexOf(MARKER) !== -1; });
    }), 'Our hook missing');
  });
});

describe('unregisterHooks', () => {
  var tmpDir, sp;

  before(function() {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uninstall-test-'));
    sp = path.join(tmpDir, 'settings.json');
    install.registerHooks({ settingsPath: sp, nodeBin: '/usr/bin/node', hookScriptPath: '/hooks/clawd-hook.js' });
  });

  after(function() { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('removes all our hooks', function() {
    var result = install.unregisterHooks({ settingsPath: sp });
    assert.strictEqual(result.removed, EVENTS.length);

    var settings = JSON.parse(fs.readFileSync(sp, 'utf-8'));
    for (var ev of EVENTS) {
      var groups = settings.hooks[ev] || [];
      var marked = 0;
      for (var g of groups) {
        for (var h of g.hooks) {
          if (h.command.indexOf(MARKER) !== -1) marked++;
        }
      }
      assert.strictEqual(marked, 0, 'Marker still present in ' + ev);
    }
  });

  it('is idempotent — running twice returns 0 removed', function() {
    var result = install.unregisterHooks({ settingsPath: sp });
    assert.strictEqual(result.removed, 0);
  });

  it('returns 0 removed when settings.json does not exist', function() {
    var result = install.unregisterHooks({ settingsPath: path.join(tmpDir, 'nonexistent.json') });
    assert.strictEqual(result.removed, 0);
  });

  it('preserves third-party hooks when uninstalling', function() {
    fs.writeFileSync(sp, JSON.stringify({
      hooks: {
        PostToolUse: [
          { matcher: '', hooks: [
            { type: 'command', command: 'node "third-party.js" PostToolUse', timeout: 5, async: true },
            { type: 'command', command: 'node "hook.js" PostToolUse # ' + MARKER, timeout: 5, async: true },
          ]},
        ],
      },
    }) + '\n');

    install.unregisterHooks({ settingsPath: sp });
    var settings = JSON.parse(fs.readFileSync(sp, 'utf-8'));
    var hooks = settings.hooks.PostToolUse[0].hooks;
    assert.strictEqual(hooks.length, 1);
    assert.ok(hooks[0].command.indexOf('third-party') !== -1);
    assert.ok(hooks[0].command.indexOf(MARKER) === -1);
  });
});
