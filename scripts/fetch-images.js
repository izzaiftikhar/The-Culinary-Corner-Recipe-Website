/* Downloads a real food photo for every recipe into public/images and points
   data/recipes.json at the local files.

   node scripts/fetch-images.js            -> only recipes that have no photo yet
   node scripts/fetch-images.js --force    -> re-download every recipe photo

   Sources tried in order for each dish:
     0. data/image-overrides.json   { "tiramisu": "https://direct-image-link.jpg" }  (yours)
     1. TheMealDB      (curated recipe photos)
     2. Wikimedia Commons search (real dish photos, size/quality filtered)
     3. Wikipedia lead image
     4. Flickr by keyword (last resort)
   Never throws: npm install always succeeds. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'data', 'recipes.json');
const OVERRIDES = path.join(ROOT, 'data', 'image-overrides.json');
const IMG_DIR = path.join(ROOT, 'public', 'images');
const FORCE = process.argv.includes('--force');
const UA = { 'User-Agent': 'TheCulinaryCornerStudentProject/1.0 (internship demo; contact via GitHub)' };
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const BAD = /(menu|map|logo|diagram|flag|restaurant|market|shop|street|people|person|kitchen|chef|table|buffet|stall|sign|poster|book|cover|chart|package|box|can\b|statue|museum|festival|crowd|vendor|truck|bakery|window|display)/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const used = new Set();

async function request(url, tries = 4) {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { headers: UA, redirect: 'follow' });
      if (res.ok) return res;
      if (res.status === 429 || res.status >= 500) { await sleep(1500 * i); continue; }
      return null;
    } catch (e) { await sleep(800 * i); }
  }
  return null;
}
const getJSON = async (url) => { const r = await request(url); if (!r) return null; try { return await r.json(); } catch { return null; } };

const STOP = new Set(['italian','classic','vegan','alla','allo','della','dello','style','with','and','the','all']);
const kws = (c) => c.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
const PLANTISH = /plant|species|fungus|fungi|legume|genus|mushroom|cultivar|tree|vegetable|fruit|herb\b|spice|grain|animal|cured meat|salami|ham\b|cheese made/i;
const DISHISH = /dish|soup|pasta|pizza|bread|sandwich|pastry|dessert|cake|sauce|stew|rice|salad|omelet|dumpling|doughnut|donut|biscuit|pudding|ice cream|custard|croissant|snack|appetizer|starter|fritter|toast|pancake|tart|cookie|meal|food|cuisine|preparation|crisp|gelato|coffee|confection|sweet|fried|baked|risotto/i;
const clean = (t) => t.replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim();
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/* ---- sources: each returns an image URL or null ---- */
async function fromOverride(r, slug, overrides) { return overrides[slug] || null; }

async function fromMealDB(r, slug, cands) {
  for (const c of cands) {
    const j = await getJSON('https://www.themealdb.com/api/json/v1/1/search.php?s=' + encodeURIComponent(c));
    const want = norm(c);
    const hit = ((j && j.meals) || []).find((m) => {
      const n = norm(m.strMeal);
      return (n === want || n.includes(want) || want.includes(n)) && m.strMealThumb && !used.has(m.strMealThumb);
    });
    if (hit) return hit.strMealThumb;
    await sleep(150);
  }
  return null;
}

async function fromCommons(r, slug, cands) {
  for (const c of cands) {
    const q = encodeURIComponent(c + ' filetype:bitmap');
    const j = await getJSON('https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=20&gsrsearch=' + q + '&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=960');
    const pages = j && j.query && j.query.pages ? Object.values(j.query.pages) : [];
    pages.sort((a, b) => (a.index || 0) - (b.index || 0));
    for (const p of pages) {
      const info = p.imageinfo && p.imageinfo[0];
      if (!info || info.mime !== 'image/jpeg') continue;
      if (info.width < 900 || info.height < 600) continue;
      if (info.width / info.height > 2 || info.height / info.width > 1.4) continue; // odd crops
      if (BAD.test(p.title)) continue;
      const fname = norm(p.title.replace(/^File:/, ''));
      if (!kws(c).every((k) => fname.includes(k.replace(/s$/, '')))) continue; // must really be this dish
      const url = info.thumburl || info.url;
      if (url && !used.has(url)) return url;
    }
    await sleep(400);
  }
  return null;
}

