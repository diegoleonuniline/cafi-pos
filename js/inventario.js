// ============================================
// INVENTARIO.JS - CAFI POS
// ============================================

// Variables globales
let empresaId = localStorage.getItem('empresaId') || 'DEMO';
let sucursalId = localStorage.getItem('sucursalId') || '';
let usuarioId = localStorage.getItem('odooUserId') || '';

// Data arrays
let sucursalesData = [];
let almacenesData = [];
let productosData = [];
let conceptosData = [];
let existenciasData = [];
let existenciasFiltradas = [];
let movimientosData = [];
let traspasosData = [];
let lineasAjuste = [];
let lineasTraspaso = [];
let traspasoEstatus = 'BORRADOR';
let autocompleteIdx = -1;
let confirmCallback = null;

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
    initUsuario();
    initTabs();
    initFiltros();
    cargarDatosIniciales();
});

function initUsuario() {
    const nombre = localStorage.getItem('userName') || 'Usuario';
    const sucursal = localStorage.getItem('sucursalNombre') || 'Sucursal';
    document.getElementById('userName').textContent = nombre;
    document.getElementById('userSucursal').textContent = sucursal;
    document.getElementById('userAvatar').textContent = nombre.substring(0, 2).toUpperCase();
}

function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            const tab = btn.dataset.tab;
            document.getElementById(`panel-${tab}`).classList.add('active');
            
            if (tab === 'existencias') cargarExistencias();
            else if (tab === 'movimientos') cargarMovimientos();
            else if (tab === 'traspasos') cargarTraspasos();
        });
    });
}

function initFiltros() {
    const hoy = new Date();
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    document.getElementById('filtroMovDesde').value = primerDia.toISOString().split('T')[0];
    document.getElementById('filtroMovHasta').value = hoy.toISOString().split('T')[0];
    document.getElementById('ajusteFecha').value = hoy.toISOString().split('T')[0];
}

async function cargarDatosIniciales() {
    try {
        await Promise.all([
            cargarSucursales(),
            cargarAlmacenes(),
            cargarProductos(),
            cargarConceptos()
        ]);
        cargarExistencias();
    } catch (e) {
        console.error('Error cargando datos iniciales:', e);
    }
}

// ==================== SUCURSALES ====================
async function cargarSucursales() {
    try {
        const r = await API.request(`/sucursales/${empresaId}`);
        if (r.success) {
            sucursalesData = r.sucursales || [];
            const opts = sucursalesData.map(s => `<option value="${s.sucursal_id}">${s.nombre}</option>`).join('');
            
            const filtroExist = document.getElementById('filtroSucursalExist');
            if (filtroExist) filtroExist.innerHTML = '<option value="">Todas</option>' + opts;
            
            const filtroMov = document.getElementById('filtroSucursalMov');
            if (filtroMov) filtroMov.innerHTML = '<option value="">Todas</option>' + opts;
            
            const filtroTras = document.getElementById('filtroSucursalTras');
            if (filtroTras) filtroTras.innerHTML = '<option value="">Todas</option>' + opts;
            
            const ajusteSuc = document.getElementById('ajusteSucursal');
            if (ajusteSuc) ajusteSuc.innerHTML = '<option value="">Seleccionar...</option>' + opts;
            
            const trasOrigen = document.getElementById('traspasoSucursalOrigen');
            if (trasOrigen) trasOrigen.innerHTML = '<option value="">Seleccionar...</option>' + opts;
            
            const trasDestino = document.getElementById('traspasoSucursalDestino');
            if (trasDestino) trasDestino.innerHTML = '<option value="">Seleccionar...</option>' + opts;
        }
    } catch (e) {
        console.error('Error cargando sucursales:', e);
    }
}

// ==================== ALMACENES ====================
async function cargarAlmacenes() {
    try {
        const r = await API.request(`/almacenes/${empresaId}`);
        if (r.success) {
            almacenesData = r.almacenes || [];
        }
    } catch (e) {
        console.error('Error cargando almacenes:', e);
    }
}

function filtrarAlmacenesExistencias() {
    const sucursalId = document.getElementById('filtroSucursalExist').value;
    const select = document.getElementById('filtroAlmacenExist');
    
    if (!sucursalId) {
        select.innerHTML = '<option value="">Todos</option>' + 
            almacenesData.map(a => `<option value="${a.almacen_id}">${a.nombre}</option>`).join('');
    } else {
        const filtrados = almacenesData.filter(a => a.sucursal_id === sucursalId);
        select.innerHTML = '<option value="">Todos</option>' + 
            filtrados.map(a => `<option value="${a.almacen_id}">${a.nombre}</option>`).join('');
    }
    cargarExistencias();
}

function filtrarAlmacenesMov() {
    const sucursalId = document.getElementById('filtroSucursalMov').value;
    const select = document.getElementById('filtroAlmacenMov');
    
    if (!sucursalId) {
        select.innerHTML = '<option value="">Todos</option>' + 
            almacenesData.map(a => `<option value="${a.almacen_id}">${a.nombre}</option>`).join('');
    } else {
        const filtrados = almacenesData.filter(a => a.sucursal_id === sucursalId);
        select.innerHTML = '<option value="">Todos</option>' + 
            filtrados.map(a => `<option value="${a.almacen_id}">${a.nombre}</option>`).join('');
    }
    cargarMovimientos();
}

