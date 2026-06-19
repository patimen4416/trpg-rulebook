// ===== Supabase初期化 =====
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const isLocalMode = typeof LOCAL_MODE !== 'undefined' && LOCAL_MODE;

// ===== 状態管理 =====
let currentUser = null;
let screenshots = [];
let systems = [];
let tagMaster = [];
let categorySchemas = [];
let activeFilters = new Set();
let currentTags = [];
let uploadFiles = [];
let filteredList = [];
let viewMode = 'text'; // 'text' | 'list'
let orderDirty = false; // 並べ替え変更があるか

const chapterTagNames = ['キャラ作成', '戦闘', '判定', 'ワールド', 'セッション進行'];

// ===== ローカルモードデフォルト =====
const defaultSystems = [
  { id: 1, name: 'ダブルクロス3rd', short_name: 'DX3', color: '#e94560' },
  { id: 2, name: 'クトゥルフ7版', short_name: 'CoC7', color: '#2ed573' },
  { id: 3, name: 'ソードワールド2.5', short_name: 'SW25', color: '#ffa502' },
  { id: 4, name: 'インセイン', short_name: 'INS', color: '#a55eea' },
];

const defaultCategorySchemas = [
  {
    system_name: 'ダブルクロス3rd', category: 'エフェクト', sort_order: 1,
    fields: [
      { name: '記載本', type: 'text', placeholder: '基本ルールブック1' },
      { name: 'シンドローム', type: 'select', options: ['エンジェルハイロゥ','バロール','ブラックドッグ','ブラムストーカー','キメラ','エグザイル','ハヌマーン','ミストルティン','モルフェウス','ノイマン','オルクス','サラマンドラ','ソラリス','ウロボロス'] },
      { name: '最大レベル', type: 'text', placeholder: '3, 5, 10 等' },
      { name: 'タイミング', type: 'select', options: ['メジャー','マイナー','セットアップ','イニシアチブ','クリンナップ','リアクション','オート','常時'] },
      { name: '技能', type: 'text', placeholder: '白兵, 射撃, RC 等' },
      { name: '難易度', type: 'text', placeholder: '対決, 自動成功 等' },
      { name: '対象', type: 'text', placeholder: '単体, 範囲(選択) 等' },
      { name: '射程', type: 'text', placeholder: '武器, 視界, 至近 等' },
      { name: '侵蝕値', type: 'text', placeholder: '3, 2D10 等' },
      { name: '制限', type: 'text', placeholder: '80%, 100%, なし, ー 等' },
    ]
  },
  {
    system_name: 'ダブルクロス3rd', category: 'Dロイス', sort_order: 2,
    fields: [
      { name: '記載本', type: 'text', placeholder: '基本ルールブック1' },
      { name: 'シンドローム', type: 'select', options: ['エンジェルハイロゥ','バロール','ブラックドッグ','ブラムストーカー','キメラ','エグザイル','ハヌマーン','ミストルティン','モルフェウス','ノイマン','オルクス','サラマンドラ','ソラリス','ウロボロス','共通'] },
      { name: '制限', type: 'text', placeholder: '取得条件等' },
    ]
  },
  {
    system_name: 'ダブルクロス3rd', category: 'アイテム', sort_order: 3,
    fields: [
      { name: '記載本', type: 'text', placeholder: '基本ルールブック1' },
      { name: 'シンドローム', type: 'select', options: ['エンジェルハイロゥ','バロール','ブラックドッグ','ブラムストーカー','キメラ','エグザイル','ハヌマーン','ミストルティン','モルフェウス','ノイマン','オルクス','サラマンドラ','ソラリス','ウロボロス','共通'] },
      { name: '種類', type: 'select', options: ['武器','防具','その他','ヴィークル','コネ'] },
    ]
  },
];

const defaultTagMaster = [
  { name: 'キャラ作成', system_name: null, category: 'chapter', sort_order: 1 },
  { name: '戦闘', system_name: null, category: 'chapter', sort_order: 2 },
  { name: '判定', system_name: null, category: 'chapter', sort_order: 3 },
  { name: 'ワールド', system_name: null, category: 'chapter', sort_order: 4 },
  { name: 'セッション進行', system_name: null, category: 'chapter', sort_order: 5 },
];

// ===== 認証 =====
async function checkSession() {
  if (isLocalMode) {
    currentUser = { id: 0, username: 'local', display_name: 'ローカルユーザー' };
    showMainApp();
    return;
  }
  const saved = localStorage.getItem('rulebook_user');
  if (saved) {
    currentUser = JSON.parse(saved);
    showMainApp();
  }
}

async function doLogin() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';
  if (!username || !password) { errEl.textContent = 'IDとパスワードを入力してください'; return; }

  const { data, error } = await sb.rpc('rulebook_login', { p_username: username, p_password: password });
  if (error || !data || data.length === 0) { errEl.textContent = 'IDまたはパスワードが正しくありません'; return; }

  currentUser = data[0];
  localStorage.setItem('rulebook_user', JSON.stringify(currentUser));
  showMainApp();
}

async function doSignup() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const displayName = document.getElementById('loginDisplayName').value.trim();
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';
  if (!username || !password) { errEl.textContent = 'IDとパスワードを入力してください'; return; }
  if (!displayName) { errEl.textContent = '表示名を入力してください'; return; }
  if (username.length < 3) { errEl.textContent = 'IDは3文字以上にしてください'; return; }
  if (password.length < 4) { errEl.textContent = 'パスワードは4文字以上にしてください'; return; }

  const { data, error } = await sb.rpc('rulebook_register', { p_username: username, p_password: password, p_display_name: displayName });
  if (error) {
    errEl.textContent = error.message.includes('unique') || error.message.includes('duplicate')
      ? 'そのIDは既に使われています' : '登録に失敗しました: ' + error.message;
    return;
  }
  currentUser = data[0];
  localStorage.setItem('rulebook_user', JSON.stringify(currentUser));
  showMainApp();
}

function doLogout() {
  localStorage.removeItem('rulebook_user');
  currentUser = null;
  document.getElementById('mainApp').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
}

function getDisplayName() {
  return currentUser?.display_name || currentUser?.username || '不明';
}

// ===== メイン画面 =====
async function showMainApp() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('mainApp').style.display = 'block';
  document.getElementById('currentUser').textContent = getDisplayName();
  document.getElementById('loadingIndicator').style.display = 'block';

  await Promise.all([loadSystems(), loadTagMaster(), loadCategorySchemas(), loadScreenshots(), loadOcrUsage()]);

  document.getElementById('loadingIndicator').style.display = 'none';
  // 初期表示モード設定
  document.querySelectorAll('.view-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === viewMode));
  render();
}

// ===== データ読み込み =====
async function loadSystems() {
  if (isLocalMode) { systems = defaultSystems; return; }
  const { data } = await sb.from('rulebook_systems').select('*').order('name');
  if (data) systems = data;
}

