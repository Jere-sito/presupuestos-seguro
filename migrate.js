'use strict';
// Correr UNA VEZ en Railway: node migrate.js
const { getDb } = require('./database');
const data = require('./migrate-data.json');

const db = getDb();

const run = db.transaction(() => {
  // Usuarios
  const insUser = db.prepare(`
    INSERT OR IGNORE INTO usuarios (id, nombre, email, password_hash, creado_en)
    VALUES (@id, @nombre, @email, @password_hash, @creado_en)
  `);
  data.usuarios.forEach(r => insUser.run(r));
  console.log(`Usuarios: ${data.usuarios.length}`);

  // Compañías
  const insCo = db.prepare(`
    INSERT OR IGNORE INTO companias (id, nombre, activa)
    VALUES (@id, @nombre, @activa)
  `);
  data.companias.forEach(r => insCo.run(r));
  console.log(`Compañías: ${data.companias.length}`);

  // Presupuestos
  const insPres = db.prepare(`
    INSERT OR IGNORE INTO presupuestos (
      id, numero, numero_secuencial, codigo_serie, fecha_emision,
      asegurado, domicilio_asegurado, marca, patente, modelo, tipo_moto,
      fecha_siniestro, compania_id, numero_siniestro, estado,
      creado_por, creado_en, modificado_en
    ) VALUES (
      @id, @numero, @numero_secuencial, @codigo_serie, @fecha_emision,
      @asegurado, @domicilio_asegurado, @marca, @patente, @modelo, @tipo_moto,
      @fecha_siniestro, @compania_id, @numero_siniestro, @estado,
      @creado_por, @creado_en, @modificado_en
    )
  `);
  data.presupuestos.forEach(r => insPres.run(r));
  console.log(`Presupuestos: ${data.presupuestos.length}`);

  // Ítems
  const insItem = db.prepare(`
    INSERT OR IGNORE INTO items (id, presupuesto_id, tipo, descripcion, cantidad, precio_unitario, orden)
    VALUES (@id, @presupuesto_id, @tipo, @descripcion, @cantidad, @precio_unitario, @orden)
  `);
  data.items.forEach(r => insItem.run(r));
  console.log(`Ítems: ${data.items.length}`);
});

run();
console.log('Migración completada.');