function filtrarAlmacenesTras() {
    const sucursalId = document.getElementById('filtroSucursalTras').value;
    const select = document.getElementById('filtroOrigenTras');
    
    if (!sucursalId) {
        select.innerHTML = '<option value="">Todos</option>' + 
            almacenesData.map(a => `<option value="${a.almacen_id}">${a.nombre}</option>`).join('');
    } else {
        const filtrados = almacenesData.filter(a => a.sucursal_id === sucursalId);
        select.innerHTML = '<option value="">Todos</option>' + 
            filtrados.map(a => `<option value="${a.almacen_id}">${a.nombre}</option>`).join('');
    }
    cargarTraspasos();
}

function filtrarAlmacenesAjuste() {
    const sucursalId = document.getElementById('ajusteSucursal').value;
    const select = document.getElementById('ajusteAlmacen');
    
    if (!sucursalId) {
        select.innerHTML = '<option value="">Seleccionar sucursal primero...</option>';
        return;
    }
    
    const filtrados = almacenesData.filter(a => a.sucursal_id === sucursalId);
    select.innerHTML = '<option value="">Seleccionar...</option>' + 
        filtrados.map(a => `<option value="${a.almacen_id}">${a.nombre}</option>`).join('');
    
    if (filtrados.length === 1) {
        select.value = filtrados[0].almacen_id;
        cambiarAlmacenAjuste();
    }
}

function filtrarAlmacenesOrigenModal() {
    const sucursalId = document.getElementById('traspasoSucursalOrigen').value;
    const select = document.getElementById('traspasoOrigen');
    
    if (!sucursalId) {
        select.innerHTML = '<option value="">Seleccionar sucursal...</option>';
        return;
    }
    
    const filtrados = almacenesData.filter(a => a.sucursal_id === sucursalId);
    select.innerHTML = '<option value="">Seleccionar...</option>' + 
        filtrados.map(a => `<option value="${a.almacen_id}">${a.nombre}</option>`).join('');
}

function filtrarAlmacenesDestinoModal() {
    const sucursalId = document.getElementById('traspasoSucursalDestino').value;
    const select = document.getElementById('traspasoDestino');
    
    if (!sucursalId) {
        select.innerHTML = '<option value="">Seleccionar sucursal...</option>';
        return;
    }
    
    const filtrados = almacenesData.filter(a => a.sucursal_id === sucursalId);
    select.innerHTML = '<option value="">Seleccionar...</option>' + 
        filtrados.map(a => `<option value="${a.almacen_id}">${a.nombre}</option>`).join('');
}

// ==================== PRODUCTOS ====================
async function cargarProductos() {
    try {
        const r = await API.request(`/productos/${empresaId}`);
        if (r.success) {
            productosData = r.productos || [];
        }
    } catch (e) {
        console.error('Error cargando productos:', e);
    }
}

// ==================== CONCEPTOS ====================
async function cargarConceptos() {
    try {
        const r = await API.request(`/conceptos-inventario/${empresaId}`);
        if (r.success) {
            conceptosData = r.conceptos || [];
            
            const optsMov = conceptosData.map(c => `<option value="${c.concepto_id}">${c.nombre}</option>`).join('');
            document.getElementById('filtroConceptoMov').innerHTML = '<option value="">Todos</option>' + optsMov;
            
            const optsAj = conceptosData.map(c => `<option value="${c.concepto_id}" data-tipo="${c.tipo}">${c.nombre}</option>`).join('');
            document.getElementById('ajusteConcepto').innerHTML = '<option value="">Seleccionar...</option>' + optsAj;
        }
    } catch (e) {
        console.error('Error cargando conceptos:', e);
    }
}

// ==================== EXISTENCIAS ====================
async function cargarExistencias() {
    const almacenId = document.getElementById('filtroAlmacenExist').value;
    
    try {
        let url = `/inventario/${empresaId}`;
        if (almacenId) url += `?almacen_id=${almacenId}`;
        
        const r = await API.request(url);
        if (r.success) {
            existenciasData = r.inventario || [];
            calcularStatsExistencias();
            filtrarExistencias();
        }
    } catch (e) {
        console.error('Error cargando existencias:', e);
        existenciasData = [];
        renderExistencias();
    }
}

function calcularStatsExistencias() {
    const total = existenciasData.length;
    const conStock = existenciasData.filter(e => (parseFloat(e.stock) || 0) > 0).length;
    const stockBajo = existenciasData.filter(e => (parseFloat(e.stock) || 0) > 0 && (parseFloat(e.stock) || 0) <= (e.stock_minimo || 5)).length;
    const sinStock = existenciasData.filter(e => (parseFloat(e.stock) || 0) <= 0).length;
    const valorTotal = existenciasData.reduce((sum, e) => sum + ((parseFloat(e.stock) || 0) * (parseFloat(e.costo_promedio) || 0)), 0);
    
    document.getElementById('statTotalProductos').textContent = total;
    document.getElementById('statConStock').textContent = conStock;
    document.getElementById('statStockBajo').textContent = stockBajo;
    document.getElementById('statSinStock').textContent = sinStock;
    document.getElementById('statValorTotal').textContent = formatMoney(valorTotal);
}

