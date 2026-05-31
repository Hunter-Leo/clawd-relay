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
const fs = require('fs');
const path = require('path');
const os = require('os');
const { discoverBridgePort } = require('./server-config');

const BRIDGE_DATA_DIR = path.join(os.homedir(), '.clawd-relay');
const PERMISSION_TIMEOUT_MS = 300_000;
const MAX_BODY_BYTES = 4096;
const TRANSCRIPT_TAIL_BYTES = 262144; // 256 KB

/** Map of CC hook event names -> relay session state. */
const EVENT_TO_STATE = {
  SessionStart: 'idle',
  SessionEnd: 'sleeping',
  UserPromptSubmit: 'thinking',
  PreToolUse: 'working',
  PostToolUse: 'working',
  PostToolUseFailure: 'error',
  Stop: 'attention',
  StopFailure: 'error',
  ApiError: 'error',
  SubagentStart: 'thinking',
  SubagentStop: 'working',
  PreCompact: 'working',
  PostCompact: 'attention',
  Notification: 'notification',
  Elicitation: 'thinking',
  WorktreeCreate: 'working',
};

const API_ERROR_TYPES = new Set([
  'authentication_failed', 'billing_error', 'rate_limit',
  'invalid_request', 'model_not_found', 'server_error',
  'unknown', 'max_output_tokens',
]);

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

/**
 * Read tail of CC transcript JSONL file and return parsed entries.
 * Returns null on any error (file missing, IO error, etc).
 */
function readTranscriptTail(transcriptPath) {
  if (typeof transcriptPath !== 'string' || !transcriptPath) return null;
  try {
    var stat = fs.statSync(transcriptPath);
    var readLen = Math.min(stat.size, TRANSCRIPT_TAIL_BYTES);
    var fd = fs.openSync(transcriptPath, 'r');
    var buf = Buffer.alloc(readLen);
    fs.readSync(fd, buf, 0, readLen, Math.max(0, stat.size - readLen));
    fs.closeSync(fd);
    var data = buf.toString('utf8');
    var truncated = stat.size > readLen;
    var lines = data.split('\n');
    if (truncated && lines.length > 1) lines.shift();
    var entries = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      try { entries.push(JSON.parse(line)); } catch (e) { /* skip malformed */ }
    }
    return entries;
  } catch (e) { return null; }
}

/**
 * Find the most recent API error in transcript entries for current session.
 * Only returns error if no later "user" or non-error "assistant" entry exists
 * (meaning the turn hasn't moved on).
 */
function extractApiError(entries, sessionId) {
  if (!entries || !sessionId) return null;
  var lastErrorIndex = -1;
  for (var i = entries.length - 1; i >= 0; i--) {
    var e = entries[i];
    if (e.isApiErrorMessage !== true) continue;
    if (e.sessionId !== sessionId) continue;
    lastErrorIndex = i;
    break;
  }
  if (lastErrorIndex < 0) return null;
  for (var j = lastErrorIndex + 1; j < entries.length; j++) {
    var t = entries[j];
    var type = (typeof t.type === 'string') ? t.type : '';
    if (type === 'user') return null;
    if (type === 'assistant' && t.isApiErrorMessage !== true) return null;
  }
  var rawType = entries[lastErrorIndex].error;
  var apiErrorType = API_ERROR_TYPES.has(rawType) ? rawType : 'unknown';
  return { failureKind: 'api_error', apiErrorType: apiErrorType };
}

function extractSessionTitle(entries) {
  if (!entries) return null;
  var latest = null;
  for (var i = 0; i < entries.length; i++) {
    var obj = entries[i];
    var type = (typeof obj.type === 'string') ? obj.type : '';
    if (type !== 'custom-title' && type !== 'agent-name') continue;
    latest = sanitize(obj.customTitle || obj.title || obj.custom_title || obj.agentName || obj.agent_name || '', 80)
      || latest;
  }
  return latest;
}

function buildStatePayload(eventType, eventData) {
  var state = EVENT_TO_STATE[eventType] || 'idle';
  var sessionId = sanitize(eventData.session_id || eventData.sessionId || '', 64);
  var host = sanitize(eventData.host || os.hostname(), 64);
  var toolUseId = sanitize(eventData.tool_use_id || eventData.toolUseId || '', 64) || null;
  var toolName = extractToolName(eventData);

  // Transcript analysis for API error detection + session title
  var transcriptEntries = null;
  try { transcriptEntries = readTranscriptTail(eventData.transcript_path); } catch (e) { /* skip */ }

  // ApiError is synthetic — upgrade Stop to ApiError when transcript shows an API error
  var extra = {};
  if (eventType === 'Stop') {
    var apiError = extractApiError(transcriptEntries, sessionId);
    if (apiError) {
      state = 'error';
      extra.failureKind = apiError.failureKind;
      extra.apiErrorType = apiError.apiErrorType;
    }
  }

  // Session title: try eventData first, then transcript
  var sessionTitle = sanitize(eventData.session_title || eventData.conversation_title || eventData.conversationTitle || '', 80);
  if (!sessionTitle && transcriptEntries) {
    try { sessionTitle = extractSessionTitle(transcriptEntries) || null; } catch (e) { /* skip */ }
  }

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
      title: sessionTitle || null,
      cwd: sanitize(eventData.cwd || '', 256) || null,
      model: sanitize(eventData.model || '', 40) || null,
      toolName: toolName || null,
      toolUseId: toolUseId,
      toolInput: Object.keys(extractToolInput(eventData)).length > 0 ? extractToolInput(eventData) : null,
      updatedAt: Date.now(),
      ...extra,
    },
  };
}

async function handlePermission(eventData, port) {
  const permissionId = sanitize(
    eventData.permission_id || eventData.permissionId || '',
    64,
  );
  const host = sanitize(eventData.host || os.hostname(), 64);

  const payload = {
    type: 'permission_request',
    device: {
      id: host ? 'host-' + host : 'unknown',
      host: host,
      platform: process.platform === 'darwin' ? 'darwin' : process.platform === 'win32' ? 'win32' : 'linux',
      bridgeVersion: '0.1.0',
    },
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
  readTranscriptTail: readTranscriptTail,
  extractApiError: extractApiError,
  extractSessionTitle: extractSessionTitle,
};
