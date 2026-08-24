/* ═══════════════════════════════════════════════════════════
   Pasindu & Nihara — 16 & 17 January 2027
   ═══════════════════════════════════════════════════════════ */

const CONFIG = {
  // Google Apps Script web-app endpoint (Deploy → Web app → /exec URL)
  rsvpEndpoint: 'https://script.google.com/macros/s/AKfycbwJV6_u8w6rKijYoRoR7ZnozPnyj8zPAZiHqbSl5vygm-Fc6Hn7TNCBfoRXiqzwDZMVIQ/exec',
  ceremony: '2027-01-16T09:30:00+05:30',
  fallbackName: 'you and your family',
  galleryCount: 7,
  // set to 'assets/audio/theme.mp3' once a track has been chosen
  music: null
};

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let guest = null;


/* ───────── guest lookup ───────── */

// only ?to= — the hash is reserved for in-page anchors
function guestKey(){
  return (new URLSearchParams(location.search).get('to') || '').trim().toLowerCase();
}

async function loadGuest(){
  const key = guestKey();
  if (!key) return null;
  try{
    const res = await fetch('data/guests.json', { cache: 'no-cache' });
    if (!res.ok) return null;
    const data = await res.json();
    return data.guests.find(g => g.id === key) || null;
  }catch{
    return null;
  }
}

function applyGuest(){
  const name = guest ? guest.name : CONFIG.fallbackName;

  $('#envelopeName').textContent = name;
  $('#guestName').textContent    = name;
  $('#rsvpFor').textContent      = name;

  if (guest && guest.table){
    const dd = document.createElement('dd');
    const dt = document.createElement('dt');
    dt.textContent = 'Your table';
    dd.textContent = guest.table;
    const detail = $('#day-two .detail');
    if (detail){ detail.append(dt, dd); }
  }
}


/* ───────── "this link was opened" ─────────
   One line to the OPENS tab the first time a guest opens their own link on a
   given day. Nothing else is recorded — no page views, no scroll, no device.
   It exists so that in late December you can see who has never looked. */

function logOpen(){
  if (!guest) return;                       // no personal link, nothing to log
  if (!CONFIG.rsvpEndpoint) return;

  const today = new Date().toISOString().slice(0, 10);
  const stamp = `${guest.id}|${today}`;
  try{
    if (localStorage.getItem('pn-open') === stamp) return;
    localStorage.setItem('pn-open', stamp);
  }catch{ /* private mode — ping anyway, the sheet dedupes by day */ }

  const body = JSON.stringify({
    type: 'open',
    guestId: guest.id,
    displayName: guest.name
  });

  // text/plain keeps this a simple request, so no CORS preflight
  const blob = new Blob([body], { type: 'text/plain;charset=UTF-8' });
  if (navigator.sendBeacon?.(CONFIG.rsvpEndpoint, blob)) return;

  fetch(CONFIG.rsvpEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body,
    keepalive: true
  }).catch(() => { /* never let this get in the guest's way */ });
}


/* ───────── the envelope ───────── */

function openEnvelope(){
  const stage = $('#envelopeStage');
  if (!stage || stage.dataset.open === '1') return;
  stage.dataset.open = '1';

  document.body.classList.remove('is-locked');
  $('#envelope').classList.add('is-opening');
  $('#envelopeStage').classList.add('is-opening');

  const wait = reducedMotion ? 0 : 2000;
  setTimeout(() => {
    stage.classList.add('is-gone');
    sessionStorage.setItem('pn-opened', '1');
    playHeroVideo();
    setTimeout(() => { stage.remove(); }, 900);
  }, wait);
}

function setupEnvelope(){
  const stage = $('#envelopeStage');
  if (!stage) return;

  // already opened this session — go straight in
  const skip = new URLSearchParams(location.search).has('skip');
  if (skip || sessionStorage.getItem('pn-opened') === '1'){
    document.body.classList.remove('is-locked');
    stage.remove();
    playHeroVideo();
    return;
  }

  $('#envSeal').addEventListener('click', openEnvelope);
  stage.addEventListener('click', e => {
    if (e.target.closest('.env-seal')) return;
    openEnvelope();
  });
}


/* ───────── hero video ───────── */

function playHeroVideo(){
  const v = $('#heroVideo');
  if (!v || reducedMotion) return;

  // The clip is a 576px-wide phone export. A laptop stretches that across the
  // whole window, so wide screens get the 2x pass; phones keep the small file
  // rather than pulling 4 MB over mobile data.
  const wide = window.matchMedia('(min-width: 900px)').matches;
  v.src = wide ? 'assets/video/hero-lg.mp4' : 'assets/video/hero-sm.mp4';

  v.preload = 'auto';
  v.load();
  v.play().catch(() => { /* autoplay refused — the poster stands in */ });
}


