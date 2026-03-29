const loginSection = document.getElementById('loginSection');
const appSection = document.getElementById('appSection');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const timeWindow = document.getElementById('timeWindow');
const refreshBtn = document.getElementById('refreshBtn');
const statusEl = document.getElementById('status');
const papersEl = document.getElementById('papers');
const favoritesEl = document.getElementById('favorites');

const AUTH_KEY = 'arxiv_auth_ok';
const FAVORITE_KEY = 'arxiv_favorites';
const WINDOW_KEY = 'arxiv_window_days';

function isLoggedIn() {
  return localStorage.getItem(AUTH_KEY) === 'true';
}

function setLoggedIn(value) {
  localStorage.setItem(AUTH_KEY, String(value));
}

function getFavorites() {
  return JSON.parse(localStorage.getItem(FAVORITE_KEY) || '[]');
}

function saveFavorites(favorites) {
  localStorage.setItem(FAVORITE_KEY, JSON.stringify(favorites));
}

function saveWindowDays(days) {
  localStorage.setItem(WINDOW_KEY, String(days));
}

function loadWindowDays() {
  return localStorage.getItem(WINDOW_KEY) || '7';
}

function renderAuth() {
  if (isLoggedIn()) {
    loginSection.classList.add('hidden');
    appSection.classList.remove('hidden');
  } else {
    loginSection.classList.remove('hidden');
    appSection.classList.add('hidden');
  }
}

function renderFavorites() {
  const favorites = getFavorites();
  if (!favorites.length) {
    favoritesEl.innerHTML = '<p>暂无收藏。</p>';
    return;
  }

  favoritesEl.innerHTML = favorites
    .map(
      (paper) => `
      <article class="paper">
        <h3>${paper.title}</h3>
        <p><strong>标题中文：</strong>${paper.titleZh || paper.title}</p>
        <p><strong>摘要中文：</strong>${paper.summaryZh || paper.summary}</p>
        <p class="meta">${paper.id}</p>
        <button data-remove="${paper.id}">取消收藏</button>
      </article>
    `
    )
    .join('');

  favoritesEl.querySelectorAll('button[data-remove]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-remove');
      const updated = getFavorites().filter((item) => item.id !== id);
      saveFavorites(updated);
      renderFavorites();
    });
  });
}

function renderPapers(papers) {
  if (!papers.length) {
    papersEl.innerHTML = '<p>当前时间窗口没有检索到论文。</p>';
    return;
  }

  const favoriteIds = new Set(getFavorites().map((p) => p.id));

  papersEl.innerHTML = papers
    .map(
      (paper) => `
      <article class="paper">
        <h3><a href="${paper.id}" target="_blank" rel="noopener noreferrer">${paper.title}</a></h3>
        <p><strong>标题（中文）:</strong> ${paper.titleZh || paper.title}</p>
        <p><strong>摘要（English）:</strong> ${paper.summary}</p>
        <p><strong>摘要（中文）:</strong> ${paper.summaryZh || paper.summary}</p>
        <p class="meta">published: ${paper.published || '-'} | updated: ${paper.updated || '-'}</p>
        <button data-save="${paper.id}" ${favoriteIds.has(paper.id) ? 'disabled' : ''}>
          ${favoriteIds.has(paper.id) ? '已收藏' : '收藏论文'}
        </button>
      </article>
    `
    )
    .join('');

  papersEl.querySelectorAll('button[data-save]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-save');
      const paper = papers.find((p) => p.id === id);
      const favorites = getFavorites();
      if (!favorites.find((f) => f.id === id)) {
        favorites.unshift(paper);
        saveFavorites(favorites.slice(0, 100));
        renderFavorites();
        renderPapers(papers);
      }
    });
  });
}

async function refreshPapers() {
  const days = timeWindow.value;
  saveWindowDays(days);
  statusEl.textContent = '正在更新...';
  papersEl.innerHTML = '';

  try {
    const response = await fetch(`/api/papers?days=${encodeURIComponent(days)}&max=20`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || '更新失败');
    }

    renderPapers(data.papers);
    statusEl.textContent = `更新完成，共 ${data.total} 篇。`;
  } catch (error) {
    statusEl.textContent = `更新失败：${error.message}`;
  }
}

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();

  if (username === 'admin123' && password === 'admin123') {
    setLoggedIn(true);
    loginError.textContent = '';
    renderAuth();
    renderFavorites();
    refreshPapers();
  } else {
    loginError.textContent = '账号或密码错误。';
  }
});

logoutBtn.addEventListener('click', () => {
  setLoggedIn(false);
  renderAuth();
});

refreshBtn.addEventListener('click', refreshPapers);

timeWindow.value = loadWindowDays();
renderAuth();
renderFavorites();
if (isLoggedIn()) {
  refreshPapers();
}