async function loadTagMaster() {
  if (isLocalMode) { tagMaster = defaultTagMaster; return; }
  const { data } = await sb.from('rulebook_tags').select('*').order('sort_order');
  if (data) tagMaster = data;
}

async function loadCategorySchemas() {
  if (isLocalMode) { categorySchemas = defaultCategorySchemas; return; }
  const { data } = await sb.from('rulebook_category_schemas').select('*').order('sort_order');
  if (data) categorySchemas = data;
}

async function loadScreenshots() {
  if (isLocalMode) {
    const saved = localStorage.getItem('rulebook_screenshots');
    screenshots = saved ? JSON.parse(saved) : [];
    return;
  }
  let { data, error } = await sb.from('rulebook_screenshots').select('*').order('sort_order', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false });
  if (error && error.code === '42703') {
    // sort_order column doesn't exist yet — fallback to created_at
    const fallback = await sb.from('rulebook_screenshots').select('*').order('created_at', { ascending: false });
    data = fallback.data; error = fallback.error;
  }
  if (error) { console.error('loadScreenshots error:', error); return; }
  screenshots = data || [];
}

function saveLocalScreenshots() {
  if (isLocalMode) localStorage.setItem('rulebook_screenshots', JSON.stringify(screenshots));
}

// ===== ユーティリティ =====
function getSystemColor(systemName) {
  return systems.find(s => s.name === systemName)?.color || '#666';
}

function getSystemShort(systemName) {
  return systems.find(s => s.name === systemName)?.short_name || (systemName || '?').charAt(0);
}

function getCategoriesForSystem(systemName) {
  return categorySchemas.filter(s => s.system_name === systemName).sort((a, b) => a.sort_order - b.sort_order);
}

function getFieldsForCategory(systemName, category) {
  const schema = categorySchemas.find(s => s.system_name === systemName && s.category === category);
  return schema?.fields || [];
}

