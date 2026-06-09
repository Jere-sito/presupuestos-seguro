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
