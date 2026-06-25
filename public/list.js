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
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--muted)">No hay presupuestos</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(p => `
    <tr>
      <td><strong>${p.numero}</strong></td>
      <td><span style="font-family:monospace;font-size:12px;letter-spacing:1px;color:var(--muted)">${p.codigo_serie || '—'}</span></td>
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
          <button class="btn btn-sm btn-whatsapp" onclick="enviarWhatsApp(${p.id})" title="Enviar por WhatsApp"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="white" style="flex-shrink:0;vertical-align:middle"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></button>
          <button class="btn btn-sm btn-secondary" onclick="duplicar(${p.id})" title="Duplicar">📋</button>
          <button class="btn btn-sm btn-secondary" onclick="abrirModalEstado(${p.id},'${p.numero}','${p.estado}')" title="Estado">🔄</button>
          <button class="btn btn-sm btn-danger" onclick="abrirModalEliminar(${p.id},'${p.numero}')" title="Eliminar">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function descargarPdf(id) { window.location.href = `/pdf/${id}`; }

function enviarWhatsApp(id) {
  const a = document.createElement('a');
  a.href = `/pdf/${id}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.open('https://wa.me/541123909375', '_blank', 'noopener');
}

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
