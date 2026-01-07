// ==================== INVENTARIO - JAVASCRIPT ====================

// Variables globales
let empresaId = '';
let sucursalId = '';
let usuarioId = '';
let almacenesData = [];
let productosData = [];
let conceptosData = [];
let existenciasData = [];
let movimientosData = [];
let traspasosData = [];

// Líneas editables
let lineasAjuste = [];
let lineasTraspaso = [];
let traspasoActual = null;
let autocompleteIdx = -1;

// API Helper
const API = {
    base: '/api',
    async request(endpoint, method = 'GET', body = null) {
        const opts = { method, headers: { 'Content-Type': 'application/json' } };
        if (body) opts.body = JSON.stringify(body);
        const r = await fetch(this.base + endpoint, opts);
        return r.json();
    }
};

// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', () => {
    initUsuario();
    initTabs();
    cargarDatosIniciales();
    agregarLineaAjuste();
    
    // Fecha por defecto
    document.getElementById('ajusteFecha').value = new Date().toISOString().split('T')[0];
    
    // Cerrar autocomplete al hacer clic fuera
    document.addEventListener('click', e => {
        if (!e.target.closest('.producto-input-wrap')) {
            document.querySelectorAll('.producto-autocomplete').forEach(d => d.classList.remove('show'));
            autocompleteIdx = -1;
        }
    });
});

function initUsuario() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    empresaId = user.empresa_id || localStorage.getItem('empresa_id') || '';
    sucursalId = user.sucursal_id || localStorage.getItem('sucursal_id') || '';
    usuarioId = user.usuario_id || localStorage.getItem('usuario_id') || '';
    
    document.getElementById('userName').textContent = user.nombre || 'Usuario';
    document.getElementById('userRole').textContent = user.rol || 'Admin';
    document.getElementById('userAvatar').textContent = (user.nombre || 'U').charAt(0).toUpperCase();
}

function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`panel-${tab}`).classList.add('active');
            
            // Cargar datos según tab
            if (tab === 'existencias') cargarExistencias();
            if (tab === 'movimientos') cargarMovimientos();
            if (tab === 'traspasos') cargarTraspasos();
        });
    });
}

async function cargarDatosIniciales() {
    try {
        await Promise.all([
            cargarAlmacenes(),
            cargarProductos(),
            cargarConceptos(),
            cargarExistencias()
        ]);
    } catch (e) {
        console.error('Error cargando datos:', e);
        toast('Error al cargar datos', 'error');
    }
}

// ==================== CARGAR CATÁLOGOS ====================
async function cargarAlmacenes() {
    try {
        const r = await API.request(`/almacenes/${empresaId}`);
        if (r.success) {
            almacenesData = r.almacenes || r.data || [];
            const options = '<option value="">Todos</option>' + almacenesData.map(a => 
                `<option value="${a.almacen_id}">${a.nombre}</option>`
            ).join('');
            const optionsReq = '<option value="">Seleccionar...</option>' + almacenesData.map(a => 
                `<option value="${a.almacen_id}">${a.nombre}</option>`
            ).join('');
            
            // Existencias
            document.getElementById('filtroAlmacenExist').innerHTML = options;
            // Movimientos
            document.getElementById('filtroAlmacenMov').innerHTML = options;
            // Traspasos
            document.getElementById('filtroOrigenTras').innerHTML = options;
            document.getElementById('filtroDestinoTras').innerHTML = options;
            document.getElementById('traspasoOrigen').innerHTML = optionsReq;
            document.getElementById('traspasoDestino').innerHTML = optionsReq;
            // Ajuste
            document.getElementById('ajusteAlmacen').innerHTML = optionsReq;
        }
    } catch (e) { console.error(e); }
}

async function cargarProductos() {
    try {
        const r = await API.request(`/productos/${empresaId}`);
        if (r.success) productosData = r.productos || r.data || [];
    } catch (e) { console.error(e); }
}

async function cargarConceptos() {
    try {
        const r = await API.request(`/conceptos-inventario/${empresaId}`);
        if (r.success) {
            conceptosData = r.conceptos || r.data || [];
            
            // Filtro movimientos
            document.getElementById('filtroConceptoMov').innerHTML = '<option value="">Todos</option>' + 
                conceptosData.map(c => `<option value="${c.concepto_id}">${c.nombre}</option>`).join('');
            
            // Select ajuste (solo conceptos de ajuste/merma)
            const conceptosAjuste = conceptosData.filter(c => 
                c.codigo?.includes('AJU') || c.codigo?.includes('MER') || 
                c.nombre?.toLowerCase().includes('ajuste') || c.nombre?.toLowerCase().includes('merma')
            );
            document.getElementById('ajusteConcepto').innerHTML = '<option value="">Seleccionar...</option>' + 
                conceptosAjuste.map(c => `<option value="${c.concepto_id}" data-tipo="${c.tipo}">${c.nombre} (${c.tipo})</option>`).join('');
        }
    } catch (e) { console.error(e); }
}

// ==================== EXISTENCIAS ====================
async function cargarExistencias() {
    const almacen = document.getElementById('filtroAlmacenExist').value;
    try {
        let url = `/inventario/${empresaId}`;
        if (almacen) url += `?almacen_id=${almacen}`;
        const r = await API.request(url);
        if (r.success) {
            existenciasData = r.inventario || r.data || [];
            renderExistencias();
            calcularEstadisticas();
        }
    } catch (e) { console.error(e); }
}

