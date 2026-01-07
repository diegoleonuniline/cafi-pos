/* ============================================
   COMPRAS.JS - CAFI POS
   ============================================ */

const empresaId = localStorage.getItem('empresa_id') || (JSON.parse(localStorage.getItem('usuario') || '{}')).empresa_id;
const sucursalId = localStorage.getItem('sucursal_id') || (JSON.parse(localStorage.getItem('usuario') || '{}')).sucursal_id;
const usuarioId = (JSON.parse(localStorage.getItem('usuario') || '{}')).id;

let comprasData = [], comprasFiltradas = [], pagosData = [], pagosFiltrados = [];
let proveedoresData = [], almacenesData = [], productosData = [], metodosData = [], cuentasData = [];
let lineasCompra = [];
let compraActual = null;

// ==================== INIT ====================

document.addEventListener('DOMContentLoaded', () => {
    initUsuario();
    initTabs();
    initNotebook();
    initFiltros();
    cargarDatosIniciales();
    agregarLineaVacia();
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
            
            if (tab === 'compras') cargarCompras();
            if (tab === 'cuentas') cargarCuentasPagar();
            if (tab === 'pagos') cargarPagos();
        });
    });
}

function initNotebook() {
    document.querySelectorAll('.nb-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.nbtab;
            document.querySelectorAll('.nb-tab').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.nb-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`nb-${tab}`)?.classList.add('active');
        });
    });
}

function initFiltros() {
    const hoy = new Date();
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    document.getElementById('filtroDesde').value = inicio.toISOString().split('T')[0];
    document.getElementById('filtroHasta').value = hoy.toISOString().split('T')[0];
    document.getElementById('filtroPagosDesde').value = inicio.toISOString().split('T')[0];
    document.getElementById('filtroPagosHasta').value = hoy.toISOString().split('T')[0];
}

async function cargarDatosIniciales() {
    await Promise.all([cargarProveedores(), cargarAlmacenes(), cargarProductos(), cargarMetodosPago(), cargarCuentasBancarias()]);
}

// ==================== CATALOGOS ====================

async function cargarProveedores() {
    try {
        const r = await API.request(`/proveedores/${empresaId}`);
        if (r.success) {
            proveedoresData = r.proveedores.filter(p => p.activo === 'Y');
            const opts = proveedoresData.map(p => `<option value="${p.proveedor_id}">${p.nombre_comercial}</option>`).join('');
            document.getElementById('filtroProveedor').innerHTML = '<option value="">Proveedor</option>' + opts;
            document.getElementById('filtroPagosProveedor').innerHTML = '<option value="">Proveedor</option>' + opts;
            document.getElementById('compProveedor').innerHTML = '<option value="">Seleccionar proveedor...</option>' + opts;
        }
    } catch (e) { console.error(e); }
}

async function cargarAlmacenes() {
    try {
        const r = await API.request(`/almacenes/${empresaId}`);
        if (r.success) {
            almacenesData = r.almacenes;
            const opts = almacenesData.map(a => `<option value="${a.almacen_id}">${a.sucursal_nombre ? a.sucursal_nombre + ' - ' : ''}${a.nombre}</option>`).join('');
            document.getElementById('compAlmacen').innerHTML = '<option value="">Seleccionar almacén...</option>' + opts;
            if (almacenesData.length === 1) document.getElementById('compAlmacen').value = almacenesData[0].almacen_id;
        }
    } catch (e) { console.error(e); }
}

async function cargarProductos() {
    try {
        const r = await API.request(`/productos/${empresaId}`);
        if (r.success) productosData = r.productos || r.data || [];
    } catch (e) { console.error(e); }
}

async function cargarMetodosPago() {
    try {
        const r = await API.request(`/metodos-pago/${empresaId}`);
        if (r.success) {
            metodosData = r.metodos.filter(m => m.activo === 'Y');
            document.getElementById('pagoMetodo').innerHTML = '<option value="">Seleccionar...</option>' + metodosData.map(m => `<option value="${m.metodo_pago_id}">${m.nombre}</option>`).join('');
        }
    } catch (e) { console.error(e); }
}

