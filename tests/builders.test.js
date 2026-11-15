import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWordSearch, buildCrossword } from '../shared/games.js';
import { withDistractors, cleanItems, norm } from '../shared/core.js';
import { TOPICS, localGenerate } from '../shared/bank.js';

test('wordsearch places words that are readable from the grid', () => {
  const words = ['جذر', 'ساق', 'ورقة', 'زهرة', 'ثمرة', 'بذرة'];
  for (let n = 0; n < 30; n++) {
    const ws = buildWordSearch(words);
    assert.ok(ws.placed.length >= 5);
    for (const p of ws.placed) {
      let s = ''; for (let k = 0; k < p.word.length; k++) s += ws.grid[p.y + p.dy * k][p.x + p.dx * k];
      assert.equal(s, p.word);
    }
  }
});

test('crossword words are consistent with cells and intersect', () => {
  const items = TOPICS['أجزاء النبات'].items;
  for (let n = 0; n < 20; n++) {
    const cw = buildCrossword(items);
    assert.ok(cw.placed.length >= 2);
    for (const p of cw.placed) {
      const [dx, dy] = p.dir === 'a' ? [1, 0] : [0, 1];
      for (let k = 0; k < p.w.length; k++) assert.equal(cw.cells.get((p.x + dx * k) + ',' + (p.y + dy * k)).ch, p.w[k]);
    }
    const nums = cw.placed.map((p) => p.num); assert.ok(nums.every((x) => x >= 1));
  }
});

test('distractors never include the correct answer', () => {
  const items = withDistractors(cleanItems([{ prompt: 'a', answer: 'x' }, { prompt: 'b', answer: 'y' }, { prompt: 'c', answer: 'z' }, { prompt: 'd', answer: 'w' }]));
  for (const it of items) { assert.equal(it.distractors.length, 3); assert.ok(!it.distractors.includes(it.answer)); }
});

test('arabic normalisation', () => { assert.equal(norm('أَحْمَدُ'), norm('احمد')); assert.equal(norm('مدرسة'), norm('مدرسه')); });

test('local generator: bank, text and fallback', () => {
  assert.equal(localGenerate({ topic: 'الكواكب', kind: 'qa' }).source, 'bank');
  const t = localGenerate({ topic: '', kind: 'qa', sourceText: 'تدور الأرض حول الشمس مرة كل سنة. يدور القمر حول الأرض كل شهر تقريباً.' });
  assert.equal(t.source, 'text'); assert.equal(t.items.length, 2); assert.ok(t.items[0].prompt.includes('_____'));
  assert.ok(localGenerate({ topic: 'شيء غير معروف', kind: 'groups' }).items.length > 0);
});
