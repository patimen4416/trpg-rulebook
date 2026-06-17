// ===== Supabase初期化 =====
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const isLocalMode = typeof LOCAL_MODE !== 'undefined' && LOCAL_MODE;

// ===== 状態管理 =====
let currentUser = null;
let screenshots = [];
let systems = [];
let tagMaster = [];
let categorySchemas = [];  // カテゴリ別フィールド定義
let activeFilters = new Set();
let currentTags = [];
let uploadFiles = [];
let filteredList = [];
let currentLbIndex = -1;
let viewMode = 'grid'; // 'grid' | 'list'

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
      { name: 'シンドローム', type: 'select', options: ['エンジェルハイロゥ','バロール','ブラックドッグ','ブラムストーカー','キメラ','エグザイル','ハヌマーン','モルフェウス','ノイマン','オルクス','サラマンドラ','ソラリス'] },
      { name: 'タイミング', type: 'select', options: ['メジャー','マイナー','セットアップ','イニシアチブ','クリンナップ','リアクション','オート','常時'] },
      { name: '技能', type: 'text', placeholder: '白兵, 射撃, RC 等' },
      { name: '対象', type: 'text', placeholder: '単体, 範囲(選択) 等' },
      { name: '射程', type: 'text', placeholder: '武器, 視界, 至近 等' },
      { name: '制限', type: 'text', placeholder: '80%, 100%, なし 等' },
    ]
  },
  {
    system_name: 'ダブルクロス3rd', category: 'Dロイス', sort_order: 2,
    fields: [
      { name: '記載本', type: 'text', placeholder: '基本ルールブック1' },
      { name: 'シンドローム', type: 'select', options: ['エンジェルハイロゥ','バロール','ブラックドッグ','ブラムストーカー','キメラ','エグザイル','ハヌマーン','モルフェウス','ノイマン','オルクス','サラマンドラ','ソラリス','共通'] },
      { name: '制限', type: 'text', placeholder: '取得条件等' },
    ]
  },
  {
    system_name: 'ダブルクロス3rd', category: 'アイテム', sort_order: 3,
    fields: [
      { name: '記載本', type: 'text', placeholder: '基本ルールブック1' },
      { name: 'シンドローム', type: 'select', options: ['エンジェルハイロゥ','バロール','ブラックドッグ','ブラムストーカー','キメラ','エグザイル','ハヌマーン','モルフェウス','ノイマン','オルクス','サラマンドラ','ソラリス','共通'] },
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
  localStorage.removeItem('rulebook_user'// ===== Supabase初期化 =====
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const isLocalMode = ty);
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

  await Promise.all([loadSystems(), loadTagMaster(), loadCategorySchemas(), loadScreenshots()]);

  document.getElementById('loadingIndicator').style.display = 'none';
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
  const { data, error } = await sb.from('rulebook_screenshots').select('*').order('created_at', { ascending: false });
  if (error) { console.error('loadScreenshots error:', error); return; }
  screenshots = data || [];
}

function saveLocalScreenshots() {
  if (isLocalMode) localStorage.setItem('rulebook_screenshots', JSON.stringify(screenshots));
}

// ===== 画像URL =====
const imageUrlCache = {};
async function resolveImageUrl(imagePath) {
  if (!imagePath) return null;
  if (imageUrlCache[imagePath]) return imageUrlCache[imagePath];
  const { data, error } = await sb.storage.from(STORAGE_BUCKET).createSignedUrl(imagePath, 3600);
  if (!error && data?.signedUrl) { imageUrlCache[imagePath] = data.signedUrl; return data.signedUrl; }
  const { data: pubData } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(imagePath);
  const url = pubData?.publicUrl || null;
  imageUrlCache[imagePath] = url;
  return url;
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
    // structured_fields のフィールド値でもフィルタ可能
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
      return `<span class="tag ${activeFilters.has(name) ? 'active' : ''}" data-cat="${cat}" onclick="toggleFilter('${escaped}')">${name} <span class="peof LOCAL_MODE !== 'undefined' && LOCAL_MODE;

// ===== 状態管理 =====
let currentUser = null;
let screenshots = [];
let systems = [];count">${count}</span></span>`;
    }).join('');
  }

  // structured_fieldsフィルタ
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
        // structured_field フィルタ
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
async function renderCards() {
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
    grid.className = 'grid';
    grid.innerHTML = filteredList.map((s, idx) => renderCardItem(s, idx)).join('');
    loadCardImages();
  }
}

