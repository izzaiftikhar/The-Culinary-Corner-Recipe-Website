/* ---------- helpers ---------- */
const $ = (s) => document.querySelector(s);
const CATS = [['Breakfast','🥞'],['Lunch','🥪'],['Dinner','🍛'],['Vegan','🥗'],['Desserts','🍰'],['Snacks','🍟']];
window.ph = (cat) => {
  const emoji = (CATS.find(([c]) => c === cat) || [0, '🍝'])[1];
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fde7d3"/><stop offset="1" stop-color="#f6c9a0"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><text x="50%" y="52%" font-size="180" text-anchor="middle" dominant-baseline="middle">${emoji}</text></svg>`);
};

const getToken = () => localStorage.getItem('token');
const getUser = () => JSON.parse(localStorage.getItem('user') || 'null');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stars = (r) => '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r));
const params = () => new URLSearchParams(location.search);

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (getToken()) headers.Authorization = 'Bearer ' + getToken();
  const res = await fetch('/api' + path, { method: opts.method || 'GET', headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

const card = (r) => `
  <a class="card" href="recipe.html?id=${r.id}">
    <img src="${esc(r.image)}" alt="${esc(r.title)}" onerror="this.onerror=null;this.src=ph('${esc(r.category)}')">
    <div class="card-body">
      <div class="tags"><span class="tag">${esc(r.category)}</span><span class="tag alt">${esc(r.difficulty)}</span><span class="tag">⏱ ${r.time} min</span></div>
      <h3>${esc(r.title)}</h3><p>${esc(r.description)}</p>
      <div class="rating">${stars(r.avgRating)} <small>${r.ratingCount ? r.avgRating + ' (' + r.ratingCount + ')' : 'No ratings yet'}</small></div>
    </div>
  </a>`;

function fillCategories(sel, withAll) {
  sel.innerHTML = (withAll ? '<option value="">All categories</option>' : '') + CATS.map(([c]) => `<option>${c}</option>`).join('');
}

const BRAND = 'The Culinary Corner';
function renderNav() {
  const u = getUser();
  $('#nav').innerHTML = `<div class="container nav-inner">
    <a class="logo" href="index.html"><img src="images/logo.png" alt="${BRAND} - Italian Food" onerror="this.style.display='none'"><span class="brand-t"><b>${BRAND}</b><i>Ricette Italiane</i></span></a>
    <nav>
      <a href="index.html">Home</a><a href="recipes.html">Browse Recipes</a>
      <a href="submit.html">Submit Recipe</a><a href="profile.html">User Profile</a>
      ${u ? '<a href="#" id="logout" class="btn small">Logout</a>' : '<a href="login.html" class="btn small">Login</a>'}
    </nav></div>`;
  const here = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('nav a').forEach((a) => { if (a.getAttribute('href') === here) a.classList.add('active'); });
  const out = $('#logout');
  if (out) out.onclick = (e) => { e.preventDefault(); localStorage.clear(); location.href = 'index.html'; };
}

function renderFooter() {
  const f = document.querySelector('footer'); if (!f) return;
  f.innerHTML = `<div class="foot"><div class="foot-brand"><img src="images/logo.png" alt=""><div><b>${BRAND}</b><small>Cook. Share. Savor.</small></div></div>
    <div class="foot-links"><a href="index.html">Home</a><a href="recipes.html">Browse Recipes</a><a href="submit.html">Submit Recipe</a><a href="login.html">Login</a></div></div>
    <div class="foot-b">© 2026 The Culinary Corner · Italian Food · Fatto con amore 🍅</div>`;
}

const countUp = (el) => {
  const n = +el.dataset.n, s = performance.now();
  const f = (t) => { const p = Math.min((t - s) / 1400, 1); el.textContent = Math.round(n * (1 - Math.pow(1 - p, 3))) + (el.dataset.s || ''); if (p < 1) requestAnimationFrame(f); };
  requestAnimationFrame(f);
};

const requireLogin = () => {
  if (getUser()) return true;
  location.href = 'login.html?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search);
  return false;
};

/* ---------- pages ---------- */
const pages = {
  async home() {
    $('#searchForm').onsubmit = (e) => { e.preventDefault(); location.href = 'recipes.html?search=' + encodeURIComponent($('#q').value); };
    const all = await api('/recipes');
    const top = [...all].sort((a, b) => b.avgRating - a.avgRating);
    // hero slideshow
    const sl = top.slice(0, 6); let cur = 0;
    $('#slides').innerHTML = sl.map((r) => `<div class="slide" style="background-image:url('${esc(r.image)}')"></div>`).join('');
    $('#dots').innerHTML = sl.map((_, i) => `<b data-i="${i}"></b>`).join('');
    const show = (i) => {
      cur = (i + sl.length) % sl.length;
      document.querySelectorAll('.slide').forEach((s, k) => s.classList.toggle('on', k === cur));
      document.querySelectorAll('#dots b').forEach((d, k) => d.classList.toggle('on', k === cur));
      $('#cap').innerHTML = `<small>Piatto del giorno</small><a href="recipe.html?id=${sl[cur].id}">${esc(sl[cur].title)} →</a>`;
    };
    show(0); setInterval(() => show(cur + 1), 5500);
    $('#dots').onclick = (e) => { if (e.target.dataset.i) show(+e.target.dataset.i); };
    // sliding dish-name ticker
    const names = all.map((r) => `<span>${esc(r.title)}</span>`).join('');
    $('#marquee').innerHTML = names + names;
    // categories with photos
    $('#cats').innerHTML = CATS.map(([c, e]) => { const m = all.filter((r) => r.category === c);
      return `<a class="cat2" href="recipes.html?category=${c}" style="background-image:url('${esc(m[0] ? m[0].image : '')}')"><span><small>${m.length} recipes</small>${e} ${c}</span></a>`; }).join('');
    // top-rated slider
    const row = $('#featured');
    row.innerHTML = top.slice(0, 10).map(card).join('');
    const step = () => (row.querySelector('.card').offsetWidth + 21) * 2;
    $('#next').onclick = () => { row.scrollLeft + row.clientWidth >= row.scrollWidth - 4 ? row.scrollTo({ left: 0 }) : row.scrollBy({ left: step() }); };
    $('#prev').onclick = () => row.scrollBy({ left: -step() });
    let auto = setInterval(() => $('#next').click(), 4500);
    row.parentElement.onmouseenter = () => clearInterval(auto);
    // about
    const pick = [...new Set([...['Tiramisu', 'Margherita Pizza', 'Spaghetti Carbonara'].map((t) => all.find((r) => r.title === t)), ...top].filter(Boolean))].slice(0, 3);
    $('#collage').innerHTML = pick.map((r) => `<img src="${esc(r.image)}" alt="${esc(r.title)}">`).join('');
    const ratings = all.reduce((s, r) => s + (r.ratingCount || 0), 0);
    $('#stats').innerHTML = [[all.length, 'Recipes', ''], [CATS.length, 'Categories', ''], [ratings, 'Ratings', ''], [100, 'Italian', '%']]
      .map(([n, l, s]) => `<div><b data-n="${n}" data-s="${s}">0</b><small>${l}</small></div>`).join('');
    // reveal on scroll
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); e.target.querySelectorAll('[data-n]').forEach(countUp); io.unobserve(e.target); } }), { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
  },

  async recipes() {
    fillCategories($('#category'), true);
    const p = params();
    $('#search').value = p.get('search') || '';
    $('#category').value = p.get('category') || '';
    $('#time').value = p.get('time') || '';
    const load = async () => {
      const q = new URLSearchParams({ search: $('#search').value, category: $('#category').value, time: $('#time').value });
      const list = await api('/recipes?' + q);
      $('#count').textContent = `${list.length} recipe${list.length === 1 ? '' : 's'} found`;
      $('#grid').innerHTML = list.length ? list.map(card).join('') : '<p class="muted">No recipes match your filters.</p>';
    };
    ['search', 'category', 'time'].forEach((id) => $('#' + id).addEventListener('input', load));
    load();
  },

  async recipe() {
    const id = params().get('id');
    try {
      const r = await api('/recipes/' + id);
      const u = getUser();
      $('#detail').innerHTML = `
        <a href="recipes.html" class="muted">← Back to recipes</a>
        <div class="detail">
          <img class="detail-img" src="${esc(r.image)}" alt="${esc(r.title)}" onerror="this.onerror=null;this.src=ph('${esc(r.category)}')">
          <div>
            <div class="tags"><span class="tag">${esc(r.category)}</span><span class="tag alt">${esc(r.difficulty)}</span><span class="tag">⏱ ${r.time} min</span></div>
            <h1>${esc(r.title)}</h1><p class="muted">by ${esc(r.author)}</p>
            <div class="rating big">${stars(r.avgRating)} <small>${r.ratingCount ? r.avgRating + ' / 5 (' + r.ratingCount + ' ratings)' : 'No ratings yet'}</small></div>
            <p>${esc(r.description)}</p>
            ${u && String(u.id) === String(r.authorId) ? '<button id="del" class="btn danger">Delete recipe</button>' : ''}
          </div>
        </div>
        <div class="two">
          <section class="panel"><h2 style="margin-top:0">Ingredients</h2><ul>${r.ingredients.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></section>
          <section class="panel"><h2 style="margin-top:0">Instructions</h2><ol>${r.instructions.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></section>
        </div>
        <h2>Rate this recipe</h2>
        <form id="rateForm" class="panel row" style="grid-template-columns:1fr auto;align-items:end">
          <label style="margin:0">Your rating<select id="rating">${[5,4,3,2,1].map((n) => `<option value="${n}">${stars(n)} (${n})</option>`).join('')}</select></label>
          <button class="btn">Submit rating</button>
        </form><p id="msg" class="error"></p>`;
      $('#rateForm').onsubmit = async (e) => {
        e.preventDefault();
        if (!requireLogin()) return;
        try { await api(`/recipes/${id}/rate`, { method: 'POST', body: { value: $('#rating').value } }); location.reload(); }
        catch (err) { $('#msg').textContent = err.message; }
      };
      const del = $('#del');
      if (del) del.onclick = async () => {
        if (!confirm('Delete this recipe?')) return;
        try { await api('/recipes/' + id, { method: 'DELETE' }); location.href = 'recipes.html'; }
        catch (err) { $('#msg').textContent = err.message; }
      };
    } catch (err) {
      $('#detail').innerHTML = `<p class="error">${esc(err.message)}</p><a class="btn" href="recipes.html">Back to recipes</a>`;
    }
  },

  submit() {
    if (!requireLogin()) return;
    fillCategories($('#category'), false);
    const lines = (v) => v.split('\n').map((s) => s.trim()).filter(Boolean);
    $('#form').onsubmit = async (e) => {
      e.preventDefault();
      try {
        const r = await api('/recipes', { method: 'POST', body: {
          title: $('#title').value, description: $('#description').value, category: $('#category').value,
          difficulty: $('#difficulty').value, time: Number($('#time').value), image: $('#image').value,
          ingredients: lines($('#ingredients').value), instructions: lines($('#instructions').value),
        } });
        location.href = 'recipe.html?id=' + r.id;
      } catch (err) { $('#msg').textContent = err.message; }
    };
  },

  login() {
    const done = (data) => {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      location.href = params().get('next') || 'index.html';
    };
    $('#loginForm').onsubmit = async (e) => {
      e.preventDefault();
      try { done(await api('/auth/login', { method: 'POST', body: { email: $('#lemail').value, password: $('#lpass').value } })); }
      catch (err) { $('#lmsg').textContent = err.message; }
    };
    $('#regForm').onsubmit = async (e) => {
      e.preventDefault();
      try { done(await api('/auth/register', { method: 'POST', body: { name: $('#rname').value, email: $('#remail').value, password: $('#rpass').value } })); }
      catch (err) { $('#rmsg').textContent = err.message; }
    };
  },

  async profile() {
    if (!requireLogin()) return;
    const u = getUser();
    const mine = await api('/recipes?author=' + u.id);
    $('#profile').innerHTML = `
      <div class="panel"><h1 style="margin-top:0">👤 ${esc(u.name)}</h1><p class="muted">${esc(u.email)}</p>
      <a class="btn" href="submit.html">+ Submit a Recipe</a></div>
      <h2>My Recipes (${mine.length})</h2>
      <div class="grid">${mine.length ? mine.map(card).join('') : '<p class="muted">You haven\'t submitted any recipes yet.</p>'}</div>`;
  },
};

renderNav();
renderFooter();
const init = pages[document.body.dataset.page];
if (init) init();
