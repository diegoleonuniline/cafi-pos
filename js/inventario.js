/* ============================================
   INVENTARIO.JS - CAFI POS
   ============================================ */

const empresaId = localStorage.getItem('empresa_id') || (JSON.parse(localStorage.getItem('usuario') || '{}')).empresa_id;
const sucursalId = localStorage.getItem('sucursal_id') || (JSON.parse(localStorage.getItem('usuario') || '{}')).sucursal_id;
const usuarioId = (JSON.parse(localStorage.getItem('usuario') || '{}')).id;

let almacenesData = [], productosData = [], conceptosData = [];
let existenciasData = [], existenciasFiltradas = [];
let movimientosData = [], movimientosFiltrados = [];
let traspasosData = [];
let lineasAjuste = [], lineasTraspaso = [];
let traspasoActual = null;
let autocompleteIdx = -1;

// ==================== INIT ====================

document.addEventListener('DOMContentLoaded', () => {
    initUsuario();
    initTabs();
    initFiltros();
    cargarDatosIniciales();
});

function initUsuario() {
    const u = JSON.parse(localStorage.getItem('usuario') || '{}');
    document.getElementById('userName').textContent = u.nombre || 'Usuario';
    document.getElementById('userSucursal').textContent = u.sucursal_nombre || 'Sucursal';
    document.getElementById('userAvatar').textContent = (u.nombre || 'US').substring(0, 2).toUpperCase();
}

function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`panel-${tab}`)?.classList.add('active');
            
            if (tab === 'existencias') cargarExistencias();
            if (tab === 'movimientos') cargarMovimientos();
            if (tab === 'traspasos') cargarTraspasos();
        });
    });
}

function initFiltros() {
    const hoy = new Date();
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    document.getElementById('filtroMovDesde').value = inicio.toISOString().split('T')[0];
    document.getElementById('filtroMovHasta').value = hoy.toISOString().split('T')[0];
    document.getElementById('ajusteFecha').value = hoy.toISOString().split('T')[0];
}

async function cargarDatosIniciales() {
    await Promise.all([
        cargarAlmacenes(),
        cargarProductos(),
        cargarConceptos()
    ]);
    cargarExistencias();
}

// ==================== CATALOGOS ====================

async function cargarAlmacenes() {
    try {
        const r = await API.request(`/almacenes/${empresaId}`);
        if (r.success) {
            almacenesData = r.almacenes || [];
            const opts = almacenesData.map(a => `<option value="${a.almacen_id}">${a.nombre}</option>`).join('');
            
            // Filtros existencias
            document.getElementById('filtroAlmacenExist').innerHTML = '<option value="">Todos</option>' + opts;
            // Filtros movimientos
            document.getElementById('filtroAlmacenMov').innerHTML = '<option value="">Todos</option>' + opts;
            // Filtros traspasos
            document.getElementById('filtroOrigenTras').innerHTML = '<option value="">Todos</option>' + opts;
            document.getElementById('filtroDestinoTras').innerHTML = '<option value="">Todos</option>' + opts;
            // Ajuste
            document.getElementById('ajusteAlmacen').innerHTML = '<option value="">Seleccionar...</option>' + opts;
            // Modal traspaso
            document.getElementById('traspasoOrigen').innerHTML = '<option value="">Seleccionar...</option>' + opts;
            document.getElementById('traspasoDestino').innerHTML = '<option value="">Seleccionar...</option>' + opts;
        }
    } catch (e) { console.error('Error cargando almacenes:', e); }
}

async function cargarProductos() {
    try {
        const r = await API.request(`/productos/${empresaId}`);
        if (r.success) {
            productosData = r.productos || r.data || [];
        }
    } catch (e) { console.error('Error cargando productos:', e); }
}

async function cargarConceptos() {
    try {
        const r = await API.request(`/conceptos-inventario/${empresaId}`);
        if (r.success) {
            conceptosData = r.conceptos || [];
            const opts = conceptosData.map(c => `<option value="${c.concepto_id}" data-tipo="${c.tipo}">${c.nombre}</option>`).join('');
            document.getElementById('ajusteConcepto').innerHTML = '<option value="">Seleccionar...</option>' + opts;
            document.getElementById('filtroConceptoMov').innerHTML = '<option value="">Todos</option>' + opts;
        }
    } catch (e) { console.error('Error cargando conceptos:', e); }
}

// ==================== TAB EXISTENCIAS ====================