function renderCardItem(s, idx) {
  const color = getSystemColor(s.system_name);
  const pageLabel = s.page_number || '';
  const tags = s.tags || [];
  const dateStr = s.created_at ? s.created_at.slice(0, 10) : '';
  const hasLocalImg = s._dataUrl;
  const imgHtml = hasLocalImg
    ? `<img src="${s._dataUrl}" alt="">`
    : `<span class="placeholder-icon" style="color:${color}">読込中</span>`;
  const catBadge = s.category ? `<span class="category-badge">${s.category}</span>` : '';
  return `
  <div class="card" onclick="openLightbox(${idx})">
    <div class="card-img" data-path="${escAttr(s.image_path || '')}" style="background: linear-gradient(135deg, ${color}15, var(--bg));">
      ${imgHtml}
      <span class="system-badge" style="background:${color}">${s.system_name}</span>
      ${pageLabel ? `<span class="page-label">${pageLabel}</span>` : ''}
    </div>
    <div class="card-body">
      <div class="card-title">${s.title || s.memo || 'スクリーンショット'}</div>
      ${catBadge}
      <div class="card-tags">
        ${tags.slice(0, 3).map(t => `<span class="card-tag">${t}</span>`).join('')}
        ${tags.length > 3 ? `<span class="card-tag">+${tags.length - 3}</span>` : ''}
      </div>
      <div class="card-meta">
        <span>${s.uploader_name}</span>
        <span>${dateStr}</span>
      </div>
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
        <th>日付</th>
      </tr>
    </thead>
    <tbody>
      ${filteredList.map((s, idx) => {
        const color = getSystemColor(s.system_name);
        const fields = s.structured_fields || {};
        const fieldStr = Object.entries(fields).filter(([,v]) => v).map(([k,v]) => `<span class="field-pill">${k}: ${v}</span>`).join(' ');
        const dateStr = s.created_at ? s.created_at.slice(0, 10) : '';
        return `<tr onclick="openLightbox(${idx})" class="list-row">
          <td class="list-title">${s.title || s.memo || '(無題)'}</td>
          <td><s
let tagMaster = [];
let categorySchemas = [];  // カテゴリ別フィールド定義
let activeFilters = new Set();
let currentTags = [];
let uploadFiles = []pan class="system-dot" style="background:${color}"></span>${s.system_name}</td>
          <td>${s.category || '-'}</td>
          <td>${s.page_number || '-'}</td>
          <td class="list-fields">${fieldStr || '-'}</td>
          <td>${s.uploader_name}</td>
          <td>${dateStr}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>`;
}

async function loadCardImages() {
  const cardImgs = document.querySelectorAll('.card-img[data-path]');
  for (const el of cardImgs) {
    const path = el.dataset.path;
    if (!path) continue;
    try {
      const url = await resolveImageUrl(path);
      if (url) {
        const img = new Image();
        img.onload = () => {
          const badge = el.querySelector('.system-badge')?.outerHTML || '';
          const page = el.querySelector('.page-label')?.outerHTML || '';
          el.innerHTML = `<img src="${url}" alt="">${badge}${page}`;
        };
        img.src = url;
      }
    } catch (e) { /* placeholder stays */ }
  }
}

function render() {
  renderSidebar();
  renderCards();
}

// ===== アップロード =====
let uploadStructuredFields = {};

function openUpload() {
  document.getElementById('uploadModal').classList.add('visible');
  uploadFiles = [];
  currentTags = [];
  uploadStructuredFields = {};
  renderUploadPreview();
  renderCurrentTags();
  document.getElementById('uploadPage').value = '';
  document.getElementById('uploadMemo').value = '';
  document.getElementById('uploadStatus').textContent = '';
  document.getElementById('fileInput').value = '';
  document.getElementById('ocrResult').value = '';
  document.getElementById('ocrStatus').textContent = '';
  updateSubmitBtn();
  renderSystemSelect('uploadSystem');
  onUploadSystemChange();
}

function closeUpload() {
  document.getElementById('uploadModal').classList.remove('visible');
}

function renderSystemSelect(elId) {
  const sel = document.getElementById(elId);
  sel.innerHTML = systems.map(s => `<option value="${s.name}">${s.name}</option>`).join('')
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

// D&D
document.addEventListener('DOMContentLoaded', () => {
  const dz = document.getElementById('dropZone');
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('dragover'); handleFiles(e.dataTransfer.files); });
});

function handleFiles(files) {
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const reader = new FileReader();
    reader.onload = e => {
      uploadFiles.push({ file, dataUrl: e.target.result });
      renderUploadPreview();
      updateSubmitBtn();
    };
    reader.readAsDataURL(file);
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
  updateSubmitBtn();
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

function updateSubmitBtn() {
  document.getElementById('submitBtn').disabled = uploadFiles.length === 0;
}

// ===== OCR =====
let tesseractLoaded = false;
let tesseractWorker = null;

async function runOCR() {
  if (uploadFiles.length === 0) { alert('先に画像を選択してください'); return; }

  const statusEl = document.getElementById('ocrStatus');
  const resultEl = document.getElementById('ocrResult');
  statusEl.textContent = 'OCRエンジンを読み込み中...';

  try {
    if (!tesseractLoaded) {
      // Tesseract.js v5 CDN
      if (!window.Tesseract) {
        await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
      }
      tesseractLoaded = true;
    }

    statusEl.textContent = 'テキスト認識中...（日本語モデル初回は少し時間がかかります）';

    const { data: { text } } = await Tesseract.recognize(
      uploadFiles[0].dataUrl,
      'jpn',
      { logger: m => {
        if (m.status === 'recognizing text') {
          statusEl.textContent = `認識中... ${Math.round((m.progress || 0) * 100)}%`;
        }
      }}
    );

    resultEl.value = text.trim();
    statusEl.textContent = '認識完了 - 内容を確認・修正してください';
  } catch (e) {
    console.error('OCR error:', e);
    statusEl.textContent = 'OCRエラー: ' + e.message;
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// ===== アップロード送信 =====
async function submitUpload() {
  if (uploadFiles.length === 0) return;

  const btn = document.getElementById('submitBtn');
  const status = document.getElementById('uploadStatus');
  btn.disabled = true;
  status.textContent = 'アップロード中...';

  const systemName = document.getElementById('uploadSystem').value;
  const category = document.getElementById('uploadCategory').value || null;
  const page = document.getElementById('uploadPage').value.trim();
  const memo = document.getElementById('uploadMemo').value.trim();
  const extractedText = document.getElementById('ocrResult').value.trim() || null;
  const structuredFields = collectStructuredFields('uploadFields');

  let successCount = 0;

  for (let i = 0; i < uploadFiles.length; i++) {
    const f = uploadFiles[i];
    status.textContent = `アップロード中... (${i + 1}/${uploadFiles.length})`;

    try {
      const pageLabel = page
        ? (uploadFiles.length > 1 ? `P${page}-${i + 1}` : `P${page}`)
        : null;
      const title = memo || f.file.name.replace(/\.\w+$/, '');

      if (isLocalMode) {
        screenshots.unshift({
          id: 'local_' + Date.now() + '_' + i,
          title, system_name: systemName, category, page_number: pageLabel,
          tags: [...currentTags], structured_fields: { ...structuredFields },
          extracted_text: extractedText, memo,
          image_path: null, _dataUrl: f.dataUrl,
          uploader_name: getDisplayName(),
          created_at: new Date().toISOString(),
        });
        successCount++;
        continue;
      }

      // Storage upload
      const ext = f.file.name.split('.').pop() || 'jpg';
      const safeFolder = encodeURIComponent(systemName).replace(/%/g, '_');
      const filePath = `${safeFolder}/${Date.now()}_${i}.${ext}`;
      const { error: storageError } = await sb.storage.from(STORAGE_BUCKET).upload(filePath, f.file, { contentType: f.file.type });
      if (storageError) { status.textContent = 'Storage エラー: ' + storageError.message; continue; }

      // DB insert
      const { error: dbError } = await sb.from('rulebook_screenshots').insert({
        title, system_name: systemName, category, page_number: pageLabel,
        tags: currentTags, structured_fields: structuredFields,
        extracted_text: extractedText, memo,
        image_path: filePath, uploader_name: getDisplayName(),
      });
      if (dbError) { status.textContent = 'DB エラー: ' + dbError.message; continue; }

      successCount++;
    } catch (e) { console.error('Upload error:', e); }
  }

  if (successCount === 0) { status.textContent = 'アップロード失敗'; btn.disabled = false; return; }
  status.textContent = `${successCount}枚をアップロードしました`;

  saveLocalScreenshots();
  if (!isLocalMode) await loadScreenshots();

  setTimeout(() => { closeUpload(); render(); }, 800);
}

// ===== ライトボックス =====
async function openLightbox(idx) {
  currentLbIndex = idx;
  await showLightboxItem();
  document.getElementById('lightbox').classList.add('visible');
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('visible');
}

function navLightbox(dir) {
  currentLbIndex += dir;
  if (currentLbIndex < 0) currentLbIndex = filteredList.length - 1;
  if (currentLbIndex >= filteredList.length) currentLbIndex = 0;
  showLightboxItem();
}

async function showLightboxItem() {
  const s = filteredList[currentLbIndex];
  if (!s) return;

  const wrap = document.getElementById('lbImgWrap');
  const color = getSystemColor(s.system_name);

  if (s._dataUrl) {
    wrap.innerHTML = `<img src="${s._dataUrl}" alt="">`;
  } else if (s.image_path) {
    const url = await resolveImageUrl(s.image_path);
    wrap.innerHTML = url
      ? `<img src="${url}" alt="">`
      : `<div class="lb-placeholder" style="color:${color}">${getSystemShort(s.system_name)}</div>`;
  } else {
    wrap.innerHTML = `<div class="lb-placeholder" style="color:${color}">${getSystemShort(s.system_name)}</div>`;
  }

  const pageStr = s.page_number ? `（${s.page_number}）` : '';
  document.getElementById('lbTitle').textContent = `${s.title || 'スクリーンショット'}${pageStr}`;
  document.getElementById('lbTags').innerHTML = [s.system_name, s.category, ...(s.tags || [])].filter(Boolean).map(t =>
    `<span class="card-tag" style="font-size:12px; padding:4px 10px;">${t}</span>`
  ).join('');

  // structured fields
  const fieldsEl = document.getElementById('lbFields');
  const fields = s.structured_fields || {};
  const fieldEntries = Object.entries(fields).filter(([, v]) => v);
  if (fieldEntries.length > 0) {
    fieldsEl.innerHTML = '<div class="lb-fields-grid">' + fieldEntries.map(([k, v]) =>
      `<div class="lb-field"><span class="lb-field-label">${k}</span><span class="lb-field-value">${v}</span></div>`
    ).join('') + '</div>';
    fieldsEl.style.display = 'block';
  } else {
    fieldsEl.style.display = 'none';
  }

  // extracted text
  const textEl = document.getElementById('lbExtractedText');
  if (s.extracted_text) {
    textEl.innerHTML = `<div class="lb-extracted"><span class="lb-extracted-label">抽出テキスト</span><pre>${s.extracted_text}</pre></div>`;
    textEl.style.display = 'block';
  } else {
    textEl.style.display = 'none';
  }

  const dateStr = s.created_at ? s.created_at.slice(0, 10) : '';
  document.getElementById('lbMeta').textContent = `${s.uploader_name} が ${dateStr} にアップロード`;
}

async function deleteScreenshot() {
  const s = filteredList[currentLbIndex];
  if (!s) return;
  if (!confirm('この画像を削除しますか？')) return;

  if (isLocalMode) {
    screenshots = screenshots.filter(x => x.id !== s.id);
    saveLocalScreenshots();
  } else {
    if (s.image_path) await sb.storage.from(STORAGE_BUCKET).remove([s.image_path]);
    await sb.from('rulebook_screenshots').delete().eq('id', s.id);
    await loadScreenshots();
  }
  closeLightbox();
  render();
}

// ===== 編集モーダル =====
let editTags = [];

function openEditModal() {
  const s = filteredList[currentLbIndex];
  if (!s) return;
  closeLightbox();
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
  const s = filteredList[currentLbIndex];
  if (!s) return;

  const status = document.getElementById('editStatus');
  status.textContent = '保存中...';

  const systemName = document.getElementById('editSystem').value;
  const category = document.getElementById('editCategory').value || null;
  const page = document.getElementById('editPage').value.trim() || null;
  const memo = document.getElementById('editMemo').value.trim();
  const extractedText = document.getElementById('editExtractedText').value.trim() || null;
  const structuredFields = collectStructuredFields('editFields');

  if (isLocalMode) {
    const idx = screenshots.findIndex(x => x.id === s.id);
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
    }).eq('id', s.id);
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
  if (e.key === 'Escape') { closeLightbox(); closeUpload(); closeEditModal(); }
  if (document.getElementById('lightbox').classList.contains('visible')) {
    if (e.key === 'ArrowLeft') navLightbox(-1);
    if (e.key === 'ArrowRight') navLightbox(1);
  }
});

// ===== 初期化 =====
checkSession();
;
let filteredList = [];
let currentLbIndex = -1;
let viewMode = 'grid'; // 'grid' | 'list'

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
      { name: 'シンドローム', type: 'select', options: ['エンジェルハイロゥ','バロール','ブラックドッグ','ブラムストーカー','キメラ','エグザイル','ハヌマーン','モルフェウス','ノイマン','オルクス','サラマンドラ','ソラリス'] },
      { name: 'タイミング', type: 'select', options: ['メジャー','マイナー','セットアップ','イニシアチブ','クリンナップ','リアクション','オート','常時'] },
      { name: '技能', type: 'text', placeholder: '白兵, 射撃, RC 等' },
      { name: '対象', type: 'text', placeholder: '単体, 範囲(選択) 等' },
      { name: '射程', type: 'text', placeholder: '武器, 視界, 至近 等' },
      { name: '制限', type: 'text', placeholder: '80%, 100%, なし 等' },
    ]
  },
  {
    system_name: 'ダブルクロス3rd', category: 'Dロイス', sort_order: 2,
    fields: [
      { name: '記載本', type: 'text', placeholder: '基本ルールブック1' },
      { name: 'シンドローム', type: 'select', options: ['エンジェルハイロゥ','バロール','ブラックドッグ','ブラムストーカー','キメラ','エグザイル','ハヌマーン','モルフェウス','ノイマン','オルクス','サラマンドラ','ソラリス','共通'] },
      { name: '制限', type: 'text', placeholder: '取得条件等' },
    ]
  },
  {
    system_name: 'ダブルクロス3rd', category: 'アイテム', sort_order: 3,
    fields: [
      { name: '記載本', type: 'text', placeholder: '基本ルールブック1' },
      { name: 'シンドローム', type: 'select', options: ['エンジェルハイロゥ','バロール','ブラックドッグ','ブラムストーカー','キメラ','エグザイル','ハヌマーン','モルフェウス','ノイマン','オルクス','サラマンドラ','ソラリス','共通'] },
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

  await Promise.all([loadSystems(), loadTagMaster(), loadCategorySchemas(), loadScreenshots()]);

  document.getElementById('loadingIndicator').style.display = 'none';
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
  const { data, error } = await sb.from('rulebook_screenshots').select('*').order('created_at', { ascending: false });
  if (error) { console.error('loadScreenshots error:', error); return; }
  screenshots = data || [];
}

function saveLocalScreenshots() {
  if (isLocalMode) localStorage.setItem('rulebook_screenshots', JSON.stringify(screenshots));
}

// ===== 画像URL =====
const imageUrlCache = {};
async function resolveImageUrl(imagePath) {
  if (!imagePath) return null;
  if (imageUrlCache[imagePath]) return imageUrlCache[imagePath];
  const { data, error } = await sb.storage.from(STORAGE_BUCKET).createSignedUrl(imagePath, 3600);
  if (!error && data?.signedUrl) { imageUrlCache[imagePath] = data.signedUrl; return data.signedUrl; }
  const { data: pubData } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(imagePath);
  const url = pubData?.publicUrl || null;
  imageUrlCache[imagePath] = url;
  return url;
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
    // structured_fields のフィールド値でもフィルタ可能
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

  // structured_fieldsフィルタ
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
        // structured_field フィルタ
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
async function renderCards() {
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
    grid.className = 'grid';
    grid.innerHTML = filteredList.map((s, idx) => renderCardItem(s, idx)).join('');
    loadCardImages();
  }
}

function renderCardItem(s, idx) {
  const color = getSystemColor(s.system_name);
  const pageLabel = s.page_number || '';
  const tags = s.tags || [];
  const dateStr = s.created_at ? s.created_at.slice(0, 10) : '';
  const hasLocalImg = s._dataUrl;
  const imgHtml = hasLocalImg
    ? `<img src="${s._dataUrl}" alt="">`
    : `<span class="placeholder-icon" style="color:${color}">読込中</span>`;
  const catBadge = s.category ? `<span class="category-badge">${s.category}</span>` : '';
  return `
  <div class="card" onclick="openLightbox(${idx})">
    <div class="card-img" data-path="${escAttr(s.image_path || '')}" style="background: linear-gradient(135deg, ${color}15, var(--bg));">
      ${imgHtml}
      <span class="system-badge" style="background:${color}">${s.system_name}</span>
      ${pageLabel ? `<span class="page-label">${pageLabel}</span>` : ''}
    </div>
    <div class="card-body">
      <div class="card-title">${s.title || s.memo || 'スクリーンショット'}</div>
      ${catBadge}
      <div class="card-tags">
        ${tags.slice(0, 3).map(t => `<span class="card-tag">${t}</span>`).join('')}
        ${tags.length > 3 ? `<span class="card-tag">+${tags.length - 3}</span>` : ''}
      </div>
      <div class="card-meta">
        <span>${s.uploader_name}</span>
        <span>${dateStr}</span>
      </div>
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
        <th>日付</th>
      </tr>
    </thead>
    <tbody>
      ${filteredList.map((s, idx) => {
        const color = getSystemColor(s.system_name);
        const fields = s.structured_fields || {};
        const fieldStr = Object.entries(fields).filter(([,v]) => v).map(([k,v]) => `<span class="field-pill">${k}: ${v}</span>`).join(' ');
        const dateStr = s.created_at ? s.created_at.slice(0, 10) : '';
        return `<tr onclick="openLightbox(${idx})" class="list-row">
          <td class="list-title">${s.title || s.memo || '(無題)'}</td>
          <td><span class="system-dot" style="background:${color}"></span>${s.system_name}</td>
          <td>${s.category || '-'}</td>
          <td>${s.page_number || '-'}</td>
          <td class="list-fields">${fieldStr || '-'}</td>
          <td>${s.uploader_name}</td>
          <td>${dateStr}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>`;
}

async function loadCardImages() {
  const cardImgs = document.querySelectorAll('.card-img[data-path]');
  for (const el of cardImgs) {
    const path = el.dataset.path;
    if (!path) continue;
    try {
      const url = await resolveImageUrl(path);
      if (url) {
        const img = new Image();
        img.onload = () => {
          const badge = el.querySelector('.system-badge')?.outerHTML || '';
          const page = el.querySelector('.page-label')?.outerHTML || '';
          el.innerHTML = `<img src="${url}" alt="">${badge}${page}`;
        };
        img.src = url;
      }
    } catch (e) { /* placeholder stays */ }
  }
}

function render() {
  renderSidebar();
  renderCards();
}

// ===== アップロード =====
let uploadStructuredFields = {};

function openUpload() {
  document.getElementById('uploadModal').classList.add('visible');
  uploadFiles = [];
  currentTags = [];
  uploadStructuredFields = {};
  renderUploadPreview();
  renderCurrentTags();
  document.getElementById('uploadPage').value = '';
  document.getElementById('uploadMemo').value = '';
  document.getElementById('uploadStatus').textContent = '';
  document.getElementById('fileInput').value = '';
  document.getElementById('ocrResult').value = '';
  document.getElementById('ocrStatus').textContent = '';
  updateSubmitBtn();
  renderSystemSelect('uploadSystem');
  onUploadSystemChange();
}

function closeUpload() {
  document.getElementById('uploadModal').classList.remove('visible');
}

function renderSystemSelect(elId) {
  const sel = document.getElementById(elId);
  sel.innerHTML = systems.map(s => `<option value="${s.name}">${s.name}</option>`).join('')
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

// D&D
document.addEventListener('DOMContentLoaded', () => {
  const dz = document.getElementById('dropZone');
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('dragover'); handleFiles(e.dataTransfer.files); });
});

function handleFiles(files) {
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const reader = new FileReader();
    reader.onload = e => {
      uploadFiles.push({ file, dataUrl: e.target.result });
      renderUploadPreview();
      updateSubmitBtn();
    };
    reader.readAsDataURL(file);
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
  updateSubmitBtn();
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

function updateSubmitBtn() {
  document.getElementById('submitBtn').disabled = uploadFiles.length === 0;
}

// ===== OCR =====
let tesseractLoaded = false;
let tesseractWorker = null;

async function runOCR() {
  if (uploadFiles.length === 0) { alert('先に画像を選択してください'); return; }

  const statusEl = document.getElementById('ocrStatus');
  const resultEl = document.getElementById('ocrResult');
  statusEl.textContent = 'OCRエンジンを読み込み中...';

  try {
    if (!tesseractLoaded) {
      // Tesseract.js v5 CDN
      if (!window.Tesseract) {
        await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
      }
      tesseractLoaded = true;
    }

    statusEl.textContent = 'テキスト認識中...（日本語モデル初回は少し時間がかかります）';

    const { data: { text } } = await Tesseract.recognize(
      uploadFiles[0].dataUrl,
      'jpn',
      { logger: m => {
        if (m.status === 'recognizing text') {
          statusEl.textContent = `認識中... ${Math.round((m.progress || 0) * 100)}%`;
        }
      }}
    );

    resultEl.value = text.trim();
    statusEl.textContent = '認識完了 - 内容を確認・修正してください';
  } catch (e) {
    console.error('OCR error:', e);
    statusEl.textContent = 'OCRエラー: ' + e.message;
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// ===== アップロード送信 =====
async function submitUpload() {
  if (uploadFiles.length === 0) return;

  const btn = document.getElementById('submitBtn');
  const status = document.getElementById('uploadStatus');
  btn.disabled = true;
  status.textContent = 'アップロード中...';

  const systemName = document.getElementById('uploadSystem').value;
  const category = document.getElementById('uploadCategory').value || null;
  const page = document.getElementById('uploadPage').value.trim();
  const memo = document.getElementById('uploadMemo').value.trim();
  const extractedText = document.getElementById('ocrResult').value.trim() || null;
  const structuredFields = collectStructuredFields('uploadFields');

  let successCount = 0;

  for (let i = 0; i < uploadFiles.length; i++) {
    const f = uploadFiles[i];
    status.textContent = `アップロード中... (${i + 1}/${uploadFiles.length})`;

    try {
      const pageLabel = page
        ? (uploadFiles.length > 1 ? `P${page}-${i + 1}` : `P${page}`)
        : null;
      const title = memo || f.file.name.replace(/\.\w+$/, '');

      if (isLocalMode) {
        screenshots.unshift({
          id: 'local_' + Date.now() + '_' + i,
          title, system_name: systemName, category, page_number: pageLabel,
          tags: [...currentTags], structured_fields: { ...structuredFields },
          extracted_text: extractedText, memo,
          image_path: null, _dataUrl: f.dataUrl,
          uploader_name: getDisplayName(),
          created_at: new Date().toISOString(),
        });
        successCount++;
        continue;
      }

      // Storage upload
      const ext = f.file.name.split('.').pop() || 'jpg';
      const safeFolder = encodeURIComponent(systemName).replace(/%/g, '_');
      const filePath = `${safeFolder}/${Date.now()}_${i}.${ext}`;
      const { error: storageError } = await sb.storage.from(STORAGE_BUCKET).upload(filePath, f.file, { contentType: f.file.type });
      if (storageError) { status.textContent = 'Storage エラー: ' + storageError.message; continue; }

      // DB insert
      const { error: dbError } = await sb.from('rulebook_screenshots').insert({
        title, system_name: systemName, category, page_number: pageLabel,
        tags: currentTags, structured_fields: structuredFields,
        extracted_text: extractedText, memo,
        image_path: filePath, uploader_name: getDisplayName(),
      });
      if (dbError) { status.textContent = 'DB エラー: ' + dbError.message; continue; }

      successCount++;
    } catch (e) { console.error('Upload error:', e); }
  }

  if (successCount === 0) { status.textContent = 'アップロード失敗'; btn.disabled = false; return; }
  status.textContent = `${successCount}枚をアップロードしました`;

  saveLocalScreenshots();
  if (!isLocalMode) await loadScreenshots();

  setTimeout(() => { closeUpload(); render(); }, 800);
}

// ===== ライトボックス =====
async function openLightbox(idx) {
  currentLbIndex = idx;
  await showLightboxItem();
  document.getElementById('lightbox').classList.add('visible');
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('visible');
}

function navLightbox(dir) {
  currentLbIndex += dir;
  if (currentLbIndex < 0) currentLbIndex = filteredList.length - 1;
  if (currentLbIndex >= filteredList.length) currentLbIndex = 0;
  showLightboxItem();
}

async function showLightboxItem() {
  const s = filteredList[currentLbIndex];
  if (!s) return;

  const wrap = document.getElementById('lbImgWrap');
  const color = getSystemColor(s.system_name);

  if (s._dataUrl) {
    wrap.innerHTML = `<img src="${s._dataUrl}" alt="">`;
  } else if (s.image_path) {
    const url = await resolveImageUrl(s.image_path);
    wrap.innerHTML = url
      ? `<img src="${url}" alt="">`
      : `<div class="lb-placeholder" style="color:${color}">${getSystemShort(s.system_name)}</div>`;
  } else {
    wrap.innerHTML = `<div class="lb-placeholder" style="color:${color}">${getSystemShort(s.system_name)}</div>`;
  }

  const pageStr = s.page_number ? `（${s.page_number}）` : '';
  document.getElementById('lbTitle').textContent = `${s.title || 'スクリーンショット'}${pageStr}`;
  document.getElementById('lbTags').innerHTML = [s.system_name, s.category, ...(s.tags || [])].filter(Boolean).map(t =>
    `<span class="card-tag" style="font-size:12px; padding:4px 10px;">${t}</span>`
  ).join('');

  // structured fields
  const fieldsEl = document.getElementById('lbFields');
  const fields = s.structured_fields || {};
  const fieldEntries = Object.entries(fields).filter(([, v]) => v);
  if (fieldEntries.length > 0) {
    fieldsEl.innerHTML = '<div class="lb-fields-grid">' + fieldEntries.map(([k, v]) =>
      `<div class="lb-field"><span class="lb-field-label">${k}</span><span class="lb-field-value">${v}</span></div>`
    ).join('') + '</div>';
    fieldsEl.style.display = 'block';
  } else {
    fieldsEl.style.display = 'none';
  }

  // extracted text
  const textEl = document.getElementById('lbExtractedText');
  if (s.extracted_text) {
    textEl.innerHTML = `<div class="lb-extracted"><span class="lb-extracted-label">抽出テキスト</span><pre>${s.extracted_text}</pre></div>`;
    textEl.style.display = 'block';
  } else {
    textEl.style.display = 'none';
  }

  const dateStr = s.created_at ? s.created_at.slice(0, 10) : '';
  document.getElementById('lbMeta').textContent = `${s.uploader_name} が ${dateStr} にアップロード`;
}

async function deleteScreenshot() {
  const s = filteredList[currentLbIndex];
  if (!s) return;
  if (!confirm('この画像を削除しますか？')) return;

  if (isLocalMode) {
    screenshots = screenshots.filter(x => x.id !== s.id);
    saveLocalScreenshots();
  } else {
    if (s.image_path) await sb.storage.from(STORAGE_BUCKET).remove([s.image_path]);
    await sb.from('rulebook_screenshots').delete().eq('id', s.id);
    await loadScreenshots();
  }
  closeLightbox();
  render();
}

// ===== 編集モーダル =====
let editTags = [];

function openEditModal() {
  const s = filteredList[currentLbIndex];
  if (!s) return;
  closeLightbox();
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
  const s = filteredList[currentLbIndex];
  if (!s) return;

  const status = document.getElementById('editStatus');
  status.textContent = '保存中...';

  const systemName = document.getElementById('editSystem').value;
  const category = document.getElementById('editCategory').value || null;
  const page = document.getElementById('editPage').value.trim() || null;
  const memo = document.getElementById('editMemo').value.trim();
  const extractedText = document.getElementById('editExtractedText').value.trim() || null;
  const structuredFields = collectStructuredFields('editFields');

  if (isLocalMode) {
    const idx = screenshots.findIndex(x => x.id === s.id);
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
    }).eq('id', s.id);
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
  if (e.key === 'Escape') { closeLightbox(); closeUpload(); closeEditModal(); }
  if (document.getElementById('lightbox').classList.contains('visible')) {
    if (e.key === 'ArrowLeft') navLightbox(-1);
    if (e.key === 'ArrowRight') navLightbox(1);
  }
});

// ===== 初期化 =====
checkSession();
// ===== Supabase初期化 =====
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ローカルモード判定（Supabase未設定時のフォールバック）
const isLocalMode = typeof LOCAL_MODE !== 'undefined' && LOCAL_MODE;

// ===== 状態管理 =====
let currentUser = null;
let screenshots = [];
let systems = [];
let tagMaster = [];
let activeFilters = new Set();
let currentTags = [];         // アップロード時のタグ
let uploadFiles = [];         // アップロード時のファイル
let filteredList = [];
let currentLbIndex = -1;

// カテゴリ分類用
const chapterTagNames = ['キャラ作成', '戦闘', '判定', 'ワールド', 'セッション進行'];

// ===== ローカルモード用デフォルトデータ =====
const defaultSystems = [
  { id: 1, name: 'ダブルクロス3rd', short_name: 'DX3', color: '#e94560' },
  { id: 2, name: 'クトゥルフ7版', short_name: 'CoC7', color: '#2ed573' },
  { id: 3, name: 'ソードワールド2.5', short_name: 'SW25', color: '#ffa502' },
  { id: 4, name: 'インセイン', short_name: 'INS', color: '#a55eea' },
];

const defaultTagMaster = [
  { name: 'シンドローム', system_name: 'ダブルクロス3rd', category: 'content', sort_order: 1 },
  { name: 'エフェクト', system_name: 'ダブルクロス3rd', category: 'content', sort_order: 2 },
  { name: 'コンボ', system_name: 'ダブルクロス3rd', category: 'content', sort_order: 3 },
  { name: 'ロイス', system_name: 'ダブルクロス3rd', category: 'content', sort_order: 4 },
  { name: 'タイタス', system_name: 'ダブルクロス3rd', category: 'content', sort_order: 5 },
  { name: '侵蝕率', system_name: 'ダブルクロス3rd', category: 'content', sort_order: 6 },
  { name: 'Dロイス', system_name: 'ダブルクロス3rd', category: 'content', sort_order: 7 },
  { name: 'アイテム', system_name: 'ダブルクロス3rd', category: 'content', sort_order: 8 },
  { name: 'ユニークアイテム', system_name: 'ダブルクロス3rd', category: 'content', sort_order: 9 },
  { name: 'ワークス', system_name: 'ダブルクロス3rd', category: 'content', sort_order: 10 },
  { name: 'レネゲイドビーイング', system_name: 'ダブルクロス3rd', category: 'content', sort_order: 11 },
  { name: 'キャラ作成', system_name: null, category: 'chapter', sort_order: 1 },
  { name: '戦闘', system_name: null, category: 'chapter', sort_order: 2 },
  { name: '判定', system_name: null, category: 'chapter', sort_order: 3 },
  { name: 'ワールド', system_name: null, category: 'chapter', sort_order: 4 },
];

// ===== 認証（カスタムユーザーテーブル方式） =====
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

  if (!username || !password) {
    errEl.textContent = 'IDとパスワードを入力してください';
    return;
  }

  const { data, error } = await sb.rpc('rulebook_login', {
    p_username: username,
    p_password: password
  });

  if (error || !data || data.length === 0) {
    errEl.textContent = 'IDまたはパスワードが正しくありません';
    return;
  }

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

  if (!username || !password) {
    errEl.textContent = 'IDとパスワードを入力してください';
    return;
  }
  if (!displayName) {
    errEl.textContent = '表示名を入力してください';
    return;
  }
  if (username.length < 3) {
    errEl.textContent = 'IDは3文字以上にしてください';
    return;
  }
  if (password.length < 4) {
    errEl.textContent = 'パスワードは4文字以上にしてください';
    return;
  }

  const { data, error } = await sb.rpc('rulebook_register', {
    p_username: username,
    p_password: password,
    p_display_name: displayName
  });

  if (error) {
    if (error.message.includes('unique') || error.message.includes('duplicate')) {
      errEl.textContent = 'そのIDは既に使われています';
    } else {
      errEl.textContent = '登録に失敗しました: ' + error.message;
    }
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
  if (!currentUser) return '不明';
  return currentUser.display_name || currentUser.username || '不明';
}

// ===== メイン画面表示 =====
async function showMainApp() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('mainApp').style.display = 'block';
  document.getElementById('currentUser').textContent = getDisplayName();
  document.getElementById('loadingIndicator').style.display = 'block';

  await Promise.all([loadSystems(), loadTagMaster(), loadScreenshots()]);

  document.getElementById('loadingIndicator').style.display = 'none';
  render();
}

// ===== データ読み込み =====
async function loadSystems() {
  if (isLocalMode) { systems = defaultSystems; return; }
  const { data, error } = await sb
    .from('rulebook_systems')
    .select('*')
    .order('name');
  if (!error && data) systems = data;
}

async function loadTagMaster() {
  if (isLocalMode) { tagMaster = defaultTagMaster; return; }
  const { data, error } = await sb
    .from('rulebook_tags')
    .select('*')
    .order('sort_order');
  if (!error && data) tagMaster = data;
}

async function loadScreenshots() {
  if (isLocalMode) {
    // ローカルモード: localStorageからロード
    const saved = localStorage.getItem('rulebook_screenshots');
    screenshots = saved ? JSON.parse(saved) : [];
    return;
  }
  const { data, error } = await sb
    .from('rulebook_screenshots')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('loadScreenshots error:', error);
    return;
  }
  screenshots = data || [];
}

function saveLocalScreenshots() {
  if (isLocalMode) {
    localStorage.setItem('rulebook_screenshots', JSON.stringify(screenshots));
  }
}

// ===== 画像URL取得 =====
function getImageUrl(imagePath) {
  if (!imagePath) return null;
  const { data } = sb.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(imagePath);
  return data?.publicUrl || null;
}

function getSignedUrl(imagePath) {
  // publicでない場合はsigned URLを使う
  return sb.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(imagePath, 3600); // 1時間
}

// キャッシュ
const imageUrlCache = {};
async function resolveImageUrl(imagePath) {
  if (imageUrlCache[imagePath]) return imageUrlCache[imagePath];
  // signed URL を使う（バケットが非公開のため）
  const { data, error } = await sb.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(imagePath, 3600);
  if (!error && data?.signedUrl) {
    imageUrlCache[imagePath] = data.signedUrl;
    return data.signedUrl;
  }
  // フォールバック: public URL
  const pubUrl = getImageUrl(imagePath);
  imageUrlCache[imagePath] = pubUrl;
  return pubUrl;
}

// ===== システムの色取得 =====
function getSystemColor(systemName) {
  const sys = systems.find(s => s.name === systemName);
  return sys?.color || '#666';
}

function getSystemShort(systemName) {
  const sys = systems.find(s => s.name === systemName);
  return sys?.short_name || systemName.charAt(0);
}

// ===== サイドバー描画 =====
function getAllTags(category) {
  const m = {};
  screenshots.forEach(s => {
    if (category === 'system') {
      m[s.system_name] = (m[s.system_name] || 0) + 1;
    } else if (category === 'page') {
      if (s.page_number) m[s.page_number] = (m[s.page_number] || 0) + 1;
    } else {
      (s.tags || []).forEach(t => {
        const isChapter = chapterTagNames.includes(t);
        if (category === 'chapter' && isChapter) m[t] = (m[t] || 0) + 1;
        else if (category === 'content' && !isChapter) m[t] = (m[t] || 0) + 1;
      });
    }
  });
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
}

function renderSidebar() {
  const sections = {
    systemTags: 'system',
    chapterTags: 'chapter',
    contentTags: 'content',
    pageTags: 'page',
  };
  for (const [elId, cat] of Object.entries(sections)) {
    const el = document.getElementById(elId);
    const tags = getAllTags(cat);
    el.innerHTML = tags.map(([name, count]) => {
      const escaped = name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      return `<span class="tag ${activeFilters.has(name) ? 'active' : ''}" data-cat="${cat}" onclick="toggleFilter('${escaped}')">${name} <span class="count">${count}</span></span>`;
    }).join('');
  }
}

function toggleFilter(tag) {
  activeFilters.has(tag) ? activeFilters.delete(tag) : activeFilters.add(tag);
  render();
  // モバイルではタグ選択後にサイドバーを閉じる
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
      const allTags = [s.system_name, s.page_number, ...(s.tags || [])];
      if (!allTags.includes(f)) return false;
    }
    if (q) {
      const hay = [s.title, s.system_name, s.page_number, ...(s.tags || []), s.memo || ''].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

// ===== カード描画 =====
async function renderCards() {
  filteredList = getFiltered();
  document.getElementById('resultCount').textContent = `${filteredList.length} 件のスクリーンショット`;

  const fi = document.getElementById('filterInfo');
  if (activeFilters.size > 0) {
    fi.classList.add('visible');
    document.getElementById('filterText').textContent =
      `絞り込み: ${[...activeFilters].join(' + ')}（${filteredList.length}件）`;
  } else {
    fi.classList.remove('visible');
  }

  const grid = document.getElementById('cardGrid');
  grid.innerHTML = filteredList.map((s, idx) => {
    const color = getSystemColor(s.system_name);
    const pageLabel = s.page_number || '';
    const tags = s.tags || [];
    const dateStr = s.created_at ? s.created_at.slice(0, 10) : '';
    const hasLocalImg = s._dataUrl;
    const imgHtml = hasLocalImg
      ? `<img src="${s._dataUrl}" alt="">`
      : `<span class="placeholder-icon" style="color:${color}">読込中</span>`;
    return `
    <div class="card" onclick="openLightbox(${idx})">
      <div class="card-img" data-path="${s.image_path || ''}" style="background: linear-gradient(135deg, ${color}15, var(--bg));">
        ${imgHtml}
        <span class="system-badge" style="background:${color}">${s.system_name}</span>
        ${pageLabel ? `<span class="page-label">${pageLabel}</span>` : ''}
      </div>
      <div class="card-body">
        <div class="card-title">${s.title || s.memo || 'スクリーンショット'}</div>
        <div class="card-tags">
          ${tags.slice(0, 3).map(t => `<span class="card-tag">${t}</span>`).join('')}
          ${tags.length > 3 ? `<span class="card-tag">+${tags.length - 3}</span>` : ''}
        </div>
        <div class="card-meta">
          <span>${s.uploader_name}</span>
          <span>${dateStr}</span>
        </div>
      </div>
    </div>`;
  }).join('');

  // 画像を非同期で読み込み
  loadCardImages();
}

async function loadCardImages() {
  const cardImgs = document.querySelectorAll('.card-img[data-path]');
  for (const el of cardImgs) {
    const path = el.dataset.path;
    if (!path) continue;
    try {
      const url = await resolveImageUrl(path);
      if (url) {
        const img = new Image();
        img.onload = () => {
          el.innerHTML = `<img src="${url}" alt="">` +
            el.querySelector('.system-badge').outerHTML +
            (el.querySelector('.page-label')?.outerHTML || '');
        };
        img.src = url;
      }
    } catch (e) {
      // 読み込み失敗時はプレースホルダのまま
    }
  }
}

function render() {
  renderSidebar();
  renderCards();
}

// ===== アップロード =====
function openUpload() {
  document.getElementById('uploadModal').classList.add('visible');
  uploadFiles = [];
  currentTags = [];
  renderUploadPreview();
  renderCurrentTags();
  document.getElementById('uploadPage').value = '';
  document.getElementById('uploadMemo').value = '';
  document.getElementById('uploadStatus').textContent = '';
  document.getElementById('fileInput').value = '';
  updateSubmitBtn();
  renderSystemSelect();
  renderQuickTags();
}

function closeUpload() {
  document.getElementById('uploadModal').classList.remove('visible');
}

function renderSystemSelect() {
  const sel = document.getElementById('uploadSystem');
  sel.innerHTML = systems.map(s =>
    `<option value="${s.name}">${s.name}</option>`
  ).join('') + '<option value="__new">+ 新しいシステムを追加...</option>';

  sel.onchange = () => {
    if (sel.value === '__new') {
      const name = prompt('新しいルールブック名を入力してください:');
      if (name && name.trim()) {
        addNewSystem(name.trim());
      } else {
        sel.selectedIndex = 0;
      }
    }
    renderQuickTags();
  };
}

async function addNewSystem(name) {
  const { data, error } = await sb
    .from('rulebook_systems')
    .insert({ name, short_name: name.slice(0, 3), color: '#888' })
    .select()
    .single();
  if (!error && data) {
    systems.push(data);
    renderSystemSelect();
    document.getElementById('uploadSystem').value = name;
  }
}

function renderQuickTags() {
  const selectedSystem = document.getElementById('uploadSystem').value;
  const el = document.getElementById('quickTags');
  // システム専用タグ + 共通タグ
  const tags = tagMaster.filter(t =>
    t.system_name === selectedSystem || t.system_name === null
  );
  el.innerHTML = tags.map(t =>
    `<span class="quick-tag" onclick="addTag('${t.name.replace(/'/g, "\\'")}')">${t.name}</span>`
  ).join('');
}

// ドラッグ&ドロップ
document.addEventListener('DOMContentLoaded', () => {
  const dz = document.getElementById('dropZone');
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz.addEventListener('drop', e => {
    e.preventDefault();
    dz.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
  });
});

function handleFiles(files) {
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const reader = new FileReader();
    reader.onload = e => {
      uploadFiles.push({ file, dataUrl: e.target.result });
      renderUploadPreview();
      updateSubmitBtn();
    };
    reader.readAsDataURL(file);
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
  updateSubmitBtn();
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
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag(e.target.value);
      e.target.value = '';
    }
  });
});

