/**
 * Claude Code hook script — event collection & forwarding.
 *
 * Processes Claude Code hook events from stdin, maps them to a
 * structured state representation, and POSTs them to the local
 * Bridge HTTP server for relay to the cloud.
 *
 * Usage:
 *   node clawd-hook.js <hook-event-type>
 *
 * Event data is read from stdin as JSON. The hook event type is
 * passed as the first CLI argument by the hook runner config.
 *
 * All errors are silently caught — the hook must never block the
 * Agent even if Bridge is unreachable.
 *
 * @module clawd-hook
 */
const http = require('http');
const { discoverBridgePort } = require('./server-config');

const BRIDGE_DATA_DIR = require('path').join(require('os').homedir(), '.clawd-relay');
const MAX_BODY_BYTES = 4096;
const SESSION_STATES = {
  SessionStart: 'thinking',
  UserPromptSubmit: 'thinking',
  PreToolUse: 'working',
  PostToolUse: 'thinking',
  SessionEnd: 'idle',
  Stop: 'idle',
  error: 'error',
};

const AGENT_TYPE = 'claude-code';
const BRIDGE_HOST = '127.0.0.1';

/**
 * Truncate a string to maxChars, removing control characters.
 *
 * @param {string} str
 * @param {number} maxChars
 * @returns {string}
 */
function sanitize(str, maxChars) {
  if (typeof str !== 'string') return '';
  return str.replace(/[\x00-\x1f]/g, '').slice(0, maxChars);
}

/**
 * Extract title from the hook event. For PreToolUse the first tool's
 * content is used; for UserPromptSubmit the conversation title is used.
 *
 * @param {string} eventType
 * @param {object} eventData - Parsed hook event JSON
 * @returns {string}
 */
function extractTitle(eventType, eventData) {
  if (eventType === 'UserPromptSubmit') {
    return sanitize(eventData.conversation_title || '', 80);
  }
  if (eventType === 'PreToolUse') {
    const toolInput = eventData.toolInput || eventData.tool_input || {};
    if (typeof toolInput === 'object') {
      return sanitize(JSON.stringify(toolInput), 80);
    }
    return sanitize(String(toolInput), 80);
  }
  return '';
}

/**
 * Extract tool name from event data.
 *
 * @param {object} eventData
 * @returns {string}
 */
function extractToolName(eventData) {
  return sanitize(eventData.toolName || eventData.tool_name || '', 60);
}

/**
 * Extract tool input as a string from event data.
 *
 * @param {object} eventData
 * @returns {object}
 */
function extractToolInput(eventData) {
  const raw = eventData.toolInput || eventData.tool_input || {};
  if (typeof raw === 'object' && raw !== null) {
    // Truncate large command inputs
    if (raw.command && typeof raw.command === 'string' && raw.command.length > 500) {
      return { ...raw, command: raw.command.slice(0, 500) + '...' };
    }
    return raw;
  }
  return {};
}

/**
 * Build the state payload from a hook event.
 *
 * @param {string} eventType - Hook event type
 * @param {object} eventData - Parsed JSON from stdin
 * @returns {object} State payload
 */
function buildStatePayload(eventType, eventData) {
  const state = SESSION_STATES[eventType] || 'idle';
  return {
    event: eventType,
    session_id: sanitize(eventData.session_id || eventData.sessionId || '', 64),
    state,
    tool_name: extractToolName(eventData),
    tool_input: extractToolInput(eventData),
    model: sanitize(eventData.model || '', 40),
    title: extractTitle(eventType, eventData),
    host: sanitize(eventData.host || require('os').hostname(), 64),
    cwd: sanitize(eventData.cwd || '', 256),
    agent_id: AGENT_TYPE,
    claude_pid: eventData.claude_pid || null,
  };
}

/**
 * POST a JSON payload to the Bridge /state endpoint.
 *
 * @param {object} payload
 * @param {number} port
 * @returns {Promise<void>}
 */
function sendState(payload, port) {
  return new Promise((resolve) => {
    const body = JSON.stringify(payload);
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
      resolve();
      return;
    }

    const options = {
      hostname: BRIDGE_HOST,
      port,
      path: '/state',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 5000,
    };

    const req = http.request(options, (res) => {
      res.resume();
      resolve();
    });
    req.on('error', () => resolve());
    req.on('timeout', () => {
      req.destroy();
      resolve();
    });
    req.write(body);
    req.end();
  });
}

/**
 * Main entry — parse event from stdin, send to Bridge.
 *
 * @returns {Promise<void>}
 */
async function main() {
  const eventType = process.argv[2];
  if (!eventType) {
    return;
  }

  // Read stdin
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf-8').trim();
  if (!raw) return;

  let eventData;
  try {
    eventData = JSON.parse(raw);
  } catch {
    return; // invalid JSON — silent fail
  }

  // Build the standard state event
  const payload = buildStatePayload(eventType, eventData);

  // Discover Bridge port and send
  const port = await discoverBridgePort(BRIDGE_DATA_DIR);
  if (port === null) {
    // Bridge not running — silently skip
    return;
  }

  await sendState(payload, port);
}

main().catch(() => {
  // Silent fail — hook must never crash the Agent
});
