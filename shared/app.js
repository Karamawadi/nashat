// تطبيق الشاشات المشترك: يُشغَّل بوضع 'classic' أو 'golden'.
// الواجهة الذهبية = كل ما في الكلاسيكية + ذكاء اصطناعي + تلعيب + تحليلات + أوراق عمل متقدمة + مؤثرات.
import { $, h, shuffle, uid, TEMPLATES, tplById, KIND_LABELS, THEMES, newActivity, blankItem, cleanItems, store, encodeShare, decodeShare, router, go, fmtTime } from './core.js';
import { playActivity } from './games.js';
import { communityActivities, sampleTopicNames } from './bank.js';
import { WORKSHEET_TYPES, renderWorksheet } from './worksheets.js';
import { aiStatus, generateActivity, improveActivity, getHint, explain, coach } from './ai.js';
import { loadBook, subjects, subjectById, unitActivity, activityFromId, importBook, clearCustomBook, customBook, CSV_TEMPLATE, exportBookJSON } from './library.js';

export async function start(mode) {
  await loadBook();
  const G = mode === 'golden';
  const app = $('#app');
  let current = null; // اللعبة الجارية
  const community = communityActivities();
  const findAct = (id) => store.get(id) || community.find((a) => a.id === id) || activityFromId(id);

  // ---------------- الصوت والنطق والمؤثرات ----------------
  let actx = null; let muted = localStorage.getItem('nashat.muted') === '1';
  const tone = (freq, dur = 0.12, type = 'sine', vol = 0.12, delay = 0) => {
    if (muted) return; try {
      actx ||= new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain(); o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, actx.currentTime + delay); g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + delay + dur);
      o.connect(g).connect(actx.destination); o.start(actx.currentTime + delay); o.stop(actx.currentTime + delay + dur + 0.02);
    } catch { /* لا صوت */ }
  };
  const sfx = (n) => {
    if (n === 'correct') { tone(660, 0.1, 'triangle'); tone(990, 0.15, 'triangle', 0.1, 0.08); if (G) sparkle(); }
    else if (n === 'wrong') tone(180, 0.22, 'sawtooth', 0.06);
    else if (n === 'win') [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.2, 'triangle', 0.12, i * 0.12));
    else if (n === 'pop') tone(880, 0.06, 'square', 0.06);
    else if (n === 'flip') tone(420, 0.05, 'triangle', 0.06);
    else tone(520, 0.04, 'sine', 0.05);
  };
  const speak = (text) => {
    if (!('speechSynthesis' in window)) return; speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.lang = /[؀-ۿ]/.test(text) ? 'ar-SA' : 'en-US'; u.rate = 0.95; speechSynthesis.speak(u);
  };
  function confetti(n = 140) {
    const cv = h('canvas', { class: 'fx-confetti' }); document.body.append(cv);
    const c = cv.getContext('2d'); cv.width = innerWidth; cv.height = innerHeight;
    const colors = ['#f5c542', '#ffe08a', '#d4a017', '#fff', '#ff6b6b', '#4d96ff', '#6bcb77'];
    const ps = Array.from({ length: n }, () => ({ x: innerWidth / 2, y: innerHeight / 3, vx: (Math.random() - 0.5) * 16, vy: Math.random() * -14 - 4, r: Math.random() * 6 + 3, c: colors[Math.floor(Math.random() * colors.length)], a: Math.random() * 6 }));
    let f = 0; const loop = () => { c.clearRect(0, 0, cv.width, cv.height); ps.forEach((p) => { p.vy += 0.35; p.x += p.vx; p.y += p.vy; p.a += 0.2; c.save(); c.translate(p.x, p.y); c.rotate(p.a); c.fillStyle = p.c; c.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); c.restore(); }); if (++f < 170) requestAnimationFrame(loop); else cv.remove(); }; loop();
  }
  function sparkle() { const s = h('div', { class: 'fx-sparkle' }, '✦'); s.style.left = (30 + Math.random() * 40) + '%'; document.body.append(s); setTimeout(() => s.remove(), 900); }
  function toast(msg, kind = '') { const t = h('div', { class: 'toast ' + kind }, msg); document.body.append(t); setTimeout(() => t.classList.add('show'), 10); setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2600); }

  // ---------------- الإطار العام ----------------
  const NAV = [['#/', 'الرئيسية', '🏠'], ['#/create', 'إنشاء نشاط', '➕'], ['#/library', 'المكتبة المرجعية', '📚'], ['#/my', 'أنشطتي', '📁'], ['#/community', 'المجتمع', '🌍'], ['#/worksheets', 'أوراق العمل', '🖨️']];
  if (G) NAV.splice(2, 0, ['#/ai', 'استوديو الذكاء', '✨']), NAV.push(['#/stats', 'تقدّمي', '📈']);
  const header = h('header', { class: 'topbar' },
    h('a', { class: 'brand', href: '#/' }, h('span', { class: 'logo' }, G ? '◆' : '■'), h('span', {}, 'نشاط'), h('small', {}, G ? 'الواجهة الذهبية' : 'الواجهة الكلاسيكية')),
    h('nav', { class: 'nav' }, NAV.map(([href, label, icon]) => h('a', { href, 'data-href': href }, h('span', { class: 'ni' }, icon), label))),
    h('div', { class: 'top-actions' },
      G ? h('span', { class: 'xp-pill', id: 'xpPill' }) : null,
      h('button', { class: 'icon-btn', title: 'الصوت', onclick: (e) => { muted = !muted; localStorage.setItem('nashat.muted', muted ? '1' : '0'); e.currentTarget.textContent = muted ? '🔇' : '🔊'; } }, muted ? '🔇' : '🔊'),
      h('a', { class: 'switch-ui', href: (G ? '../classic/index.html' : '../golden/index.html') + location.hash }, G ? 'الكلاسيكية' : '✦ الذهبية')));
  const main = h('main', { class: 'page' });
  const footer = h('footer', { class: 'foot' }, 'منصة نشاط — أنشطة تعليمية تفاعلية وأوراق عمل · ', h('a', { href: '../index.html' }, 'تغيير الواجهة'));
  app.replaceChildren(header, main, footer);
  const setActive = () => header.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('active', location.hash.startsWith(a.dataset.href) && (a.dataset.href !== '#/' || ['', '#/', '#'].includes(location.hash))));
  const updateXP = () => { if (!G) return; const p = store.profile(); const lvl = level(p.xp); $('#xpPill').textContent = `◆ مستوى ${lvl.n} · ${p.xp} XP`; };
  const level = (xp) => { let n = 1, need = 100, base = 0; while (xp >= base + need) { base += need; n++; need = Math.round(need * 1.3); } return { n, into: xp - base, need }; };

  const page = (...kids) => { current?.destroy?.(); current = null; main.replaceChildren(...kids.flat().filter(Boolean)); setActive(); updateXP(); };
  const section = (title, sub, ...kids) => h('section', { class: 'sec' }, h('div', { class: 'sec-head' }, h('h2', {}, title), sub ? h('p', {}, sub) : null), ...kids.filter(Boolean));

  // ---------------- بطاقة نشاط ----------------
  function actCard(a, actions = 'community') {
    const t = tplById(a.template);
    return h('div', { class: 'act-card', 'data-theme': a.theme },
      h('div', { class: 'act-thumb', style: { background: (THEMES.find((x) => x.id === a.theme) || THEMES[0]).bg } }, h('span', {}, t.icon), h('em', {}, t.name)),
      h('div', { class: 'act-info' }, h('h3', {}, a.title), h('p', {}, `${a.items.length} عنصر · ${a.author || ''} · ▶ ${a.plays || 0}`)),
      h('div', { class: 'act-actions' },
        h('a', { class: 'btn sm primary', href: '#/play/' + a.id }, '▶ تشغيل'),
        actions === 'mine' ? [
          h('a', { class: 'btn sm', href: '#/edit/' + a.id }, '✎ تعديل'),
          h('a', { class: 'btn sm', href: '#/print/' + a.id }, '🖨 طباعة'),
          h('button', { class: 'btn sm', onclick: () => shareDialog(a) }, '🔗 مشاركة'),
          h('button', { class: 'btn sm', onclick: () => { const c = { ...structuredClone(a), id: uid(), title: a.title + ' (نسخة)', plays: 0 }; store.save(c); toast('تم النسخ'); routeAgain(); } }, '⧉ نسخ'),
          h('button', { class: 'btn sm danger', onclick: () => { ask('حذف «' + a.title + '»؟', () => { store.remove(a.id); routeAgain(); }); } }, '🗑'),
        ] : [
          h('button', { class: 'btn sm', onclick: () => { const c = { ...structuredClone(a), id: uid(), author: 'أنا', plays: 0 }; store.save(c); toast('أُضيف إلى أنشطتك'); go('/edit/' + c.id); } }, '⧉ تعديل نسخة'),
          h('a', { class: 'btn sm', href: '#/print/' + a.id }, '🖨'),
        ]));
  }
  const routeAgain = () => window.dispatchEvent(new HashChangeEvent('hashchange'));

  function shareDialog(a) {
    const url = location.href.split('#')[0] + '#/s/' + encodeShare(a);
    const inp = h('input', { class: 'inp', value: url, readonly: true });
    modal(h('div', {}, h('h3', {}, '🔗 مشاركة النشاط'), h('p', {}, 'أي شخص يفتح هذا الرابط يمكنه لعب النشاط وحفظ نسخة منه.'), inp,
      h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: async () => { try { await navigator.clipboard.writeText(url); toast('تم نسخ الرابط'); } catch { inp.select(); } } }, 'نسخ الرابط'),
        h('a', { class: 'btn', href: '#/s/' + encodeShare(a), onclick: closeModal }, 'فتح'))));
  }
  let modalEl = null;
  function modal(content) { closeModal(); modalEl = h('div', { class: 'modal', onclick: (e) => e.target === modalEl && closeModal() }, h('div', { class: 'modal-card' }, h('button', { class: 'modal-x', onclick: closeModal }, '×'), content)); document.body.append(modalEl); }
  function closeModal() { modalEl?.remove(); modalEl = null; }
  // تأكيد داخل الصفحة (confirm قد يكون معطلاً في بعض بيئات العرض)
  function ask(msg, onYes) { modal(h('div', {}, h('h3', {}, msg), h('div', { class: 'row' }, h('button', { class: 'btn danger', onclick: () => { closeModal(); onYes(); } }, 'نعم'), h('button', { class: 'btn', onclick: closeModal }, 'إلغاء')))); }

  // ---------------- الرئيسية ----------------
  function home() {
    const mine = store.all();
    const hero = G
      ? h('div', { class: 'hero gold' },
        h('div', { class: 'hero-text' }, h('h1', {}, 'اصنع درساً تفاعلياً كاملاً ', h('span', { class: 'shine' }, 'في ثوانٍ')),
          h('p', {}, 'اكتب موضوعاً أو الصق نصاً، وسيُنشئ الذكاء الاصطناعي الأسئلة والألعاب وأوراق العمل ومفاتيح الإجابة — ثم بدّل بين 22 قالباً بنقرة.'),
          aiQuickBox()),
        h('div', { class: 'hero-art' }, TEMPLATES.slice(0, 9).map((t, i) => h('div', { class: 'orb', style: { animationDelay: i * 0.3 + 's' } }, t.icon))))
      : h('div', { class: 'hero' }, h('div', { class: 'hero-text' }, h('h1', {}, 'أنشئ أنشطة تعليمية تفاعلية بسهولة'),
        h('p', {}, 'اختبارات، ألعاب توصيل، بحث عن الكلمات، كلمات متقاطعة وأكثر. أدخل المحتوى مرة واحدة وبدّل القالب متى شئت، ثم اطبعه كورقة عمل.'),
        h('div', { class: 'row' }, h('a', { class: 'btn primary lg', href: '#/create' }, '➕ إنشاء نشاط'), h('a', { class: 'btn lg', href: '#/community' }, 'تصفّح المجتمع'))));
    page(hero,
      mine.length ? section('أحدث أنشطتك', null, h('div', { class: 'cards' }, mine.slice(0, 4).map((a) => actCard(a, 'mine')))) : null,
      section('المواد الدراسية', 'نماذج جاهزة من الكتاب المرجعي لكل مادة — العب أو اطبع بنقرة.', subjectGrid()),
      section('القوالب', 'اختر قالباً لتبدأ — يمكنك تبديله لاحقاً دون إعادة إدخال المحتوى.', templateGrid()),
      section('مختارات من المجتمع', null, h('div', { class: 'cards' }, community.slice(0, 4).map((a) => actCard(a)))),
      section('لماذا نشاط؟', null, h('div', { class: 'features' }, (G ? [
        ['✨', 'توليد بالذكاء الاصطناعي', 'من موضوع أو نص أو درس كامل، بمستويات صعوبة متعددة.'],
        ['🧠', 'تلميحات وشرح ذكي', 'تلميح عند الحاجة، وشرح للأخطاء، ومدرب شخصي بعد كل نشاط.'],
        ['🏅', 'تلعيب كامل', 'نقاط خبرة ومستويات وأوسمة ولوحات متصدرين.'],
        ['🖨️', '14 نوعاً من أوراق العمل', 'أوراق متعددة الأقسام، مفاتيح إجابة، تمايز بثلاثة مستويات.'],
        ['📈', 'تحليلات التقدم', 'دقتك في كل قالب ومراجعة ذكية لنقاط الضعف.'],
        ['🔊', 'نطق ومؤثرات', 'قراءة الأسئلة بصوت عالٍ، مؤثرات صوتية وبصرية.'],
      ] : [
        ['🎮', '22 قالباً', 'اختبارات وألعاب ونشاطات صفية متنوعة.'],
        ['🔁', 'تبديل القالب', 'نفس المحتوى يعمل في كل القوالب.'],
        ['🖨️', 'أوراق عمل', 'اطبع أي نشاط كورقة عمل.'],
        ['🔗', 'مشاركة', 'رابط واحد لطلابك.'],
      ]).map(([i, t, d]) => h('div', { class: 'feature' }, h('div', { class: 'fi' }, i), h('h4', {}, t), h('p', {}, d))))));
  }

  function templateGrid(onPick) {
    return h('div', { class: 'tpl-grid' }, TEMPLATES.map((t) => h('a', { class: 'tpl', href: onPick ? null : '#/edit/new?t=' + t.id, onclick: onPick ? (e) => { e.preventDefault(); onPick(t); } : null },
      h('div', { class: 'tpl-icon' }, t.icon), h('h4', {}, t.name), h('p', {}, t.desc))));
  }

  // ---------------- مربع الذكاء السريع (ذهبي) ----------------
  function aiQuickBox() {
    const topic = h('input', { class: 'inp lg', placeholder: 'مثال: الكسور للصف الرابع، أو: حيوانات المزرعة بالإنجليزية', list: 'topicList' });
    const tsel = h('select', { class: 'inp' }, TEMPLATES.map((t) => h('option', { value: t.id }, t.icon + ' ' + t.name)));
    const btn = h('button', { class: 'btn gold lg', onclick: async () => {
      if (!topic.value.trim()) { topic.focus(); return; }
      btn.disabled = true; btn.textContent = '✨ جارٍ الإنشاء...';
      try { const act = await aiCreate({ topic: topic.value, template: tsel.value, count: 10 }); go('/play/' + act.id); }
      finally { btn.disabled = false; btn.textContent = '✨ أنشئ النشاط'; }
    } }, '✨ أنشئ النشاط');
    topic.addEventListener('keydown', (e) => e.key === 'Enter' && btn.click());
    return h('div', { class: 'ai-quick' }, topic, tsel, btn, h('datalist', { id: 'topicList' }, sampleTopicNames().map((n) => h('option', { value: n }))), aiBadge());
  }
  function aiBadge() {
    const b = h('div', { class: 'ai-badge' }, '…');
    aiStatus().then((s) => { b.textContent = s.enabled ? `● متصل بـ Claude` : '● وضع محلي (أضف ANTHROPIC_API_KEY على الخادم لتفعيل Claude)'; b.classList.add(s.enabled ? 'on' : 'off'); });
    return b;
  }
  async function aiCreate({ topic, template, count = 10, level, difficulty, sourceText, extra, language }) {
    const kind = tplById(template).kind;
    const out = await generateActivity({ topic, kind, count, level, difficulty, sourceText, extra, language });
    if (out.warning) toast(out.warning, 'warn');
    const act = { ...newActivity(template), title: out.title || topic, instructions: out.instructions || '', items: cleanItems(out.items), theme: 'space', tags: ['ai'] };
    if (out.source !== 'ai') toast(out.source === 'book' ? '📚 تم الإنشاء من الكتاب المرجعي' : out.source === 'bank' ? 'تم الإنشاء من بنك المحتوى المحلي' : 'تم إنشاء مسودة محلية — راجعها وعدّلها', 'warn');
    store.save(act); return act;
  }

  // ---------------- إنشاء ----------------
  function create() {
    page(section('اختر قالباً', 'كل القوالب تستخدم نفس المحتوى — ابدأ بأي قالب.', templateGrid()),
      G ? section('أو دع الذكاء الاصطناعي يبدأ عنك', null, aiQuickBox()) : null);
  }

  // ---------------- المحرر ----------------
  function editor({ id, t }) {
    let act = id === 'new' ? newActivity(t || 'quiz') : structuredClone(findAct(id) || newActivity());
    if (id !== 'new' && !store.get(id)) { act.id = uid(); act.author = 'أنا'; }
    const tpl = () => tplById(act.template);
    const rowsEl = h('div', { class: 'rows' });
    const titleIn = h('input', { class: 'inp lg', value: act.title, oninput: (e) => (act.title = e.target.value) });
    const instIn = h('input', { class: 'inp', value: act.instructions, placeholder: 'تعليمات للطالب (اختياري)', oninput: (e) => (act.instructions = e.target.value) });
    const kindSel = h('div', { class: 'tpl-pick' });

    const renderRows = () => {
      const kind = tpl().kind; const L = KIND_LABELS[kind];
      rowsEl.replaceChildren(...act.items.map((it, k) => {
        const f = (field, label, wide) => h('input', { class: 'inp' + (wide ? ' wide' : ''), placeholder: label, value: field === 'distractors' ? it.distractors.join('، ') : it[field] || '',
          oninput: (e) => { it[field] = field === 'distractors' ? e.target.value.split(/[,،]/).map((s) => s.trim()).filter(Boolean) : e.target.value; } });
        const fields = [];
        if (kind === 'qa') fields.push(f('prompt', L.prompt, true), f('answer', L.answer), f('distractors', L.distractors, true));
        else if (kind === 'groups') fields.push(f('answer', L.answer), f('group', L.group));
        else if (kind === 'words' || kind === 'sentences' || kind === 'list') fields.push(f('answer', L.answer, kind === 'sentences'), f('prompt', L.prompt, true));
        else fields.push(f('prompt', L.prompt), f('answer', L.answer));
        if (G) fields.push(f('hint', '💡 تلميح (اختياري)'));
        return h('div', { class: 'row-item' }, h('span', { class: 'num' }, k + 1), h('div', { class: 'fields' }, fields),
          h('div', { class: 'row-ctl' },
            h('button', { class: 'icon-btn', title: 'أعلى', onclick: () => { if (k) { [act.items[k - 1], act.items[k]] = [act.items[k], act.items[k - 1]]; renderRows(); } } }, '▲'),
            h('button', { class: 'icon-btn', title: 'حذف', onclick: () => { act.items.splice(k, 1); renderRows(); } }, '✕')));
      }));
      kindSel.replaceChildren(h('span', {}, tpl().icon, ' ', tpl().name), h('button', { class: 'btn sm', onclick: () => modal(h('div', {}, h('h3', {}, 'تغيير القالب'), templateGrid((nt) => { act.template = nt.id; closeModal(); renderRows(); }))) }, 'تغيير'));
    };
    renderRows();

    const bulk = h('textarea', { class: 'inp', rows: 5, placeholder: 'لصق سريع: سطر لكل عنصر، وافصل الحقول بـ | \nمثال: عاصمة مصر | القاهرة | الجيزة، أسوان' });
    const importBulk = () => {
      const kind = tpl().kind;
      const added = bulk.value.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
        const [a, b = '', c = ''] = l.split(/\s*[|\t]\s*/);
        if (kind === 'qa') return { ...blankItem(), prompt: a, answer: b, distractors: c.split(/[,،]/).map((s) => s.trim()).filter(Boolean) };
        if (kind === 'groups') return { ...blankItem(), answer: a, group: b };
        if (['words', 'sentences', 'list'].includes(kind)) return { ...blankItem(), answer: a, prompt: b };
        return { ...blankItem(), prompt: a, answer: b };
      });
      act.items = act.items.filter((i) => i.answer || i.prompt).concat(added); bulk.value = ''; renderRows(); toast(`أُضيف ${added.length} عنصر`);
    };

    const timerIn = h('input', { class: 'inp sm', type: 'number', min: 0, value: act.options.timer || 0, oninput: (e) => (act.options.timer = +e.target.value) });
    const shufIn = h('input', { type: 'checkbox', checked: act.options.shuffle !== false, onchange: (e) => (act.options.shuffle = e.target.checked) });
    const themeSel = h('select', { class: 'inp', onchange: (e) => (act.theme = e.target.value) }, THEMES.map((t) => h('option', { value: t.id, selected: t.id === act.theme }, t.name)));

    const save = (thenPlay) => {
      act.items = cleanItems(act.items);
      if (!act.items.length) { toast('أضف عنصراً واحداً على الأقل', 'warn'); act.items = [blankItem()]; renderRows(); return; }
      store.save(act); toast('تم الحفظ ✔'); go(thenPlay ? '/play/' + act.id : '/my');
    };

    // لوحة الذكاء الاصطناعي في المحرر (ذهبي)
    const aiPanel = G ? (() => {
      const topic = h('input', { class: 'inp', placeholder: 'الموضوع', value: act.title !== 'نشاط بلا عنوان' ? act.title : '' });
      const count = h('input', { class: 'inp sm', type: 'number', value: 10, min: 3, max: 30 });
      const level = h('select', { class: 'inp' }, ['', 'رياض الأطفال', 'ابتدائي مبكر', 'ابتدائي عليا', 'متوسط', 'ثانوي', 'جامعي'].map((l) => h('option', { value: l }, l || 'المرحلة')));
      const diff = h('select', { class: 'inp' }, ['سهل', 'متوسط', 'صعب', 'تحدٍّ'].map((l) => h('option', { value: l, selected: l === 'متوسط' }, l)));
      const src = h('textarea', { class: 'inp', rows: 3, placeholder: 'اختياري: الصق نص الدرس ليُبنى النشاط عليه فقط' });
      const busy = async (btn, fn) => { const t0 = btn.textContent; btn.disabled = true; btn.textContent = '✨ ...'; try { await fn(); } catch (e) { toast(e.message, 'warn'); } finally { btn.disabled = false; btn.textContent = t0; } };
      const apply = (out, replace = true) => { if (out.title) { act.title = out.title; titleIn.value = out.title; } if (out.instructions) { act.instructions = out.instructions; instIn.value = out.instructions; } act.items = replace ? out.items : act.items.concat(out.items); renderRows(); toast(out.source === 'ai' ? '✨ تم بواسطة Claude' : 'تم بالمولّد المحلي', out.source === 'ai' ? '' : 'warn'); };
      const gen = h('button', { class: 'btn gold', onclick: (e) => busy(e.currentTarget, async () => apply(await generateActivity({ topic: topic.value, kind: tpl().kind, count: +count.value, level: level.value, difficulty: diff.value, sourceText: src.value }))) }, '✨ توليد المحتوى');
      const quick = (label, instr) => h('button', { class: 'btn sm', onclick: (e) => busy(e.currentTarget, async () => apply(await improveActivity(act, tpl().kind, instr))) }, label);
      return h('div', { class: 'panel ai-panel' }, h('h3', {}, '✨ مساعد الذكاء الاصطناعي'), aiBadge(),
        h('div', { class: 'grid2' }, topic, h('div', { class: 'row' }, level, diff, count)), src, gen,
        h('div', { class: 'row wrap' }, quick('🪄 حسّن وأكمل الناقص', ''), quick('⬇ أسهل', 'اجعل المحتوى أسهل لمستوى أصغر مع الحفاظ على العدد'), quick('⬆ أصعب', 'اجعل المحتوى أصعب وأعمق مع الحفاظ على العدد'),
          quick('🌐 إلى الإنجليزية', 'ترجم كل المحتوى إلى الإنجليزية'), quick('🌐 إلى العربية', 'ترجم كل المحتوى إلى العربية الفصحى'), quick('💡 أضف تلميحات', 'أضف تلميحاً مفيداً لكل عنصر دون تغيير بقية الحقول'),
          quick('➕ 5 عناصر إضافية', 'أعد المحتوى نفسه مع إضافة 5 عناصر جديدة غير مكررة في النهاية')));
    })() : null;

    page(h('div', { class: 'editor' },
      h('div', { class: 'editor-main' },
        h('div', { class: 'panel' }, h('label', { class: 'lbl' }, 'عنوان النشاط'), titleIn, instIn, h('div', { class: 'row' }, h('span', { class: 'lbl' }, 'القالب:'), kindSel)),
        aiPanel,
        h('div', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h3', {}, 'المحتوى'), h('span', { class: 'muted' }, 'الحقول تتغير حسب نوع القالب')), rowsEl,
          h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => { act.items.push(blankItem()); renderRows(); } }, '+ إضافة عنصر'), h('button', { class: 'btn', onclick: () => { act.items = shuffle(act.items); renderRows(); } }, '🔀 خلط')),
          h('details', { class: 'bulk' }, h('summary', {}, '📋 استيراد سريع من نص'), bulk, h('button', { class: 'btn', onclick: importBulk }, 'استيراد')))),
      h('aside', { class: 'editor-side panel' }, h('h3', {}, 'الخيارات'),
        h('label', { class: 'lbl' }, 'المؤقت (ثوانٍ، 0 = بلا حد)'), timerIn,
        h('label', { class: 'chk' }, shufIn, ' خلط ترتيب العناصر'),
        h('label', { class: 'lbl' }, 'السمة'), themeSel,
        h('button', { class: 'btn primary block', onclick: () => save(true) }, '✔ تم — شغّل النشاط'),
        h('button', { class: 'btn block', onclick: () => save(false) }, '💾 حفظ فقط'))));
  }

  // ---------------- اللعب ----------------
  function play({ id }, sharedAct) {
    const act = sharedAct || findAct(id);
    if (!act) return page(section('النشاط غير موجود', null, h('a', { class: 'btn', href: '#/' }, 'العودة')));
    let tplId = act.template, themeId = act.theme;
    const stage = h('div', { class: 'stage' });
    const switcher = h('div', { class: 'switcher' });
    const board = h('div', { class: 'panel board' });
    const renderBoard = () => { const b = store.board(act.id); board.replaceChildren(h('h3', {}, '🏆 لوحة المتصدرين'), b.length ? h('ol', { class: 'lb' }, b.slice(0, 10).map((e) => h('li', {}, h('b', {}, e.name), h('span', {}, `${e.score}/${e.total} · ${fmtTime(e.time)}`)))) : h('p', { class: 'muted' }, 'لا نتائج بعد — كن الأول!')); };
    const startGame = () => {
      current?.destroy?.();
      const run = { ...act, template: tplId, theme: themeId };
      current = playActivity(stage, run, {
        golden: G, sfx, speak: G ? speak : null, hint: G ? getHint : null,
        onAnswer: (ok) => { if (G && ok) addXP(5, false); },
        onFinish: (r) => finishScreen(run, r),
      });
    };
    const renderSwitcher = () => switcher.replaceChildren(
      h('div', { class: 'sw-group' }, h('span', { class: 'lbl' }, 'بدّل القالب:'), h('div', { class: 'sw-list' }, TEMPLATES.map((t) => h('button', { class: 'sw' + (t.id === tplId ? ' on' : ''), title: t.name, onclick: () => { tplId = t.id; renderSwitcher(); startGame(); } }, h('span', {}, t.icon), h('small', {}, t.name))))),
      h('div', { class: 'sw-group' }, h('span', { class: 'lbl' }, 'السمة:'), THEMES.map((t) => h('button', { class: 'theme-dot' + (t.id === themeId ? ' on' : ''), title: t.name, style: { background: t.bg, borderColor: t.accent }, onclick: () => { themeId = t.id; renderSwitcher(); startGame(); } }))));
    function finishScreen(run, r) {
      store.bumpPlays(act.id);
      const pct = r.total ? Math.round((r.score / r.total) * 100) : 100;
      const nameIn = h('input', { class: 'inp', placeholder: 'اسمك', value: store.profile().name || '' });
      const coachEl = G ? h('div', { class: 'coach' }, h('b', {}, '🧠 المدرب الذكي: '), h('span', {}, '...')) : null;
      const wrongs = (r.wrong || []).filter(Boolean);
      if (G) {
        const p = store.profile(); p.history.push({ id: act.id, title: act.title, template: run.template, score: r.score, total: r.total, pct, time: Math.round(r.time), at: Date.now(), wrong: wrongs.slice(0, 10).map((w) => ({ prompt: w.prompt || '', answer: w.answer || w.w || '' })) });
        p.history = p.history.slice(-200); store.saveProfile(p);
        const gained = 20 + Math.round(pct / 2) + (pct === 100 ? 30 : 0); addXP(gained, true); checkBadges(r, pct, run);
        coach(r, run).then((t) => (coachEl.lastChild.textContent = t));
        if (pct >= 70) confetti();
      }
      stage.replaceChildren(h('div', { class: 'result' },
        h('div', { class: 'result-ring', style: { '--p': pct } }, h('span', {}, pct + '%')),
        h('h2', {}, pct === 100 ? 'ممتاز! علامة كاملة 🎉' : pct >= 70 ? 'أحسنت! 👏' : 'محاولة جيدة 💪'),
        h('p', {}, `النتيجة: ${r.points ?? r.score} ${r.points != null ? 'نقطة' : 'من ' + r.total} · الوقت: ${fmtTime(r.time)}${r.timeout ? ' (انتهى الوقت)' : ''}`),
        coachEl,
        h('div', { class: 'row center' }, nameIn, h('button', { class: 'btn primary', onclick: (e) => { const p = store.profile(); p.name = nameIn.value || 'مجهول'; store.saveProfile(p); store.addScore(act.id, { name: p.name, score: r.points ?? r.score, total: r.points != null ? '' : r.total, time: r.time }); e.currentTarget.disabled = true; renderBoard(); toast('سُجّلت نتيجتك'); } }, 'سجّل في لوحة المتصدرين')),
        G && wrongs.length ? h('div', { class: 'review' }, h('h3', {}, '🔍 راجع أخطاءك'), wrongs.slice(0, 8).map((w) => {
          const ex = h('div', { class: 'ex' });
          return h('div', { class: 'rv' }, h('span', {}, `${w.prompt || ''} ← `, h('b', {}, w.answer || w.w || '')), h('button', { class: 'btn sm', onclick: async (e) => { e.currentTarget.disabled = true; ex.textContent = '...'; ex.textContent = await explain({ prompt: w.prompt, answer: w.answer || w.w }); } }, '🧠 اشرح لي'), ex);
        }), h('button', { class: 'btn gold', onclick: () => { const a2 = { ...newActivity('flashcards'), title: 'مراجعة: ' + act.title, items: wrongs.map((w) => ({ ...blankItem(), prompt: w.prompt || '', answer: w.answer || w.w || '', distractors: w.distractors || [] })), theme: 'space' }; store.save(a2); go('/play/' + a2.id); } }, '🔁 تدرّب على أخطائي فقط')) : null,
        h('div', { class: 'row center' },
          h('button', { class: 'btn primary lg', onclick: startGame }, '↻ العب مجدداً'),
          h('a', { class: 'btn', href: '#/print/' + act.id }, '🖨 ورقة عمل'),
          store.get(act.id) ? h('a', { class: 'btn', href: '#/edit/' + act.id }, '✎ تعديل') : h('button', { class: 'btn', onclick: () => { const c = { ...structuredClone(act), id: uid(), author: 'أنا' }; store.save(c); toast('حُفظ في أنشطتك'); } }, '💾 احفظ في أنشطتي'))));
    }
    renderSwitcher(); renderBoard();
    page(h('div', { class: 'play-layout' },
      h('div', { class: 'play-main' }, h('div', { class: 'play-top' }, h('h1', {}, act.title), h('div', { class: 'row' },
        h('button', { class: 'btn sm', onclick: () => (document.fullscreenElement ? document.exitFullscreen() : stage.requestFullscreen?.()) }, '⛶ ملء الشاشة'),
        h('button', { class: 'btn sm', onclick: () => shareDialog(act) }, '🔗 مشاركة'))), stage, switcher),
      h('aside', { class: 'play-side' }, board, h('div', { class: 'panel' }, h('h3', {}, 'عن النشاط'), h('p', { class: 'muted' }, `${act.items.length} عنصر · ${act.author || ''}`), act.instructions ? h('p', {}, act.instructions) : null))));
    startGame();
  }

  // ---------------- التلعيب (ذهبي) ----------------
  function addXP(n, announce) { const p = store.profile(); const before = level(p.xp).n; p.xp += n; store.saveProfile(p); updateXP(); const after = level(p.xp).n; if (announce) toast(`+${n} XP`); if (after > before) { toast(`🎉 ارتقيت إلى المستوى ${after}!`); confetti(220); } }
  const BADGES = [
    ['first', '🥉', 'البداية', 'أكمل أول نشاط', (p) => p.history.length >= 1],
    ['ten', '🥈', 'مثابر', 'أكمل 10 أنشطة', (p) => p.history.length >= 10],
    ['perfect', '💎', 'الكمال', 'علامة كاملة', (p, r, pct) => pct === 100],
    ['speed', '⚡', 'البرق', 'أنهِ نشاطاً بدقة 80%+ في أقل من 30 ثانية', (p, r, pct) => pct >= 80 && r.time < 30],
    ['explorer', '🧭', 'المستكشف', 'جرّب 5 قوالب مختلفة', (p) => new Set(p.history.map((x) => x.template)).size >= 5],
    ['master', '👑', 'الأستاذ', 'اجمع 1000 XP', (p) => p.xp >= 1000],
  ];
  function checkBadges(r, pct) { const p = store.profile(); BADGES.forEach(([id, icon, name, , test]) => { if (!p.badges.includes(id) && test(p, r, pct)) { p.badges.push(id); toast(`${icon} وسام جديد: ${name}`); } }); store.saveProfile(p); }

  // ---------------- أنشطتي ----------------
  function my() {
    const q = h('input', { class: 'inp', placeholder: '🔍 ابحث في أنشطتك...' });
    const grid = h('div', { class: 'cards' });
    const render = () => { const list = store.all().filter((a) => !q.value || a.title.includes(q.value)); grid.replaceChildren(...(list.length ? list.map((a) => actCard(a, 'mine')) : [h('div', { class: 'empty' }, h('p', {}, 'لا توجد أنشطة بعد.'), h('a', { class: 'btn primary', href: '#/create' }, '➕ أنشئ أول نشاط'))])); };
    q.oninput = render; render();
    page(section('أنشطتي', `${store.all().length} نشاط محفوظ على هذا الجهاز`, h('div', { class: 'row' }, q, h('a', { class: 'btn primary', href: '#/create' }, '➕ جديد'),
      h('button', { class: 'btn', onclick: () => { const blob = new Blob([JSON.stringify(store.all(), null, 2)], { type: 'application/json' }); const a = h('a', { href: URL.createObjectURL(blob), download: 'nashat-activities.json' }); a.click(); } }, '⬇ تصدير'),
      h('label', { class: 'btn' }, '⬆ استيراد', h('input', { type: 'file', accept: '.json', hidden: true, onchange: async (e) => { try { const list = JSON.parse(await e.target.files[0].text()); list.forEach((a) => store.save({ ...a, items: cleanItems(a.items) })); toast(`استُورد ${list.length} نشاط`); render(); } catch { toast('ملف غير صالح', 'warn'); } } }))), grid));
  }

  // ---------------- المجتمع ----------------
  function communityPage() {
    const q = h('input', { class: 'inp', placeholder: '🔍 ابحث...' });
    const f = h('select', { class: 'inp' }, h('option', { value: '' }, 'كل القوالب'), TEMPLATES.map((t) => h('option', { value: t.id }, t.name)));
    const grid = h('div', { class: 'cards' });
    const render = () => grid.replaceChildren(...community.filter((a) => (!q.value || a.title.includes(q.value)) && (!f.value || a.template === f.value)).map((a) => actCard(a)));
    q.oninput = render; f.onchange = render; render();
    page(section('أنشطة المجتمع', 'أنشطة جاهزة يمكنك لعبها أو نسخها وتعديلها.', h('div', { class: 'row' }, q, f), grid));
  }

  // ---------------- أوراق العمل ----------------
  function worksheetsHub() {
    const list = [...store.all(), ...community];
    page(section('أوراق العمل', G ? 'اختر نشاطاً لتحويله إلى ورقة عمل متعددة الأقسام مع مفتاح إجابة — أو ولّد ورقة جديدة من موضوع.' : 'اختر نشاطاً لطباعته كورقة عمل.',
      G ? h('div', { class: 'panel' }, h('h3', {}, '✨ ورقة عمل جديدة من موضوع'), aiWorksheetBox()) : null,
      h('div', { class: 'cards' }, list.map((a) => h('a', { class: 'act-card ws-pick', href: '#/print/' + a.id }, h('div', { class: 'act-thumb' }, h('span', {}, '🖨️'), h('em', {}, tplById(a.template).name)), h('div', { class: 'act-info' }, h('h3', {}, a.title), h('p', {}, a.items.length + ' عنصر')))))));
  }
  function aiWorksheetBox() {
    const topic = h('input', { class: 'inp', placeholder: 'الموضوع، مثل: الجهاز الهضمي للصف السادس' });
    const btn = h('button', { class: 'btn gold', onclick: async () => { if (!topic.value) return topic.focus(); btn.disabled = true; btn.textContent = '✨ ...'; try { const a = await aiCreate({ topic: topic.value, template: 'quiz', count: 12 }); go('/print/' + a.id + '?preset=full'); } finally { btn.disabled = false; btn.textContent = '✨ أنشئ ورقة شاملة'; } } }, '✨ أنشئ ورقة شاملة');
    return h('div', { class: 'row' }, topic, btn);
  }

  // أوراق العمل من الكتاب المرجعي: لكل نوع ورقة مجموعة العناصر الأنسب
  function bookSets(act) {
    const unitId = act.id.split('~')[1];
    const pickSet = (tpl) => unitActivity(unitId, tpl)?.items || act.items;
    return { wordsearch: pickSet('wordsearch'), crossword: pickSet('crossword'), anagram: pickSet('anagram'), writing: pickSet('hangman'), unjumble: pickSet('unjumble'), ordering: pickSet('rankorder'), groupsort: pickSet('groupsort') };
  }
  function printPage({ id, preset, ws }) {
    const act = findAct(id); if (!act) return page(section('غير موجود', null));
    const types = WORKSHEET_TYPES.filter((t) => G || t.classic);
    const chosen = new Set(ws && types.some((t) => t.id === ws) ? [ws] : preset === 'full' ? ['mcq', 'truefalse', 'matching', 'fillblank', 'crossword', 'shortanswer'] : [act.template === 'wordsearch' ? 'wordsearch' : act.template === 'crossword' ? 'crossword' : ['matchup', 'memory', 'findmatch'].includes(act.template) ? 'matching' : 'mcq']);
    const frame = h('iframe', { class: 'ws-frame', title: 'معاينة' });
    const opts = { answerKey: G, fontSize: 15, school: '' };
    let level = '';
    const refresh = () => { frame.srcdoc = renderWorksheet(level ? { ...act, items: levelItems(act.items, level) } : act, [...chosen], { ...opts, level, sets: act.fromBook ? bookSets(act) : null }); };
    const typeBtns = h('div', { class: 'ws-types' }, types.map((t) => {
      const b = h('button', { class: 'ws-type' + (chosen.has(t.id) ? ' on' : ''), onclick: () => {
        if (G) { chosen.has(t.id) ? chosen.delete(t.id) : chosen.add(t.id); if (!chosen.size) chosen.add(t.id); } else { chosen.clear(); chosen.add(t.id); }
        typeBtns.querySelectorAll('.ws-type').forEach((x, i) => x.classList.toggle('on', chosen.has(types[i].id))); refresh();
      } }, h('span', {}, t.icon), t.name);
      return b;
    }));
    const levelItems = (items, lv) => (lv === 'دعم' ? items.slice(0, Math.max(4, Math.ceil(items.length / 2))) : lv === 'إثراء' ? items : items.slice(0, Math.ceil(items.length * 0.75)));
    page(h('div', { class: 'print-layout' },
      h('aside', { class: 'panel print-side' }, h('h3', {}, '🖨️ ', act.title), h('p', { class: 'muted' }, G ? 'اختر قسماً أو أكثر لتكوين ورقة شاملة.' : 'اختر نمط الورقة.'), typeBtns,
        h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: opts.answerKey, onchange: (e) => { opts.answerKey = e.target.checked; refresh(); } }), ' إرفاق مفتاح الإجابة'),
        G ? [h('label', { class: 'lbl' }, 'اسم المدرسة / المعلم'), h('input', { class: 'inp', oninput: (e) => { opts.school = e.target.value; refresh(); } }),
          h('label', { class: 'lbl' }, 'حجم الخط'), h('input', { type: 'range', min: 12, max: 22, value: 15, oninput: (e) => { opts.fontSize = +e.target.value; refresh(); } }),
          h('label', { class: 'lbl' }, 'التمايز (مستوى الطالب)'), h('select', { class: 'inp', onchange: (e) => { level = e.target.value; refresh(); } }, ['', 'دعم', 'أساسي', 'إثراء'].map((l) => h('option', { value: l }, l || 'بدون'))),
          h('button', { class: 'btn', onclick: refresh }, '🔀 نسخة جديدة (ترتيب مختلف)')] : null,
        h('button', { class: 'btn primary block', onclick: () => { try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch { /* محظور */ } setTimeout(() => toast('إن لم تظهر نافذة الطباعة: شغّل الموقع عبر الخادم (npm start) أو افتح الصفحة مباشرة', 'warn'), 800); } }, '🖨️ طباعة / حفظ PDF'),
        h('a', { class: 'btn block', href: '#/play/' + act.id }, '▶ تشغيل النشاط')),
      h('div', { class: 'print-preview' }, frame)));
    refresh();
  }

  // ---------------- استوديو الذكاء الاصطناعي (ذهبي) ----------------
  function aiStudio() {
    const topic = h('input', { class: 'inp lg', placeholder: 'موضوع الدرس' });
    const src = h('textarea', { class: 'inp', rows: 6, placeholder: 'اختياري: الصق نص الدرس أو الفقرة أو القصة — سيُبنى كل شيء منها فقط' });
    const level = h('select', { class: 'inp' }, ['ابتدائي مبكر', 'ابتدائي عليا', 'متوسط', 'ثانوي', 'جامعي'].map((l) => h('option', {}, l)));
    const diff = h('select', { class: 'inp' }, ['سهل', 'متوسط', 'صعب'].map((l) => h('option', { selected: l === 'متوسط' }, l)));
    const lang = h('select', { class: 'inp' }, ['العربية', 'English', 'Français'].map((l) => h('option', {}, l)));
    const extra = h('input', { class: 'inp', placeholder: 'تعليمات إضافية (مثال: ركّز على المفردات الجديدة)' });
    const picks = new Set(['quiz', 'matchup', 'crossword']);
    const pickGrid = h('div', { class: 'sw-list wrap' }, TEMPLATES.map((t) => h('button', { class: 'sw' + (picks.has(t.id) ? ' on' : ''), onclick: (e) => { picks.has(t.id) ? picks.delete(t.id) : picks.add(t.id); e.currentTarget.classList.toggle('on'); } }, h('span', {}, t.icon), h('small', {}, t.name))));
    const out = h('div', { class: 'cards' });
    const go1 = h('button', { class: 'btn gold lg', onclick: async () => {
      if (!topic.value && !src.value) return topic.focus();
      go1.disabled = true; out.replaceChildren(h('div', { class: 'loading' }, '✨ يعمل الذكاء الاصطناعي على إعداد الحزمة...'));
      // نجمع القوالب حسب نوع المحتوى ونولّد مرة لكل نوع
      const byKind = {}; [...picks].forEach((t) => (byKind[tplById(t).kind] ||= []).push(t));
      const made = [];
      for (const tpls of Object.values(byKind)) {
        try {
          const first = await aiCreate({ topic: topic.value, template: tpls[0], count: 10, level: level.value, difficulty: diff.value, sourceText: src.value, extra: extra.value, language: lang.value });
          made.push(first);
          for (const t of tpls.slice(1)) { const c = { ...structuredClone(first), id: uid(), template: t, title: first.title + ' — ' + tplById(t).name }; store.save(c); made.push(c); }
        } catch (e) { toast(e.message, 'warn'); }
      }
      out.replaceChildren(...made.map((a) => actCard(a, 'mine'))); go1.disabled = false; if (made.length) { confetti(80); toast(`جاهز: ${made.length} نشاط`); }
    } }, '✨ أنشئ حزمة الدرس');
    page(section('✨ استوديو الذكاء الاصطناعي', 'حوّل أي موضوع أو نص إلى حزمة أنشطة كاملة بقوالب متعددة دفعة واحدة.',
      h('div', { class: 'panel ai-panel' }, aiBadge(), topic, src, h('div', { class: 'row wrap' }, level, diff, lang), extra,
        h('label', { class: 'lbl' }, 'القوالب المطلوبة:'), pickGrid, go1), out));
  }

  // ---------------- لوحة التقدّم (ذهبي) ----------------
  function stats() {
    const p = store.profile(); const lv = level(p.xp);
    const hist = p.history; const avg = hist.length ? Math.round(hist.reduce((s, x) => s + x.pct, 0) / hist.length) : 0;
    const byTpl = {}; hist.forEach((x) => { (byTpl[x.template] ||= []).push(x.pct); });
    const cv = h('canvas', { class: 'chart', width: 760, height: 220 });
    const weak = {}; hist.flatMap((x) => x.wrong || []).forEach((w) => { const k = w.prompt + '|' + w.answer; weak[k] = (weak[k] || 0) + 1; });
    const weakList = Object.entries(weak).sort((a, b) => b[1] - a[1]).slice(0, 12);
    page(section('📈 تقدّمي', null,
      h('div', { class: 'stat-cards' },
        h('div', { class: 'stat' }, h('b', {}, lv.n), h('span', {}, 'المستوى'), h('div', { class: 'bar' }, h('i', { style: { width: (lv.into / lv.need) * 100 + '%' } })), h('small', {}, `${lv.into}/${lv.need} XP`)),
        h('div', { class: 'stat' }, h('b', {}, p.xp), h('span', {}, 'نقاط الخبرة')),
        h('div', { class: 'stat' }, h('b', {}, hist.length), h('span', {}, 'نشاط مكتمل')),
        h('div', { class: 'stat' }, h('b', {}, avg + '%'), h('span', {}, 'متوسط الدقة'))),
      h('div', { class: 'panel' }, h('h3', {}, 'آخر النتائج'), hist.length ? cv : h('p', { class: 'muted' }, 'العب بعض الأنشطة لتظهر الإحصاءات.')),
      h('div', { class: 'grid2' },
        h('div', { class: 'panel' }, h('h3', {}, 'الدقة حسب القالب'), Object.entries(byTpl).map(([t, arr]) => { const a = Math.round(arr.reduce((s, x) => s + x, 0) / arr.length); return h('div', { class: 'hbar' }, h('span', {}, tplById(t).icon + ' ' + tplById(t).name), h('div', { class: 'bar' }, h('i', { style: { width: a + '%' } })), h('small', {}, a + '%')); })),
        h('div', { class: 'panel' }, h('h3', {}, '🏅 الأوسمة'), h('div', { class: 'badges' }, BADGES.map(([id, icon, name, desc]) => h('div', { class: 'badge' + (p.badges.includes(id) ? ' got' : '') , title: desc }, h('span', {}, icon), h('b', {}, name), h('small', {}, desc)))))),
      h('div', { class: 'panel' }, h('h3', {}, '🎯 نقاط تحتاج مراجعة'), weakList.length ? [h('ul', { class: 'weak' }, weakList.map(([k, n]) => { const [q, a] = k.split('|'); return h('li', {}, `${q} ← `, h('b', {}, a), h('small', {}, ` (×${n})`)); })),
        h('button', { class: 'btn gold', onclick: () => { const a2 = { ...newActivity('quiz'), title: 'مراجعة ذكية لنقاط الضعف', items: weakList.map(([k]) => { const [q, a] = k.split('|'); return { ...blankItem(), prompt: q, answer: a }; }), theme: 'space' }; store.save(a2); go('/play/' + a2.id); } }, '🔁 ابدأ مراجعة ذكية')] : h('p', { class: 'muted' }, 'لا توجد أخطاء متكررة. رائع!')),
      h('div', { class: 'row' }, h('button', { class: 'btn danger sm', onclick: () => { ask('تصفير التقدّم؟', () => { store.saveProfile({ name: p.name, xp: 0, badges: [], history: [] }); routeAgain(); }); } }, 'تصفير التقدّم'))));
    if (hist.length) {
      const g = cv.getContext('2d'); const last = hist.slice(-20); const w = 760 / last.length;
      g.strokeStyle = 'rgba(255,255,255,.15)'; [0, 50, 100].forEach((v) => { const y = 200 - v * 1.8; g.beginPath(); g.moveTo(0, y); g.lineTo(760, y); g.stroke(); });
      last.forEach((x, i) => { const hgt = x.pct * 1.8; const grd = g.createLinearGradient(0, 200 - hgt, 0, 200); grd.addColorStop(0, '#ffe08a'); grd.addColorStop(1, '#b8860b'); g.fillStyle = grd; g.fillRect(i * w + 6, 200 - hgt, w - 12, hgt); g.fillStyle = '#fff'; g.font = '12px Tajawal'; g.textAlign = 'center'; g.fillText(x.pct + '%', i * w + w / 2, 196 - hgt); });
    }
  }

  // ---------------- رابط مشترك ----------------
  function sharedPlay({ code }) {
    try { play({}, decodeShare(code)); } catch { page(section('رابط غير صالح', null, h('a', { class: 'btn', href: '#/' }, 'الرئيسية'))); }
  }

  // ---------------- المكتبة المرجعية (الكتاب المرجعي) ----------------
  function subjectGrid() {
    return h('div', { class: 'subj-grid' }, subjects().map((s) => h('a', { class: 'subj', href: '#/library/' + s.id, style: { '--sc': s.color || '#888' } },
      h('span', { class: 'subj-icon' }, s.icon), h('b', {}, s.name), h('small', {}, `${(s.units || []).length} وحدة`))));
  }
  function libraryPage() {
    const replaceChk = h('input', { type: 'checkbox' });
    const custom = customBook();
    const download = (name, text, type) => { const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name }); a.click(); };
    page(section('📚 المكتبة المرجعية', 'كل الألعاب وأوراق العمل الجاهزة تُحمَّل تلقائياً من الكتاب المرجعي. اختر مادة.', subjectGrid()),
      section('إدارة الكتاب المرجعي', 'استورد كتابك المرجعي (JSON أو CSV) ليصبح مصدر النماذج الجاهزة في الموقع.',
        h('div', { class: 'panel' },
          custom ? h('p', {}, `✔ كتاب مخصص مُحمَّل (${custom.subjects.length} مادة) ${custom.replace ? '— يحل محل الكتاب الافتراضي' : '— مدموج مع الكتاب الافتراضي'}`) : h('p', { class: 'muted' }, 'يُستخدم الكتاب الافتراضي حالياً.'),
          h('div', { class: 'row' },
            h('label', { class: 'btn primary' }, '⬆ استيراد كتاب مرجعي', h('input', { type: 'file', accept: '.json,.csv', hidden: true, onchange: async (e) => {
              const f = e.target.files[0]; if (!f) return;
              try { const r = importBook(await f.text(), f.name, replaceChk.checked); await loadBook(); toast(`استُورد ${r.subjects} مادة و${r.units} وحدة`); routeAgain(); }
              catch (err) { toast('تعذّر الاستيراد: ' + err.message, 'warn'); }
            } })),
            h('label', { class: 'chk' }, replaceChk, ' استبدال الكتاب الافتراضي بدلاً من الدمج'),
            h('button', { class: 'btn', onclick: () => download('nashat-book-template.csv', CSV_TEMPLATE, 'text/csv') }, '⬇ قالب CSV فارغ'),
            h('button', { class: 'btn', onclick: () => download('reference-book.json', exportBookJSON(), 'application/json') }, '⬇ تصدير الكتاب الحالي'),
            custom ? h('button', { class: 'btn danger', onclick: async () => { clearCustomBook(); await loadBook(); toast('عاد الكتاب الافتراضي'); routeAgain(); } }, 'إزالة الكتاب المخصص') : null),
          h('details', {}, h('summary', {}, 'صيغة الملف'), h('p', { class: 'muted' }, 'CSV بالأعمدة: subject, unit, grade, set, prompt, answer, distractors, group, hint — حيث set إحدى: items (أسئلة وأزواج وكلمات وتصنيف) أو sentences (جمل لترتيب الجملة والكلمة المفقودة) أو sequence (تسلسل مرتّب). افصل الخيارات الخاطئة بـ ; . أو JSON بنفس بنية ملف library/reference-book.json.')))));
  }
  function subjectPage({ sid }) {
    const s = subjectById(sid); if (!s) return page(section('المادة غير موجودة', null, h('a', { class: 'btn', href: '#/library' }, 'المكتبة')));
    const wsTypes = WORKSHEET_TYPES.filter((t) => G || t.classic);
    page(h('div', { class: 'subj-hero', style: { '--sc': s.color || '#888' } }, h('span', {}, s.icon), h('div', {}, h('h1', {}, s.name), h('p', {}, `${s.units.length} وحدة · ${TEMPLATES.length} لعبة و${wsTypes.length} ورقة عمل لكل وحدة`)), h('a', { class: 'btn', href: '#/library' }, '← كل المواد')),
      ...s.units.map((u) => {
        const def = unitActivity(u.id, u.template || 'quiz');
        return h('section', { class: 'panel unit' },
          h('div', { class: 'panel-head' }, h('h3', {}, u.title), h('span', { class: 'muted' }, `${u.grade || ''} · ${def.items.length} عنصر`)),
          h('h4', {}, '🎮 الألعاب الجاهزة'),
          h('div', { class: 'sw-list wrap' }, TEMPLATES.map((t) => h('a', { class: 'sw', href: `#/play/lib~${u.id}~${t.id}` }, h('span', {}, t.icon), h('small', {}, t.name)))),
          h('h4', {}, '🖨️ أوراق العمل الجاهزة'),
          h('div', { class: 'sw-list wrap' }, wsTypes.map((w) => h('a', { class: 'sw', href: `#/print/lib~${u.id}~quiz?ws=${w.id}` }, h('span', {}, w.icon), h('small', {}, w.name)))),
          h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => { const c = { ...def, id: uid(), author: 'أنا', fromBook: false }; store.save(c); toast('نُسخت إلى أنشطتك'); go('/edit/' + c.id); } }, '✎ نسخ وتعديل'),
            G ? h('a', { class: 'btn gold', href: `#/print/lib~${u.id}~quiz?preset=full` }, '✨ ورقة شاملة متعددة الأقسام') : null));
      }));
  }

  router([
    ['/', home], ['/create', create], ['/edit/:id', editor], ['/play/:id', (p) => play(p)], ['/my', my], ['/community', communityPage],
    ['/worksheets', worksheetsHub], ['/library', libraryPage], ['/library/:sid', subjectPage], ['/print/:id', printPage], ['/s/:code', sharedPlay],
    ...(G ? [['/ai', aiStudio], ['/stats', stats]] : []),
  ], home);
}
