// routes/companias.js
'use strict';
const express = require('express');
const { getDb } = require('../database');

const router = express.Router();

// GET /api/companias — solo activas (para el dropdown del formulario)
// GET /api/companias?todas=1 — todas (para la página de gestión)
router.get('/', (req, res) => {
  const db = getDb();
  const sql = req.query.todas
    ? 'SELECT * FROM companias ORDER BY nombre'
    : 'SELECT * FROM companias WHERE activa = 1 ORDER BY nombre';
  res.json(db.prepare(sql).all());
});

router.post('/', (req, res) => {
  const { nombre } = req.body;
  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'Nombre requerido' });
  }
  const db = getDb();
  try {
    const result = db.prepare('INSERT INTO companias (nombre) VALUES (?)').run(nombre.trim());
    const compania = db.prepare('SELECT * FROM companias WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(compania);
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Ya existe una compañía con ese nombre' });
    }
    throw e;
  }
});

// PATCH /:id/toggle debe estar ANTES de PATCH /:id
router.patch('/:id/toggle', (req, res) => {
  const db = getDb();
  const c = db.prepare('SELECT * FROM companias WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'No encontrada' });
  db.prepare('UPDATE companias SET activa = ? WHERE id = ?').run(c.activa ? 0 : 1, c.id);
  res.json(db.prepare('SELECT * FROM companias WHERE id = ?').get(c.id));
});

router.patch('/:id', (req, res) => {
  const { nombre } = req.body;
  const db = getDb();
  const c = db.prepare('SELECT * FROM companias WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'No encontrada' });
  db.prepare('UPDATE companias SET nombre = ? WHERE id = ?').run(nombre || c.nombre, c.id);
  res.json(db.prepare('SELECT * FROM companias WHERE id = ?').get(c.id));
});

module.exports = router;
