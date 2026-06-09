// routes/usuarios.js
'use strict';
const express = require('express');
const bcrypt = require('bcrypt');
const { getDb } = require('../database');
const { BCRYPT_ROUNDS } = require('../middleware/auth');

const router = express.Router();

router.get('/', (req, res) => {
  const db = getDb();
  const usuarios = db.prepare('SELECT id, nombre, email, creado_en FROM usuarios ORDER BY nombre').all();
  res.json(usuarios);
});

router.post('/', async (req, res) => {
  const { nombre, email, password } = req.body;
  if (!nombre || !email || !password) {
    return res.status(400).json({ error: 'Nombre, email y contraseña requeridos' });
  }
  const db = getDb();
  try {
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const result = db.prepare(
      'INSERT INTO usuarios (nombre, email, password_hash) VALUES (?, ?, ?)'
    ).run(nombre.trim(), email.trim().toLowerCase(), hash);
    const u = db.prepare('SELECT id, nombre, email, creado_en FROM usuarios WHERE id=?').get(result.lastInsertRowid);
    res.status(201).json(u);
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
    }
    throw e;
  }
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM usuarios WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'No encontrado' });
  res.json({ ok: true });
});

module.exports = router;
