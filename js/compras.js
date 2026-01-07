/* ============================================
   COMPRAS.JS - CAFI STYLE
   ============================================ */

const empresaId = localStorage.getItem('empresa_id') || (JSON.parse(localStorage.getItem('usuario') || '{}')).empresa_id;
const sucursalId = localStorage.getItem('sucursal_id') || (JSON.parse(localStorage.getItem('usuario') || '{}')).sucursal_id;
const usuarioId = (JSON.parse(localStorage.getItem('usuario') || '{}')).id;

let comprasData = [];
let comprasFiltradas = [];
let pagosData = [];
let pagosFiltrados = [];
let proveedoresData = [];
let almacenesData = [];
let productosData = [];
let metodosData = [];
let cuentasData = [];
let productosCompra = [];
let compraActual = null;

// ==================== INIT ====================

document.addEventListener('DOMContentLoaded', () => {
    initUsuario();
    initTabs();
    initFiltros();
    initBusquedaProductos();
    cargarDatosIniciales();
});

function initUsuario() {
    const u = JSON.parse(localStorage.getItem('usuario') || '{}');
    document.getElementById('userName').textContent = u.nombre || 'Usuario';
    document.getElementById('userSucursal').textContent = u.sucursal_nombre || 'Sucursal';
    document.getElementById('userAvatar').textContent = (u.nombre || 'US').substring(0, 2).toUpperCase();
}

function initTabs() {
    document.querySelectorAll('.tab-main').forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            document.querySelectorAll('.tab-main').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`tab-${target}`)?.classList.add('active');
            
            if (target === 'compras') cargarCompras();
            if (target === 'cuentas') cargarCuentasPagar();
            if (target === 'pagos') cargarPagosRealizados();
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

function initBusquedaProductos() {
    const input = document.getElementById('buscarProducto');
    const dropdown = document.getElementById('autocompleteProductos');
    
    input.addEventListener('input', () => {
        const texto = input.value.trim().toLowerCase();
        if (texto.length < 2) { dropdown.classList.remove('show'); return; }
        
        const resultados = productosData.filter(p => 
            (p.nombre?.toLowerCase().includes(texto)) ||
            (p.codigo_barras?.toLowerCase().includes(texto)) ||
            (p.codigo_interno?.toLowerCase().includes(texto))
        ).slice(0, 8);
        
        if (resultados.length === 0) {
            dropdown.innerHTML = '<div style="padding:20px;text-align:center;color:#999">No encontrado</div>';
        } else {
            dropdown.innerHTML = resultados.map(p => `
                <div class="autocomplete-item" onclick="agregarProducto('${p.producto_id}')">
                    <div>
                        <div class="name">${p.nombre}</div>
                        <div class="code">${p.codigo_barras || p.codigo_interno || '-'}</div>
                    </div>
                    <div class="price">${formatMoney(p.costo || p.precio1 || 0)}</div>
                </div>
            `).join('');
        }
        dropdown.classList.add('show');
    });
    
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const texto = input.value.trim().toLowerCase();
            const prod = productosData.find(p => 
                p.codigo_barras?.toLowerCase() === texto || p.codigo_interno?.toLowerCase() === texto
            );
            if (prod) { agregarProducto(prod.producto_id); input.value = ''; dropdown.classList.remove('show'); }
        }
        if (e.key === 'Escape') dropdown.classList.remove('show');
    });
    
    document.addEventListener('click', e => {
        if (!e.target.closest('.productos-search')) dropdown.classList.remove('show');
    });
}

async function cargarDatosIniciales() {
    await Promise.all([
        cargarProveedores(),
        cargarAlmacenes(),
        cargarProductos(),
        cargarMetodosPago(),
        cargarCuentasBancarias()
    ]);
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
            document.getElementById('pagoMetodo').innerHTML = '<option value="">Seleccionar...</option>' + 
                metodosData.map(m => `<option value="${m.metodo_pago_id}">${m.nombre}</option>`).join('');
        }
    } catch (e) { console.error(e); }
}

