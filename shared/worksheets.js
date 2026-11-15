// مولّد أوراق العمل القابلة للطباعة (HTML جاهز للطباعة / الحفظ PDF)
import { esc, shuffle, withDistractors, lettersOnly } from './core.js';
import { buildWordSearch, buildCrossword } from './games.js';

export const WORKSHEET_TYPES = [
  { id: 'mcq', name: 'اختيار من متعدد', icon: '🔘', classic: true },
  { id: 'matching', name: 'صل بخط', icon: '🔗', classic: true },
  { id: 'truefalse', name: 'صح أم خطأ', icon: '✔️', classic: true },
  { id: 'fillblank', name: 'أكمل الفراغ مع بنك كلمات', icon: '⬜', classic: true },
  { id: 'wordsearch', name: 'البحث عن الكلمات', icon: '🔍', classic: true },
  { id: 'crossword', name: 'كلمات متقاطعة', icon: '✏️', classic: true },
  { id: 'shortanswer', name: 'أسئلة إجابة قصيرة', icon: '📝' },
  { id: 'unjumble', name: 'رتّب الكلمات', icon: '🧩' },
  { id: 'anagram', name: 'رتّب الحروف', icon: '🔀' },
  { id: 'groupsort', name: 'جدول تصنيف', icon: '🗂️' },
  { id: 'ordering', name: 'رتّب بالأرقام', icon: '🔢' },
  { id: 'flashcards', name: 'بطاقات للقص', icon: '✂️' },
  { id: 'writing', name: 'تدريب الكتابة والإملاء', icon: '✍️' },
  { id: 'exitticket', name: 'بطاقة الخروج (تقويم ختامي)', icon: '🎟️' },
];

const CSS = `
@page{size:A4;margin:14mm}
*{box-sizing:border-box}body{font-family:'Tajawal','Segoe UI',Tahoma,sans-serif;direction:rtl;color:#1d1d1f;margin:0;padding:18px;line-height:1.7;font-size:15px}
.ws-head{border:2px solid #222;border-radius:12px;padding:10px 16px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}
.ws-head h1{margin:0;font-size:22px}.ws-fields{display:flex;gap:18px;font-size:14px}.ws-fields span{min-width:150px;border-bottom:1.5px dotted #555}
.ws-sec{margin:16px 0;page-break-inside:avoid}.ws-sec h2{font-size:17px;background:#f1f1f1;border-radius:8px;padding:4px 12px;margin:0 0 10px}
.ws-inst{color:#444;font-size:13px;margin:-4px 0 8px}
ol.ws-q>li{margin:0 0 12px}.ws-opts{display:grid;grid-template-columns:repeat(2,1fr);gap:4px 24px;margin-top:4px}.ws-opts span::before{content:'◯ '}
.ws-match{display:grid;grid-template-columns:1fr 80px 1fr;gap:10px 0;align-items:center}.ws-match div{border:1px solid #bbb;border-radius:8px;padding:6px 10px}.ws-dot{text-align:center;font-size:20px}
.ws-bank{border:2px dashed #888;border-radius:10px;padding:8px 12px;margin-bottom:10px;display:flex;flex-wrap:wrap;gap:8px 20px}
.ws-line{display:block;border-bottom:1.5px solid #999;height:30px;margin:4px 0}
.ws-grid{display:grid;gap:0;margin:auto;width:max-content;border:2px solid #222}
.ws-grid div{width:30px;height:30px;border:1px solid #bbb;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;position:relative}
.ws-grid .blk{background:#222;border-color:#222}.ws-grid .ans{color:#c0392b}.ws-grid .n{position:absolute;top:0;right:2px;font-size:9px;font-weight:400}
.ws-cols{display:grid;grid-template-columns:1fr 1fr;gap:16px}
table.ws-t{width:100%;border-collapse:collapse}table.ws-t td,table.ws-t th{border:1.5px solid #333;padding:6px;height:34px;text-align:center}
.ws-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:0}.ws-cards div{border:1.5px dashed #555;height:110px;display:flex;align-items:center;justify-content:center;text-align:center;padding:8px;font-weight:700}
.ws-tf{display:flex;justify-content:space-between;gap:10px}.ws-tf b{white-space:nowrap}
.ws-trace{font-size:28px;letter-spacing:4px;color:#bbb;border-bottom:1.5px dashed #aaa;padding:2px 6px}
.ws-key{page-break-before:always}.ws-key .ws-sec{font-size:13px}
.ws-foot{margin-top:20px;font-size:11px;color:#888;text-align:center}
.ws-ticket{border:2px solid #222;border-radius:12px;padding:12px;margin-bottom:12px}
.ws-faces{font-size:30px;letter-spacing:18px}
@media print{.noprint{display:none}}
`;

