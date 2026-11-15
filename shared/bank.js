// بنك محتوى جاهز: أنشطة المجتمع النموذجية + معرفة المولّد المحلي (يعمل دون إنترنت)
import { newActivity, uid } from './core.js';

const I = (prompt, answer, distractors = [], group = '', hint = '') => ({ prompt, answer, distractors, group, hint });

export const TOPICS = {
  'العواصم العربية': { kind: 'qa', items: [
    I('عاصمة المملكة العربية السعودية', 'الرياض', ['جدة', 'مكة', 'الدمام']),
    I('عاصمة مصر', 'القاهرة', ['الإسكندرية', 'أسوان', 'الجيزة']),
    I('عاصمة المغرب', 'الرباط', ['الدار البيضاء', 'مراكش', 'فاس']),
    I('عاصمة الأردن', 'عمّان', ['إربد', 'الزرقاء', 'العقبة']),
    I('عاصمة الإمارات', 'أبوظبي', ['دبي', 'الشارقة', 'العين']),
    I('عاصمة العراق', 'بغداد', ['البصرة', 'الموصل', 'أربيل']),
    I('عاصمة تونس', 'تونس', ['صفاقس', 'سوسة', 'القيروان']),
    I('عاصمة الكويت', 'الكويت', ['الجهراء', 'الأحمدي', 'حولي']),
  ] },
  'الكواكب': { kind: 'qa', items: [
    I('أقرب كوكب إلى الشمس', 'عطارد', ['الزهرة', 'المريخ', 'الأرض']),
    I('أكبر كواكب المجموعة الشمسية', 'المشتري', ['زحل', 'نبتون', 'أورانوس']),
    I('الكوكب الأحمر', 'المريخ', ['الزهرة', 'عطارد', 'المشتري']),
    I('كوكب تحيط به حلقات واضحة', 'زحل', ['الأرض', 'المريخ', 'عطارد']),
    I('الكوكب الذي نعيش عليه', 'الأرض', ['الزهرة', 'المريخ', 'زحل']),
    I('أشد الكواكب حرارة', 'الزهرة', ['عطارد', 'المريخ', 'المشتري']),
  ] },
  'الحيوانات وصغارها': { kind: 'pairs', items: [
    I('الأسد', 'شبل'), I('الحصان', 'مهر'), I('البقرة', 'عجل'), I('الكلب', 'جرو'),
    I('القط', 'هريرة'), I('الدجاجة', 'كتكوت'), I('الناقة', 'حُوار'), I('الضفدع', 'شرغوف'),
  ] },
  'English Colors': { kind: 'pairs', items: [
    I('أحمر', 'Red'), I('أزرق', 'Blue'), I('أخضر', 'Green'), I('أصفر', 'Yellow'),
    I('أسود', 'Black'), I('أبيض', 'White'), I('برتقالي', 'Orange'), I('بنفسجي', 'Purple'),
  ] },
  'أجزاء النبات': { kind: 'words', items: [
    I('تمتص الماء والأملاح من التربة', 'جذر'), I('تحمل النبات وتنقل الماء', 'ساق'),
    I('تصنع الغذاء بعملية البناء الضوئي', 'ورقة'), I('عضو التكاثر الملوّن', 'زهرة'),
    I('تتكوّن من الزهرة وتحمي البذور', 'ثمرة'), I('تنمو لتصبح نباتاً جديداً', 'بذرة'),
  ] },
  'أقسام الكلمة': { kind: 'groups', items: [
    I('', 'كتب', [], 'فعل'), I('', 'يلعب', [], 'فعل'), I('', 'اذهب', [], 'فعل'),
    I('', 'مدرسة', [], 'اسم'), I('', 'قلم', [], 'اسم'), I('', 'محمد', [], 'اسم'),
    I('', 'في', [], 'حرف'), I('', 'على', [], 'حرف'), I('', 'من', [], 'حرف'),
  ] },
  'جمل مفيدة': { kind: 'sentences', items: [
    I('', 'العلم نور والجهل ظلام'), I('', 'النظافة من الإيمان'), I('', 'يذهب الطالب إلى المدرسة مبكراً'),
    I('', 'الشمس تشرق من الشرق'), I('', 'القراءة غذاء العقل'),
  ] },
  'مراحل دورة الماء': { kind: 'list', items: [
    I('تسخن الشمس مياه البحار', 'التبخر'), I('يبرد البخار في الأعلى', 'التكاثف'),
    I('تتجمع القطرات في السحب', 'تكوّن السحب'), I('يسقط الماء مطراً أو ثلجاً', 'الهطول'),
    I('يعود الماء إلى البحار والأنهار', 'التجمع'),
  ] },
  'جدول الضرب': { kind: 'qa', items: [
    I('6 × 7', '42', ['36', '48', '49']), I('8 × 8', '64', ['56', '72', '68']), I('9 × 6', '54', ['56', '45', '63']),
    I('7 × 7', '49', ['42', '56', '47']), I('12 × 3', '36', ['33', '39', '32']), I('5 × 9', '45', ['40', '54', '35']),
  ] },
};