function escAttr(s) { return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;'); }

// ===== サイドバー =====
function getAllTags(category) {
  const m = {};
  screenshots.forEach(s => {
    if (category === 'system') {
      m[s.system_name] = (m[s.system_name] || 0) + 1;
    } else if (category === 'category') {
      if (s.category) m[s.category] = (m[s.category] || 0) + 1;
    } else if (category === 'page') {
      if (s.page_number) m[s.page_number] = (m[s.page_number] || 0) + 1;
    } else {
      (s.tags || []).forEach(t => {
        const isChapter = chapterTagNames.includes(t);
        if (category === 'chapter' && isChapter) m[t] = (m[t] || 0) + 1;
        else if (category === 'content' && !isChapter) m[t] = (m[t] || 0) + 1;
      });
    }
    if (category === 'field' && s.structured_fields) {
      for (const [k, v] of Object.entries(s.structured_fields)) {
        if (v) { const key = `${k}:${v}`; m[key] = (m[key] || 0) + 1; }
      }
    }
  });
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
}

function renderSidebar() {
  const sections = {
    systemTags: 'system',
    categoryTags: 'category',
    chapterTags: 'chapter',
    contentTags: 'content',
    pageTags: 'page',
  };
  for (const [elId, cat] of Object.entries(sections)) {
    const el = document.getElementById(elId);
    if (!el) continue;
    const tags = getAllTags(cat);
    el.innerHTML = tags.map(([name, count]) => {
      const escaped = escAttr(name);
      return `<span class="tag ${activeFilters.has(name) ? 'active' : ''}" data-cat="${cat}" onclick="toggleFilter('${escaped}')">${name} <span class="count">${count}</span></span>`;
    }).join('');
  }

  const fieldEl = document.getElementById('fieldTags');
  if (fieldEl) {
    const fieldTags = getAllTags('field');
    fieldEl.innerHTML = fieldTags.slice(0, 30).map(([name, count]) => {
      const escaped = escAttr(name);
      return `<span class="tag ${activeFilters.has(name) ? 'active' : ''}" data-cat="field" onclick="toggleFilter('${escaped}')">${name} <span class="count">${count}</span></span>`;
    }).join('');
  }
}

function toggleFilter(tag) {
  activeFilters.has(tag) ? activeFilters.delete(tag) : activeFilters.add(tag);
  render();
  if (window.innerWidth <= 768) closeSidebar();
}

function clearFilters() {
  activeFilters.clear();
  document.getElementById('searchBox').value = '';
  render();
}

// ===== フィルタ =====
function getFiltered() {
  const q = document.getElementById('searchBox').value.toLowerCase();
  return screenshots.filter(s => {
    for (const f of activeFilters) {
      if (f.includes(':')) {
        const [k, v] = f.split(':');
        if (!s.structured_fields || s.structured_fields[k] !== v) return false;
      } else {
        const allTags = [s.system_name, s.category, s.page_number, ...(s.tags || [])];
        if (!allTags.includes(f)) return false;
      }
    }
    if (q) {
      const hay = [s.title, s.system_name, s.category, s.page_number, s.extracted_text, s.memo, ...(s.tags || [])].join(' ').toLowerCase();
      const fieldVals = s.structured_fields ? Object.values(s.structured_fields).join(' ').toLowerCase() : '';
      if (!(hay + ' ' + fieldVals).includes(q)) return false;
    }
    return true;
  });
}

// ===== 表示モード切替 =====
function setViewMode(mode) {
  viewMode = mode;
  document.querySelectorAll('.view-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  render();
}

// ===== カード描画 =====
function renderCards() {
  filteredList = getFiltered();
  document.getElementById('resultCount').textContent = `${filteredList.length} 件`;

  const fi = document.getElementById('filterInfo');
  if (activeFilters.size > 0) {
    fi.classList.add('visible');
    document.getElementById('filterText').textContent = `絞り込み: ${[...activeFilters].join(' + ')}（${filteredList.length}件）`;
  } else {
    fi.classList.remove('visible');
  }

  const grid = document.getElementById('cardGrid');

  if (viewMode === 'list') {
    grid.className = 'list-view';
    grid.innerHTML = renderListView();
  } else {
    grid.className = 'grid grid-text';
    grid.innerHTML = filteredList.map((s, idx) => renderTextCard(s, idx)).join('');
    setupDragAndDrop();
  }
}

function renderTextCard(s, idx) {
  const color = getSystemColor(s.system_name);
  const fields = s.structured_fields || {};
  const extracted = s.extracted_text || '';

  const parsed = extracted ? parseEffectText(extracted) : {};
  const merged = { ...parsed, ...fields };

  const effectName = s.title || s.memo || merged['エフェクト名'] || '(無題)';
  const syndrome = merged['シンドローム'] || '';

  const layoutFields = [
    ['タイミング', merged['タイミング']],
    ['判定', merged['判定']],
    ['技能', merged['技能']],
    ['難易度', merged['難易度']],
    ['対象', merged['対象']],
    ['射程', merged['射程']],
    ['侵蝕値', merged['侵蝕値']],
    ['制限', merged['制限']],
    ['最大Lv', merged['最大Lv'] || merged['Lv']],
  ].filter(([, v]) => v);

  let description = extracted;
  if (description) {
    const removePatterns = /^(タイミング|判定|技能|難易度|対象|射程|侵蝕値?|制限|最大(?:LV|Lv|レベル)|LV|Lv)[：:\s].*/gim;
    description = description.replace(removePatterns, '').trim();
    if (effectName && description.startsWith(effectName)) {
      description = description.slice(effectName.length).trim();
    }
    const effMatch = description.match(/効果[:：\s]*([\s\S]*)/);
    if (effMatch) description = effMatch[1].trim();
    if (description.length > 200) description = description.slice(0, 200) + '…';
  }

  const fieldsHtml = layoutFields.length > 0
    ? `<div class="tcard-fields">${layoutFields.map(([k, v]) =>
        `<div class="tcard-field"><span class="tcard-label">${k}</span><span class="tcard-value">${v}</span></div>`
      ).join('')}</div>`
    : '';

  const descHtml = description
    ? `<div class="tcard-desc">${description}</div>`
    : (extracted ? `<div class="tcard-desc tcard-full">${extracted.slice(0, 300)}${extracted.length > 300 ? '…' : ''}</div>` : '<div class="tcard-desc tcard-empty">テキスト未入力</div>');

  return `
  <div class="card tcard" data-idx="${idx}" data-id="${s.id}" draggable="true">
    <div class="tcard-actions">
      <span class="drag-handle tcard-action-btn" title="ドラッグで並べ替え">⠿</span>
      <button class="tcard-action-btn" onclick="openEditFromIdx(${idx})" title="編集">✎</button>
      <button class="tcard-action-btn btn-del" onclick="deleteFromIdx(${idx})" title="削除">✕</button>
    </div>
    <div class="tcard-header" style="border-left: 4px solid ${color};">
      <div class="tcard-name">${effectName}</div>
      ${syndrome ? `<div class="tcard-syndrome" style="color:${color}">${syndrome}</div>` : ''}
    </div>
    ${fieldsHtml}
    ${descHtml}
    <div class="card-meta">
      <span>${s.system_name}${s.category ? ' / ' + s.category : ''}</span>
      <span>${s.page_number ? 'P' + s.page_number : ''}</span>
    </div>
  </div>`;
}

function renderListView() {
  if (filteredList.length === 0) return '<div class="list-empty">データがありません</div>';

  return `<table class="list-table">
    <thead>
      <tr>
        <th>タイトル</th>
        <th>システム</th>
        <th>カテゴリ</th>
        <th>ページ</th>
        <th>フィールド</th>
        <th>投稿者</th>
        <th>操作</th>
      </tr>
    </thead>
    <tbody>
      ${filteredList.map((s, idx) => {
        const color = getSystemColor(s.system_name);
        const fields = s.structured_fields || {};
        const fieldStr = Object.entries(fields).filter(([,v]) => v).map(([k,v]) => `<span class="field-pill">${k}: ${v}</span>`).join(' ');
        return `<tr class="list-row">
          <td class="list-title">${s.title || s.memo || '(無題)'}</td>
          <td><span class="system-dot" style="background:${color}"></span>${s.system_name}</td>
          <td>${s.category || '-'}</td>
          <td>${s.page_number || '-'}</td>
          <td class="list-fields">${fieldStr || '-'}</td>
          <td>${s.uploader_name}</td>
          <td class="list-actions">
            <button class="list-action-btn" onclick="openEditFromIdx(${idx})">編集</button>
            <button class="list-action-btn btn-del" onclick="deleteFromIdx(${idx})">削除</button>
          </td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>`;
}

function render() {
  renderSidebar();
  renderCards();
}

// ===== ドラッグ＆ドロップ並べ替え =====
let dragSrcIdx = null;

function setupDragAndDrop() {
  const cards = document.querySelectorAll('.card[draggable="true"]');
  cards.forEach(card => {
    card.addEventListener('dragstart', onDragStart);
    card.addEventListener('dragover', onDragOver);
    card.addEventListener('dragenter', onDragEnter);
    card.addEventListener('dragleave', onDragLeave);
    card.addEventListener('drop', onDrop);
    card.addEventListener('dragend', onDragEnd);

    // Long-press for mobile
    let longPressTimer = null;
    card.addEventListener('touchstart', e => {
      longPressTimer = setTimeout(() => {
        card.classList.add('dragging');
        dragSrcIdx = parseInt(card.dataset.idx);
      }, 500);
    }, { passive: true });
    card.addEventListener('touchend', () => { clearTimeout(longPressTimer); });
    card.addEventListener('touchmove', () => { clearTimeout(longPressTimer); });
  });
}

function onDragStart(e) {
  dragSrcIdx = parseInt(e.currentTarget.dataset.idx);
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', dragSrcIdx);
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function onDragEnter(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}

function onDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

function onDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const destIdx = parseInt(e.currentTarget.dataset.idx);
  if (dragSrcIdx === null || dragSrcIdx === destIdx) return;

  // filteredListのインデックスからscreenshotsのインデックスに変換
  const srcItem = filteredList[dragSrcIdx];
  const destItem = filteredList[destIdx];
  const srcRealIdx = screenshots.indexOf(srcItem);
  const destRealIdx = screenshots.indexOf(destItem);

  if (srcRealIdx < 0 || destRealIdx < 0) return;

  // 配列内で移動
  screenshots.splice(srcRealIdx, 1);
  const newDestIdx = screenshots.indexOf(destItem);
  screenshots.splice(newDestIdx >= 0 ? newDestIdx : destRealIdx, 0, srcItem);

  // sort_orderを更新
  screenshots.forEach((s, i) => { s.sort_order = i; });

  orderDirty = true;
  document.getElementById('btnSaveOrder').style.display = 'inline-block';
  saveLocalScreenshots();
  render();
}

function onDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.card').forEach(c => c.classList.remove('drag-over'));
  dragSrcIdx = null;
}

// ===== 順序保存 =====
async function saveOrder() {
  const btn = document.getElementById('btnSaveOrder');
  btn.textContent = '保存中...';

  if (isLocalMode) {
    saveLocalScreenshots();
    btn.textContent = '保存しました';
    setTimeout(() => { btn.style.display = 'none'; btn.textContent = '順序を保存'; }, 1000);
    orderDirty = false;
    return;
  }

  try {
    // バッチ更新: 各レコードの sort_order を更新
    const updates = screenshots.map((s, i) => ({ id: s.id, sort_order: i }));
    // 10件ずつバッチ処理
    for (let i = 0; i < updates.length; i += 10) {
      const batch = updates.slice(i, i + 10);
      await Promise.all(batch.map(u =>
        sb.from('rulebook_screenshots').update({ sort_order: u.sort_order }).eq('id', u.id)
      ));
    }
    btn.textContent = '保存しました';
    orderDirty = false;
    setTimeout(() => { btn.style.display = 'none'; btn.textContent = '順序を保存'; }, 1500);
  } catch (e) {
    console.error('saveOrder error:', e);
    btn.textContent = '保存失敗';
    setTimeout(() => { btn.textContent = '順序を保存'; }, 2000);
  }
}

// ===== 登録モーダル =====
let uploadStructuredFields = {};

function openRegister() {
  document.getElementById('registerModal').classList.add('visible');
  uploadFiles = [];
  currentTags = [];
  uploadStructuredFields = {};
  renderUploadPreview();
  renderCurrentTags();
  document.getElementById('uploadPage').value = '';
  document.getElementById('uploadMemo').value = '';
  document.getElementById('uploadExtractedText').value = '';
  document.getElementById('uploadStatus').textContent = '';
  document.getElementById('fileInput').value = '';
  document.getElementById('ocrResult').value = '';
  document.getElementById('ocrStatus').textContent = '';
  document.getElementById('btnParse').style.display = 'none';
  renderSystemSelect('uploadSystem');
  onUploadSystemChange();
}

function closeRegister() {
  document.getElementById('registerModal').classList.remove('visible');
}

function renderSystemSelect(elId) {
  const sel = document.getElementById(elId);
  const sorted = [...systems].sort((a, b) => a.name === 'ダブルクロス3rd' ? -1 : b.name === 'ダブルクロス3rd' ? 1 : 0);
  sel.innerHTML = sorted.map(s => `<option value="${s.name}">${s.name}</option>`).join('')
    + '<option value="__new">+ 新しいシステムを追加...</option>';
  sel.onchange = () => {
    if (sel.value === '__new') {
      const name = prompt('新しいルールブック名を入力してください:');
      if (name && name.trim()) { addNewSystem(name.trim()); } else { sel.selectedIndex = 0; }
    }
    if (elId === 'uploadSystem') onUploadSystemChange();
    if (elId === 'editSystem') onEditSystemChange();
  };
}

function onUploadSystemChange() {
  const sys = document.getElementById('uploadSystem').value;
  renderCategorySelect('uploadCategory', sys);
  renderQuickTags('quickTags', sys);
  onUploadCategoryChange();
}

function onUploadCategoryChange() {
  const sys = document.getElementById('uploadSystem').value;
  const cat = document.getElementById('uploadCategory').value;
  renderStructuredFields('uploadFields', sys, cat, {});
}

function renderCategorySelect(elId, systemName) {
  const el = document.getElementById(elId);
  const cats = getCategoriesForSystem(systemName);
  el.innerHTML = '<option value="">(カテゴリなし / 一般)</option>'
    + cats.map(c => `<option value="${c.category}">${c.category}</option>`).join('');
  el.onchange = () => {
    if (elId === 'uploadCategory') onUploadCategoryChange();
    if (elId === 'editCategory') onEditCategoryChange();
  };
}

function renderStructuredFields(containerId, systemName, category, currentValues) {
  const container = document.getElementById(containerId);
  const fields = getFieldsForCategory(systemName, category);
  if (fields.length === 0) {
    container.innerHTML = '';
    container.style.display = 'none';
    return;
  }
  container.style.display = 'block';
  container.innerHTML = `<div class="fields-header">カテゴリ別フィールド（${category}）</div>`
    + fields.map(f => {
      const val = currentValues[f.name] || '';
      if (f.type === 'select') {
        return `<div class="form-group field-row">
          <label>${f.name}</label>
          <select data-field="${escAttr(f.name)}" class="structured-field">
            <option value="">-- 選択 --</option>
            ${(f.options || []).map(o => `<option value="${escAttr(o)}" ${o === val ? 'selected' : ''}>${o}</option>`).join('')}
          </select>
        </div>`;
      }
      return `<div class="form-group field-row">
        <label>${f.name}</label>
        <input type="text" data-field="${escAttr(f.name)}" class="structured-field" value="${escAttr(val)}" placeholder="${escAttr(f.placeholder || '')}">
      </div>`;
    }).join('');
}

function collectStructuredFields(containerId) {
  const result = {};
  document.querySelectorAll(`#${containerId} .structured-field`).forEach(el => {
    const name = el.dataset.field;
    const val = el.value.trim();
    if (val) result[name] = val;
  });
  return result;
}

