// routes/presupuestos.js
'use strict';
const express = require('express');
const { getDb, generateCodigoSerie } = require('../database');

const router = express.Router();

function nextNumero(db) {
  const row = db.prepare('SELECT MAX(numero_secuencial) as max FROM presupuestos').get();
  const seq = (row.max || 0) + 1;
  return { seq, numero: `PRES-${String(seq).padStart(4, '0')}` };
}

function saveItems(db, presupuestoId, items) {
  db.prepare('DELETE FROM items WHERE presupuesto_id = ?').run(presupuestoId);
  if (!items || !items.length) return;
  const stmt = db.prepare(`
    INSERT INTO items (presupuesto_id, tipo, descripcion, cantidad, precio_unitario, orden)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  items.forEach((item, i) => {
    stmt.run(presupuestoId, item.tipo, item.descripcion,
      item.cantidad !== undefined ? item.cantidad : null,
      item.precio_unitario || 0, item.orden !== undefined ? item.orden : i);
  });
}

function getPresupuesto(db, id) {
  const p = db.prepare(`
    SELECT p.*, c.nombre as compania_nombre, u.nombre as creado_por_nombre
    FROM presupuestos p
    LEFT JOIN companias c ON p.compania_id = c.id
    LEFT JOIN usuarios u ON p.creado_por = u.id
    WHERE p.id = ?
  `).get(id);
  if (p) p.items = db.prepare('SELECT * FROM items WHERE presupuesto_id = ? ORDER BY tipo DESC, orden').all(id);
  return p;
}

// GET /api/presupuestos?q=&estado=&compania_id=
router.get('/', (req, res) => {
  const { q, estado, compania_id, fecha_desde, fecha_hasta } = req.query;
  const db = getDb();
  let sql = `
    SELECT p.id, p.numero, p.codigo_serie, p.fecha_emision, p.asegurado, p.patente,
           p.estado, p.creado_en, p.modificado_en,
           c.nombre as compania_nombre, u.nombre as creado_por_nombre,
           (SELECT COALESCE(SUM(CASE WHEN i.tipo='repuesto' THEN i.cantidad * i.precio_unitario ELSE i.precio_unitario END),0)
            FROM items i WHERE i.presupuesto_id = p.id) as total
    FROM presupuestos p
    LEFT JOIN companias c ON p.compania_id = c.id
    LEFT JOIN usuarios u ON p.creado_por = u.id
    WHERE 1=1
  `;
  const params = [];
  if (q) { sql += ' AND (p.asegurado LIKE ? OR p.patente LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
  if (estado) { sql += ' AND p.estado = ?'; params.push(estado); }
  if (compania_id) { sql += ' AND p.compania_id = ?'; params.push(compania_id); }
  if (fecha_desde) { sql += ' AND date(p.creado_en) >= ?'; params.push(fecha_desde); }
  if (fecha_hasta) { sql += ' AND date(p.creado_en) <= ?'; params.push(fecha_hasta); }
  sql += ' ORDER BY p.creado_en DESC';
  res.json(db.prepare(sql).all(...params));
});

// POST /api/presupuestos — crear borrador (primer autosave)
router.post('/', (req, res) => {
  const db = getDb();
  const { seq, numero } = nextNumero(db);
  const { fecha_emision, asegurado, domicilio_asegurado, marca, patente,
          modelo, tipo_moto, fecha_siniestro, compania_id, numero_siniestro, items } = req.body;

  const result = db.prepare(`
    INSERT INTO presupuestos (numero, numero_secuencial, codigo_serie, fecha_emision,
      asegurado, domicilio_asegurado, marca, patente, modelo, tipo_moto,
      fecha_siniestro, compania_id, numero_siniestro, estado, creado_por)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'borrador',?)
  `).run(numero, seq, generateCodigoSerie(),
    fecha_emision || new Date().toISOString().split('T')[0],
    asegurado || null, domicilio_asegurado || null, marca || null,
    patente || null, modelo || null, tipo_moto || null,
    fecha_siniestro || null, compania_id || null, numero_siniestro || null,
    req.user.id);

  if (items && items.length) saveItems(db, result.lastInsertRowid, items);
  res.status(201).json(getPresupuesto(db, result.lastInsertRowid));
});

// GET /api/presupuestos/:id
router.get('/:id', (req, res) => {
  const p = getPresupuesto(getDb(), req.params.id);
  if (!p) return res.status(404).json({ error: 'No encontrado' });
  res.json(p);
});

// PATCH /api/presupuestos/:id — autosave + cambio de estado
router.patch('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM presupuestos WHERE id=?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'No encontrado' });

  const { numero, fecha_emision, asegurado, domicilio_asegurado, marca, patente,
          modelo, tipo_moto, fecha_siniestro, compania_id, numero_siniestro, estado, items } = req.body;

  if (numero && numero !== existing.numero) {
    const conflict = db.prepare('SELECT id FROM presupuestos WHERE numero=? AND id!=?').get(numero, req.params.id);
    if (conflict) return res.status(409).json({ error: `El número ${numero} ya existe` });
  }

  const get = (field, val) => val !== undefined ? val : existing[field];

  db.prepare(`
    UPDATE presupuestos SET
      numero = ?, fecha_emision = ?, asegurado = ?, domicilio_asegurado = ?,
      marca = ?, patente = ?, modelo = ?, tipo_moto = ?, fecha_siniestro = ?,
      compania_id = ?, numero_siniestro = ?, estado = ?,
      modificado_en = datetime('now')
    WHERE id = ?
  `).run(
    get('numero', numero), get('fecha_emision', fecha_emision),
    get('asegurado', asegurado), get('domicilio_asegurado', domicilio_asegurado),
    get('marca', marca), get('patente', patente), get('modelo', modelo),
    get('tipo_moto', tipo_moto), get('fecha_siniestro', fecha_siniestro),
    get('compania_id', compania_id), get('numero_siniestro', numero_siniestro),
    get('estado', estado), req.params.id
  );

  if (items !== undefined) saveItems(db, req.params.id, items);
  res.json(getPresupuesto(db, req.params.id));
});

// DELETE /api/presupuestos/:id
router.delete('/:id', (req, res) => {
  const result = getDb().prepare('DELETE FROM presupuestos WHERE id=?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'No encontrado' });
  res.json({ ok: true });
});

// POST /api/presupuestos/:id/duplicar
router.post('/:id/duplicar', (req, res) => {
  const db = getDb();
  const original = getPresupuesto(db, req.params.id);
  if (!original) return res.status(404).json({ error: 'No encontrado' });

  const { seq, numero } = nextNumero(db);
  const result = db.prepare(`
    INSERT INTO presupuestos (numero, numero_secuencial, codigo_serie, fecha_emision,
      asegurado, domicilio_asegurado, marca, patente, modelo, tipo_moto,
      fecha_siniestro, compania_id, numero_siniestro, estado, creado_por)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'borrador',?)
  `).run(numero, seq, generateCodigoSerie(), original.fecha_emision,
    original.asegurado, original.domicilio_asegurado, original.marca,
    original.patente, original.modelo, original.tipo_moto,
    original.fecha_siniestro, original.compania_id, original.numero_siniestro,
    req.user.id);

  const newId = result.lastInsertRowid;
  if (original.items.length) saveItems(db, newId, original.items);
  res.status(201).json({ id: newId, numero });
});

module.exports = router;
