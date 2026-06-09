// tests/presupuestos.test.js
'use strict';
process.env.DB_PATH = ':memory:';
process.env.BCRYPT_ROUNDS = '4';

const { test, before } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const bcrypt = require('bcrypt');
const { app } = require('../app');
const { getDb } = require('../database');

let cookie, presId;

before(async () => {
  const db = getDb();
  const hash = await bcrypt.hash('pass', 4);
  db.prepare('INSERT INTO usuarios (nombre, email, password_hash) VALUES (?,?,?)').run('Test','t@t.com', hash);
  const res = await request(app).post('/auth/login').send({ email:'t@t.com', password:'pass' });
  cookie = res.headers['set-cookie'][0];
});

test('GET /api/presupuestos devuelve lista vacía inicialmente', async () => {
  const res = await request(app).get('/api/presupuestos').set('Cookie', cookie);
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.body, []);
});

test('POST /api/presupuestos crea un borrador con número PRES-0001', async () => {
  const res = await request(app)
    .post('/api/presupuestos')
    .set('Cookie', cookie)
    .send({ fecha_emision: '2026-06-09', asegurado: 'Juan Pérez' });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.numero, 'PRES-0001');
  assert.strictEqual(res.body.estado, 'borrador');
  presId = res.body.id;
});

test('GET /api/presupuestos/:id devuelve presupuesto con items', async () => {
  const res = await request(app).get(`/api/presupuestos/${presId}`).set('Cookie', cookie);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.asegurado, 'Juan Pérez');
  assert.ok(Array.isArray(res.body.items));
});

test('PATCH /api/presupuestos/:id actualiza campos y guarda items', async () => {
  const res = await request(app)
    .patch(`/api/presupuestos/${presId}`)
    .set('Cookie', cookie)
    .send({
      asegurado: 'María López',
      items: [
        { tipo: 'repuesto', descripcion: 'Bujía', cantidad: 2, precio_unitario: 1500, orden: 0 },
        { tipo: 'mano_obra', descripcion: 'Ajuste', cantidad: null, precio_unitario: 3000, orden: 1 }
      ]
    });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.asegurado, 'María López');
  assert.strictEqual(res.body.items.length, 2);
});

test('POST /api/presupuestos/:id/duplicar crea copia como borrador con nuevo número', async () => {
  const res = await request(app)
    .post(`/api/presupuestos/${presId}/duplicar`)
    .set('Cookie', cookie);
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.numero, 'PRES-0002');
});

test('PATCH /api/presupuestos/:id valida número duplicado', async () => {
  const res = await request(app)
    .patch(`/api/presupuestos/${presId}`)
    .set('Cookie', cookie)
    .send({ numero: 'PRES-0002' });
  assert.strictEqual(res.status, 409);
});

test('DELETE /api/presupuestos/:id elimina el presupuesto', async () => {
  const res = await request(app)
    .delete(`/api/presupuestos/${presId}`)
    .set('Cookie', cookie);
  assert.strictEqual(res.status, 200);
});
