// seed.js — correr UNA VEZ para crear el primer usuario
'use strict';
const bcrypt = require('bcrypt');
const { getDb } = require('./database');

const NOMBRE = process.argv[2] || 'Admin';
const EMAIL = process.argv[3] || 'admin@gyver.com';
const PASS = process.argv[4] || 'admin123';

const db = getDb();
const hash = bcrypt.hashSync(PASS, 10);
try {
  db.prepare('INSERT INTO usuarios (nombre, email, password_hash) VALUES (?,?,?)').run(NOMBRE, EMAIL, hash);
  console.log(`✅ Usuario creado: ${EMAIL} / ${PASS}`);
  console.log('⚠️  Cambiá la contraseña desde la app después del primer login.');
} catch (e) {
  if (e.message.includes('UNIQUE')) console.log('El usuario ya existe.');
  else throw e;
}