function renderExistencias() {
    const tbody = document.getElementById('tablaExistencias');
    const buscar = document.getElementById('filtroBuscarExist').value.toLowerCase();
    const estado = document.getElementById('filtroEstadoStock').value;
    
    let data = existenciasData;
    
    // Filtrar por búsqueda
    if (buscar) {
        data = data.filter(i => 
            i.producto_nombre?.toLowerCase().includes(buscar) ||
            i.codigo_barras?.toLowerCase().includes(buscar) ||
            i.codigo_interno?.toLowerCase().includes(buscar)
        );
    }
    
    // Filtrar por estado
    if (estado === 'constock') data = data.filter(i => parseFloat(i.stock) > 0);
    if (estado === 'bajo') data = data.filter(i => parseFloat(i.stock) > 0 && parseFloat(i.stock) <= parseFloat(i.stock_minimo || 5));
    if (estado === 'sinstock') data = data.filter(i => parseFloat(i.stock) <= 0);
    
    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="empty-state"><i class="fas fa-inbox"></i><h4>Sin existencias</h4></td></tr>`;
        return;
    }
    
    tbody.innerHTML = data.map(i => {
        const stock = parseFloat(i.stock || 0);
        const reservado = parseFloat(i.stock_reservado || 0);
        const disponible = parseFloat(i.stock_disponible || stock - reservado);
        const costo = parseFloat(i.costo_promedio || 0);
        const valor = stock * costo;
        const minimo = parseFloat(i.stock_minimo || 5);
        
        let estadoClass = 'stock-ok';
        let estadoBadge = '<span class="badge badge-recibido">OK</span>';
        if (stock <= 0) {
            estadoClass = 'stock-zero';
            estadoBadge = '<span class="badge badge-cancelado">Sin stock</span>';
        } else if (stock <= minimo) {
            estadoClass = 'stock-low';
            estadoBadge = '<span class="badge badge-transito">Bajo</span>';
        }
        
        return `
            <tr onclick="verMovimientosProducto('${i.producto_id}')">
                <td><code>${i.codigo_barras || i.codigo_interno || '-'}</code></td>
                <td><strong>${i.producto_nombre || '-'}</strong></td>
                <td>${i.almacen_nombre || '-'}</td>
                <td class="text-right ${estadoClass}"><strong>${formatNumber(stock)}</strong></td>
                <td class="text-right">${formatNumber(reservado)}</td>
                <td class="text-right">${formatNumber(disponible)}</td>
                <td class="text-right">${formatMoney(costo)}</td>
                <td class="text-right"><strong>${formatMoney(valor)}</strong></td>
                <td>${estadoBadge}</td>
            </tr>
        `;
    }).join('');
}

function filtrarExistencias() {
    renderExistencias();
}

function calcularEstadisticas() {
    const total = existenciasData.length;
    const conStock = existenciasData.filter(i => parseFloat(i.stock) > 0).length;
    const stockBajo = existenciasData.filter(i => {
        const s = parseFloat(i.stock);
        const min = parseFloat(i.stock_minimo || 5);
        return s > 0 && s <= min;
    }).length;
    const sinStock = existenciasData.filter(i => parseFloat(i.stock) <= 0).length;
    const valorTotal = existenciasData.reduce((sum, i) => sum + (parseFloat(i.stock || 0) * parseFloat(i.costo_promedio || 0)), 0);
    
    document.getElementById('statTotalProductos').textContent = total;
    document.getElementById('statConStock').textContent = conStock;
    document.getElementById('statStockBajo').textContent = stockBajo;
    document.getElementById('statSinStock').textContent = sinStock;
    document.getElementById('statValorTotal').textContent = formatMoney(valorTotal);
}

function verMovimientosProducto(productoId) {
    // Cambiar a tab movimientos y filtrar
    document.querySelector('[data-tab="movimientos"]').click();
    document.getElementById('filtroBuscarMov').value = productoId;
    cargarMovimientos();
}

// ==================== MOVIMIENTOS ====================
async function cargarMovimientos() {
    const almacen = document.getElementById('filtroAlmacenMov').value;
    const concepto = document.getElementById('filtroConceptoMov').value;
    const tipo = document.getElementById('filtroTipoMov').value;
    const desde = document.getElementById('filtroDesde').value;
    const hasta = document.getElementById('filtroHasta').value;
    
    try {
        let params = [];
        if (almacen) params.push(`almacen_id=${almacen}`);
        if (concepto) params.push(`concepto_id=${concepto}`);
        if (tipo) params.push(`tipo=${tipo}`);
        if (desde) params.push(`desde=${desde}`);
        if (hasta) params.push(`hasta=${hasta}`);
        
        const query = params.length ? '?' + params.join('&') : '';
        const r = await API.request(`/movimientos-inventario/${empresaId}${query}`);
        if (r.success) {
            movimientosData = r.movimientos || r.data || [];
            renderMovimientos();
        }
    } catch (e) { console.error(e); }
}

function renderMovimientos() {
    const tbody = document.getElementById('tablaMovimientos');
    const buscar = document.getElementById('filtroBuscarMov').value.toLowerCase();
    
    let data = movimientosData;
    if (buscar) {
        data = data.filter(m => 
            m.producto_nombre?.toLowerCase().includes(buscar) ||
            m.referencia_id?.toLowerCase().includes(buscar) ||
            m.notas?.toLowerCase().includes(buscar)
        );
    }
    
    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="empty-state"><i class="fas fa-exchange-alt"></i><h4>Sin movimientos</h4></td></tr>`;
        return;
    }
    
    tbody.innerHTML = data.map(m => {
        const tipo = m.concepto_tipo || (parseFloat(m.cantidad) > 0 ? 'ENTRADA' : 'SALIDA');
        const tipoClass = tipo === 'ENTRADA' ? 'badge-entrada' : 'badge-salida';
        const signo = tipo === 'ENTRADA' ? '+' : '-';
        const cantColor = tipo === 'ENTRADA' ? 'stock-ok' : 'stock-zero';
        
        return `
            <tr>
                <td>${formatDateTime(m.fecha)}</td>
                <td><span class="badge ${tipoClass}">${m.concepto_nombre || '-'}</span></td>
                <td><strong>${m.producto_nombre || '-'}</strong></td>
                <td>${m.almacen_nombre || '-'}</td>
                <td class="text-right ${cantColor}"><strong>${signo}${formatNumber(Math.abs(m.cantidad))}</strong></td>
                <td class="text-right">${formatNumber(m.existencia_anterior)}</td>
                <td class="text-right">${formatNumber(m.existencia_nueva)}</td>
                <td><code>${m.referencia_id || '-'}</code></td>
                <td>${m.usuario_nombre || '-'}</td>
            </tr>
        `;
    }).join('');
}