async function cargarExistencias() {
    const almacen = document.getElementById('filtroAlmacenExist').value;
    const params = new URLSearchParams();
    if (almacen) params.append('almacen_id', almacen);
    
    try {
        const r = await API.request(`/inventario/${empresaId}?${params.toString()}`);
        existenciasData = r.success ? (r.existencias || r.inventario || []) : [];
        existenciasFiltradas = [...existenciasData];
        
        // Stats
        const total = existenciasData.length;
        const conStock = existenciasData.filter(e => parseFloat(e.stock || e.cantidad || 0) > 0).length;
        const stockBajo = existenciasData.filter(e => {
            const stock = parseFloat(e.stock || e.cantidad || 0);
            const minimo = parseFloat(e.stock_minimo || 5);
            return stock > 0 && stock <= minimo;
        }).length;
        const sinStock = existenciasData.filter(e => parseFloat(e.stock || e.cantidad || 0) <= 0).length;
        const valorTotal = existenciasData.reduce((s, e) => {
            const stock = parseFloat(e.stock || e.cantidad || 0);
            const costo = parseFloat(e.costo_promedio || e.costo || 0);
            return s + (stock * costo);
        }, 0);
        
        document.getElementById('statTotalProductos').textContent = total;
        document.getElementById('statConStock').textContent = conStock;
        document.getElementById('statStockBajo').textContent = stockBajo;
        document.getElementById('statSinStock').textContent = sinStock;
        document.getElementById('statValorTotal').textContent = formatMoney(valorTotal);
        
        renderExistencias();
    } catch (e) { 
        console.error('Error cargando existencias:', e);
        existenciasData = []; 
        renderExistencias();
    }
}

function filtrarExistencias() {
    const buscar = document.getElementById('filtroBuscarExist').value.toLowerCase();
    const estado = document.getElementById('filtroEstadoStock').value;
    
    existenciasFiltradas = existenciasData.filter(e => {
        const nombre = (e.producto_nombre || e.nombre || '').toLowerCase();
        const codigo = (e.codigo_barras || e.codigo || '').toLowerCase();
        const matchTexto = !buscar || nombre.includes(buscar) || codigo.includes(buscar);
        
        const stock = parseFloat(e.stock || e.cantidad || 0);
        const minimo = parseFloat(e.stock_minimo || 5);
        let matchEstado = true;
        
        if (estado === 'constock') matchEstado = stock > 0;
        else if (estado === 'bajo') matchEstado = stock > 0 && stock <= minimo;
        else if (estado === 'sinstock') matchEstado = stock <= 0;
        
        return matchTexto && matchEstado;
    });
    
    renderExistencias();
}

function renderExistencias() {
    const tbody = document.getElementById('tablaExistencias');
    const empty = document.getElementById('emptyExistencias');
    
    if (existenciasFiltradas.length === 0) {
        tbody.innerHTML = '';
        empty.classList.add('show');
        document.getElementById('totalExistencias').textContent = '0 productos';
        return;
    }
    
    empty.classList.remove('show');
    tbody.innerHTML = existenciasFiltradas.map(e => {
        const stock = parseFloat(e.stock || e.cantidad || 0);
        const reservado = parseFloat(e.stock_reservado || 0);
        const disponible = stock - reservado;
        const costo = parseFloat(e.costo_promedio || e.costo || 0);
        const valor = stock * costo;
        const minimo = parseFloat(e.stock_minimo || 5);
        
        let badge = '<span class="badge badge-green">Normal</span>';
        if (stock <= 0) badge = '<span class="badge badge-red">Sin Stock</span>';
        else if (stock <= minimo) badge = '<span class="badge badge-orange">Bajo</span>';
        
        return `
            <tr>
                <td><code style="font-size:12px; color:var(--gray-500)">${e.codigo_barras || e.codigo || '-'}</code></td>
                <td><strong>${e.producto_nombre || e.nombre || '-'}</strong></td>
                <td>${e.almacen_nombre || '-'}</td>
                <td class="text-right"><strong>${stock.toFixed(2)}</strong></td>
                <td class="text-right">${reservado.toFixed(2)}</td>
                <td class="text-right" style="color:var(--primary); font-weight:600">${disponible.toFixed(2)}</td>
                <td class="text-right">${formatMoney(costo)}</td>
                <td class="text-right"><strong>${formatMoney(valor)}</strong></td>
                <td class="text-center">${badge}</td>
            </tr>
        `;
    }).join('');
    
    document.getElementById('totalExistencias').textContent = `${existenciasFiltradas.length} productos`;
}