async function cargarCuentasBancarias() {
    try {
        const r = await API.request(`/cuentas-bancarias/${empresaId}`);
        if (r.success) {
            cuentasData = r.cuentas.filter(c => c.activa === 'Y');
            document.getElementById('pagoCuenta').innerHTML = '<option value="">Sin cuenta</option>' + cuentasData.map(c => `<option value="${c.cuenta_id}">${c.banco} - ${c.numero_cuenta || c.clabe}</option>`).join('');
        }
    } catch (e) { console.error(e); }
}

// ==================== LINEAS (PRODUCTOS) ====================

function agregarLineaVacia() {
    lineasCompra.push({ producto_id: '', nombre: '', codigo: '', cantidad: 1, unidad: 'Unidades', costo: 0, iva: 16, importe: 0 });
    renderLineas();
}

function renderLineas() {
    const tbody = document.getElementById('tablaLineas');
    const editable = !compraActual || compraActual.estatus === 'BORRADOR';
    
    tbody.innerHTML = lineasCompra.map((l, i) => `
        <tr>
            <td class="producto-cell">
                <div class="producto-input-wrap">
                    <input type="text" class="input-producto" value="${l.nombre}" placeholder="Buscar producto..." 
                        oninput="buscarProductoEnLinea(${i}, this.value)" 
                        onfocus="mostrarAutocompletado(${i})"
                        ${editable ? '' : 'disabled'}>
                    ${l.codigo ? `<div style="font-size:11px;color:#999;margin-top:2px">${l.codigo}</div>` : ''}
                    <div class="producto-autocomplete" id="autocomplete-${i}"></div>
                </div>
            </td>
            <td><input type="number" class="input-number" value="${l.cantidad}" min="1" onchange="actualizarLinea(${i}, 'cantidad', this.value)" ${editable ? '' : 'disabled'}></td>
            <td><span style="color:#666">${l.unidad}</span></td>
            <td><input type="number" class="input-number" value="${l.costo.toFixed(2)}" min="0" step="0.01" onchange="actualizarLinea(${i}, 'costo', this.value)" ${editable ? '' : 'disabled'}></td>
            <td><span class="badge-iva">${l.iva}%</span></td>
            <td class="importe">${formatMoney(l.importe)}</td>
            <td>${editable ? `<button class="btn-remove" onclick="quitarLinea(${i})"><i class="fas fa-trash"></i></button>` : ''}</td>
        </tr>
    `).join('');
    
    calcularTotales();
}

function buscarProductoEnLinea(idx, texto) {
    const dropdown = document.getElementById(`autocomplete-${idx}`);
    if (texto.length < 2) { dropdown.classList.remove('show'); return; }
    
    const resultados = productosData.filter(p => 
        (p.nombre?.toLowerCase().includes(texto.toLowerCase())) ||
        (p.codigo_barras?.toLowerCase().includes(texto.toLowerCase())) ||
        (p.codigo_interno?.toLowerCase().includes(texto.toLowerCase()))
    ).slice(0, 6);
    
    if (resultados.length === 0) {
        dropdown.innerHTML = '<div style="padding:12px;text-align:center;color:#999">No encontrado</div>';
    } else {
        dropdown.innerHTML = resultados.map(p => `
            <div class="producto-option" onclick="seleccionarProductoEnLinea(${idx}, '${p.producto_id}')">
                <div><div class="name">${p.nombre}</div><div class="code">${p.codigo_barras || p.codigo_interno || '-'}</div></div>
                <div class="price">${formatMoney(p.costo || p.precio1 || 0)}</div>
            </div>
        `).join('');
    }
    dropdown.classList.add('show');
}

function mostrarAutocompletado(idx) {
    const texto = lineasCompra[idx].nombre;
    if (texto.length >= 2) buscarProductoEnLinea(idx, texto);
}

function seleccionarProductoEnLinea(idx, productoId) {
    const p = productosData.find(x => x.producto_id === productoId);
    if (!p) return;
    
    lineasCompra[idx] = {
        producto_id: p.producto_id,
        nombre: p.nombre,
        codigo: p.codigo_barras || p.codigo_interno,
        cantidad: lineasCompra[idx].cantidad || 1,
        unidad: 'Unidades',
        costo: parseFloat(p.costo || p.precio1 || 0),
        iva: 16,
        importe: 0
    };
    lineasCompra[idx].importe = lineasCompra[idx].cantidad * lineasCompra[idx].costo * (1 + lineasCompra[idx].iva / 100);
    
    document.getElementById(`autocomplete-${idx}`).classList.remove('show');
    renderLineas();
    
    // Auto agregar nueva línea si es la última
    if (idx === lineasCompra.length - 1) agregarLineaVacia();
}

