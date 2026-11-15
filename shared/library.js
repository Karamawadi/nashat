// الكتاب المرجعي: مصدر كل النماذج الجاهزة (الألعاب وأوراق العمل) مرتّبة حسب المواد.
// يُحمَّل من /library/reference-book.json، ويمكن استبداله أو توسيعه بملف يستورده المعلم (JSON أو CSV).
import { newActivity, cleanItems, tplById, norm } from './core.js';

const CUSTOM_KEY = 'nashat.book.custom.v1';
let book = { title: '', subjects: [] };

export async function loadBook() {
  let base = { subjects: [] };
  try { const r = await fetch('../library/reference-book.json', { cache: 'no-cache' }); if (r.ok) base = await r.json(); } catch { /* بدون اتصال */ }
  const custom = customBook();
  book = { title: base.title || 'الكتاب المرجعي', subjects: mergeSubjects(custom?.replace ? [] : base.subjects || [], custom?.subjects || []) };
  return book;
}
export const getBook = () => book;
export const subjects = () => book.subjects;
export const subjectById = (id) => book.subjects.find((s) => s.id === id);
export function allUnits() { return book.subjects.flatMap((s) => (s.units || []).map((u) => ({ subject: s, unit: u }))); }
export function unitById(id) { return allUnits().find((x) => x.unit.id === id); }

function mergeSubjects(a, b) {
  const out = a.map((s) => ({ ...s, units: [...(s.units || [])] }));
  for (const s of b) {
    const ex = out.find((x) => x.id === s.id || x.name === s.name);
    if (!ex) { out.push({ ...s, units: [...(s.units || [])] }); continue; }
    for (const u of s.units || []) { const i = ex.units.findIndex((x) => x.id === u.id); if (i >= 0) ex.units[i] = u; else ex.units.push(u); }
  }
  return out;
}

// اختيار مجموعة العناصر المناسبة لكل قالب تلقائياً
export function itemsForTemplate(unit, templateId) {
  const kind = tplById(templateId).kind;
  if (kind === 'sentences' && unit.sentences?.length) return unit.sentences;
  if (templateId === 'rankorder' && unit.sequence?.length) return unit.sequence;
  if (kind === 'words' && unit.words?.length) return unit.words;
  if (kind === 'groups') return unit.items.filter((i) => i.group).length ? unit.items : unit.items;
  return unit.items || [];
}

/** يحوّل وحدة من الكتاب إلى نشاط جاهز لقالب معيّن (id ثابت يسمح بالطباعة والمشاركة) */
export function unitActivity(unitId, templateId) {
  const found = unitById(unitId); if (!found) return null;
  const { subject, unit } = found;
  const t = tplById(templateId || unit.template || 'quiz');
  return {
    ...newActivity(t.id), id: `lib~${unit.id}~${t.id}`, title: `${unit.title}`, template: t.id, theme: unit.theme || 'classroom',
    instructions: unit.instructions || '', items: cleanItems(itemsForTemplate(unit, t.id)), author: `${subject.name} · ${unit.grade || ''}`,
    plays: 0, tags: [subject.name], options: { timer: 0, shuffle: t.id !== 'rankorder', lives: 6 }, fromBook: true,
  };
}
export function activityFromId(id) {
  if (!id?.startsWith('lib~')) return null;
  const [, unitId, tplId] = id.split('~');
  return unitActivity(unitId, tplId);
}

// يبحث في الكتاب عن وحدة تطابق موضوعاً (يستخدمه المولّد المحلي)
export function searchBook(topic) {
  const q = norm(topic); if (!q) return null;
  const words = q.split(' ').filter((w) => w.length > 2);
  let best = null, bestScore = 0;
  for (const { subject, unit } of allUnits()) {
    const hay = norm([subject.name, unit.title, unit.grade, ...(unit.items || []).map((i) => i.prompt + ' ' + i.answer + ' ' + i.group)].join(' '));
    const score = words.reduce((s, w) => s + (hay.includes(w) ? 1 : 0), 0) + (hay.includes(q) ? 3 : 0);
    if (score > bestScore) { best = { subject, unit }; bestScore = score; }
  }
  return best;
}

