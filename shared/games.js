// محرك الألعاب المشترك بين الواجهتين.
// playActivity(container, activity, hooks) -> { destroy }
// hooks: { onFinish(result), onAnswer(ok, item), sfx(name), speak(text), hint(item) -> Promise<string>, golden }
import { h, shuffle, pick, norm, lettersOnly, withDistractors, tplById, fmtTime, THEMES } from './core.js';

const AR_LETTERS = 'ابتثجحخدذرزسشصضطظعغفقكلمنهويءةىأإآؤئ'.split('');
const EN_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const isArabic = (s) => /[؀-ۿ]/.test(s || '');

export function playActivity(container, act, hooks = {}) {
  const tpl = tplById(act.template);
  const theme = THEMES.find((t) => t.id === act.theme) || THEMES[0];
  const items = act.options?.shuffle === false ? [...act.items] : shuffle(act.items);
  const noop = () => {};
  const H = { onFinish: noop, onAnswer: noop, sfx: noop, ...hooks };
  const timers = new Set();
  let destroyed = false;
  const t0 = Date.now();
  const limit = Number(act.options?.timer) || 0;

  const scoreEl = h('span', { class: 'g-score' }, '0');
  const timeEl = h('span', { class: 'g-time' }, limit ? fmtTime(limit) : '0:00');
  const progEl = h('div', { class: 'g-progress-bar' });
  const body = h('div', { class: 'g-body' });
  const root = h('div', { class: `g-root g-tpl-${tpl.id}`, style: { '--g-bg': theme.bg, '--g-card': theme.card, '--g-accent': theme.accent }, 'data-theme': theme.id },
    h('div', { class: 'g-head' },
      h('div', { class: 'g-title' }, tpl.icon, ' ', act.title),
      h('div', { class: 'g-stats' }, h('span', {}, '⭐ ', scoreEl), h('span', {}, '⏱ ', timeEl))),
    h('div', { class: 'g-progress' }, progEl),
    act.instructions ? h('div', { class: 'g-instructions' }, act.instructions) : null,
    body);
  container.replaceChildren(root);

  const ctx = {
    root, body, act, items, H, golden: !!H.golden, score: 0, total: items.length, wrong: [], answered: 0,
    every(fn, ms) { const id = setInterval(() => !destroyed && fn(), ms); timers.add(id); return id; },
    after(fn, ms) { const id = setTimeout(() => !destroyed && fn(), ms); timers.add(id); return id; },
    clear(id) { clearInterval(id); clearTimeout(id); timers.delete(id); },
    setTotal(n) { this.total = n; this.progress(); },
    add(points = 1) { this.score += points; scoreEl.textContent = this.score; scoreEl.classList.remove('bump'); void scoreEl.offsetWidth; scoreEl.classList.add('bump'); },
    mark(ok, item) {
      this.answered++; if (ok) this.add(1); else if (item) this.wrong.push(item);
      H.sfx(ok ? 'correct' : 'wrong'); H.onAnswer(ok, item); this.progress();
    },
    progress(frac) { const f = frac ?? (this.total ? this.answered / this.total : 0); progEl.style.width = Math.min(100, f * 100) + '%'; },
    finish(extra = {}) {
      if (destroyed) return; destroyed = true; timers.forEach((id) => { clearInterval(id); clearTimeout(id); });
      const time = (Date.now() - t0) / 1000;
      H.sfx('win');
      H.onFinish({ score: this.score, total: this.total, time, wrong: this.wrong, template: tpl.id, ...extra });
    },
    tools(item) { // أدوات مساعدة: نطق + تلميح ذكي (الواجهة الذهبية)
      const wrap = h('div', { class: 'g-tools' });
      if (H.speak && item?.prompt) wrap.append(h('button', { class: 'g-tool', title: 'استمع', onclick: () => H.speak(item.prompt) }, '🔊'));
      if (H.hint && item) {
        const out = h('div', { class: 'g-hint-out' });
        wrap.append(h('button', { class: 'g-tool', onclick: async (e) => { e.currentTarget.disabled = true; out.textContent = '...'; out.textContent = await H.hint(item); } }, '💡 تلميح ذكي'), out);
      }
      return wrap;
    },
  };

  ctx.every(() => {
    const el = (Date.now() - t0) / 1000;
    if (limit) { const left = limit - el; timeEl.textContent = fmtTime(left); timeEl.classList.toggle('low', left < 10); if (left <= 0) ctx.finish({ timeout: true }); }
    else timeEl.textContent = fmtTime(el);
  }, 250);

  if (!items.length) { body.append(h('p', { class: 'g-empty' }, 'لا يوجد محتوى في هذا النشاط بعد.')); }
  else (GAMES[tpl.id] || GAMES.quiz)(ctx);

  return { destroy() { destroyed = true; timers.forEach((id) => { clearInterval(id); clearTimeout(id); }); }, ctx };
}

// ===== أدوات مشتركة =====
function feedback(el, ok) { el.classList.add(ok ? 'ok' : 'bad'); if (!ok) { el.classList.add('shake'); setTimeout(() => el.classList.remove('shake'), 500); } }
function nextBtn(label, fn) { return h('button', { class: 'g-btn g-next', onclick: fn }, label); }
// اختيار بالنقر ثم الإسقاط (يعمل على الجوال) + سحب وإفلات على الحاسوب
function makeSelectable(chips, targets, onDrop) {
  let selected = null;
  const select = (c) => { chips().forEach((x) => x.classList.remove('sel')); selected = c; c?.classList.add('sel'); };
  return {
    chip(c) {
      c.draggable = true;
      c.addEventListener('click', (e) => { e.stopPropagation(); select(selected === c ? null : c); });
      c.addEventListener('dragstart', (e) => { select(c); e.dataTransfer.setData('text/plain', '1'); });
    },
    target(t) {
      t.addEventListener('click', () => { if (selected) { onDrop(selected, t); select(null); } });
      t.addEventListener('dragover', (e) => { e.preventDefault(); t.classList.add('over'); });
      t.addEventListener('dragleave', () => t.classList.remove('over'));
      t.addEventListener('drop', (e) => { e.preventDefault(); t.classList.remove('over'); if (selected) { onDrop(selected, t); select(null); } });
    },
  };
}

// ===== القوالب =====
const GAMES = {};

