// src/scripts/audit/run-after-upgrade.js
/**
 * Starts the development server, waits for it to become reachable, then runs the audit script.
 * Useful for verifying the project after dependency upgrades.
 */
const { spawn } = require('child_process');
const axios = require('axios');

function waitForServer(url, retries = 15, delay = 2000) {
  return new Promise((resolve, reject) => {
    let attempt = 0;
    const tryConnect = async () => {
      try {
        await axios.get(url);
        resolve();
      } catch (e) {
        if (attempt++ < retries) setTimeout(tryConnect, delay);
        else reject(new Error('Server not reachable after multiple attempts'));
      }
    };
    tryConnect();
  });
}

(async () => {
  const server = spawn('npm', ['run', 'dev'], { cwd: process.cwd(), stdio: 'inherit', shell: true });
  console.log('Starting dev server...');
  try {
    await waitForServer('http://localhost:3000/health');
    console.log('Server is up – running audit');
    const audit = spawn('npm', ['run', 'audit'], { cwd: process.cwd(), stdio: 'inherit', shell: true });
    audit.on('close', code => {
      console.log('Audit finished with code', code);
      server.kill('SIGINT');
    });
  } catch (err) {
    console.error('Error during startup:', err);
    server.kill('SIGINT');
    process.exit(1);
  }
})();