function actualizarLinea(idx, campo, valor) {
    if (campo === 'cantidad') lineasCompra[idx].cantidad = parseFloat(valor) || 1;
    if (campo === 'costo') lineasCompra[idx].costo = parseFloat(valor) || 0;
    lineasCompra[idx].importe = lineasCompra[idx].cantidad * lineasCompra[idx].costo * (1 + lineasCompra[idx].iva / 100);
    renderLineas();
}

function quitarLinea(idx) {
    if (lineasCompra.length === 1) {
        lineasCompra[0] = { producto_id: '', nombre: '', codigo: '', cantidad: 1, unidad: 'Unidades', costo: 0, iva: 16, importe: 0 };
    } else {
        lineasCompra.splice(idx, 1);
    }
    renderLineas();
}

function calcularTotales() {
    const lineasValidas = lineasCompra.filter(l => l.producto_id);
    const subtotal = lineasValidas.reduce((s, l) => s + (l.cantidad * l.costo), 0);
    const iva = lineasValidas.reduce((s, l) => s + (l.cantidad * l.costo * l.iva / 100), 0);
    const total = subtotal + iva;
    
    document.getElementById('compSubtotal').textContent = formatMoney(subtotal);
    document.getElementById('compIVA').textContent = formatMoney(iva);
    document.getElementById('compTotal').textContent = formatMoney(total);
}

// Cerrar autocomplete al hacer clic fuera
document.addEventListener('click', e => {
    if (!e.target.closest('.producto-cell')) {
        document.querySelectorAll('.producto-autocomplete').forEach(d => d.classList.remove('show'));
    }
});

// ==================== CATALOGO ====================

function abrirCatalogo() {
    renderCatalogo(productosData.slice(0, 30));
    abrirModal('modalCatalogo');
}

function renderCatalogo(productos) {
    document.getElementById('catalogoGrid').innerHTML = productos.map(p => `
        <div class="catalog-item" onclick="agregarDesdeCatalogo('${p.producto_id}')">
            <div class="name">${p.nombre}</div>
            <div class="code">${p.codigo_barras || p.codigo_interno || '-'}</div>
            <div class="price">${formatMoney(p.costo || p.precio1 || 0)}</div>
        </div>
    `).join('');
}

function filtrarCatalogo() {
    const texto = document.getElementById('catalogoBuscar').value.toLowerCase();
    const filtrados = productosData.filter(p => 
        (p.nombre?.toLowerCase().includes(texto)) ||
        (p.codigo_barras?.toLowerCase().includes(texto))
    ).slice(0, 30);
    renderCatalogo(filtrados);
}

function agregarDesdeCatalogo(productoId) {
    const p = productosData.find(x => x.producto_id === productoId);
    if (!p) return;
    
    // Buscar línea vacía o agregar nueva
    let idx = lineasCompra.findIndex(l => !l.producto_id);
    if (idx === -1) {
        lineasCompra.push({ producto_id: '', nombre: '', codigo: '', cantidad: 1, unidad: 'Unidades', costo: 0, iva: 16, importe: 0 });
        idx = lineasCompra.length - 1;
    }
    
    seleccionarProductoEnLinea(idx, productoId);
    cerrarModal('modalCatalogo');
}

// ==================== FORMULARIO ====================

function limpiarFormulario() {
    compraActual = null;
    lineasCompra = [];
    
    document.getElementById('compraId').value = '';
    document.getElementById('compProveedor').value = '';
    document.getElementById('compAlmacen').value = almacenesData.length === 1 ? almacenesData[0].almacen_id : '';
    document.getElementById('compFechaEntrega').value = '';
    document.getElementById('compFechaVencimiento').value = '';
    document.getElementById('compNotas').value = '';
    document.getElementById('formTitulo').textContent = 'Nuevo';
    
    document.getElementById('compProveedor').disabled = false;
    document.getElementById('compAlmacen').disabled = false;
    
    actualizarStatusBar('BORRADOR');
    actualizarBotones();
    agregarLineaVacia();
}