// ---- اختبار ----
GAMES.quiz = (ctx, show = false) => {
  const qs = withDistractors(ctx.items);
  let i = 0;
  const step = () => {
    if (i >= qs.length) return ctx.finish();
    const it = qs[i];
    const opts = shuffle([it.answer, ...it.distractors]);
    const card = h('div', { class: 'g-card g-q' },
      h('div', { class: 'g-qnum' }, `السؤال ${i + 1} من ${qs.length}`),
      h('div', { class: 'g-prompt' }, it.prompt), ctx.tools(it),
      h('div', { class: 'g-options' }, opts.map((o, k) => h('button', {
        class: 'g-opt', 'data-k': 'أبجد'[k] || '',
        onclick: (e) => {
          const ok = norm(o) === norm(it.answer);
          card.querySelectorAll('.g-opt').forEach((b) => { b.disabled = true; if (norm(b.dataset.v) === norm(it.answer)) b.classList.add('ok'); });
          feedback(e.currentTarget, ok); ctx.mark(ok, it); i++; ctx.after(step, ok ? 700 : 1400);
        }, 'data-v': o,
      }, o))));
    ctx.body.replaceChildren(card);
  };
  step();
};

// ---- مسابقة تلفزيونية: مؤقت لكل سؤال + وسائل مساعدة + نقاط سرعة ----
GAMES.gameshow = (ctx) => {
  const qs = withDistractors(ctx.items);
  const life = { half: true, time: true, double: true };
  let i = 0, points = 0, doubleOn = false;
  ctx.add = function (p = 1) { points += p; this.score = points; ctx.root.querySelector('.g-score').textContent = points; };
  const step = () => {
    if (i >= qs.length) return ctx.finish({ points });
    const it = qs[i]; let left = 20; let done = false;
    const opts = shuffle([it.answer, ...it.distractors]);
    const bar = h('div', { class: 'g-countdown-fill' });
    const optWrap = h('div', { class: 'g-options' });
    const answer = (btn, o) => {
      if (done) return; done = true; ctx.clear(tick);
      const ok = o != null && norm(o) === norm(it.answer);
      optWrap.querySelectorAll('.g-opt').forEach((b) => { b.disabled = true; if (norm(b.dataset.v) === norm(it.answer)) b.classList.add('ok'); });
      if (btn) feedback(btn, ok);
      ctx.answered++; ctx.progress(); ctx.H.sfx(ok ? 'correct' : 'wrong'); ctx.H.onAnswer(ok, it);
      if (ok) ctx.add(Math.round((100 + left * 10) * (doubleOn ? 2 : 1))); else ctx.wrong.push(it);
      doubleOn = false; i++; ctx.after(step, 1300);
    };
    opts.forEach((o) => optWrap.append(h('button', { class: 'g-opt', 'data-v': o, onclick: (e) => answer(e.currentTarget, o) }, o)));
    const lifelines = h('div', { class: 'g-lifelines' },
      h('button', { class: 'g-life', disabled: !life.half, onclick: (e) => { life.half = false; e.currentTarget.disabled = true; let removed = 0; optWrap.querySelectorAll('.g-opt').forEach((b) => { if (removed < 2 && norm(b.dataset.v) !== norm(it.answer)) { b.style.visibility = 'hidden'; removed++; } }); } }, '50:50'),
      h('button', { class: 'g-life', disabled: !life.time, onclick: (e) => { life.time = false; e.currentTarget.disabled = true; left += 15; } }, '+15 ث'),
      h('button', { class: 'g-life', disabled: !life.double, onclick: (e) => { life.double = false; e.currentTarget.disabled = true; doubleOn = true; } }, '×2 نقاط'));
    ctx.body.replaceChildren(h('div', { class: 'g-card g-q g-show' },
      h('div', { class: 'g-qnum' }, `الجولة ${i + 1} / ${qs.length}`), h('div', { class: 'g-countdown' }, bar),
      h('div', { class: 'g-prompt' }, it.prompt), ctx.tools(it), optWrap, lifelines));
    const tick = ctx.every(() => { left -= 0.1; bar.style.width = Math.max(0, (left / 20) * 100) + '%'; if (left <= 0) answer(null, null); }, 100);
  };
  step();
};

// ---- صح أم خطأ ----
GAMES.truefalse = (ctx) => {
  const its = ctx.items; let i = 0;
  const step = () => {
    if (i >= its.length) return ctx.finish();
    const it = its[i];
    const others = its.filter((x) => x !== it);
    const truth = !others.length || Math.random() < 0.5;
    const shown = truth ? it.answer : pick(others).answer;
    let done = false;
    const fill = h('div', { class: 'g-countdown-fill' });
    const decide = (val, btn) => {
      if (done) return; done = true; ctx.clear(tick);
      const ok = val === truth; if (btn) feedback(btn, ok); ctx.mark(ok, it);
      note.textContent = truth ? '✔ العبارة صحيحة' : `✘ الصحيح: ${it.answer}`; i++; ctx.after(step, 1100);
    };
    const note = h('div', { class: 'g-note' });
    ctx.body.replaceChildren(h('div', { class: 'g-card g-tf' },
      h('div', { class: 'g-countdown' }, fill),
      h('div', { class: 'g-prompt' }, it.prompt), h('div', { class: 'g-tf-eq' }, '⟵'), h('div', { class: 'g-prompt g-alt' }, shown),
      h('div', { class: 'g-tf-btns' },
        h('button', { class: 'g-btn g-true', onclick: (e) => decide(true, e.currentTarget) }, '✔ صح'),
        h('button', { class: 'g-btn g-false', onclick: (e) => decide(false, e.currentTarget) }, '✘ خطأ')), note));
    let left = 7; const tick = ctx.every(() => { left -= 0.1; fill.style.width = (left / 7) * 100 + '%'; if (left <= 0) decide(null); }, 100);
  };
  step();
};

