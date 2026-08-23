/* Build the guest list for the site.
 *
 *   node tools/build-guests.mjs                 (pulls the live Google Sheet)
 *   node tools/build-guests.mjs guests.csv      (uses a local CSV instead)
 *
 * Writes:
 *   site/data/guests.json   — deployed. Names only. NO phone numbers.
 *   tools/links.html        — local only. Every guest's link + a WhatsApp button.
 */

import { writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

const SHEET_ID = '1ta3FAOJj6wi5D-g9E-OQOhAfVgJ-5iTpyhlPsEhDGh0';
const TAB      = 'GUESTS';
const SITE_URL = 'https://pasindu0707.github.io/PasinduAndNihara/'; // swap for the domain later

/* ── read ── */

async function source(){
  const local = process.argv[2];
  if (local) return readFile(local, 'utf8');
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${TAB}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
  return res.text();
}

/* ── minimal CSV parser (handles quoted fields and embedded commas) ── */

function parseCSV(text){
  const rows = [];
  let row = [], field = '', quoted = false;

  for (let i = 0; i < text.length; i++){
    const c = text[i];
    if (quoted){
      if (c === '"'){
        if (text[i + 1] === '"'){ field += '"'; i++; }
        else quoted = false;
      } else field += c;
    } else if (c === '"'){ quoted = true; }
    else if (c === ','){ row.push(field); field = ''; }
    else if (c === '\n'){ row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r'){ field += c; }
  }
  if (field || row.length){ row.push(field); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim()));
}

const slug = s => s.toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const truthy = v => /^(yes|y|true|1)$/i.test(String(v).trim());

/* ── build ── */

const rows = parseCSV(await source());
const head = rows[0].map(h => h.trim().toLowerCase());

// the sheet header reads "diaplay_name" — accept either spelling
const col = name => {
  const aliases = { display_name: ['display_name', 'diaplay_name', 'name'] };
  for (const a of (aliases[name] || [name])){
    const i = head.indexOf(a);
    if (i !== -1) return i;
  }
  return -1;
};

const iName  = col('display_name');
const iSal   = col('salutation');
const iSide  = col('side');
const iChurch= col('church');
const iParty = col('party');
const iSeats = col('seats');
const iPhone = col('phone');

if (iName === -1) throw new Error(`No display_name column. Found: ${head.join(', ')}`);

const guests = [];
const links  = [];
const warn   = [];
const seen   = new Map();

for (const r of rows.slice(1)){
  const raw = (r[iName] || '').trim();
  if (!raw) continue;

  const sal  = iSal   > -1 ? (r[iSal]   || '').trim() : '';
  const name = sal ? `${sal} ${raw}` : raw;

  let id = slug(name);
  const n = (seen.get(id) || 0) + 1;
  seen.set(id, n);
  if (n > 1){ id = `${id}-${n}`; warn.push(`Duplicate name "${name}" → id "${id}"`); }

  const seatRaw = iSeats > -1 ? (r[iSeats] || '').trim() : '';
  const seatNum = parseInt(seatRaw, 10);
  const isCount = /^\d+$/.test(seatRaw);
  if (seatRaw && !isCount) warn.push(`"${name}": seats = "${seatRaw}" is not a number — read as a table label`);

  const g = { id, name };
  if (isCount)  g.seats = seatNum;
  if (seatRaw && !isCount) g.table = seatRaw;
  if (iChurch > -1) g.church = truthy(r[iChurch]);
  if (iParty  > -1) g.party  = truthy(r[iParty]);
  if (iSide   > -1 && r[iSide]) g.side = r[iSide].trim();

  guests.push(g);

  const phone = iPhone > -1 ? (r[iPhone] || '').replace(/[^\d]/g, '') : '';
  links.push({ id, name, phone, url: `${SITE_URL}?to=${id}` });
}

/* ── write the deployed file (names only) ── */

writeFileSync('site/data/guests.json', JSON.stringify({
  generated: new Date().toISOString(),
  guests
}, null, 0));

/* ── write the local send-sheet (phones stay here, never deployed) ── */

const msg = g => encodeURIComponent(
  `${g.name},\n\nPasindu & Nihara are getting married, and we would love for you to be there.\n\n` +
  `Your invitation:\n${g.url}\n\n16 January 2027 — St. Joseph's Church, Wennappuwa\n` +
  `17 January 2027 — The Glasshouse\n\nPlease RSVP on the page before 28 December.`
);

writeFileSync('tools/links.html', `<!DOCTYPE html><meta charset="utf-8">
<title>Guest links — do not deploy</title>
<style>
 body{font:15px/1.6 system-ui;margin:2rem auto;max-width:60rem;padding:0 1rem;color:#1E2620}
 h1{font-weight:500} .warn{background:#FDF3D8;border-left:3px solid #CFB88C;padding:.75rem 1rem;margin:1rem 0}
 table{border-collapse:collapse;width:100%} th,td{text-align:left;padding:.6rem .5rem;border-bottom:1px solid #e6e2d8;vertical-align:top}
 th{font-size:.7rem;letter-spacing:.15em;text-transform:uppercase;color:#62745C}
 code{font-size:.8rem;color:#590B19;word-break:break-all}
 a.wa{display:inline-block;background:#25D366;color:#fff;text-decoration:none;padding:.35rem .7rem;border-radius:3px;font-size:.8rem;white-space:nowrap}
 a.wa[href="#"]{background:#ccc;pointer-events:none}
 button{font:inherit;padding:.3rem .6rem;cursor:pointer}
</style>
<h1>Guest links — ${guests.length} invitations</h1>
<p class="warn"><b>This file is local only.</b> It contains phone numbers and is never published.
Click <i>Send</i> to open WhatsApp with the message ready.</p>
${warn.length ? `<p class="warn"><b>Check these:</b><br>${warn.join('<br>')}</p>` : ''}
<table>
<tr><th>Name</th><th>Link</th><th></th><th></th></tr>
${links.map(g => `<tr>
  <td>${g.name}</td>
  <td><code>${g.url}</code></td>
  <td><button onclick="navigator.clipboard.writeText('${g.url}');this.textContent='Copied'">Copy</button></td>
  <td><a class="wa" target="_blank" href="${g.phone ? `https://wa.me/${g.phone}?text=${msg(g)}` : '#'}">${g.phone ? 'Send' : 'no phone'}</a></td>
</tr>`).join('\n')}
</table>`);

console.log(`✓ ${guests.length} guests → site/data/guests.json`);
console.log(`✓ send sheet     → tools/links.html`);
if (warn.length){
  console.log(`\n⚠ ${warn.length} thing(s) to check:`);
  warn.forEach(w => console.log(`  · ${w}`));
}
