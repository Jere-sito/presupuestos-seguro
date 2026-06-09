'use strict';
process.env.DB_PATH = ':memory:';
process.env.BCRYPT_ROUNDS = '4';

const { test, before } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const bcrypt = require('bcrypt');
const { app } = require('../app');
const { getDb } = require('../database');

let cookie;

before(async () => {
  const db = getDb();
  const hash = await bcrypt.hash('pass', 4);
  db.prepare('INSERT INTO usuarios (nombre, email, password_hash) VALUES (?,?,?)').run('A','a@a.com', hash);
  const res = await request(app).post('/auth/login').send({ email:'a@a.com', password:'pass' });
  cookie = res.headers['set-cookie'][0];
});

test('GET /api/companias devuelve lista vacía inicialmente', async () => {
  const res = await request(app).get('/api/companias').set('Cookie', cookie);
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.body, []);
});

test('POST /api/companias crea una compañía', async () => {
  const res = await request(app)
    .post('/api/companias')
    .set('Cookie', cookie)
    .send({ nombre: 'Sancor Seguros' });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.nombre, 'Sancor Seguros');
  assert.strictEqual(res.body.activa, 1);
});

test('GET /api/companias devuelve solo las activas', async () => {
  const db = getDb();
  db.prepare('INSERT INTO companias (nombre, activa) VALUES (?,0)').run('Inactiva SA');
  const res = await request(app).get('/api/companias').set('Cookie', cookie);
  assert.ok(res.body.every(c => c.activa === 1));
});

test('PATCH /api/companias/:id/toggle cambia el estado activa', async () => {
  const db = getDb();
  const c = db.prepare('SELECT id FROM companias WHERE nombre=?').get('Sancor Seguros');
  const res = await request(app)
    .patch(`/api/companias/${c.id}/toggle`)
    .set('Cookie', cookie);
  assert.strictEqual(res.status, 200);
  const updated = db.prepare('SELECT activa FROM companias WHERE id=?').get(c.id);
  assert.strictEqual(updated.activa, 0);
});
