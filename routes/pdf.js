// routes/pdf.js
'use strict';
const express = require('express');
const puppeteer = require('puppeteer');
const ejs = require('ejs');
const fs = require('fs');
const path = require('path');
const { getDb } = require('../database');

const router = express.Router();
const TEMPLATE_PATH = path.join(__dirname, '../views/pdf-template.html');

const logoPath = path.join(__dirname, '../public/img/logo.png');
const logoBase64 = fs.existsSync(logoPath)
  ? `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`
  : '';

function fmt(n) {
  return '$' + (n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y}`;
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

  const items = db.prepare('SELECT * FROM items WHERE presupuesto_id = ? ORDER BY orden').all(p.id);
  const repuestos = items.filter(i => i.tipo === 'repuesto');
  const manoObra = items.filter(i => i.tipo === 'mano_obra');
  const subtotalRep = repuestos.reduce((s, i) => s + (i.cantidad * i.precio_unitario), 0);
  const subtotalMO = manoObra.reduce((s, i) => s + i.precio_unitario, 0);
  const neto = subtotalRep + subtotalMO;
  const iva = neto * 0.21;
  const total = neto + iva;

  const html = await ejs.renderFile(TEMPLATE_PATH, {
    p, repuestos, manoObra, subtotalRep, subtotalMO, neto, iva, total,
    logoBase64, fmt, formatDate
  });

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' }
    });
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="presupuesto-${p.numero}.pdf"`
    });
    res.send(Buffer.from(pdf));
  } finally {
    await browser.close();
  }
});

module.exports = router;
