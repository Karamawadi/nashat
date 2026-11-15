// عميل الذكاء الاصطناعي في المتصفح: يستدعي خادم المنصة، ويرجع للمولّد المحلي عند غياب الخدمة.
import { localGenerate } from './bank.js';
import { cleanItems, withDistractors, lettersOnly, tplById } from './core.js';
import { searchBook, itemsForTemplate } from './library.js';

let statusPromise = null;
export function aiStatus() {
  statusPromise ||= fetch('/api/ai/status').then((r) => (r.ok ? r.json() : { enabled: false })).catch(() => ({ enabled: false }));
  return statusPromise;
}

async function call(name, body) {
  const r = await fetch('/api/ai/' + name, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'تعذّر الاتصال');
  return data;
}

// المولّد المحلي: يبحث أولاً في الكتاب المرجعي، ثم في بنك المحتوى
function offline(opts) {
  const hit = !opts.sourceText && searchBook(opts.topic || '');
  if (hit) {
    const tpl = { qa: 'quiz', pairs: 'matchup', words: 'crossword', groups: 'groupsort', sentences: 'unjumble', list: 'rankorder' }[opts.kind] || 'quiz';
    return { title: hit.unit.title, instructions: '', items: cleanItems(itemsForTemplate(hit.unit, tplById(tpl).id)).slice(0, opts.count || 30), source: 'book' };
  }
  return localGenerate(opts);
}

export async function generateActivity(opts) {
  const st = await aiStatus();
  if (st.enabled) {
    try { const out = await call('generate', opts); return { ...out, items: cleanItems(out.items), source: 'ai' }; }
    catch (e) { const local = offline(opts); return { ...local, warning: e.message + ' — تم استخدام المولّد المحلي.' }; }
  }
  return offline(opts);
}

export async function improveActivity(act, kind, instruction) {
  const st = await aiStatus();
  if (st.enabled) {
    const out = await call('improve', { title: act.title, items: act.items, kind, instruction });
    return { ...out, items: cleanItems(out.items), source: 'ai' };
  }
  // محلياً: إكمال الخيارات الخاطئة والتلميحات
  const items = withDistractors(act.items).map((it) => ({ ...it, hint: it.hint || localHint(it) }));
  return { title: act.title, instructions: act.instructions, items, source: 'local' };
}

export function localHint(it) {
  const w = String(it.answer || '');
  const letters = lettersOnly(w);
  if (letters.length <= 2) return `الإجابة قصيرة جداً (${letters.length} حرف).`;
  return `تبدأ بـ «${w.trim()[0]}» وعدد حروفها ${letters.length}${w.includes(' ') ? `، وتتكوّن من ${w.trim().split(/\s+/).length} كلمات` : ''}.`;
}

export async function getHint(it) {
  if (it.hint) return it.hint;
  const st = await aiStatus();
  if (st.enabled) { try { return (await call('hint', { prompt: it.prompt, answer: it.answer })).text; } catch { /* احتياطي */ } }
  return localHint(it);
}

export async function explain(it) {
  const st = await aiStatus();
  if (st.enabled) { try { return (await call('explain', { prompt: it.prompt, answer: it.answer })).text; } catch { /* احتياطي */ } }
  return `الإجابة الصحيحة: «${it.answer}». ${it.hint ? 'تذكّر: ' + it.hint : 'اكتبها ثلاث مرات وقلها بصوت عالٍ لتثبيتها.'}`;
}

export async function coach(result, act) {
  const pct = result.total ? Math.round((result.score / result.total) * 100) : 0;
  const st = await aiStatus();
  if (st.enabled) {
    try { return (await call('coach', { title: act.title, template: act.template, score: result.score, total: result.total, time: Math.round(result.time), wrong: (result.wrong || []).filter(Boolean).map((w) => ({ q: w.prompt, a: w.answer || w.w })) })).text; }
    catch { /* احتياطي */ }
  }
  const weak = (result.wrong || []).filter(Boolean).slice(0, 3).map((w) => `«${w.prompt || w.answer}»`).join('، ');
  if (pct >= 90) return `أداء مذهل! ${pct}% في ${Math.round(result.time)} ثانية. جرّب مستوى أصعب أو قالباً مختلفاً لتتحدى نفسك.`;
  if (pct >= 60) return `عمل جيد (${pct}%). ${weak ? `راجع: ${weak} ثم أعد المحاولة.` : 'أعد المحاولة لتحسين وقتك.'}`;
  return `لا بأس، التعلم خطوات (${pct}%). ${weak ? `ركّز على: ${weak}.` : ''} جرّب وضع «البطاقات التعليمية» للمراجعة أولاً.`;
}
