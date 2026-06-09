'use strict';
process.env.DB_PATH = ':memory:';
process.env.BCRYPT_ROUNDS = '4';

const { test, before } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const bcrypt = require('bcrypt');
const { app } = require('../app');
const { getDb } = require('../database');

before(async () => {
  const db = getDb();
  const hash = await bcrypt.hash('clave123', 4);
  db.prepare(
    'INSERT INTO usuarios (nombre, email, password_hash) VALUES (?,?,?)'
  ).run('Admin', 'admin@gyver.com', hash);
});

test('POST /auth/login con credenciales válidas devuelve cookie token', async () => {
  const res = await request(app)
    .post('/auth/login')
    .send({ email: 'admin@gyver.com', password: 'clave123' });
  assert.strictEqual(res.status, 200);
  assert.ok(res.headers['set-cookie'].some(c => c.startsWith('token=')));
  assert.deepStrictEqual(res.body, { ok: true });
});

test('POST /auth/login con contraseña incorrecta devuelve 401', async () => {
  const res = await request(app)
    .post('/auth/login')
    .send({ email: 'admin@gyver.com', password: 'mal' });
  assert.strictEqual(res.status, 401);
});

test('POST /auth/login con email inexistente devuelve 401', async () => {
  const res = await request(app)
    .post('/auth/login')
    .send({ email: 'noexiste@gyver.com', password: 'clave123' });
  assert.strictEqual(res.status, 401);
});

test('GET /api/presupuestos sin token devuelve 401', async () => {
  const res = await request(app).get('/api/presupuestos');
  assert.strictEqual(res.status, 401);
});