// ---- توصيل ----
GAMES.matchup = (ctx) => {
  const its = ctx.items.slice(0, 10); ctx.setTotal(its.length);
  const slots = its.map((it, k) => h('div', { class: 'g-slot', 'data-k': k }));
  const bank = h('div', { class: 'g-bank' });
  const chips = shuffle(its.map((it, k) => h('div', { class: 'g-chip', 'data-k': k }, it.answer)));
  const sel = makeSelectable(() => [...ctx.body.querySelectorAll('.g-chip')], null, (chip, target) => {
    const existing = target.classList.contains('g-slot') ? target.querySelector('.g-chip') : null;
    if (existing) bank.append(existing);
    target.append(chip); ctx.H.sfx('click');
  });
  chips.forEach((c) => { sel.chip(c); bank.append(c); });
  slots.forEach((s) => sel.target(s)); sel.target(bank);
  const submit = h('button', { class: 'g-btn g-next', onclick: () => {
    slots.forEach((s, k) => { const c = s.querySelector('.g-chip'); const ok = c && c.dataset.k == k; s.classList.add(ok ? 'ok' : 'bad'); ctx.mark(!!ok, its[k]); if (!ok) s.append(h('div', { class: 'g-correct' }, its[k].answer)); });
    submit.remove(); ctx.body.append(nextBtn('النتيجة', () => ctx.finish()));
  } }, 'تحقّق');
  ctx.body.replaceChildren(h('div', { class: 'g-match' },
    h('div', { class: 'g-match-rows' }, its.map((it, k) => h('div', { class: 'g-match-row' }, h('div', { class: 'g-term' }, it.prompt), slots[k]))), bank), submit);
};

// ---- أزواج الذاكرة ----
GAMES.memory = (ctx) => {
  const its = ctx.items.slice(0, 8); ctx.setTotal(its.length);
  let open = [], lock = false, found = 0, moves = 0;
  const cards = shuffle(its.flatMap((it, k) => [{ k, text: it.prompt }, { k, text: it.answer }])).map((c) => {
    const el = h('div', { class: 'g-mem' }, h('div', { class: 'g-mem-in' }, h('div', { class: 'g-mem-front' }, '?'), h('div', { class: 'g-mem-back' }, c.text)));
    el.addEventListener('click', () => {
      if (lock || el.classList.contains('flip')) return;
      el.classList.add('flip'); ctx.H.sfx('flip'); open.push([el, c]);
      if (open.length === 2) {
        moves++; lock = true; const [[a, ca], [b, cb]] = open;
        if (ca.k === cb.k) { a.classList.add('done'); b.classList.add('done'); found++; ctx.mark(true, its[ca.k]); open = []; lock = false; if (found === its.length) ctx.after(() => ctx.finish({ moves }), 700); }
        else ctx.after(() => { a.classList.remove('flip'); b.classList.remove('flip'); open = []; lock = false; ctx.H.sfx('wrong'); }, 900);
      }
    });
    return el;
  });
  ctx.body.replaceChildren(h('div', { class: 'g-grid g-mem-grid' }, cards));
};

// ---- ابحث عن المطابق ----
GAMES.findmatch = (ctx) => {
  const its = ctx.items.slice(0, 12); ctx.setTotal(its.length);
  const order = shuffle(its); let i = 0;
  const promptEl = h('div', { class: 'g-prompt' });
  const tiles = shuffle(its).map((it) => h('button', { class: 'g-tile', onclick: (e) => {
    const target = order[i]; const ok = it === target; const el = e.currentTarget;
    if (ok) { el.classList.add('gone'); ctx.mark(true, target); i++; i >= order.length ? ctx.after(() => ctx.finish(), 600) : show(); }
    else { feedback(el, false); ctx.H.sfx('wrong'); ctx.wrong.push(target); }
  } }, it.answer));
  const show = () => { promptEl.textContent = order[i].prompt; };
  show();
  ctx.body.replaceChildren(h('div', { class: 'g-card' }, h('div', { class: 'g-qnum' }, 'اضغط المطابق لـ:'), promptEl), h('div', { class: 'g-grid g-tiles' }, tiles));
};

// ---- بطاقات تعليمية ----
GAMES.flashcards = (ctx) => {
  let i = 0;
  const step = () => {
    if (i >= ctx.items.length) return ctx.finish();
    const it = ctx.items[i];
    const card = h('div', { class: 'g-flash', onclick: () => { card.classList.toggle('flip'); ctx.H.sfx('flip'); } },
      h('div', { class: 'g-flash-in' }, h('div', { class: 'g-flash-front' }, it.prompt), h('div', { class: 'g-flash-back' }, it.answer)));
    ctx.body.replaceChildren(h('div', { class: 'g-qnum' }, `البطاقة ${i + 1} / ${ctx.items.length} — اضغط البطاقة لقلبها`), card, ctx.tools(it),
      h('div', { class: 'g-tf-btns' },
        h('button', { class: 'g-btn g-false', onclick: () => { ctx.mark(false, it); i++; step(); } }, 'لم أعرفها'),
        h('button', { class: 'g-btn g-true', onclick: () => { ctx.mark(true, it); i++; step(); } }, 'عرفتها ✔')));
  };
  step();
};

// ---- قلب البلاطات ----
GAMES.fliptiles = (ctx) => {
  const seen = new Set();
  const tiles = ctx.items.map((it, k) => {
    const el = h('div', { class: 'g-mem g-flipt' }, h('div', { class: 'g-mem-in' }, h('div', { class: 'g-mem-front' }, it.prompt), h('div', { class: 'g-mem-back' }, it.answer)));
    el.onclick = () => { el.classList.toggle('flip'); ctx.H.sfx('flip'); if (!seen.has(k)) { seen.add(k); ctx.mark(true, it); } };
    return el;
  });
  ctx.body.replaceChildren(h('div', { class: 'g-grid g-flip-grid' }, tiles), nextBtn('إنهاء', () => ctx.finish()));
};

// ---- افتح الصندوق ----
GAMES.openbox = (ctx) => {
  let opened = 0;
  const modal = h('div', { class: 'g-modal hidden' });
  const boxes = ctx.items.map((it, k) => {
    const b = h('button', { class: 'g-box', onclick: () => {
      if (b.classList.contains('open')) return; b.classList.add('open'); ctx.H.sfx('pop');
      const ans = h('div', { class: 'g-prompt g-alt hidden' }, it.answer);
      modal.replaceChildren(h('div', { class: 'g-modal-card' },
        h('div', { class: 'g-prompt' }, it.prompt || it.answer), ctx.tools(it), ans,
        h('div', { class: 'g-tf-btns' },
          h('button', { class: 'g-btn', onclick: () => ans.classList.remove('hidden') }, 'اكشف الإجابة'),
          h('button', { class: 'g-btn g-true', onclick: () => close(true) }, '✔ صحيح'),
          h('button', { class: 'g-btn g-false', onclick: () => close(false) }, '✘ خطأ'))));
      modal.classList.remove('hidden');
      const close = (ok) => { modal.classList.add('hidden'); ctx.mark(ok, it); b.textContent = ok ? '✔' : '✘'; if (++opened === ctx.items.length) ctx.after(() => ctx.finish(), 500); };
    } }, String(k + 1));
    return b;
  });
  ctx.body.replaceChildren(h('div', { class: 'g-grid g-boxes' }, boxes), modal);
};