function updateSubmitBtn() {
  document.getElementById('submitBtn').disabled = uploadFiles.length === 0;
}

async function submitUpload() {
  if (uploadFiles.length === 0) return;

  const btn = document.getElementById('submitBtn');
  const status = document.getElementById('uploadStatus');
  btn.disabled = true;
  status.textContent = 'アップロード中...';

  const systemName = document.getElementById('uploadSystem').value;
  const page = document.getElementById('uploadPage').value.trim();
  const memo = document.getElementById('uploadMemo').value.trim();

  let successCount = 0;

  for (let i = 0; i < uploadFiles.length; i++) {
    const f = uploadFiles[i];
    status.textContent = `アップロード中... (${i + 1}/${uploadFiles.length})`;

    try {
      const pageLabel = page
        ? (uploadFiles.length > 1 ? `P${page}-${i + 1}` : `P${page}`)
        : null;
      const title = memo || f.file.name.replace(/\.\w+$/, '');

      if (isLocalMode) {
        // ローカルモード: dataUrlで保存
        screenshots.unshift({
          id: 'local_' + Date.now() + '_' + i,
          title,
          system_name: systemName,
          page_number: pageLabel,
          tags: [...currentTags],
          memo,
          image_path: null,
          _dataUrl: f.dataUrl,  // ローカル用
          uploader_id: currentUser.id,
          uploader_name: getDisplayName(),
          created_at: new Date().toISOString(),
        });
        successCount++;
        continue;
      }

      // 1. Storage にアップロード
      const ext = f.file.name.split('.').pop() || 'jpg';
      const safeFolder = encodeURIComponent(systemName).replace(/%/g, '_');
      const filePath = `${safeFolder}/${Date.now()}_${i}.${ext}`;

      const { error: storageError } = await sb.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, f.file, { contentType: f.file.type });

      if (storageError) {
        console.error('Storage upload error:', storageError);
        status.textContent = 'Storage エラー: ' + storageError.message;
        continue;
      }

      // 2. DBにレコード追加
      const { error: dbError } = await sb
        .from('rulebook_screenshots')
        .insert({
          title,
          system_name: systemName,
          page_number: pageLabel,
          tags: currentTags,
          memo,
          image_path: filePath,
          uploader_name: getDisplayName(),
        });

      if (dbError) {
        console.error('DB insert error:', dbError);
        status.textContent = 'DB エラー: ' + dbError.message;
        continue;
      }

      successCount++;
    } catch (e) {
      console.error('Upload error:', e);
    }
  }

  if (successCount === 0) {
    status.textContent = `アップロード失敗: ファイル${uploadFiles.length}個を処理しましたが保存できませんでした`;
    btn.disabled = false;
    return;
  }
  status.textContent = `${successCount}枚をアップロードしました`;

  // データ保存・再読み込み
  saveLocalScreenshots();
  if (!isLocalMode) await loadScreenshots();

  setTimeout(() => {
    closeUpload();
    render();
  }, 800);
}

