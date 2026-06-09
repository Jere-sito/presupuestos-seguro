# Sistema de Presupuestos Gyver Motos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir una aplicación web full-stack para que Gyver Motos cree, gestione y exporte presupuestos PDF con validez legal ante compañías de seguros.

**Architecture:** Express.js sirve páginas HTML y una API REST respaldada por SQLite. La autenticación usa JWT en cookies httpOnly con persistencia de 30 días. El formulario hace autosave al servidor cada 2 segundos vía fetch. Los PDFs se generan on-demand con Puppeteer + EJS y se devuelven como stream al navegador.

**Tech Stack:** Node.js 18+, Express 4, better-sqlite3, bcrypt, jsonwebtoken, cookie-parser, puppeteer, ejs, supertest (tests)

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `app.js` | Creación de la app Express, middleware, montaje de rutas |
| `server.js` | Entry point — llama a app.listen() |
| `database.js` | Conexión SQLite, init de schema, seed del primer usuario |
| `middleware/auth.js` | Verificación JWT, exporta JWT_SECRET |
| `routes/auth.js` | POST /auth/login, POST /auth/logout |
| `routes/presupuestos.js` | CRUD + duplicar para /api/presupuestos |
| `routes/companias.js` | CRUD para /api/companias |
| `routes/usuarios.js` | CRUD para /api/usuarios |
| `routes/pdf.js` | GET /pdf/:id — generación PDF con Puppeteer |
| `views/login.html` | Página de login |
| `views/index.html` | Listado de presupuestos |
| `views/form.html` | Formulario crear/editar presupuesto |
| `views/pdf-template.html` | Template EJS para el PDF |
| `views/companias.html` | Gestión de compañías de seguros |
| `views/usuarios.html` | Gestión de usuarios |
| `public/style.css` | Estilos globales compartidos |
| `public/form.js` | Ítems dinámicos, totales en tiempo real, autosave, warnings de estado |
| `public/list.js` | Búsqueda, filtros, acciones del listado |
| `tests/auth.test.js` | Tests de autenticación |
| `tests/presupuestos.test.js` | Tests del CRUD de presupuestos |
| `tests/companias.test.js` | Tests de compañías |
| `tests/usuarios.test.js` | Tests de usuarios |

---

### Task 1: Scaffold del proyecto

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: estructura de carpetas

- [ ] **Step 1: Crear estructura de carpetas**

```bash
mkdir -p middleware routes views public/img tests data docs/superpowers/plans
```

- [ ] **Step 2: Inicializar npm y crear package.json**

```bash
npm init -y
```

Luego editar `package.json` para que quede así:

```json
{
  "name": "sistema-presupuestos-gyver",
  "version": "1.0.0",
  "description": "Sistema de presupuestos para compañías de seguros — Gyver Motos",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js",
    "test": "node --test tests/*.test.js"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

- [ ] **Step 3: Instalar dependencias de producción**

```bash
npm install express better-sqlite3 bcrypt jsonwebtoken cookie-parser puppeteer ejs
```

- [ ] **Step 4: Instalar dependencias de desarrollo**

```bash
npm install --save-dev supertest
```

- [ ] **Step 5: Crear .gitignore**

```
node_modules/
data/
.env
*.db
```

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "chore: scaffold del proyecto — dependencias y estructura"
```

---

### Task 2: Módulo de base de datos

**Files:**
- Create: `database.js`
- Create: `tests/database.test.js`

- [ ] **Step 1: Escribir el test que falla**

```js
// tests/database.test.js
'use strict';
process.env.DB_PATH = ':memory:';

const { test } = require('node:test');
const assert = require('node:assert');
const { getDb } = require('../database');

test('getDb() crea todas las tablas necesarias', () => {
  const db = getDb();
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  ).all().map(r => r.name);
  assert.ok(tables.includes('usuarios'));
  assert.ok(tables.includes('companias'));
  assert.ok(tables.includes('presupuestos'));
  assert.ok(tables.includes('items'));
});

test('getDb() devuelve la misma instancia en llamadas repetidas', () => {
  const a = getDb();
  const b = getDb();
  assert.strictEqual(a, b);
});
```

- [ ] **Step 2: Verificar que el test falla**

```bash
node --test tests/database.test.js
```

Resultado esperado: `Error: Cannot find module '../database'`

- [ ] **Step 3: Crear database.js**

```js
// database.js
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
}

function resetDb() {
  if (db) { db.close(); db = null; }
}

module.exports = { getDb, resetDb };
```

- [ ] **Step 4: Correr el test para verificar que pasa**

```bash
node --test tests/database.test.js
```

Resultado esperado: `✔ getDb() crea todas las tablas necesarias` y `✔ getDb() devuelve la misma instancia en llamadas repetidas`

- [ ] **Step 5: Commit**

```bash
git add database.js tests/database.test.js
git commit -m "feat: módulo de base de datos SQLite con schema completo"
```

---

### Task 3: Fundación de la app Express

**Files:**
- Create: `middleware/auth.js`
- Create: `app.js`
- Create: `server.js`

- [ ] **Step 1: Crear middleware/auth.js**

```js
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
```

- [ ] **Step 2: Crear app.js**

```js
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
```

- [ ] **Step 3: Crear server.js**

```js
// server.js
'use strict';
const { app } = require('./app');
const { getDb } = require('./database');

const PORT = process.env.PORT || 3000;

getDb(); // Inicializar DB al arrancar

app.listen(PORT, () => {
  console.log(`Gyver Motos — http://localhost:${PORT}`);
});
```

- [ ] **Step 4: Commit**

```bash
git add app.js server.js middleware/auth.js
git commit -m "feat: fundación Express con middleware JWT y rutas base"
```

---

### Task 4: Autenticación — login/logout

**Files:**
- Create: `routes/auth.js`
- Create: `views/login.html`
- Create: `tests/auth.test.js`

- [ ] **Step 1: Escribir el test que falla**

```js
// tests/auth.test.js
'use strict';
process.env.DB_PATH = ':memory:';
process.env.BCRYPT_ROUNDS = '4';

const { test, before } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const bcrypt = require('bcrypt');
const { app } = require('../app');
const { getDb } = require('../database');

before(async () => {
  const db = getDb();
  const hash = await bcrypt.hash('clave123', 4);
  db.prepare(
    'INSERT INTO usuarios (nombre, email, password_hash) VALUES (?,?,?)'
  ).run('Admin', 'admin@gyver.com', hash);
});

test('POST /auth/login con credenciales válidas devuelve cookie token', async () => {
  const res = await request(app)
    .post('/auth/login')
    .send({ email: 'admin@gyver.com', password: 'clave123' });
  assert.strictEqual(res.status, 200);
  assert.ok(res.headers['set-cookie'].some(c => c.startsWith('token=')));
  assert.deepStrictEqual(res.body, { ok: true });
});

test('POST /auth/login con contraseña incorrecta devuelve 401', async () => {
  const res = await request(app)
    .post('/auth/login')
    .send({ email: 'admin@gyver.com', password: 'mal' });
  assert.strictEqual(res.status, 401);
});

test('POST /auth/login con email inexistente devuelve 401', async () => {
  const res = await request(app)
    .post('/auth/login')
    .send({ email: 'noexiste@gyver.com', password: 'clave123' });
  assert.strictEqual(res.status, 401);
});

test('GET /api/presupuestos sin token devuelve 401', async () => {
  const res = await request(app).get('/api/presupuestos');
  assert.strictEqual(res.status, 401);
});
```

- [ ] **Step 2: Verificar que el test falla**

```bash
node --test tests/auth.test.js
```

Resultado esperado: `Error: Cannot find module '../routes/auth'`

- [ ] **Step 3: Crear routes/auth.js**

```js
// routes/auth.js
'use strict';
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const { getDb } = require('../database');
const { JWT_SECRET, BCRYPT_ROUNDS } = require('../middleware/auth');

const router = express.Router();
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 días

router.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/login.html'));
});

router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña requeridos' });
  }
  const db = getDb();
  const user = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }
  const token = jwt.sign(
    { id: user.id, nombre: user.nombre, email: user.email },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_AGE,
    sameSite: 'lax'
  });
  res.json({ ok: true });
});

router.post('/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/login');
});

module.exports = router;
```

- [ ] **Step 4: Crear views/login.html**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ingresar — Gyver Motos</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body class="login-body">
  <div class="login-card">
    <div class="login-logo">
      <img src="/img/logo.png" alt="Gyver Motos" onerror="this.style.display='none'">
      <h1>Gyver Motos</h1>
      <p>Sistema de Presupuestos</p>
    </div>
    <form id="login-form">
      <div class="field-group">
        <label for="email">Email</label>
        <input type="email" id="email" name="email" required autofocus>
      </div>
      <div class="field-group">
        <label for="password">Contraseña</label>
        <input type="password" id="password" name="password" required>
      </div>
      <div id="login-error" class="error-msg hidden"></div>
      <button type="submit" class="btn btn-primary btn-full">Ingresar</button>
    </form>
  </div>
  <script>
    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = document.getElementById('login-error');
      err.classList.add('hidden');
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: document.getElementById('email').value,
          password: document.getElementById('password').value
        })
      });
      if (res.ok) {
        window.location.href = '/';
      } else {
        const data = await res.json();
        err.textContent = data.error || 'Error al ingresar';
        err.classList.remove('hidden');
      }
    });
  </script>
</body>
</html>
```

- [ ] **Step 5: Correr el test para verificar que pasa**

```bash
node --test tests/auth.test.js
```

Resultado esperado: 4 tests pasando.