// ---- اضرب الخلد ----
GAMES.whackamole = (ctx) => {
  const its = ctx.items.slice(0, 10); ctx.setTotal(its.length); let i = 0;
  const holes = Array.from({ length: 9 }, () => h('div', { class: 'g-hole' }));
  const target = h('div', { class: 'g-prompt' });
  ctx.body.replaceChildren(h('div', { class: 'g-card' }, h('div', { class: 'g-qnum' }, 'اضرب الإجابة الصحيحة لـ:'), target), h('div', { class: 'g-grid g-holes' }, holes));
  let spawner, roundTimer;
  const round = () => {
    ctx.clear(spawner); ctx.clear(roundTimer); holes.forEach((x) => x.replaceChildren());
    if (i >= its.length) return ctx.finish();
    const it = its[i]; target.textContent = it.prompt;
    const pool = withDistractors(its)[its.indexOf(it)].distractors;
    let done = false;
    spawner = ctx.every(() => {
      const free = holes.filter((x) => !x.firstChild); if (!free.length) return;
      const hole = pick(free); const correct = Math.random() < 0.4;
      const mole = h('button', { class: 'g-mole' }, correct ? it.answer : pick(pool.length ? pool : [it.answer]));
      mole.onclick = () => {
        if (done) return; const ok = norm(mole.textContent) === norm(it.answer);
        mole.classList.add(ok ? 'hit' : 'miss'); ctx.H.sfx(ok ? 'pop' : 'wrong');
        if (ok) { done = true; ctx.mark(true, it); i++; ctx.after(round, 600); } else { ctx.score = Math.max(0, ctx.score - 0); ctx.wrong.push(it); }
      };
      hole.append(mole); ctx.after(() => mole.remove(), 1600);
    }, 650);
    roundTimer = ctx.after(() => { if (!done) { done = true; ctx.mark(false, it); i++; round(); } }, 10000);
  };
  round();
};

// ---- فرقعة البالونات ----
GAMES.balloonpop = (ctx) => {
  const qs = withDistractors(ctx.items); let i = 0;
  const sky = h('div', { class: 'g-sky' }); const target = h('div', { class: 'g-prompt' });
  ctx.body.replaceChildren(h('div', { class: 'g-card' }, h('div', { class: 'g-qnum' }, 'فرقع البالون الصحيح:'), target), sky);
  const colors = ['#ff6b6b', '#ffd93d', '#6bcB77', '#4d96ff', '#c77dff', '#ff9f45'];
  const step = () => {
    sky.replaceChildren(); if (i >= qs.length) return ctx.finish();
    const it = qs[i]; target.textContent = it.prompt; let tries = 0;
    shuffle([it.answer, ...it.distractors]).forEach((o, k) => {
      const b = h('button', { class: 'g-balloon', style: { left: (8 + k * 23) + '%', background: colors[(i + k) % colors.length], animationDelay: (k * 0.4) + 's' } }, o);
      b.onclick = () => {
        const ok = norm(o) === norm(it.answer); b.classList.add('popped');
        if (ok) { ctx.mark(tries === 0, it); ctx.H.sfx('pop'); i++; ctx.after(step, 500); } else { tries++; ctx.H.sfx('wrong'); }
      };
      b.addEventListener('animationend', () => { if (!b.classList.contains('popped') && sky.contains(b) && norm(o) === norm(it.answer)) { ctx.mark(false, it); i++; step(); } });
      sky.append(b);
    });
  };
  step();
};

// ---- البحث عن الكلمات ----
export function buildWordSearch(words, minSize = 10) {
  const W = words.map((w) => lettersOnly(w)).filter((w) => w.length >= 2 && w.length <= 14);
  const size = Math.max(minSize, ...W.map((w) => w.length + 1));
  const grid = Array.from({ length: size }, () => Array(size).fill(''));
  const dirs = [[1, 0], [0, 1], [1, 1], [-1, 0], [0, -1], [1, -1]];
  const placed = [];
  for (const w of [...W].sort((a, b) => b.length - a.length)) {
    let ok = false;
    for (let tries = 0; tries < 300 && !ok; tries++) {
      const [dx, dy] = pick(dirs); const x = Math.floor(Math.random() * size); const y = Math.floor(Math.random() * size);
      const ex = x + dx * (w.length - 1), ey = y + dy * (w.length - 1);
      if (ex < 0 || ey < 0 || ex >= size || ey >= size) continue;
      let fits = true;
      for (let k = 0; k < w.length; k++) { const c = grid[y + dy * k][x + dx * k]; if (c && c !== w[k]) { fits = false; break; } }
      if (!fits) continue;
      for (let k = 0; k < w.length; k++) grid[y + dy * k][x + dx * k] = w[k];
      placed.push({ word: w, x, y, dx, dy }); ok = true;
    }
  }
  const alpha = W.some(isArabic) ? AR_LETTERS.slice(0, 28) : EN_LETTERS;
  for (const row of grid) for (let x = 0; x < size; x++) if (!row[x]) row[x] = pick(alpha);
  return { grid, size, placed, rtl: W.some(isArabic) };
}

