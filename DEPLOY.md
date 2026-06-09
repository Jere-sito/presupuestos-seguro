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
