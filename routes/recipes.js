const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

const DEFAULT_IMG = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=70';

// hide raw ratings, expose average + count
const view = (r) => {
  const { ratings, ...rest } = r;
  const n = ratings.length;
  const avg = n ? Math.round((ratings.reduce((s, x) => s + x.value, 0) / n) * 10) / 10 : 0;
  return { ...rest, avgRating: avg, ratingCount: n };
};

// GET /api/recipes?search=&category=&time=&author=
router.get('/', (req, res) => {
  const { search = '', category, time, author } = req.query;
  const q = search.toLowerCase();
  let list = db.read('recipes');
  if (q) list = list.filter((r) => r.title.toLowerCase().includes(q) || r.ingredients.some((i) => i.toLowerCase().includes(q)));
  if (category) list = list.filter((r) => r.category.toLowerCase() === category.toLowerCase());
  if (time) list = list.filter((r) => r.time <= Number(time));
  if (author) list = list.filter((r) => String(r.authorId) === author);
  res.json(list.map(view));
});

router.get('/:id', (req, res) => {
  const r = db.read('recipes').find((x) => String(x.id) === req.params.id);
  if (!r) return res.status(404).json({ error: 'Recipe not found' });
  res.json(view(r));
});

// POST /api/recipes  (login required)
router.post('/', auth, (req, res) => {
  const { title, description = '', category, difficulty = 'Easy', time, image, ingredients, instructions } = req.body;
  if (!title || !category || !time || !Array.isArray(ingredients) || !ingredients.length || !Array.isArray(instructions) || !instructions.length)
    return res.status(400).json({ error: 'Title, category, time, ingredients and instructions are required' });
  if (Number(time) <= 0) return res.status(400).json({ error: 'Cooking time must be a positive number' });

  const recipes = db.read('recipes');
  const recipe = {
    id: Date.now(),
    title: title.trim(),
    description: description.trim() || title.trim(),
    category,
    difficulty,
    time: Number(time),
    image: image && image.trim() ? image.trim() : DEFAULT_IMG,
    ingredients,
    instructions,
    ratings: [],
    author: req.user.name,
    authorId: req.user.id,
  };
  recipes.unshift(recipe);
  db.write('recipes', recipes);
  res.status(201).json(view(recipe));
});

// POST /api/recipes/:id/rate  (login required, one rating per user)
router.post('/:id/rate', auth, (req, res) => {
  const value = Number(req.body.value);
  if (!(value >= 1 && value <= 5)) return res.status(400).json({ error: 'Rating must be between 1 and 5' });
  const recipes = db.read('recipes');
  const r = recipes.find((x) => String(x.id) === req.params.id);
  if (!r) return res.status(404).json({ error: 'Recipe not found' });
  r.ratings = r.ratings.filter((x) => x.userId !== req.user.id);
  r.ratings.push({ userId: req.user.id, value });
  db.write('recipes', recipes);
  res.json(view(r));
});

// DELETE /api/recipes/:id  (only the author)
router.delete('/:id', auth, (req, res) => {
  const recipes = db.read('recipes');
  const r = recipes.find((x) => String(x.id) === req.params.id);
  if (!r) return res.status(404).json({ error: 'Recipe not found' });
  if (r.authorId !== req.user.id) return res.status(403).json({ error: 'You can only delete your own recipes' });
  db.write('recipes', recipes.filter((x) => x !== r));
  res.json({ message: 'Recipe deleted' });
});

module.exports = router;
