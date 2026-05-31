#!/usr/bin/env node
/**
 * Hook installer — register/unregister clawd-hook.js in ~/.claude/settings.json.
 *
 * Inspired by clawd-on-desk's install.js: same MARKER-based identification,
 * dependency injection via options for testability, and symmetric install
 * and uninstall.
 *
 * Usage:
 *   node install.js           # install hooks
 *   node install.js --uninstall  # remove hooks
 *
 * @module install
 */
const fs = require('fs');
const path = require('path');

const MARKER = 'clawd-relay-hook';
const CLAUDE_SETTINGS_PATH = path.join(
  require('os').homedir(),
  '.claude',
  'settings.json',
);

const HOOK_EVENTS = [
  'SessionStart',
  'SessionEnd',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'Stop',
];

/**
 * Build the command string for a given hook event.
 *
 * @param {string} nodeBin - Absolute path to node binary
 * @param {string} hookScript - Absolute path to clawd-hook.js
 * @param {string} event - Hook event name
 * @returns {string}
 */
function buildCommand(nodeBin, hookScript, event) {
  return `${nodeBin} "${hookScript}" ${event} # ${MARKER}`;
}

/**
 * Check if a command string belongs to our hooks.
 *
 * @param {string} command
 * @returns {boolean}
 */
function isOurHook(command) {
  return typeof command === 'string' && command.includes(MARKER);
}

/**
 * Register hook entries in ~/.claude/settings.json.
 *
 * @param {object} [options]
 * @param {string} [options.settingsPath] — Path to settings.json
 * @param {string} [options.nodeBin] — Absolute node path (default: process.execPath)
 * @param {string} [options.hookScriptPath] — Path to clawd-hook.js
 * @returns {{ added: number, removed: number }}
 */
function registerHooks(options = {}) {
  const settingsPath = options.settingsPath || CLAUDE_SETTINGS_PATH;
  const nodeBin = options.nodeBin || process.execPath;
  const hookScript = options.hookScriptPath ||
    path.resolve(__dirname, 'clawd-hook.js');

  let settings = {};
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw new Error(`Failed to read ${settingsPath}: ${err.message}`);
    }
  }

  if (!settings.hooks) settings.hooks = {};

  let added = 0;
  let removed = 0;

  // First pass: remove any existing entries with our marker (clean slate)
  for (const event of Object.keys(settings.hooks)) {
    const entries = settings.hooks[event];
    if (!Array.isArray(entries)) continue;
    const before = entries.length;
    settings.hooks[event] = entries.filter((entry) => {
      if (typeof entry === 'string') return !isOurHook(entry);
      if (entry && entry.command) return !isOurHook(entry.command);
      return true;
    });
    removed += before - settings.hooks[event].length;
    if (settings.hooks[event].length === 0) {
      delete settings.hooks[event];
    }
  }

  // Second pass: register our hooks
  for (const event of HOOK_EVENTS) {
    if (!Array.isArray(settings.hooks[event])) {
      settings.hooks[event] = [];
    }

    const command = buildCommand(nodeBin, hookScript, event);
    settings.hooks[event].push(command);
    added++;
  }

  // Write back
  const dir = path.dirname(settingsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');

  return { added, removed };
}

/**
 * Unregister our hook entries from ~/.claude/settings.json.
 *
 * @param {object} [options]
 * @param {string} [options.settingsPath]
 * @returns {{ removed: number }}
 */
function unregisterHooks(options = {}) {
  const settingsPath = options.settingsPath || CLAUDE_SETTINGS_PATH;

  let settings;
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
  } catch {
    return { removed: 0 };
  }

  if (!settings.hooks) return { removed: 0 };

  let removed = 0;

  for (const event of Object.keys(settings.hooks)) {
    const entries = settings.hooks[event];
    if (!Array.isArray(entries)) continue;
    const before = entries.length;
    settings.hooks[event] = entries.filter((entry) => {
      if (typeof entry === 'string') return !isOurHook(entry);
      if (entry && entry.command) return !isOurHook(entry.command);
      return true;
    });
    removed += before - settings.hooks[event].length;
    if (settings.hooks[event].length === 0) {
      delete settings.hooks[event];
    }
  }

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  return { removed };
}

// ─── CLI entry ────────────────────────────────────────────────────────────────

if (require.main === module) {
  const isUninstall = process.argv.includes('--uninstall');

  try {
    if (isUninstall) {
      const { removed } = unregisterHooks();
      console.log(`Clawd Relay hooks uninstalled (${removed} entries removed).`);
    } else {
      const { added, removed } = registerHooks();
      console.log(`Clawd Relay hooks installed (${added} added, ${removed} stale removed).`);
    }
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

module.exports = { registerHooks, unregisterHooks, buildCommand, isOurHook };