function exportarExistencias() {
    if (existenciasFiltradas.length === 0) {
        toast('No hay datos para exportar', 'error');
        return;
    }
    
    let csv = 'Código,Producto,Almacén,Stock,Reservado,Disponible,Costo Prom.,Valor\n';
    existenciasFiltradas.forEach(e => {
        const stock = parseFloat(e.stock || e.cantidad || 0);
        const reservado = parseFloat(e.stock_reservado || 0);
        const costo = parseFloat(e.costo_promedio || e.costo || 0);
        csv += `"${e.codigo_barras || ''}","${e.producto_nombre || e.nombre}","${e.almacen_nombre || ''}",${stock},${reservado},${stock - reservado},${costo},${stock * costo}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `existencias_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast('Archivo exportado', 'success');
}

// ==================== TAB MOVIMIENTOS ====================

async function cargarMovimientos() {
    const params = new URLSearchParams();
    const almacen = document.getElementById('filtroAlmacenMov').value;
    const concepto = document.getElementById('filtroConceptoMov').value;
    const tipo = document.getElementById('filtroTipoMov').value;
    const desde = document.getElementById('filtroMovDesde').value;
    const hasta = document.getElementById('filtroMovHasta').value;
    
    if (almacen) params.append('almacen_id', almacen);
    if (concepto) params.append('concepto_id', concepto);
    if (tipo) params.append('tipo', tipo);
    if (desde) params.append('desde', desde);
    if (hasta) params.append('hasta', hasta);
    
    try {
        const r = await API.request(`/movimientos-inventario/${empresaId}?${params.toString()}`);
        movimientosData = r.success ? (r.movimientos || []) : [];
        movimientosFiltrados = [...movimientosData];
        renderMovimientos();
    } catch (e) { 
        console.error('Error cargando movimientos:', e);
        movimientosData = []; 
        renderMovimientos();
    }
}

function renderMovimientos() {
    const tbody = document.getElementById('tablaMovimientos');
    const empty = document.getElementById('emptyMovimientos');
    
    if (movimientosFiltrados.length === 0) {
        tbody.innerHTML = '';
        empty.classList.add('show');
        document.getElementById('totalMovimientos').textContent = '0 movimientos';
        return;
    }
    
    empty.classList.remove('show');
    tbody.innerHTML = movimientosFiltrados.map(m => {
        const cantidad = parseFloat(m.cantidad || 0);
        const esEntrada = m.tipo === 'ENTRADA' || cantidad > 0;
        const color = esEntrada ? 'var(--success)' : 'var(--danger)';
        const signo = esEntrada ? '+' : '';
        
        return `
            <tr>
                <td>${formatFecha(m.fecha || m.created_at)}</td>
                <td><span class="badge ${esEntrada ? 'badge-green' : 'badge-red'}">${m.concepto_nombre || m.concepto || '-'}</span></td>
                <td><strong>${m.producto_nombre || '-'}</strong></td>
                <td>${m.almacen_nombre || '-'}</td>
                <td class="text-right" style="color:${color}; font-weight:700">${signo}${cantidad.toFixed(2)}</td>
                <td class="text-right">${parseFloat(m.existencia_anterior || 0).toFixed(2)}</td>
                <td class="text-right"><strong>${parseFloat(m.existencia_nueva || 0).toFixed(2)}</strong></td>
                <td><code style="font-size:11px">${m.referencia || '-'}</code></td>
                <td style="color:var(--gray-500); font-size:12px">${m.usuario_nombre || '-'}</td>
            </tr>
        `;
    }).join('');
    
    document.getElementById('totalMovimientos').textContent = `${movimientosFiltrados.length} movimientos`;
}

// ==================== TAB TRASPASOS ====================

async function cargarTraspasos() {
    const params = new URLSearchParams();
    const estatus = document.getElementById('filtroEstatusTras').value;
    const origen = document.getElementById('filtroOrigenTras').value;
    const destino = document.getElementById('filtroDestinoTras').value;
    
    if (estatus) params.append('estatus', estatus);
    if (origen) params.append('almacen_origen_id', origen);
    if (destino) params.append('almacen_destino_id', destino);
    
    try {
        const r = await API.request(`/traspasos/${empresaId}?${params.toString()}`);
        traspasosData = r.success ? (r.traspasos || []) : [];
        renderTraspasos();
    } catch (e) { 
        console.error('Error cargando traspasos:', e);
        traspasosData = []; 
        renderTraspasos();
    }
}

function renderTraspasos() {
    const tbody = document.getElementById('tablaTraspasos');
    const empty = document.getElementById('emptyTraspasos');
    
    if (traspasosData.length === 0) {
        tbody.innerHTML = '';
        empty.classList.add('show');
        document.getElementById('totalTraspasos').textContent = '0 traspasos';
        return;
    }
    
    empty.classList.remove('show');
    tbody.innerHTML = traspasosData.map(t => {
        return `
            <tr onclick="verTraspaso('${t.traspaso_id}')">
                <td><strong style="color:var(--primary)">${t.folio || t.traspaso_id.substring(0, 8)}</strong></td>
                <td>${formatFecha(t.fecha || t.created_at)}</td>
                <td>${t.almacen_origen_nombre || '-'}</td>
                <td>${t.almacen_destino_nombre || '-'}</td>
                <td class="text-right">${t.num_productos || t.total_productos || 0}</td>
                <td><code style="font-size:11px">${t.referencia || '-'}</code></td>
                <td class="text-center">${getBadgeTraspaso(t.estatus)}</td>
                <td class="text-center">
                    <button class="btn btn-sm" onclick="event.stopPropagation(); verTraspaso('${t.traspaso_id}')" title="Ver"><i class="fas fa-eye"></i></button>
                </td>
            </tr>
        `;
    }).join('');
    
    document.getElementById('totalTraspasos').textContent = `${traspasosData.length} traspasos`;
}

function getBadgeTraspaso(estatus) {
    const map = {
        'BORRADOR': 'badge-gray',
        'SOLICITADO': 'badge-blue',
        'EN_TRANSITO': 'badge-orange',
        'RECIBIDO': 'badge-green',
        'CANCELADO': 'badge-red'
    };
    const labels = {
        'BORRADOR': 'Borrador',
        'SOLICITADO': 'Solicitado',
        'EN_TRANSITO': 'En Tránsito',
        'RECIBIDO': 'Recibido',
        'CANCELADO': 'Cancelado'
    };
    return `<span class="badge ${map[estatus] || 'badge-gray'}">${labels[estatus] || estatus}</span>`;
}

// ==================== TRASPASO MODAL ====================

function nuevoTraspaso() {
    traspasoActual = null;
    lineasTraspaso = [];
    
    document.getElementById('traspasoId').value = '';
    document.getElementById('traspasoOrigen').value = '';
    document.getElementById('traspasoDestino').value = '';
    document.getElementById('traspasoReferencia').value = '';
    document.getElementById('traspasoNotas').value = '';
    document.getElementById('modalTraspasoTitulo').textContent = 'Nuevo Traspaso';
    
    actualizarStatusBarTraspaso('BORRADOR');
    actualizarBotonesTraspaso('BORRADOR');
    
    document.getElementById('traspasoOrigen').disabled = false;
    document.getElementById('traspasoDestino').disabled = false;
    document.getElementById('traspasoLineasActions').style.display = '';
    
    agregarLineaTraspaso();
    abrirModal('modalTraspaso');
}

async function verTraspaso(id) {
    try {
        const r = await API.request(`/traspasos/detalle/${id}`);
        if (r.success) {
            traspasoActual = r.traspaso;
            const t = traspasoActual;
            
            document.getElementById('traspasoId').value = t.traspaso_id;
            document.getElementById('traspasoOrigen').value = t.almacen_origen_id || '';
            document.getElementById('traspasoDestino').value = t.almacen_destino_id || '';
            document.getElementById('traspasoReferencia').value = t.referencia || '';
            document.getElementById('traspasoNotas').value = t.notas || '';
            document.getElementById('modalTraspasoTitulo').textContent = `Traspaso ${t.folio || ''}`;
            
            const editable = t.estatus === 'BORRADOR' || t.estatus === 'SOLICITADO';
            document.getElementById('traspasoOrigen').disabled = !editable;
            document.getElementById('traspasoDestino').disabled = !editable;
            document.getElementById('traspasoLineasActions').style.display = editable ? '' : 'none';
            
            lineasTraspaso = (r.productos || []).map(p => ({
                producto_id: p.producto_id,
                nombre: p.producto_nombre || p.nombre,
                codigo: p.codigo_barras || '',
                disponible: parseFloat(p.stock_disponible || 0),
                cantidad_solicitada: parseFloat(p.cantidad_solicitada || p.cantidad || 0),
                cantidad_enviada: parseFloat(p.cantidad_enviada || 0),
                cantidad_recibida: parseFloat(p.cantidad_recibida || 0),
                detalle_id: p.detalle_id
            }));
            
            actualizarStatusBarTraspaso(t.estatus);
            actualizarBotonesTraspaso(t.estatus);
            renderLineasTraspaso();
            abrirModal('modalTraspaso');
        }
    } catch (e) { toast('Error al cargar traspaso', 'error'); }
}

function actualizarStatusBarTraspaso(estatus) {
    const estados = ['BORRADOR', 'SOLICITADO', 'EN_TRANSITO', 'RECIBIDO'];
    const idx = estados.indexOf(estatus);
    
    document.querySelectorAll('#traspasoStatusBar .step').forEach(step => {
        step.classList.remove('active', 'done');
        const stepIdx = estados.indexOf(step.dataset.status);
        if (stepIdx < idx) step.classList.add('done');
        if (stepIdx === idx) step.classList.add('active');
    });
}

function actualizarBotonesTraspaso(estatus) {
    const esBorrador = estatus === 'BORRADOR';
    const esSolicitado = estatus === 'SOLICITADO';
    const enTransito = estatus === 'EN_TRANSITO';
    
    document.getElementById('btnGuardarTraspaso').style.display = esBorrador ? '' : 'none';
    document.getElementById('btnSolicitarTraspaso').style.display = esBorrador ? '' : 'none';
    document.getElementById('btnEnviarTraspaso').style.display = esSolicitado ? '' : 'none';
    document.getElementById('btnRecibirTraspaso').style.display = enTransito ? '' : 'none';
}

function cambiarAlmacenOrigen() {
    const origenId = document.getElementById('traspasoOrigen').value;
    // Cargar stock disponible cuando cambia el origen
    lineasTraspaso.forEach((l, idx) => {
        if (l.producto_id && origenId) {
            obtenerStockProducto(l.producto_id, origenId, idx);
        }
    });
}

async function obtenerStockProducto(productoId, almacenId, idx) {
    try {
        const r = await API.request(`/inventario/${empresaId}?almacen_id=${almacenId}&producto_id=${productoId}`);
        if (r.success && r.existencias?.length > 0) {
            lineasTraspaso[idx].disponible = parseFloat(r.existencias[0].stock || 0);
            renderLineasTraspaso();
        }
    } catch (e) { /* ignorar */ }
}

function agregarLineaTraspaso() {
    lineasTraspaso.push({
        producto_id: '',
        nombre: '',
        codigo: '',
        disponible: 0,
        cantidad_solicitada: 1,
        cantidad_enviada: 0,
        cantidad_recibida: 0
    });
    renderLineasTraspaso();
}

function renderLineasTraspaso() {
    const tbody = document.getElementById('tablaLineasTraspaso');
    const estatus = traspasoActual?.estatus || 'BORRADOR';
    const editable = estatus === 'BORRADOR' || estatus === 'SOLICITADO';
    const editableEnvio = estatus === 'SOLICITADO';
    const editableRecepcion = estatus === 'EN_TRANSITO';
    
    tbody.innerHTML = lineasTraspaso.map((l, i) => `
        <tr>
            <td>
                <div class="producto-input-wrap">
                    <input type="text" 
                        class="input-producto" 
                        value="${l.nombre}" 
                        placeholder="Buscar producto..." 
                        oninput="buscarProductoTraspaso(${i}, this.value)"
                        onfocus="if(this.value.length > 0) buscarProductoTraspaso(${i}, this.value)"
                        ${editable ? '' : 'disabled'}>
                    ${l.codigo ? `<span class="producto-codigo">${l.codigo}</span>` : ''}
                    <div class="producto-autocomplete" id="autocomplete-tras-${i}"></div>
                </div>
            </td>
            <td class="text-right" style="color:var(--gray-500)">${l.disponible.toFixed(2)}</td>
            <td>
                <input type="number" class="input-number" value="${l.cantidad_solicitada}" min="0.01" step="0.01"
                    oninput="lineasTraspaso[${i}].cantidad_solicitada = parseFloat(this.value) || 0"
                    ${editable ? '' : 'disabled'}>
            </td>
            <td>
                <input type="number" class="input-number" value="${l.cantidad_enviada}" min="0" step="0.01"
                    oninput="lineasTraspaso[${i}].cantidad_enviada = parseFloat(this.value) || 0"
                    ${editableEnvio ? '' : 'disabled'}>
            </td>
            <td>
                <input type="number" class="input-number" value="${l.cantidad_recibida}" min="0" step="0.01"
                    oninput="lineasTraspaso[${i}].cantidad_recibida = parseFloat(this.value) || 0"
                    ${editableRecepcion ? '' : 'disabled'}>
            </td>
            <td>${editable ? `<button class="btn-remove" onclick="quitarLineaTraspaso(${i})"><i class="fas fa-trash"></i></button>` : ''}</td>
        </tr>
    `).join('');
}

function buscarProductoTraspaso(idx, texto) {
    const dropdown = document.getElementById(`autocomplete-tras-${idx}`);
    if (texto.length < 1) { dropdown.classList.remove('show'); return; }
    
    const resultados = productosData.filter(p => 
        (p.nombre?.toLowerCase().includes(texto.toLowerCase())) ||
        (p.codigo_barras?.toLowerCase().includes(texto.toLowerCase()))
    ).slice(0, 8);
    
    if (resultados.length === 0) {
        dropdown.innerHTML = '<div style="padding:12px;text-align:center;color:var(--gray-400)">No encontrado</div>';
    } else {
        dropdown.innerHTML = resultados.map(p => `
            <div class="producto-option" onclick="seleccionarProductoTraspaso(${idx}, '${p.producto_id}')">
                <div class="info">
                    <div class="name">${p.nombre}</div>
                    <div class="code">${p.codigo_barras || '-'}</div>
                </div>
            </div>
        `).join('');
    }
    dropdown.classList.add('show');
}

function seleccionarProductoTraspaso(idx, productoId) {
    const p = productosData.find(x => x.producto_id === productoId);
    if (!p) return;
    
    lineasTraspaso[idx].producto_id = p.producto_id;
    lineasTraspaso[idx].nombre = p.nombre;
    lineasTraspaso[idx].codigo = p.codigo_barras || '';
    
    document.getElementById(`autocomplete-tras-${idx}`).classList.remove('show');
    
    // Obtener stock del almacén origen
    const origenId = document.getElementById('traspasoOrigen').value;
    if (origenId) obtenerStockProducto(productoId, origenId, idx);
    
    renderLineasTraspaso();
}

function quitarLineaTraspaso(idx) {
    lineasTraspaso.splice(idx, 1);
    if (lineasTraspaso.length === 0) agregarLineaTraspaso();
    else renderLineasTraspaso();
}

async function guardarTraspaso(estatus) {
    const origen = document.getElementById('traspasoOrigen').value;
    const destino = document.getElementById('traspasoDestino').value;
    
    if (!origen) { toast('Seleccione almacén origen', 'error'); return; }
    if (!destino) { toast('Seleccione almacén destino', 'error'); return; }
    if (origen === destino) { toast('Origen y destino deben ser diferentes', 'error'); return; }
    
    const lineasValidas = lineasTraspaso.filter(l => l.producto_id && l.cantidad_solicitada > 0);
    if (lineasValidas.length === 0) { toast('Agregue al menos un producto', 'error'); return; }
    
    const id = document.getElementById('traspasoId').value;
    
    const data = {
        empresa_id: empresaId,
        almacen_origen_id: origen,
        almacen_destino_id: destino,
        referencia: document.getElementById('traspasoReferencia').value,
        notas: document.getElementById('traspasoNotas').value,
        estatus,
        usuario_id: usuarioId,
        productos: lineasValidas.map(l => ({
            producto_id: l.producto_id,
            cantidad_solicitada: l.cantidad_solicitada
        }))
    };
    
    try {
        const r = await API.request(id ? `/traspasos/${id}` : '/traspasos', id ? 'PUT' : 'POST', data);
        if (r.success) {
            toast(estatus === 'BORRADOR' ? 'Guardado como borrador' : 'Traspaso solicitado', 'success');
            cerrarModal('modalTraspaso');
            cargarTraspasos();
        } else { toast(r.error || 'Error al guardar', 'error'); }
    } catch (e) { toast('Error de conexión', 'error'); }
}

async function enviarTraspaso() {
    if (!traspasoActual) return;
    
    // Validar cantidades enviadas
    const lineasValidas = lineasTraspaso.filter(l => l.cantidad_enviada > 0);
    if (lineasValidas.length === 0) {
        toast('Ingrese las cantidades a enviar', 'error');
        return;
    }
    
    try {
        const r = await API.request(`/traspasos/${traspasoActual.traspaso_id}/enviar`, 'POST', {
            usuario_id: usuarioId,
            productos: lineasTraspaso.map(l => ({
                producto_id: l.producto_id,
                cantidad_enviada: l.cantidad_enviada
            }))
        });
        if (r.success) {
            toast('Traspaso enviado', 'success');
            cerrarModal('modalTraspaso');
            cargarTraspasos();
        } else { toast(r.error || 'Error al enviar', 'error'); }
    } catch (e) { toast('Error de conexión', 'error'); }
}

async function recibirTraspaso() {
    if (!traspasoActual) return;
    
    // Validar cantidades recibidas
    const lineasValidas = lineasTraspaso.filter(l => l.cantidad_recibida > 0);
    if (lineasValidas.length === 0) {
        toast('Ingrese las cantidades recibidas', 'error');
        return;
    }
    
    try {
        const r = await API.request(`/traspasos/${traspasoActual.traspaso_id}/recibir`, 'POST', {
            usuario_id: usuarioId,
            productos: lineasTraspaso.map(l => ({
                producto_id: l.producto_id,
                cantidad_recibida: l.cantidad_recibida
            }))
        });
        if (r.success) {
            toast('Traspaso recibido', 'success');
            cerrarModal('modalTraspaso');
            cargarTraspasos();
        } else { toast(r.error || 'Error al recibir', 'error'); }
    } catch (e) { toast('Error de conexión', 'error'); }
}

// ==================== TAB AJUSTE ====================

function limpiarAjuste() {
    lineasAjuste = [];
    document.getElementById('ajusteId').value = '';
    document.getElementById('ajusteAlmacen').value = '';
    document.getElementById('ajusteConcepto').value = '';
    document.getElementById('ajusteFecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('ajusteReferencia').value = '';
    document.getElementById('ajusteNotas').value = '';
    document.getElementById('ajusteBadge').textContent = 'Nuevo';
    document.getElementById('ajusteBadge').className = 'badge badge-gray';
    
    actualizarStatusBarAjuste('BORRADOR');
    agregarLineaAjuste();
}

function actualizarStatusBarAjuste(estatus) {
    document.querySelectorAll('#panel-ajuste .step').forEach(step => {
        step.classList.remove('active', 'done');
        if (step.dataset.status === estatus) step.classList.add('active');
        else if (estatus === 'APLICADO' && step.dataset.status === 'BORRADOR') step.classList.add('done');
    });
}

function cambiarAlmacenAjuste() {
    const almacenId = document.getElementById('ajusteAlmacen').value;
    lineasAjuste.forEach((l, idx) => {
        if (l.producto_id && almacenId) {
            obtenerStockAjuste(l.producto_id, almacenId, idx);
        }
    });
}

function cambiarConceptoAjuste() {
    const select = document.getElementById('ajusteConcepto');
    const option = select.options[select.selectedIndex];
    // El tipo se puede usar para mostrar ayuda visual
}

async function obtenerStockAjuste(productoId, almacenId, idx) {
    try {
        const r = await API.request(`/inventario/${empresaId}?almacen_id=${almacenId}&producto_id=${productoId}`);
        if (r.success && r.existencias?.length > 0) {
            lineasAjuste[idx].stock_actual = parseFloat(r.existencias[0].stock || 0);
            lineasAjuste[idx].costo = parseFloat(r.existencias[0].costo_promedio || r.existencias[0].costo || 0);
            renderLineasAjuste();
        }
    } catch (e) { /* ignorar */ }
}

function agregarLineaAjuste() {
    lineasAjuste.push({
        producto_id: '',
        nombre: '',
        codigo: '',
        stock_actual: 0,
        cantidad: 1,
        costo: 0
    });
    renderLineasAjuste();
}

function renderLineasAjuste() {
    const tbody = document.getElementById('tablaLineasAjuste');
    
    tbody.innerHTML = lineasAjuste.map((l, i) => `
        <tr>
            <td>
                <div class="producto-input-wrap">
                    <input type="text" 
                        class="input-producto" 
                        value="${l.nombre}" 
                        placeholder="Buscar producto..." 
                        oninput="buscarProductoAjuste(${i}, this.value)"
                        onfocus="if(this.value.length > 0) buscarProductoAjuste(${i}, this.value)">
                    ${l.codigo ? `<span class="producto-codigo">${l.codigo}</span>` : ''}
                    <div class="producto-autocomplete" id="autocomplete-aj-${i}"></div>
                </div>
            </td>
            <td class="text-right" style="color:var(--gray-500)">${l.stock_actual.toFixed(2)}</td>
            <td>
                <input type="number" class="input-number" value="${l.cantidad}" min="0.01" step="0.01"
                    oninput="actualizarLineaAjuste(${i}, 'cantidad', this.value)">
            </td>
            <td>
                <input type="number" class="input-number" value="${l.costo.toFixed(2)}" min="0" step="0.01"
                    oninput="actualizarLineaAjuste(${i}, 'costo', this.value)">
            </td>
            <td class="text-right" style="font-weight:600; color:var(--primary)">${formatMoney(l.cantidad * l.costo)}</td>
            <td><button class="btn-remove" onclick="quitarLineaAjuste(${i})"><i class="fas fa-trash"></i></button></td>
        </tr>
    `).join('');
    
    calcularTotalesAjuste();
}

function buscarProductoAjuste(idx, texto) {
    const dropdown = document.getElementById(`autocomplete-aj-${idx}`);
    if (texto.length < 1) { dropdown.classList.remove('show'); return; }
    
    const resultados = productosData.filter(p => 
        (p.nombre?.toLowerCase().includes(texto.toLowerCase())) ||
        (p.codigo_barras?.toLowerCase().includes(texto.toLowerCase()))
    ).slice(0, 8);
    
    if (resultados.length === 0) {
        dropdown.innerHTML = '<div style="padding:12px;text-align:center;color:var(--gray-400)">No encontrado</div>';
    } else {
        dropdown.innerHTML = resultados.map(p => `
            <div class="producto-option" onclick="seleccionarProductoAjuste(${idx}, '${p.producto_id}')">
                <div class="info">
                    <div class="name">${p.nombre}</div>
                    <div class="code">${p.codigo_barras || '-'}</div>
                </div>
                <div class="price">${formatMoney(p.costo || 0)}</div>
            </div>
        `).join('');
    }
    dropdown.classList.add('show');
}

function seleccionarProductoAjuste(idx, productoId) {
    const p = productosData.find(x => x.producto_id === productoId);
    if (!p) return;
    
    lineasAjuste[idx].producto_id = p.producto_id;
    lineasAjuste[idx].nombre = p.nombre;
    lineasAjuste[idx].codigo = p.codigo_barras || '';
    lineasAjuste[idx].costo = parseFloat(p.costo || 0);
    
    document.getElementById(`autocomplete-aj-${idx}`).classList.remove('show');
    
    // Obtener stock actual del almacén seleccionado
    const almacenId = document.getElementById('ajusteAlmacen').value;
    if (almacenId) obtenerStockAjuste(productoId, almacenId, idx);
    
    renderLineasAjuste();
}

function actualizarLineaAjuste(idx, campo, valor) {
    lineasAjuste[idx][campo] = parseFloat(valor) || 0;
    calcularTotalesAjuste();
}

function quitarLineaAjuste(idx) {
    lineasAjuste.splice(idx, 1);
    if (lineasAjuste.length === 0) agregarLineaAjuste();
    else renderLineasAjuste();
}

function calcularTotalesAjuste() {
    const lineasValidas = lineasAjuste.filter(l => l.producto_id);
    const totalProductos = lineasValidas.length;
    const totalUnidades = lineasValidas.reduce((s, l) => s + l.cantidad, 0);
    const costoTotal = lineasValidas.reduce((s, l) => s + (l.cantidad * l.costo), 0);
    
    document.getElementById('ajusteTotalProductos').textContent = totalProductos;
    document.getElementById('ajusteTotalUnidades').textContent = totalUnidades.toFixed(2);
    document.getElementById('ajusteCostoTotal').textContent = formatMoney(costoTotal);
}

async function aplicarAjuste() {
    const almacen = document.getElementById('ajusteAlmacen').value;
    const concepto = document.getElementById('ajusteConcepto').value;
    
    if (!almacen) { toast('Seleccione almacén', 'error'); return; }
    if (!concepto) { toast('Seleccione concepto', 'error'); return; }
    
    const lineasValidas = lineasAjuste.filter(l => l.producto_id && l.cantidad > 0);
    if (lineasValidas.length === 0) { toast('Agregue al menos un producto', 'error'); return; }
    
    if (!confirm('¿Aplicar este ajuste de inventario? Esta acción no se puede deshacer.')) return;
    
    try {
        const r = await API.request('/movimientos-inventario/ajuste', 'POST', {
            empresa_id: empresaId,
            almacen_id: almacen,
            concepto_id: concepto,
            fecha: document.getElementById('ajusteFecha').value,
            referencia: document.getElementById('ajusteReferencia').value,
            notas: document.getElementById('ajusteNotas').value,
            usuario_id: usuarioId,
            productos: lineasValidas.map(l => ({
                producto_id: l.producto_id,
                cantidad: l.cantidad,
                costo_unitario: l.costo
            }))
        });
        
        if (r.success) {
            toast('Ajuste aplicado correctamente', 'success');
            document.getElementById('ajusteBadge').textContent = 'Aplicado';
            document.getElementById('ajusteBadge').className = 'badge badge-green';
            actualizarStatusBarAjuste('APLICADO');
            document.getElementById('btnAplicarAjuste').disabled = true;
            cargarExistencias();
        } else { toast(r.error || 'Error al aplicar ajuste', 'error'); }
    } catch (e) { toast('Error de conexión', 'error'); }
}

// ==================== GUARDAR PRODUCTO ====================

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
            document.getElementById('prodNombre').value = '';
            document.getElementById('prodCodigo').value = '';
            document.getElementById('prodCosto').value = '0';
            document.getElementById('prodPrecio').value = '0';
            await cargarProductos();
        } else { toast(r.error || 'Error', 'error'); }
    } catch (e) { toast('Error de conexión', 'error'); }
}

// ==================== UTILS ====================

function abrirModal(id) { document.getElementById(id)?.classList.add('show'); }
function cerrarModal(id) { document.getElementById(id)?.classList.remove('show'); }

function formatMoney(v) {
    return '$' + (parseFloat(v) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatFecha(f) {
    if (!f) return '-';
    return new Date(f).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function toast(msg, tipo = 'success') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = `toast show ${tipo}`;
    setTimeout(() => t.classList.remove('show'), 3000);
}

// Cerrar autocomplete al hacer clic fuera
document.addEventListener('click', e => {
    if (!e.target.closest('.producto-input-wrap')) {
        document.querySelectorAll('.producto-autocomplete').forEach(d => d.classList.remove('show'));
    }
});