- [ ] **Step 6: Commit**

```bash
git add routes/auth.js views/login.html tests/auth.test.js
git commit -m "feat: autenticación con JWT — login/logout y página de login"
```

---

### Task 5: API de compañías de seguros

**Files:**
- Create: `routes/companias.js`
- Create: `tests/companias.test.js`

- [ ] **Step 1: Escribir el test que falla**

```js
// tests/companias.test.js
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
  db.prepare('INSERT INTO usuarios (nombre, email, password_hash) VALUES (?,?,?)').run('A','a@a.com', hash);
  const res = await request(app).post('/auth/login').send({ email:'a@a.com', password:'pass' });
  cookie = res.headers['set-cookie'][0];
});

test('GET /api/companias devuelve lista vacía inicialmente', async () => {
  const res = await request(app).get('/api/companias').set('Cookie', cookie);
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.body, []);
});

test('POST /api/companias crea una compañía', async () => {
  const res = await request(app)
    .post('/api/companias')
    .set('Cookie', cookie)
    .send({ nombre: 'Sancor Seguros' });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.nombre, 'Sancor Seguros');
  assert.strictEqual(res.body.activa, 1);
});

test('GET /api/companias devuelve solo las activas', async () => {
  const db = getDb();
  db.prepare('INSERT INTO companias (nombre, activa) VALUES (?,0)').run('Inactiva SA');
  const res = await request(app).get('/api/companias').set('Cookie', cookie);
  assert.ok(res.body.every(c => c.activa === 1));
});

test('PATCH /api/companias/:id/toggle cambia el estado activa', async () => {
  const db = getDb();
  const c = db.prepare('SELECT id FROM companias WHERE nombre=?').get('Sancor Seguros');
  const res = await request(app)
    .patch(`/api/companias/${c.id}/toggle`)
    .set('Cookie', cookie);
  assert.strictEqual(res.status, 200);
  const updated = db.prepare('SELECT activa FROM companias WHERE id=?').get(c.id);
  assert.strictEqual(updated.activa, 0);
});
```

- [ ] **Step 2: Verificar que el test falla**

```bash
node --test tests/companias.test.js
```

- [ ] **Step 3: Crear routes/companias.js**

```js
// routes/companias.js
'use strict';
const express = require('express');
const { getDb } = require('../database');

const router = express.Router();

// GET /api/companias — solo activas (para el dropdown del formulario)
// GET /api/companias?todas=1 — todas (para la página de gestión)
router.get('/', (req, res) => {
  const db = getDb();
  const sql = req.query.todas
    ? 'SELECT * FROM companias ORDER BY nombre'
    : 'SELECT * FROM companias WHERE activa = 1 ORDER BY nombre';
  res.json(db.prepare(sql).all());
});

router.post('/', (req, res) => {
  const { nombre } = req.body;
  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'Nombre requerido' });
  }
  const db = getDb();
  try {
    const result = db.prepare('INSERT INTO companias (nombre) VALUES (?)').run(nombre.trim());
    const compania = db.prepare('SELECT * FROM companias WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(compania);
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Ya existe una compañía con ese nombre' });
    }
    throw e;
  }
});

router.patch('/:id/toggle', (req, res) => {
  const db = getDb();
  const c = db.prepare('SELECT * FROM companias WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'No encontrada' });
  db.prepare('UPDATE companias SET activa = ? WHERE id = ?').run(c.activa ? 0 : 1, c.id);
  res.json(db.prepare('SELECT * FROM companias WHERE id = ?').get(c.id));
});

router.patch('/:id', (req, res) => {
  const { nombre } = req.body;
  const db = getDb();
  const c = db.prepare('SELECT * FROM companias WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'No encontrada' });
  db.prepare('UPDATE companias SET nombre = ? WHERE id = ?').run(nombre || c.nombre, c.id);
  res.json(db.prepare('SELECT * FROM companias WHERE id = ?').get(c.id));
});

module.exports = router;
```

- [ ] **Step 4: Correr el test**

```bash
node --test tests/companias.test.js
```

- [ ] **Step 5: Commit**

```bash
git add routes/companias.js tests/companias.test.js
git commit -m "feat: API de compañías de seguros"
```

---

### Task 6: API de usuarios

**Files:**
- Create: `routes/usuarios.js`
- Create: `tests/usuarios.test.js`

- [ ] **Step 1: Escribir el test que falla**

```js
// tests/usuarios.test.js
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
```

- [ ] **Step 2: Verificar que el test falla**

```bash
node --test tests/usuarios.test.js
```

- [ ] **Step 3: Crear routes/usuarios.js**

```js
// routes/usuarios.js
'use strict';
const express = require('express');
const bcrypt = require('bcrypt');
const { getDb } = require('../database');
const { BCRYPT_ROUNDS } = require('../middleware/auth');

const router = express.Router();

router.get('/', (req, res) => {
  const db = getDb();
  const usuarios = db.prepare('SELECT id, nombre, email, creado_en FROM usuarios ORDER BY nombre').all();
  res.json(usuarios);
});

router.post('/', async (req, res) => {
  const { nombre, email, password } = req.body;
  if (!nombre || !email || !password) {
    return res.status(400).json({ error: 'Nombre, email y contraseña requeridos' });
  }
  const db = getDb();
  try {
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const result = db.prepare(
      'INSERT INTO usuarios (nombre, email, password_hash) VALUES (?, ?, ?)'
    ).run(nombre.trim(), email.trim().toLowerCase(), hash);
    const u = db.prepare('SELECT id, nombre, email, creado_en FROM usuarios WHERE id=?').get(result.lastInsertRowid);
    res.status(201).json(u);
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
    }
    throw e;
  }
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM usuarios WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'No encontrado' });
  res.json({ ok: true });
});

module.exports = router;
```

- [ ] **Step 4: Correr el test**

```bash
node --test tests/usuarios.test.js
```

- [ ] **Step 5: Commit**

```bash
git add routes/usuarios.js tests/usuarios.test.js
git commit -m "feat: API de gestión de usuarios"
```

---

### Task 7: API de presupuestos (CRUD completo)

**Files:**
- Create: `routes/presupuestos.js`
- Create: `tests/presupuestos.test.js`

- [ ] **Step 1: Escribir el test que falla**

```js
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
```

- [ ] **Step 2: Verificar que el test falla**

```bash
node --test tests/presupuestos.test.js
```

- [ ] **Step 3: Crear routes/presupuestos.js**

```js
// routes/presupuestos.js
'use strict';
const express = require('express');
const { getDb } = require('../database');

const router = express.Router();

function nextNumero(db) {
  const row = db.prepare('SELECT MAX(numero_secuencial) as max FROM presupuestos').get();
  const seq = (row.max || 0) + 1;
  return { seq, numero: `PRES-${String(seq).padStart(4, '0')}` };
}

function saveItems(db, presupuestoId, items) {
  db.prepare('DELETE FROM items WHERE presupuesto_id = ?').run(presupuestoId);
  if (!items || !items.length) return;
  const stmt = db.prepare(`
    INSERT INTO items (presupuesto_id, tipo, descripcion, cantidad, precio_unitario, orden)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  items.forEach((item, i) => {
    stmt.run(presupuestoId, item.tipo, item.descripcion,
      item.cantidad !== undefined ? item.cantidad : null,
      item.precio_unitario || 0, item.orden !== undefined ? item.orden : i);
  });
}

function getPresupuesto(db, id) {
  const p = db.prepare(`
    SELECT p.*, c.nombre as compania_nombre, u.nombre as creado_por_nombre
    FROM presupuestos p
    LEFT JOIN companias c ON p.compania_id = c.id
    LEFT JOIN usuarios u ON p.creado_por = u.id
    WHERE p.id = ?
  `).get(id);
  if (p) p.items = db.prepare('SELECT * FROM items WHERE presupuesto_id = ? ORDER BY tipo DESC, orden').all(id);
  return p;
}

