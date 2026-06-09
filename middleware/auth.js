// middleware/auth.js
'use strict';
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-cambia-en-produccion';
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '10');

function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies.token;
  if (!token) {
    const isApi = req.path.startsWith('/api/') || req.path.startsWith('/pdf/');
    return isApi
      ? res.status(401).json({ error: 'No autorizado' })
      : res.redirect('/login');
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.clearCookie('token');
    const isApi = req.path.startsWith('/api/') || req.path.startsWith('/pdf/');
    return isApi
      ? res.status(401).json({ error: 'Sesión expirada' })
      : res.redirect('/login');
  }
}

module.exports = { requireAuth, JWT_SECRET, BCRYPT_ROUNDS };