GAMES.wordsearch = (ctx) => {
  const its = ctx.items.slice(0, 12);
  const ws = buildWordSearch(its.map((i) => i.answer));
  ctx.setTotal(ws.placed.length);
  const cells = []; let start = null;
  const gridEl = h('div', { class: 'g-ws', dir: ws.rtl ? 'rtl' : 'ltr', style: { gridTemplateColumns: `repeat(${ws.size}, 1fr)` } });
  ws.grid.forEach((row, y) => row.forEach((c, x) => { const el = h('div', { class: 'g-ws-cell', 'data-x': x, 'data-y': y }, c); cells.push(el); gridEl.append(el); }));
  const cell = (x, y) => cells[y * ws.size + x];
  const clueEls = new Map();
  const clues = h('ul', { class: 'g-clues' }, ws.placed.map((p) => {
    const it = its.find((i) => lettersOnly(i.answer) === p.word);
    const li = h('li', {}, it?.prompt ? `${it.prompt}` : p.word); clueEls.set(p.word, li); return li;
  }));
  const found = new Set();
  gridEl.addEventListener('click', (e) => {
    const el = e.target.closest('.g-ws-cell'); if (!el) return;
    const x = +el.dataset.x, y = +el.dataset.y;
    if (!start) { start = { x, y, el }; el.classList.add('sel'); return; }
    start.el.classList.remove('sel');
    const dx = Math.sign(x - start.x), dy = Math.sign(y - start.y);
    const len = Math.max(Math.abs(x - start.x), Math.abs(y - start.y)) + 1;
    const straight = (x - start.x === 0 || y - start.y === 0 || Math.abs(x - start.x) === Math.abs(y - start.y));
    let word = ''; const path = [];
    if (straight) for (let k = 0; k < len; k++) { const c = cell(start.x + dx * k, start.y + dy * k); word += c.textContent; path.push(c); }
    const rev = [...word].reverse().join('');
    const hit = ws.placed.find((p) => !found.has(p.word) && (p.word === word || p.word === rev));
    if (hit) { found.add(hit.word); path.forEach((c) => c.classList.add('found')); clueEls.get(hit.word).classList.add('done'); clueEls.get(hit.word).append(' — ', hit.word); ctx.mark(true); if (found.size === ws.placed.length) ctx.after(() => ctx.finish(), 700); }
    else { path.forEach((c) => feedback(c, false)); setTimeout(() => path.forEach((c) => c.classList.remove('bad')), 500); }
    start = null;
  });
  ctx.body.replaceChildren(h('div', { class: 'g-ws-wrap' }, gridEl, h('div', { class: 'g-card' }, h('h4', {}, 'الكلمات المطلوبة'), clues, h('p', { class: 'g-note' }, 'اضغط أول حرف ثم آخر حرف في الكلمة.'))),
    nextBtn('إنهاء', () => { ws.placed.forEach((p) => { if (!found.has(p.word)) ctx.wrong.push(its.find((i) => lettersOnly(i.answer) === p.word)); }); ctx.finish(); }));
};

// ---- الكلمات المتقاطعة ----
export function buildCrossword(items, attempts = 60) {
  // عدة محاولات بترتيبات مختلفة، ونختار التخطيط الذي يضم أكبر عدد من الكلمات بأصغر مساحة
  let best = null;
  for (let a = 0; a < attempts; a++) {
    const r = buildCrosswordOnce(items, a > 0);
    const score = r.placed.length * 1000 - r.w * r.h;
    if (!best || score > best.score) best = { ...r, score };
    if (r.skipped === 0 && a > 10) break;
  }
  return best;
}

function buildCrosswordOnce(items, randomize) {
  const list0 = items.map((it) => ({ ...it, w: lettersOnly(it.answer) })).filter((x) => x.w.length >= 2 && x.w.length <= 15).sort((a, b) => b.w.length - a.w.length).slice(0, 14);
  const list = randomize ? [list0[Math.floor(Math.random() * Math.min(3, list0.length))], ...shuffle(list0)].filter((x, i, arr) => arr.indexOf(x) === i) : list0;
  const cells = new Map(); const key = (x, y) => x + ',' + y; const placed = [];
  const can = (w, x, y, dir) => {
    const [dx, dy] = dir === 'a' ? [1, 0] : [0, 1]; let cross = 0;
    if (cells.has(key(x - dx, y - dy)) || cells.has(key(x + dx * w.length, y + dy * w.length))) return -1;
    for (let k = 0; k < w.length; k++) {
      const cx = x + dx * k, cy = y + dy * k; const c = cells.get(key(cx, cy));
      if (c) { if (c.ch !== w[k] || c[dir]) return -1; cross++; }
      else if (cells.has(key(cx + dy, cy + dx)) || cells.has(key(cx - dy, cy - dx))) return -1;
    }
    return cross;
  };
  const put = (it, x, y, dir) => {
    const [dx, dy] = dir === 'a' ? [1, 0] : [0, 1];
    for (let k = 0; k < it.w.length; k++) { const kk = key(x + dx * k, y + dy * k); const c = cells.get(kk) || { ch: it.w[k] }; c[dir] = true; cells.set(kk, c); }
    placed.push({ ...it, x, y, dir });
  };
  if (!list.length) return { placed: [], cells, w: 0, h: 0, skipped: 0 };
  put(list[0], 0, 0, 'a');
  for (const it of list.slice(1)) {
    let best = null;
    for (const p of placed) for (let i = 0; i < p.w.length; i++) for (let j = 0; j < it.w.length; j++) {
      if (p.w[i] !== it.w[j]) continue;
      const dir = p.dir === 'a' ? 'd' : 'a';
      const px = p.dir === 'a' ? p.x + i : p.x, py = p.dir === 'a' ? p.y : p.y + i;
      const x = dir === 'a' ? px - j : px, y = dir === 'd' ? py - j : py;
      const sc = can(it.w, x, y, dir); if (sc > 0 && (!best || sc > best.sc)) best = { x, y, dir, sc };
    }
    if (best) put(it, best.x, best.y, best.dir);
  }
  const xs = [...cells.keys()].map((k) => +k.split(',')[0]), ys = [...cells.keys()].map((k) => +k.split(',')[1]);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const norm2 = new Map(); for (const [k, v] of cells) { const [x, y] = k.split(',').map(Number); norm2.set(key(x - minX, y - minY), v); }
  placed.forEach((p) => { p.x -= minX; p.y -= minY; });
  // ترقيم
  const starts = [...new Set(placed.map((p) => key(p.x, p.y)))].sort((a, b) => { const [ax, ay] = a.split(',').map(Number), [bx, by] = b.split(',').map(Number); return ay - by || ax - bx; });
  placed.forEach((p) => { p.num = starts.indexOf(key(p.x, p.y)) + 1; });
  return { placed, cells: norm2, w: Math.max(...xs) - minX + 1, h: Math.max(...ys) - minY + 1, skipped: list.length - placed.length, rtl: list.some((x) => isArabic(x.w)) };
}

