# Sistema de Presupuestos — Gyver Motos

**Fecha:** 2026-06-09  
**Proyecto:** Sistema web para generación de presupuestos con validez legal ante compañías de seguros  
**Ubicación:** `C:\Users\Gyver\Desktop\Proyectos Claude\- SISTEMA PRESUPUESTO SEGURO`

---

## Objetivo

Reemplazar el proceso manual de completar hojas impresas con birome por un sistema web que permita cargar, guardar, gestionar y generar PDFs de presupuestos para presentar ante compañías de seguros.

---

## Stack tecnológico

- **Backend:** Node.js + Express
- **Frontend:** HTML/CSS/JS vanilla
- **PDF:** Puppeteer (generación server-side, on-demand, sin guardar en disco)
- **Base de datos:** SQLite con `better-sqlite3`
- **Sesiones:** `express-session` + `better-sqlite3-session-store`, cookie httpOnly con persistencia de 30 días por dispositivo
- **Deploy:** Railway (`--no-sandbox`, `--disable-setuid-sandbox` en Puppeteer)

---

## Datos fijos del taller (hardcodeados en el template PDF)

| Campo | Valor |
|---|---|
| Nombre | Gyver Motos |
| Titular | Montibelli Javier Hernan |
| Dirección | Av. Mosconi 1296, (1752) Lomas del Mirador, Pcia de Bs. As. |
| CUIT | 23-22023139-9 |
| Ingresos Brutos | 23-22023139-9 |
| Inicio de actividades | 13/03/2008 |
| Condición IVA | Responsable Inscripto |
| Logo | `/public/img/logo.png` |

---

## Estructura de archivos

```
/
├── server.js
├── database.js
├── middleware/
│   └── auth.js
├── routes/
│   ├── auth.js
│   ├── presupuestos.js
│   ├── companias.js
│   ├── usuarios.js
│   └── pdf.js
├── views/
│   ├── login.html
│   ├── index.html
│   ├── form.html
│   └── pdf-template.html
├── public/
│   ├── style.css
│   ├── form.js
│   ├── list.js
│   └── img/
│       └── logo.png
├── package.json
└── railway.toml
```

---

## Base de datos

### Tabla `usuarios`
| Campo | Tipo | Notas |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| nombre | TEXT NOT NULL | |
| email | TEXT UNIQUE NOT NULL | |
| password_hash | TEXT NOT NULL | bcrypt |
| creado_en | TEXT NOT NULL | ISO 8601 |

### Tabla `companias`
| Campo | Tipo | Notas |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| nombre | TEXT UNIQUE NOT NULL | |
| activa | INTEGER NOT NULL DEFAULT 1 | 0/1 |

### Tabla `presupuestos`
| Campo | Tipo | Notas |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| numero | TEXT UNIQUE NOT NULL | formato PRES-0001, editable |
| numero_secuencial | INTEGER NOT NULL | autoincrement nunca reutilizado |
| fecha_emision | TEXT NOT NULL | |
| asegurado | TEXT | |
| domicilio_asegurado | TEXT | |
| marca | TEXT | |
| patente | TEXT | |
| modelo | TEXT | |
| tipo_moto | TEXT | Scooter, Enduro, Naked, etc. |
| fecha_siniestro | TEXT | |
| compania_id | INTEGER FK companias | |
| numero_siniestro | TEXT | |
| estado | TEXT NOT NULL DEFAULT 'borrador' | borrador/enviado/aprobado/rechazado |
| creado_por | INTEGER FK usuarios NOT NULL | |
| creado_en | TEXT NOT NULL | ISO 8601 |
| modificado_en | TEXT NOT NULL | ISO 8601 |

### Tabla `items`
| Campo | Tipo | Notas |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| presupuesto_id | INTEGER FK presupuestos NOT NULL | |
| tipo | TEXT NOT NULL | 'repuesto' o 'mano_obra' |
| descripcion | TEXT NOT NULL | |
| cantidad | REAL | solo repuestos; NULL para mano de obra |
| precio_unitario | REAL NOT NULL | |
| orden | INTEGER NOT NULL | para mantener orden visual |

---

## Autenticación y sesiones

- Login con email y contraseña
- Contraseña hasheada con `bcrypt`
- Cookie de sesión con duración de 30 días (`remember me` implícito por dispositivo)
- Si la cookie de sesión es válida al abrir la app, se saltea el login directamente al listado
- Botón "Cerrar sesión" en la navegación principal
- Todos los endpoints protegidos por middleware `auth.js` que verifica sesión activa

---

## Autosave

- El formulario dispara un `PATCH /api/presupuestos/:id` debounced (2 segundos tras el último cambio)
- Para presupuestos nuevos: primero hace `POST /api/presupuestos` → recibe el ID → actualiza la URL del navegador a `/editar/:id` sin recargar (History API) → a partir de ahí todas las saves son PATCH
- Indicador de estado visible en el formulario: "Guardando..." / "Guardado" / "Error al guardar — reintentando..."
- El presupuesto se crea en DB como estado `borrador` desde el primer autosave
- Si el usuario cierra el navegador, el presupuesto queda en el listado como Borrador y puede retomarse

---

## Formulario de carga

### Encabezado
- Número de presupuesto: autogenerado (PRES-XXXX), editable manualmente; se valida unicidad al guardar
- Fecha de emisión

### Datos del siniestro y vehículo
- Nombre del asegurado (campo "Sres.")
- Domicilio del asegurado
- Marca de la moto
- Patente
- Modelo
- Tipo (Scooter, Enduro, Naked, etc. — texto libre)
- Fecha del siniestro
- Compañía de seguros (dropdown con lista configurable)
- Número de siniestro / expediente