function actualizarStatusBar(estatus) {
    document.querySelectorAll('.statusbar .step').forEach(step => {
        step.classList.remove('active', 'done');
        const estados = ['BORRADOR', 'PENDIENTE', 'PARCIAL', 'RECIBIDA'];
        const idx = estados.indexOf(estatus);
        const stepIdx = estados.indexOf(step.dataset.status);
        if (stepIdx < idx) step.classList.add('done');
        if (stepIdx === idx) step.classList.add('active');
    });
}

function actualizarBotones() {
    const estatus = compraActual?.estatus || 'BORRADOR';
    const saldo = parseFloat(compraActual?.saldo || 0);
    
    document.getElementById('btnGuardar').style.display = estatus === 'BORRADOR' ? '' : 'none';
    document.getElementById('btnConfirmar').style.display = estatus === 'BORRADOR' ? '' : 'none';
    document.getElementById('btnRecibir').style.display = ['PENDIENTE', 'PARCIAL'].includes(estatus) ? '' : 'none';
    document.getElementById('btnPago').style.display = saldo > 0 && estatus !== 'CANCELADA' ? '' : 'none';
    document.getElementById('btnCancelar').style.display = !['CANCELADA', 'RECIBIDA'].includes(estatus) && compraActual ? '' : 'none';
}

async function cargarCompraEnFormulario(id) {
    try {
        const r = await API.request(`/compras/detalle/${id}`);
        if (r.success) {
            compraActual = r.compra;
            compraActual.productos = r.productos;
            compraActual.pagos = r.pagos;
            
            const c = compraActual;
            document.getElementById('compraId').value = c.compra_id;
            document.getElementById('compProveedor').value = c.proveedor_id || '';
            document.getElementById('compAlmacen').value = c.almacen_id || '';
            document.getElementById('compFechaEntrega').value = c.fecha_entrega ? c.fecha_entrega.split('T')[0] : '';
            document.getElementById('compFechaVencimiento').value = c.fecha_vencimiento ? c.fecha_vencimiento.split('T')[0] : '';
            document.getElementById('compNotas').value = c.notas || '';
            document.getElementById('formTitulo').textContent = `${c.serie || 'C'}-${c.folio}`;
            
            const editable = c.estatus === 'BORRADOR';
            document.getElementById('compProveedor').disabled = !editable;
            document.getElementById('compAlmacen').disabled = !editable;
            
            lineasCompra = r.productos.map(p => ({
                producto_id: p.producto_id,
                nombre: p.producto_nombre || p.descripcion,
                codigo: p.codigo_barras,
                cantidad: parseFloat(p.cantidad),
                cantidad_recibida: parseFloat(p.cantidad_recibida || 0),
                unidad: 'Unidades',
                costo: parseFloat(p.costo_unitario),
                iva: parseFloat(p.impuesto_pct || 16),
                importe: parseFloat(p.subtotal) * (1 + parseFloat(p.impuesto_pct || 16) / 100),
                detalle_id: p.detalle_id
            }));
            
            if (editable) agregarLineaVacia();
            
            actualizarStatusBar(c.estatus);
            actualizarBotones();
            renderLineas();
            
            // Ir a tab crear
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            document.querySelector('[data-tab="crear"]').classList.add('active');
            document.getElementById('panel-crear').classList.add('active');
        }
    } catch (e) { toast('Error al cargar', 'error'); }
}

async function guardarCompra(estatus) {
    const proveedor = document.getElementById('compProveedor').value;
    const almacen = document.getElementById('compAlmacen').value;
    
    if (!proveedor) { toast('Seleccione proveedor', 'error'); return; }
    if (!almacen) { toast('Seleccione almacén', 'error'); return; }
    
    const lineasValidas = lineasCompra.filter(l => l.producto_id);
    if (lineasValidas.length === 0) { toast('Agregue productos', 'error'); return; }
    
    const subtotal = lineasValidas.reduce((s, l) => s + (l.cantidad * l.costo), 0);
    const impuestos = lineasValidas.reduce((s, l) => s + (l.cantidad * l.costo * l.iva / 100), 0);
    const total = subtotal + impuestos;
    
    const id = document.getElementById('compraId').value;
    
    const data = {
        empresa_id: empresaId,
        sucursal_id: sucursalId,
        almacen_id: almacen,
        proveedor_id: proveedor,
        usuario_id: usuarioId,
        tipo: 'COMPRA',
        fecha_entrega: document.getElementById('compFechaEntrega').value || null,
        fecha_vencimiento: document.getElementById('compFechaVencimiento').value || null,
        notas: document.getElementById('compNotas').value,
        subtotal, impuestos, total, estatus,
        productos: lineasValidas.map(l => ({
            producto_id: l.producto_id,
            descripcion: l.nombre,
            cantidad: l.cantidad,
            costo_unitario: l.costo,
            subtotal: l.cantidad * l.costo,
            impuesto_pct: l.iva,
            impuesto_monto: l.cantidad * l.costo * l.iva / 100
        }))
    };
    
    try {
        const r = await API.request(id ? `/compras/${id}` : '/compras', id ? 'PUT' : 'POST', data);
        if (r.success) {
            toast(estatus === 'BORRADOR' ? 'Guardado' : 'Confirmado', 'success');
            cargarCompraEnFormulario(id || r.compra_id);
        } else { toast(r.error || 'Error', 'error'); }
    } catch (e) { toast('Error', 'error'); }
}