async function addNewSystem(name) {
  if (isLocalMode) {
    systems.push({ id: Date.now(), name, short_name: name.slice(0, 3), color: '#888' });
    renderSystemSelect('uploadSystem');
    document.getElementById('uploadSystem').value = name;
    return;
  }
  const { data, error } = await sb.from('rulebook_systems').insert({ name, short_name: name.slice(0, 3), color: '#888' }).select().single();
  if (!error && data) {
    systems.push(data);
    renderSystemSelect('uploadSystem');
    document.getElementById('uploadSystem').value = name;
  }
}

function renderQuickTags(elId, systemName) {
  const el = document.getElementById(elId);
  const tags = tagMaster.filter(t => t.system_name === systemName || t.system_name === null);
  el.innerHTML = tags.map(t => `<span class="quick-tag" onclick="addTag('${escAttr(t.name)}')">${t.name}</span>`).join('');
}

// D&D for file upload (OCR用)
document.addEventListener('DOMContentLoaded', () => {
  const dz = document.getElementById('dropZone');
  if (dz) {
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
    dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('dragover'); handleFiles(e.dataTransfer.files); });
  }
});

function handleFiles(files) {
  uploadFiles = []; // 1枚だけ保持（OCR用一時ファイル）
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const reader = new FileReader();
    reader.onload = e => {
      uploadFiles = [{ file, dataUrl: e.target.result }];
      renderUploadPreview();
    };
    reader.readAsDataURL(file);
    break; // 1枚のみ
  }
}

function renderUploadPreview() {
  const el = document.getElementById('uploadPreview');
  el.innerHTML = uploadFiles.map((f, i) =>
    `<div class="preview-item">
      <img src="${f.dataUrl}" alt="">
      <button class="remove-preview" onclick="removeFile(${i})">&times;</button>
    </div>`
  ).join('');
}

function removeFile(i) {
  uploadFiles.splice(i, 1);
  renderUploadPreview();
}

// タグ入力
function addTag(name) {
  name = name.trim();
  if (!name || currentTags.includes(name)) return;
  currentTags.push(name);
  renderCurrentTags();
}

function removeCurrentTag(i) {
  currentTags.splice(i, 1);
  renderCurrentTags();
}

