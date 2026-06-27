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

function fmtFecha(s) {
  if (!s) return '—';
  const d = s.split(' ')[0].split('-');
  return d.length === 3 ? `${d[2]}/${d[1]}/${d[0]}` : s;
}

async function cargarLista() {
  const q = document.getElementById('q').value.trim();
  const estado = document.getElementById('filtro-estado').value;
  const compania_id = document.getElementById('filtro-compania').value;
  const desde = document.getElementById('filtro-desde').value;
  const hasta = document.getElementById('filtro-hasta').value;
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (estado) params.set('estado', estado);
  if (compania_id) params.set('compania_id', compania_id);
  if (desde) params.set('fecha_desde', desde);
  if (hasta) params.set('fecha_hasta', hasta);

  const res = await fetch('/api/presupuestos?' + params);
  const data = await res.json();
  const tbody = document.getElementById('tabla-body');

  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--muted)">No hay presupuestos</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(p => `
    <tr>
      <td><strong>${p.numero}</strong></td>
      <td><span style="font-family:monospace;font-size:11px;letter-spacing:1px;color:var(--muted);white-space:nowrap">${p.codigo_serie || '—'}</span></td>
      <td>${p.asegurado || '<span class="text-muted">—</span>'}</td>
      <td>${p.patente || '<span class="text-muted">—</span>'}</td>
      <td>${p.compania_nombre || '<span class="text-muted">—</span>'}</td>
      <td class="tr"><strong>${fmt(p.total)}</strong></td>
      <td><span class="badge ${ESTADOS[p.estado]}">${p.estado}</span></td>
      <td class="text-muted" style="white-space:nowrap">${fmtFecha(p.creado_en)}</td>
      <td class="text-muted">${p.creado_por_nombre || '—'}</td>
      <td>
        <button class="btn btn-sm btn-secondary btn-acciones" onclick="toggleMenu(event,${p.id},'${p.numero}','${p.estado}')" title="Acciones">⋮</button>
      </td>
    </tr>
  `).join('');
}

// ── Menú desplegable ──────────────────────────────────────────────────────────

const menu = document.createElement('div');
menu.id = 'menu-acciones';
menu.style.cssText = 'position:fixed;background:#fff;border:1px solid #ddd;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.15);min-width:180px;z-index:9999;display:none;overflow:hidden';
document.body.appendChild(menu);

let menuActivo = null;

function toggleMenu(e, id, numero, estado) {
  e.stopPropagation();
  if (menuActivo === id && menu.style.display !== 'none') { cerrarMenu(); return; }
  menuActivo = id;

  menu.innerHTML = `
    <a href="/editar/${id}" class="menu-item">✏️ Editar</a>
    <button class="menu-item" onclick="descargarPdf(${id})">📄 Descargar PDF</button>
    <button class="menu-item" onclick="enviarWhatsApp(${id})">💬 Enviar por WhatsApp</button>
    <button class="menu-item" onclick="duplicar(${id})">📋 Duplicar</button>
    <button class="menu-item" onclick="abrirModalEstado(${id},'${numero}','${estado}')">🔄 Cambiar estado</button>
    <hr style="margin:4px 0;border:none;border-top:1px solid #eee">
    <button class="menu-item menu-item-danger" onclick="abrirModalEliminar(${id},'${numero}')">🗑️ Eliminar</button>
  `;

  const rect = e.currentTarget.getBoundingClientRect();
  menu.style.display = 'block';
  const mw = menu.offsetWidth;
  const mh = menu.offsetHeight;
  let left = rect.right - mw;
  let top = rect.bottom + 4;
  if (left < 8) left = 8;
  if (top + mh > window.innerHeight - 8) top = rect.top - mh - 4;
  menu.style.left = left + 'px';
  menu.style.top = top + 'px';
}

function cerrarMenu() { menu.style.display = 'none'; menuActivo = null; }
document.addEventListener('click', cerrarMenu);

function descargarPdf(id) { cerrarMenu(); window.location.href = `/pdf/${id}`; }

function enviarWhatsApp(id) {
  cerrarMenu();
  const a = document.createElement('a');
  a.href = `/pdf/${id}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.open('https://wa.me/541123909375', '_blank', 'noopener');
}

async function duplicar(id) {
  cerrarMenu();
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
function cerrarModalEstado() { cerrarMenu(); document.getElementById('modal-estado').classList.add('hidden'); }
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
function cerrarModalEliminar() { cerrarMenu(); document.getElementById('modal-eliminar').classList.add('hidden'); }
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
document.getElementById('filtro-desde').addEventListener('change', cargarLista);
document.getElementById('filtro-hasta').addEventListener('change', cargarLista);

// Init
cargarCompanias();
cargarLista();
