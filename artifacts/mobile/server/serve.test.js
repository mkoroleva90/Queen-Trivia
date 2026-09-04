const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const { after, before, test } = require('node:test');

const malformedHosts = ['[', '%', 'evil.com:badport', ':80'];
let child;
let port;

function sendRawRequest(request) {
  return new Promise((resolve, reject) => {
    let response = '';
    const socket = net.createConnection({ host: '127.0.0.1', port }, () => {
      socket.end(request);
    });

    socket.setEncoding('utf8');
    socket.on('data', (chunk) => {
      response += chunk;
    });
    socket.on('end', () => resolve(response));
    socket.on('error', reject);
  });
}

before(async () => {
  child = spawn(process.execPath, ['server/serve.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, BASE_PATH: '/mobile/', PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });

  port = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Server startup timed out: ${stderr}`)), 5000);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      const match = chunk.match(/Serving static Expo build on port (\d+)/);
      if (match) {
        clearTimeout(timeout);
        resolve(Number(match[1]));
      }
    });
    child.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`Server exited during startup with code ${code}: ${stderr}`));
    });
  });
});

after(() => {
  child?.kill();
});

for (const host of malformedHosts) {
  test(`malformed Host ${JSON.stringify(host)} does not terminate the server`, async () => {
    const response = await sendRawRequest(
      `GET /mobile/healthz HTTP/1.1\r\nHost: ${host}\r\nConnection: close\r\n\r\n`,
    );

    assert.match(response, /^HTTP\/1\.1 200 OK\r\n/);
    assert.equal(child.exitCode, null);
  });
}

test('health check remains available after malformed Host requests', async () => {
  const response = await sendRawRequest(
    'GET /mobile/healthz HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n',
  );

  assert.match(response, /^HTTP\/1\.1 200 OK\r\n/);
  assert.match(response, /\{"status":"ok"\}/);
  assert.equal(child.exitCode, null);
});