function renderCurrentTags() {
  const wrap = document.getElementById('tagInputWrap');
  const input = document.getElementById('tagInput');
  wrap.querySelectorAll('.added-tag').forEach(el => el.remove());
  currentTags.forEach((t, i) => {
    const span = document.createElement('span');
    span.className = 'added-tag';
    span.innerHTML = `${t} <span class="remove-tag" onclick="removeCurrentTag(${i})">&times;</span>`;
    wrap.insertBefore(span, input);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('tagInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addTag(e.target.value); e.target.value = ''; }
  });
});

// ===== OCR (Google Cloud Vision API) =====
let ocrUsage = { used: 0, limit: 1000, resetDate: '' };

async function loadOcrUsage() {
  try {
    const ym = new Date().toISOString().slice(0, 7);
    const { data } = await sb.from('ocr_usage').select('*').eq('year_month', ym).single();
    if (data) {
      ocrUsage.used = data.used_count;
      ocrUsage.limit = data.free_limit;
    }
    const now = new Date();
    const resetD = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const diffDays = Math.ceil((resetD - now) / (1000 * 60 * 60 * 24));
    ocrUsage.resetDate = diffDays;
    updateOcrUsageUI();
  } catch (e) { console.warn('OCR usage load error:', e); }
}

function updateOcrUsageUI() {
  const el = document.getElementById('ocrUsageInfo');
  if (!el) return;
  const remaining = Math.max(0, ocrUsage.limit - ocrUsage.used);
  const pct = Math.round((ocrUsage.used / ocrUsage.limit) * 100);
  const barColor = pct > 80 ? '#e94560' : pct > 50 ? '#ffa502' : '#2ed573';
  el.innerHTML = `
    <div class="ocr-usage-bar">
      <div class="ocr-usage-fill" style="width:${pct}%;background:${barColor}"></div>
    </div>
    <span class="ocr-usage-text">今月: ${ocrUsage.used}/${ocrUsage.limit}回使用（残り${remaining}回）リセットまで${ocrUsage.resetDate}日</span>
  `;
  el.style.display = 'block';
}

async function incrementOcrUsage() {
  const ym = new Date().toISOString().slice(0, 7);
  const { data } = await sb.from('ocr_usage').select('*').eq('year_month', ym).single();
  if (data) {
    await sb.from('ocr_usage').update({ used_count: data.used_count + 1, updated_at: new Date().toISOString() }).eq('year_month', ym);
  } else {
    await sb.from('ocr_usage').insert({ year_month: ym, used_count: 1, free_limit: 1000 });
  }
  ocrUsage.used++;
  updateOcrUsageUI();
}

async function runOCR() {
  if (uploadFiles.length === 0) { alert('先に画像を選択してください'); return; }
  if (typeof VISION_API_KEY === 'undefined' || !VISION_API_KEY) { alert('Vision APIキーが設定されていません（config.js）'); return; }

  const statusEl = document.getElementById('ocrStatus');
  const resultEl = document.getElementById('ocrResult');

  statusEl.textContent = '使用量を確認中...';
  await loadOcrUsage();
  const safetyMargin = 50;
  const hardLimit = ocrUsage.limit - safetyMargin;
  if (ocrUsage.used >= hardLimit) {
    alert(`今月のOCR使用量が安全上限に達しました（${ocrUsage.used}/${ocrUsage.limit}回）。`);
    statusEl.textContent = '';
    return;
  }

  statusEl.textContent = 'Google Cloud Vision APIに送信中...';

  try {
    const dataUrl = uploadFiles[0].dataUrl;
    const base64 = dataUrl.replace(/^data:image\/[a-z]+;base64,/, '');

    const resp = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${VISION_API_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        requests: [{
          image: { content: base64 },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
          imageContext: { languageHints: ['ja', 'en'] }
        }]
      })}
    );

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(`API Error ${resp.status}: ${errData.error?.message || resp.statusText}`);
    }

    const result = await resp.json();
    const annotation = result.responses?.[0]?.fullTextAnnotation;

    if (annotation && annotation.text) {
      const ocrText = annotation.text.trim();
      resultEl.value = ocrText;
      // テキスト内容フィールドにも反映
      document.getElementById('uploadExtractedText').value = ocrText;
      document.getElementById('btnParse').style.display = 'inline-block';

      const parsed = parseEffectText(ocrText);
      const filledKeys = Object.keys(parsed).filter(k => k !== 'エフェクト名' && k !== '効果');
      autoFillFields(parsed);
      if (filledKeys.length > 0) {
        statusEl.textContent = `認識完了（${ocrText.length}文字）— ${filledKeys.length}項目を自動入力`;
      } else {
        statusEl.textContent = `認識完了（${ocrText.length}文字）`;
      }
    } else {
      resultEl.value = '';
      statusEl.textContent = 'テキストが検出されませんでした';
    }

    await incrementOcrUsage();
  } catch (e) {
    console.error('Vision API error:', e);
    statusEl.textContent = 'OCRエラー: ' + e.message;
  }
}

// ===== クリッピング＆範囲OCR =====
let clipState = { img: null, startX: 0, startY: 0, endX: 0, endY: 0, dragging: false, results: [] };

function openClipper() {
  if (uploadFiles.length === 0) { alert('先に画像を選択してください'); return; }
  const modal = document.getElementById('clipperModal');
  modal.classList.add('visible');
  clipState.results = [];
  renderClipResults();

  const img = new Image();
  img.onload = () => {
    clipState.img = img;
    const canvas = document.getElementById('clipperCanvas');
    const wrap = document.getElementById('clipperCanvasWrap');
    const maxW = wrap.clientWidth || 860;
    const scale = Math.min(1, maxW / img.width);
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    clipState.scale = scale;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    setupClipperEvents(canvas);
  };
  img.src = uploadFiles[0].dataUrl;
}

function closeClipper() {
  document.getElementById('clipperModal').classList.remove('visible');
}