GAMES.crossword = (ctx) => {
  const cw = buildCrossword(ctx.items); ctx.setTotal(cw.placed.length);
  const gridEl = h('div', { class: 'g-cw', dir: cw.rtl ? 'rtl' : 'ltr', style: { gridTemplateColumns: `repeat(${cw.w}, minmax(26px, 40px))` } });
  const inputs = new Map(); let dir = 'a';
  for (let y = 0; y < cw.h; y++) for (let x = 0; x < cw.w; x++) {
    const c = cw.cells.get(x + ',' + y);
    if (!c) { gridEl.append(h('div', { class: 'g-cw-empty' })); continue; }
    const num = cw.placed.find((p) => p.x === x && p.y === y)?.num;
    const inp = h('input', { class: 'g-cw-in', maxlength: 1, 'data-x': x, 'data-y': y, autocomplete: 'off' });
    inp.addEventListener('focus', () => { if (!c[dir]) dir = c.a ? 'a' : 'd'; });
    inp.addEventListener('input', () => { inp.value = inp.value.slice(-1).toUpperCase(); const nx = dir === 'a' ? x + 1 : x, ny = dir === 'd' ? y + 1 : y; inputs.get(nx + ',' + ny)?.focus(); });
    inputs.set(x + ',' + y, inp);
    gridEl.append(h('div', { class: 'g-cw-cell' }, num ? h('span', { class: 'g-cw-num' }, num) : null, inp));
  }
  const clueList = (d, title) => h('div', {}, h('h4', {}, title), h('ul', { class: 'g-clues g-cw-list' }, cw.placed.filter((p) => p.dir === d).sort((a, b) => a.num - b.num).map((p) => h('li', { onclick: () => { dir = d; inputs.get(p.x + ',' + p.y)?.focus(); } }, `${p.num}. ${p.prompt || '؟'} (${p.w.length})`))));
  const check = () => {
    let good = 0;
    cw.placed.forEach((p) => {
      const [dx, dy] = p.dir === 'a' ? [1, 0] : [0, 1]; let ok = true;
      for (let k = 0; k < p.w.length; k++) { const inp = inputs.get((p.x + dx * k) + ',' + (p.y + dy * k)); if (norm(inp.value) !== norm(p.w[k])) ok = false; }
      if (ok) good++; else ctx.wrong.push(p);
      for (let k = 0; k < p.w.length; k++) inputs.get((p.x + dx * k) + ',' + (p.y + dy * k)).parentElement.classList.add(ok ? 'ok' : 'bad');
    });
    ctx.score = good; ctx.answered = cw.placed.length; ctx.finish();
  };
  ctx.body.replaceChildren(h('div', { class: 'g-cw-wrap' }, gridEl, h('div', { class: 'g-card g-cw-clues' }, clueList('a', cw.rtl ? 'أفقياً' : 'أفقي'), clueList('d', 'عمودياً'),
    cw.skipped ? h('p', { class: 'g-note' }, `تعذّر إدراج ${cw.skipped} كلمة لعدم وجود تقاطع.`) : null)),
  h('div', { class: 'g-tf-btns' }, h('button', { class: 'g-btn', onclick: () => cw.placed.forEach((p) => { const [dx, dy] = p.dir === 'a' ? [1, 0] : [0, 1]; const k = Math.floor(Math.random() * p.w.length); const inp = inputs.get((p.x + dx * k) + ',' + (p.y + dy * k)); if (!inp.value) inp.value = p.w[k]; }) }, 'كشف حروف'), nextBtn('تحقّق وأنهِ', check)));
};

// ---- خمّن الكلمة ----
GAMES.hangman = (ctx) => {
  let i = 0; const maxLives = Number(ctx.act.options?.lives) || 6;
  const step = () => {
    if (i >= ctx.items.length) return ctx.finish();
    const it = ctx.items[i]; const word = lettersOnly(it.answer); const guessed = new Set(); let lives = maxLives;
    const wordEl = h('div', { class: 'g-hang-word', dir: isArabic(word) ? 'rtl' : 'ltr' });
    const livesEl = h('div', { class: 'g-lives' });
    const fig = h('div', { class: 'g-hang-fig' });
    const render = () => {
      wordEl.replaceChildren(...[...word].map((c) => h('span', { class: 'g-hang-ch' }, guessed.has(c) ? c : '')));
      livesEl.textContent = '❤'.repeat(lives) + '♡'.repeat(maxLives - lives);
      fig.style.setProperty('--stage', maxLives - lives); fig.textContent = ['🙂', '😐', '😟', '😧', '😨', '😰', '😵'][Math.min(6, Math.round(((maxLives - lives) / maxLives) * 6))];
    };
    const end = (ok) => { ctx.mark(ok, it); wordEl.replaceChildren(...[...word].map((c) => h('span', { class: 'g-hang-ch ' + (ok ? 'ok' : 'bad') }, c))); i++; ctx.after(step, 1300); };
    const letters = (isArabic(word) ? AR_LETTERS : EN_LETTERS).filter((c) => c !== 'ء' || word.includes('ء'));
    const keys = h('div', { class: 'g-keys' }, letters.map((c) => h('button', { class: 'g-key', onclick: (e) => {
      if (lives <= 0) return; e.currentTarget.disabled = true; guessed.add(c);
      if (word.includes(c)) { ctx.H.sfx('click'); e.currentTarget.classList.add('ok'); } else { lives--; ctx.H.sfx('wrong'); e.currentTarget.classList.add('bad'); }
      render(); if ([...word].every((x) => guessed.has(x))) end(true); else if (lives <= 0) end(false);
    } }, c)));
    render();
    ctx.body.replaceChildren(h('div', { class: 'g-card' }, h('div', { class: 'g-qnum' }, `الكلمة ${i + 1} / ${ctx.items.length}`), h('div', { class: 'g-prompt' }, it.prompt || 'خمّن الكلمة'), ctx.tools(it), fig, livesEl, wordEl), keys);
  };
  step();
};

