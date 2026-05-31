const { describe, it, before, after, mock } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

// We import the module but temporarily replace http.request and fs
// to avoid actually hitting the network.
const serverConfig = require('./server-config');

describe('readPersistedPort', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-test-'));
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns null when port.json does not exist', () => {
    const result = serverConfig.readPersistedPort(tmpDir);
    assert.strictEqual(result, null);
  });

  it('returns the port when port.json contains a valid port', () => {
    fs.writeFileSync(path.join(tmpDir, 'port.json'), JSON.stringify({ port: 23555 }));
    const result = serverConfig.readPersistedPort(tmpDir);
    assert.strictEqual(result, 23555);
  });

  it('returns null for invalid port values', () => {
    fs.writeFileSync(path.join(tmpDir, 'port.json'), JSON.stringify({ port: -1 }));
    assert.strictEqual(serverConfig.readPersistedPort(tmpDir), null);
    fs.writeFileSync(path.join(tmpDir, 'port.json'), JSON.stringify({ port: 99999 }));
    assert.strictEqual(serverConfig.readPersistedPort(tmpDir), null);
    fs.writeFileSync(path.join(tmpDir, 'port.json'), JSON.stringify({ port: 'abc' }));
    assert.strictEqual(serverConfig.readPersistedPort(tmpDir), null);
  });

  it('returns null when port.json contains invalid JSON', () => {
    fs.writeFileSync(path.join(tmpDir, 'port.json'), 'not-json');
    const result = serverConfig.readPersistedPort(tmpDir);
    assert.strictEqual(result, null);
  });
});

describe('probePort', () => {
  it('returns false for an unreachable port (no server)', async () => {
    // Use a port that is very unlikely to be in use
    const result = await serverConfig.probePort(51999);
    assert.strictEqual(result, false);
  });

  it('does not throw for any port number', async () => {
    // Should handle any port gracefully
    const result = await serverConfig.probePort(0);
    assert.strictEqual(result, false);
  });
});

describe('discoverBridgePort', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-test-'));
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns null when Bridge is not running and no persisted port', async () => {
    const result = await serverConfig.discoverBridgePort(tmpDir);
    assert.strictEqual(result, null);
  });

  it('returns persisted port when port.json exists (no actual Bridge needed)', async () => {
    fs.writeFileSync(path.join(tmpDir, 'port.json'), JSON.stringify({ port: 23557 }));
    const result = await serverConfig.discoverBridgePort(tmpDir);
    assert.strictEqual(result, 23557);
  });
});
