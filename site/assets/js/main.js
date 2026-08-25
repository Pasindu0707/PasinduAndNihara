/* ═══════════════════════════════════════════════════════════
   Pasindu & Nihara — 16 & 17 January 2027
   ═══════════════════════════════════════════════════════════ */

const CONFIG = {
  // Google Apps Script web-app endpoint (Deploy → Web app → /exec URL)
  rsvpEndpoint: 'https://script.google.com/macros/s/AKfycbwJV6_u8w6rKijYoRoR7ZnozPnyj8zPAZiHqbSl5vygm-Fc6Hn7TNCBfoRXiqzwDZMVIQ/exec',
  ceremony: '2027-01-16T09:30:00+05:30',
  party:    '2027-01-17T19:00:00+05:30',
  partyEnd: '2027-01-17T23:30:00+05:30',
  fallbackName: 'you and your family',
  galleryCount: 7,
  music: 'assets/audio/theme.mp3',
  musicVolume: 0.22,        // background, not foreground
};

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let guest = null;
let guestKeyAsked = '';          // what ?to= claimed, matched or not


/* ───────── guest lookup ───────── */

// only ?to= — the hash is reserved for in-page anchors
function guestKey(){
  return (new URLSearchParams(location.search).get('to') || '').trim().toLowerCase();
}

async function loadGuest(){
  const key = guestKeyAsked = guestKey();
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
    const detail = $('#day-two .detail');
    if (detail){
      // the schedule rows are wrapped, so this one has to be too
      const row = document.createElement('div');
      const dt  = document.createElement('dt');
      const dd  = document.createElement('dd');
      dt.textContent = 'Your table';
      dd.textContent = guest.table;
      row.append(dt, dd);
      detail.append(row);
    }
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
  startMusic(true);                    // the tap that opens is the tap that allows sound
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
    startMusic(false);                 // no gesture here, so it may have to wait for one
    return;
  }

  // the envelope leans toward the pointer — small, and damped by CSS
  if (!reducedMotion && matchMedia('(hover: hover)').matches){
    const env = $('#envelope');
    stage.addEventListener('pointermove', e => {
      const x = (e.clientX / innerWidth  - 0.5) * 2;
      const y = (e.clientY / innerHeight - 0.5) * 2;
      env.style.setProperty('--tilt-y', (x * 7).toFixed(2) + 'deg');
      env.style.setProperty('--tilt-x', (-y * 5).toFixed(2) + 'deg');
    });
    stage.addEventListener('pointerleave', () => {
      env.style.setProperty('--tilt-y', '0deg');
      env.style.setProperty('--tilt-x', '0deg');
    });
  }

  // a few petals on the stage, so the wait is not a still picture
  drift(stage, {
    tints: PETAL.burst, alpha: 0.3, density: 70000, max: 14,
    r: [4, 8], vy: [8, 18]
  });

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
  const ceremony = new Date(CONFIG.ceremony).getTime();
  const party    = new Date(CONFIG.party).getTime();
  const over     = new Date(CONFIG.partyEnd).getTime();

  const row   = $('#countdownRow');
  const label = $('#countdownLabel');
  const days  = $('#cdDays'), hours = $('#cdHours'), mins = $('#cdMins');
  if (!row || !days) return;

  const say = text => {
    row.innerHTML = `<p class="beat__closer" style="margin:0">${text}</p>`;
  };

  const tick = () => {
    const now = Date.now();

    if (now >= over){
      document.body.classList.add('is-after');
      if (label) label.textContent = 'And that was that';
      say('Thank you for being there.');
      return true;
    }
    if (now >= party){
      if (label) label.textContent = 'Right now';
      say('Tonight.');
      return true;
    }

    const target = now >= ceremony ? party : ceremony;
    if (label){
      label.textContent = now >= ceremony
        ? 'Until the celebration begins'
        : 'Until the church doors open';
    }

    const m = Math.floor((target - now) / 60000);
    days.textContent  = Math.floor(m / 1440);
    hours.textContent = Math.floor(m % 1440 / 60);
    mins.textContent  = m % 60;
    return false;
  };

  if (tick()) return;
  const timer = setInterval(() => { if (tick()) clearInterval(timer); }, 30000);
}