// ---- ترتيب الحروف ----
GAMES.anagram = (ctx) => {
  let i = 0;
  const step = () => {
    if (i >= ctx.items.length) return ctx.finish();
    const it = ctx.items[i]; const word = lettersOnly(it.answer);
    let letters = shuffle([...word]); if (letters.join('') === word && word.length > 1) letters = [...word].reverse();
    const out = h('div', { class: 'g-slots', dir: isArabic(word) ? 'rtl' : 'ltr' });
    const pool = h('div', { class: 'g-slots g-pool', dir: isArabic(word) ? 'rtl' : 'ltr' });
    letters.forEach((c) => { const b = h('button', { class: 'g-letter' }, c); b.onclick = () => { (b.parentElement === pool ? out : pool).append(b); ctx.H.sfx('click'); if (!pool.children.length) check(); }; pool.append(b); });
    const check = () => {
      const ok = [...out.children].map((b) => b.textContent).join('') === word; feedback(out, ok); ctx.mark(ok, it);
      if (!ok) out.after(h('div', { class: 'g-correct' }, 'الصحيح: ' + word)); i++; ctx.after(step, ok ? 800 : 1600);
    };
    ctx.body.replaceChildren(h('div', { class: 'g-card' }, h('div', { class: 'g-qnum' }, `${i + 1} / ${ctx.items.length}`), h('div', { class: 'g-prompt' }, it.prompt || 'رتّب الحروف'), ctx.tools(it), out, pool));
  };
  step();
};

// ---- اكتب الإجابة ----
GAMES.typeanswer = (ctx) => {
  let i = 0;
  const step = () => {
    if (i >= ctx.items.length) return ctx.finish();
    const it = ctx.items[i];
    const inp = h('input', { class: 'g-input', placeholder: 'اكتب إجابتك...', autocomplete: 'off' });
    const res = h('div', { class: 'g-note' });
    const submit = () => {
      if (inp.disabled) return; inp.disabled = true;
      const ok = norm(inp.value) === norm(it.answer); feedback(inp, ok); ctx.mark(ok, it);
      res.textContent = ok ? 'أحسنت!' : `الإجابة الصحيحة: ${it.answer}`; i++; ctx.after(step, ok ? 800 : 1700);
    };
    inp.addEventListener('keydown', (e) => e.key === 'Enter' && submit());
    ctx.body.replaceChildren(h('div', { class: 'g-card' }, h('div', { class: 'g-qnum' }, `${i + 1} / ${ctx.items.length}`), h('div', { class: 'g-prompt' }, it.prompt), ctx.tools(it), inp, h('button', { class: 'g-btn g-next', onclick: submit }, 'تحقّق'), res));
    inp.focus();
  };
  step();
};

// ---- ترتيب الجملة ----
GAMES.unjumble = (ctx) => {
  let i = 0;
  const step = () => {
    if (i >= ctx.items.length) return ctx.finish();
    const it = ctx.items[i]; const words = it.answer.split(/\s+/).filter(Boolean);
    let mixed = shuffle(words); if (mixed.join(' ') === words.join(' ') && words.length > 1) mixed = [...words].reverse();
    const out = h('div', { class: 'g-slots g-sentence' }); const pool = h('div', { class: 'g-slots g-pool' });
    mixed.forEach((w) => { const b = h('button', { class: 'g-chip' }, w); b.onclick = () => { (b.parentElement === pool ? out : pool).append(b); ctx.H.sfx('click'); }; pool.append(b); });
    const check = () => {
      const ok = [...out.children].map((b) => b.textContent).join(' ') === words.join(' ') && !pool.children.length; feedback(out, ok); ctx.mark(ok, it);
      if (!ok) out.after(h('div', { class: 'g-correct' }, it.answer)); i++; ctx.after(step, ok ? 800 : 2000);
    };
    ctx.body.replaceChildren(h('div', { class: 'g-card' }, h('div', { class: 'g-qnum' }, `الجملة ${i + 1} / ${ctx.items.length}`), it.prompt ? h('div', { class: 'g-note' }, it.prompt) : null, ctx.tools({ ...it, prompt: it.prompt || '' }), out, pool, nextBtn('تحقّق', check)));
  };
  step();
};

// ---- الكلمة المفقودة ----
GAMES.missingword = (ctx) => {
  const data = ctx.items.map((it) => { const ws = it.answer.split(/\s+/); const idx = ws.reduce((b, w, k) => (w.length > ws[b].length ? k : b), 0); return { it, ws, idx, missing: ws[idx] }; });
  let i = 0;
  const step = () => {
    if (i >= data.length) return ctx.finish();
    const d = data[i];
    const opts = shuffle([...new Set([d.missing, ...shuffle(data.filter((x) => x !== d).map((x) => x.missing)).slice(0, 3), ...(d.it.distractors || [])])].slice(0, 4));
    const gap = h('span', { class: 'g-gap' }, '_____');
    ctx.body.replaceChildren(h('div', { class: 'g-card' }, h('div', { class: 'g-qnum' }, `${i + 1} / ${data.length}`),
      h('div', { class: 'g-prompt' }, d.ws.map((w, k) => (k === d.idx ? gap : w + ' '))), ctx.tools({ ...d.it, prompt: d.it.prompt || d.ws.map((w, k) => (k === d.idx ? '...' : w)).join(' ') }),
      h('div', { class: 'g-options' }, opts.map((o) => h('button', { class: 'g-opt', onclick: (e) => {
        const ok = o === d.missing; gap.textContent = d.missing + ' '; gap.classList.add(ok ? 'ok' : 'bad'); feedback(e.currentTarget, ok);
        e.currentTarget.parentElement.querySelectorAll('button').forEach((b) => (b.disabled = true)); ctx.mark(ok, d.it); i++; ctx.after(step, ok ? 800 : 1500);
      } }, o)))));
  };
  step();
};

// ---- تصنيف المجموعات ----
GAMES.groupsort = (ctx) => {
  const groups = [...new Set(ctx.items.map((i) => i.group || 'عام'))];
  const its = ctx.items; let placed = 0;
  const bins = groups.map((g) => h('div', { class: 'g-bin', 'data-g': g }, h('div', { class: 'g-bin-title' }, g), h('div', { class: 'g-bin-items' })));
  const pool = h('div', { class: 'g-bank' });
  const firstTry = new Set();
  const sel = makeSelectable(() => [...pool.querySelectorAll('.g-chip')], null, (chip, bin) => {
    if (!bin.classList.contains('g-bin')) return;
    const it = its[chip.dataset.k]; const ok = (it.group || 'عام') === bin.dataset.g;
    if (ok) { bin.querySelector('.g-bin-items').append(chip); chip.classList.add('ok'); chip.draggable = false; ctx.mark(!firstTry.has(chip.dataset.k), it); if (++placed === its.length) ctx.after(() => ctx.finish(), 600); }
    else { firstTry.add(chip.dataset.k); feedback(chip, false); ctx.H.sfx('wrong'); }
  });
  shuffle(its.map((it, k) => h('div', { class: 'g-chip', 'data-k': k }, it.answer))).forEach((c) => { sel.chip(c); pool.append(c); });
  bins.forEach((b) => sel.target(b));
  ctx.body.replaceChildren(pool, h('div', { class: 'g-bins' }, bins));
};