async function fromWikipedia(r, slug, cands) {
  for (const c of cands) {
    const j = await getJSON('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(c.replace(/ /g, '_')));
    const desc = (j && j.description) || '';
    const isDish = j && !PLANTISH.test(desc) && DISHISH.test(desc + ' ' + ((j.extract || '').slice(0, 120)));
    let src = isDish && j.thumbnail && j.thumbnail.source;
    if (src) src = src.replace(/\/\d+px-/, '/960px-');
    if (src && !/\.svg/i.test(src) && !used.has(src)) return src;
    await sleep(300);
  }
  return null;
}

async function fromFlickr(r, slug, cands) {
  const kw = norm(cands[0]).split(' ').filter((w) => w.length > 2).slice(0, 3).join(',');
  return `https://loremflickr.com/960/640/${kw},food/all?lock=${r.id}`;
}

async function save(url, slug) {
  const res = await request(url);
  if (!res) return null;
  const type = (res.headers.get('content-type') || '').split(';')[0];
  if (!type.startsWith('image/') || type.includes('svg')) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 12000) return null; // placeholder / error image
  const file = slug + (EXT[type] || '.jpg');
  fs.writeFileSync(path.join(IMG_DIR, file), buf);
  return '/images/' + file;
}

const existingFor = (slug) => fs.readdirSync(IMG_DIR).filter((f) => f.startsWith(slug + '.'));

(async () => {
  if (typeof fetch !== 'function') return console.log('Node 18+ is needed to download images. Skipping.');
  fs.mkdirSync(IMG_DIR, { recursive: true });
  const recipes = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const overrides = fs.existsSync(OVERRIDES) ? JSON.parse(fs.readFileSync(OVERRIDES, 'utf8') || '{}') : {};
  const stats = { ok: 0, skipped: 0, failed: [] };
  const tally = {};

  for (const r of recipes) {
    if (!r.wiki) continue; // user-submitted recipes keep their own image
    const slug = path.basename(r.image, path.extname(r.image));
    const have = existingFor(slug);
    if (have.length && !FORCE) { r.image = '/images/' + have[0]; stats.skipped++; continue; }
    have.forEach((f) => fs.unlinkSync(path.join(IMG_DIR, f)));

    const cands = [...new Set([clean(r.title), ...r.wiki])];
    const sources = [['yours', fromOverride], ['mealdb', fromMealDB], ['commons', fromCommons], ['wikipedia', fromWikipedia], ['flickr', fromFlickr]];
    let done = false;
    for (const [name, fn] of sources) {
      try {
        const url = name === 'yours' ? await fn(r, slug, overrides) : await fn(r, slug, cands);
        if (!url) continue;
        const local = await save(url, slug);
        if (!local) continue;
        r.image = local; used.add(url); stats.ok++; tally[name] = (tally[name] || 0) + 1; done = true;
        console.log(`✔ ${r.title}  (${name})`);
        break;
      } catch (e) { /* next source */ }
    }
    if (!done) { stats.failed.push(r.title); console.log('✖ no photo for', r.title); }
    await sleep(250);
  }
  fs.writeFileSync(FILE, JSON.stringify(recipes, null, 2));
  console.log(`\nImages: ${stats.ok} downloaded, ${stats.skipped} already present, ${stats.failed.length} missing.`, tally);
  if (stats.failed.length) console.log('Missing:', stats.failed.join(', '), '\nFix: add "slug": "https://direct-image-link" to data/image-overrides.json, then run: npm run images');
})().catch((e) => console.log('Image download skipped:', e.message));