// ===== ライトボックス =====
async function openLightbox(idx) {
  currentLbIndex = idx;
  await showLightboxItem();
  document.getElementById('lightbox').classList.add('visible');
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('visible');
}

function navLightbox(dir) {
  currentLbIndex += dir;
  if (currentLbIndex < 0) currentLbIndex = filteredList.length - 1;
  if (currentLbIndex >= filteredList.length) currentLbIndex = 0;
  showLightboxItem();
}

async function showLightboxItem() {
  const s = filteredList[currentLbIndex];
  if (!s) return;

  const wrap = document.getElementById('lbImgWrap');
  const color = getSystemColor(s.system_name);

  // 画像表示
  if (s._dataUrl) {
    wrap.innerHTML = `<img src="${s._dataUrl}" alt="${s.title || ''}">`;
  } else if (s.image_path) {
    const url = await resolveImageUrl(s.image_path);
    if (url) {
      wrap.innerHTML = `<img src="${url}" alt="${s.title || ''}">`;
    } else {
      wrap.innerHTML = `<div class="lb-placeholder" style="color:${color}">${getSystemShort(s.system_name)}</div>`;
    }
  } else {
    wrap.innerHTML = `<div class="lb-placeholder" style="color:${color}">${getSystemShort(s.system_name)}</div>`;
  }

  const pageStr = s.page_number ? `（${s.page_number}）` : '';
  document.getElementById('lbTitle').textContent = `${s.title || 'スクリーンショット'}${pageStr}`;
  document.getElementById('lbTags').innerHTML = [s.system_name, ...(s.tags || [])].map(t =>
    `<span class="card-tag" style="font-size:12px; padding:4px 10px;">${t}</span>`
  ).join('');
  const dateStr = s.created_at ? s.created_at.slice(0, 10) : '';
  document.getElementById('lbMeta').textContent = `${s.uploader_name} が ${dateStr} にアップロード`;

}