// ---- الترتيب الصحيح ----
GAMES.rankorder = (ctx) => {
  const its = ctx.act.items; // الترتيب الأصلي هو الصحيح
  ctx.setTotal(its.length);
  let order = shuffle(its.map((_, k) => k)); if (order.every((v, k) => v === k) && its.length > 1) order.reverse();
  const list = h('ol', { class: 'g-rank' });
  let dragFrom = null;
  const render = () => list.replaceChildren(...order.map((k, pos) => {
    const li = h('li', { class: 'g-rank-item', draggable: true },
      h('span', { class: 'g-rank-txt' }, its[k].answer, its[k].prompt ? h('small', {}, ' — ' + its[k].prompt) : null),
      h('span', {}, h('button', { class: 'g-mini', onclick: () => move(pos, -1) }, '▲'), h('button', { class: 'g-mini', onclick: () => move(pos, 1) }, '▼')));
    li.addEventListener('dragstart', () => (dragFrom = pos));
    li.addEventListener('dragover', (e) => e.preventDefault());
    li.addEventListener('drop', () => { if (dragFrom == null) return; const [m] = order.splice(dragFrom, 1); order.splice(pos, 0, m); dragFrom = null; render(); });
    return li;
  }));
  const move = (pos, d) => { const t = pos + d; if (t < 0 || t >= order.length) return; [order[pos], order[t]] = [order[t], order[pos]]; ctx.H.sfx('click'); render(); };
  render();
  ctx.body.replaceChildren(h('div', { class: 'g-card' }, h('div', { class: 'g-note' }, 'رتّب العناصر من الأول إلى الأخير (اسحب أو استخدم الأسهم).'), list),
    nextBtn('تحقّق', (e) => {
      [...list.children].forEach((li, pos) => { const ok = order[pos] === pos; li.classList.add(ok ? 'ok' : 'bad'); ctx.mark(ok, its[order[pos]]); });
      e.currentTarget.remove(); ctx.body.append(nextBtn('النتيجة', () => ctx.finish()));
    }));
};

// ---- العجلة الدوّارة ----
GAMES.wheel = (ctx) => {
  let pool = [...ctx.act.items]; let angle = 0; let spinning = false;
  const cv = h('canvas', { class: 'g-wheel', width: 420, height: 420 });
  const result = h('div', { class: 'g-prompt g-wheel-res' }, 'اضغط «أدِر»');
  const removeChk = h('input', { type: 'checkbox', checked: true });
  const colors = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#c77dff', '#ff9f45', '#2ec4b6', '#f72585'];
  const draw = () => {
    const g = cv.getContext('2d'); const n = pool.length || 1; const r = 200; g.clearRect(0, 0, 420, 420);
    g.save(); g.translate(210, 210); g.rotate(angle);
    pool.forEach((it, k) => {
      const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
      g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r, a0, a1); g.fillStyle = colors[k % colors.length]; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke();
      g.save(); g.rotate((a0 + a1) / 2); g.textAlign = 'right'; g.fillStyle = '#1b1b1b'; g.font = 'bold 16px Tajawal, sans-serif';
      g.fillText(String(it.answer).slice(0, 18), r - 14, 6); g.restore();
    });
    g.restore();
    g.beginPath(); g.moveTo(400, 210); g.lineTo(424, 198); g.lineTo(424, 222); g.fillStyle = '#222'; g.fill();
  };
  const spin = () => {
    if (spinning || !pool.length) return; spinning = true; ctx.H.sfx('click');
    const start = angle, delta = Math.PI * 2 * (5 + Math.random() * 3), dur = 3800, t0 = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / dur); angle = start + delta * (1 - Math.pow(1 - t, 3)); draw();
      if (t < 1) return requestAnimationFrame(tick);
      spinning = false; const n = pool.length; const a = ((-angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const idx = Math.floor((a / (Math.PI * 2)) * n) % n; const it = pool[idx];
      result.textContent = it.answer + (it.prompt ? ' — ' + it.prompt : ''); ctx.H.sfx('pop'); ctx.mark(true, it);
      if (ctx.H.speak) ctx.H.speak(it.answer);
      if (removeChk.checked) { pool.splice(idx, 1); ctx.after(draw, 1200); }
    };
    requestAnimationFrame(tick);
  };
  draw();
  ctx.body.replaceChildren(h('div', { class: 'g-wheel-wrap' }, cv, h('div', { class: 'g-card' }, result,
    h('button', { class: 'g-btn g-next', onclick: spin }, '🎡 أدِر'), h('label', { class: 'g-note' }, removeChk, ' إزالة العنصر بعد اختياره'), nextBtn('إنهاء', () => ctx.finish()))));
};

// ---- بطاقات المحادثة ----
GAMES.speakingcards = (ctx) => {
  let deck = shuffle(ctx.act.items);
  const card = h('div', { class: 'g-speak-card' }, 'اضغط «اسحب بطاقة»');
  const draw = () => {
    if (!deck.length) { card.textContent = 'انتهت البطاقات 🎉'; return; }
    const it = deck.pop(); card.classList.remove('deal'); void card.offsetWidth; card.classList.add('deal');
    card.replaceChildren(h('div', { class: 'g-prompt' }, it.answer), it.prompt ? h('div', { class: 'g-note' }, it.prompt) : '');
    ctx.mark(true, it); ctx.H.sfx('flip');
  };
  ctx.body.replaceChildren(h('div', { class: 'g-speak' }, card, h('div', { class: 'g-tf-btns' }, h('button', { class: 'g-btn', onclick: draw }, '🂠 اسحب بطاقة'), h('button', { class: 'g-btn', onclick: () => { deck = shuffle(ctx.act.items); card.textContent = 'تم خلط البطاقات'; } }, '🔀 خلط'), nextBtn('إنهاء', () => ctx.finish()))));
};

export const GAME_IDS = Object.keys(GAMES);
