// النواة المشتركة: أدوات، تخزين، فهرس القوالب، نموذج البيانات
// نموذج النشاط الموحّد: كل القوالب تقرأ نفس قائمة العناصر، لذلك يمكن تبديل القالب في أي وقت.
// item = { prompt, answer, distractors[], group, hint }

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'style' && typeof v === 'object') for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) node.style.setProperty(sk, sv); else node.style[sk] = sv; }
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') node.innerHTML = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const norm = (s) => String(s ?? '').trim().toLowerCase()
  .replace(/[ً-ْـ]/g, '') // تشكيل وتطويل
  .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ');
export const lettersOnly = (s) => String(s ?? '').replace(/[\s\-_.،,'"!?؟]/g, '').toUpperCase();
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------- فهرس القوالب ----------------
// kind: نوع المحتوى الذي يحتاجه القالب (يحدد واجهة المحرر)
// qa = سؤال + إجابة + خيارات خاطئة | pairs = مصطلح + تعريف | words = كلمة + تلميح
// groups = عنصر + فئة | sentences = جملة | list = عناصر فقط
export const TEMPLATES = [
  { id: 'quiz', name: 'اختبار', icon: '❓', kind: 'qa', desc: 'سلسلة أسئلة اختيار من متعدد. اضغط الإجابة الصحيحة.' },
  { id: 'gameshow', name: 'مسابقة تلفزيونية', icon: '🏆', kind: 'qa', desc: 'اختبار بمؤقت ووسائل مساعدة وجولات مكافأة.' },
  { id: 'truefalse', name: 'صح أم خطأ', icon: '✔️', kind: 'pairs', desc: 'تظهر عبارات بسرعة، قرّر هل هي صحيحة أم خاطئة.' },
  { id: 'matchup', name: 'توصيل', icon: '🔗', kind: 'pairs', desc: 'اسحب كل كلمة إلى تعريفها المناسب.' },
  { id: 'memory', name: 'أزواج الذاكرة', icon: '🃏', kind: 'pairs', desc: 'اقلب البطاقات مثنى مثنى لتجد الأزواج المتطابقة.' },
  { id: 'findmatch', name: 'ابحث عن المطابق', icon: '🎯', kind: 'pairs', desc: 'اضغط الإجابة المطابقة لتختفي حتى تنتهي كلها.' },
  { id: 'flashcards', name: 'بطاقات تعليمية', icon: '📇', kind: 'pairs', desc: 'بطاقات بوجهين للمراجعة الذاتية.' },
  { id: 'fliptiles', name: 'قلب البلاطات', icon: '🔄', kind: 'pairs', desc: 'شبكة بلاطات تنقلب لتكشف الوجه الآخر.' },
  { id: 'openbox', name: 'افتح الصندوق', icon: '🎁', kind: 'pairs', desc: 'اضغط صندوقاً ليكشف سؤالاً مفاجئاً.' },
  { id: 'whackamole', name: 'اضرب الخلد', icon: '🔨', kind: 'pairs', desc: 'اضرب الإجابات الصحيحة عندما تظهر وتجنّب الخاطئة.' },
  { id: 'balloonpop', name: 'فرقعة البالونات', icon: '🎈', kind: 'pairs', desc: 'فرقع البالون الذي يحمل الإجابة الصحيحة.' },
  { id: 'wordsearch', name: 'البحث عن الكلمات', icon: '🔍', kind: 'words', desc: 'ابحث عن الكلمات المخفية في شبكة الحروف.' },
  { id: 'crossword', name: 'كلمات متقاطعة', icon: '✏️', kind: 'words', desc: 'استخدم التلميحات لحل الكلمات المتقاطعة.' },
  { id: 'hangman', name: 'خمّن الكلمة', icon: '🔤', kind: 'words', desc: 'خمّن الحروف قبل نفاد المحاولات.' },
  { id: 'anagram', name: 'ترتيب الحروف', icon: '🔀', kind: 'words', desc: 'أعد ترتيب الحروف لتكوين الكلمة الصحيحة.' },
  { id: 'typeanswer', name: 'اكتب الإجابة', icon: '⌨️', kind: 'pairs', desc: 'اقرأ السؤال واكتب الإجابة بنفسك.' },
  { id: 'unjumble', name: 'ترتيب الجملة', icon: '🧩', kind: 'sentences', desc: 'رتّب الكلمات لتكوين جملة صحيحة.' },
  { id: 'missingword', name: 'الكلمة المفقودة', icon: '⬜', kind: 'sentences', desc: 'اسحب الكلمة المناسبة إلى الفراغ في الجملة.' },
  { id: 'groupsort', name: 'تصنيف المجموعات', icon: '🗂️', kind: 'groups', desc: 'صنّف كل عنصر في مجموعته الصحيحة.' },
  { id: 'rankorder', name: 'الترتيب الصحيح', icon: '📶', kind: 'list', desc: 'رتّب العناصر بالتسلسل الصحيح.' },
  { id: 'wheel', name: 'العجلة الدوّارة', icon: '🎡', kind: 'list', desc: 'أدر العجلة لاختيار عنصر عشوائي.' },
  { id: 'speakingcards', name: 'بطاقات المحادثة', icon: '🗣️', kind: 'list', desc: 'اسحب بطاقة عشوائية للنقاش أو التحدث.' },
];
export const tplById = (id) => TEMPLATES.find((t) => t.id === id) || TEMPLATES[0];

export const KIND_LABELS = {
  qa: { prompt: 'السؤال', answer: 'الإجابة الصحيحة', distractors: 'إجابات خاطئة (افصل بفاصلة)' },
  pairs: { prompt: 'الكلمة / السؤال', answer: 'التعريف / الإجابة' },
  words: { prompt: 'التلميح', answer: 'الكلمة' },
  groups: { prompt: 'ملاحظة (اختياري)', answer: 'العنصر', group: 'المجموعة' },
  sentences: { prompt: 'تلميح (اختياري)', answer: 'الجملة الكاملة' },
  list: { answer: 'العنصر', prompt: 'تفاصيل (اختياري)' },
};

export const THEMES = [
  { id: 'classroom', name: 'الفصل', bg: '#e9f2ff', card: '#ffffff', accent: '#2f6fed' },
  { id: 'chalk', name: 'السبورة', bg: '#23412f', card: '#2f5a40', accent: '#f6e27a' },
  { id: 'ocean', name: 'المحيط', bg: '#d8f3f7', card: '#ffffff', accent: '#0a8ea0' },
  { id: 'candy', name: 'الحلوى', bg: '#ffe6f1', card: '#ffffff', accent: '#e0457b' },
  { id: 'space', name: 'الفضاء', bg: '#141a33', card: '#232b52', accent: '#8ab4ff' },
  { id: 'desert', name: 'الصحراء', bg: '#f6ead2', card: '#fffaf0', accent: '#c07a2c' },
];

export function blankItem() { return { prompt: '', answer: '', distractors: [], group: '', hint: '' }; }

export function newActivity(template = 'quiz') {
  return {
    id: uid(), title: 'نشاط بلا عنوان', template, instructions: '', items: [blankItem(), blankItem(), blankItem()],
    theme: 'classroom', options: { timer: 0, shuffle: true, lives: 6 }, created: Date.now(), updated: Date.now(),
    plays: 0, author: 'أنا', tags: [],
  };
}

export function cleanItems(items) {
  return (items || []).map((it) => ({
    prompt: String(it.prompt ?? '').trim(), answer: String(it.answer ?? '').trim(),
    distractors: (Array.isArray(it.distractors) ? it.distractors : String(it.distractors || '').split(/[,،]/)).map((d) => String(d).trim()).filter(Boolean),
    group: String(it.group ?? '').trim(), hint: String(it.hint ?? '').trim(),
  })).filter((it) => it.answer || it.prompt);
}

// يضمن أن كل عنصر له ثلاث خيارات خاطئة على الأقل، مأخوذة من إجابات العناصر الأخرى إن لزم
export function withDistractors(items, n = 3) {
  const pool = [...new Set(items.map((i) => i.answer).filter(Boolean))];
  return items.map((it) => {
    let d = [...(it.distractors || [])].filter((x) => norm(x) !== norm(it.answer));
    if (d.length < n) d = d.concat(shuffle(pool.filter((p) => norm(p) !== norm(it.answer) && !d.includes(p)))).slice(0, n);
    return { ...it, distractors: d.slice(0, n) };
  });
}

// ---------------- التخزين المحلي ----------------
const KEY = 'nashat.activities.v1';
const PKEY = 'nashat.profile.v1';
export const store = {
  all() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } },
  saveAll(list) { localStorage.setItem(KEY, JSON.stringify(list)); },
  get(id) { return this.all().find((a) => a.id === id); },
  save(act) {
    const list = this.all(); act.updated = Date.now();
    const i = list.findIndex((a) => a.id === act.id);
    if (i >= 0) list[i] = act; else list.unshift(act);
    this.saveAll(list); return act;
  },
  remove(id) { this.saveAll(this.all().filter((a) => a.id !== id)); },
  bumpPlays(id) { const a = this.get(id); if (a) { a.plays = (a.plays || 0) + 1; this.save(a); } },
  // لوحة المتصدرين لكل نشاط
  board(id) { try { return JSON.parse(localStorage.getItem('nashat.board.' + id)) || []; } catch { return []; } },
  addScore(id, entry) {
    const b = this.board(id); b.push({ ...entry, at: Date.now() });
    b.sort((x, y) => y.score - x.score || x.time - y.time);
    localStorage.setItem('nashat.board.' + id, JSON.stringify(b.slice(0, 20))); return b;
  },
  profile() {
    try { return { name: 'طالب', xp: 0, badges: [], history: [], ...(JSON.parse(localStorage.getItem(PKEY)) || {}) }; }
    catch { return { name: 'طالب', xp: 0, badges: [], history: [] }; }
  },
  saveProfile(p) { localStorage.setItem(PKEY, JSON.stringify(p)); },
};

