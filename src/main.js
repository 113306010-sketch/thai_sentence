import './style.css';
import { PAGES, ALL } from './data.js';
import { attachDrag, slotAt, zoneAt } from './drag.js';

// 資料裡仍用 - ˇ ˊ ~ 比對；畫面上用 SVG 畫出聲調線條，避免字元上下位置跑版
const TONE_PATHS = {
  '-': 'M8 20 H32',
  'ˇ': 'M9 14 L20 27 L31 14',
  'ˊ': 'M13 28 L27 12',
  '~': 'M6 21 C10 11 15 11 20 21 S30 31 34 21',
};
const TONES = [
  { sym: '-', cls: 't-flat', name: '平聲' },
  { sym: 'ˇ', cls: 't-low', name: '低聲' },
  { sym: 'ˊ', cls: 't-rise', name: '上揚聲' },
  { sym: '~', cls: 't-high', name: '高聲' },
];
const TONE = Object.fromEntries(TONES.map((t) => [t.sym, t]));
function toneIcon(sym) {
  const el = document.createElement('span');
  el.className = 'ticon';
  el.innerHTML = `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="${TONE_PATHS[sym]}"/></svg>`;
  return el;
}
const toneLine = (str) =>
  h('span', { class: 'tone-line' },
    [...str].map((c) => (TONE[c] ? h('span', { class: `tl ${TONE[c].cls}` }, toneIcon(c)) : c === '|' ? h('span', { class: 'tl-bar' }, '|') : h('span', { class: 'tl-gap' }))));
const MAX_LIVES = 3;

const app = document.getElementById('app');

/* ---------- helpers ---------- */

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(kid));
  }
  return el;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function shuffleTiles(tiles, correctTexts) {
  const same = (a) => a.every((t, i) => t.text === correctTexts[i]);
  let out = shuffle(tiles);
  for (let n = 0; n < 20 && same(out); n++) out = shuffle(tiles);
  return out;
}

// 提示文字中 {{ }} 包起來的部分標紅
function noteParts(text) {
  return text.split(/(\{\{.*?\}\})/).map((part) =>
    part.startsWith('{{') ? h('span', { class: 'red' }, part.slice(2, -2)) : part);
}

/* ---------- session state ---------- */

let session = null;

function startSession(opts) {
  session = {
    ...opts, // label, sentences, useLives, retryOf
    queue: shuffle(opts.sentences),
    idx: 0,
    lives: opts.useLives ? MAX_LIVES : null,
    wrong: new Map(),
    q: null,
  };
  newQuestion();
  renderQuiz();
}

function newQuestion() {
  const s = session.queue[session.idx];
  const tiles = s.words.map((w, i) => ({ id: i, text: w.text }));
  session.q = {
    s,
    step: 1,
    order: shuffleTiles(tiles, s.words.map((w) => w.text)).map((t) => t.id),
    tiles,
    answer: [],
    revealed: false,
    wrongTiles: new Set(),
    slots: Array(s.syls.length).fill(null),
    wrongSlots: new Set(),
    selected: null,
    solved: false,
    msg: '',
  };
}

/** 記錄一次答錯。回傳 true 表示機會用完、已進入失敗畫面。 */
function registerMistake() {
  const q = session.q;
  q.revealed = true;
  session.wrong.set(q.s.id, q.s);
  if (session.lives != null) {
    session.lives--;
    if (session.lives <= 0) {
      renderEnd('lose');
      return true;
    }
  }
  return false;
}

function nextQuestion() {
  session.idx++;
  if (session.idx >= session.queue.length) {
    renderEnd(session.useLives ? 'win' : 'done');
    return;
  }
  newQuestion();
  renderQuiz();
}

/* ---------- home ---------- */

