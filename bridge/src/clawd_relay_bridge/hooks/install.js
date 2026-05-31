#!/usr/bin/env node
/**
 * Hook installer -- register/unregister clawd-hook.js in ~/.claude/settings.json.
 *
 * Uses the current Claude Code hook format:
 *   "hooks": { "EventName": [{ "matcher": "", "hooks": [{ type, command, timeout, async }] }] }
 *
 * Preserves non-our hooks (e.g. clawd-on-desk). Identifies our entries
 * via a MARKER comment in the command string.
 *
 * Usage:
 *   node install.js              # install hooks
 *   node install.js --uninstall  # remove hooks
 */
var fs = require('fs');
var path = require('path');

var MARKER = 'clawd-relay-hook';
var CLAUDE_SETTINGS_PATH = path.join(
  require('os').homedir(),
  '.claude',
  'settings.json',
);
var HOOK_EVENTS = [
  'SessionStart', 'SessionEnd', 'UserPromptSubmit',
  'PreToolUse', 'PostToolUse', 'PostToolUseFailure',
  'Stop', 'StopFailure',
  'SubagentStart', 'SubagentStop',
  'PreCompact', 'PostCompact',
  'Notification', 'Elicitation',
  'WorktreeCreate', 'permission_ask',
];

function buildEntry(nodeBin, hookScript, event) {
  var cmd = nodeBin + ' "' + hookScript + '" ' + event + ' # ' + MARKER;
  // permission_ask is blocking — CC waits for stdout "allow"/"deny" decision
  if (event === 'permission_ask') {
    return { type: 'command', command: cmd, timeout: 300, async: false };
  }
  return { type: 'command', command: cmd, timeout: 5, async: true };
}

function isOurs(entry) {
  if (!entry || typeof entry !== 'object') return false;
  var c = entry.command;
  return typeof c === 'string' && c.indexOf(MARKER) !== -1;
}

function registerHooks(opts) {
  opts = opts || {};
  var sp = opts.settingsPath || CLAUDE_SETTINGS_PATH;
  var nb = opts.nodeBin || process.execPath;
  var hs = opts.hookScriptPath || path.resolve(__dirname, 'clawd-hook.js');

  var settings = {};
  try {
    settings = JSON.parse(fs.readFileSync(sp, 'utf-8'));
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  if (!settings.hooks) settings.hooks = {};

  var added = 0, removed = 0;

  // Remove stale entries
  Object.keys(settings.hooks).forEach(function(ev) {
    var groups = settings.hooks[ev];
    if (!Array.isArray(groups)) return;
    var kept = groups.filter(function(g) {
      if (!g || typeof g !== 'object') return false;
      var arr = g.hooks;
      if (!Array.isArray(arr)) return true;
      var filtered = arr.filter(function(h) { return !isOurs(h); });
      if (filtered.length !== arr.length) {
        removed += arr.length - filtered.length;
        g.hooks = filtered;
        return filtered.length > 0;
      }
      return true;
    });
    settings.hooks[ev] = kept.filter(function(g) {
      return Array.isArray(g.hooks) && g.hooks.length > 0;
    });
    if (settings.hooks[ev].length === 0) delete settings.hooks[ev];
  });

  // Add our hooks
  HOOK_EVENTS.forEach(function(ev) {
    if (!Array.isArray(settings.hooks[ev])) settings.hooks[ev] = [];
    settings.hooks[ev].push({ matcher: '', hooks: [buildEntry(nb, hs, ev)] });
    added++;
  });

  var dir = path.dirname(sp);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  var tmp = sp + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(settings, null, 2) + '\n');
  fs.renameSync(tmp, sp);

  return { added: added, removed: removed };
}

function unregisterHooks(opts) {
  opts = opts || {};
  var sp = opts.settingsPath || CLAUDE_SETTINGS_PATH;
  var settings;
  try { settings = JSON.parse(fs.readFileSync(sp, 'utf-8')); }
  catch (e) { return { removed: 0 }; }
  if (!settings.hooks) return { removed: 0 };

  var removed = 0;
  Object.keys(settings.hooks).forEach(function(ev) {
    var groups = settings.hooks[ev];
    if (!Array.isArray(groups)) return;
    var kept = groups.filter(function(g) {
      if (!g || typeof g !== 'object') return false;
      var arr = g.hooks;
      if (!Array.isArray(arr)) return true;
      var filtered = arr.filter(function(h) { return !isOurs(h); });
      if (filtered.length !== arr.length) {
        removed += arr.length - filtered.length;
        g.hooks = filtered;
        return filtered.length > 0;
      }
      return true;
    });
    settings.hooks[ev] = kept.filter(function(g) {
      return Array.isArray(g.hooks) && g.hooks.length > 0;
    });
    if (settings.hooks[ev].length === 0) delete settings.hooks[ev];
  });

  fs.writeFileSync(sp, JSON.stringify(settings, null, 2) + '\n');
  return { removed: removed };
}

if (require.main === module) {
  var un = process.argv.indexOf('--uninstall') !== -1;
  try {
    if (un) {
      var r = unregisterHooks();
      console.log('Clawd Relay hooks uninstalled (' + r.removed + ' entries removed).');
    } else {
      var r2 = registerHooks();
      console.log('Clawd Relay hooks installed (' + r2.added + ' added, ' + r2.removed + ' stale removed).');
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

module.exports = { registerHooks: registerHooks, unregisterHooks: unregisterHooks, buildEntry: buildEntry, isOurs: isOurs };