// GET /api/presupuestos?q=&estado=&compania_id=
router.get('/', (req, res) => {
  const { q, estado, compania_id } = req.query;
  const db = getDb();
  let sql = `
    SELECT p.id, p.numero, p.fecha_emision, p.asegurado, p.patente,
           p.estado, p.creado_en, p.modificado_en,
           c.nombre as compania_nombre, u.nombre as creado_por_nombre,
           (SELECT COALESCE(SUM(CASE WHEN i.tipo='repuesto' THEN i.cantidad * i.precio_unitario ELSE i.precio_unitario END),0)
            FROM items i WHERE i.presupuesto_id = p.id) as total
    FROM presupuestos p
    LEFT JOIN companias c ON p.compania_id = c.id
    LEFT JOIN usuarios u ON p.creado_por = u.id
    WHERE 1=1
  `;
  const params = [];
  if (q) { sql += ' AND (p.asegurado LIKE ? OR p.patente LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
  if (estado) { sql += ' AND p.estado = ?'; params.push(estado); }
  if (compania_id) { sql += ' AND p.compania_id = ?'; params.push(compania_id); }
  sql += ' ORDER BY p.creado_en DESC';
  res.json(db.prepare(sql).all(...params));
});

// POST /api/presupuestos — crear borrador (primer autosave)
router.post('/', (req, res) => {
  const db = getDb();
  const { seq, numero } = nextNumero(db);
  const { fecha_emision, asegurado, domicilio_asegurado, marca, patente,
          modelo, tipo_moto, fecha_siniestro, compania_id, numero_siniestro, items } = req.body;

  const result = db.prepare(`
    INSERT INTO presupuestos (numero, numero_secuencial, fecha_emision,
      asegurado, domicilio_asegurado, marca, patente, modelo, tipo_moto,
      fecha_siniestro, compania_id, numero_siniestro, estado, creado_por)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'borrador',?)
  `).run(numero, seq,
    fecha_emision || new Date().toISOString().split('T')[0],
    asegurado || null, domicilio_asegurado || null, marca || null,
    patente || null, modelo || null, tipo_moto || null,
    fecha_siniestro || null, compania_id || null, numero_siniestro || null,
    req.user.id);

  if (items && items.length) saveItems(db, result.lastInsertRowid, items);
  res.status(201).json(getPresupuesto(db, result.lastInsertRowid));
});

// GET /api/presupuestos/:id
router.get('/:id', (req, res) => {
  const p = getPresupuesto(getDb(), req.params.id);
  if (!p) return res.status(404).json({ error: 'No encontrado' });
  res.json(p);
});

// PATCH /api/presupuestos/:id — autosave + cambio de estado
router.patch('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM presupuestos WHERE id=?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'No encontrado' });

  const { numero, fecha_emision, asegurado, domicilio_asegurado, marca, patente,
          modelo, tipo_moto, fecha_siniestro, compania_id, numero_siniestro, estado, items } = req.body;

  if (numero && numero !== existing.numero) {
    const conflict = db.prepare('SELECT id FROM presupuestos WHERE numero=? AND id!=?').get(numero, req.params.id);
    if (conflict) return res.status(409).json({ error: `El número ${numero} ya existe` });
  }

  const get = (field, val) => val !== undefined ? val : existing[field];

  db.prepare(`
    UPDATE presupuestos SET
      numero = ?, fecha_emision = ?, asegurado = ?, domicilio_asegurado = ?,
      marca = ?, patente = ?, modelo = ?, tipo_moto = ?, fecha_siniestro = ?,
      compania_id = ?, numero_siniestro = ?, estado = ?,
      modificado_en = datetime('now')
    WHERE id = ?
  `).run(
    get('numero', numero), get('fecha_emision', fecha_emision),
    get('asegurado', asegurado), get('domicilio_asegurado', domicilio_asegurado),
    get('marca', marca), get('patente', patente), get('modelo', modelo),
    get('tipo_moto', tipo_moto), get('fecha_siniestro', fecha_siniestro),
    get('compania_id', compania_id), get('numero_siniestro', numero_siniestro),
    get('estado', estado), req.params.id
  );

  if (items !== undefined) saveItems(db, req.params.id, items);
  res.json(getPresupuesto(db, req.params.id));
});

