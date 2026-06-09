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
  db.prepare('INSERT INTO usuarios (nombre, email, password_hash) VALUES (?,?,?)').run('Admin','admin@a.com', hash);
  const res = await request(app).post('/auth/login').send({ email:'admin@a.com', password:'pass' });
  cookie = res.headers['set-cookie'][0];
});

test('GET /api/usuarios devuelve lista sin password_hash', async () => {
  const res = await request(app).get('/api/usuarios').set('Cookie', cookie);
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body));
  assert.ok(res.body.every(u => !u.password_hash));
});

test('POST /api/usuarios crea un usuario nuevo', async () => {
  const res = await request(app)
    .post('/api/usuarios')
    .set('Cookie', cookie)
    .send({ nombre: 'Juan', email: 'juan@a.com', password: 'pass123' });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.email, 'juan@a.com');
  assert.ok(!res.body.password_hash);
});

test('DELETE /api/usuarios/:id elimina el usuario', async () => {
  const db = getDb();
  const u = db.prepare('SELECT id FROM usuarios WHERE email=?').get('juan@a.com');
  const res = await request(app)
    .delete(`/api/usuarios/${u.id}`)
    .set('Cookie', cookie);
  assert.strictEqual(res.status, 200);
  assert.ok(!db.prepare('SELECT id FROM usuarios WHERE id=?').get(u.id));
});