/* ───────── momentum scrolling ─────────
   Lenis (13 KB, vendored — no CDN at runtime). It keeps native scroll,
   position:sticky and IntersectionObserver intact, which the ruler needs. */

let lenis = null;

function setupScroll(){
  if (reducedMotion || !window.Lenis) return;

  // CSS smooth scrolling and Lenis fight over the same gesture
  document.documentElement.style.scrollBehavior = 'auto';

  lenis = new Lenis({ duration: 1.05, smoothWheel: true, touchMultiplier: 1.5 });
  const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);

  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: -8 });
  });
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
  let morphing  = null;

  const doOpen = src => {
    img.src = src;
    box.hidden = false;
    document.body.style.overflow = 'hidden';
    close.focus();
  };
  const doShut = () => {
    box.hidden = true;
    img.removeAttribute('src');
    document.body.style.overflow = '';
  };

  // where supported the thumbnail grows into the lightbox instead of
  // cross-fading; everywhere else this is just a plain open
  const transition = fn => {
    if (!document.startViewTransition || reducedMotion) return fn();
    document.startViewTransition(fn);
  };

  const open = (src, thumb) => {
    lastFocus = document.activeElement;
    morphing = thumb;
    if (thumb) thumb.style.viewTransitionName = 'shot';
    transition(() => doOpen(src));
  };

  const shut = () => {
    transition(doShut);
    setTimeout(() => {
      if (morphing) morphing.style.viewTransitionName = '';
      morphing = null;
      lastFocus && lastFocus.focus();
    }, 400);
  };

  document.addEventListener('click', e => {
    const btn = e.target.closest('.shots button');
    if (btn) open(btn.dataset.full, btn.querySelector('img'));
  });
  box.addEventListener('click', shut);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !box.hidden) shut();
  });
}


/* --------- petals ---------
   Two uses of the same drawing: a slow drift behind the invitation, and one
   short burst when somebody says yes. Canvas, no library, and neither runs
   for anyone who has asked for reduced motion. */

const PETAL = {
  burst:  ['#FBF7EF', '#F5EBD0', '#CFB88C', '#E8DCC2'],
  // on cream paper a cream petal is invisible — the drift needs warmer tints
  drift:  ['#CFB88C', '#D8C7A4', '#A9B7A1', '#E0CFAA'],
  // the party photograph is full of stage lights; the section answers it
  bokeh:  ['#CFB88C', '#F5EBD0', '#A8515F', '#E8C48E']
};

function drawBokeh(ctx, b){
  const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
  g.addColorStop(0,   b.tint);
  g.addColorStop(0.55, b.tint + '55');
  g.addColorStop(1,   b.tint + '00');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
  ctx.fill();
}

function drawPetal(ctx, b){
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.a);
  ctx.fillStyle = b.tint;
  // two arcs meeting at a point, like the lily's spathe
  ctx.beginPath();
  ctx.moveTo(0, -b.r);
  ctx.quadraticCurveTo(b.r, 0, 0, b.r);
  ctx.quadraticCurveTo(-b.r * 0.45, 0, 0, -b.r);
  ctx.fill();
  ctx.restore();
}

function makeBits(n, w, h, cfg){
  return Array.from({ length: n }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    r: cfg.r[0] + Math.random() * (cfg.r[1] - cfg.r[0]),
    vy: cfg.vy[0] + Math.random() * (cfg.vy[1] - cfg.vy[0]),
    vx: -cfg.vx + Math.random() * cfg.vx * 2,
    spin: (Math.random() - 0.5) * cfg.spin,
    a: Math.random() * Math.PI * 2,
    tint: cfg.tints[(Math.random() * cfg.tints.length) | 0]
  }));
}

/* ── the slow drift, behind a section ── */

const drifts = [];
let driftRunning = false;