async function cancelarCompraActual() {
    if (!compraActual || !confirm('¿Cancelar esta compra?')) return;
    try {
        const r = await API.request(`/compras/cancelar/${compraActual.compra_id}`, 'PUT');
        if (r.success) { toast('Cancelada', 'success'); limpiarFormulario(); }
    } catch (e) { toast('Error', 'error'); }
}

// ==================== COMPRAS LIST ====================

async function cargarCompras() {
    try {
        const params = new URLSearchParams();
        const desde = document.getElementById('filtroDesde').value;
        const hasta = document.getElementById('filtroHasta').value;
        const proveedor = document.getElementById('filtroProveedor').value;
        const estatus = document.getElementById('filtroEstatus').value;
        if (desde) params.append('desde', desde);
        if (hasta) params.append('hasta', hasta);
        if (proveedor) params.append('proveedor', proveedor);
        if (estatus) params.append('estatus', estatus);
        
        const r = await API.request(`/compras/${empresaId}?${params.toString()}`);
        comprasData = r.success ? r.compras : [];
        comprasFiltradas = [...comprasData];
        renderComprasList();
        renderComprasKanban();
        document.getElementById('totalCompras').textContent = `${comprasData.length} compras`;
        document.getElementById('emptyCompras').classList.toggle('show', comprasData.length === 0);
    } catch (e) { comprasData = []; }
}

function filtrarCompras() {
    const texto = document.getElementById('searchCompras').value.toLowerCase();
    comprasFiltradas = texto ? comprasData.filter(c => 
        `${c.serie || 'C'}-${c.folio}`.toLowerCase().includes(texto) ||
        (c.proveedor_nombre || '').toLowerCase().includes(texto)
    ) : [...comprasData];
    renderComprasList();
    renderComprasKanban();
}

function renderComprasList() {
    document.getElementById('tablaCompras').innerHTML = comprasFiltradas.map(c => `
        <tr onclick="cargarCompraEnFormulario('${c.compra_id}')">
            <td><strong>${c.serie || 'C'}-${c.folio}</strong></td>
            <td>${c.proveedor_nombre || '-'}</td>
            <td>${formatFecha(c.fecha)}</td>
            <td class="text-right"><strong>${formatMoney(c.total)}</strong></td>
            <td class="text-right">${parseFloat(c.saldo) > 0 ? `<span style="color:var(--danger)">${formatMoney(c.saldo)}</span>` : '<span style="color:var(--success)">$0.00</span>'}</td>
            <td class="text-center">${getBadge(c.estatus)}</td>
        </tr>
    `).join('');
}

function renderComprasKanban() {
    const grupos = { BORRADOR: [], PENDIENTE: [], PARCIAL: [], RECIBIDA: [] };
    comprasFiltradas.forEach(c => { if (grupos[c.estatus]) grupos[c.estatus].push(c); });
    
    ['Borrador', 'Pendiente', 'Parcial', 'Recibida'].forEach(s => {
        const status = s.toUpperCase();
        document.getElementById(`k${s}`).innerHTML = grupos[status].map(c => `
            <div class="k-card" onclick="cargarCompraEnFormulario('${c.compra_id}')">
                <div class="k-card-title">${c.serie || 'C'}-${c.folio}</div>
                <div class="k-card-subtitle">${c.proveedor_nombre || '-'}</div>
                <div class="k-card-footer">
                    <span class="k-card-total">${formatMoney(c.total)}</span>
                    ${parseFloat(c.saldo) > 0 ? `<span class="k-card-saldo">${formatMoney(c.saldo)}</span>` : ''}
                </div>
            </div>
        `).join('');
        document.getElementById(`cnt${s}`).textContent = grupos[status].length;
    });
}