function renderHome() {
  session = null;
  const btn = (label, sub, opts) =>
    h('button', { class: 'btn menu-btn', onclick: () => startSession(opts) },
      h('span', { class: 'menu-label' }, label),
      h('span', { class: 'menu-sub' }, sub));

  app.replaceChildren(
    h('main', { class: 'screen home' },
      h('h1', { class: 'title' }, 'ตา ใบ'),
      h('p', { class: 'subtitle' }, '泰文句子重組＋聲調練習'),
      h('div', { class: 'menu' },
        btn('P.89', '8 句', { sentences: PAGES[2], useLives: false }),
        btn('P.121', '8 句', { sentences: PAGES[1], useLives: false }),
        btn('P.165', '8 句', { sentences: PAGES[3], useLives: false }),
        btn('三頁隨機', '24 句 · 3 次機會', { sentences: ALL, useLives: true }),
      )));
}

/* ---------- quiz ---------- */

function renderQuiz() {
  const q = session.q;
  const total = session.queue.length;

  const head = h('header', { class: 'topbar' },
    h('button', { class: 'link-btn', onclick: renderHome }, '← 主頁'),
    h('span', { class: 'progress' }, `第 ${session.idx + 1} / ${total} 題`),
    session.lives != null
      ? h('span', { class: 'lives', 'aria-label': `剩餘機會 ${session.lives}` },
          '機會 ',
          Array.from({ length: MAX_LIVES }, (_, i) =>
            h('i', { class: i < session.lives ? 'dot on' : 'dot' })))
      : h('span'));

  const zh = q.revealed ? h('div', { class: 'zh' }, q.s.zh) : null;

  app.replaceChildren(
    h('main', { class: 'screen quiz' },
      head,
      zh,
      q.step === 1 ? buildStep1(q) : buildStep2(q)));
}

/* --- step 1: 重組句子 --- */

function buildStep1(q) {
  const tileById = (id) => q.tiles[id];
  const pool = q.order.filter((id) => !q.answer.includes(id));
  let answerEl;
  let poolEl;
  let mark;

  const clearFeedback = () => {
    q.wrongTiles.clear();
    q.msg = '';
  };

  const insertIndex = (x, y, excludeEl) => {
    const tiles = [...answerEl.querySelectorAll('.tile')].filter((t) => t !== excludeEl);
    for (let i = 0; i < tiles.length; i++) {
      const r = tiles[i].getBoundingClientRect();
      if (y < r.top) return i;
      if (y <= r.bottom && x < r.left + r.width / 2) return i;
    }
    return tiles.length;
  };

  const showMark = (index, excludeEl) => {
    const tiles = [...answerEl.querySelectorAll('.tile')].filter((t) => t !== excludeEl);
    const rowRect = answerEl.getBoundingClientRect();
    let left;
    let top;
    let height;
    if (!tiles.length) return hideMark();
    if (index < tiles.length) {
      const r = tiles[index].getBoundingClientRect();
      left = r.left - 5;
      top = r.top;
      height = r.height;
    } else {
      const r = tiles[tiles.length - 1].getBoundingClientRect();
      left = r.right + 3;
      top = r.top;
      height = r.height;
    }
    mark.hidden = false;
    mark.style.left = `${left - rowRect.left}px`;
    mark.style.top = `${top - rowRect.top}px`;
    mark.style.height = `${height}px`;
  };
  const hideMark = () => {
    mark.hidden = true;
  };

  const place = (id, index) => {
    q.answer = q.answer.filter((x) => x !== id);
    if (index == null || index > q.answer.length) index = q.answer.length;
    q.answer.splice(index, 0, id);
    clearFeedback();
  };
  const unplace = (id) => {
    q.answer = q.answer.filter((x) => x !== id);
    clearFeedback();
  };

  const makeTile = (id, where) => {
    const el = h('div', {
      class: `tile${q.wrongTiles.has(id) ? ' wrong' : ''}`,
      dataset: { id },
    }, tileById(id).text);
    attachDrag(el, {
      onMove(x, y) {
        const zone = zoneAt(x, y);
        poolEl.classList.toggle('over', zone === 'pool' && where === 'answer');
        answerEl.classList.toggle('over', zone === 'answer');
        if (zone === 'answer') showMark(insertIndex(x, y, el), el);
        else hideMark();
      },
      onDrop(x, y) {
        const zone = zoneAt(x, y);
        if (zone === 'answer') place(id, insertIndex(x, y, el));
        else if (zone === 'pool') unplace(id);
        renderQuiz();
      },
      onCancel: renderQuiz,
      onTap() {
        if (where === 'pool') place(id);
        else unplace(id);
        renderQuiz();
      },
    });
    return el;
  };

  mark = h('div', { class: 'insert-mark', hidden: true });
  answerEl = h('div', { class: 'zone answer', dataset: { drop: 'answer' } },
    q.answer.map((id) => makeTile(id, 'answer')), mark);
  poolEl = h('div', { class: 'zone pool', dataset: { drop: 'pool' } },
    pool.map((id) => makeTile(id, 'pool')));

  const ready = pool.length === 0;
  const check = () => {
    const correct = q.s.words.map((w) => w.text);
    const given = q.answer.map((id) => q.tiles[id].text);
    const wrong = new Set(q.answer.filter((id, i) => q.tiles[id].text !== correct[i]));
    if (wrong.size === 0) {
      q.step = 2;
      q.msg = '';
      renderQuiz();
      return;
    }
    q.wrongTiles = wrong;
    if (registerMistake()) return;
    q.msg = '順序不對，再試一次';
    renderQuiz();
  };

  return h('section', { class: 'step' },
    h('p', { class: 'hint' }, '① 把單字拖到上方，排成正確的句子'),
    answerEl,
    h('p', { class: 'pool-label' }, '單字'),
    poolEl,
    h('p', { class: `msg${q.msg ? ' bad' : ''}`, role: 'status' }, q.msg),
    h('div', { class: 'actions' },
      h('button', { class: 'btn primary', disabled: !ready, onclick: check }, '檢查')));
}

