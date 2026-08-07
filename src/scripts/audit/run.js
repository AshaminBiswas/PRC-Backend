// src/scripts/audit/run.js
// Simple audit runner for PRC Hardware API
// Performs npm audit, ESLint security check, and basic runtime API tests.

const { execSync } = require('child_process');
const axios = require('axios');
const fs = require('fs');

function runCommand(cmd, options = {}) {
  try {
    const output = execSync(cmd, { stdio: 'pipe', encoding: 'utf-8', ...options });
    return { success: true, output };
  } catch (err) {
    return { success: false, output: err.stdout ? err.stdout.toString() : err.message };
  }
}

function logSection(title) {
  console.log('\n=== ' + title + ' ===');
}

async function main() {
  // 1. npm audit (high severity only)
  logSection('npm audit');
  const auditResult = runCommand('npm audit --json');
  if (auditResult.success) {
    const auditJson = JSON.parse(auditResult.output);
    const high = auditJson.metadata?.vulnerabilities?.high || 0;
    const critical = auditJson.metadata?.vulnerabilities?.critical || 0;
    console.log('High severity vulnerabilities:', high);
    console.log('Critical vulnerabilities:', critical);
    if (high + critical > 0) {
      console.log('Vulnerabilities found:');
      console.log(JSON.stringify(auditJson.advisories, null, 2));
    } else {
      console.log('No high or critical vulnerabilities.');
    }
  } else {
    console.error('npm audit failed:', auditResult.output);
  }

  // 2. ESLint security scan (if config present)
  logSection('ESLint security scan');
  if (fs.existsSync('.eslintrc.js') || fs.existsSync('.eslintrc.json')) {
    const eslintResult = runCommand('npx eslint . --ext .ts,.js');
    console.log(eslintResult.output);
  } else {
    console.log('ESLint config not found, skipping.');
  }

  // 3. Runtime API tests
  logSection('Runtime API tests');
  const apiBase = process.env.API_BASE || 'http://localhost:3000';
  const apiPrefix = process.env.API_PREFIX || '/api';
  const client = axios.create({ baseURL: apiBase, validateStatus: () => true, withCredentials: true });

  function printResp(name, resp) {
    console.log(`${name} => status: ${resp.status}`);
    if (resp.headers['set-cookie']) {
      console.log('  Set-Cookie:', resp.headers['set-cookie']);
    }
    if (resp.data && typeof resp.data === 'object') {
      console.log('  body keys:', Object.keys(resp.data));
    }
  }

  const testUser = { email: 'audit_test_user@example.com', password: 'StrongP@ssw0rd!' };
  // Signup
  try {
    const signupResp = await client.post(`${apiPrefix}/auth/signup`, testUser);
    printResp('Signup', signupResp);
  } catch (e) {
    console.error('Signup error:', e.message);
  }

  // Login
  let loginResp;
  try {
    loginResp = await client.post(`${apiPrefix}/auth/login`, testUser);
    printResp('Login', loginResp);
  } catch (e) {
    console.error('Login error:', e.message);
  }

  // Rate limiting test
  logSection('Rate limiting test');
  for (let i = 0; i < 10; i++) {
    const resp = await client.post(`${apiPrefix}/auth/login`, testUser);
    console.log(`Attempt ${i + 1}: ${resp.status}`);
    if (resp.status === 429) {
      console.log('Rate limit triggered.');
      break;
    }
  }

  // IDOR check
  logSection('IDOR test');
  if (loginResp && loginResp.status === 200) {
    const idorResp = await client.get(`${apiPrefix}/users/1`);
    printResp('IDOR fetch user 1', idorResp);
    if (idorResp.status === 200) {
      console.log('Potential IDOR vulnerability detected.');
    }
  }

  // Password reset flow
  logSection('Password reset flow');
  try {
    const resetResp = await client.post(`${apiPrefix}/auth/forgot-password`, { email: testUser.email });
    printResp('Forgot password', resetResp);
  } catch (e) {
    console.error('Forgot password error:', e.message);
  }

  console.log('\nAudit run complete.');
}

main().catch(err => {
  console.error('Audit script error:', err);
  process.exit(1);
});