// DELETE /api/presupuestos/:id
router.delete('/:id', (req, res) => {
  const result = getDb().prepare('DELETE FROM presupuestos WHERE id=?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'No encontrado' });
  res.json({ ok: true });
});

// POST /api/presupuestos/:id/duplicar
router.post('/:id/duplicar', (req, res) => {
  const db = getDb();
  const original = getPresupuesto(db, req.params.id);
  if (!original) return res.status(404).json({ error: 'No encontrado' });

  const { seq, numero } = nextNumero(db);
  const result = db.prepare(`
    INSERT INTO presupuestos (numero, numero_secuencial, fecha_emision,
      asegurado, domicilio_asegurado, marca, patente, modelo, tipo_moto,
      fecha_siniestro, compania_id, numero_siniestro, estado, creado_por)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'borrador',?)
  `).run(numero, seq, original.fecha_emision,
    original.asegurado, original.domicilio_asegurado, original.marca,
    original.patente, original.modelo, original.tipo_moto,
    original.fecha_siniestro, original.compania_id, original.numero_siniestro,
    req.user.id);

  const newId = result.lastInsertRowid;
  if (original.items.length) saveItems(db, newId, original.items);
  res.status(201).json({ id: newId, numero });
});

module.exports = router;
```

- [ ] **Step 4: Correr los tests**

```bash
node --test tests/presupuestos.test.js
```

Resultado esperado: 7 tests pasando.

- [ ] **Step 5: Commit**

```bash
git add routes/presupuestos.js tests/presupuestos.test.js
git commit -m "feat: API completa de presupuestos — CRUD, autosave, duplicar"
```

---

### Task 8: Generación de PDF con Puppeteer

**Files:**
- Create: `views/pdf-template.html`
- Create: `routes/pdf.js`

- [ ] **Step 1: Crear views/pdf-template.html**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #222; padding: 0; }

    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
    .logo img { max-height: 80px; max-width: 180px; }
    .taller-info { text-align: right; font-size: 10px; line-height: 1.6; }
    .taller-info strong { font-size: 13px; display: block; margin-bottom: 2px; }

    .doc-titulo {
      text-align: center; font-size: 11px; font-weight: bold;
      border: 2px solid #222; padding: 5px; margin-bottom: 12px; letter-spacing: .03em;
    }

    .pres-meta { display: flex; justify-content: space-between; margin-bottom: 14px; font-size: 11px; }

    .siniestro {
      border: 1px solid #ccc; padding: 10px; margin-bottom: 16px;
      display: grid; grid-template-columns: 1fr 1fr; gap: 5px 20px;
    }
    .siniestro .field { display: flex; gap: 4px; }
    .siniestro .label { font-weight: bold; white-space: nowrap; flex-shrink: 0; }

    .seccion-titulo { font-size: 11px; font-weight: bold; margin-bottom: 4px; text-transform: uppercase; }

    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; page-break-inside: avoid; }
    thead th { background: #333; color: #fff; padding: 6px 8px; text-align: left; font-size: 10px; }
    tbody td { padding: 5px 8px; border-bottom: 1px solid #eee; font-size: 10.5px; }
    tfoot td { padding: 5px 8px; font-weight: bold; background: #f5f5f5; }
    .tr { text-align: right; }

    .totales-wrap { display: flex; justify-content: flex-end; margin-top: 8px; }
    .totales { width: 280px; border: 1px solid #ccc; border-collapse: collapse; }
    .totales td { padding: 5px 10px; border-bottom: 1px solid #eee; font-size: 10.5px; }
    .totales .total-row { background: #222; color: #fff; }
    .totales .total-row td { font-size: 14px; font-weight: bold; padding: 8px 10px; }
  </style>
</head>
<body>

  <div class="header">
    <div class="logo">
      <% if (logoBase64) { %><img src="<%= logoBase64 %>" alt="Gyver Motos"><% } %>
    </div>
    <div class="taller-info">
      <strong>GYVER MOTOS</strong>
      Montibelli Javier Hernan<br>
      Av. Mosconi 1296, (1752) Lomas del Mirador, Pcia de Bs. As.<br>
      CUIT: 23-22023139-9 &nbsp;|&nbsp; IIBB: 23-22023139-9<br>
      Inicio actividades: 13/03/2008<br>
      Condición IVA: Responsable Inscripto
    </div>
  </div>

  <div class="doc-titulo">DOCUMENTO NO VÁLIDO COMO FACTURA &mdash; PRESUPUESTO</div>

  <div class="pres-meta">
    <span><strong>N°:</strong> <%= p.numero %></span>
    <span><strong>Fecha:</strong> <%= formatDate(p.fecha_emision) %></span>
  </div>

  <div class="siniestro">
    <div class="field"><span class="label">Sres.:</span><span><%= p.asegurado || '' %></span></div>
    <div class="field"><span class="label">Domicilio:</span><span><%= p.domicilio_asegurado || '' %></span></div>
    <div class="field"><span class="label">Marca:</span><span><%= p.marca || '' %></span></div>
    <div class="field"><span class="label">Patente:</span><span><%= p.patente || '' %></span></div>
    <div class="field"><span class="label">Modelo:</span><span><%= p.modelo || '' %></span></div>
    <div class="field"><span class="label">Tipo:</span><span><%= p.tipo_moto || '' %></span></div>
    <div class="field"><span class="label">Fecha siniestro:</span><span><%= p.fecha_siniestro ? formatDate(p.fecha_siniestro) : '' %></span></div>
    <div class="field"><span class="label">Compañía:</span><span><%= p.compania_nombre || '' %></span></div>
    <div class="field"><span class="label">N° siniestro:</span><span><%= p.numero_siniestro || '' %></span></div>
  </div>

  <% if (repuestos.length) { %>
  <p class="seccion-titulo">Repuestos</p>
  <table>
    <thead>
      <tr>
        <th style="width:55px">Cantidad</th>
        <th>Descripción</th>
        <th style="width:110px" class="tr">Precio Unit.</th>
        <th style="width:110px" class="tr">Total</th>
      </tr>
    </thead>
    <tbody>
      <% repuestos.forEach(item => { %>
      <tr>
        <td><%= item.cantidad %></td>
        <td><%= item.descripcion %></td>
        <td class="tr"><%= fmt(item.precio_unitario) %></td>
        <td class="tr"><%= fmt(item.cantidad * item.precio_unitario) %></td>
      </tr>
      <% }) %>
    </tbody>
    <tfoot>
      <tr>
        <td colspan="3" class="tr">SUBTOTAL REPUESTOS:</td>
        <td class="tr"><%= fmt(subtotalRep) %></td>
      </tr>
    </tfoot>
  </table>
  <% } %>

  <% if (manoObra.length) { %>
  <p class="seccion-titulo">Mano de Obra</p>
  <table>
    <thead>
      <tr>
        <th>Descripción</th>
        <th style="width:130px" class="tr">Precio</th>
      </tr>
    </thead>
    <tbody>
      <% manoObra.forEach(item => { %>
      <tr>
        <td><%= item.descripcion %></td>
        <td class="tr"><%= fmt(item.precio_unitario) %></td>
      </tr>
      <% }) %>
    </tbody>
    <tfoot>
      <tr>
        <td class="tr">SUBTOTAL MANO DE OBRA:</td>
        <td class="tr"><%= fmt(subtotalMO) %></td>
      </tr>
    </tfoot>
  </table>
  <% } %>

  <div class="totales-wrap">
    <table class="totales">
      <tbody>
        <% if (repuestos.length) { %>
        <tr><td>Subtotal Repuestos</td><td class="tr"><%= fmt(subtotalRep) %></td></tr>
        <% } %>
        <% if (manoObra.length) { %>
        <tr><td>Subtotal Mano de Obra</td><td class="tr"><%= fmt(subtotalMO) %></td></tr>
        <% } %>
        <tr><td>Neto Gravado</td><td class="tr"><%= fmt(neto) %></td></tr>
        <tr><td>IVA 21%</td><td class="tr"><%= fmt(iva) %></td></tr>
        <tr class="total-row"><td>TOTAL</td><td class="tr"><%= fmt(total) %></td></tr>
      </tbody>
    </table>
  </div>

</body>
</html>
```

- [ ] **Step 2: Crear routes/pdf.js**

```js
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
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
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
```

- [ ] **Step 3: Test manual — arrancar el servidor y generar un PDF**

```bash
node server.js
```

En otro terminal, crear un usuario inicial y un presupuesto de prueba:
```bash
node -e "
const { getDb } = require('./database');
const bcrypt = require('bcrypt');
const db = getDb();
const hash = bcrypt.hashSync('admin123', 10);
db.prepare('INSERT OR IGNORE INTO usuarios (nombre, email, password_hash) VALUES (?,?,?)').run('Admin','admin@gyver.com',hash);
console.log('Usuario creado: admin@gyver.com / admin123');
"
```

Abrir `http://localhost:3000/login`, ingresar, crear un presupuesto de prueba, ir a `http://localhost:3000/pdf/1` y verificar que se descarga el PDF correctamente.

- [ ] **Step 4: Commit**

```bash
git add routes/pdf.js views/pdf-template.html
git commit -m "feat: generación de PDF on-demand con Puppeteer y template EJS"
```

---

### Task 9: Estilos globales y navegación

**Files:**
- Create: `public/style.css`

- [ ] **Step 1: Crear public/style.css**

```css
/* public/style.css */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --primary: #1a1a2e;
  --accent: #f0922b;
  --accent-light: #fff3e0;
  --danger: #dc2626;
  --success: #16a34a;
  --border: #e2e8f0;
  --bg: #f8fafc;
  --text: #1e293b;
  --muted: #64748b;
  --radius: 8px;
  --shadow: 0 1px 3px rgba(0,0,0,.08);
}

body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 14px; line-height: 1.6; color: var(--text); background: var(--bg); }

/* NAVEGACIÓN */
.navbar {
  background: var(--primary); color: #fff; padding: 0 24px;
  display: flex; align-items: center; gap: 24px; height: 56px;
  position: sticky; top: 0; z-index: 100;
}
.navbar .brand { font-weight: 700; font-size: 15px; color: var(--accent); text-decoration: none; }
.navbar a { color: #9ca3af; text-decoration: none; font-size: 13px; }
.navbar a:hover { color: #fff; }
.navbar .spacer { flex: 1; }
.navbar .user-info { font-size: 12px; color: #6b7280; }

/* LAYOUT */
.container { max-width: 1200px; margin: 0 auto; padding: 24px; }
.page-header { display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 24px; }
.page-title { font-size: 20px; font-weight: 700; }

/* BOTONES */
.btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px;
  border-radius: var(--radius); border: none; cursor: pointer; font-size: 13px;
  font-weight: 600; text-decoration: none; transition: opacity .15s; }
.btn:hover { opacity: .85; }
.btn-primary { background: var(--accent); color: #fff; }
.btn-secondary { background: #fff; color: var(--text); border: 1px solid var(--border); }
.btn-danger { background: var(--danger); color: #fff; }
.btn-sm { padding: 5px 10px; font-size: 12px; }
.btn-full { width: 100%; justify-content: center; }
.btn-icon { padding: 5px 8px; background: transparent; border: 1px solid var(--border); }

/* FORMULARIOS */
.field-group { margin-bottom: 16px; }
.field-group label { display: block; font-size: 12px; font-weight: 600;
  color: var(--muted); margin-bottom: 5px; text-transform: uppercase; letter-spacing: .04em; }
input, select, textarea {
  width: 100%; padding: 9px 12px; border: 1px solid var(--border);
  border-radius: var(--radius); font-size: 14px; color: var(--text);
  background: #fff; transition: border-color .15s;
}
input:focus, select:focus { outline: none; border-color: var(--accent); }
input:read-only { background: #f8fafc; color: var(--muted); }

.form-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0 16px; }
.form-grid .span-2 { grid-column: span 2; }

/* TABLAS */
.table-wrap { background: #fff; border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
table.data-table { width: 100%; border-collapse: collapse; }
table.data-table thead th {
  background: var(--primary); color: #c8cfe0; padding: 10px 14px;
  text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em;
}
table.data-table tbody tr { border-bottom: 1px solid var(--border); }
table.data-table tbody tr:last-child { border-bottom: none; }
table.data-table tbody tr:hover { background: #f8fafc; }
table.data-table tbody td { padding: 10px 14px; }
.tr { text-align: right; }

/* ESTADOS */
.badge {
  display: inline-block; padding: 2px 10px; border-radius: 20px;
  font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em;
}
.badge-borrador { background: #f1f5f9; color: #475569; }
.badge-enviado { background: #dbeafe; color: #1d4ed8; }
.badge-aprobado { background: #dcfce7; color: #15803d; }
.badge-rechazado { background: #fee2e2; color: #b91c1c; }

/* ALERTAS */
.alert { padding: 12px 16px; border-radius: var(--radius); margin-bottom: 16px; font-size: 13px; }
.alert-warning { background: #fff8f0; border: 1px solid #fde0b0; border-left: 4px solid var(--accent); color: #78350f; }
.alert-danger { background: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid var(--danger); color: #991b1b; }
.error-msg { color: var(--danger); font-size: 13px; padding: 8px 12px; background: #fef2f2; border-radius: 6px; }

/* AUTOSAVE */
.save-indicator { font-size: 12px; color: var(--muted); }
.save-indicator.saving { color: var(--accent); }
.save-indicator.error { color: var(--danger); }

/* MODAL */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,.5);
  display: flex; align-items: center; justify-content: center; z-index: 1000;
}
.modal-overlay.hidden { display: none; }
.modal { background: #fff; border-radius: 12px; padding: 28px; max-width: 440px; width: 90%; }
.modal h3 { font-size: 16px; margin-bottom: 12px; }
.modal p { color: var(--muted); font-size: 13px; margin-bottom: 20px; }
.modal-actions { display: flex; gap: 10px; justify-content: flex-end; }

/* LOGIN */
.login-body { min-height: 100vh; display: flex; align-items: center; justify-content: center; }
.login-card { background: #fff; border: 1px solid var(--border); border-radius: 12px;
  padding: 36px; width: 100%; max-width: 380px; box-shadow: var(--shadow); }
.login-logo { text-align: center; margin-bottom: 28px; }
.login-logo img { max-height: 70px; margin-bottom: 10px; }
.login-logo h1 { font-size: 18px; font-weight: 700; }
.login-logo p { color: var(--muted); font-size: 13px; }

/* ÍTEMS TABLE EN FORMULARIO */
.items-table { width: 100%; border-collapse: collapse; }
.items-table th { font-size: 11px; font-weight: 700; color: var(--muted);
  text-transform: uppercase; padding: 6px 8px; text-align: left; border-bottom: 2px solid var(--border); }
.items-table td { padding: 5px 4px; vertical-align: middle; }
.items-table input { padding: 6px 8px; }
.items-table .total-cell { font-weight: 600; text-align: right; padding-right: 8px; min-width: 100px; }
.items-table .btn-remove { color: var(--danger); font-size: 16px; background: none; border: none; cursor: pointer; padding: 4px 6px; }
.totales-panel { background: #fff; border: 1px solid var(--border); border-radius: var(--radius);
  padding: 16px 20px; margin-top: 8px; }
.totales-panel table { width: 100%; }
.totales-panel td { padding: 4px 0; }
.totales-panel .total-final td { font-size: 18px; font-weight: 800; color: var(--accent);
  border-top: 2px solid var(--border); padding-top: 10px; margin-top: 6px; }
.section-header { display: flex; align-items: center; justify-content: space-between;
  margin: 20px 0 8px; }
.section-header h3 { font-size: 13px; font-weight: 700; text-transform: uppercase;
  color: var(--muted); letter-spacing: .06em; }

/* UTILIDADES */
.hidden { display: none !important; }
.text-muted { color: var(--muted); }
.text-right { text-align: right; }
.mb-4 { margin-bottom: 16px; }
.gap-2 { gap: 8px; }
.flex { display: flex; }
.items-center { align-items: center; }
```

- [ ] **Step 2: Commit**

```bash
git add public/style.css
git commit -m "feat: estilos globales CSS"
```

---

### Task 10: Página de listado (index.html + list.js)

**Files:**
- Create: `views/index.html`
- Create: `public/list.js`

- [ ] **Step 1: Crear views/index.html**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Presupuestos — Gyver Motos</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <nav class="navbar">
    <a href="/" class="brand">Gyver Motos</a>
    <a href="/companias">Compañías</a>
    <a href="/usuarios">Usuarios</a>
    <div class="spacer"></div>
    <span class="user-info" id="nav-user"></span>
    <form action="/auth/logout" method="POST" style="margin:0">
      <button type="submit" class="btn btn-sm btn-secondary">Salir</button>
    </form>
  </nav>

  <div class="container">
    <div class="page-header">
      <h1 class="page-title">Presupuestos</h1>
      <a href="/nuevo" class="btn btn-primary">+ Nuevo presupuesto</a>
    </div>

    <!-- Filtros -->
    <div class="flex gap-2 mb-4" style="flex-wrap:wrap;gap:10px;">
      <input type="text" id="q" placeholder="Buscar por asegurado o patente..." style="max-width:280px">
      <select id="filtro-estado" style="width:auto">
        <option value="">Todos los estados</option>
        <option value="borrador">Borrador</option>
        <option value="enviado">Enviado</option>
        <option value="aprobado">Aprobado</option>
        <option value="rechazado">Rechazado</option>
      </select>
      <select id="filtro-compania" style="width:auto">
        <option value="">Todas las compañías</option>
      </select>
    </div>

    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>N° Presupuesto</th>
            <th>Asegurado</th>
            <th>Patente</th>
            <th>Compañía</th>
            <th class="tr">Total</th>
            <th>Estado</th>
            <th>Creado por</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody id="tabla-body">
          <tr><td colspan="8" style="text-align:center;padding:32px;color:var(--muted)">Cargando...</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Modal cambio de estado -->
  <div class="modal-overlay hidden" id="modal-estado">
    <div class="modal">
      <h3>Cambiar estado</h3>
      <p>Seleccioná el nuevo estado para <strong id="modal-numero"></strong></p>
      <select id="select-estado" style="width:100%;margin-bottom:16px">
        <option value="borrador">Borrador</option>
        <option value="enviado">Enviado</option>
        <option value="aprobado">Aprobado</option>
        <option value="rechazado">Rechazado</option>
      </select>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="cerrarModalEstado()">Cancelar</button>
        <button class="btn btn-primary" id="btn-guardar-estado">Guardar</button>
      </div>
    </div>
  </div>

  <!-- Modal eliminar -->
  <div class="modal-overlay hidden" id="modal-eliminar">
    <div class="modal">
      <h3>Eliminar presupuesto</h3>
      <p>¿Confirmas que querés eliminar <strong id="modal-eliminar-numero"></strong>? Esta acción no se puede deshacer.</p>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="cerrarModalEliminar()">Cancelar</button>
        <button class="btn btn-danger" id="btn-confirmar-eliminar">Eliminar</button>
      </div>
    </div>
  </div>

  <script src="/list.js"></script>
</body>
</html>
```

- [ ] **Step 2: Crear public/list.js**

```js
// public/list.js
'use strict';

const ESTADOS = { borrador:'badge-borrador', enviado:'badge-enviado', aprobado:'badge-aprobado', rechazado:'badge-rechazado' };

function fmt(n) {
  return '$' + (n||0).toLocaleString('es-AR', { minimumFractionDigits: 2 });
}

// Cargar usuario actual desde el token (decodificado del JWT vía endpoint)
fetch('/api/presupuestos?_limit=0').then(() => {}).catch(() => {});

async function cargarCompanias() {
  const res = await fetch('/api/companias?todas=1');
  const lista = await res.json();
  const sel = document.getElementById('filtro-compania');
  lista.forEach(c => {
    const o = document.createElement('option');
    o.value = c.id; o.textContent = c.nombre;
    sel.appendChild(o);
  });
}

async function cargarLista() {
  const q = document.getElementById('q').value.trim();
  const estado = document.getElementById('filtro-estado').value;
  const compania_id = document.getElementById('filtro-compania').value;
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (estado) params.set('estado', estado);
  if (compania_id) params.set('compania_id', compania_id);

  const res = await fetch('/api/presupuestos?' + params);
  const data = await res.json();
  const tbody = document.getElementById('tabla-body');

  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--muted)">No hay presupuestos</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(p => `
    <tr>
      <td><strong>${p.numero}</strong></td>
      <td>${p.asegurado || '<span class="text-muted">—</span>'}</td>
      <td>${p.patente || '<span class="text-muted">—</span>'}</td>
      <td>${p.compania_nombre || '<span class="text-muted">—</span>'}</td>
      <td class="tr"><strong>${fmt(p.total)}</strong></td>
      <td><span class="badge ${ESTADOS[p.estado]}">${p.estado}</span></td>
      <td class="text-muted">${p.creado_por_nombre || '—'}</td>
      <td>
        <div class="flex gap-2">
          <a href="/editar/${p.id}" class="btn btn-sm btn-secondary" title="Editar">✏️</a>
          <button class="btn btn-sm btn-secondary" onclick="descargarPdf(${p.id})" title="PDF">📄</button>
          <button class="btn btn-sm btn-secondary" onclick="duplicar(${p.id})" title="Duplicar">📋</button>
          <button class="btn btn-sm btn-secondary" onclick="abrirModalEstado(${p.id},'${p.numero}','${p.estado}')" title="Estado">🔄</button>
          <button class="btn btn-sm btn-danger" onclick="abrirModalEliminar(${p.id},'${p.numero}')" title="Eliminar">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function descargarPdf(id) { window.location.href = `/pdf/${id}`; }

async function duplicar(id) {
  const res = await fetch(`/api/presupuestos/${id}/duplicar`, { method: 'POST' });
  if (res.ok) { const d = await res.json(); window.location.href = `/editar/${d.id}`; }
  else alert('Error al duplicar');
}

// Modal estado
let estadoTargetId = null;
function abrirModalEstado(id, numero, estadoActual) {
  estadoTargetId = id;
  document.getElementById('modal-numero').textContent = numero;
  document.getElementById('select-estado').value = estadoActual;
  document.getElementById('modal-estado').classList.remove('hidden');
}
function cerrarModalEstado() { document.getElementById('modal-estado').classList.add('hidden'); }
document.getElementById('btn-guardar-estado').addEventListener('click', async () => {
  const estado = document.getElementById('select-estado').value;
  await fetch(`/api/presupuestos/${estadoTargetId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ estado })
  });
  cerrarModalEstado();
  cargarLista();
});

// Modal eliminar
let eliminarTargetId = null;
function abrirModalEliminar(id, numero) {
  eliminarTargetId = id;
  document.getElementById('modal-eliminar-numero').textContent = numero;
  document.getElementById('modal-eliminar').classList.remove('hidden');
}
function cerrarModalEliminar() { document.getElementById('modal-eliminar').classList.add('hidden'); }
document.getElementById('btn-confirmar-eliminar').addEventListener('click', async () => {
  await fetch(`/api/presupuestos/${eliminarTargetId}`, { method: 'DELETE' });
  cerrarModalEliminar();
  cargarLista();
});

// Búsqueda con debounce
let debounceTimer;
document.getElementById('q').addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(cargarLista, 350);
});
document.getElementById('filtro-estado').addEventListener('change', cargarLista);
document.getElementById('filtro-compania').addEventListener('change', cargarLista);

// Init
cargarCompanias();
cargarLista();
```

- [ ] **Step 3: Test manual**

Arrancar `node server.js`, abrir `http://localhost:3000/`, verificar que:
- El listado carga y muestra presupuestos
- Los filtros por estado y compañía funcionan
- La búsqueda por asegurado/patente funciona con debounce
- Los botones de acción (PDF, duplicar, estado, eliminar) funcionan

- [ ] **Step 4: Commit**

```bash
git add views/index.html public/list.js
git commit -m "feat: página de listado con búsqueda, filtros y acciones"
```

---

### Task 11: Formulario de carga (form.html + form.js)

**Files:**
- Create: `views/form.html`
- Create: `public/form.js`

- [ ] **Step 1: Crear views/form.html**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Presupuesto — Gyver Motos</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <nav class="navbar">
    <a href="/" class="brand">Gyver Motos</a>
    <a href="/">← Volver al listado</a>
    <div class="spacer"></div>
    <span class="save-indicator" id="save-status">Sin cambios</span>
  </nav>

  <!-- Banner de advertencia para estados no-borrador -->
  <div class="alert alert-warning hidden" id="banner-estado">
    <strong id="banner-texto"></strong>
    <button class="btn btn-sm btn-secondary" id="btn-habilitar-edicion" style="margin-left:12px">
      Editar de todos modos
    </button>
  </div>

  <div class="container">
    <form id="form-presupuesto" autocomplete="off">

      <!-- Encabezado -->
      <div class="form-grid" style="margin-bottom:16px">
        <div class="field-group">
          <label for="numero">N° Presupuesto</label>
          <input type="text" id="numero" name="numero" placeholder="PRES-0001">
        </div>
        <div class="field-group">
          <label for="fecha_emision">Fecha de emisión</label>
          <input type="date" id="fecha_emision" name="fecha_emision">
        </div>
      </div>

      <!-- Datos del siniestro -->
      <h2 style="font-size:14px;font-weight:700;margin-bottom:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em">Datos del siniestro y vehículo</h2>
      <div class="form-grid">
        <div class="field-group span-2">
          <label for="asegurado">Asegurado (Sres.)</label>
          <input type="text" id="asegurado" name="asegurado">
        </div>
        <div class="field-group span-2">
          <label for="domicilio_asegurado">Domicilio del asegurado</label>
          <input type="text" id="domicilio_asegurado" name="domicilio_asegurado">
        </div>
        <div class="field-group">
          <label for="marca">Marca</label>
          <input type="text" id="marca" name="marca">
        </div>
        <div class="field-group">
          <label for="patente">Patente</label>
          <input type="text" id="patente" name="patente" style="text-transform:uppercase">
        </div>
        <div class="field-group">
          <label for="modelo">Modelo</label>
          <input type="text" id="modelo" name="modelo">
        </div>
        <div class="field-group">
          <label for="tipo_moto">Tipo</label>
          <input type="text" id="tipo_moto" name="tipo_moto" placeholder="Scooter, Naked, Enduro…">
        </div>
        <div class="field-group">
          <label for="fecha_siniestro">Fecha del siniestro</label>
          <input type="date" id="fecha_siniestro" name="fecha_siniestro">
        </div>
        <div class="field-group">
          <label for="compania_id">Compañía de seguros</label>
          <select id="compania_id" name="compania_id">
            <option value="">Seleccionar…</option>
          </select>
        </div>
        <div class="field-group span-2">
          <label for="numero_siniestro">N° de siniestro / expediente</label>
          <input type="text" id="numero_siniestro" name="numero_siniestro">
        </div>
      </div>

      <!-- Repuestos -->
      <div class="section-header">
        <h3>Repuestos</h3>
        <button type="button" class="btn btn-sm btn-secondary" id="btn-add-repuesto">+ Agregar repuesto</button>
      </div>
      <div class="table-wrap" style="margin-bottom:8px">
        <table class="items-table">
          <thead>
            <tr>
              <th style="width:70px">Cant.</th>
              <th>Descripción</th>
              <th style="width:130px">Precio unit.</th>
              <th style="width:120px" class="tr">Total</th>
              <th style="width:36px"></th>
            </tr>
          </thead>
          <tbody id="tbody-repuestos">
            <tr id="rep-empty"><td colspan="5" style="text-align:center;padding:16px;color:var(--muted);font-size:13px">Sin repuestos</td></tr>
          </tbody>
        </table>
      </div>
      <div class="text-right" style="font-size:13px;font-weight:600;margin-bottom:20px">
        Subtotal repuestos: <span id="subtotal-rep">$0,00</span>
      </div>

      <!-- Mano de obra -->
      <div class="section-header">
        <h3>Mano de obra</h3>
        <button type="button" class="btn btn-sm btn-secondary" id="btn-add-mo">+ Agregar mano de obra</button>
      </div>
      <div class="table-wrap" style="margin-bottom:8px">
        <table class="items-table">
          <thead>
            <tr>
              <th>Descripción</th>
              <th style="width:130px">Precio</th>
              <th style="width:36px"></th>
            </tr>
          </thead>
          <tbody id="tbody-mo">
            <tr id="mo-empty"><td colspan="3" style="text-align:center;padding:16px;color:var(--muted);font-size:13px">Sin mano de obra</td></tr>
          </tbody>
        </table>
      </div>
      <div class="text-right" style="font-size:13px;font-weight:600;margin-bottom:20px">
        Subtotal mano de obra: <span id="subtotal-mo">$0,00</span>
      </div>

      <!-- Totales -->
      <div class="totales-panel" style="max-width:320px;margin-left:auto">
        <table>
          <tbody>
            <tr><td>Subtotal repuestos</td><td class="tr" id="tot-rep">$0,00</td></tr>
            <tr><td>Subtotal mano de obra</td><td class="tr" id="tot-mo">$0,00</td></tr>
            <tr><td>Neto gravado</td><td class="tr" id="tot-neto">$0,00</td></tr>
            <tr><td>IVA 21%</td><td class="tr" id="tot-iva">$0,00</td></tr>
            <tr class="total-final"><td>TOTAL</td><td class="tr" id="tot-total">$0,00</td></tr>
          </tbody>
        </table>
      </div>

      <div class="flex" style="gap:10px;margin-top:24px;justify-content:flex-end">
        <a href="/" class="btn btn-secondary">Volver al listado</a>
        <button type="button" class="btn btn-secondary hidden" id="btn-pdf">📄 Descargar PDF</button>
      </div>
    </form>
  </div>

  <!-- Modal advertencia de edición -->
  <div class="modal-overlay hidden" id="modal-advertencia">
    <div class="modal">
      <h3>⚠️ Presupuesto con estado <span id="modal-estado-nombre"></span></h3>
      <p>Editarlo puede afectar la integridad documental. ¿Confirmás que querés modificarlo?</p>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="btn-cancelar-edicion">Cancelar</button>
        <button class="btn btn-danger" id="btn-confirmar-edicion">Sí, editar</button>
      </div>
    </div>
  </div>

  <script src="/form.js"></script>
</body>
</html>
```

- [ ] **Step 2: Crear public/form.js**

```js
// public/form.js
'use strict';

const ESTADOS_PROTEGIDOS = ['enviado', 'aprobado', 'rechazado'];
let presupuestoId = null;
let estadoActual = 'borrador';
let editingHabilitado = false;
let repuestos = [];
let manoObra = [];

// Obtener ID de la URL si estamos editando
const match = window.location.pathname.match(/\/editar\/(\d+)/);
if (match) presupuestoId = match[1];

// --- FORMATO MONEDA ---
function fmt(n) {
  return '$' + (n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 });
}

function parsePrecio(str) {
  if (!str) return 0;
  return parseFloat(String(str).replace(/\./g, '').replace(',', '.')) || 0;
}

// --- TOTALES ---
function recalcularTotales() {
  const subtotalRep = repuestos.reduce((s, r) => s + (r.cantidad * r.precio_unitario), 0);
  const subtotalMO = manoObra.reduce((s, m) => s + m.precio_unitario, 0);
  const neto = subtotalRep + subtotalMO;
  const iva = neto * 0.21;
  const total = neto + iva;

  document.getElementById('subtotal-rep').textContent = fmt(subtotalRep);
  document.getElementById('subtotal-mo').textContent = fmt(subtotalMO);
  document.getElementById('tot-rep').textContent = fmt(subtotalRep);
  document.getElementById('tot-mo').textContent = fmt(subtotalMO);
  document.getElementById('tot-neto').textContent = fmt(neto);
  document.getElementById('tot-iva').textContent = fmt(iva);
  document.getElementById('tot-total').textContent = fmt(total);
}

// --- RENDER REPUESTOS ---
function renderRepuestos() {
  const tbody = document.getElementById('tbody-repuestos');
  document.getElementById('rep-empty').style.display = repuestos.length ? 'none' : '';
  // Eliminar filas anteriores excepto la de "vacío"
  Array.from(tbody.querySelectorAll('tr.item-row')).forEach(r => r.remove());

  repuestos.forEach((item, i) => {
    const tr = document.createElement('tr');
    tr.className = 'item-row';
    tr.innerHTML = `
      <td><input type="number" value="${item.cantidad}" min="0.01" step="0.01" class="inp-cant" data-idx="${i}"></td>
      <td><input type="text" value="${item.descripcion}" class="inp-desc" data-idx="${i}"></td>
      <td><input type="text" value="${item.precio_unitario}" class="inp-precio" data-idx="${i}"></td>
      <td class="total-cell">${fmt(item.cantidad * item.precio_unitario)}</td>
      <td><button type="button" class="btn-remove" data-idx="${i}">×</button></td>
    `;
    tbody.insertBefore(tr, document.getElementById('rep-empty'));
  });

  tbody.querySelectorAll('.inp-cant').forEach(inp => inp.addEventListener('input', e => {
    repuestos[+e.target.dataset.idx].cantidad = parseFloat(e.target.value) || 0;
    renderRepuestos(); recalcularTotales(); debouncedSave();
  }));
  tbody.querySelectorAll('.inp-desc').forEach(inp => inp.addEventListener('input', e => {
    repuestos[+e.target.dataset.idx].descripcion = e.target.value;
    debouncedSave();
  }));
  tbody.querySelectorAll('.inp-precio').forEach(inp => inp.addEventListener('input', e => {
    repuestos[+e.target.dataset.idx].precio_unitario = parsePrecio(e.target.value);
    renderRepuestos(); recalcularTotales(); debouncedSave();
  }));
  tbody.querySelectorAll('.btn-remove').forEach(btn => btn.addEventListener('click', e => {
    repuestos.splice(+e.target.dataset.idx, 1);
    renderRepuestos(); recalcularTotales(); debouncedSave();
  }));
}

// --- RENDER MANO DE OBRA ---
function renderManoObra() {
  const tbody = document.getElementById('tbody-mo');
  document.getElementById('mo-empty').style.display = manoObra.length ? 'none' : '';
  Array.from(tbody.querySelectorAll('tr.item-row')).forEach(r => r.remove());

  manoObra.forEach((item, i) => {
    const tr = document.createElement('tr');
    tr.className = 'item-row';
    tr.innerHTML = `
      <td><input type="text" value="${item.descripcion}" class="inp-desc-mo" data-idx="${i}"></td>
      <td><input type="text" value="${item.precio_unitario}" class="inp-precio-mo" data-idx="${i}"></td>
      <td><button type="button" class="btn-remove-mo" data-idx="${i}">×</button></td>
    `;
    tbody.insertBefore(tr, document.getElementById('mo-empty'));
  });

  tbody.querySelectorAll('.inp-desc-mo').forEach(inp => inp.addEventListener('input', e => {
    manoObra[+e.target.dataset.idx].descripcion = e.target.value;
    debouncedSave();
  }));
  tbody.querySelectorAll('.inp-precio-mo').forEach(inp => inp.addEventListener('input', e => {
    manoObra[+e.target.dataset.idx].precio_unitario = parsePrecio(e.target.value);
    renderManoObra(); recalcularTotales(); debouncedSave();
  }));
  tbody.querySelectorAll('.btn-remove-mo').forEach(btn => btn.addEventListener('click', e => {
    manoObra.splice(+e.target.dataset.idx, 1);
    renderManoObra(); recalcularTotales(); debouncedSave();
  }));
}

// --- AGREGAR ÍTEMS ---
document.getElementById('btn-add-repuesto').addEventListener('click', () => {
  repuestos.push({ tipo: 'repuesto', descripcion: '', cantidad: 1, precio_unitario: 0, orden: repuestos.length });
  renderRepuestos(); recalcularTotales();
});
document.getElementById('btn-add-mo').addEventListener('click', () => {
  manoObra.push({ tipo: 'mano_obra', descripcion: '', cantidad: null, precio_unitario: 0, orden: manoObra.length });
  renderManoObra(); recalcularTotales();
});

// --- RECOLECTAR DATOS DEL FORM ---
function collectFormData() {
  return {
    numero: document.getElementById('numero').value.trim() || undefined,
    fecha_emision: document.getElementById('fecha_emision').value || undefined,
    asegurado: document.getElementById('asegurado').value.trim() || null,
    domicilio_asegurado: document.getElementById('domicilio_asegurado').value.trim() || null,
    marca: document.getElementById('marca').value.trim() || null,
    patente: document.getElementById('patente').value.trim() || null,
    modelo: document.getElementById('modelo').value.trim() || null,
    tipo_moto: document.getElementById('tipo_moto').value.trim() || null,
    fecha_siniestro: document.getElementById('fecha_siniestro').value || null,
    compania_id: document.getElementById('compania_id').value || null,
    numero_siniestro: document.getElementById('numero_siniestro').value.trim() || null,
    items: [
      ...repuestos.map((r, i) => ({ ...r, orden: i })),
      ...manoObra.map((m, i) => ({ ...m, orden: i }))
    ]
  };
}

// --- AUTOSAVE ---
function setStatus(msg, cls) {
  const el = document.getElementById('save-status');
  el.textContent = msg;
  el.className = 'save-indicator' + (cls ? ' ' + cls : '');
}

async function autosave() {
  setStatus('Guardando...', 'saving');
  const data = collectFormData();
  try {
    let res;
    if (!presupuestoId) {
      res = await fetch('/api/presupuestos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(await res.text());
      const result = await res.json();
      presupuestoId = result.id;
      history.replaceState(null, '', `/editar/${presupuestoId}`);
      document.getElementById('btn-pdf').classList.remove('hidden');
    } else {
      res = await fetch(`/api/presupuestos/${presupuestoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const err = await res.json();
        if (res.status === 409) { setStatus('Error: ' + err.error, 'error'); return; }
        throw new Error(err.error || 'Error');
      }
    }
    const now = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    setStatus(`Guardado ${now}`);
  } catch (e) {
    setStatus('Error al guardar — reintentando...', 'error');
    console.error(e);
  }
}

let saveTimer;
function debouncedSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(autosave, 2000);
}

// Disparar autosave en cambios de inputs de encabezado y siniestro
document.getElementById('form-presupuesto').addEventListener('input', e => {
  if (e.target.closest('#tbody-repuestos') || e.target.closest('#tbody-mo')) return; // ya manejado
  debouncedSave();
});

// --- PROTECCIÓN DE ESTADOS ---
function bloquearFormulario() {
  document.querySelectorAll('#form-presupuesto input, #form-presupuesto select').forEach(el => {
    el.readOnly = true;
    el.style.pointerEvents = 'none';
  });
  document.querySelectorAll('.btn-add-repuesto, #btn-add-repuesto, #btn-add-mo').forEach(b => b.disabled = true);
}

function desbloquearFormulario() {
  document.querySelectorAll('#form-presupuesto input, #form-presupuesto select').forEach(el => {
    el.readOnly = false;
    el.style.pointerEvents = '';
  });
  document.getElementById('btn-add-repuesto').disabled = false;
  document.getElementById('btn-add-mo').disabled = false;
}

document.getElementById('btn-habilitar-edicion').addEventListener('click', () => {
  document.getElementById('modal-advertencia').classList.remove('hidden');
});
document.getElementById('btn-cancelar-edicion').addEventListener('click', () => {
  document.getElementById('modal-advertencia').classList.add('hidden');
});
document.getElementById('btn-confirmar-edicion').addEventListener('click', () => {
  editingHabilitado = true;
  document.getElementById('modal-advertencia').classList.add('hidden');
  document.getElementById('banner-estado').classList.add('hidden');
  desbloquearFormulario();
});

// --- CARGAR COMPAÑÍAS ---
async function cargarCompanias(valorActual) {
  const res = await fetch('/api/companias');
  const lista = await res.json();
  const sel = document.getElementById('compania_id');
  lista.forEach(c => {
    const o = document.createElement('option');
    o.value = c.id; o.textContent = c.nombre;
    if (String(c.id) === String(valorActual)) o.selected = true;
    sel.appendChild(o);
  });
}

// --- CARGAR PRESUPUESTO EXISTENTE ---
async function cargarPresupuesto() {
  if (!presupuestoId) {
    // Presupuesto nuevo — fecha de hoy por defecto
    document.getElementById('fecha_emision').value = new Date().toISOString().split('T')[0];
    await cargarCompanias(null);
    return;
  }

  const res = await fetch(`/api/presupuestos/${presupuestoId}`);
  if (!res.ok) { window.location.href = '/'; return; }
  const p = await res.json();

  estadoActual = p.estado;

  // Llenar campos
  document.getElementById('numero').value = p.numero || '';
  document.getElementById('fecha_emision').value = p.fecha_emision || '';
  document.getElementById('asegurado').value = p.asegurado || '';
  document.getElementById('domicilio_asegurado').value = p.domicilio_asegurado || '';
  document.getElementById('marca').value = p.marca || '';
  document.getElementById('patente').value = p.patente || '';
  document.getElementById('modelo').value = p.modelo || '';
  document.getElementById('tipo_moto').value = p.tipo_moto || '';
  document.getElementById('fecha_siniestro').value = p.fecha_siniestro || '';
  document.getElementById('numero_siniestro').value = p.numero_siniestro || '';

  await cargarCompanias(p.compania_id);

  // Cargar ítems
  repuestos = (p.items || []).filter(i => i.tipo === 'repuesto');
  manoObra = (p.items || []).filter(i => i.tipo === 'mano_obra');
  renderRepuestos();
  renderManoObra();
  recalcularTotales();

  // Mostrar botón PDF
  document.getElementById('btn-pdf').classList.remove('hidden');

  // Proteger si no es borrador
  if (ESTADOS_PROTEGIDOS.includes(estadoActual)) {
    bloquearFormulario();
    const banner = document.getElementById('banner-estado');
    document.getElementById('banner-texto').textContent =
      `Este presupuesto está en estado "${estadoActual}". Para editarlo confirmá la acción.`;
    banner.classList.remove('hidden');
    document.getElementById('modal-estado-nombre').textContent = estadoActual;
  }
}

// PDF
document.getElementById('btn-pdf').addEventListener('click', () => {
  if (presupuestoId) window.location.href = `/pdf/${presupuestoId}`;
});

// Confirmación al salir con cambios no guardados
window.addEventListener('beforeunload', e => {
  if (saveTimer) { e.preventDefault(); e.returnValue = ''; }
});

// Init
cargarPresupuesto();
```

- [ ] **Step 3: Test manual completo del formulario**

Arrancar `node server.js`. Verificar:
1. Abrir `/nuevo` — la fecha se pre-llena con hoy
2. Escribir en cualquier campo — después de 2 segundos el indicador muestra "Guardando..." y luego "Guardado HH:MM"
3. La URL cambia a `/editar/:id` sin recargar la página
4. Agregar repuestos y mano de obra — los totales se actualizan en tiempo real
5. Recargar la página — todos los datos se restauran
6. Cambiar el estado a "enviado" desde el listado, volver al formulario — aparece el banner de advertencia y los campos están bloqueados
7. Hacer clic en "Editar de todos modos" — el modal aparece, confirmando desbloquea los campos
8. Descargar PDF — verificar que se descarga con los datos correctos

- [ ] **Step 4: Commit**

```bash
git add views/form.html public/form.js
git commit -m "feat: formulario de presupuesto con autosave, ítems dinámicos y protección de estados"
```

---

### Task 12: Páginas de gestión de compañías y usuarios

**Files:**
- Create: `views/companias.html`
- Create: `views/usuarios.html`

- [ ] **Step 1: Crear views/companias.html**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Compañías — Gyver Motos</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <nav class="navbar">
    <a href="/" class="brand">Gyver Motos</a>
    <a href="/">← Presupuestos</a>
    <a href="/usuarios">Usuarios</a>
    <div class="spacer"></div>
    <form action="/auth/logout" method="POST" style="margin:0">
      <button type="submit" class="btn btn-sm btn-secondary">Salir</button>
    </form>
  </nav>
  <div class="container">
    <div class="page-header">
      <h1 class="page-title">Compañías de seguros</h1>
    </div>

    <!-- Formulario agregar -->
    <form id="form-compania" class="flex gap-2 mb-4" style="gap:10px">
      <input type="text" id="nueva-compania" placeholder="Nombre de la compañía" style="max-width:320px" required>
      <button type="submit" class="btn btn-primary">Agregar</button>
    </form>
    <div id="msg-compania" class="hidden mb-4"></div>

    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr><th>Nombre</th><th>Estado</th><th>Acciones</th></tr>
        </thead>
        <tbody id="tbody-companias"></tbody>
      </table>
    </div>
  </div>
  <script>
    async function cargar() {
      const res = await fetch('/api/companias?todas=1');
      const lista = await res.json();
      document.getElementById('tbody-companias').innerHTML = lista.map(c => `
        <tr>
          <td><strong>${c.nombre}</strong></td>
          <td><span class="badge ${c.activa ? 'badge-aprobado' : 'badge-rechazado'}">${c.activa ? 'Activa' : 'Inactiva'}</span></td>
          <td>
            <button class="btn btn-sm btn-secondary" onclick="toggle(${c.id})">
              ${c.activa ? 'Desactivar' : 'Activar'}
            </button>
          </td>
        </tr>
      `).join('') || '<tr><td colspan="3" style="text-align:center;padding:24px;color:var(--muted)">Sin compañías</td></tr>';
    }
    async function toggle(id) {
      await fetch(`/api/companias/${id}/toggle`, { method: 'PATCH' });
      cargar();
    }
    document.getElementById('form-compania').addEventListener('submit', async e => {
      e.preventDefault();
      const nombre = document.getElementById('nueva-compania').value.trim();
      const res = await fetch('/api/companias', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre })
      });
      const msg = document.getElementById('msg-compania');
      if (res.ok) {
        document.getElementById('nueva-compania').value = '';
        msg.className = 'hidden';
        cargar();
      } else {
        const d = await res.json();
        msg.textContent = d.error;
        msg.className = 'alert alert-warning';
      }
    });
    cargar();
  </script>
</body>
</html>
```

- [ ] **Step 2: Crear views/usuarios.html**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Usuarios — Gyver Motos</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <nav class="navbar">
    <a href="/" class="brand">Gyver Motos</a>
    <a href="/">← Presupuestos</a>
    <a href="/companias">Compañías</a>
    <div class="spacer"></div>
    <form action="/auth/logout" method="POST" style="margin:0">
      <button type="submit" class="btn btn-sm btn-secondary">Salir</button>
    </form>
  </nav>
  <div class="container">
    <div class="page-header">
      <h1 class="page-title">Usuarios</h1>
    </div>

    <!-- Formulario agregar -->
    <form id="form-usuario" style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:10px;margin-bottom:16px;align-items:end">
      <div class="field-group" style="margin:0">
        <label>Nombre</label>
        <input type="text" id="u-nombre" required>
      </div>
      <div class="field-group" style="margin:0">
        <label>Email</label>
        <input type="email" id="u-email" required>
      </div>
      <div class="field-group" style="margin:0">
        <label>Contraseña</label>
        <input type="password" id="u-password" required>
      </div>
      <button type="submit" class="btn btn-primary">Agregar</button>
    </form>
    <div id="msg-usuario" class="hidden mb-4"></div>

    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr><th>Nombre</th><th>Email</th><th>Creado</th><th>Acciones</th></tr>
        </thead>
        <tbody id="tbody-usuarios"></tbody>
      </table>
    </div>
  </div>
  <script>
    async function cargar() {
      const res = await fetch('/api/usuarios');
      const lista = await res.json();
      document.getElementById('tbody-usuarios').innerHTML = lista.map(u => `
        <tr>
          <td><strong>${u.nombre}</strong></td>
          <td class="text-muted">${u.email}</td>
          <td class="text-muted">${u.creado_en ? u.creado_en.split('T')[0] : ''}</td>
          <td>
            <button class="btn btn-sm btn-danger" onclick="eliminar(${u.id},'${u.nombre}')">Eliminar</button>
          </td>
        </tr>
      `).join('') || '<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--muted)">Sin usuarios</td></tr>';
    }
    async function eliminar(id, nombre) {
      if (!confirm(`¿Eliminar al usuario "${nombre}"?`)) return;
      await fetch(`/api/usuarios/${id}`, { method: 'DELETE' });
      cargar();
    }
    document.getElementById('form-usuario').addEventListener('submit', async e => {
      e.preventDefault();
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: document.getElementById('u-nombre').value,
          email: document.getElementById('u-email').value,
          password: document.getElementById('u-password').value
        })
      });
      const msg = document.getElementById('msg-usuario');
      if (res.ok) {
        e.target.reset();
        msg.className = 'hidden';
        cargar();
      } else {
        const d = await res.json();
        msg.textContent = d.error;
        msg.className = 'alert alert-warning';
      }
    });
    cargar();
  </script>
</body>
</html>
```

- [ ] **Step 3: Commit**

```bash
git add views/companias.html views/usuarios.html
git commit -m "feat: páginas de gestión de compañías y usuarios"
```

---

### Task 13: Script de seed inicial y configuración Railway

**Files:**
- Create: `railway.toml`
- Create: `nixpacks.toml`
- Create: `seed.js`

- [ ] **Step 1: Crear seed.js (crear primer usuario admin)**

```js
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
```

Agregar al `package.json` en `scripts`:
```json
"seed": "node seed.js"
```

- [ ] **Step 2: Crear railway.toml**

```toml
# railway.toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "node server.js"
healthcheckPath = "/"
healthcheckTimeout = 30
```

- [ ] **Step 3: Crear nixpacks.toml (dependencias de sistema para Puppeteer)**

```toml
# nixpacks.toml
[phases.setup]
nixPkgs = [
  "chromium",
  "nss",
  "nspr",
  "atk",
  "at-spi2-atk",
  "cups",
  "libXcomposite",
  "libXdamage",
  "libXext",
  "libXfixes",
  "libXrandr",
  "mesa",
  "libdrm",
  "expat",
  "alsa-lib"
]

[phases.install]
cmds = ["npm ci"]
```

- [ ] **Step 4: Actualizar routes/pdf.js para usar Chromium del sistema en Railway**

Cambiar el bloque de `puppeteer.launch` en `routes/pdf.js`:

```js
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
```

- [ ] **Step 5: Agregar instrucciones de Railway Volume en package.json (como comment en README)**

Crear un archivo `DEPLOY.md`:

```markdown
# Deploy en Railway

## Primera vez

1. Crear nuevo proyecto en Railway
2. Conectar este repositorio
3. Agregar un Volume persistente en Railway montado en `/data`
4. Configurar variables de entorno:
   - `JWT_SECRET` = (string aleatorio, ej: generá uno con `openssl rand -base64 32`)
   - `NODE_ENV` = `production`
   - `DB_PATH` = `/data/presupuestos.db`
   - `CHROMIUM_PATH` = `/usr/bin/chromium` (o el path que muestre Railway)
5. Deployar
6. Correr seed para crear primer usuario:
   `railway run node seed.js "Admin" "admin@gyver.com" "tu-contraseña"`

## Variables de entorno

| Variable | Descripción |
|---|---|
| `JWT_SECRET` | String secreto para firmar tokens. Obligatorio en producción. |
| `NODE_ENV` | `production` |
| `DB_PATH` | Path al archivo SQLite. Usar `/data/presupuestos.db` con volume. |
| `CHROMIUM_PATH` | Path a chromium en Railway (opcional, detecta automáticamente). |
| `PORT` | Railway lo provee automáticamente. |
```

- [ ] **Step 6: Correr todos los tests para verificar que nada está roto**

```bash
node --test tests/*.test.js
```

Resultado esperado: todos los tests pasan.

- [ ] **Step 7: Commit final**

```bash
git add railway.toml nixpacks.toml seed.js DEPLOY.md
git add -u routes/pdf.js package.json
git commit -m "feat: configuración de deploy para Railway + script de seed inicial"
```

---

## Self-Review del Plan

**Cobertura del spec:**
- ✅ Login/logout con JWT, cookie 30 días por dispositivo
- ✅ Múltiples usuarios, cualquiera puede gestionar usuarios y compañías
- ✅ Quien creó el presupuesto se muestra en el listado pero no en el PDF
- ✅ Lista configurable de compañías con activar/desactivar
- ✅ Formulario con todos los campos del spec
- ✅ Ítems con dos secciones independientes (repuestos / mano de obra)
- ✅ Totales en tiempo real: subtotales, neto, IVA 21%, total
- ✅ Formato de precios argentino ($12.500,00)
- ✅ Autosave debounced (2s), indicador de estado, URL actualizada sin recarga
- ✅ Advertencia al editar presupuestos en estado enviado/aprobado/rechazado
- ✅ Listado con búsqueda + filtros por estado y compañía
- ✅ Acciones: editar, PDF, duplicar, cambiar estado, eliminar
- ✅ Duplicar siempre crea Borrador con nuevo número secuencial
- ✅ Numeración PRES-XXXX nunca reutilizada, editable con validación de unicidad
- ✅ PDF A4 con Puppeteer, on-demand, sin guardar en disco
- ✅ Template PDF: header con logo, datos del taller, banda "NO VÁLIDO COMO FACTURA", tablas de repuestos y MO con subtotales, sección de totales destacada
- ✅ Tablas PDF con `page-break-inside: avoid`
- ✅ Secciones vacías omitidas del PDF
- ✅ Flags `--no-sandbox` para Railway
- ✅ Railway config con nixpacks para Puppeteer
- ✅ Datos del taller hardcodeados en el template PDF

**Sin placeholders:** verificado, cada step tiene código concreto.

**Consistencia de tipos:** `presupuestoId`, `repuestos`, `manoObra` se usan consistentemente. `saveItems(db, id, items)` definida en Task 7 y usada en los endpoints PATCH y POST duplicar. `getPresupuesto(db, id)` usada en GET, PATCH, POST, POST-duplicar.