function setupClipperEvents(canvas) {
  const newCanvas = canvas.cloneNode(true);
  canvas.parentNode.replaceChild(newCanvas, canvas);
  const ctx = newCanvas.getContext('2d');

  newCanvas.addEventListener('mousedown', e => {
    const rect = newCanvas.getBoundingClientRect();
    clipState.startX = e.clientX - rect.left;
    clipState.startY = e.clientY - rect.top;
    clipState.dragging = true;
  });

  newCanvas.addEventListener('mousemove', e => {
    if (!clipState.dragging) return;
    const rect = newCanvas.getBoundingClientRect();
    clipState.endX = e.clientX - rect.left;
    clipState.endY = e.clientY - rect.top;
    ctx.drawImage(clipState.img, 0, 0, newCanvas.width, newCanvas.height);
    clipState.results.forEach(r => {
      ctx.strokeStyle = '#2ed573'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
      ctx.strokeRect(r.x * clipState.scale, r.y * clipState.scale, r.w * clipState.scale, r.h * clipState.scale);
      ctx.setLineDash([]);
    });
    const sx = clipState.startX, sy = clipState.startY;
    const w = clipState.endX - sx, h = clipState.endY - sy;
    ctx.strokeStyle = '#e94560'; ctx.lineWidth = 2; ctx.setLineDash([6, 3]);
    ctx.strokeRect(sx, sy, w, h);
    ctx.fillStyle = 'rgba(233,69,96,0.15)';
    ctx.fillRect(sx, sy, w, h);
    ctx.setLineDash([]);
  });

  newCanvas.addEventListener('mouseup', e => {
    if (!clipState.dragging) return;
    clipState.dragging = false;
    const rect = newCanvas.getBoundingClientRect();
    clipState.endX = e.clientX - rect.left;
    clipState.endY = e.clientY - rect.top;
    const w = Math.abs(clipState.endX - clipState.startX);
    const h = Math.abs(clipState.endY - clipState.startY);
    document.getElementById('clipOcrBtn').disabled = (w < 10 || h < 10);
  });

  // Touch support
  newCanvas.addEventListener('touchstart', e => {
    e.preventDefault();
    const rect = newCanvas.getBoundingClientRect();
    const t = e.touches[0];
    clipState.startX = t.clientX - rect.left;
    clipState.startY = t.clientY - rect.top;
    clipState.dragging = true;
  }, { passive: false });

  newCanvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (!clipState.dragging) return;
    const rect = newCanvas.getBoundingClientRect();
    const t = e.touches[0];
    clipState.endX = t.clientX - rect.left;
    clipState.endY = t.clientY - rect.top;
    ctx.drawImage(clipState.img, 0, 0, newCanvas.width, newCanvas.height);
    clipState.results.forEach(r => {
      ctx.strokeStyle = '#2ed573'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
      ctx.strokeRect(r.x * clipState.scale, r.y * clipState.scale, r.w * clipState.scale, r.h * clipState.scale);
      ctx.setLineDash([]);
    });
    const sx = clipState.startX, sy = clipState.startY;
    const w = clipState.endX - sx, h = clipState.endY - sy;
    ctx.strokeStyle = '#e94560'; ctx.lineWidth = 2; ctx.setLineDash([6, 3]);
    ctx.strokeRect(sx, sy, w, h);
    ctx.fillStyle = 'rgba(233,69,96,0.15)';
    ctx.fillRect(sx, sy, w, h);
    ctx.setLineDash([]);
  }, { passive: false });

  newCanvas.addEventListener('touchend', () => {
    clipState.dragging = false;
    const w = Math.abs(clipState.endX - clipState.startX);
    const h = Math.abs(clipState.endY - clipState.startY);
    document.getElementById('clipOcrBtn').disabled = (w < 10 || h < 10);
  });
}

function resetClipSelection() {
  const canvas = document.getElementById('clipperCanvas');
  const ctx = canvas.getContext('2d');
  ctx.drawImage(clipState.img, 0, 0, canvas.width, canvas.height);
  clipState.results.forEach(r => {
    ctx.strokeStyle = '#2ed573'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
    ctx.strokeRect(r.x * clipState.scale, r.y * clipState.scale, r.w * clipState.scale, r.h * clipState.scale);
    ctx.setLineDash([]);
  });
  document.getElementById('clipOcrBtn').disabled = true;
  document.getElementById('clipOcrStatus').textContent = '';
}

async function runClipOCR() {
  if (typeof VISION_API_KEY === 'undefined' || !VISION_API_KEY) { alert('Vision APIキーが設定されていません'); return; }

  const statusEl = document.getElementById('clipOcrStatus');
  statusEl.textContent = '使用量を確認中...';
  await loadOcrUsage();
  if (ocrUsage.used >= ocrUsage.limit - 50) {
    alert('今月のOCR使用量が安全上限に達しました。');
    statusEl.textContent = '';
    return;
  }

  const scale = clipState.scale;
  const sx = Math.min(clipState.startX, clipState.endX) / scale;
  const sy = Math.min(clipState.startY, clipState.endY) / scale;
  const sw = Math.abs(clipState.endX - clipState.startX) / scale;
  const sh = Math.abs(clipState.endY - clipState.startY) / scale;

  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = sw;
  cropCanvas.height = sh;
  const cctx = cropCanvas.getContext('2d');
  cctx.drawImage(clipState.img, sx, sy, sw, sh, 0, 0, sw, sh);

  const base64 = cropCanvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');

  statusEl.textContent = 'Google Cloud Vision APIに送信中...';
  try {
    const resp = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${VISION_API_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        requests: [{
          image: { content: base64 },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
          imageContext: { languageHints: ['ja', 'en'] }
        }]
      })}
    );
    if (!resp.ok) throw new Error(`API Error ${resp.status}`);
    const result = await resp.json();
    const text = result.responses?.[0]?.fullTextAnnotation?.text?.trim() || '';
    await incrementOcrUsage();

    if (!text) {
      statusEl.textContent = 'テキストが検出されませんでした';
      return;
    }

    clipState.results.push({ x: sx, y: sy, w: sw, h: sh, text, parsed: parseEffectText(text) });
    renderClipResults();
    statusEl.textContent = `認識完了（${text.length}文字）`;
    resetClipSelection();
  } catch (e) {
    console.error('Clip OCR error:', e);
    statusEl.textContent = 'OCRエラー: ' + e.message;
  }
}