function sec(title, inst, inner) { return `<div class="ws-sec"><h2>${esc(title)}</h2>${inst ? `<div class="ws-inst">${esc(inst)}</div>` : ''}${inner}</div>`; }

// كل مولّد يعيد { html, key } حيث key = مفتاح الإجابة
const GEN = {
  mcq(items) {
    const qs = withDistractors(items);
    const opts = qs.map((q) => shuffle([q.answer, ...q.distractors]));
    return {
      html: `<ol class="ws-q">${qs.map((q, i) => `<li>${esc(q.prompt)}<div class="ws-opts">${opts[i].map((o) => `<span>${esc(o)}</span>`).join('')}</div></li>`).join('')}</ol>`,
      key: `<ol>${qs.map((q) => `<li>${esc(q.answer)}</li>`).join('')}</ol>`,
    };
  },
  matching(items) {
    const its = items.slice(0, 12); const right = shuffle(its);
    return {
      html: `<div class="ws-match">${its.map((it, i) => `<div>${i + 1}. ${esc(it.prompt)}</div><div class="ws-dot">•&nbsp;&nbsp;&nbsp;•</div><div>${'أبجدهوزحطيكل'[i] || i}) ${esc(right[i].answer)}</div>`).join('')}</div>`,
      key: `<ol>${its.map((it) => `<li>${esc(it.prompt)} ← ${'أبجدهوزحطيكل'[right.indexOf(it)]}) ${esc(it.answer)}</li>`).join('')}</ol>`,
    };
  },
  truefalse(items) {
    const rows = items.map((it) => { const t = Math.random() < 0.5 || items.length < 2; const other = shuffle(items.filter((x) => x !== it))[0]; return { it, t, shown: t ? it.answer : other.answer }; });
    return {
      html: `<ol class="ws-q">${rows.map((r) => `<li><div class="ws-tf"><span>${esc(r.it.prompt)} ← ${esc(r.shown)}</span><b>( &nbsp; صح &nbsp; / &nbsp; خطأ &nbsp; )</b></div></li>`).join('')}</ol>`,
      key: `<ol>${rows.map((r) => `<li>${r.t ? 'صح' : `خطأ (الصحيح: ${esc(r.it.answer)})`}</li>`).join('')}</ol>`,
    };
  },
  fillblank(items) {
    const rows = items.map((it) => {
      if (it.prompt && !it.answer.includes(' ')) return { text: `${esc(it.prompt)}: ____________`, ans: it.answer };
      const ws = it.answer.split(/\s+/); const k = ws.reduce((b, w, i) => (w.length > ws[b].length ? i : b), 0);
      return { text: ws.map((w, i) => (i === k ? '____________' : esc(w))).join(' '), ans: ws[k] };
    });
    return {
      html: `<div class="ws-bank"><b>بنك الكلمات:</b>${shuffle(rows.map((r) => r.ans)).map((a) => `<span>${esc(a)}</span>`).join('')}</div><ol class="ws-q">${rows.map((r) => `<li>${r.text}</li>`).join('')}</ol>`,
      key: `<ol>${rows.map((r) => `<li>${esc(r.ans)}</li>`).join('')}</ol>`,
    };
  },
  wordsearch(items) {
    const ws = buildWordSearch(items.map((i) => i.answer), 11);
    const solution = new Set(); ws.placed.forEach((p) => { for (let k = 0; k < p.word.length; k++) solution.add((p.x + p.dx * k) + ',' + (p.y + p.dy * k)); });
    const grid = (key) => `<div class="ws-grid" dir="${ws.rtl ? 'rtl' : 'ltr'}" style="grid-template-columns:repeat(${ws.size},30px)">${ws.grid.map((r, y) => r.map((c, x) => `<div class="${key && solution.has(x + ',' + y) ? 'ans' : ''}">${c}</div>`).join('')).join('')}</div>`;
    const clues = items.filter((it) => ws.placed.some((p) => p.word === lettersOnly(it.answer)));
    return {
      html: `${grid(false)}<div class="ws-bank" style="margin-top:12px">${clues.map((it) => `<span>${esc(it.prompt || it.answer)}${it.prompt ? '' : ''}</span>`).join('')}</div>`,
      key: grid(true),
    };
  },
  crossword(items) {
    const cw = buildCrossword(items);
    const grid = (key) => { let s = ''; for (let y = 0; y < cw.h; y++) for (let x = 0; x < cw.w; x++) { const c = cw.cells.get(x + ',' + y); const n = cw.placed.find((p) => p.x === x && p.y === y)?.num; s += c ? `<div>${n ? `<span class="n">${n}</span>` : ''}${key ? `<span class="ans">${c.ch}</span>` : ''}</div>` : '<div class="blk" style="background:transparent;border-color:transparent"></div>'; } return `<div class="ws-grid" dir="${cw.rtl ? 'rtl' : 'ltr'}" style="grid-template-columns:repeat(${cw.w},30px);border:none">${s}</div>`; };
    const list = (d) => cw.placed.filter((p) => p.dir === d).sort((a, b) => a.num - b.num).map((p) => `<li>${p.num}. ${esc(p.prompt)} (${p.w.length})</li>`).join('');
    return { html: `${grid(false)}<div class="ws-cols" style="margin-top:14px"><div><b>أفقياً</b><ul style="list-style:none;padding:0">${list('a')}</ul></div><div><b>عمودياً</b><ul style="list-style:none;padding:0">${list('d')}</ul></div></div>`, key: grid(true) };
  },
  shortanswer(items) {
    return { html: `<ol class="ws-q">${items.map((it) => `<li>${esc(it.prompt || it.answer)}<span class="ws-line"></span><span class="ws-line"></span></li>`).join('')}</ol>`, key: `<ol>${items.map((it) => `<li>${esc(it.answer)}</li>`).join('')}</ol>` };
  },
  unjumble(items) {
    return { html: `<ol class="ws-q">${items.map((it) => `<li><b>${shuffle(it.answer.split(/\s+/)).map(esc).join(' / ')}</b><span class="ws-line"></span></li>`).join('')}</ol>`, key: `<ol>${items.map((it) => `<li>${esc(it.answer)}</li>`).join('')}</ol>` };
  },
  anagram(items) {
    return { html: `<ol class="ws-q">${items.map((it) => `<li>${esc(it.prompt)} &nbsp; <b style="letter-spacing:6px">${shuffle([...lettersOnly(it.answer)]).join(' ')}</b> ← ______________</li>`).join('')}</ol>`, key: `<ol>${items.map((it) => `<li>${esc(it.answer)}</li>`).join('')}</ol>` };
  },
  groupsort(items) {
    const groups = [...new Set(items.map((i) => i.group || 'عام'))]; const rows = Math.ceil(items.length / groups.length) + 1;
    return {
      html: `<div class="ws-bank">${shuffle(items).map((it) => `<span>${esc(it.answer)}</span>`).join('')}</div><table class="ws-t"><tr>${groups.map((g) => `<th>${esc(g)}</th>`).join('')}</tr>${Array.from({ length: rows }, () => `<tr>${groups.map(() => '<td></td>').join('')}</tr>`).join('')}</table>`,
      key: `<table class="ws-t"><tr>${groups.map((g) => `<th>${esc(g)}</th>`).join('')}</tr><tr>${groups.map((g) => `<td>${items.filter((i) => (i.group || 'عام') === g).map((i) => esc(i.answer)).join('، ')}</td>`).join('')}</tr></table>`,
    };
  },
  ordering(items) {
    return { html: `<table class="ws-t">${shuffle(items).map((it) => `<tr><td style="width:60px"></td><td style="text-align:right">${esc(it.answer)}${it.prompt ? ` — <small>${esc(it.prompt)}</small>` : ''}</td></tr>`).join('')}</table>`, key: `<ol>${items.map((it) => `<li>${esc(it.answer)}</li>`).join('')}</ol>` };
  },
  flashcards(items) {
    return { html: `<div class="ws-cards">${items.map((it) => `<div>${esc(it.prompt || it.answer)}</div><div>${esc(it.answer)}</div><div style="font-weight:400;font-size:12px;color:#777">✂ اقطع واطوِ</div>`).join('')}</div>`, key: '' };
  },
  writing(items) {
    return { html: items.map((it) => `<div style="margin-bottom:12px"><b>${esc(it.answer)}</b> ${it.prompt ? `<small>(${esc(it.prompt)})</small>` : ''}<div class="ws-trace">${esc(it.answer)} &nbsp; ${esc(it.answer)} &nbsp; ${esc(it.answer)}</div><span class="ws-line"></span></div>`).join(''), key: '' };
  },
  exitticket(items, act) {
    const qs = shuffle(items).slice(0, 3);
    const one = `<div class="ws-ticket"><b>🎟️ بطاقة الخروج — ${esc(act.title)}</b><div>الاسم: ...................</div><ol>${qs.map((q) => `<li>${esc(q.prompt || q.answer)}<span class="ws-line"></span></li>`).join('')}</ol><div>شيء تعلمته اليوم:<span class="ws-line"></span></div><div>كيف أشعر بفهمي؟ <span class="ws-faces">😀 🙂 😐 😕</span></div></div>`;
    return { html: one + one, key: `<ol>${qs.map((q) => `<li>${esc(q.answer)}</li>`).join('')}</ol>` };
  },
};