/* ───────── scroll reveals ───────── */

function setupReveals(){
  const items = $$('.reveal');
  const flat = new URLSearchParams(location.search).has('skip'); // dev/preview
  if (flat || !('IntersectionObserver' in window) || reducedMotion){
    items.forEach(el => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      obs.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.1 });

  items.forEach(el => io.observe(el));
}

/* the guest's name writes itself onto the dotted line */
function setupInviteLine(){
  const line = $('#inviteLine');
  if (!line) return;
  const flat = new URLSearchParams(location.search).has('skip');
  if (flat || reducedMotion){ line.classList.add('is-written'); return; }

  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      setTimeout(() => line.classList.add('is-written'), 250);
      obs.unobserve(e.target);
    });
  }, { threshold: 0.5 });

  io.observe(line);
}


/* ───────── countdown ───────── */

function setupCountdown(){
  const target = new Date(CONFIG.ceremony).getTime();
  const days = $('#cdDays'), hours = $('#cdHours'), mins = $('#cdMins');
  if (!days) return;

  const tick = () => {
    const left = target - Date.now();
    if (left <= 0){
      $('#countdownRow').innerHTML =
        '<p class="beat__closer" style="margin:0">Today is the day.</p>';
      return;
    }
    const m = Math.floor(left / 60000);
    days.textContent  = Math.floor(m / 1440);
    hours.textContent = Math.floor(m % 1440 / 60);
    mins.textContent  = m % 60;
  };

  tick();
  setInterval(tick, 30000);
}


/* ───────── the story track ─────────
   The spine fills as you descend the years and the ruler names the year you
   are standing in — so 2020 and 2021, which have no photographs, are still
   beats you pass through rather than gaps you scroll over. */

function setupTrack(){
  const track = $('#track');
  const fill  = $('#trackFill');
  const label = $('#rulerYear');
  const ticks = $$('.ruler__tick');
  if (!track || !fill) return;

  /* the spine */
  let queued = false;
  const draw = () => {
    queued = false;
    const r  = track.getBoundingClientRect();
    const mid = window.innerHeight * 0.55;
    const p  = (mid - r.top) / r.height;
    fill.style.transform = `scaleY(${Math.min(1, Math.max(0, p))})`;
  };
  const onScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(draw);
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  draw();

  /* the ruler */
  if (!('IntersectionObserver' in window) || !label) return;
  const byYear = Object.fromEntries(ticks.map(t => [t.dataset.year, t]));

  const setYear = year => {
    if (label.textContent === year) return;
    label.textContent = year;
    let past = true;
    ticks.forEach(t => {
      t.classList.toggle('is-now', t.dataset.year === year);
      t.classList.toggle('is-past', past && t.dataset.year !== year);
      if (t.dataset.year === year) past = false;
    });
  };

  const io = new IntersectionObserver(entries => {
    // the beat closest to the top of the reading band wins
    const live = entries.filter(e => e.isIntersecting)
                        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (live) setYear(live.target.dataset.year);
  }, { rootMargin: '-25% 0px -55% 0px' });

  $$('.beat').forEach(b => io.observe(b));
  if (byYear['2016']) setYear('2016');
}


/* ───────── gallery + lightbox ───────── */

function setupGallery(){
  const grid = $('#shots');
  if (!grid) return;

  const frag = document.createDocumentFragment();
  for (let i = 1; i <= CONFIG.galleryCount; i++){
    const n     = String(i).padStart(2, '0');
    const small = `assets/img/gal-${n}-400.webp`;
    const large = `assets/img/gal-${n}-full.webp`;

    const img = new Image(400, 500);
    img.src = small;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.alt = `Pasindu and Nihara — engagement photograph ${i}`;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'View this photograph larger');
    btn.dataset.full = large;
    btn.append(img);

    const li = document.createElement('li');
    li.className = 'reveal is-in';
    li.append(btn);

    // a missing size just drops out rather than showing a broken frame
    img.onerror = () => li.remove();
    frag.append(li);
  }
  grid.append(frag);
}

function setupLightbox(){
  const box   = $('#lightbox');
  const img   = $('#lightboxImg');
  const close = $('#lightboxClose');
  if (!box) return;

  let lastFocus = null;

  const open = src => {
    lastFocus = document.activeElement;
    img.src = src;
    box.hidden = false;
    document.body.style.overflow = 'hidden';
    close.focus();
  };
  const shut = () => {
    box.hidden = true;
    img.removeAttribute('src');
    document.body.style.overflow = '';
    lastFocus?.focus();
  };

  document.addEventListener('click', e => {
    const btn = e.target.closest('.shots button');
    if (btn) open(btn.dataset.full);
  });
  box.addEventListener('click', shut);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !box.hidden) shut();
  });
}


/* ───────── add to calendar ───────── */