async function cargarCuentasBancarias() {
    try {
        const r = await API.request(`/cuentas-bancarias/${empresaId}`);
        if (r.success) {
            cuentasData = r.cuentas.filter(c => c.activa === 'Y');
            document.getElementById('pagoCuenta').innerHTML = '<option value="">Sin cuenta</option>' + 
                cuentasData.map(c => `<option value="${c.cuenta_id}">${c.banco} - ${c.numero_cuenta || c.clabe}</option>`).join('');
        }
    } catch (e) { console.error(e); }
}

// ==================== TAB: CREAR COMPRA ====================

function limpiarFormulario() {
    compraActual = null;
    productosCompra = [];
    
    document.getElementById('compraId').value = '';
    document.getElementById('compProveedor').value = '';
    document.getElementById('compAlmacen').value = almacenesData.length === 1 ? almacenesData[0].almacen_id : '';
    document.getElementById('compFechaEntrega').value = '';
    document.getElementById('compFechaVencimiento').value = '';
    document.getElementById('compNotas').value = '';
    document.getElementById('formTitulo').textContent = 'Nueva Compra';
    
    document.getElementById('compProveedor').disabled = false;
    document.getElementById('compAlmacen').disabled = false;
    document.getElementById('buscarProducto').parentElement.style.display = '';
    
    actualizarStatusBar('BORRADOR');
    actualizarBotonesForm();
    renderProductosCompra();
    calcularTotales();
    
    document.getElementById('buscarProducto').focus();
}

function actualizarStatusBar(estatus) {
    document.querySelectorAll('.status-step').forEach(step => {
        step.classList.remove('active', 'done');
        const stepStatus = step.dataset.status;
        const estados = ['BORRADOR', 'PENDIENTE', 'PARCIAL', 'RECIBIDA'];
        const idx = estados.indexOf(estatus);
        const stepIdx = estados.indexOf(stepStatus);
        
        if (stepIdx < idx) step.classList.add('done');
        if (stepIdx === idx) step.classList.add('active');
    });
}

function actualizarBotonesForm() {
    const estatus = compraActual?.estatus || 'BORRADOR';
    const saldo = parseFloat(compraActual?.saldo || 0);
    
    document.getElementById('btnGuardarBorrador').style.display = estatus === 'BORRADOR' ? '' : 'none';
    document.getElementById('btnConfirmar').style.display = estatus === 'BORRADOR' ? '' : 'none';
    document.getElementById('btnRecibir').style.display = ['PENDIENTE', 'PARCIAL'].includes(estatus) ? '' : 'none';
    document.getElementById('btnPagoForm').style.display = saldo > 0 && estatus !== 'CANCELADA' ? '' : 'none';
    document.getElementById('btnCancelarCompra').style.display = !['CANCELADA', 'RECIBIDA'].includes(estatus) && compraActual ? '' : 'none';
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
            document.getElementById('buscarProducto').parentElement.style.display = editable ? '' : 'none';
            
            productosCompra = r.productos.map(p => ({
                producto_id: p.producto_id,
                nombre: p.producto_nombre || p.descripcion,
                codigo: p.codigo_barras,
                cantidad: parseFloat(p.cantidad),
                cantidad_recibida: parseFloat(p.cantidad_recibida || 0),
                costo_unitario: parseFloat(p.costo_unitario),
                iva_pct: parseFloat(p.impuesto_pct || 0),
                subtotal: parseFloat(p.subtotal),
                detalle_id: p.detalle_id
            }));
            
            actualizarStatusBar(c.estatus);
            actualizarBotonesForm();
            renderProductosCompra();
            calcularTotales();
            
            // Ir a tab crear
            document.querySelectorAll('.tab-main').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.querySelector('[data-tab="crear"]').classList.add('active');
            document.getElementById('tab-crear').classList.add('active');
        }
    } catch (e) {
        toast('Error al cargar', 'error');
    }
}

