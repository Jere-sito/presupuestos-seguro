// routes/auth.js
'use strict';
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const { getDb } = require('../database');
const { JWT_SECRET, BCRYPT_ROUNDS } = require('../middleware/auth');

const router = express.Router();
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 días
// Dummy hash para evitar timing oracle en enumeración de emails
const DUMMY_HASH = '$2b$10$kCIQ.WG1KhlVFiQRHFIGge1N8j5KeGEkKkJVOB.WV9h4YpJmwJzZe';

router.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/login.html'));
});

router.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }
  const db = getDb();
  const user = db.prepare('SELECT * FROM usuarios WHERE LOWER(nombre) = LOWER(?)').get(username.trim());
  // Siempre ejecutar bcrypt.compare para evitar timing oracle en enumeración de usuarios
  const hashToCompare = user ? user.password_hash : DUMMY_HASH;
  const valid = await bcrypt.compare(password, hashToCompare);
  if (!user || !valid) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }
  const token = jwt.sign(
    { id: user.id, nombre: user.nombre },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_AGE,
    sameSite: 'lax'
  });
  res.json({ ok: true });
});

router.post('/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/login');
});

module.exports = router;
