/* Screenshot the local site through Chrome DevTools Protocol.
 *
 *   node --experimental-websocket tools/shot.mjs <outDir> <name>:<y> [<name>:<y> ...]
 *
 * Optional env: URL (default http://localhost:5173/?skip=1), W, H
 */

import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT   = 9333;
const OUT    = process.argv[2];
const SHOTS  = process.argv.slice(3).map(s => {
  const i = s.lastIndexOf(':');
  return { name: s.slice(0, i), y: Number(s.slice(i + 1)) };
});
const URL_   = process.env.URL || 'http://localhost:5173/?skip=1';
const W      = Number(process.env.W || 390);
const H      = Number(process.env.H || 844);
const DPR    = Number(process.env.DPR || 2);

mkdirSync(OUT, { recursive: true });
const profile = join(tmpdir(), `pn-shot-${Date.now()}`);

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required',
  'about:blank'
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function target(){
  for (let i = 0; i < 60; i++){
    try{
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find(t => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    }catch{}
    await sleep(250);
  }
  throw new Error('Chrome did not start');
}

const ws = new WebSocket(await target());
await new Promise(r => ws.addEventListener('open', r, { once: true }));

let id = 0;
const pending = new Map();
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)){ pending.get(m.id)(m.result); pending.delete(m.id); }
});
const send = (method, params = {}) => new Promise(res => {
  const n = ++id;
  pending.set(n, res);
  ws.send(JSON.stringify({ id: n, method, params }));
});

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: W, height: H, deviceScaleFactor: DPR, mobile: true
});

for (const shot of SHOTS){
  await send('Page.navigate', { url: `${URL_}&y=${shot.y}` });
  await sleep(2200);
  await send('Runtime.evaluate', { expression: `window.scrollTo(0, ${shot.y})` });
  if (process.env.EVAL){
    await send('Runtime.evaluate', { expression: process.env.EVAL });
    await sleep(Number(process.env.EVAL_WAIT || 900));
  }
  await sleep(700);
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(OUT, `${shot.name}.png`), Buffer.from(data, 'base64'));
  console.log(`  ${shot.name}.png  @ y=${shot.y}`);
}

ws.close();
chrome.kill();
await sleep(400);
try{ rmSync(profile, { recursive: true, force: true }); }catch{}