function setupCalendar(){
  $$('[data-ics]').forEach(btn => {
    btn.addEventListener('click', () => {
      const file = btn.dataset.ics === 'church' ? 'ceremony' : 'celebration';
      location.href = `assets/cal/${file}.ics`;
    });
  });
}


/* ───────── RSVP ───────── */

function setupRsvp(){
  const form = $('#rsvpForm');
  if (!form) return;

  const countField = $('#countField');
  const countInput = $('#guestCount');
  const status     = $('#rsvpStatus');
  const submit     = $('#rsvpSubmit');

  const seats = guest && Number(guest.seats) > 0 ? Number(guest.seats) : null;

  // one seat means there is nothing to count
  const needsCount = seats === null || seats > 1;
  if (seats){
    countInput.value = seats;
    countInput.max = seats > 2 ? '' : String(seats);
  }

  form.addEventListener('change', e => {
    if (e.target.name !== 'attending') return;
    const coming = e.target.value === 'yes';
    countField.hidden = !(coming && needsCount);
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();

    const attending = form.querySelector('input[name="attending"]:checked');
    if (!attending){
      status.textContent = 'Let us know whether you can come.';
      status.classList.add('is-error');
      return;
    }
    status.classList.remove('is-error');
    status.textContent = 'Sending…';
    submit.disabled = true;

    const coming = attending.value === 'yes';
    const payload = {
      guestId:     guest ? guest.id : '',
      displayName: guest ? guest.name : (form.querySelector('#rsvpFor')?.textContent || ''),
      church:      '',
      party:       coming ? 'yes' : 'no',
      count:       coming ? (countField.hidden ? (seats || 1) : Number(countInput.value) || 1) : 0,
      phone:       $('#guestPhone').value.trim(),
      message:     $('#guestMessage').value.trim()
    };

    try{
      // text/plain keeps this a "simple" request, so the browser sends no
      // CORS preflight — Apps Script cannot answer an OPTIONS call.
      // The reply is read on purpose: a silent no-cors post would let us
      // tell a guest they had replied when nothing was recorded.
      const res  = await fetch(CONFIG.rsvpEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error || 'rejected');

      form.innerHTML = coming
        ? `<p class="beat__closer" style="text-align:center;margin:0">
             Wonderful. We'll see you on the seventeenth.</p>`
        : `<p class="beat__closer" style="text-align:center;margin:0">
             We'll miss you — thank you for telling us.</p>`;
    }catch{
      status.innerHTML =
        'That didn’t send. Please message us instead — ' +
        '<a href="https://wa.me/94778909086" target="_blank" rel="noopener">077 890 9086</a>.';
      status.classList.add('is-error');
      submit.disabled = false;
    }
  });
}


/* ───────── music (only if a track has been added) ───────── */

function setupMusic(){
  const btn = $('#musicToggle');
  if (!btn) return;
  if (!CONFIG.music){ btn.remove(); return; }

  const audio = new Audio(CONFIG.music);
  audio.loop = true;
  audio.volume = 0.35;

  audio.addEventListener('canplaythrough', () => { btn.hidden = false; }, { once: true });
  audio.addEventListener('error', () => { btn.remove(); }, { once: true });

  btn.addEventListener('click', () => {
    const playing = btn.getAttribute('aria-pressed') === 'true';
    if (playing){ audio.pause(); }
    else { audio.play().catch(() => {}); }
    btn.setAttribute('aria-pressed', String(!playing));
    btn.setAttribute('aria-label', playing ? 'Play music' : 'Pause music');
  });
}


/* ───────── theme colour follows the two acts ───────── */

function setupThemeColour(){
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta || !('IntersectionObserver' in window)) return;

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      meta.content = e.target.dataset.act === 'night' ? '#190A0E' : '#FBF7EF';
    });
  }, { rootMargin: '-45% 0px -45% 0px' });

  $$('[data-act]').forEach(el => io.observe(el));
}


/* ───────── dev helpers (?skip=1 &y=1200) ───────── */

function devJump(){
  const p = new URLSearchParams(location.search);
  if (!p.has('skip')) return;
  document.documentElement.classList.add('is-flat');
  document.documentElement.style.scrollBehavior = 'auto';
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  const y = Number(p.get('y'));
  if (!y) return;
  const jump = () => window.scrollTo(0, y);
  jump();
  [50, 200, 600, 1200].forEach(t => setTimeout(jump, t));
}


/* ───────── go ───────── */

(async function init(){
  guest = await loadGuest();
  applyGuest();
  logOpen();

  setupEnvelope();
  setupReveals();
  setupInviteLine();
  setupCountdown();
  setupTrack();
  setupGallery();
  setupLightbox();
  setupCalendar();
  setupRsvp();
  setupMusic();
  setupThemeColour();
  devJump();
})();