function filtrarMovimientos() {
    renderMovimientos();
}

// ==================== TRASPASOS ====================
async function cargarTraspasos() {
    const estatus = document.getElementById('filtroEstatusTras').value;
    const origen = document.getElementById('filtroOrigenTras').value;
    const destino = document.getElementById('filtroDestinoTras').value;
    
    try {
        let params = [];
        if (estatus) params.push(`estatus=${estatus}`);
        if (origen) params.push(`almacen_origen_id=${origen}`);
        if (destino) params.push(`almacen_destino_id=${destino}`);
        
        const query = params.length ? '?' + params.join('&') : '';
        const r = await API.request(`/traspasos/${empresaId}${query}`);
        if (r.success) {
            traspasosData = r.traspasos || r.data || [];
            renderTraspasos();
        }
    } catch (e) { console.error(e); }
}

function renderTraspasos() {
    const tbody = document.getElementById('tablaTraspasos');
    
    if (traspasosData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="empty-state"><i class="fas fa-truck-loading"></i><h4>Sin traspasos</h4></td></tr>`;
        return;
    }
    
    tbody.innerHTML = traspasosData.map(t => {
        const badgeClass = {
            'BORRADOR': 'badge-borrador',
            'SOLICITADO': 'badge-solicitado',
            'EN_TRANSITO': 'badge-transito',
            'RECIBIDO': 'badge-recibido',
            'CANCELADO': 'badge-cancelado'
        }[t.estatus] || 'badge-borrador';
        
        return `
            <tr onclick="abrirTraspaso('${t.traspaso_id}')">
                <td><strong>${t.traspaso_id.substring(0,12)}...</strong></td>
                <td>${formatDateTime(t.fecha_solicitud)}</td>
                <td>${t.almacen_origen_nombre || '-'}</td>
                <td>${t.almacen_destino_nombre || '-'}</td>
                <td class="text-right">${t.total_productos || 0}</td>
                <td>${t.referencia || '-'}</td>
                <td><span class="badge ${badgeClass}">${t.estatus}</span></td>
                <td class="text-center">
                    <button class="btn-icon" onclick="event.stopPropagation(); abrirTraspaso('${t.traspaso_id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function nuevoTraspaso() {
    traspasoActual = null;
    document.getElementById('traspasoId').value = '';
    document.getElementById('traspasoOrigen').value = '';
    document.getElementById('traspasoDestino').value = '';
    document.getElementById('traspasoReferencia').value = '';
    document.getElementById('traspasoNotas').value = '';
    document.getElementById('modalTraspasoTitulo').textContent = 'Nuevo Traspaso';
    
    lineasTraspaso = [];
    agregarLineaTraspaso();
    
    actualizarStatusBarTraspaso('BORRADOR');
    actualizarBotonesTraspaso('BORRADOR');
    
    document.getElementById('traspasoOrigen').disabled = false;
    document.getElementById('traspasoDestino').disabled = false;
    document.getElementById('traspasoLineasActions').style.display = 'flex';
    
    abrirModal('modalTraspaso');
}

async function abrirTraspaso(id) {
    try {
        const r = await API.request(`/traspasos/detalle/${id}`);
        if (r.success) {
            traspasoActual = r.traspaso;
            traspasoActual.productos = r.productos || [];
            
            document.getElementById('traspasoId').value = traspasoActual.traspaso_id;
            document.getElementById('traspasoOrigen').value = traspasoActual.almacen_origen_id;
            document.getElementById('traspasoDestino').value = traspasoActual.almacen_destino_id;
            document.getElementById('traspasoReferencia').value = traspasoActual.referencia || '';
            document.getElementById('traspasoNotas').value = traspasoActual.notas || '';
            document.getElementById('modalTraspasoTitulo').textContent = `Traspaso ${traspasoActual.traspaso_id.substring(0,12)}...`;
            
            const editable = traspasoActual.estatus === 'BORRADOR';
            document.getElementById('traspasoOrigen').disabled = !editable;
            document.getElementById('traspasoDestino').disabled = !editable;
            document.getElementById('traspasoLineasActions').style.display = editable ? 'flex' : 'none';
            
            lineasTraspaso = traspasoActual.productos.map(p => ({
                producto_id: p.producto_id,
                nombre: p.producto_nombre || p.descripcion,
                codigo: p.codigo_barras || '',
                disponible: parseFloat(p.stock_disponible || 0),
                cantidad_solicitada: parseFloat(p.cantidad_solicitada || 0),
                cantidad_enviada: parseFloat(p.cantidad_enviada || 0),
                cantidad_recibida: parseFloat(p.cantidad_recibida || 0),
                costo_unitario: parseFloat(p.costo_unitario || 0)
            }));
            
            if (editable && lineasTraspaso.length === 0) agregarLineaTraspaso();
            
            actualizarStatusBarTraspaso(traspasoActual.estatus);
            actualizarBotonesTraspaso(traspasoActual.estatus);
            renderLineasTraspaso();
            
            abrirModal('modalTraspaso');
        }
    } catch (e) { toast('Error al cargar', 'error'); }
}

function actualizarStatusBarTraspaso(estatus) {
    const steps = document.querySelectorAll('#traspasoStatusBar .step');
    const orden = ['BORRADOR', 'SOLICITADO', 'EN_TRANSITO', 'RECIBIDO'];
    const idx = orden.indexOf(estatus);
    
    steps.forEach((step, i) => {
        step.classList.remove('active', 'completed');
        if (i < idx) step.classList.add('completed');
        if (i === idx) step.classList.add('active');
    });
}

function actualizarBotonesTraspaso(estatus) {
    const btnGuardar = document.getElementById('btnGuardarTraspaso');
    const btnSolicitar = document.getElementById('btnSolicitarTraspaso');
    const btnEnviar = document.getElementById('btnEnviarTraspaso');
    const btnRecibir = document.getElementById('btnRecibirTraspaso');
    
    btnGuardar.style.display = estatus === 'BORRADOR' ? '' : 'none';
    btnSolicitar.style.display = estatus === 'BORRADOR' ? '' : 'none';
    btnEnviar.style.display = estatus === 'SOLICITADO' ? '' : 'none';
    btnRecibir.style.display = estatus === 'EN_TRANSITO' ? '' : 'none';
}

function agregarLineaTraspaso() {
    lineasTraspaso.push({
        producto_id: '',
        nombre: '',
        codigo: '',
        disponible: 0,
        cantidad_solicitada: 1,
        cantidad_enviada: 0,
        cantidad_recibida: 0,
        costo_unitario: 0
    });
    renderLineasTraspaso();
}

function renderLineasTraspaso() {
    const tbody = document.getElementById('tablaLineasTraspaso');
    const editable = !traspasoActual || traspasoActual.estatus === 'BORRADOR';
    const enTransito = traspasoActual?.estatus === 'EN_TRANSITO';
    const solicitado = traspasoActual?.estatus === 'SOLICITADO';
    
    tbody.innerHTML = lineasTraspaso.map((l, i) => `
        <tr data-idx="${i}">
            <td>
                <div class="producto-input-wrap">
                    <input type="text" 
                        class="input-producto" 
                        id="tras-prod-${i}"
                        value="${l.nombre}" 
                        placeholder="Buscar producto..."
                        oninput="lineasTraspaso[${i}].nombre = this.value; buscarProductoTraspaso(${i}, this.value)"
                        onkeydown="navegarAutocompleteTraspaso(event, ${i})"
                        onfocus="if(this.value.length > 0) buscarProductoTraspaso(${i}, this.value)"
                        autocomplete="off"
                        ${editable ? '' : 'disabled'}>
                    ${l.codigo ? `<span class="producto-codigo">${l.codigo}</span>` : ''}
                    <div class="producto-autocomplete" id="tras-autocomplete-${i}"></div>
                </div>
            </td>
            <td class="text-right">${formatNumber(l.disponible)}</td>
            <td>
                <input type="number" 
                    class="input-number" 
                    value="${l.cantidad_solicitada}" 
                    min="0.01" 
                    step="0.01"
                    oninput="lineasTraspaso[${i}].cantidad_solicitada = parseFloat(this.value) || 0"
                    ${editable ? '' : 'disabled'}>
            </td>
            <td>
                <input type="number" 
                    class="input-number" 
                    value="${l.cantidad_enviada}" 
                    min="0" 
                    step="0.01"
                    oninput="lineasTraspaso[${i}].cantidad_enviada = parseFloat(this.value) || 0"
                    ${solicitado ? '' : 'disabled'}>
            </td>
            <td>
                <input type="number" 
                    class="input-number" 
                    value="${l.cantidad_recibida}" 
                    min="0" 
                    step="0.01"
                    oninput="lineasTraspaso[${i}].cantidad_recibida = parseFloat(this.value) || 0"
                    ${enTransito ? '' : 'disabled'}>
            </td>
            <td>${editable ? `<button class="btn-remove" onclick="quitarLineaTraspaso(${i})"><i class="fas fa-trash"></i></button>` : ''}</td>
        </tr>
    `).join('');
}

function quitarLineaTraspaso(idx) {
    if (lineasTraspaso.length === 1) {
        lineasTraspaso[0] = { producto_id: '', nombre: '', codigo: '', disponible: 0, cantidad_solicitada: 1, cantidad_enviada: 0, cantidad_recibida: 0, costo_unitario: 0 };
    } else {
        lineasTraspaso.splice(idx, 1);
    }
    renderLineasTraspaso();
}

function buscarProductoTraspaso(idx, texto) {
    const dropdown = document.getElementById(`tras-autocomplete-${idx}`);
    autocompleteIdx = -1;
    
    if (texto.length < 1) { dropdown.classList.remove('show'); return; }
    
    const almacenOrigen = document.getElementById('traspasoOrigen').value;
    const textoLower = texto.toLowerCase();
    
    // Filtrar productos y mostrar stock del almacén origen
    let resultados = productosData.filter(p => 
        (p.nombre?.toLowerCase().includes(textoLower)) ||
        (p.codigo_barras?.toLowerCase().includes(textoLower))
    ).slice(0, 8);
    
    if (resultados.length === 0) {
        dropdown.innerHTML = `<div style="padding:12px;text-align:center;color:var(--gray-400)">No encontrado</div>`;
    } else {
        dropdown.innerHTML = resultados.map((p, i) => {
            // Buscar stock en almacén origen
            const inv = existenciasData.find(e => e.producto_id === p.producto_id && e.almacen_id === almacenOrigen);
            const stock = inv ? parseFloat(inv.stock_disponible || inv.stock || 0) : 0;
            
            return `
                <div class="producto-option" data-option="${i}" onclick="seleccionarProductoTraspaso(${idx}, '${p.producto_id}', ${stock})">
                    <div class="info">
                        <div class="name">${p.nombre}</div>
                        <div class="code">${p.codigo_barras || '-'}</div>
                        <div class="stock ${stock > 0 ? 'stock-ok' : 'stock-zero'}">Disp: ${formatNumber(stock)}</div>
                    </div>
                </div>
            `;
        }).join('');
    }
    dropdown.classList.add('show');
}

function navegarAutocompleteTraspaso(event, idx) {
    const dropdown = document.getElementById(`tras-autocomplete-${idx}`);
    const opciones = dropdown.querySelectorAll('.producto-option');
    
    if (!dropdown.classList.contains('show') || opciones.length === 0) return;
    
    if (event.key === 'ArrowDown') {
        event.preventDefault();
        autocompleteIdx = Math.min(autocompleteIdx + 1, opciones.length - 1);
        actualizarSeleccionAuto(opciones);
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        autocompleteIdx = Math.max(autocompleteIdx - 1, 0);
        actualizarSeleccionAuto(opciones);
    } else if (event.key === 'Enter') {
        event.preventDefault();
        if (autocompleteIdx >= 0 && opciones[autocompleteIdx]) {
            opciones[autocompleteIdx].click();
        }
    } else if (event.key === 'Escape') {
        dropdown.classList.remove('show');
    }
}

function seleccionarProductoTraspaso(idx, productoId, stockDisponible) {
    const p = productosData.find(x => x.producto_id === productoId);
    if (!p) return;
    
    lineasTraspaso[idx] = {
        producto_id: p.producto_id,
        nombre: p.nombre,
        codigo: p.codigo_barras || '',
        disponible: stockDisponible,
        cantidad_solicitada: Math.min(1, stockDisponible),
        cantidad_enviada: 0,
        cantidad_recibida: 0,
        costo_unitario: parseFloat(p.costo || 0)
    };
    
    document.getElementById(`tras-autocomplete-${idx}`).classList.remove('show');
    autocompleteIdx = -1;
    renderLineasTraspaso();
}

function cambiarAlmacenOrigen() {
    // Recargar existencias para el nuevo almacén
    cargarExistencias().then(() => {
        // Actualizar disponible en las líneas
        const almacen = document.getElementById('traspasoOrigen').value;
        lineasTraspaso.forEach(l => {
            if (l.producto_id) {
                const inv = existenciasData.find(e => e.producto_id === l.producto_id && e.almacen_id === almacen);
                l.disponible = inv ? parseFloat(inv.stock_disponible || inv.stock || 0) : 0;
            }
        });
        renderLineasTraspaso();
    });
}

async function guardarTraspaso(estatus) {
    const origen = document.getElementById('traspasoOrigen').value;
    const destino = document.getElementById('traspasoDestino').value;
    
    if (!origen) { toast('Seleccione almacén origen', 'error'); return; }
    if (!destino) { toast('Seleccione almacén destino', 'error'); return; }
    if (origen === destino) { toast('Origen y destino deben ser diferentes', 'error'); return; }
    
    const lineasValidas = lineasTraspaso.filter(l => l.producto_id && l.cantidad_solicitada > 0);
    if (lineasValidas.length === 0) { toast('Agregue productos', 'error'); return; }
    
    const id = document.getElementById('traspasoId').value;
    
    const data = {
        empresa_id: empresaId,
        almacen_origen_id: origen,
        almacen_destino_id: destino,
        usuario_id: usuarioId,
        referencia: document.getElementById('traspasoReferencia').value,
        notas: document.getElementById('traspasoNotas').value,
        estatus,
        productos: lineasValidas.map(l => ({
            producto_id: l.producto_id,
            cantidad_solicitada: l.cantidad_solicitada,
            cantidad_enviada: l.cantidad_enviada,
            cantidad_recibida: l.cantidad_recibida,
            costo_unitario: l.costo_unitario
        }))
    };
    
    try {
        const r = await API.request(id ? `/traspasos/${id}` : '/traspasos', id ? 'PUT' : 'POST', data);
        if (r.success) {
            toast(estatus === 'BORRADOR' ? 'Borrador guardado' : 'Traspaso solicitado', 'success');
            cerrarModal('modalTraspaso');
            cargarTraspasos();
        } else { toast(r.error || 'Error', 'error'); }
    } catch (e) { toast('Error', 'error'); }
}

async function enviarTraspaso() {
    if (!traspasoActual) return;
    if (!confirm('¿Enviar el traspaso? Se descontará el stock del almacén origen.')) return;
    
    // Copiar cantidad_solicitada a cantidad_enviada si está vacío
    lineasTraspaso.forEach(l => {
        if (!l.cantidad_enviada) l.cantidad_enviada = l.cantidad_solicitada;
    });
    
    const lineasValidas = lineasTraspaso.filter(l => l.producto_id && l.cantidad_enviada > 0);
    
    try {
        const r = await API.request(`/traspasos/${traspasoActual.traspaso_id}/enviar`, 'POST', {
            usuario_id: usuarioId,
            productos: lineasValidas.map(l => ({
                producto_id: l.producto_id,
                cantidad_enviada: l.cantidad_enviada,
                costo_unitario: l.costo_unitario
            }))
        });
        
        if (r.success) {
            toast('Traspaso enviado', 'success');
            cerrarModal('modalTraspaso');
            cargarTraspasos();
            cargarExistencias();
        } else { toast(r.error || 'Error', 'error'); }
    } catch (e) { toast('Error', 'error'); }
}

async function recibirTraspaso() {
    if (!traspasoActual) return;
    if (!confirm('¿Confirmar recepción? Se sumará el stock al almacén destino.')) return;
    
    // Copiar cantidad_enviada a cantidad_recibida si está vacío
    lineasTraspaso.forEach(l => {
        if (!l.cantidad_recibida) l.cantidad_recibida = l.cantidad_enviada;
    });
    
    const lineasValidas = lineasTraspaso.filter(l => l.producto_id && l.cantidad_recibida > 0);
    
    try {
        const r = await API.request(`/traspasos/${traspasoActual.traspaso_id}/recibir`, 'POST', {
            usuario_id: usuarioId,
            productos: lineasValidas.map(l => ({
                producto_id: l.producto_id,
                cantidad_recibida: l.cantidad_recibida,
                costo_unitario: l.costo_unitario
            }))
        });
        
        if (r.success) {
            toast('Traspaso recibido', 'success');
            cerrarModal('modalTraspaso');
            cargarTraspasos();
            cargarExistencias();
        } else { toast(r.error || 'Error', 'error'); }
    } catch (e) { toast('Error', 'error'); }
}

// ==================== AJUSTES ====================
function agregarLineaAjuste() {
    lineasAjuste.push({
        producto_id: '',
        nombre: '',
        codigo: '',
        stock_actual: 0,
        cantidad: 1,
        costo: 0,
        total: 0
    });
    renderLineasAjuste();
}

function renderLineasAjuste() {
    const tbody = document.getElementById('tablaLineasAjuste');
    
    tbody.innerHTML = lineasAjuste.map((l, i) => `
        <tr data-idx="${i}">
            <td>
                <div class="producto-input-wrap">
                    <input type="text" 
                        class="input-producto" 
                        id="aju-prod-${i}"
                        value="${l.nombre}" 
                        placeholder="Buscar producto..."
                        oninput="lineasAjuste[${i}].nombre = this.value; buscarProductoAjuste(${i}, this.value)"
                        onkeydown="navegarAutocompleteAjuste(event, ${i})"
                        onfocus="if(this.value.length > 0) buscarProductoAjuste(${i}, this.value)"
                        autocomplete="off">
                    ${l.codigo ? `<span class="producto-codigo">${l.codigo}</span>` : ''}
                    <div class="producto-autocomplete" id="aju-autocomplete-${i}"></div>
                </div>
            </td>
            <td class="text-right">${formatNumber(l.stock_actual)}</td>
            <td>
                <input type="number" 
                    class="input-number" 
                    value="${l.cantidad}" 
                    min="0.01" 
                    step="0.01"
                    oninput="actualizarLineaAjuste(${i}, 'cantidad', this.value)">
            </td>
            <td>
                <input type="number" 
                    class="input-number" 
                    value="${l.costo.toFixed(2)}" 
                    min="0" 
                    step="0.01"
                    oninput="actualizarLineaAjuste(${i}, 'costo', this.value)">
            </td>
            <td class="text-right total-cell">${formatMoney(l.total)}</td>
            <td><button class="btn-remove" onclick="quitarLineaAjuste(${i})"><i class="fas fa-trash"></i></button></td>
        </tr>
    `).join('');
    
    calcularTotalesAjuste();
}

function quitarLineaAjuste(idx) {
    if (lineasAjuste.length === 1) {
        lineasAjuste[0] = { producto_id: '', nombre: '', codigo: '', stock_actual: 0, cantidad: 1, costo: 0, total: 0 };
    } else {
        lineasAjuste.splice(idx, 1);
    }
    renderLineasAjuste();
}

function actualizarLineaAjuste(idx, campo, valor) {
    const val = parseFloat(valor) || 0;
    lineasAjuste[idx][campo] = val;
    lineasAjuste[idx].total = lineasAjuste[idx].cantidad * lineasAjuste[idx].costo;
    
    // Actualizar UI sin re-render completo
    const row = document.querySelector(`#tablaLineasAjuste tr[data-idx="${idx}"]`);
    if (row) {
        row.querySelector('.total-cell').textContent = formatMoney(lineasAjuste[idx].total);
    }
    calcularTotalesAjuste();
}

function buscarProductoAjuste(idx, texto) {
    const dropdown = document.getElementById(`aju-autocomplete-${idx}`);
    autocompleteIdx = -1;
    
    if (texto.length < 1) { dropdown.classList.remove('show'); return; }
    
    const almacen = document.getElementById('ajusteAlmacen').value;
    const textoLower = texto.toLowerCase();
    
    let resultados = productosData.filter(p => 
        (p.nombre?.toLowerCase().includes(textoLower)) ||
        (p.codigo_barras?.toLowerCase().includes(textoLower))
    ).slice(0, 8);
    
    if (resultados.length === 0) {
        dropdown.innerHTML = `<div style="padding:12px;text-align:center;color:var(--gray-400)">
            No encontrado - <a href="#" onclick="abrirModal('modalProducto'); return false;" style="color:var(--primary)">Crear</a>
        </div>`;
    } else {
        dropdown.innerHTML = resultados.map((p, i) => {
            const inv = existenciasData.find(e => e.producto_id === p.producto_id && e.almacen_id === almacen);
            const stock = inv ? parseFloat(inv.stock || 0) : 0;
            const costo = inv ? parseFloat(inv.costo_promedio || 0) : parseFloat(p.costo || 0);
            
            return `
                <div class="producto-option" data-option="${i}" onclick="seleccionarProductoAjuste(${idx}, '${p.producto_id}', ${stock}, ${costo})">
                    <div class="info">
                        <div class="name">${p.nombre}</div>
                        <div class="code">${p.codigo_barras || '-'}</div>
                        <div class="stock">Stock: ${formatNumber(stock)}</div>
                    </div>
                    <div class="price">${formatMoney(costo)}</div>
                </div>
            `;
        }).join('');
    }
    dropdown.classList.add('show');
}

function navegarAutocompleteAjuste(event, idx) {
    const dropdown = document.getElementById(`aju-autocomplete-${idx}`);
    const opciones = dropdown.querySelectorAll('.producto-option');
    
    if (!dropdown.classList.contains('show') || opciones.length === 0) return;
    
    if (event.key === 'ArrowDown') {
        event.preventDefault();
        autocompleteIdx = Math.min(autocompleteIdx + 1, opciones.length - 1);
        actualizarSeleccionAuto(opciones);
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        autocompleteIdx = Math.max(autocompleteIdx - 1, 0);
        actualizarSeleccionAuto(opciones);
    } else if (event.key === 'Enter') {
        event.preventDefault();
        if (autocompleteIdx >= 0 && opciones[autocompleteIdx]) {
            opciones[autocompleteIdx].click();
        }
    } else if (event.key === 'Escape') {
        dropdown.classList.remove('show');
    }
}

function actualizarSeleccionAuto(opciones) {
    opciones.forEach((op, i) => {
        op.classList.toggle('selected', i === autocompleteIdx);
    });
    if (autocompleteIdx >= 0 && opciones[autocompleteIdx]) {
        opciones[autocompleteIdx].scrollIntoView({ block: 'nearest' });
    }
}

function seleccionarProductoAjuste(idx, productoId, stockActual, costo) {
    const p = productosData.find(x => x.producto_id === productoId);
    if (!p) return;
    
    lineasAjuste[idx] = {
        producto_id: p.producto_id,
        nombre: p.nombre,
        codigo: p.codigo_barras || '',
        stock_actual: stockActual,
        cantidad: 1,
        costo: costo,
        total: costo
    };
    
    document.getElementById(`aju-autocomplete-${idx}`).classList.remove('show');
    autocompleteIdx = -1;
    renderLineasAjuste();
    
    // Focus en cantidad
    setTimeout(() => {
        const input = document.querySelector(`#tablaLineasAjuste tr[data-idx="${idx}"] input[type="number"]`);
        if (input) { input.focus(); input.select(); }
    }, 50);
}

function calcularTotalesAjuste() {
    const lineasValidas = lineasAjuste.filter(l => l.producto_id);
    const totalProductos = lineasValidas.length;
    const totalUnidades = lineasValidas.reduce((s, l) => s + l.cantidad, 0);
    const costoTotal = lineasValidas.reduce((s, l) => s + l.total, 0);
    
    document.getElementById('ajusteTotalProductos').textContent = totalProductos;
    document.getElementById('ajusteTotalUnidades').textContent = formatNumber(totalUnidades);
    document.getElementById('ajusteCostoTotal').textContent = formatMoney(costoTotal);
}

function cambiarConceptoAjuste() {
    const select = document.getElementById('ajusteConcepto');
    const tipo = select.options[select.selectedIndex]?.dataset.tipo;
    // Podría cambiar UI según si es entrada o salida
}

function limpiarAjuste() {
    document.getElementById('ajusteId').value = '';
    document.getElementById('ajusteAlmacen').value = '';
    document.getElementById('ajusteConcepto').value = '';
    document.getElementById('ajusteFecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('ajusteReferencia').value = '';
    document.getElementById('ajusteNotas').value = '';
    
    lineasAjuste = [];
    agregarLineaAjuste();
    
    document.getElementById('ajusteBadge').textContent = 'Nuevo';
    document.getElementById('ajusteBadge').className = 'badge badge-borrador';
}

async function aplicarAjuste() {
    const almacen = document.getElementById('ajusteAlmacen').value;
    const concepto = document.getElementById('ajusteConcepto').value;
    
    if (!almacen) { toast('Seleccione almacén', 'error'); return; }
    if (!concepto) { toast('Seleccione concepto', 'error'); return; }
    
    const lineasValidas = lineasAjuste.filter(l => l.producto_id && l.cantidad > 0);
    if (lineasValidas.length === 0) { toast('Agregue productos', 'error'); return; }
    
    if (!confirm('¿Aplicar el ajuste de inventario? Esta acción no se puede deshacer.')) return;
    
    try {
        const r = await API.request('/movimientos-inventario/ajuste', 'POST', {
            empresa_id: empresaId,
            sucursal_id: sucursalId,
            almacen_id: almacen,
            concepto_id: concepto,
            usuario_id: usuarioId,
            fecha: document.getElementById('ajusteFecha').value,
            referencia: document.getElementById('ajusteReferencia').value,
            notas: document.getElementById('ajusteNotas').value,
            productos: lineasValidas.map(l => ({
                producto_id: l.producto_id,
                cantidad: l.cantidad,
                costo_unitario: l.costo
            }))
        });
        
        if (r.success) {
            toast('Ajuste aplicado correctamente', 'success');
            limpiarAjuste();
            cargarExistencias();
            cargarMovimientos();
        } else { toast(r.error || 'Error', 'error'); }
    } catch (e) { toast('Error', 'error'); }
}

// ==================== CREAR PRODUCTO ====================
async function guardarProducto() {
    const nombre = document.getElementById('prodNombre').value.trim();
    if (!nombre) { toast('Nombre requerido', 'error'); return; }
    
    try {
        const r = await API.request('/productos', 'POST', {
            empresa_id: empresaId,
            nombre,
            codigo_barras: document.getElementById('prodCodigo').value,
            costo: parseFloat(document.getElementById('prodCosto').value) || 0,
            precio1: parseFloat(document.getElementById('prodPrecio').value) || 0,
            activo: 'Y'
        });
        
        if (r.success) {
            toast('Producto creado', 'success');
            cerrarModal('modalProducto');
            cargarProductos();
            
            // Limpiar form
            document.getElementById('prodNombre').value = '';
            document.getElementById('prodCodigo').value = '';
            document.getElementById('prodCosto').value = '0';
            document.getElementById('prodPrecio').value = '0';
        } else { toast(r.error || 'Error', 'error'); }
    } catch (e) { toast('Error', 'error'); }
}

// ==================== UTILIDADES ====================
function abrirModal(id) {
    document.getElementById(id).classList.add('show');
}

function cerrarModal(id) {
    document.getElementById(id).classList.remove('show');
}

function formatMoney(n) {
    return '$' + (parseFloat(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatNumber(n) {
    return (parseFloat(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

function formatDateTime(d) {
    if (!d) return '-';
    const date = new Date(d);
    return date.toLocaleDateString('es-MX') + ' ' + date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function toast(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'times-circle' : 'info-circle'}"></i> ${msg}`;
    container.appendChild(t);
    setTimeout(() => t.remove(), 4000);
}

function exportarExistencias() {
    // Generar CSV
    let csv = 'Código,Producto,Almacén,Stock,Reservado,Disponible,Costo Promedio,Valor\n';
    existenciasData.forEach(i => {
        const stock = parseFloat(i.stock || 0);
        const costo = parseFloat(i.costo_promedio || 0);
        csv += `"${i.codigo_barras || ''}","${i.producto_nombre}","${i.almacen_nombre}",${stock},${i.stock_reservado || 0},${i.stock_disponible || stock},${costo},${stock * costo}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `existencias_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Archivo exportado', 'success');
}