async function deleteScreenshot() {
  const s = filteredList[currentLbIndex];
  if (!s) return;
  if (!confirm('この画像を削除しますか？')) return;

  // Storage削除
  if (s.image_path) {
    await sb.storage.from(STORAGE_BUCKET).remove([s.image_path]);
  }

  // DB削除
  await sb.from('rulebook_screenshots').delete().eq('id', s.id);

  closeLightbox();
  await loadScreenshots();
  render();
}

// ===== 編集モーダル =====
let editTags = [];

function openEditModal() {
  const s = filteredList[currentLbIndex];
  if (!s) return;

  closeLightbox();
  document.getElementById('editModal').classList.add('visible');

  // システム選択肢
  const sel = document.getElementById('editSystem');
  sel.innerHTML = systems.map(sys =>
    `<option value="${sys.name}" ${sys.name === s.system_name ? 'selected' : ''}>${sys.name}</option>`
  ).join('');

  // ページ番号
  document.getElementById('editPage').value = s.page_number || '';

  // タグ
  editTags = [...(s.tags || [])];
  renderEditTags();

  // クイックタグ
  renderEditQuickTags();
  sel.onchange = renderEditQuickTags;

  // メモ
  document.getElementById('editMemo').value = s.title || s.memo || '';
  document.getElementById('editStatus').textContent = '';
}

