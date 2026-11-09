import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const runner = fileURLToPath(
  new URL('../node_modules/vitest/vitest.mjs', import.meta.url)
);

const child = spawn(
  process.execPath,
  [runner, 'run', ...process.argv.slice(2)],
  { stdio: 'inherit' }
);

let timedOut = false;
let forceKill;

const stop = () => {
  child.kill('SIGTERM');
  forceKill = setTimeout(() => child.kill('SIGKILL'), 5000);
  forceKill.unref();
};

const deadline = setTimeout(
  () => {
    timedOut = true;
    console.error('Integration test run exceeded its 15 minute limit.');
    stop();
  },
  15 * 60 * 1000
);

process.once('SIGINT', stop);

process.once('SIGTERM', stop);

child.once('error', (error) => {
  clearTimeout(deadline);
  console.error(error.message);
  process.exitCode = 1;
});

child.once('exit', (code) => {
  clearTimeout(deadline);
  clearTimeout(forceKill);
  process.exitCode = timedOut ? 124 : (code ?? 1);
});
