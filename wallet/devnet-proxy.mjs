// Local auth-injecting proxy for the 5North DevNet sandbox validator.
//
// Vendored from https://github.com/akashbiswas0/canton-start (quickstart/gateway/
// devnet-proxy.mjs), itself derived from Digital Asset's canton-network-quickstart.
// Adapted for Paydae: reads CLIENT_ID / CLIENT_SECRET from the repo-root .env.
//
// The browser and Wallet Gateway authenticate with local self-signed sessions;
// this proxy replaces the Authorization header with a real Authentik
// client-credentials token on every forwarded request, so no OAuth secret ever
// reaches the frontend.
//
//   /scan-proxy/*  -> <validator>/api/validator/v0/scan-proxy/*   (Token Standard registry)
//   /*             -> <ledger-api>/*                              (JSON Ledger API)
//
// Usage: node devnet-proxy.mjs   (port 9000; secret auto-loaded from ../.env)

import http from 'node:http';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load repo-root .env (same minimal parser as backend/src/env.ts).
const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const envVars = {};
try {
  for (const line of readFileSync(path.join(REPO_ROOT, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && m[1] && m[2] !== undefined) envVars[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {
  // fall through to process.env only
}

const PORT = Number(process.env.PROXY_PORT || 9000);
const LEDGER_BASE = envVars.LEDGER_API || 'https://ledger-api.validator.devnet.sandbox.fivenorth.io';
const SCAN_PROXY_BASE = 'https://wallet.validator.devnet.sandbox.fivenorth.io/api/validator/v0/scan-proxy';
const TOKEN_URL = envVars.AUTH_URL || 'https://auth.sandbox.fivenorth.io/application/o/token/';
const CLIENT_ID = process.env.CLIENT_ID || envVars.CLIENT_ID || 'validator-devnet-m2m';
const CLIENT_SECRET = process.env.CLIENT_SECRET || envVars.CLIENT_SECRET;
if (!CLIENT_SECRET) {
  console.error('CLIENT_SECRET is required (repo-root .env or env var)');
  process.exit(1);
}

let cached = { token: null, expiresAt: 0 };
async function getToken() {
  if (cached.token && Date.now() < cached.expiresAt - 10 * 60_000) return cached.token;
  const resp = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      audience: CLIENT_ID,
      scope: 'daml_ledger_api',
    }),
  });
  if (!resp.ok) throw new Error(`token exchange failed: ${resp.status} ${await resp.text()}`);
  const data = await resp.json();
  cached = { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 28800) * 1000 };
  console.log(`[proxy] refreshed token, expires in ${data.expires_in}s`);
  return cached.token;
}

function setCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 'authorization, content-type');
}

const server = http.createServer(async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  try {
    const target = req.url.startsWith('/scan-proxy/')
      ? SCAN_PROXY_BASE + req.url.slice('/scan-proxy'.length)
      : LEDGER_BASE + req.url;
    const token = await getToken();
    const headers = { ...req.headers, authorization: `Bearer ${token}` };
    delete headers.host;
    delete headers.connection;
    delete headers.origin;
    delete headers.referer;
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: body && body.length ? body : undefined,
      redirect: 'manual',
    });
    const respHeaders = {};
    upstream.headers.forEach((v, k) => {
      if (!['content-encoding', 'transfer-encoding', 'connection', 'access-control-allow-origin', 'access-control-allow-credentials', 'access-control-allow-methods', 'access-control-allow-headers'].includes(k)) respHeaders[k] = v;
    });
    res.writeHead(upstream.status, respHeaders);
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.end(buf);
  } catch (err) {
    console.error('[proxy] error:', err.message);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'proxy_error', message: err.message }));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[proxy] listening on http://127.0.0.1:${PORT}`);
  console.log(`[proxy] /* -> ${LEDGER_BASE}`);
  console.log(`[proxy] /scan-proxy/* -> ${SCAN_PROXY_BASE}`);
});
