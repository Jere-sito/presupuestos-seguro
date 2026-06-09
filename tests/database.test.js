'use strict';
process.env.DB_PATH = ':memory:';

const { test } = require('node:test');
const assert = require('node:assert');
const { getDb } = require('../database');

test('getDb() crea todas las tablas necesarias', () => {
  const db = getDb();
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  ).all().map(r => r.name);
  assert.ok(tables.includes('usuarios'));
  assert.ok(tables.includes('companias'));
  assert.ok(tables.includes('presupuestos'));
  assert.ok(tables.includes('items'));
});

test('getDb() devuelve la misma instancia en llamadas repetidas', () => {
  const a = getDb();
  const b = getDb();
  assert.strictEqual(a, b);
});
