// خادم منصة نشاط: يقدّم الملفات الثابتة + واجهة الذكاء الاصطناعي.
// مفتاح Claude يبقى على الخادم فقط (ANTHROPIC_API_KEY) ولا يصل إلى المتصفح أبداً.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const MODEL = process.env.NASHAT_MODEL || 'claude-opus-5-5';
const AI_ENABLED = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const client = AI_ENABLED ? new Anthropic() : null;

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.md': 'text/markdown; charset=utf-8' };
const PUBLIC = new Set(['index.html', 'shared', 'classic', 'golden', 'library', 'favicon.svg']);

// ---------- مخطط المخرجات المنظّمة: نفس نموذج العناصر الموحّد في الواجهة ----------
const ITEM_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['prompt', 'answer', 'distractors', 'group', 'hint'],
  properties: {
    prompt: { type: 'string' }, answer: { type: 'string' },
    distractors: { type: 'array', items: { type: 'string' } },
    group: { type: 'string' }, hint: { type: 'string' },
  },
};
const ACTIVITY_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['title', 'instructions', 'items'],
  properties: { title: { type: 'string' }, instructions: { type: 'string' }, items: { type: 'array', items: ITEM_SCHEMA } },
};
const TEXT_SCHEMA = { type: 'object', additionalProperties: false, required: ['text'], properties: { text: { type: 'string' } } };

const KIND_GUIDE = {
  qa: 'كل عنصر سؤال اختيار من متعدد: prompt = السؤال، answer = الإجابة الصحيحة، distractors = ثلاث إجابات خاطئة معقولة ومتقاربة في الطول والنوع.',
  pairs: 'كل عنصر زوج متطابق: prompt = المصطلح أو السؤال القصير، answer = التعريف أو الإجابة القصيرة (كلمة إلى أربع كلمات). distractors = ثلاث إجابات خاطئة.',
  words: 'كل عنصر كلمة مفردة: answer = كلمة واحدة بلا مسافات (2-12 حرفاً)، prompt = تلميح أو تعريف يدل عليها. اجعل الكلمات تشترك في حروف لتسهيل الكلمات المتقاطعة.',
  groups: 'كل عنصر عنصر يُصنَّف: answer = العنصر، group = اسم الفئة. استخدم 2 إلى 4 فئات متوازنة العدد. prompt فارغ.',
  sentences: 'كل عنصر جملة تامة: answer = جملة صحيحة من 4 إلى 10 كلمات، prompt = تلميح قصير اختياري.',
  list: 'العناصر مرتّبة بالتسلسل الصحيح (زمنياً أو منطقياً): answer = اسم الخطوة أو العنصر، prompt = شرح قصير.',
};

const SYSTEM = `أنت مصمم تعليمي خبير يكتب محتوى أنشطة صفية دقيقاً علمياً ومناسباً لعمر المتعلّم.
- التزم بلغة الطلب (العربية افتراضياً، أو الإنجليزية إن كان الموضوع لغة إنجليزية أو طُلب ذلك).
- اكتب نصوصاً قصيرة واضحة تصلح للعرض على بطاقات وأزرار.
- لا تكرر العناصر، وتأكد أن كل إجابة صحيحة بلا لبس وأن الخيارات الخاطئة خاطئة فعلاً.
- hint: تلميح قصير يساعد دون أن يكشف الإجابة.
- الحقول غير المستخدمة تُترك نصاً فارغاً أو مصفوفة فارغة.`;

async function askJSON(userText, schema, { effort = 'low', maxTokens = 16000 } = {}) {
  const res = await client.beta.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM,
    output_config: { effort, format: { type: 'json_schema', schema } },
    messages: [{ role: 'user', content: userText }],
  });
  if (res.stop_reason === 'refusal') throw Object.assign(new Error('refused'), { status: 422, publicMessage: 'تعذّر إنشاء هذا المحتوى. جرّب موضوعاً آخر.' });
  if (res.stop_reason === 'max_tokens') throw Object.assign(new Error('truncated'), { status: 502, publicMessage: 'الرد طويل جداً، قلّل عدد العناصر.' });
  const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return JSON.parse(text);
}

const clamp = (n, a, b) => Math.max(a, Math.min(b, Number(n) || a));
const s = (v, max = 4000) => String(v ?? '').slice(0, max);