// ---------------- مشاركة عبر الرابط ----------------
export function encodeShare(act) {
  const slim = { t: act.title, m: act.template, h: act.theme, i: act.instructions, o: act.options, x: act.items };
  return btoa(unescape(encodeURIComponent(JSON.stringify(slim)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function decodeShare(code) {
  const s = JSON.parse(decodeURIComponent(escape(atob(code.replace(/-/g, '+').replace(/_/g, '/')))));
  return { ...newActivity(s.m), id: 'shared-' + uid(), title: s.t, theme: s.h || 'classroom', instructions: s.i || '', options: s.o || {}, items: cleanItems(s.x), author: 'رابط مشترك' };
}

// ---------------- الموجّه البسيط (hash router) ----------------
export function router(routes, fallback) {
  const run = () => {
    const raw = location.hash.slice(1) || '/';
    const [path, qs] = raw.split('?');
    const params = Object.fromEntries(new URLSearchParams(qs || ''));
    for (const [pattern, fn] of routes) {
      const keys = []; const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
      const m = path.match(re);
      if (m) { keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1]))); fn(params); window.scrollTo(0, 0); return; }
    }
    fallback(params);
  };
  window.addEventListener('hashchange', run); run();
}
export const go = (path) => { location.hash = path; };

export function fmtTime(sec) { sec = Math.max(0, Math.round(sec)); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; }
export function timeAgo(ts) {
  const d = (Date.now() - ts) / 1000;
  if (d < 60) return 'الآن'; if (d < 3600) return `قبل ${Math.floor(d / 60)} دقيقة`;
  if (d < 86400) return `قبل ${Math.floor(d / 3600)} ساعة`; return `قبل ${Math.floor(d / 86400)} يوم`;
}
