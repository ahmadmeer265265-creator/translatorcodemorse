/**
 * Orchestrates the fake-mic e2e: serve dist/, run mic-decoder.spec.mjs fixtures.
 * Prefer: npm run test:mic-e2e (generates fixtures + builds first).
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import http from 'node:http';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.PLAYWRIGHT_BROWSERS_PATH ??= 'D:\\pw-browsers';

const PORT = Number(process.env.PORT || 4173);
const baseURL = `http://127.0.0.1:${PORT}`;

function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) reject(new Error(`Server not ready: ${url}`));
        else setTimeout(tryOnce, 200);
      });
    };
    tryOnce();
  });
}

const server = spawn(process.execPath, [path.join(root, 'scripts', 'serve-dist.mjs')], {
  cwd: root,
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let serverLog = '';
server.stdout.on('data', (d) => {
  serverLog += d.toString();
  process.stdout.write(d);
});
server.stderr.on('data', (d) => {
  serverLog += d.toString();
  process.stderr.write(d);
});

const killServer = () => {
  try {
    server.kill('SIGTERM');
  } catch {
    // ignore
  }
};
process.on('exit', killServer);
process.on('SIGINT', () => {
  killServer();
  process.exit(130);
});

try {
  await waitForServer(baseURL + '/');
  const { runMicDecoderE2E } = await import(
    pathToFileURL(path.join(root, 'tests', 'e2e', 'mic-decoder.spec.mjs')).href
  );
  const { ok, results } = await runMicDecoderE2E(baseURL);
  console.log('\n--- mic e2e summary ---');
  for (const r of results) {
    console.log(
      `${r.pass ? 'PASS' : 'FAIL'}  expected=${JSON.stringify(r.expected)}  actual=${JSON.stringify(r.actual)}${r.error ? `  error=${r.error}` : ''}`,
    );
  }
  killServer();
  process.exit(ok ? 0 : 1);
} catch (err) {
  console.error('mic e2e failed to run:', err);
  console.error('server log:\n', serverLog);
  killServer();
  process.exit(1);
}