/* --- step 2: 標聲調 --- */

function buildStep2(q) {
  const s = q.s;
  const allFilled = q.slots.every((t) => t != null);

  const clearOver = () =>
    app.querySelectorAll('.slot.over').forEach((n) => n.classList.remove('over'));
  const idxOf = (slotEl) => (slotEl ? Number(slotEl.dataset.slot) : null);
  const touched = (...is) => {
    is.forEach((i) => q.wrongSlots.delete(i));
    q.msg = '';
  };

  const fill = (i, sym) => {
    q.slots[i] = sym;
    q.selected = null;
    touched(i);
  };

  let flat = 0;
  const sentence = h('div', { class: 'sentence' },
    s.words.map((w) =>
      h('div', { class: 'word' },
        w.syls.map((syl) => {
          const i = flat++;
          const filled = q.slots[i] != null;
          const slot = h('div', {
            class: [
              'slot',
              filled && 'filled',
              filled && TONE[q.slots[i]].cls,
              q.selected === i && 'selected',
              q.wrongSlots.has(i) && 'wrong',
              q.solved && 'ok',
            ].filter(Boolean).join(' '),
            dataset: { slot: i },
          }, filled ? toneIcon(q.slots[i]) : '');
          if (!q.solved) {
            attachDrag(slot, {
              canDrag: () => q.slots[i] != null,
              onMove(x, y) {
                clearOver();
                const t = slotAt(x, y);
                if (t) t.classList.add('over');
              },
              onDrop(x, y) {
                const sym = q.slots[i];
                const t = idxOf(slotAt(x, y));
                if (t == null) {
                  q.slots[i] = null; // 拖出去 → 清除
                  touched(i);
                } else if (t !== i) {
                  q.slots[i] = null;
                  fill(t, sym);
                  touched(i);
                }
                renderQuiz();
              },
              onCancel: renderQuiz,
              onTap() {
                q.selected = q.selected === i ? null : i;
                q.msg = '';
                renderQuiz();
              },
            });
          }
          return h('div', { class: 'syl' }, h('div', { class: 'syl-text' }, syl.text), slot);
        }))));

  const palette = h('div', { class: 'palette' },
    TONES.map(({ sym, cls, name }) => {
      const el = h('div', { class: `tone ${cls}`, 'aria-label': name }, toneIcon(sym));
      if (!q.solved) {
        attachDrag(el, {
          keepSource: true,
          onMove(x, y) {
            clearOver();
            const t = slotAt(x, y);
            if (t) t.classList.add('over');
          },
          onDrop(x, y) {
            const t = idxOf(slotAt(x, y));
            if (t != null) fill(t, sym);
            renderQuiz();
          },
          onCancel: renderQuiz,
          onTap() {
            // 有選取的空格就填它；否則從第一個紅色（答錯）空格開始，沒有的話從第一個空格開始依序填
            const firstWrong = Math.min(...q.wrongSlots);
            const target = q.selected != null
              ? q.selected
              : q.wrongSlots.size ? firstWrong : q.slots.indexOf(null);
            if (target >= 0) fill(target, sym);
            renderQuiz();
          },
        });
      }
      return el;
    }));

  const check = () => {
    const wrong = new Set();
    s.syls.forEach((syl, i) => {
      if (q.slots[i] !== syl.tone) wrong.add(i);
    });
    q.wrongSlots = wrong;
    q.selected = null;
    if (wrong.size === 0) {
      q.solved = true;
      q.msg = '答對了！';
      renderQuiz();
      return;
    }
    if (registerMistake()) return;
    q.msg = '紅色的空格不對，再試一次';
    renderQuiz();
  };

  const last = session.idx + 1 >= session.queue.length;
  return h('section', { class: 'step' },
    h('p', { class: 'hint' }, '② 把聲調拖進每個音節下方的空格'),
    sentence,
    q.s.note ? h('div', { class: 'note' }, h('span', { class: 'note-k' }, '發音提示'), noteParts(q.s.note)) : null,
    h('p', { class: `msg${q.solved ? ' good' : q.msg && q.wrongSlots.size ? ' bad' : ''}`, role: 'status' }, q.msg),
    q.solved
      ? h('div', { class: 'actions' },
          h('button', { class: 'btn primary', onclick: nextQuestion }, last ? '完成' : '下一題'))
      : [
          palette,
          h('div', { class: 'actions' },
            h('button', { class: 'btn primary', disabled: !allFilled, onclick: check }, '檢查')),
        ]);
}