const TITLES = {
  mcq: ['اختر الإجابة الصحيحة', 'ظلّل الدائرة المناسبة.'], matching: ['صل بخط', 'صل كل عبارة من العمود الأول بما يناسبها.'],
  truefalse: ['ضع دائرة حول صح أو خطأ', ''], fillblank: ['أكمل الفراغ', 'استخدم كلمات البنك.'], wordsearch: ['ابحث عن الكلمات', 'لوّن الكلمات المخفية.'],
  crossword: ['الكلمات المتقاطعة', 'اكتب حرفاً في كل مربع.'], shortanswer: ['أجب عن الأسئلة', ''], unjumble: ['رتّب الكلمات لتكوين جملة', ''],
  anagram: ['رتّب الحروف', ''], groupsort: ['صنّف الكلمات في الجدول', ''], ordering: ['رتّب بكتابة الأرقام', 'اكتب 1 للأول، 2 للثاني...'],
  flashcards: ['بطاقات المراجعة', ''], writing: ['تدرّب على الكتابة', 'شِفّ الكلمة ثم اكتبها بخطك.'], exitticket: ['بطاقة الخروج', 'قصّ البطاقتين.'],
};

/** sections: مصفوفة أنواع (ورقة متعددة الأقسام). opts: { answerKey, fontSize, school, columns } */
export function renderWorksheet(act, sections, opts = {}) {
  const items = act.items.filter((i) => i.answer);
  const parts = sections.map((t) => ({ t, ...(GEN[t] || GEN.mcq)((opts.sets?.[t] || items).filter((i) => i.answer), act) }));
  const body = parts.map((p) => sec(TITLES[p.t][0], TITLES[p.t][1], p.html)).join('');
  const key = opts.answerKey ? `<div class="ws-key"><h1 style="font-size:20px">مفتاح الإجابة — ${esc(act.title)}</h1>${parts.filter((p) => p.key).map((p) => sec(TITLES[p.t][0], '', p.key)).join('')}</div>` : '';
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(act.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap" rel="stylesheet">
<style>${CSS}body{font-size:${opts.fontSize || 15}px}</style></head><body>
<div class="ws-head"><div><h1>${esc(act.title)}</h1>${opts.school ? `<div>${esc(opts.school)}</div>` : ''}${act.instructions ? `<div class="ws-inst">${esc(act.instructions)}</div>` : ''}</div>
<div class="ws-fields"><div>الاسم: <span></span></div><div>الصف: <span style="min-width:60px"></span></div><div>التاريخ: <span style="min-width:80px"></span></div></div></div>
${body}${opts.level ? `<div class="ws-foot">المستوى: ${esc(opts.level)}</div>` : ''}<div class="ws-foot">أُنشئت بواسطة منصة نشاط</div>${key}</body></html>`;
}
