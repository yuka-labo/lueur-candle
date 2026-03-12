/**
 * Lueur — 詩の図鑑（Poetry Collection）
 * 一度見た詩を記録し、図鑑のように閲覧できる機能
 */

// ========================================
// ハッシュ関数（詩のID生成用）
// ========================================
function generatePoemId(text, author) {
  const str = text + '|' + author;
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xffffffff;
  }
  return 'p' + (hash >>> 0).toString(36);
}

// ========================================
// 詩レジストリ構築
// ========================================
const POEM_REGISTRY = [];

const CATEGORY_LABELS = {
  'timeOfDay.morning': '朝の詩',
  'timeOfDay.afternoon': '昼の詩',
  'timeOfDay.evening': '夕の詩',
  'timeOfDay.lateNight': '夜更けの詩',
  'seasonal.spring': '春の詩',
  'seasonal.summer': '夏の詩',
  'seasonal.autumn': '秋の詩',
  'seasonal.winter': '冬の詩',
  'general': 'いつでもの詩',
};

const CATEGORY_ORDER = [
  'timeOfDay.morning', 'timeOfDay.afternoon', 'timeOfDay.evening', 'timeOfDay.lateNight',
  'seasonal.spring', 'seasonal.summer', 'seasonal.autumn', 'seasonal.winter',
  'general',
];

(function buildRegistry() {
  // 時間帯別
  for (const [sub, poems] of Object.entries(POEMS.timeOfDay)) {
    for (const poem of poems) {
      POEM_REGISTRY.push({
        id: generatePoemId(poem.text, poem.author),
        text: poem.text,
        author: poem.author,
        categoryKey: 'timeOfDay.' + sub,
      });
    }
  }
  // 季節別
  for (const [sub, poems] of Object.entries(POEMS.seasonal)) {
    for (const poem of poems) {
      POEM_REGISTRY.push({
        id: generatePoemId(poem.text, poem.author),
        text: poem.text,
        author: poem.author,
        categoryKey: 'seasonal.' + sub,
      });
    }
  }
  // 汎用
  for (const poem of POEMS.general) {
    POEM_REGISTRY.push({
      id: generatePoemId(poem.text, poem.author),
      text: poem.text,
      author: poem.author,
      categoryKey: 'general',
    });
  }
})();

// ========================================
// localStorage 永続化
// ========================================
const STORAGE_KEY = 'lueur-collection';

function loadCollection() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && data.version === 1) return data.poems;
    }
  } catch (e) { /* ignore */ }
  return {};
}

function saveCollection(poems) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, poems: poems }));
  } catch (e) { /* ignore */ }
}

let collectedPoems = loadCollection();

// ========================================
// 閲覧記録
// ========================================
function recordPoemView(text, author) {
  const id = generatePoemId(text, author);
  const now = new Date().toISOString();
  if (collectedPoems[id]) {
    collectedPoems[id].viewCount++;
  } else {
    collectedPoems[id] = { firstSeen: now, viewCount: 1 };
  }
  saveCollection(collectedPoems);
  updateBadge();
}

// ========================================
// 統計
// ========================================
function getCollectionStats() {
  const total = POEM_REGISTRY.length;
  const collected = Object.keys(collectedPoems).length;
  return { collected, total, percentage: Math.round((collected / total) * 100) };
}

// ========================================
// UI: コレクションボタン
// ========================================
let badgeEl = null;

function createCollectionButton() {
  const btn = document.createElement('button');
  btn.className = 'collection-button';
  btn.setAttribute('aria-label', '詩の図鑑を開く');
  btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
    </svg>
    <span class="collection-badge"></span>
  `;
  btn.addEventListener('click', openCollection);
  document.getElementById('app').appendChild(btn);

  badgeEl = btn.querySelector('.collection-badge');
  updateBadge();
}

function updateBadge() {
  if (!badgeEl) return;
  const stats = getCollectionStats();
  badgeEl.textContent = stats.collected + '/' + stats.total;
}

// ========================================
// UI: コレクションオーバーレイ
// ========================================
let overlayEl = null;
let isCollectionOpen = false;

function createCollectionOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'collection-overlay';
  overlay.innerHTML = `
    <div class="collection-header">
      <button class="collection-close" aria-label="閉じる">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      <h2 class="collection-title">詩の図鑑</h2>
      <div class="collection-stats-row">
        <span class="collection-stats-text"></span>
        <div class="collection-progress"><div class="collection-progress-bar"></div></div>
      </div>
    </div>
    <div class="collection-body"></div>
  `;
  overlay.querySelector('.collection-close').addEventListener('click', closeCollection);
  document.getElementById('app').appendChild(overlay);
  overlayEl = overlay;
}

function renderCollection() {
  if (!overlayEl) return;

  const stats = getCollectionStats();
  overlayEl.querySelector('.collection-stats-text').textContent =
    stats.collected + ' / ' + stats.total + ' 篇';
  overlayEl.querySelector('.collection-progress-bar').style.width = stats.percentage + '%';

  const body = overlayEl.querySelector('.collection-body');
  body.innerHTML = '';

  // カテゴリ別にグループ化
  const grouped = {};
  for (const key of CATEGORY_ORDER) {
    grouped[key] = [];
  }
  for (const poem of POEM_REGISTRY) {
    if (grouped[poem.categoryKey]) {
      grouped[poem.categoryKey].push(poem);
    }
  }

  for (const key of CATEGORY_ORDER) {
    const poems = grouped[key];
    if (!poems || poems.length === 0) continue;

    const section = document.createElement('div');
    section.className = 'collection-category';

    const collectedInCategory = poems.filter(p => collectedPoems[p.id]).length;

    const heading = document.createElement('h3');
    heading.className = 'collection-category-title';
    heading.textContent = CATEGORY_LABELS[key] + '  ' + collectedInCategory + '/' + poems.length;
    section.appendChild(heading);

    const grid = document.createElement('div');
    grid.className = 'collection-grid';

    for (const poem of poems) {
      const saved = collectedPoems[poem.id];
      const card = document.createElement('div');
      card.className = 'poem-card' + (saved ? '' : ' locked');

      if (saved) {
        const textEl = document.createElement('p');
        textEl.className = 'poem-card-text';
        textEl.textContent = poem.text;
        card.appendChild(textEl);

        const authorEl = document.createElement('span');
        authorEl.className = 'poem-card-author';
        authorEl.textContent = '— ' + poem.author;
        card.appendChild(authorEl);

        const dateEl = document.createElement('span');
        dateEl.className = 'poem-card-date';
        const d = new Date(saved.firstSeen);
        dateEl.textContent = d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate() + ' 発見';
        card.appendChild(dateEl);
      } else {
        const placeholder = document.createElement('p');
        placeholder.className = 'poem-card-placeholder';
        placeholder.textContent = '？';
        card.appendChild(placeholder);
      }

      grid.appendChild(card);
    }

    section.appendChild(grid);
    body.appendChild(section);
  }
}

function openCollection() {
  if (isCollectionOpen) return;
  isCollectionOpen = true;
  renderCollection();
  overlayEl.classList.add('open');
  history.pushState({ collection: true }, '');
}

function closeCollection() {
  if (!isCollectionOpen) return;
  isCollectionOpen = false;
  overlayEl.classList.remove('open');
}

// ブラウザバック対応
window.addEventListener('popstate', function (e) {
  if (isCollectionOpen) {
    closeCollection();
  }
});

// ========================================
// 初期化
// ========================================
function initCollection() {
  createCollectionButton();
  createCollectionOverlay();
}