async function guardarCompra(estatus) {
    const proveedor = document.getElementById('compProveedor').value;
    const almacen = document.getElementById('compAlmacen').value;
    
    if (!proveedor) { toast('Seleccione proveedor', 'error'); return; }
    if (!almacen) { toast('Seleccione almacén', 'error'); return; }
    if (productosCompra.length === 0) { toast('Agregue productos', 'error'); return; }
    
    const subtotal = productosCompra.reduce((s, p) => s + p.subtotal, 0);
    const impuestos = productosCompra.reduce((s, p) => s + (p.subtotal * (p.iva_pct || 0) / 100), 0);
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
        subtotal, impuestos, total,
        estatus,
        productos: productosCompra.map(p => ({
            producto_id: p.producto_id,
            descripcion: p.nombre,
            cantidad: p.cantidad,
            costo_unitario: p.costo_unitario,
            subtotal: p.subtotal,
            impuesto_pct: p.iva_pct || 0,
            impuesto_monto: p.subtotal * (p.iva_pct || 0) / 100
        }))
    };
    
    try {
        const r = await API.request(id ? `/compras/${id}` : '/compras', id ? 'PUT' : 'POST', data);
        if (r.success) {
            toast(estatus === 'BORRADOR' ? 'Borrador guardado' : 'Compra confirmada', 'success');
            cargarCompraEnFormulario(id || r.compra_id);
        } else {
            toast(r.error || 'Error', 'error');
        }
    } catch (e) {
        toast('Error al guardar', 'error');
    }
}

async function cancelarCompraActual() {
    if (!compraActual || !confirm('¿Cancelar esta compra?')) return;
    try {
        const r = await API.request(`/compras/cancelar/${compraActual.compra_id}`, 'PUT');
        if (r.success) {
            toast('Compra cancelada', 'success');
            limpiarFormulario();
        }
    } catch (e) { toast('Error', 'error'); }
}

// ==================== PRODUCTOS ====================

function agregarProducto(id) {
    const prod = productosData.find(p => p.producto_id === id);
    if (!prod) return;
    
    const existente = productosCompra.find(p => p.producto_id === id);
    if (existente) {
        existente.cantidad += 1;
        existente.subtotal = existente.cantidad * existente.costo_unitario;
    } else {
        productosCompra.push({
            producto_id: prod.producto_id,
            nombre: prod.nombre,
            codigo: prod.codigo_barras || prod.codigo_interno,
            cantidad: 1,
            cantidad_recibida: 0,
            costo_unitario: parseFloat(prod.costo || prod.precio1 || 0),
            iva_pct: 16,
            subtotal: parseFloat(prod.costo || prod.precio1 || 0)
        });
    }
    
    document.getElementById('buscarProducto').value = '';
    document.getElementById('autocompleteProductos').classList.remove('show');
    
    renderProductosCompra();
    calcularTotales();
    document.getElementById('buscarProducto').focus();
}

function renderProductosCompra() {
    const tbody = document.getElementById('tablaProductosCompra');
    const empty = document.getElementById('emptyProducts');
    const editable = !compraActual || compraActual.estatus === 'BORRADOR';
    
    if (productosCompra.length === 0) {
        tbody.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }
    
    empty.classList.add('hidden');
    
    tbody.innerHTML = productosCompra.map((p, i) => `
        <tr>
            <td>
                <strong>${p.nombre}</strong>
                ${p.codigo ? `<br><small style="color:#999">${p.codigo}</small>` : ''}
            </td>
            <td><input type="number" value="${p.cantidad}" min="1" ${editable ? '' : 'disabled'} onchange="actualizarLinea(${i}, 'cantidad', this.value)"></td>
            <td><input type="number" class="text-right" value="${p.costo_unitario.toFixed(2)}" min="0" step="0.01" ${editable ? '' : 'disabled'} onchange="actualizarLinea(${i}, 'costo', this.value)"></td>
            <td><input type="number" value="${p.iva_pct || 0}" min="0" max="100" ${editable ? '' : 'disabled'} onchange="actualizarLinea(${i}, 'iva', this.value)"></td>
            <td class="text-right"><strong>${formatMoney(p.subtotal + (p.subtotal * (p.iva_pct || 0) / 100))}</strong></td>
            <td>${editable ? `<button class="btn-remove" onclick="quitarLinea(${i})"><i class="fas fa-times"></i></button>` : ''}</td>
        </tr>
    `).join('');
}