const COMMUNITY_DEF = [
  ['اختبار العواصم العربية', 'quiz', 'العواصم العربية', 'ocean', 'أ. سارة', 312],
  ['صغار الحيوانات', 'matchup', 'الحيوانات وصغارها', 'candy', 'أ. خالد', 188],
  ['ألوان بالإنجليزية', 'memory', 'English Colors', 'classroom', 'Ms. Lina', 421],
  ['أجزاء النبات', 'wordsearch', 'أجزاء النبات', 'desert', 'أ. منى', 97],
  ['صنّف الكلمة', 'groupsort', 'أقسام الكلمة', 'chalk', 'أ. عمر', 256],
  ['رتّب الجملة', 'unjumble', 'جمل مفيدة', 'classroom', 'أ. هند', 143],
  ['رحلة إلى الكواكب', 'gameshow', 'الكواكب', 'space', 'أ. يوسف', 509],
  ['دورة الماء', 'rankorder', 'مراحل دورة الماء', 'ocean', 'أ. ريم', 76],
  ['تحدي جدول الضرب', 'balloonpop', 'جدول الضرب', 'candy', 'أ. فهد', 640],
  ['كلمات النبات المتقاطعة', 'crossword', 'أجزاء النبات', 'classroom', 'أ. منى', 64],
];

export function communityActivities() {
  return COMMUNITY_DEF.map(([title, template, topic, theme, author, plays], i) => ({
    ...newActivity(template), id: 'community-' + i, title, theme, author, plays,
    items: TOPICS[topic].items.map((x) => ({ ...x, distractors: [...x.distractors] })), tags: [topic],
    created: Date.now() - (i + 1) * 86400000 * 3,
  }));
}

// ------- المولّد المحلي (احتياطي عند غياب مفتاح الذكاء الاصطناعي) -------
export function localGenerate({ topic = '', kind = 'qa', count = 8, sourceText = '' }) {
  const t = topic.trim();
  // 1) تطابق مع موضوع معروف
  const key = Object.keys(TOPICS).find((k) => t && (k.includes(t) || t.includes(k)));
  if (key) return { title: key, instructions: '', items: TOPICS[key].items.slice(0, count).map((x) => ({ ...x })), source: 'bank' };
  // 2) توليد من نص ملصق: جمل، كلمات مفتاحية، فراغات
  const text = (sourceText || '').trim();
  if (text) {
    const sentences = text.split(/[.!؟?\n]+/).map((s) => s.trim()).filter((s) => s.split(/\s+/).length >= 3).slice(0, count);
    const words = [...new Set(text.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 4))];
    const items = sentences.map((s) => {
      const ws = s.split(/\s+/); const longest = [...ws].sort((a, b) => b.length - a.length)[0];
      const others = words.filter((w) => w !== longest).sort(() => Math.random() - 0.5).slice(0, 3);
      if (kind === 'sentences' || kind === 'list') return { prompt: '', answer: s, distractors: [], group: '', hint: '' };
      if (kind === 'words') return { prompt: s.replace(longest, '_____'), answer: longest, distractors: [], group: '', hint: '' };
      return { prompt: s.replace(longest, '_____'), answer: longest, distractors: others, group: '', hint: '' };
    });
    return { title: t || 'نشاط من النص', instructions: 'أكمل بحسب النص المقروء.', items, source: 'text' };
  }
  // 3) قالب افتراضي قابل للتعديل
  const k = pickTopicByKind(kind);
  return { title: t ? `${t} (مسودة)` : k, instructions: '', items: TOPICS[k].items.slice(0, count).map((x) => ({ ...x })), source: 'fallback' };
}

function pickTopicByKind(kind) {
  return Object.keys(TOPICS).find((k) => TOPICS[k].kind === kind) || 'العواصم العربية';
}

export const sampleTopicNames = () => Object.keys(TOPICS);
export const newId = uid;