function filtrarExistencias() {
    const buscar = document.getElementById('filtroBuscarExist').value.toLowerCase();
    const estado = document.getElementById('filtroEstadoStock').value;
    
    existenciasFiltradas = existenciasData.filter(e => {
        const matchTexto = !buscar || 
            (e.producto_nombre || '').toLowerCase().includes(buscar) ||
            (e.codigo_barras || '').toLowerCase().includes(buscar);
        
        let matchEstado = true;
        if (estado === 'constock') matchEstado = e.stock_actual > 0;
        else if (estado === 'bajo') matchEstado = e.stock_actual > 0 && e.stock_actual <= (e.stock_minimo || 5);
        else if (estado === 'sinstock') matchEstado = e.stock_actual <= 0;
        
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
       const stock = parseFloat(e.stock) || 0;
const reservado = parseFloat(e.stock_reservado) || 0;
const disponible = stock - reservado;
const valor = stock * (parseFloat(e.costo_promedio) || 0);
let badge = '<span class="badge badge-green">Normal</span>';
if (stock <= 0) badge = '<span class="badge badge-red">Sin Stock</span>';
else if (stock <= (e.stock_minimo || 5)) badge = '<span class="badge badge-orange">Bajo</span>';
        
        return `<tr>
            <td><code>${e.codigo_barras || '-'}</code></td>
            <td><strong>${e.producto_nombre || ''}</strong></td>
            <td>${e.almacen_nombre || ''}</td>
           <td class="text-right">${stock.toFixed(2)}</td>
            <td class="text-right">${parseFloat(e.stock_reservado || 0).toFixed(2)}</td>
            <td class="text-right" style="color:var(--primary);font-weight:600;">${disponible.toFixed(2)}</td>
            <td class="text-right">${formatMoney(e.costo_promedio || 0)}</td>
            <td class="text-right">${formatMoney(valor)}</td>
            <td class="text-center">${badge}</td>
        </tr>`;
    }).join('');
    
    document.getElementById('totalExistencias').textContent = `${existenciasFiltradas.length} productos`;
}

