'use strict';
// Replicate adapter: generate({prompt, aspectRatio, resolution}) -> image bytes, split into
// submit / poll / download so the caller can persist job ids between steps.
// The API token is read from .env and is never logged.
const fs = require('fs');
const { pipeline } = require('stream/promises');
const { Readable } = require('stream');

const API = 'https://api.replicate.com/v1';
const PRICES = { 'black-forest-labs/flux-1.1-pro': 0.04, 'black-forest-labs/flux-schnell': 0.003, 'black-forest-labs/flux-dev': 0.025 };

function headers(env) {
  if (!env.REPLICATE_API_TOKEN) throw new Error('REPLICATE_API_TOKEN missing in .env');
  return { Authorization: `Bearer ${env.REPLICATE_API_TOKEN}`, 'Content-Type': 'application/json' };
}

async function submit({ prompt, aspectRatio }, env) {
  const model = env.REPLICATE_MODEL || 'black-forest-labs/flux-1.1-pro';
  const res = await fetch(`${API}/models/${model}/predictions`, { method: 'POST', headers: headers(env), body: JSON.stringify({ input: { prompt, aspect_ratio: aspectRatio, output_format: 'png', safety_tolerance: 2 } }) });
  if (!res.ok) throw new Error(`Replicate submit failed: HTTP ${res.status}`);
  const j = await res.json();
  return { id: j.id, model, submittedAt: new Date().toISOString() };
}

async function poll(job, env) {
  for (let i = 0; i < 120; i++) {
    const res = await fetch(`${API}/predictions/${job.id}`, { headers: headers(env) });
    if (!res.ok) throw new Error(`Replicate poll failed: HTTP ${res.status}`);
    const j = await res.json();
    if (j.status === 'succeeded') return { id: job.id, url: Array.isArray(j.output) ? j.output[0] : j.output };
    if (j.status === 'failed' || j.status === 'canceled') throw new Error(`Replicate job ${job.id} ${j.status}`);
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Replicate job ${job.id} timed out; its id is saved in images/jobs.json`);
}

async function download(done, target) {
  const res = await fetch(done.url);
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(target + '.part'));
  fs.renameSync(target + '.part', target);
}

async function balance() {
  return { available: false, note: 'Replicate has no balance endpoint; check https://replicate.com/account/billing' };
}

const costPerImage = (env) => PRICES[env.REPLICATE_MODEL || 'black-forest-labs/flux-1.1-pro'] || 0;

async function generate(input, env) {
  const job = await submit(input, env);
  const done = await poll(job, env);
  const res = await fetch(done.url);
  return Buffer.from(await res.arrayBuffer());
}

module.exports = { name: 'replicate', submit, poll, download, balance, costPerImage, generate };