function cambiarVista(vista) {
    document.querySelectorAll('.vs-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.vs-btn[data-view="${vista}"]`)?.classList.add('active');
    document.querySelectorAll('.view-panel').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${vista}`)?.classList.add('active');
}

function getBadge(estatus) {
    const m = { BORRADOR: 'gray', PENDIENTE: 'orange', PARCIAL: 'blue', RECIBIDA: 'green', CANCELADA: 'red' };
    return `<span class="badge badge-${m[estatus] || 'gray'}">${estatus}</span>`;
}

// ==================== CUENTAS POR PAGAR ====================

async function cargarCuentasPagar() {
    try {
        const r = await API.request(`/compras/cuentas-pagar/${empresaId}`);
        const tbody = document.getElementById('tablaCuentas');
        const empty = document.getElementById('emptyCuentas');
        
        if (r.success && r.cuentas?.length) {
            empty.classList.remove('show');
            tbody.innerHTML = r.cuentas.map(c => `
                <tr>
                    <td><strong>${c.proveedor_nombre}</strong></td>
                    <td class="text-center">${c.num_compras}</td>
                    <td class="text-right"><strong style="color:var(--danger)">${formatMoney(c.saldo_total)}</strong></td>
                    <td class="text-center">${c.proxima_vencimiento ? formatFecha(c.proxima_vencimiento) : '-'}</td>
                    <td class="text-center"><button class="btn btn-sm" onclick="verComprasProveedor('${c.proveedor_id}')"><i class="fas fa-eye"></i></button></td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '';
            empty.classList.add('show');
        }
    } catch (e) { document.getElementById('emptyCuentas').classList.add('show'); }
}

function verComprasProveedor(proveedorId) {
    document.getElementById('filtroProveedor').value = proveedorId;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelector('[data-tab="compras"]').classList.add('active');
    document.getElementById('panel-compras').classList.add('active');
    cargarCompras();
}

// ==================== PAGOS ====================

async function cargarPagos() {
    try {
        const params = new URLSearchParams();
        const desde = document.getElementById('filtroPagosDesde').value;
        const hasta = document.getElementById('filtroPagosHasta').value;
        const proveedor = document.getElementById('filtroPagosProveedor').value;
        if (desde) params.append('desde', desde);
        if (hasta) params.append('hasta', hasta);
        if (proveedor) params.append('proveedor', proveedor);
        
        const r = await API.request(`/pago-compras/${empresaId}?${params.toString()}`);
        pagosData = r.success ? r.pagos : [];
        pagosFiltrados = [...pagosData];
        renderPagos();
    } catch (e) { pagosData = []; }
}

function filtrarPagos() {
    const texto = document.getElementById('searchPagos').value.toLowerCase();
    pagosFiltrados = texto ? pagosData.filter(p => 
        (p.proveedor_nombre || '').toLowerCase().includes(texto) ||
        (p.referencia || '').toLowerCase().includes(texto)
    ) : [...pagosData];
    renderPagos();
}

function renderPagos() {
    const tbody = document.getElementById('tablaPagos');
    const empty = document.getElementById('emptyPagos');
    
    if (pagosFiltrados.length === 0) {
        tbody.innerHTML = '';
        empty.classList.add('show');
        document.getElementById('totalPagos').textContent = '0 pagos';
        document.getElementById('sumaPagos').textContent = 'Total: $0.00';
        return;
    }
    
    empty.classList.remove('show');
    tbody.innerHTML = pagosFiltrados.map(p => `
        <tr>
            <td>${formatFecha(p.fecha_pago)}</td>
            <td>${p.proveedor_nombre || '-'}</td>
            <td>${p.compra_folio ? `${p.compra_serie || 'C'}-${p.compra_folio}` : '-'}</td>
            <td>${p.metodo_nombre || '-'}</td>
            <td>${p.referencia || '-'}</td>
            <td class="text-right"><strong>${formatMoney(p.monto)}</strong></td>
            <td class="text-center">${p.estatus === 'APLICADO' ? '<span class="badge badge-green">Aplicado</span>' : '<span class="badge badge-red">Cancelado</span>'}</td>
            <td>${p.estatus === 'APLICADO' ? `<button class="btn btn-sm btn-danger" onclick="cancelarPagoLista('${p.pago_compra_id}')"><i class="fas fa-times"></i></button>` : ''}</td>
        </tr>
    `).join('');
    
    const totalMonto = pagosFiltrados.filter(p => p.estatus === 'APLICADO').reduce((s, p) => s + parseFloat(p.monto), 0);
    document.getElementById('totalPagos').textContent = `${pagosFiltrados.length} pagos`;
    document.getElementById('sumaPagos').textContent = `Total: ${formatMoney(totalMonto)}`;
}