const handlers = {
  async generate(b) {
    const kind = KIND_GUIDE[b.kind] ? b.kind : 'qa';
    const count = clamp(b.count, 3, 30);
    const prompt = [
      `أنشئ نشاطاً تعليمياً بعنوان مناسب.`,
      `الموضوع: ${s(b.topic, 300) || 'من النص المرفق'}`,
      b.level ? `المرحلة/المستوى: ${s(b.level, 100)}` : '',
      b.difficulty ? `الصعوبة: ${s(b.difficulty, 50)}` : '',
      b.language ? `اللغة: ${s(b.language, 50)}` : '',
      `عدد العناصر: ${count} بالضبط.`,
      `شكل العناصر: ${KIND_GUIDE[kind]}`,
      b.sourceText ? `اعتمد فقط على هذا النص المصدر:\n<source>\n${s(b.sourceText, 12000)}\n</source>` : '',
      b.extra ? `تعليمات إضافية من المعلم: ${s(b.extra, 500)}` : '',
    ].filter(Boolean).join('\n');
    return askJSON(prompt, ACTIVITY_SCHEMA, { effort: 'medium' });
  },
  async improve(b) {
    const items = Array.isArray(b.items) ? b.items.slice(0, 40) : [];
    const prompt = `هذا محتوى نشاط تعليمي بعنوان «${s(b.title, 200)}» من نوع ${KIND_GUIDE[b.kind] ? b.kind : 'qa'}:\n${JSON.stringify(items)}\n\nالمطلوب: ${s(b.instruction, 500) || 'حسّن الصياغة وصحّح الأخطاء وأكمل الحقول الناقصة (الخيارات الخاطئة والتلميحات)'}.\nأعد النشاط كاملاً بنفس المخطط. ${KIND_GUIDE[b.kind] || ''}`;
    return askJSON(prompt, ACTIVITY_SCHEMA, { effort: 'medium' });
  },
  async hint(b) {
    const prompt = `اكتب تلميحاً واحداً قصيراً (جملة واحدة) يساعد طالباً على الوصول إلى الإجابة دون ذكرها.\nالسؤال: ${s(b.prompt, 500)}\nالإجابة (لا تذكرها): ${s(b.answer, 200)}`;
    return askJSON(prompt, TEXT_SCHEMA, { effort: 'low', maxTokens: 2000 });
  },
  async coach(b) {
    const prompt = `طالب أنهى نشاط «${s(b.title, 200)}» (${s(b.template, 40)}). النتيجة ${clamp(b.score, 0, 9999)} من ${clamp(b.total, 0, 9999)} في ${clamp(b.time, 0, 99999)} ثانية.\nالعناصر التي أخطأ فيها: ${JSON.stringify((b.wrong || []).slice(0, 10))}\nاكتب ملاحظة تشجيعية شخصية من 2-3 جمل، ثم نصيحة مراجعة محددة لنقاط الضعف إن وجدت.`;
    return askJSON(prompt, TEXT_SCHEMA, { effort: 'low', maxTokens: 3000 });
  },
  async explain(b) {
    const prompt = `اشرح للطالب باختصار (2-4 جمل بسيطة) لماذا الإجابة الصحيحة عن «${s(b.prompt, 500)}» هي «${s(b.answer, 200)}»، مع مثال أو طريقة للتذكر.`;
    return askJSON(prompt, TEXT_SCHEMA, { effort: 'low', maxTokens: 3000 });
  },
};

// حدّ بسيط لعدد الطلبات لكل عنوان IP
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now(); const arr = (hits.get(ip) || []).filter((t) => now - t < 60000); arr.push(now); hits.set(ip, arr);
  return arr.length > 30;
}

function send(res, code, body, type = 'application/json; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

async function readBody(req) {
  let data = ''; for await (const chunk of req) { data += chunk; if (data.length > 100000) throw Object.assign(new Error('too large'), { status: 413 }); }
  return data ? JSON.parse(data) : {};
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname === '/api/ai/status') return send(res, 200, { enabled: AI_ENABLED, model: AI_ENABLED ? MODEL : null });
    if (url.pathname.startsWith('/api/ai/') && req.method === 'POST') {
      const name = url.pathname.slice(8);
      if (!handlers[name]) return send(res, 404, { error: 'unknown' });
      if (!AI_ENABLED) return send(res, 503, { error: 'ai_disabled' });
      if (rateLimited(req.socket.remoteAddress)) return send(res, 429, { error: 'كثرة الطلبات، انتظر دقيقة.' });
      const out = await handlers[name](await readBody(req));
      return send(res, 200, out);
    }
    // ملفات ثابتة
    let p = decodeURIComponent(url.pathname);
    if (p === '/' ) p = '/index.html';
    if (p.endsWith('/')) p += 'index.html';
    const rel = normalize(p).replace(/^[/\\]+/, '');
    if (rel.includes('..') || !PUBLIC.has(rel.split(/[/\\]/)[0])) return send(res, 404, 'Not found', 'text/plain');
    const file = join(ROOT, rel);
    const st = await stat(file).catch(() => null);
    if (!st || !st.isFile()) return send(res, 404, 'Not found', 'text/plain');
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(await readFile(file));
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return send(res, 429, { error: 'الخدمة مشغولة، حاول بعد قليل.' });
    if (err instanceof Anthropic.AuthenticationError) return send(res, 503, { error: 'مفتاح الذكاء الاصطناعي غير صالح.' });
    if (err instanceof Anthropic.APIConnectionError) return send(res, 502, { error: 'تعذّر الاتصال بخدمة الذكاء الاصطناعي.' });
    if (err instanceof Anthropic.APIError) { console.error('API error', err.status, err.message); return send(res, 502, { error: 'خطأ من خدمة الذكاء الاصطناعي.' }); }
    if (err instanceof SyntaxError) return send(res, 400, { error: 'طلب غير صالح.' });
    console.error(err);
    send(res, err.status || 500, { error: err.publicMessage || 'خطأ في الخادم.' });
  }
});

server.listen(PORT, () => console.log(`منصة نشاط تعمل على http://localhost:${PORT}  (الذكاء الاصطناعي: ${AI_ENABLED ? 'مفعّل ' + MODEL : 'غير مفعّل - المولّد المحلي'})`));