/* ---------- end screens ---------- */

function wrongList(list) {
  return h('ul', { class: 'wrong-list' },
    list.map((s) =>
      h('li', { class: 'wrong-item' },
        h('div', { class: 'wi-thai' }, s.thai),
        h('div', { class: 'wi-zh' }, s.zh),
        h('div', { class: 'wi-row' }, h('span', { class: 'wi-k' }, '切分'), h('span', { class: 'wi-v' }, s.splitStr)),
        h('div', { class: 'wi-row' }, h('span', { class: 'wi-k' }, '聲調'), h('span', { class: 'wi-v' }, toneLine(s.toneStr))))));
}

function renderEnd(kind) {
  const wrong = [...session.wrong.values()];
  const total = session.queue.length;
  const old = session;

  const titles = { done: '完成！', win: '勝利！', lose: '挑戰失敗' };
  const subs = {
    done: `${total} 句全部完成`,
    win: `${total} 句全部完成，剩餘 ${session.lives} 次機會`,
    lose: `3 次機會用完了（做到第 ${session.idx + 1} / ${total} 題）`,
  };

  const buttons = [];
  if (kind === 'done') {
    buttons.push(h('button', { class: 'btn primary',
      onclick: () => startSession({ sentences: old.sentences, useLives: old.useLives, practice: old.practice }) },
      old.practice ? '複習錯題' : '再玩一次'));
  } else if (wrong.length) {
    buttons.push(h('button', { class: 'btn primary',
      onclick: () => startSession({ sentences: wrong, useLives: false, practice: true }) },
      '複習錯題'));
  }
  buttons.push(h('button', { class: 'btn', onclick: renderHome }, '回主頁'));

  app.replaceChildren(
    h('main', { class: 'screen end' },
      h('h2', { class: `end-title ${kind}` }, titles[kind]),
      h('p', { class: 'end-sub' }, subs[kind]),
      wrong.length && kind !== 'done'
        ? h('section', {},
            h('h3', { class: 'wrong-head' }, `曾答錯的句子（${wrong.length}）`),
            wrongList(wrong))
        : null,
      h('div', { class: 'actions stack' }, buttons)));
  window.scrollTo(0, 0);
}

renderHome();
