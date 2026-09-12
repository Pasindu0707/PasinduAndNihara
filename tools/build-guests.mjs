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
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
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
const iTable = col('table');
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
  if (seatRaw && !isCount) warn.push(`"${name}": seats = "${seatRaw}" is not a number - read as a table label`);

  if (!seatRaw) warn.push(`"${name}": no seats - the count field will start at 1`);

  // the sheet has its own table column; a non-numeric seats value is the
  // older way of saying the same thing, so it still stands in
  const table = iTable > -1 ? (r[iTable] || '').trim() : '';

  const g = { id, name };
  if (isCount)  g.seats = seatNum;
  if (table) g.table = table;
  else if (seatRaw && !isCount) g.table = seatRaw;
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

// The message that goes out with the link. One wording, used by the WhatsApp
// buttons in links.html and by the copy-and-paste list in GUEST_MESSAGES.md,
// so the two can never drift apart.
const messageText = g => [
  `Dear ${g.name} ❤️`,
  ``,
  `With joyful hearts, we warmly invite you to celebrate one of the most special days of our lives as we begin our journey together.`,
  ``,
  `Please view our wedding invitation and all the event details through the link below 🌐:`,
  ``,
  g.url,
  ``,
  `Your presence would truly mean the world to us, and we would be honored to celebrate this beautiful moment together.`,
  ``,
  `With love,`,
  `❤️ Pasindu & Nihara`
].join('\n');

const msg = g => encodeURIComponent(messageText(g));

writeFileSync('tools/links.html', `<!DOCTYPE html><meta charset="utf-8">
<title>Guest links - do not deploy</title>
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
<h1>Guest links - ${guests.length} invitations</h1>
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

/* ── write the plain list of names and links (local only, no phones) ── */

writeFileSync('GUEST_LINKS.md', [
  '# Guest invitation links',
  '',
  `${guests.length} invitations, generated from the GUESTS tab on ${new Date().toISOString().slice(0, 10)}.`,
  '',
  'Each guest opens their own link. Anyone who opens the bare site URL gets',
  '"you and your family" instead — nothing breaks.',
  '',
  '| # | Name | Seats | Link |',
  '|---|------|-------|------|',
  ...links.map((g, i) => {
    const seats = guests[i].seats ?? '—';
    return `| ${i + 1} | ${g.name.replace(/\|/g, '\\|')} | ${seats} | ${g.url} |`;
  }),
  ''
].join('\n'));

/* ── write the ready-to-send message for every guest (local only, no phones) ── */

writeFileSync('GUEST_MESSAGES.md', [
  '# Ready-to-send messages',
  '',
  `${guests.length} messages, generated from the GUESTS tab on ${new Date().toISOString().slice(0, 10)}.`,
  '',
  'One block per guest, already addressed and carrying their own link.',
  'Copy a block whole and send it. The same wording sits behind the WhatsApp',
  '*Send* buttons in `tools/links.html`, so the two always agree.',
  '',
  '---',
  '',
  ...links.flatMap((g, i) => [
    `## ${i + 1}. ${g.name}`,
    '',
    '```',
    messageText(g),
    '```',
    ''
  ])
].join('\n'));

/* ── write the same messages as a one-column sheet (local only, no phones) ──
   A message runs over several lines, so each one is a quoted CSV field. Google
   Sheets keeps the line breaks inside the cell as long as the file is brought
   in through File > Import rather than pasted. The BOM keeps the emoji intact. */

const csvCell = s => `"${String(s).replace(/"/g, '""')}"`;

writeFileSync('GUEST_MESSAGES.csv',
  '﻿' + [
    csvCell('Message'),
    ...links.map(g => csvCell(messageText(g)))
  ].join('\r\n') + '\r\n'
);

console.log(`✓ ${guests.length} guests → site/data/guests.json`);
console.log(`✓ send sheet     → tools/links.html`);
console.log(`✓ name + link list → GUEST_LINKS.md`);
console.log(`✓ ready messages   → GUEST_MESSAGES.md`);
console.log(`✓ one-column sheet → GUEST_MESSAGES.csv`);
if (warn.length){
  console.log(`\n⚠ ${warn.length} thing(s) to check:`);
  warn.forEach(w => console.log(`  · ${w}`));
}