function closeEditModal() {
  document.getElementById('editModal').classList.remove('visible');
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

function renderEditQuickTags() {
  const selectedSystem = document.getElementById('editSystem').value;
  const el = document.getElementById('editQuickTags');
  const tags = tagMaster.filter(t =>
    t.system_name === selectedSystem || t.system_name === null
  );
  el.innerHTML = tags.map(t =>
    `<span class="quick-tag" onclick="addEditTag('${t.name.replace(/'/g, "\\'")}')">${t.name}</span>`
  ).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('editTagInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addEditTag(e.target.value);
      e.target.value = '';
    }
  });
});

async function submitEdit() {
  const s = filteredList[currentLbIndex];
  if (!s) return;

  const status = document.getElementById('editStatus');
  status.textContent = '保存中...';

  const systemName = document.getElementById('editSystem').value;
  const page = document.getElementById('editPage').value.trim() || null;
  const memo = document.getElementById('editMemo').value.trim();

  const { error } = await sb
    .from('rulebook_screenshots')
    .update({
      system_name: systemName,
      page_number: page,
      tags: editTags,
      title: memo,
      memo: memo,
    })
    .eq('id', s.id);

  if (error) {
    status.textContent = 'エラー: ' + error.message;
    return;
  }

  status.textContent = '保存しました';
  await loadScreenshots();
  setTimeout(() => {
    closeEditModal();
    render();
  }, 500);
}

// ===== サイドバートグル（モバイル） =====
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
  if (e.key === 'Escape') {
    closeLightbox();
    closeUpload();
    closeEditModal();
  }
  if (document.getElementById('lightbox').classList.contains('visible')) {
    if (e.key === 'ArrowLeft') navLightbox(-1);
    if (e.key === 'ArrowRight') navLightbox(1);
  }
});

// ===== 初期化 =====
checkSession();
