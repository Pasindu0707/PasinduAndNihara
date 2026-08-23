/* ═══════════════════════════════════════════════════════════
   Pasindu & Nihara — 16 & 17 January 2027
   ═══════════════════════════════════════════════════════════ */

const CONFIG = {
  // Google Apps Script web-app endpoint (Deploy → Web app → /exec URL)
  rsvpEndpoint: 'https://script.google.com/macros/s/AKfycbwJV6_u8w6rKijYoRoR7ZnozPnyj8zPAZiHqbSl5vygm-Fc6Hn7TNCBfoRXiqzwDZMVIQ/exec',
  ceremony: '2027-01-16T09:30:00+05:30',
  fallbackName: 'you and your family',
  galleryCount: 10,
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
  v.preload = 'auto';
  v.load();
  v.play().catch(() => { /* autoplay refused — poster stands in */ });
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
        '<p class="chapter__closer" style="margin:0">Today is the day.</p>';
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


/* ───────── gallery ───────── */

function setupGallery(){
  const rail = $('#galleryRail');
  if (!rail) return;

  const frag = document.createDocumentFragment();
  for (let i = 1; i <= CONFIG.galleryCount; i++){
    const n = String(i).padStart(2, '0');
    const img = new Image();
    img.src = `assets/img/gal-${n}-500.webp`;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.alt = 'Pasindu and Nihara over the years';
    img.width = 500; img.height = 700;
    img.onerror = () => img.remove();
    frag.append(img);
  }
  rail.append(frag);
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
        ? `<p class="chapter__closer" style="text-align:center;margin:0">
             Wonderful. We'll see you on the seventeenth.</p>`
        : `<p class="chapter__closer" style="text-align:center;margin:0">
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

  setupEnvelope();
  setupReveals();
  setupInviteLine();
  setupCountdown();
  setupGallery();
  setupCalendar();
  setupRsvp();
  setupMusic();
  setupThemeColour();
  devJump();
})();