function drift(el, opts = {}){
  if (reducedMotion || !el) return;
  const cfg = {
    tints: PETAL.drift, alpha: 0.62, density: 21000, max: 30,
    r: [5, 11], vy: [9, 24], shape: 'petal', ...opts
  };

  const cv = document.createElement('canvas');
  cv.className = 'drift';
  cv.setAttribute('aria-hidden', 'true');
  el.append(cv);

  const layer = { el, cv, ctx: cv.getContext('2d'), bits: [], w: 0, h: 0, on: false,
                  alpha: cfg.alpha, shape: cfg.shape };

  const size = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const r = el.getBoundingClientRect();
    layer.w = r.width; layer.h = r.height;
    cv.width  = r.width  * dpr;
    cv.height = r.height * dpr;
    layer.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // density by area, so a tall section is not a busier one
    const n = Math.max(8, Math.min(cfg.max, Math.round(r.width * r.height / cfg.density)));
    layer.bits = makeBits(n, r.width, r.height, {
      r: cfg.r, vy: cfg.vy, vx: 6, spin: 0.7, tints: cfg.tints
    });
  };
  size();
  new ResizeObserver(size).observe(el);

  // only animate while the section is on screen
  new IntersectionObserver(es => { layer.on = es[0].isIntersecting; },
    { rootMargin: '120px' }).observe(el);

  drifts.push(layer);
  if (!driftRunning){ driftRunning = true; requestAnimationFrame(driftFrame); }
}

function driftFrame(){
  for (const L of drifts){
    if (!L.on) continue;
    L.ctx.clearRect(0, 0, L.w, L.h);
    L.ctx.globalAlpha = L.alpha;
    const paint = L.shape === 'bokeh' ? drawBokeh : drawPetal;
    for (const b of L.bits){
      b.y += b.vy / 60;
      b.x += Math.sin((b.y + b.a * 30) / 120) * (b.vx / 60);
      b.a += b.spin / 60;
      // lights rise, petals fall
      if (b.vy < 0 && b.y + b.r < 0){ b.y = L.h + b.r * 2; b.x = Math.random() * L.w; }
      if (b.vy > 0 && b.y - b.r > L.h){ b.y = -b.r * 2; b.x = Math.random() * L.w; }
      paint(L.ctx, b);
    }
  }
  requestAnimationFrame(driftFrame);
}

function setupDrift(){
  // over the video: pale, sparse and slow, so it reads as air rather than weather
  drift($('#hero'), {
    tints: PETAL.burst, alpha: 0.34, density: 62000, max: 16,
    r: [4, 8], vy: [7, 17]
  });
  ['#invite', '#countdown'].forEach(sel => drift($(sel)));

  // the ceremony: petals in the light
  drift($('#day-one'), {
    tints: PETAL.drift, alpha: 0.5, density: 34000, max: 20,
    r: [5, 10], vy: [8, 20]
  });

  // the celebration: slow bokeh rising, like the room's lights out of focus
  drift($('#day-two'), {
    shape: 'bokeh', tints: PETAL.bokeh, alpha: 0.2,
    density: 46000, max: 18, r: [16, 46], vy: [-14, -4]
  });
}

/* ── one burst, on a yes ── */

