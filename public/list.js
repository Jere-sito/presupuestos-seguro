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
