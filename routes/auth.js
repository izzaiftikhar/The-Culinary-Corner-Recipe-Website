const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const auth = require('../middleware/auth');
const { SECRET } = require('../config');

const session = (u) => ({
  token: jwt.sign({ id: u.id, name: u.name }, SECRET, { expiresIn: '7d' }),
  user: { id: u.id, name: u.name, email: u.email },
});

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const users = db.read('users');
  if (users.some((u) => u.email === email.toLowerCase()))
    return res.status(409).json({ error: 'Email already registered' });

  const user = { id: Date.now(), name: name.trim(), email: email.toLowerCase(), password: await bcrypt.hash(password, 10) };
  users.push(user);
  db.write('users', users);
  res.status(201).json(session(user));
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  const user = db.read('users').find((u) => u.email === email.toLowerCase());
  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.status(401).json({ error: 'Invalid email or password' });
  res.json(session(user));
});

router.get('/me', auth, (req, res) => res.json({ user: req.user }));

module.exports = router;