function parseEffectText(text) {
  const parsed = {};
  if (!text) return parsed;

  const normalized = text.replace(/\r/g, '').replace(/：/g, ':');
  const lines = normalized.split('\n').map(l => l.trim()).filter(l => l);
  const allText = lines.join(' ');

  const patterns = [
    { key: 'タイミング', re: /タイミング\s*[:]\s*(.+?)(?=\s+(?:判定|技能|難易度|対象|射程|侵蝕値|侵食値|制限|効果)|$)/m },
    { key: '判定', re: /判定\s*[:]\s*(.+?)(?=\s+(?:タイミング|技能|難易度|対象|射程|侵蝕値|侵食値|制限|効果)|$)/m },
    { key: '技能', re: /技能\s*[:]\s*(.+?)(?=\s+(?:タイミング|判定|難易度|対象|射程|侵蝕値|侵食値|制限|効果)|$)/m },
    { key: '難易度', re: /難易度\s*[:]\s*(.+?)(?=\s+(?:タイミング|判定|技能|対象|射程|侵蝕値|侵食値|制限|効果)|$)/m },
    { key: '対象', re: /対象\s*[:]\s*(.+?)(?=\s+(?:タイミング|判定|技能|難易度|射程|侵蝕値|侵食値|制限|効果)|$)/m },
    { key: '射程', re: /射程\s*[:]\s*(.+?)(?=\s+(?:タイミング|判定|技能|難易度|対象|侵蝕値|侵食値|制限|効果)|$)/m },
    { key: '侵蝕値', re: /侵[蝕食]値?\s*[:]\s*(.+?)(?=\s+(?:タイミング|判定|技能|難易度|対象|射程|制限|効果)|$)/m },
    { key: '制限', re: /制限\s*[:]\s*(.+?)(?=\s+(?:タイミング|判定|技能|難易度|対象|射程|侵蝕値|侵食値|効果)|$)/m },
    { key: '最大レベル', re: /最大(?:レベル|Lv|LV)\s*[:]\s*(\d+)/m },
  ];

  for (const p of patterns) {
    let found = false;
    for (const line of lines) {
      const m = line.match(p.re);
      if (m) { parsed[p.key] = m[1].trim().replace(/\s+$/, ''); found = true; break; }
    }
    if (!found) {
      const m = allText.match(p.re);
      if (m) parsed[p.key] = m[1].trim().replace(/\s+$/, '');
    }
  }

  for (const key of Object.keys(parsed)) {
    parsed[key] = parsed[key]
      .replace(/\s*(タイミング|判定|技能|難易度|対象|射程|侵蝕値|侵食値|制限|効果|最大レベル).*$/, '')
      .replace(/[\s　]+$/, '');
  }

  if (parsed['タイミング']) {
    const t = parsed['タイミング'];
    if (/マイナー/.test(t)) parsed['タイミング'] = 'マイナー';
    else if (/メジャー/.test(t)) parsed['タイミング'] = 'メジャー';
    else if (/セットアップ/.test(t)) parsed['タイミング'] = 'セットアップ';
    else if (/イニシアチブ/.test(t)) parsed['タイミング'] = 'イニシアチブ';
    else if (/クリンナップ/.test(t)) parsed['タイミング'] = 'クリンナップ';
    else if (/リアクション/.test(t)) parsed['タイミング'] = 'リアクション';
    else if (/オート/.test(t)) parsed['タイミング'] = 'オート';
    else if (/常時/.test(t)) parsed['タイミング'] = '常時';
  }

  const effMatch = allText.match(/効果\s*[:]\s*([\s\S]*)/);
  if (effMatch) parsed['効果'] = effMatch[1].trim();

  for (const line of lines) {
    const clean = line.replace(/[\s　]/g, '');
    if (clean.length === 0) continue;
    if (/^(タイミング|判定|技能|難易度|対象|射程|侵蝕値|侵食値|制限|効果|最大レベル|最大Lv)/i.test(clean)) continue;
    if (clean.length <= 3 && /^[\u3040-\u309F]+$/.test(clean)) continue;
    if (clean.length < 50) {
      parsed['エフェクト名'] = line.trim();
      break;
    }
  }

  const syndromes = ['エンジェルハイロゥ','ブラムストーカー','ブラックドッグ','サラマンドラ','ミストルティン','モルフェウス','ハヌマーン','ウロボロス','エグザイル','ノイマン','ソラリス','バロール','オルクス','キメラ'];
  for (const syn of syndromes) {
    const re = new RegExp('(?:^|[\\s/／・、,\\(（])' + syn + '(?:$|[\\s/／・、,\\)）])', 'm');
    if (re.test(allText)) {
      parsed['シンドローム'] = parsed['シンドローム'] ? parsed['シンドローム'] + '/' + syn : syn;
    }
  }

  return parsed;
}

function detectDX3Category(parsed) {
  if (parsed['タイミング'] || parsed['侵蝕値'] || parsed['最大レベル']) return 'エフェクト';
  if (/Dロイス|ディーロイス/.test(JSON.stringify(parsed))) return 'Dロイス';
  return '';
}

function renderClipResults() {
  const el = document.getElementById('clipResults');
  if (clipState.results.length === 0) { el.innerHTML = ''; return; }
  el.innerHTML = clipState.results.map((r, i) => {
    const parsedHtml = Object.keys(r.parsed).length > 0
      ? `<div class="clip-parsed">${Object.entries(r.parsed).map(([k, v]) =>
          `<div class="parsed-field"><span class="parsed-label">${k}:</span><span class="parsed-value">${v}</span></div>`
        ).join('')}</div>`
      : '';
    return `<div class="clip-result-item">
      <div class="clip-header">
        <span class="clip-num">範囲 ${i + 1}</span>
        <button class="clip-remove" onclick="removeClipResult(${i})">&times;</button>
      </div>
      <textarea rows="3" onchange="clipState.results[${i}].text=this.value; clipState.results[${i}].parsed=parseEffectText(this.value); renderClipResults();">${r.text}</textarea>
      ${parsedHtml}
    </div>`;
  }).join('');
}

function removeClipResult(i) {
  clipState.results.splice(i, 1);
  renderClipResults();
  resetClipSelection();
}

function applyClipResults() {
  if (clipState.results.length === 0) { closeClipper(); return; }

  const allText = clipState.results.map((r, i) =>
    clipState.results.length > 1 ? `--- 範囲${i + 1} ---\n${r.text}` : r.text
  ).join('\n\n');
  document.getElementById('ocrResult').value = allText;
  document.getElementById('uploadExtractedText').value = allText;

  if (clipState.results.length === 1) {
    autoFillFields(clipState.results[0].parsed);
  }

  document.getElementById('btnParse').style.display = 'inline-block';
  closeClipper();
}

function autoFillFields(parsed) {
  const sysEl = document.getElementById('uploadSystem');
  const catEl = document.getElementById('uploadCategory');
  const detectedCat = detectDX3Category(parsed);

  if (detectedCat && sysEl.value === 'ダブルクロス3rd') {
    catEl.value = detectedCat;
    onUploadCategoryChange();
  } else if (detectedCat && !sysEl.value) {
    sysEl.value = 'ダブルクロス3rd';
    sysEl.dispatchEvent(new Event('change'));
    catEl.value = detectedCat;
    onUploadCategoryChange();
  }

  const container = document.getElementById('uploadFields');
  if (!container || container.style.display === 'none') return;

  const fieldMap = {
    'タイミング': 'タイミング',
    '技能': '技能',
    '難易度': '難易度',
    '対象': '対象',
    '射程': '射程',
    '侵蝕値': '侵蝕値',
    '制限': '制限',
    '最大レベル': '最大レベル',
    'シンドローム': 'シンドローム',
    '記載本': '記載本',
  };

  for (const [parseKey, fieldName] of Object.entries(fieldMap)) {
    if (!parsed[parseKey]) continue;
    const el = container.querySelector(`[data-field="${fieldName}"]`);
    if (!el) continue;
    if (el.tagName === 'SELECT') {
      const options = [...el.options];
      const exact = options.find(o => o.value === parsed[parseKey]);
      const partial = options.find(o => o.value && parsed[parseKey].includes(o.value));
      if (exact) el.value = exact.value;
      else if (partial) el.value = partial.value;
    } else {
      el.value = parsed[parseKey];
    }
  }

  if (parsed['エフェクト名']) {
    const memoEl = document.getElementById('uploadMemo');
    if (memoEl && !memoEl.value) memoEl.value = parsed['エフェクト名'];
  }
}

