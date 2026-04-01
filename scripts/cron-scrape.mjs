#!/usr/bin/env node
// scripts/cron-scrape.mjs
// Triggers a full scrape of all active sources via the admin API.
// Designed for Railway Cron Jobs: runs, logs result, exits.
//
// Required env vars:
//   SCRAPE_URL    — full URL of your app, e.g. https://your-app.up.railway.app
//   CRON_SECRET   — shared secret set in both this service and the web app

const SCRAPE_URL = process.env.SCRAPE_URL;
const CRON_SECRET = process.env.CRON_SECRET;

if (!SCRAPE_URL) {
  console.error(`[${new Date().toISOString()}] ERROR  SCRAPE_URL env var is not set`);
  process.exit(1);
}
if (!CRON_SECRET) {
  console.error(`[${new Date().toISOString()}] ERROR  CRON_SECRET env var is not set`);
  process.exit(1);
}

const endpoint = `${SCRAPE_URL.replace(/\/$/, '')}/api/admin/scrape`;

console.log(`[${new Date().toISOString()}] INFO   Starting scheduled scrape`);
console.log(`[${new Date().toISOString()}] INFO   Endpoint: ${endpoint}`);

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 30_000);

try {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CRON_SECRET}`,
    },
    body: JSON.stringify({ all: true }),
    signal: controller.signal,
  });

  clearTimeout(timeout);

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`[${new Date().toISOString()}] ERROR  HTTP ${res.status} — ${body}`);
    process.exit(1);
  }

  const data = await res.json();
  console.log(`[${new Date().toISOString()}] OK     Queued ${data.queued ?? '?'} source(s)`);
  process.exit(0);

} catch (err) {
  clearTimeout(timeout);
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[${new Date().toISOString()}] ERROR  ${msg}`);
  process.exit(1);
}
