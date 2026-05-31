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
const PERMISSION_TIMEOUT_MS = 300_000;
const MAX_BODY_BYTES = 4096;

/** Map of current CC hook event names -> relay state. */
const SESSION_STATES = {
  Elicitation: 'thinking',
  Notification: 'notification',
  PostToolUse: 'working',
};

const AGENT_TYPE = 'claude-code';
const BRIDGE_HOST = '127.0.0.1';

function sanitize(str, maxChars) {
  if (typeof str !== 'string') return '';
  return str.replace(/[\x00-\x1f]/g, '').slice(0, maxChars);
}

function extractTitle(eventType, eventData) {
  if (eventType === 'Elicitation') {
    return sanitize(eventData.conversation_title || eventData.conversationTitle || '', 80);
  }
  if (eventType === 'PostToolUse') {
    const toolInput = eventData.toolInput || eventData.tool_input || {};
    if (typeof toolInput === 'object') {
      return sanitize(JSON.stringify(toolInput), 80);
    }
    return sanitize(String(toolInput), 80);
  }
  return '';
}

function extractToolName(eventData) {
  return sanitize(eventData.toolName || eventData.tool_name || '', 60);
}

function extractToolInput(eventData) {
  const raw = eventData.toolInput || eventData.tool_input || {};
  if (typeof raw === 'object' && raw !== null) {
    if (raw.command && typeof raw.command === 'string' && raw.command.length > 500) {
      return { ...raw, command: raw.command.slice(0, 500) + '...' };
    }
    return raw;
  }
  return {};
}

function buildStatePayload(eventType, eventData) {
  var state = SESSION_STATES[eventType] || 'idle';
  var sessionId = sanitize(eventData.session_id || eventData.sessionId || '', 64);
  var host = sanitize(eventData.host || require('os').hostname(), 64);
  return {
    type: 'session_state',
    device: {
      id: host ? 'host-' + host : 'unknown',
      host: host,
      platform: process.platform === 'darwin' ? 'darwin' : process.platform === 'win32' ? 'win32' : 'linux',
      bridgeVersion: '0.1.0',
    },
    session: {
      id: sessionId,
      agentId: AGENT_TYPE,
      state: state,
      title: extractTitle(eventType, eventData) || null,
      cwd: sanitize(eventData.cwd || '', 256) || null,
      model: sanitize(eventData.model || '', 40) || null,
      toolName: extractToolName(eventData) || null,
      toolInput: Object.keys(extractToolInput(eventData)).length > 0 ? extractToolInput(eventData) : null,
      updatedAt: Date.now(),
    },
  };
}

async function handlePermission(eventData, port) {
  const permissionId = sanitize(
    eventData.permission_id || eventData.permissionId || '',
    64,
  );

  const payload = {
    type: 'permission_request',
    permission_id: permissionId,
    tool_name: sanitize(
      eventData.tool_name || eventData.toolName || '',
      60,
    ),
    tool_input: extractToolInput(eventData),
    description: sanitize(
      eventData.description || eventData.input || '',
      500,
    ),
  };

  const body = JSON.stringify(payload);

  const response = await new Promise((resolve) => {
    const options = {
      hostname: BRIDGE_HOST,
      port: port,
      path: '/permission',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: PERMISSION_TIMEOUT_MS,
    };

    const req = http.request(options, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        resolve({ statusCode: res.statusCode, body: data });
      });
    });

    req.on('error', function() { resolve(null); });
    req.on('timeout', function() {
      req.destroy();
      resolve(null);
    });

    req.write(body);
    req.end();
  });

  if (response === null) return null;
  if (response.statusCode === 204) return null;
  if (response.statusCode === 408) return null;

  if (response.statusCode === 200) {
    try {
      var parsed = JSON.parse(response.body);
      return parsed.approved === true ? 'allow' : 'deny';
    } catch (e) { return null; }
  }

  return null;
}

function sendState(payload, port) {
  return new Promise(function(resolve) {
    var body = JSON.stringify(payload);
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
      resolve();
      return;
    }

    var options = {
      hostname: BRIDGE_HOST,
      port: port,
      path: '/state',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 5000,
    };

    var req = http.request(options, function(res) {
      res.resume();
      resolve();
    });
    req.on('error', function() { resolve(); });
    req.on('timeout', function() {
      req.destroy();
      resolve();
    });
    req.write(body);
    req.end();
  });
}

async function main() {
  var eventType = process.argv[2];
  if (!eventType) return;

  var chunks = [];
  for await (var chunk of process.stdin) {
    chunks.push(chunk);
  }
  var raw = Buffer.concat(chunks).toString('utf-8').trim();
  if (!raw) return;

  var eventData;
  try { eventData = JSON.parse(raw); }
  catch (e) { return; }

  var port = await discoverBridgePort(BRIDGE_DATA_DIR);
  if (port === null) return;

  if (eventType === 'permission_ask') {
    var decision = await handlePermission(eventData, port);
    if (decision) process.stdout.write(decision);
    return;
  }

  var payload = buildStatePayload(eventType, eventData);
  await sendState(payload, port);
}

if (require.main === module) {
  main().catch(function() {});
}

module.exports = {
  sanitize: sanitize,
  extractTitle: extractTitle,
  extractToolName: extractToolName,
  extractToolInput: extractToolInput,
  buildStatePayload: buildStatePayload,
  handlePermission: handlePermission,
  sendState: sendState,
};
