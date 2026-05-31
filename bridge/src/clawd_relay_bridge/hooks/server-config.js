/**
 * Bridge port discovery utilities.
 *
 * Discovers the running Bridge process port by checking the persisted
 * port.json file first, then probing the default port range. Used by
 * hook scripts to locate the Bridge HTTP endpoint without hardcoded
 * port assumptions.
 *
 * @module server-config
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const DEFAULT_PORTS = [23555, 23556, 23557, 23558, 23559];
const PROBE_TIMEOUT_MS = 200;

/**
 * Probe a single port by sending a POST with `{"_probe": true}` to /state.
 *
 * @param {number} port
 * @returns {Promise<boolean>} true if Bridge responded with 204
 */
function probePort(port) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ _probe: true });
    const options = {
      hostname: '127.0.0.1',
      port,
      path: '/state',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: PROBE_TIMEOUT_MS,
    };

    const req = http.request(options, (res) => {
      res.resume(); // consume to free memory
      resolve(res.statusCode === 204);
    });

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });

    req.write(body);
    req.end();
  });
}

/**
 * Read the Bridge-persisted port from ~/.clawd-relay/port.json.
 *
 * @param {string} dataDir
 * @returns {number|null}
 */
function readPersistedPort(dataDir) {
  try {
    const portPath = path.join(dataDir, 'port.json');
    if (!fs.existsSync(portPath)) return null;
    const raw = fs.readFileSync(portPath, 'utf-8');
    const parsed = JSON.parse(raw);
    const port = parsed?.port;
    return typeof port === 'number' && port > 0 && port < 65536 ? port : null;
  } catch {
    return null;
  }
}

/**
 * Discover the Bridge port — check persisted config first, then probe.
 *
 * @param {string} dataDir
 * @returns {Promise<number|null>}
 */
async function discoverBridgePort(dataDir) {
  const persisted = readPersistedPort(dataDir);
  if (persisted !== null) return persisted;

  for (const port of DEFAULT_PORTS) {
    if (await probePort(port)) return port;
  }

  return null;
}

module.exports = { discoverBridgePort, readPersistedPort, probePort };
