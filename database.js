'use strict';
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'presupuestos.db');

if (DB_PATH !== ':memory:') {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

let db;

function getDb() {
  if (db) return db;
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initSchema();
  return db;
}

function generateCodigoSerie() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const group = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${group()}-${group()}-${group()}-${group()}`;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      creado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS companias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT UNIQUE NOT NULL,
      activa INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS presupuestos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT UNIQUE NOT NULL,
      numero_secuencial INTEGER NOT NULL,
      fecha_emision TEXT NOT NULL,
      asegurado TEXT,
      domicilio_asegurado TEXT,
      marca TEXT,
      patente TEXT,
      modelo TEXT,
      tipo_moto TEXT,
      fecha_siniestro TEXT,
      compania_id INTEGER REFERENCES companias(id),
      numero_siniestro TEXT,
      estado TEXT NOT NULL DEFAULT 'borrador'
        CHECK(estado IN ('borrador','enviado','aprobado','rechazado')),
      creado_por INTEGER NOT NULL REFERENCES usuarios(id),
      creado_en TEXT NOT NULL DEFAULT (datetime('now')),
      modificado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      presupuesto_id INTEGER NOT NULL REFERENCES presupuestos(id) ON DELETE CASCADE,
      tipo TEXT NOT NULL CHECK(tipo IN ('repuesto','mano_obra')),
      descripcion TEXT NOT NULL,
      cantidad REAL,
      precio_unitario REAL NOT NULL DEFAULT 0,
      orden INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Migración: agregar columna codigo_serie si no existe
  try {
    db.exec('ALTER TABLE presupuestos ADD COLUMN codigo_serie TEXT');
  } catch (e) {
    // Ya existe, ignorar
  }

  // Generar código para presupuestos existentes que no tengan uno
  const sinCodigo = db.prepare('SELECT id FROM presupuestos WHERE codigo_serie IS NULL').all();
  const updateSerie = db.prepare('UPDATE presupuestos SET codigo_serie = ? WHERE id = ?');
  sinCodigo.forEach(row => updateSerie.run(generateCodigoSerie(), row.id));
}

function resetDb() {
  if (db) { db.close(); db = null; }
}

module.exports = { getDb, resetDb, generateCodigoSerie };