function actualizarLinea(i, campo, valor) {
    if (campo === 'cantidad') productosCompra[i].cantidad = parseFloat(valor) || 1;
    else if (campo === 'costo') productosCompra[i].costo_unitario = parseFloat(valor) || 0;
    else if (campo === 'iva') productosCompra[i].iva_pct = parseFloat(valor) || 0;
    
    productosCompra[i].subtotal = productosCompra[i].cantidad * productosCompra[i].costo_unitario;
    renderProductosCompra();
    calcularTotales();
}

function quitarLinea(i) {
    productosCompra.splice(i, 1);
    renderProductosCompra();
    calcularTotales();
}

function calcularTotales() {
    const subtotal = productosCompra.reduce((s, p) => s + p.subtotal, 0);
    const iva = productosCompra.reduce((s, p) => s + (p.subtotal * (p.iva_pct || 0) / 100), 0);
    const total = subtotal + iva;
    
    document.getElementById('compSubtotal').textContent = formatMoney(subtotal);
    document.getElementById('compIVA').textContent = formatMoney(iva);
    document.getElementById('compTotal').textContent = formatMoney(total);
}

// ==================== TAB: COMPRAS ====================

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
        
        renderListView();
        renderKanbanView();
        document.getElementById('totalCompras').textContent = `${comprasData.length} compras`;
        document.getElementById('emptyCompras').classList.toggle('show', comprasData.length === 0);
    } catch (e) {
        console.error(e);
        comprasData = [];
    }
}

function filtrarCompras() {
    const texto = document.getElementById('searchCompras').value.toLowerCase().trim();
    comprasFiltradas = texto ? comprasData.filter(c => 
        `${c.serie || 'C'}-${c.folio}`.toLowerCase().includes(texto) ||
        (c.proveedor_nombre || '').toLowerCase().includes(texto)
    ) : [...comprasData];
    renderListView();
    renderKanbanView();
}

function renderListView() {
    const tbody = document.getElementById('tablaCompras');
    tbody.innerHTML = comprasFiltradas.map(c => `
        <tr onclick="cargarCompraEnFormulario('${c.compra_id}')">
            <td><strong>${c.serie || 'C'}-${c.folio}</strong></td>
            <td>${c.proveedor_nombre || '-'}</td>
            <td>${formatFecha(c.fecha)}</td>
            <td class="text-right"><strong>${formatMoney(c.total)}</strong></td>
            <td class="text-right">${parseFloat(c.saldo) > 0 ? `<span style="color:var(--cafi-danger)">${formatMoney(c.saldo)}</span>` : '<span style="color:var(--cafi-success)">$0.00</span>'}</td>
            <td class="text-center">${getBadge(c.estatus)}</td>
            <td class="text-center">
                <button class="btn btn-sm" onclick="event.stopPropagation(); cargarCompraEnFormulario('${c.compra_id}')"><i class="fas fa-edit"></i></button>
            </td>
        </tr>
    `).join('');
}

function renderKanbanView() {
    const grupos = { BORRADOR: [], PENDIENTE: [], PARCIAL: [], RECIBIDA: [] };
    comprasFiltradas.forEach(c => { if (grupos[c.estatus]) grupos[c.estatus].push(c); });
    
    Object.keys(grupos).forEach(status => {
        const container = document.getElementById(`kanban${status.charAt(0) + status.slice(1).toLowerCase()}`);
        const count = document.getElementById(`count${status.charAt(0) + status.slice(1).toLowerCase()}`);
        
        if (container) {
            container.innerHTML = grupos[status].map(c => `
                <div class="kanban-card" onclick="cargarCompraEnFormulario('${c.compra_id}')">
                    <div class="kanban-card-title">${c.serie || 'C'}-${c.folio}</div>
                    <div class="kanban-card-subtitle">${c.proveedor_nombre || '-'}</div>
                    <div class="kanban-card-footer">
                        <span class="kanban-card-total">${formatMoney(c.total)}</span>
                        ${parseFloat(c.saldo) > 0 ? `<span class="kanban-card-saldo">${formatMoney(c.saldo)}</span>` : ''}
                    </div>
                </div>
            `).join('');
        }
        if (count) count.textContent = grupos[status].length;
    });
}