async function cancelarPagoLista(pagoId) {
    if (!confirm('¿Cancelar este pago?')) return;
    try {
        const r = await API.request(`/pago-compras/cancelar/${pagoId}`, 'PUT');
        if (r.success) { toast('Cancelado', 'success'); cargarPagos(); }
    } catch (e) { toast('Error', 'error'); }
}

// ==================== RECIBIR ====================

function abrirModalRecibir() {
    if (!compraActual) return;
    const lineasValidas = lineasCompra.filter(l => l.producto_id);
    document.getElementById('tablaRecibir').innerHTML = lineasValidas.map(l => {
        const pendiente = l.cantidad - (l.cantidad_recibida || 0);
        return `
            <tr>
                <td>${l.nombre}</td>
                <td class="text-center">${l.cantidad}</td>
                <td class="text-center">${l.cantidad_recibida || 0}</td>
                <td class="text-center"><input type="number" id="rec_${l.detalle_id}" value="${Math.max(0, pendiente)}" min="0" max="${pendiente}" style="width:80px;text-align:center" ${pendiente <= 0 ? 'disabled' : ''}></td>
            </tr>
        `;
    }).join('');
    abrirModal('modalRecibir');
}

async function confirmarRecepcion() {
    if (!compraActual) return;
    const lineasValidas = lineasCompra.filter(l => l.producto_id);
    const productos = lineasValidas.map(l => ({
        detalle_id: l.detalle_id,
        cantidad_recibir: parseFloat(document.getElementById(`rec_${l.detalle_id}`)?.value || 0)
    })).filter(p => p.cantidad_recibir > 0);
    
    if (!productos.length) { toast('Ingrese cantidades', 'error'); return; }
    
    try {
        const r = await API.request(`/compras/recibir/${compraActual.compra_id}`, 'POST', { productos, usuario_id: usuarioId });
        if (r.success) { toast('Recibido', 'success'); cerrarModal('modalRecibir'); cargarCompraEnFormulario(compraActual.compra_id); }
        else { toast(r.error || 'Error', 'error'); }
    } catch (e) { toast('Error', 'error'); }
}

// ==================== PAGO ====================

function abrirModalPago() {
    if (!compraActual) return;
    document.getElementById('pagoSaldo').textContent = formatMoney(compraActual.saldo);
    document.getElementById('pagoMonto').value = parseFloat(compraActual.saldo).toFixed(2);
    document.getElementById('pagoMetodo').value = '';
    document.getElementById('pagoCuenta').value = '';
    document.getElementById('pagoReferencia').value = '';
    abrirModal('modalPago');
}

async function guardarPago() {
    if (!compraActual) return;
    const monto = parseFloat(document.getElementById('pagoMonto').value);
    const metodo = document.getElementById('pagoMetodo').value;
    
    if (!monto || monto <= 0) { toast('Monto inválido', 'error'); return; }
    if (!metodo) { toast('Seleccione método', 'error'); return; }
    
    try {
        const r = await API.request('/pago-compras', 'POST', {
            empresa_id: empresaId,
            sucursal_id: sucursalId,
            compra_id: compraActual.compra_id,
            proveedor_id: compraActual.proveedor_id,
            metodo_pago_id: metodo,
            cuenta_bancaria_id: document.getElementById('pagoCuenta').value || null,
            monto,
            referencia: document.getElementById('pagoReferencia').value,
            usuario_id: usuarioId
        });
        if (r.success) { toast('Registrado', 'success'); cerrarModal('modalPago'); cargarCompraEnFormulario(compraActual.compra_id); }
        else { toast(r.error || 'Error', 'error'); }
    } catch (e) { toast('Error', 'error'); }
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