function petals(){
  if (reducedMotion) return;

  const cv = document.createElement('canvas');
  cv.className = 'petals';
  document.body.append(cv);
  const ctx = cv.getContext('2d');

  const dpr = Math.min(devicePixelRatio || 1, 2);
  const size = () => {
    cv.width  = innerWidth  * dpr;
    cv.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  size();
  addEventListener('resize', size);

  const bits = makeBits(42, innerWidth, innerHeight, {
    r: [5, 12], vy: [42, 97], vx: 14, spin: 2.6, tints: PETAL.burst
  });
  bits.forEach(b => { b.y = -40 - Math.random() * innerHeight * 0.6; });

  const START = performance.now();
  const LIFE  = 5200;

  const frame = now => {
    const t = now - START;
    if (t > LIFE){ cv.remove(); removeEventListener('resize', size); return; }

    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.globalAlpha = t > LIFE - 900 ? (LIFE - t) / 900 : 1;

    for (const b of bits){
      b.y += b.vy / 60;
      b.x += Math.sin((b.y + b.a * 40) / 90) * (b.vx / 60) + b.vx / 240;
      b.a += b.spin / 60;
      if (b.y > innerHeight + 40) b.y = -40;
      drawPetal(ctx, b);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}


/* --------- share --------- */

function setupShare(){
  const btn = $('#shareBtn');
  if (!btn) return;

  const url  = location.origin + location.pathname;   // never the personal link
  const data = {
    title: 'Pasindu & Nihara — 16 & 17 January 2027',
    text: 'Pasindu and Nihara are getting married. Here is the invitation.',
    url
  };

  if (!navigator.share && !navigator.clipboard){ btn.remove(); return; }

  btn.addEventListener('click', async () => {
    try{
      if (navigator.share) return await navigator.share(data);
      await navigator.clipboard.writeText(url);
      const was = btn.textContent;
      btn.textContent = 'Link copied';
      setTimeout(() => { btn.textContent = was; }, 2200);
    }catch{ /* the share sheet was dismissed */ }
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
    countInput.max = String(seats);
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

    // the form is novalidate, so the seat cap has to be applied here
    let count = 0;
    if (coming){
      count = countField.hidden
        ? (seats || 1)
        : Math.max(1, Math.floor(Number(countInput.value) || 1));
      if (seats) count = Math.min(count, seats);
    }

    const payload = {
      // a mistyped link finds no guest — post what it asked for rather than a
      // blank, so the row in the sheet can still be traced back to someone
      guestId:     guest ? guest.id : guestKeyAsked,
      displayName: guest ? guest.name : (form.querySelector('#rsvpFor')?.textContent || ''),
      church:      '',
      party:       coming ? 'yes' : 'no',
      count,
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
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      if (!body.ok) throw new Error(body.error || 'rejected');

      if (coming) petals();

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


/* ───────── music ─────────
   It starts when the seal is tapped, because that tap is the gesture browsers
   require before any sound. Low, looping, and one tap away from silence — and
   if a guest turns it off, it stays off next time they open the link. */

let audio = null;
let musicBtn = null;

function musicState(on){
  if (!musicBtn) return;
  musicBtn.setAttribute('aria-pressed', String(on));
  musicBtn.setAttribute('aria-label', on ? 'Turn the music off' : 'Turn the music on');
  musicBtn.classList.toggle('is-playing', on);
}

let fadeTimer = null;

function fadeTo(target, ms, done){
  if (!audio) return;
  clearInterval(fadeTimer);
  const from = audio.volume;
  const t0 = Date.now();
  // an interval rather than requestAnimationFrame: rAF stops in a background
  // tab, and a fade that never advances leaves the music playing at zero
  fadeTimer = setInterval(() => {
    const k = Math.min(1, (Date.now() - t0) / ms);
    audio.volume = Math.max(0, Math.min(1, from + (target - from) * k));
    if (k >= 1){
      clearInterval(fadeTimer);
      fadeTimer = null;
      if (done) done();
    }
  }, 50);
}

function startMusic(fromTap){
  if (!audio) return;
  // a guest who turned it off should not be asked twice
  try{
    if (!fromTap && localStorage.getItem('pn-music') === 'off') return;
  }catch{}

  audio.preload = 'auto';
  audio.play().then(() => {
    fadeTo(CONFIG.musicVolume, 2500);
    musicState(true);
    try{ localStorage.setItem('pn-music', 'on'); }catch{}
  }).catch(() => {
    // autoplay refused — arm the next tap anywhere on the page
    musicState(false);
    const arm = () => { document.removeEventListener('pointerdown', arm); startMusic(true); };
    document.addEventListener('pointerdown', arm, { once: true });
  });
}

function stopMusic(){
  if (!audio) return;
  fadeTo(0, 450, () => audio.pause());
  musicState(false);
  try{ localStorage.setItem('pn-music', 'off'); }catch{}
}

function setupMusic(){
  musicBtn = $('#musicToggle');
  if (!musicBtn) return;
  if (!CONFIG.music){ musicBtn.remove(); musicBtn = null; return; }

  audio = new Audio(CONFIG.music);
  audio.loop = true;
  audio.preload = 'none';
  audio.volume = 0;

  audio.addEventListener('error', () => {
    musicBtn?.remove();
    musicBtn = null;
    audio = null;
  }, { once: true });

  musicBtn.hidden = false;
  musicState(false);

  musicBtn.addEventListener('click', () => {
    if (!audio) return;
    audio.paused ? startMusic(true) : stopMusic();
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

  setupMusic();
  setupEnvelope();
  setupReveals();
  setupInviteLine();
  setupCountdown();
  setupScroll();
  setupDrift();
  setupTrack();
  setupGallery();
  setupLightbox();
  setupCalendar();
  setupRsvp();
  setupShare();
  setupThemeColour();
  devJump();
})();
