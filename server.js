// server.js
'use strict';
const { app } = require('./app');
const { getDb } = require('./database');

const PORT = process.env.PORT || 3000;

getDb(); // Inicializar DB al arrancar

app.listen(PORT, () => {
  console.log(`Gyver Motos — http://localhost:${PORT}`);
});
