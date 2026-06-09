// app.js
'use strict';
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const { requireAuth } = require('./middleware/auth');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Rutas públicas
app.use('/', require('./routes/auth'));

// Páginas protegidas
const sendView = (view) => (req, res) =>
  res.sendFile(path.join(__dirname, 'views', view));

app.get('/', requireAuth, sendView('index.html'));
app.get('/nuevo', requireAuth, sendView('form.html'));
app.get('/editar/:id', requireAuth, sendView('form.html'));
app.get('/companias', requireAuth, sendView('companias.html'));
app.get('/usuarios', requireAuth, sendView('usuarios.html'));

// API protegida
app.use('/api/presupuestos', requireAuth, require('./routes/presupuestos'));
app.use('/api/companias', requireAuth, require('./routes/companias'));
app.use('/api/usuarios', requireAuth, require('./routes/usuarios'));
app.use('/pdf', requireAuth, require('./routes/pdf'));

module.exports = { app };
