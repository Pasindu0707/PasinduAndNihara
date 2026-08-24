/**
 * Pasindu & Nihara — wedding site backend.
 *
 * Paste this over everything in Extensions → Apps Script, set SHEET_ID, save,
 * then Deploy → Manage deployments → edit → Version: New version → Deploy.
 *
 * IMPORTANT: under Deploy → Manage deployments → edit, "Who has access" must
 * be **Anyone**. Not "Anyone with Google account" — your guests will not be
 * signed in, and the site currently gets a 403 because of this.
 *
 * Tabs it writes to (created automatically if missing):
 *   RSVP        one row per reply
 *   OPENS       one row the first time a guest opens their link on a given day
 *   GUESTBOOK   one row per message; set approved to TRUE to show it on the site
 *   NOT OPENED  built on demand by "Wedding → Who hasn't opened it"
 */

const SHEET_ID = 'PASTE_YOUR_SHEET_ID_HERE';

const HEADERS = {
  RSVP:      ['timestamp', 'guest_id', 'display_name', 'church', 'party', 'count', 'phone', 'message'],
  OPENS:     ['timestamp', 'guest_id', 'display_name'],
  // set approved to TRUE for a message to appear on the site
  GUESTBOOK: ['timestamp', 'guest_id', 'name', 'message', 'approved']
};

function tab_(name) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (HEADERS[name]) sheet.appendRow(HEADERS[name]);
  }
  return sheet;
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const d = JSON.parse(e.postData.contents);

    if (d.type === 'open') {
      tab_('OPENS').appendRow([new Date(), d.guestId || '', d.displayName || '']);

    } else if (d.type === 'guestbook') {
      tab_('GUESTBOOK').appendRow([
        new Date(),
        d.guestId || '',
        String(d.name    || '').slice(0, 60),
        String(d.message || '').slice(0, 400),
        false                      // nothing shows on the site until you tick it
      ]);

    } else {
      tab_('RSVP').appendRow([
        new Date(),
        d.guestId     || '',
        d.displayName || '',
        d.church      || '',
        d.party       || '',
        d.count       || '',
        d.phone       || '',
        d.message     || ''
      ]);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

/**
 * GET ?read=guestbook returns the approved messages for the site.
 * A bare GET is only ever a human checking the deployment is alive.
 */
function doGet(e) {
  const out = { ok: true, service: 'pasindu-and-nihara' };

  if (e && e.parameter && e.parameter.read === 'guestbook') {
    const sheet = tab_('GUESTBOOK');
    const rows  = sheet.getLastRow() > 1
      ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues()
      : [];
    const tz = Session.getScriptTimeZone();
    out.entries = rows
      .filter(r => r[4] === true || String(r[4]).toUpperCase() === 'TRUE')
      .map(r => ({
        name:    r[2],
        message: r[3],
        when:    Utilities.formatDate(new Date(r[0]), tz, 'd MMM yyyy')
      }));
  }

  return ContentService
    .createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}


/* ── the useful bit: who still hasn't looked ── */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Wedding')
    .addItem("Who hasn't opened it", 'buildNotOpened')
    .addToUi();
}

function buildNotOpened() {
  const ss     = SpreadsheetApp.openById(SHEET_ID);
  const guests = ss.getSheetByName('GUESTS');
  if (!guests) throw new Error('No GUESTS tab');

  const rows = guests.getDataRange().getValues();
  const head = rows[0].map(h => String(h).trim().toLowerCase());
  // the sheet header reads "diaplay_name" — accept either spelling
  const iName  = ['display_name', 'diaplay_name', 'name'].map(h => head.indexOf(h)).find(i => i > -1);
  const iSal   = head.indexOf('salutation');
  const iPhone = head.indexOf('phone');
  if (iName === undefined) throw new Error('No display_name column in GUESTS');

  // guest ids that have opened at least once
  const opened = {};
  const opens = ss.getSheetByName('OPENS');
  if (opens && opens.getLastRow() > 1) {
    opens.getRange(2, 1, opens.getLastRow() - 1, 3).getValues()
      .forEach(r => { opened[String(r[1])] = r[0]; });
  }

  const slug = s => String(s).toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const out = [['name', 'phone', 'link id', 'opened']];
  const seen = {};
  rows.slice(1).forEach(r => {
    const raw = String(r[iName] || '').trim();
    if (!raw) return;
    const sal  = iSal > -1 ? String(r[iSal] || '').trim() : '';
    const name = sal ? sal + ' ' + raw : raw;

    let id = slug(name);
    seen[id] = (seen[id] || 0) + 1;
    if (seen[id] > 1) id = id + '-' + seen[id];

    if (!opened[id]) {
      out.push([name, iPhone > -1 ? r[iPhone] : '', id, 'never']);
    }
  });

  const sheet = tab_('NOT OPENED');
  sheet.clear();
  sheet.getRange(1, 1, out.length, 4).setValues(out);
  sheet.getRange(1, 1, 1, 4).setFontWeight('bold');
  sheet.setFrozenRows(1);

  SpreadsheetApp.getUi().alert(
    (out.length - 1) + ' of ' + (rows.length - 1) +
    " guests have not opened their invitation yet. See the 'NOT OPENED' tab."
  );
}