// ---------------- استيراد / تصدير ----------------
export function customBook() { try { return JSON.parse(localStorage.getItem(CUSTOM_KEY)); } catch { return null; } }
export function clearCustomBook() { localStorage.removeItem(CUSTOM_KEY); }

/** يستورد كتاباً مرجعياً: JSON بصيغة الكتاب، أو CSV بالأعمدة:
 * subject,unit,grade,set,prompt,answer,distractors,group,hint  (set = items | sentences | sequence) */
export function importBook(text, filename = '', replace = false) {
  let parsed;
  if (/\.csv$/i.test(filename) || (!text.trim().startsWith('{') && text.includes(','))) parsed = csvToBook(text);
  else { parsed = JSON.parse(text); if (!Array.isArray(parsed.subjects)) throw new Error('الملف لا يحتوي على subjects'); }
  validate(parsed);
  const prev = customBook();
  const merged = replace ? parsed.subjects : mergeSubjects(prev?.subjects || [], parsed.subjects);
  localStorage.setItem(CUSTOM_KEY, JSON.stringify({ replace, subjects: merged }));
  return { subjects: parsed.subjects.length, units: parsed.subjects.reduce((n, s) => n + (s.units || []).length, 0) };
}

function validate(b) {
  b.subjects.forEach((s, i) => {
    s.id ||= 'subject-' + i; s.name ||= s.id; s.icon ||= '📘'; s.units ||= [];
    s.units.forEach((u, j) => {
      u.id ||= `${s.id}-${j + 1}`; u.title ||= s.name; u.items = cleanItems(u.items || []);
      u.sentences = cleanItems(u.sentences || []); u.sequence = cleanItems(u.sequence || []); u.words = cleanItems(u.words || []);
      if (!u.items.length && !u.sentences.length && !u.sequence.length) throw new Error(`الوحدة «${u.title}» فارغة`);
      if (!u.items.length) u.items = u.sentences.length ? u.sentences : u.sequence;
    });
  });
}

export function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}

function csvToBook(text) {
  const rows = parseCSV(text.replace(/^﻿/, ''));
  const head = rows.shift().map((x) => x.trim().toLowerCase());
  const col = (r, name) => (r[head.indexOf(name)] ?? '').trim();
  const subjects = [];
  for (const r of rows) {
    const sName = col(r, 'subject') || 'عام'; const uTitle = col(r, 'unit') || sName;
    let s = subjects.find((x) => x.name === sName); if (!s) subjects.push((s = { id: slug(sName), name: sName, icon: '📘', units: [] }));
    let u = s.units.find((x) => x.title === uTitle); if (!u) s.units.push((u = { id: `${s.id}-${s.units.length + 1}`, title: uTitle, grade: col(r, 'grade'), items: [], sentences: [], sequence: [], words: [] }));
    const set = ['sentences', 'sequence', 'words'].includes(col(r, 'set')) ? col(r, 'set') : 'items';
    u[set].push({ prompt: col(r, 'prompt'), answer: col(r, 'answer'), distractors: col(r, 'distractors').split(/[;؛|]/).map((x) => x.trim()).filter(Boolean), group: col(r, 'group'), hint: col(r, 'hint') });
  }
  return { subjects };
}
const slug = (s) => 'c-' + Array.from(s).map((c) => c.charCodeAt(0).toString(36)).join('').slice(0, 16);

export const CSV_TEMPLATE = '﻿subject,unit,grade,set,prompt,answer,distractors,group,hint\n' +
  'العلوم,النبات,الصف الرابع,items,تمتص الماء من التربة,جذر,ساق;ورقة;زهرة,أجزاء النبات,تحت الأرض\n' +
  'العلوم,النبات,الصف الرابع,sentences,,تحتاج النباتات إلى الماء والضوء,,,\n' +
  'العلوم,النبات,الصف الرابع,sequence,,بذرة,,,\n' +
  'العلوم,النبات,الصف الرابع,sequence,,نبتة صغيرة,,,\n';

export function exportBookJSON() { return JSON.stringify({ format: 'nashat-reference-book', version: 1, title: book.title, subjects: book.subjects }, null, 2); }
