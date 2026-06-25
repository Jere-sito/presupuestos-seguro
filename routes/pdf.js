// routes/pdf.js
'use strict';
const express  = require('express');
const { spawn } = require('child_process');
const path     = require('path');
const { getDb } = require('../database');

const router      = express.Router();
const LOGO_PATH   = path.join(__dirname, '../LOGO-COMPLETO-GYVER.png');
const SCRIPT_PATH = path.join(__dirname, '../generate_pdf.py');

function runPython(scriptPath, payload) {
  return new Promise((resolve, reject) => {
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const py = spawn(pythonCmd, [scriptPath]);
    const out = [];
    const err = [];
    py.stdout.on('data', chunk => out.push(chunk));
    py.stderr.on('data', chunk => err.push(chunk));
    py.on('close', code => {
      if (code === 0) {
        resolve(Buffer.concat(out));
      } else {
        reject(new Error(Buffer.concat(err).toString('utf8')));
      }
    });
    py.on('error', reject);
    py.stdin.write(payload, 'utf8');
    py.stdin.end();
  });
}

router.get('/:id', async (req, res) => {
  const db = getDb();
  const p = db.prepare(`
    SELECT p.*, c.nombre as compania_nombre
    FROM presupuestos p
    LEFT JOIN companias c ON p.compania_id = c.id
    WHERE p.id = ?
  `).get(req.params.id);

  if (!p) return res.status(404).json({ error: 'No encontrado' });

  const items     = db.prepare('SELECT * FROM items WHERE presupuesto_id = ? ORDER BY orden').all(p.id);
  const repuestos = items.filter(i => i.tipo === 'repuesto');
  const manoObra  = items.filter(i => i.tipo === 'mano_obra');
  const subtotalRep = repuestos.reduce((s, i) => s + (i.cantidad * i.precio_unitario), 0);
  const subtotalMO  = manoObra.reduce((s, i) => s + i.precio_unitario, 0);
  const total       = subtotalRep + subtotalMO;

  const payload = JSON.stringify({ p, repuestos, manoObra, subtotalRep, subtotalMO, total, logoPath: LOGO_PATH });

  try {
    const pdfBuffer = await runPython(SCRIPT_PATH, payload);
    const filename  = `Presupuesto de seguro - ${(p.asegurado || p.numero).replace(/[/\\?%*:|"<>]/g, '-')}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
    });
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Error generando PDF:', err.message);
    res.status(500).json({ error: 'Error generando PDF', detalle: err.message });
  }
});

module.exports = router;