function exportarExistencias() {
    if (existenciasFiltradas.length === 0) {
        toast('No hay datos para exportar', 'error');
        return;
    }
    
    let csv = 'Código,Producto,Almacén,Stock,Reservado,Disponible,Costo Prom,Valor\n';
    existenciasFiltradas.forEach(e => {
        const disponible = e.stock_actual - (e.stock_reservado || 0);
        const valor = e.stock_actual * (e.costo_promedio || 0);
        csv += `"${e.codigo_barras || ''}","${e.producto_nombre || ''}","${e.almacen_nombre || ''}",${e.stock_actual || 0},${e.stock_reservado || 0},${disponible},${e.costo_promedio || 0},${valor}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `existencias_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast('Archivo exportado', 'success');
}

// ==================== MOVIMIENTOS ====================
async function cargarMovimientos() {
    const almacenId = document.getElementById('filtroAlmacenMov').value;
    const conceptoId = document.getElementById('filtroConceptoMov').value;
    const tipo = document.getElementById('filtroTipoMov').value;
    const desde = document.getElementById('filtroMovDesde').value;
    const hasta = document.getElementById('filtroMovHasta').value;
    
    try {
        let params = new URLSearchParams();
        if (almacenId) params.append('almacen_id', almacenId);
        if (conceptoId) params.append('concepto_id', conceptoId);
        if (tipo) params.append('tipo', tipo);
        if (desde) params.append('desde', desde);
        if (hasta) params.append('hasta', hasta);
        
        const url = `/movimientos-inventario/${empresaId}?${params.toString()}`;
        const r = await API.request(url);
        
        if (r.success) {
            movimientosData = r.movimientos || [];
            renderMovimientos();
        }
    } catch (e) {
        console.error('Error cargando movimientos:', e);
        movimientosData = [];
        renderMovimientos();
    }
}

function renderMovimientos() {
    const tbody = document.getElementById('tablaMovimientos');
    const empty = document.getElementById('emptyMovimientos');
    
    if (movimientosData.length === 0) {
        tbody.innerHTML = '';
        empty.classList.add('show');
        document.getElementById('totalMovimientos').textContent = '0 movimientos';
        return;
    }
    
    empty.classList.remove('show');
    
    tbody.innerHTML = movimientosData.map(m => {
        const colorCant = m.tipo === 'ENTRADA' ? 'color:var(--success);' : 'color:var(--danger);';
        const signo = m.tipo === 'ENTRADA' ? '+' : '-';
        
        return `<tr>
            <td>${formatFecha(m.fecha)}</td>
            <td>${m.concepto_nombre || ''}</td>
            <td><strong>${m.producto_nombre || ''}</strong></td>
            <td>${m.almacen_nombre || ''}</td>
            <td class="text-right" style="${colorCant}font-weight:600;">${signo}${parseFloat(m.cantidad || 0).toFixed(2)}</td>
            <td class="text-right">${parseFloat(m.existencia_anterior || 0).toFixed(2)}</td>
            <td class="text-right">${parseFloat(m.existencia_nueva || 0).toFixed(2)}</td>
            <td>${m.referencia || '-'}</td>
            <td>${m.usuario_nombre || '-'}</td>
        </tr>`;
    }).join('');
    
    document.getElementById('totalMovimientos').textContent = `${movimientosData.length} movimientos`;
}

// ==================== TRASPASOS ====================
async function cargarTraspasos() {
    const estatus = document.getElementById('filtroEstatusTras').value;
    const origenId = document.getElementById('filtroOrigenTras').value;
    
    try {
        let params = new URLSearchParams();
        if (estatus) params.append('estatus', estatus);
        if (origenId) params.append('almacen_origen_id', origenId);
        
        const url = `/traspasos/${empresaId}?${params.toString()}`;
        const r = await API.request(url);
        
        if (r.success) {
            traspasosData = r.traspasos || [];
            renderTraspasos();
        }
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
        return `<tr onclick="verTraspaso('${t.traspaso_id}')">
            <td><strong>${t.folio || t.traspaso_id}</strong></td>
            <td>${formatFecha(t.fecha)}</td>
            <td>${t.almacen_origen_nombre || ''}</td>
            <td>${t.almacen_destino_nombre || ''}</td>
            <td class="text-right">${t.total_productos || 0}</td>
            <td>${t.referencia || '-'}</td>
            <td class="text-center">${getBadgeTraspaso(t.estatus)}</td>
            <td class="text-center">
                <button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); verTraspaso('${t.traspaso_id}')">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
        </tr>`;
    }).join('');
    
    document.getElementById('totalTraspasos').textContent = `${traspasosData.length} traspasos`;
}

function getBadgeTraspaso(estatus) {
    const badges = {
        'BORRADOR': '<span class="badge badge-gray">Borrador</span>',
        'SOLICITADO': '<span class="badge badge-blue">Solicitado</span>',
        'EN_TRANSITO': '<span class="badge badge-orange">En Tránsito</span>',
        'RECIBIDO': '<span class="badge badge-green">Recibido</span>',
        'CANCELADO': '<span class="badge badge-red">Cancelado</span>'
    };
    return badges[estatus] || '<span class="badge badge-gray">-</span>';
}

function nuevoTraspaso() {
    document.getElementById('traspasoId').value = '';
    document.getElementById('traspasoSucursalOrigen').value = '';
    document.getElementById('traspasoSucursalDestino').value = '';
    document.getElementById('traspasoOrigen').innerHTML = '<option value="">Seleccionar sucursal...</option>';
    document.getElementById('traspasoDestino').innerHTML = '<option value="">Seleccionar sucursal...</option>';
    document.getElementById('traspasoReferencia').value = '';
    document.getElementById('traspasoNotas').value = '';
    document.getElementById('modalTraspasoTitulo').textContent = 'Nuevo Traspaso';
    
    lineasTraspaso = [];
    traspasoEstatus = 'BORRADOR';
    agregarLineaTraspaso();
    
    actualizarStatusBarTraspaso();
    actualizarBotonesTraspaso();
    
    document.getElementById('traspasoLineasActions').style.display = 'flex';
    abrirModal('modalTraspaso');
}

async function verTraspaso(id) {
    try {
        const r = await API.request(`/traspasos/detalle/${id}`);
        if (r.success && r.traspaso) {
            const t = r.traspaso;
            document.getElementById('traspasoId').value = t.traspaso_id;
            document.getElementById('modalTraspasoTitulo').textContent = `Traspaso ${t.folio || t.traspaso_id}`;
            
            if (t.sucursal_origen_id) {
                document.getElementById('traspasoSucursalOrigen').value = t.sucursal_origen_id;
                filtrarAlmacenesOrigenModal();
                setTimeout(() => {
                    document.getElementById('traspasoOrigen').value = t.almacen_origen_id;
                }, 100);
            }
            
            if (t.sucursal_destino_id) {
                document.getElementById('traspasoSucursalDestino').value = t.sucursal_destino_id;
                filtrarAlmacenesDestinoModal();
                setTimeout(() => {
                    document.getElementById('traspasoDestino').value = t.almacen_destino_id;
                }, 100);
            }
            
            document.getElementById('traspasoReferencia').value = t.referencia || '';
            document.getElementById('traspasoNotas').value = t.notas || '';
            
            traspasoEstatus = t.estatus;
            lineasTraspaso = (t.productos || []).map(p => ({
                producto_id: p.producto_id,
                nombre: p.producto_nombre,
                codigo: p.codigo_barras,
                disponible: parseFloat(p.stock_disponible) || 0,
                cantidad_solicitada: parseFloat(p.cantidad_solicitada) || 0,
                cantidad_enviada: parseFloat(p.cantidad_enviada) || 0,
                cantidad_recibida: parseFloat(p.cantidad_recibida) || 0
            }));
            
            actualizarStatusBarTraspaso();
            actualizarBotonesTraspaso();
            renderLineasTraspaso();
            
            document.getElementById('traspasoLineasActions').style.display = 
                traspasoEstatus === 'BORRADOR' ? 'flex' : 'none';
            
            abrirModal('modalTraspaso');
        }
    } catch (e) {
        console.error('Error:', e);
        toast('Error al cargar traspaso', 'error');
    }
}

function actualizarStatusBarTraspaso() {
    const steps = document.querySelectorAll('#traspasoStatusBar .step');
    const statusOrder = ['BORRADOR', 'SOLICITADO', 'EN_TRANSITO', 'RECIBIDO'];
    const currentIdx = statusOrder.indexOf(traspasoEstatus);
    
    steps.forEach((step, idx) => {
        step.classList.remove('active', 'done');
        if (idx < currentIdx) step.classList.add('done');
        else if (idx === currentIdx) step.classList.add('active');
    });
}

function actualizarBotonesTraspaso() {
    const btnGuardar = document.getElementById('btnGuardarTraspaso');
    const btnSolicitar = document.getElementById('btnSolicitarTraspaso');
    const btnEnviar = document.getElementById('btnEnviarTraspaso');
    const btnRecibir = document.getElementById('btnRecibirTraspaso');
    
    btnGuardar.style.display = 'none';
    btnSolicitar.style.display = 'none';
    btnEnviar.style.display = 'none';
    btnRecibir.style.display = 'none';
    
    if (traspasoEstatus === 'BORRADOR') {
        btnGuardar.style.display = 'inline-flex';
        btnSolicitar.style.display = 'inline-flex';
    } else if (traspasoEstatus === 'SOLICITADO') {
        btnEnviar.style.display = 'inline-flex';
    } else if (traspasoEstatus === 'EN_TRANSITO') {
        btnRecibir.style.display = 'inline-flex';
    }
}

function agregarLineaTraspaso() {
    lineasTraspaso.push({
        producto_id: '',
        nombre: '',
        codigo: '',
        disponible: 0,
        cantidad_solicitada: 0,
        cantidad_enviada: 0,
        cantidad_recibida: 0
    });
    renderLineasTraspaso();
}

function renderLineasTraspaso() {
    const tbody = document.getElementById('tablaLineasTraspaso');
    const esBorrador = traspasoEstatus === 'BORRADOR';
    const esSolicitado = traspasoEstatus === 'SOLICITADO';
    const esEnTransito = traspasoEstatus === 'EN_TRANSITO';
    
    tbody.innerHTML = lineasTraspaso.map((l, i) => {
        const disp = parseFloat(l.disponible) || 0;
        const sol = parseFloat(l.cantidad_solicitada) || 0;
        const env = parseFloat(l.cantidad_enviada) || 0;
        const rec = parseFloat(l.cantidad_recibida) || 0;
        
        return `<tr>
            <td>
                <div class="producto-input-wrap">
                    <input type="text" 
                        class="input-producto" 
                        value="${l.nombre || ''}" 
                        placeholder="Buscar producto..." 
                        ${!esBorrador ? 'disabled' : ''}
                        oninput="buscarProductoTraspaso(${i}, this.value)"
                        onkeydown="navegarAutocomplete(event, ${i}, 'traspaso')"
                        onfocus="if(this.value.length > 0) buscarProductoTraspaso(${i}, this.value)">
                    ${l.codigo ? `<span class="producto-codigo">${l.codigo}</span>` : ''}
                    <div class="producto-autocomplete" id="autocomplete-tras-${i}"></div>
                </div>
            </td>
            <td class="text-right">${disp.toFixed(2)}</td>
            <td class="text-right">
                <input type="number" class="input-number" value="${sol}" 
                    ${!esBorrador ? 'disabled' : ''}
                    onchange="actualizarLineaTraspaso(${i}, 'cantidad_solicitada', this.value)" min="0" step="1">
            </td>
            <td class="text-right">
                <input type="number" class="input-number" value="${env}" 
                    ${!esSolicitado ? 'disabled' : ''}
                    onchange="actualizarLineaTraspaso(${i}, 'cantidad_enviada', this.value)" min="0" step="1">
            </td>
            <td class="text-right">
                <input type="number" class="input-number" value="${rec}" 
                    ${!esEnTransito ? 'disabled' : ''}
                    onchange="actualizarLineaTraspaso(${i}, 'cantidad_recibida', this.value)" min="0" step="1">
            </td>
            <td class="text-center">
                ${esBorrador ? `<button class="btn-remove" onclick="eliminarLineaTraspaso(${i})"><i class="fas fa-times"></i></button>` : ''}
            </td>
        </tr>`;
    }).join('');
}

function buscarProductoTraspaso(idx, texto) {
    const dropdown = document.getElementById(`autocomplete-tras-${idx}`);
    
    if (texto.length < 2) {
        dropdown.classList.remove('show');
        return;
    }
    
    const filtrados = productosData.filter(p => 
        p.nombre.toLowerCase().includes(texto.toLowerCase()) ||
        (p.codigo_barras || '').toLowerCase().includes(texto.toLowerCase())
    ).slice(0, 10);
    
    if (filtrados.length === 0) {
        dropdown.classList.remove('show');
        return;
    }
    
    autocompleteIdx = -1;
    dropdown.innerHTML = filtrados.map((p, i) => `
        <div class="producto-option" data-idx="${i}" onclick="seleccionarProductoTraspaso(${idx}, '${p.producto_id}')">
            <div class="info">
                <span class="name">${p.nombre}</span>
                <span class="code">${p.codigo_barras || ''}</span>
            </div>
            <span class="price">${formatMoney(p.costo || 0)}</span>
        </div>
    `).join('');
    dropdown.classList.add('show');
}

async function seleccionarProductoTraspaso(idx, productoId) {
    const producto = productosData.find(p => p.producto_id === productoId);
    if (!producto) return;
    
    lineasTraspaso[idx].producto_id = producto.producto_id;
    lineasTraspaso[idx].nombre = producto.nombre;
    lineasTraspaso[idx].codigo = producto.codigo_barras;
    
    const almacenOrigen = document.getElementById('traspasoOrigen').value;
    if (almacenOrigen) {
        try {
            const r = await API.request(`/inventario/${empresaId}?almacen_id=${almacenOrigen}&producto_id=${productoId}`);
            if (r.success && r.inventario && r.inventario.length > 0) {
                lineasTraspaso[idx].disponible = parseFloat(r.inventario[0].stock_actual) - parseFloat(r.inventario[0].stock_reservado || 0);
            }
        } catch (e) {
            console.error('Error obteniendo stock:', e);
        }
    }
    
    document.getElementById(`autocomplete-tras-${idx}`).classList.remove('show');
    renderLineasTraspaso();
}

function actualizarLineaTraspaso(idx, campo, valor) {
    const num = parseFloat(valor);
    lineasTraspaso[idx][campo] = isNaN(num) ? 0 : num;
}

function eliminarLineaTraspaso(idx) {
    lineasTraspaso.splice(idx, 1);
    renderLineasTraspaso();
}

async function cambiarAlmacenOrigen() {
    const almacenId = document.getElementById('traspasoOrigen').value;
    if (!almacenId) return;
    
    for (let i = 0; i < lineasTraspaso.length; i++) {
        if (lineasTraspaso[i].producto_id) {
            try {
                const r = await API.request(`/inventario/${empresaId}?almacen_id=${almacenId}&producto_id=${lineasTraspaso[i].producto_id}`);
                if (r.success && r.inventario && r.inventario.length > 0) {
                    lineasTraspaso[i].disponible = parseFloat(r.inventario[0].stock_actual) - parseFloat(r.inventario[0].stock_reservado || 0);
                } else {
                    lineasTraspaso[i].disponible = 0;
                }
            } catch (e) {
                lineasTraspaso[i].disponible = 0;
            }
        }
    }
    renderLineasTraspaso();
}

async function guardarTraspaso(estatus) {
    const origenId = document.getElementById('traspasoOrigen').value;
    const destinoId = document.getElementById('traspasoDestino').value;
    
    if (!origenId || !destinoId) {
        toast('Selecciona almacén origen y destino', 'error');
        return;
    }
    
    const productos = lineasTraspaso
        .filter(l => l.producto_id && (parseFloat(l.cantidad_solicitada) || 0) > 0)
        .map(p => ({
            producto_id: p.producto_id,
            cantidad_solicitada: parseFloat(p.cantidad_solicitada) || 0
        }));
    
    if (productos.length === 0) {
        toast('Agrega al menos un producto', 'error');
        return;
    }
    
    const data = {
        empresa_id: empresaId,
        almacen_origen_id: origenId,
        almacen_destino_id: destinoId,
        referencia: document.getElementById('traspasoReferencia').value,
        notas: document.getElementById('traspasoNotas').value,
        estatus: estatus,
        usuario_id: usuarioId,
        productos: productos
    };
    
    try {
        const traspasoId = document.getElementById('traspasoId').value;
        let r;
        
        if (traspasoId) {
            r = await API.request(`/traspasos/${traspasoId}`, 'PUT', data);
        } else {
            r = await API.request('/traspasos', 'POST', data);
        }
        
        if (r.success) {
            toast('Traspaso guardado', 'success');
            cerrarModal('modalTraspaso');
            cargarTraspasos();
        } else {
            toast(r.error || 'Error al guardar', 'error');
        }
    } catch (e) {
        console.error('Error:', e);
        toast('Error al guardar traspaso', 'error');
    }
}

async function enviarTraspaso() {
    const traspasoId = document.getElementById('traspasoId').value;
    if (!traspasoId) return;
    
    const productos = lineasTraspaso
        .filter(l => l.producto_id)
        .map(p => ({
            producto_id: p.producto_id,
            cantidad_enviada: parseFloat(p.cantidad_enviada) || 0
        }));
    
    try {
        const r = await API.request(`/traspasos/${traspasoId}/enviar`, 'POST', {
            usuario_id: usuarioId,
            productos: productos
        });
        
        if (r.success) {
            toast('Traspaso enviado', 'success');
            cerrarModal('modalTraspaso');
            cargarTraspasos();
        } else {
            toast(r.error || 'Error al enviar', 'error');
        }
    } catch (e) {
        console.error('Error:', e);
        toast('Error al enviar traspaso', 'error');
    }
}

async function recibirTraspaso() {
    const traspasoId = document.getElementById('traspasoId').value;
    if (!traspasoId) return;
    
    const productos = lineasTraspaso
        .filter(l => l.producto_id)
        .map(p => ({
            producto_id: p.producto_id,
            cantidad_recibida: parseFloat(p.cantidad_recibida) || 0
        }));
    
    try {
        const r = await API.request(`/traspasos/${traspasoId}/recibir`, 'POST', {
            usuario_id: usuarioId,
            productos: productos
        });
        
        if (r.success) {
            toast('Traspaso recibido', 'success');
            cerrarModal('modalTraspaso');
            cargarTraspasos();
        } else {
            toast(r.error || 'Error al recibir', 'error');
        }
    } catch (e) {
        console.error('Error:', e);
        toast('Error al recibir traspaso', 'error');
    }
}

// ==================== AJUSTE ====================
function limpiarAjuste() {
    document.getElementById('ajusteId').value = '';
    document.getElementById('ajusteSucursal').value = '';
    document.getElementById('ajusteAlmacen').innerHTML = '<option value="">Seleccionar sucursal primero...</option>';
    document.getElementById('ajusteConcepto').value = '';
    document.getElementById('ajusteFecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('ajusteReferencia').value = '';
    document.getElementById('ajusteNotas').value = '';
    document.getElementById('ajusteBadge').textContent = 'Nuevo';
    document.getElementById('ajusteBadge').className = 'badge badge-gray';
    document.getElementById('btnAplicarAjuste').disabled = false;
    
    document.querySelectorAll('#panel-ajuste .step').forEach(step => {
        step.classList.remove('active', 'done');
        if (step.dataset.status === 'BORRADOR') {
            step.classList.add('active');
        }
    });
    
    lineasAjuste = [];
    agregarLineaAjuste();
    calcularTotalesAjuste();
}

function cambiarAlmacenAjuste() {
    lineasAjuste.forEach((l, i) => {
        if (l.producto_id) {
            obtenerStockAjuste(i);
        }
    });
}

function cambiarConceptoAjuste() {
    const select = document.getElementById('ajusteConcepto');
    const selectedOption = select.options[select.selectedIndex];
    const tipo = selectedOption ? selectedOption.dataset.tipo : '';
    console.log('Concepto tipo:', tipo);
}

async function obtenerStockAjuste(idx) {
    const almacenId = document.getElementById('ajusteAlmacen').value;
    const productoId = lineasAjuste[idx].producto_id;
    
    if (!almacenId || !productoId) {
        lineasAjuste[idx].stock_actual = 0;
        lineasAjuste[idx].costo = 0;
        renderLineasAjuste();
        return;
    }
    
    try {
        const r = await API.request(`/inventario/${empresaId}?almacen_id=${almacenId}&producto_id=${productoId}`);
        if (r.success && r.inventario && r.inventario.length > 0) {
            lineasAjuste[idx].stock_actual = parseFloat(r.inventario[0].stock_actual) || 0;
            lineasAjuste[idx].costo = parseFloat(r.inventario[0].costo_promedio) || 0;
        } else {
            lineasAjuste[idx].stock_actual = 0;
            const prod = productosData.find(p => p.producto_id === productoId);
            lineasAjuste[idx].costo = prod ? (parseFloat(prod.costo) || 0) : 0;
        }
        renderLineasAjuste();
    } catch (e) {
        console.error('Error:', e);
    }
}

function agregarLineaAjuste() {
    lineasAjuste.push({
        producto_id: '',
        nombre: '',
        codigo: '',
        stock_actual: 0,
        cantidad: 0,
        costo: 0
    });
    renderLineasAjuste();
}

function renderLineasAjuste() {
    const tbody = document.getElementById('tablaLineasAjuste');
    
    tbody.innerHTML = lineasAjuste.map((l, i) => {
        const stock = parseFloat(l.stock_actual) || 0;
        const cant = parseFloat(l.cantidad) || 0;
        const cost = parseFloat(l.costo) || 0;
        const total = cant * cost;
        
        return `<tr>
            <td>
                <div class="producto-input-wrap">
                    <input type="text" 
                        class="input-producto" 
                        value="${l.nombre || ''}" 
                        placeholder="Buscar producto..." 
                        oninput="buscarProductoAjuste(${i}, this.value)"
                        onkeydown="navegarAutocomplete(event, ${i}, 'ajuste')"
                        onfocus="if(this.value.length > 0) buscarProductoAjuste(${i}, this.value)">
                    ${l.codigo ? `<span class="producto-codigo">${l.codigo}</span>` : ''}
                    <div class="producto-autocomplete" id="autocomplete-aj-${i}"></div>
                </div>
            </td>
            <td class="text-right">${stock.toFixed(2)}</td>
            <td class="text-right">
                <input type="number" class="input-number" value="${cant}" 
                    onchange="actualizarLineaAjuste(${i}, 'cantidad', this.value)" min="0" step="1">
            </td>
            <td class="text-right">
                <input type="number" class="input-number" value="${cost.toFixed(2)}" step="0.01"
                    onchange="actualizarLineaAjuste(${i}, 'costo', this.value)">
            </td>
            <td class="text-right"><strong>${formatMoney(total)}</strong></td>
            <td class="text-center">
                <button class="btn-remove" onclick="eliminarLineaAjuste(${i})"><i class="fas fa-times"></i></button>
            </td>
        </tr>`;
    }).join('');
    
    calcularTotalesAjuste();
}

function buscarProductoAjuste(idx, texto) {
    const dropdown = document.getElementById(`autocomplete-aj-${idx}`);
    
    if (texto.length < 2) {
        dropdown.classList.remove('show');
        return;
    }
    
    const filtrados = productosData.filter(p => 
        p.nombre.toLowerCase().includes(texto.toLowerCase()) ||
        (p.codigo_barras || '').toLowerCase().includes(texto.toLowerCase())
    ).slice(0, 10);
    
    if (filtrados.length === 0) {
        dropdown.classList.remove('show');
        return;
    }
    
    autocompleteIdx = -1;
    dropdown.innerHTML = filtrados.map((p, i) => `
        <div class="producto-option" data-idx="${i}" onclick="seleccionarProductoAjuste(${idx}, '${p.producto_id}')">
            <div class="info">
                <span class="name">${p.nombre}</span>
                <span class="code">${p.codigo_barras || ''}</span>
            </div>
            <span class="price">${formatMoney(p.costo || 0)}</span>
        </div>
    `).join('');
    dropdown.classList.add('show');
}

async function seleccionarProductoAjuste(idx, productoId) {
    const producto = productosData.find(p => p.producto_id === productoId);
    if (!producto) return;
    
    lineasAjuste[idx].producto_id = producto.producto_id;
    lineasAjuste[idx].nombre = producto.nombre;
    lineasAjuste[idx].codigo = producto.codigo_barras;
    lineasAjuste[idx].costo = parseFloat(producto.costo) || 0;
    
    document.getElementById(`autocomplete-aj-${idx}`).classList.remove('show');
    
    await obtenerStockAjuste(idx);
}

function actualizarLineaAjuste(idx, campo, valor) {
    const num = parseFloat(valor);
    lineasAjuste[idx][campo] = isNaN(num) ? 0 : num;
    renderLineasAjuste();
}

function eliminarLineaAjuste(idx) {
    lineasAjuste.splice(idx, 1);
    if (lineasAjuste.length === 0) agregarLineaAjuste();
    else renderLineasAjuste();
}

function calcularTotalesAjuste() {
    const prods = lineasAjuste.filter(l => l.producto_id);
    const totalProductos = prods.length;
    const totalUnidades = prods.reduce((sum, l) => sum + (parseFloat(l.cantidad) || 0), 0);
    const costoTotal = prods.reduce((sum, l) => sum + ((parseFloat(l.cantidad) || 0) * (parseFloat(l.costo) || 0)), 0);
    
    document.getElementById('ajusteTotalProductos').textContent = totalProductos;
    document.getElementById('ajusteTotalUnidades').textContent = totalUnidades;
    document.getElementById('ajusteCostoTotal').textContent = formatMoney(costoTotal);
}

async function aplicarAjuste() {
    const almacenId = document.getElementById('ajusteAlmacen').value;
    const conceptoId = document.getElementById('ajusteConcepto').value;
    
    if (!almacenId) {
        toast('Selecciona un almacén', 'error');
        return;
    }
    if (!conceptoId) {
        toast('Selecciona un concepto', 'error');
        return;
    }
    
    const productos = lineasAjuste
        .filter(l => l.producto_id && (parseFloat(l.cantidad) || 0) > 0)
        .map(p => ({
            producto_id: p.producto_id,
            cantidad: parseFloat(p.cantidad) || 0,
            costo: parseFloat(p.costo) || 0
        }));
    
    if (productos.length === 0) {
        toast('Agrega al menos un producto con cantidad', 'error');
        return;
    }
    
    for (let p of productos) {
        if (isNaN(p.cantidad) || isNaN(p.costo)) {
            toast('Error: valores inválidos en productos', 'error');
            console.error('Producto con NaN:', p);
            return;
        }
    }
    
    const conceptoSelect = document.getElementById('ajusteConcepto');
    const selectedOption = conceptoSelect.options[conceptoSelect.selectedIndex];
    const tipo = selectedOption.dataset.tipo;
    
    mostrarConfirm('¿Aplicar ajuste de ' + productos.length + ' producto(s)?<br>Esta acción no se puede deshacer.', async () => {
        const data = {
            empresa_id: empresaId,
            almacen_id: almacenId,
            concepto_id: conceptoId,
            tipo: tipo,
            fecha: document.getElementById('ajusteFecha').value,
            referencia: document.getElementById('ajusteReferencia').value || '',
            notas: document.getElementById('ajusteNotas').value || '',
            usuario_id: usuarioId || '',
            productos: productos
        };
        
        console.log('Enviando ajuste:', JSON.stringify(data, null, 2));
        
        try {
            const r = await API.request('/movimientos-inventario/ajuste', 'POST', data);
            if (r.success) {
                toast('Ajuste aplicado correctamente', 'success');
                document.getElementById('ajusteBadge').textContent = 'Aplicado';
                document.getElementById('ajusteBadge').className = 'badge badge-green';
                document.getElementById('btnAplicarAjuste').disabled = true;
                
                document.querySelectorAll('#panel-ajuste .step').forEach(step => {
                    if (step.dataset.status === 'BORRADOR') {
                        step.classList.remove('active');
                        step.classList.add('done');
                    } else if (step.dataset.status === 'APLICADO') {
                        step.classList.add('active');
                    }
                });
            } else {
                toast(r.error || 'Error al aplicar ajuste', 'error');
            }
        } catch (e) {
            console.error('Error:', e);
            toast('Error al aplicar ajuste', 'error');
        }
    });
}

// ==================== NAVEGACIÓN TECLADO AUTOCOMPLETE ====================
function navegarAutocomplete(event, idx, tipo) {
    const dropdownId = tipo === 'ajuste' ? 'autocomplete-aj-' + idx : 'autocomplete-tras-' + idx;
    const dropdown = document.getElementById(dropdownId);
    const opciones = dropdown.querySelectorAll('.producto-option');
    
    if (!dropdown.classList.contains('show') || opciones.length === 0) {
        if (event.key === 'Tab') return;
        return;
    }
    
    if (event.key === 'ArrowDown') {
        event.preventDefault();
        autocompleteIdx = Math.min(autocompleteIdx + 1, opciones.length - 1);
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        autocompleteIdx = Math.max(autocompleteIdx - 1, 0);
    } else if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        if (autocompleteIdx >= 0 && opciones[autocompleteIdx]) {
            opciones[autocompleteIdx].click();
        } else if (opciones.length > 0) {
            opciones[0].click();
        }
        return;
    } else if (event.key === 'Escape') {
        dropdown.classList.remove('show');
        autocompleteIdx = -1;
        return;
    } else {
        return;
    }
    
    opciones.forEach((op, i) => op.classList.toggle('selected', i === autocompleteIdx));
    if (autocompleteIdx >= 0 && opciones[autocompleteIdx]) {
        opciones[autocompleteIdx].scrollIntoView({ block: 'nearest' });
    }
}

// ==================== MODAL CONFIRM ====================
function mostrarConfirm(mensaje, callback) {
    document.getElementById('confirmMessage').innerHTML = mensaje;
    confirmCallback = callback;
    document.getElementById('modalConfirm').classList.add('show');
}

function cerrarConfirm(aceptar) {
    document.getElementById('modalConfirm').classList.remove('show');
    if (aceptar && confirmCallback) {
        confirmCallback();
    }
    confirmCallback = null;
}

// ==================== UTILITIES ====================
function formatMoney(value) {
    const num = parseFloat(value) || 0;
    return '$' + num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatFecha(fecha) {
    if (!fecha) return '-';
    const d = new Date(fecha);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function toast(msg, tipo) {
    tipo = tipo || 'success';
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast ' + tipo;
    t.classList.add('show');
    setTimeout(function() { t.classList.remove('show'); }, 3000);
}

function abrirModal(id) {
    document.getElementById(id).classList.add('show');
}

function cerrarModal(id) {
    document.getElementById(id).classList.remove('show');
}

// Cerrar dropdowns al hacer clic fuera
document.addEventListener('click', function(e) {
    if (!e.target.closest('.producto-input-wrap')) {
        document.querySelectorAll('.producto-autocomplete').forEach(function(d) { d.classList.remove('show'); });
        autocompleteIdx = -1;
    }
});