function parseOcrToFields() {
  const text = document.getElementById('ocrResult').value;
  if (!text) return;
  const parsed = parseEffectText(text);
  autoFillFields(parsed);
  if (Object.keys(parsed).length > 0) {
    document.getElementById('ocrStatus').textContent = `${Object.keys(parsed).length}件のフィールドを検出・入力しました`;
  } else {
    document.getElementById('ocrStatus').textContent = '自動認識可能なフィールドが見つかりませんでした';
  }
}

// ===== 登録送信（画像保存なし） =====
async function submitRegister() {
  const btn = document.getElementById('submitBtn');
  const status = document.getElementById('uploadStatus');
  btn.disabled = true;
  status.textContent = '登録中...';

  const systemName = document.getElementById('uploadSystem').value;
  const category = document.getElementById('uploadCategory').value || null;
  const page = document.getElementById('uploadPage').value.trim();
  const memo = document.getElementById('uploadMemo').value.trim();
  const extractedText = document.getElementById('uploadExtractedText').value.trim() || null;
  const structuredFields = collectStructuredFields('uploadFields');
  const title = memo || '(無題)';
  const pageLabel = page ? `P${page}` : null;

  // 新しいsort_orderは現在の最大値+1
  const maxOrder = screenshots.reduce((max, s) => Math.max(max, s.sort_order || 0), -1);

  if (isLocalMode) {
    screenshots.push({
      id: 'local_' + Date.now(),
      title, system_name: systemName, category, page_number: pageLabel,
      tags: [...currentTags], structured_fields: { ...structuredFields },
      extracted_text: extractedText, memo,
      image_path: null,
      uploader_name: getDisplayName(),
      sort_order: maxOrder + 1,
      created_at: new Date().toISOString(),
    });
    saveLocalScreenshots();
  } else {
    const { error } = await sb.from('rulebook_screenshots').insert({
      title, system_name: systemName, category, page_number: pageLabel,
      tags: currentTags, structured_fields: structuredFields,
      extracted_text: extractedText, memo,
      image_path: 'none', // カラム NOT NULL 対応
      uploader_name: getDisplayName(),
      sort_order: maxOrder + 1,
    });
    if (error) { status.textContent = 'エラー: ' + error.message; btn.disabled = false; return; }
    await loadScreenshots();
  }

  status.textContent = '登録しました';
  setTimeout(() => { closeRegister(); btn.disabled = false; render(); }, 600);
}

// ===== カードから直接編集・削除 =====
function openEditFromIdx(idx) {
  const s = filteredList[idx];
  if (!s) return;
  openEditModal(s);
}

async function deleteFromIdx(idx) {
  const s = filteredList[idx];
  if (!s) return;
  if (!confirm(`「${s.title || '(無題)'}」を削除しますか？`)) return;

  if (isLocalMode) {
    screenshots = screenshots.filter(x => x.id !== s.id);
    saveLocalScreenshots();
  } else {
    await sb.from('rulebook_screenshots').delete().eq('id', s.id);
    await loadScreenshots();
  }
  render();
}

// ===== 編集モーダル =====
let editTags = [];
let editTarget = null;

function openEditModal(s) {
  editTarget = s;
  document.getElementById('editModal').classList.add('visible');

  renderSystemSelect('editSystem');
  document.getElementById('editSystem').value = s.system_name;
  renderCategorySelect('editCategory', s.system_name);
  document.getElementById('editCategory').value = s.category || '';
  onEditCategoryChange(s.structured_fields || {});

  document.getElementById('editPage').value = s.page_number || '';
  editTags = [...(s.tags || [])];
  renderEditTags();
  renderQuickTags('editQuickTags', s.system_name);
  document.getElementById('editMemo').value = s.title || s.memo || '';
  document.getElementById('editExtractedText').value = s.extracted_text || '';
  document.getElementById('editStatus').textContent = '';
}

function onEditSystemChange() {
  const sys = document.getElementById('editSystem').value;
  renderCategorySelect('editCategory', sys);
  renderQuickTags('editQuickTags', sys);
  onEditCategoryChange({});
}

function onEditCategoryChange(existingFields) {
  const sys = document.getElementById('editSystem').value;
  const cat = document.getElementById('editCategory').value;
  renderStructuredFields('editFields', sys, cat, existingFields || {});
}

function closeEditModal() {
  document.getElementById('editModal').classList.remove('visible');
  editTarget = null;
}

function addEditTag(name) {
  name = name.trim();
  if (!name || editTags.includes(name)) return;
  editTags.push(name);
  renderEditTags();
}

function removeEditTag(i) {
  editTags.splice(i, 1);
  renderEditTags();
}

function renderEditTags() {
  const wrap = document.getElementById('editTagInputWrap');
  const input = document.getElementById('editTagInput');
  wrap.querySelectorAll('.added-tag').forEach(el => el.remove());
  editTags.forEach((t, i) => {
    const span = document.createElement('span');
    span.className = 'added-tag';
    span.innerHTML = `${t} <span class="remove-tag" onclick="removeEditTag(${i})">&times;</span>`;
    wrap.insertBefore(span, input);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('editTagInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addEditTag(e.target.value); e.target.value = ''; }
  });
});

async function submitEdit() {
  if (!editTarget) return;

  const status = document.getElementById('editStatus');
  status.textContent = '保存中...';

  const systemName = document.getElementById('editSystem').value;
  const category = document.getElementById('editCategory').value || null;
  const page = document.getElementById('editPage').value.trim() || null;
  const memo = document.getElementById('editMemo').value.trim();
  const extractedText = document.getElementById('editExtractedText').value.trim() || null;
  const structuredFields = collectStructuredFields('editFields');

  if (isLocalMode) {
    const idx = screenshots.findIndex(x => x.id === editTarget.id);
    if (idx >= 0) {
      Object.assign(screenshots[idx], {
        system_name: systemName, category, page_number: page,
        tags: editTags, title: memo, memo,
        extracted_text: extractedText, structured_fields: structuredFields,
      });
      saveLocalScreenshots();
    }
  } else {
    const { error } = await sb.from('rulebook_screenshots').update({
      system_name: systemName, category, page_number: page,
      tags: editTags, title: memo, memo,
      extracted_text: extractedText, structured_fields: structuredFields,
    }).eq('id', editTarget.id);
    if (error) { status.textContent = 'エラー: ' + error.message; return; }
    await loadScreenshots();
  }

  status.textContent = '保存しました';
  setTimeout(() => { closeEditModal(); render(); }, 500);
}

// ===== サイドバートグル =====
function toggleSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebarOverlay').classList.add('visible');
  document.body.style.overflow = 'hidden';
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('visible');
  document.body.style.overflow = '';
}

// ===== 検索 =====
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('searchBox').addEventListener('input', render);
});

// ===== キーボード =====
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeRegister(); closeEditModal(); closeClipper(); }
});

// ===== 初期化 =====
checkSession();