function cambiarVistaCompras(vista) {
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.view-btn[data-view="${vista}"]`)?.classList.add('active');
    document.querySelectorAll('.view-content').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${vista}`)?.classList.add('active');
}

function getBadge(estatus) {
    const badges = {
        'BORRADOR': '<span class="badge badge-gray">Borrador</span>',
        'PENDIENTE': '<span class="badge badge-orange">Pendiente</span>',
        'PARCIAL': '<span class="badge badge-blue">Parcial</span>',
        'RECIBIDA': '<span class="badge badge-green">Recibida</span>',
        'CANCELADA': '<span class="badge badge-red">Cancelada</span>'
    };
    return badges[estatus] || estatus;
}

// ==================== TAB: CUENTAS POR PAGAR ====================

async function cargarCuentasPagar() {
    const tbody = document.getElementById('tablaCuentas');
    const empty = document.getElementById('emptyCuentas');
    
    try {
        const r = await API.request(`/compras/cuentas-pagar/${empresaId}`);
        if (r.success && r.cuentas?.length) {
            empty.classList.remove('show');
            tbody.innerHTML = r.cuentas.map(c => `
                <tr>
                    <td><strong>${c.proveedor_nombre}</strong></td>
                    <td class="text-center">${c.num_compras}</td>
                    <td class="text-right"><strong style="color:var(--cafi-danger)">${formatMoney(c.saldo_total)}</strong></td>
                    <td class="text-center">${c.proxima_vencimiento ? formatFecha(c.proxima_vencimiento) : '-'}</td>
                    <td class="text-center">
                        <button class="btn btn-sm" onclick="verComprasProveedor('${c.proveedor_id}')"><i class="fas fa-eye"></i> Ver</button>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '';
            empty.classList.add('show');
        }
    } catch (e) {
        tbody.innerHTML = '';
        empty.classList.add('show');
    }
}

function verComprasProveedor(proveedorId) {
    document.getElementById('filtroProveedor').value = proveedorId;
    document.getElementById('filtroEstatus').value = '';
    
    document.querySelectorAll('.tab-main').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('[data-tab="compras"]').classList.add('active');
    document.getElementById('tab-compras').classList.add('active');
    
    cargarCompras();
}

// ==================== TAB: PAGOS REALIZADOS ====================

async function cargarPagosRealizados() {
    const tbody = document.getElementById('tablaPagos');
    const empty = document.getElementById('emptyPagos');
    
    try {
        const params = new URLSearchParams();
        const desde = document.getElementById('filtroPagosDesde').value;
        const hasta = document.getElementById('filtroPagosHasta').value;
        const proveedor = document.getElementById('filtroPagosProveedor').value;
        
        if (desde) params.append('desde', desde);
        if (hasta) params.append('hasta', hasta);
        if (proveedor) params.append('proveedor', proveedor);
        
        const r = await API.request(`/pago-compras/${empresaId}?${params.toString()}`);
        
        if (r.success && r.pagos?.length) {
            pagosData = r.pagos;
            pagosFiltrados = [...pagosData];
            empty.classList.remove('show');
            renderPagosTable();
            
            const totalMonto = pagosData.filter(p => p.estatus === 'APLICADO').reduce((s, p) => s + parseFloat(p.monto), 0);
            document.getElementById('totalPagos').textContent = `${pagosData.length} pagos`;
            document.getElementById('sumaPagos').textContent = `Total: ${formatMoney(totalMonto)}`;
        } else {
            pagosData = [];
            tbody.innerHTML = '';
            empty.classList.add('show');
            document.getElementById('totalPagos').textContent = '0 pagos';
            document.getElementById('sumaPagos').textContent = 'Total: $0.00';
        }
    } catch (e) {
        pagosData = [];
        tbody.innerHTML = '';
        empty.classList.add('show');
    }
}

function filtrarPagos() {
    const texto = document.getElementById('searchPagos').value.toLowerCase().trim();
    pagosFiltrados = texto ? pagosData.filter(p => 
        (p.proveedor_nombre || '').toLowerCase().includes(texto) ||
        (p.referencia || '').toLowerCase().includes(texto) ||
        (p.compra_folio || '').toLowerCase().includes(texto)
    ) : [...pagosData];
    renderPagosTable();
}

function renderPagosTable() {
    document.getElementById('tablaPagos').innerHTML = pagosFiltrados.map(p => `
        <tr>
            <td>${formatFecha(p.fecha_pago)}</td>
            <td>${p.proveedor_nombre || '-'}</td>
            <td>${p.compra_folio || '-'}</td>
            <td>${p.metodo_nombre || '-'}</td>
            <td>${p.referencia || '-'}</td>
            <td class="text-right"><strong>${formatMoney(p.monto)}</strong></td>
            <td class="text-center">${p.estatus === 'APLICADO' ? '<span class="badge badge-green">Aplicado</span>' : '<span class="badge badge-red">Cancelado</span>'}</td>
            <td class="text-center">
                ${p.estatus === 'APLICADO' ? `<button class="btn btn-sm btn-danger" onclick="cancelarPagoRealizado('${p.pago_compra_id}')"><i class="fas fa-times"></i></button>` : ''}
            </td>
        </tr>
    `).join('');
}

async function cancelarPagoRealizado(pagoId) {
    if (!confirm('¿Cancelar este pago?')) return;
    try {
        const r = await API.request(`/pago-compras/cancelar/${pagoId}`, 'PUT');
        if (r.success) {
            toast('Pago cancelado', 'success');
            cargarPagosRealizados();
        }
    } catch (e) { toast('Error', 'error'); }
}

// ==================== RECIBIR ====================

function abrirModalRecibir() {
    if (!compraActual) return;
    
    document.getElementById('tablaRecibir').innerHTML = productosCompra.map(p => {
        const pendiente = p.cantidad - (p.cantidad_recibida || 0);
        return `
            <tr>
                <td>${p.nombre}</td>
                <td class="text-center">${p.cantidad}</td>
                <td class="text-center">${p.cantidad_recibida || 0}</td>
                <td class="text-center">
                    <input type="number" id="rec_${p.detalle_id}" value="${Math.max(0, pendiente)}" min="0" max="${pendiente}" style="width:80px;text-align:center" ${pendiente <= 0 ? 'disabled' : ''}>
                </td>
            </tr>
        `;
    }).join('');
    
    abrirModal('modalRecibir');
}

async function confirmarRecepcion() {
    if (!compraActual) return;
    
    const productos = productosCompra.map(p => ({
        detalle_id: p.detalle_id,
        cantidad_recibir: parseFloat(document.getElementById(`rec_${p.detalle_id}`)?.value || 0)
    })).filter(p => p.cantidad_recibir > 0);
    
    if (!productos.length) { toast('Ingrese cantidades', 'error'); return; }
    
    try {
        const r = await API.request(`/compras/recibir/${compraActual.compra_id}`, 'POST', { productos, usuario_id: usuarioId });
        if (r.success) {
            toast('Mercancía recibida', 'success');
            cerrarModal('modalRecibir');
            cargarCompraEnFormulario(compraActual.compra_id);
        } else { toast(r.error || 'Error', 'error'); }
    } catch (e) { toast('Error', 'error'); }
}

// ==================== PAGOS ====================

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
        
        if (r.success) {
            toast('Pago registrado', 'success');
            cerrarModal('modalPago');
            cargarCompraEnFormulario(compraActual.compra_id);
        } else { toast(r.error || 'Error', 'error'); }
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