### Sección Repuestos
- Tabla dinámica: Cantidad | Descripción | Precio unitario | Total (calculado)
- Botón "Agregar repuesto"
- Subtotal Repuestos (actualizado en tiempo real)

### Sección Mano de Obra
- Tabla dinámica: Descripción | Precio
- Botón "Agregar mano de obra"
- Subtotal Mano de Obra (actualizado en tiempo real)

### Panel de totales (en tiempo real)
- Subtotal repuestos
- Subtotal mano de obra
- Neto gravado (suma de subtotales)
- IVA 21%
- **Total general** (destacado)

### Comportamiento de estados en el formulario
- Estado `borrador`: edición libre, sin advertencia
- Estados `enviado`, `aprobado`, `rechazado`: al intentar editar cualquier campo, se muestra un modal de advertencia con confirmación explícita antes de habilitar la edición

### Formato de precios
- Punto para miles, coma para decimales, símbolo `$`
- Ejemplo: `$12.500,00`

---

## Listado de presupuestos

### Columnas
N° Presupuesto | Asegurado | Patente | Compañía | Total | Estado | Creado por | Acciones

### Búsqueda y filtros
- Buscador de texto libre por nombre del asegurado o patente
- Filtro por estado: todos / borrador / enviado / aprobado / rechazado
- Filtro por compañía de seguros
- Ordenado por fecha de creación descendente

### Acciones por fila
- **Editar** → abre el formulario
- **Descargar PDF** → genera y descarga el PDF on-demand
- **Duplicar** → crea una copia como `borrador` con nuevo número secuencial
- **Cambiar estado** → dropdown inline o modal de selección
- **Eliminar** → confirmación antes de borrar

---

## Gestión de compañías de seguros

- Página accesible desde el menú de navegación
- Lista de compañías con nombre y estado (activa/inactiva)
- Formulario para agregar nueva compañía
- Toggle para activar/desactivar (las inactivas no aparecen en el dropdown del formulario pero sí quedan asociadas a presupuestos históricos)
- Cualquier usuario logueado puede gestionar la lista

---

## Gestión de usuarios

- Página accesible desde el menú de navegación
- Lista de usuarios: nombre, email, fecha de creación
- Formulario para crear nuevo usuario: nombre, email, contraseña
- Eliminar usuario (no elimina sus presupuestos, queda el nombre registrado)
- Cualquier usuario logueado puede gestionar usuarios

---

## PDF — Template Puppeteer

### Configuración
- Formato A4, orientación vertical
- Flags Railway: `--no-sandbox`, `--disable-setuid-sandbox`
- Generado on-demand, devuelto como stream al navegador (no se guarda en disco)
- `page-break-inside: avoid` en tablas para evitar cortes

### Estructura del documento

**Header**
- Logo Gyver Motos (izquierda)
- Datos del taller (derecha): nombre, titular, dirección, CUIT, IIBB, inicio de actividades, condición IVA
- Banda destacada: `DOCUMENTO NO VÁLIDO COMO FACTURA — PRESUPUESTO`
- Número de presupuesto y fecha de emisión

**Bloque del siniestro**
- Grilla: Sres. | Domicilio | Marca | Patente | Modelo | Tipo | Fecha siniestro | Compañía | N° siniestro

**Tabla de Repuestos** (omitida si no hay ítems)
- Columnas: Cantidad | Descripción | Precio Unit. | Total
- Subtotal repuestos al pie

**Tabla de Mano de Obra** (omitida si no hay ítems)
- Columnas: Descripción | Precio
- Subtotal mano de obra al pie

**Totales**
- Subtotal repuestos
- Subtotal mano de obra
- Neto gravado
- IVA 21%
- **TOTAL** en tipografía grande y destacada

### Notas de formato
- Precios en formato argentino: `$12.500,00`
- El nombre del usuario creador NO aparece en el PDF (solo uso interno)

---

## API REST (endpoints principales)

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/auth/login` | Iniciar sesión |
| POST | `/auth/logout` | Cerrar sesión |
| GET | `/api/presupuestos` | Listado con filtros y búsqueda |
| POST | `/api/presupuestos` | Crear borrador nuevo |
| GET | `/api/presupuestos/:id` | Obtener presupuesto completo |
| PATCH | `/api/presupuestos/:id` | Actualizar (autosave + manual) |
| DELETE | `/api/presupuestos/:id` | Eliminar |
| POST | `/api/presupuestos/:id/duplicar` | Duplicar como borrador |
| GET | `/pdf/:id` | Generar y descargar PDF |
| GET | `/api/companias` | Listar compañías activas |
| POST | `/api/companias` | Crear compañía |
| PATCH | `/api/companias/:id` | Editar / activar / desactivar |
| GET | `/api/usuarios` | Listar usuarios |
| POST | `/api/usuarios` | Crear usuario |
| DELETE | `/api/usuarios/:id` | Eliminar usuario |

---

## Numeración de presupuestos

- El `numero_secuencial` es un autoincrement en DB, nunca se reutiliza aunque se elimine el presupuesto
- El `numero` visible (PRES-0001) se genera a partir del secuencial en el momento de creación
- El usuario puede editar el `numero` visible manualmente; se valida unicidad al guardar
- Si hay conflicto de número duplicado, se muestra error y se pide corregir

---

## Deploy en Railway

```toml
# railway.toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "node server.js"
```

Variables de entorno requeridas:
- `SESSION_SECRET` — string aleatorio para firmar cookies
- `PORT` — Railway lo provee automáticamente
- `NODE_ENV=production`
