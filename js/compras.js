/* ============================================
   COMPRAS.JS - ODOO STYLE
   ============================================ */

const empresaId = localStorage.getItem('empresa_id') || (JSON.parse(localStorage.getItem('usuario') || '{}')).empresa_id;
const sucursalId = localStorage.getItem('sucursal_id') || (JSON.parse(localStorage.getItem('usuario') || '{}')).sucursal_id;
const usuarioId = (JSON.parse(localStorage.getItem('usuario') || '{}')).id;

let comprasData = [];
let comprasFiltradas = [];
let proveedoresData = [];
let almacenesData = [];
let productosData = [];
let metodosData = [];
let cuentasData = [];
let productosCompra = [];
let compraActual = null;
let vistaActual = 'list';

// ==================== INIT ====================

document.addEventListener('DOMContentLoaded', () => {
    initUsuario();
    initFiltros();
    initNotebook();
    initBusquedaProductos();
    cargarDatosIniciales();
});

function initUsuario() {
    const u = JSON.parse(localStorage.getItem('usuario') || '{}');
    document.getElementById('userName').textContent = u.nombre || 'Usuario';
    document.getElementById('userSucursal').textContent = u.sucursal_nombre || 'Sucursal';
    document.getElementById('userAvatar').textContent = (u.nombre || 'US').substring(0, 2).toUpperCase();
}

function initFiltros() {
    const hoy = new Date();
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    document.getElementById('filtroDesde').value = inicio.toISOString().split('T')[0];
    document.getElementById('filtroHasta').value = hoy.toISOString().split('T')[0];
}

function initNotebook() {
    document.querySelectorAll('.o-notebook-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            document.querySelectorAll('.o-notebook-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.o-notebook-page').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`tab-${target}`)?.classList.add('active');
        });
    });
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
            dropdown.innerHTML = '<div style="padding:16px;text-align:center;color:#999">No encontrado</div>';
        } else {
            dropdown.innerHTML = resultados.map(p => `
                <div class="o-autocomplete-item" onclick="agregarProducto('${p.producto_id}')">
                    <div>
                        <div class="o-autocomplete-name">${p.nombre}</div>
                        <div class="o-autocomplete-code">${p.codigo_barras || p.codigo_interno || '-'}</div>
                    </div>
                    <div class="o-autocomplete-price">${formatMoney(p.costo || p.precio1 || 0)}</div>
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
        if (!e.target.closest('.o-list-add')) dropdown.classList.remove('show');
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
    cargarCompras();
}

// ==================== CATALOGOS ====================

async function cargarProveedores() {
    try {
        const r = await API.request(`/proveedores/${empresaId}`);
        if (r.success) {
            proveedoresData = r.proveedores.filter(p => p.activo === 'Y');
            const opts = proveedoresData.map(p => `<option value="${p.proveedor_id}">${p.nombre_comercial}</option>`).join('');
            document.getElementById('filtroProveedor').innerHTML = '<option value="">Proveedor</option>' + opts;
            document.getElementById('compProveedor').innerHTML = '<option value="">Seleccionar...</option>' + opts;
        }
    } catch (e) { console.error(e); }
}

async function cargarAlmacenes() {
    try {
        const r = await API.request(`/almacenes/${empresaId}`);
        if (r.success) {
            almacenesData = r.almacenes;
            const opts = almacenesData.map(a => `<option value="${a.almacen_id}">${a.sucursal_nombre ? a.sucursal_nombre + ' - ' : ''}${a.nombre}</option>`).join('');
            document.getElementById('compAlmacen').innerHTML = '<option value="">Seleccionar...</option>' + opts;
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

// ==================== COMPRAS ====================

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
        document.getElementById('totalRegistros').textContent = `${comprasData.length} registros`;
    } catch (e) {
        console.error(e);
        comprasData = [];
        comprasFiltradas = [];
    }
}

function filtrarCompras() {
    const texto = document.getElementById('searchInput').value.toLowerCase().trim();
    if (!texto) {
        comprasFiltradas = [...comprasData];
    } else {
        comprasFiltradas = comprasData.filter(c => 
            `${c.serie || 'C'}-${c.folio}`.toLowerCase().includes(texto) ||
            (c.proveedor_nombre || '').toLowerCase().includes(texto)
        );
    }
    renderListView();
    renderKanbanView();
}

function renderListView() {
    const tbody = document.getElementById('tablaCompras');
    const empty = document.getElementById('emptyState');
    
    if (comprasFiltradas.length === 0) {
        tbody.innerHTML = '';
        empty.classList.add('show');
        return;
    }
    
    empty.classList.remove('show');
    tbody.innerHTML = comprasFiltradas.map(c => `
        <tr onclick="abrirCompra('${c.compra_id}')">
            <td class="o-list-checkbox" onclick="event.stopPropagation()"><input type="checkbox" data-id="${c.compra_id}"></td>
            <td><strong>${c.serie || 'C'}-${c.folio}</strong></td>
            <td>${c.proveedor_nombre || '-'}</td>
            <td>${formatFecha(c.fecha)}</td>
            <td>${c.fecha_entrega ? formatFecha(c.fecha_entrega) : '-'}</td>
            <td class="text-right"><strong>${formatMoney(c.total)}</strong></td>
            <td class="text-right">${parseFloat(c.saldo) > 0 ? `<span style="color:var(--o-danger)">${formatMoney(c.saldo)}</span>` : '<span style="color:var(--o-success)">$0.00</span>'}</td>
            <td class="text-center">${getBadge(c.estatus)}</td>
        </tr>
    `).join('');
}

function renderKanbanView() {
    const grupos = {
        BORRADOR: [],
        PENDIENTE: [],
        PARCIAL: [],
        RECIBIDA: []
    };
    
    comprasFiltradas.forEach(c => {
        if (grupos[c.estatus]) grupos[c.estatus].push(c);
    });
    
    Object.keys(grupos).forEach(status => {
        const container = document.getElementById(`kanban${status.charAt(0) + status.slice(1).toLowerCase()}`);
        const count = document.getElementById(`count${status.charAt(0) + status.slice(1).toLowerCase()}`);
        
        if (container) {
            container.innerHTML = grupos[status].map(c => `
                <div class="o-kanban-card" onclick="abrirCompra('${c.compra_id}')">
                    <div class="o-kanban-card-title">${c.serie || 'C'}-${c.folio}</div>
                    <div class="o-kanban-card-subtitle">${c.proveedor_nombre || '-'}</div>
                    <div class="o-kanban-card-footer">
                        <span class="o-kanban-card-total">${formatMoney(c.total)}</span>
                        ${parseFloat(c.saldo) > 0 ? `<span class="o-kanban-card-saldo">Saldo: ${formatMoney(c.saldo)}</span>` : ''}
                    </div>
                </div>
            `).join('');
        }
        if (count) count.textContent = grupos[status].length;
    });
}

function getBadge(estatus) {
    const badges = {
        'BORRADOR': '<span class="o-badge o-badge-gray">Borrador</span>',
        'PENDIENTE': '<span class="o-badge o-badge-orange">Pendiente</span>',
        'PARCIAL': '<span class="o-badge o-badge-blue">Parcial</span>',
        'RECIBIDA': '<span class="o-badge o-badge-green">Recibida</span>',
        'CANCELADA': '<span class="o-badge o-badge-red">Cancelada</span>'
    };
    return badges[estatus] || estatus;
}

// ==================== VISTAS ====================

function cambiarVista(vista) {
    vistaActual = vista;
    document.querySelectorAll('.o-switch-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.o-switch-btn[data-view="${vista}"]`)?.classList.add('active');
    
    document.querySelectorAll('.o-view').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${vista}`)?.classList.add('active');
    
    actualizarBreadcrumb();
}

function actualizarBreadcrumb(compra = null) {
    const bc = document.querySelector('.o-cp-breadcrumb');
    if (compra) {
        bc.innerHTML = `
            <span class="breadcrumb-item link" onclick="volverALista()">Compras</span>
            <span class="breadcrumb-separator">/</span>
            <span class="breadcrumb-item active">${compra.serie || 'C'}-${compra.folio}</span>
        `;
    } else {
        bc.innerHTML = '<span class="breadcrumb-item active">Compras</span>';
    }
}

function volverALista() {
    compraActual = null;
    cambiarVista(vistaActual === 'form' ? 'list' : vistaActual);
    cargarCompras();
}

// ==================== FORM ====================

function nuevaCompra() {
    compraActual = null;
    productosCompra = [];
    
    document.getElementById('compraId').value = '';
    document.getElementById('compProveedor').value = '';
    document.getElementById('compAlmacen').value = almacenesData.length === 1 ? almacenesData[0].almacen_id : '';
    document.getElementById('compFechaEntrega').value = '';
    document.getElementById('compFechaVencimiento').value = '';
    document.getElementById('compNotas').value = '';
    document.getElementById('formTitulo').textContent = 'Nuevo';
    
    // Enable fields
    document.getElementById('compProveedor').disabled = false;
    document.getElementById('compAlmacen').disabled = false;
    
    actualizarStatusBar('BORRADOR');
    actualizarSmartButtons();
    renderProductosCompra();
    calcularTotales();
    
    document.getElementById('btnConfirmar').style.display = '';
    document.getElementById('btnRecibir').style.display = 'none';
    document.getElementById('btnPago').style.display = 'none';
    document.getElementById('btnCancelar').style.display = 'none';
    
    document.getElementById('chatterCreado').textContent = 'Ahora';
    
    cambiarVista('form');
    actualizarBreadcrumb({ serie: '', folio: 'Nuevo' });
    
    setTimeout(() => document.getElementById('buscarProducto').focus(), 300);
}

async function abrirCompra(id) {
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
            document.getElementById('buscarProducto').style.display = editable ? '' : 'none';
            
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
            actualizarSmartButtons();
            renderProductosCompra();
            calcularTotales();
            
            // Botones según estado
            document.getElementById('btnConfirmar').style.display = c.estatus === 'BORRADOR' ? '' : 'none';
            document.getElementById('btnRecibir').style.display = ['PENDIENTE', 'PARCIAL'].includes(c.estatus) ? '' : 'none';
            document.getElementById('btnPago').style.display = parseFloat(c.saldo) > 0 && c.estatus !== 'CANCELADA' ? '' : 'none';
            document.getElementById('btnCancelar').style.display = c.estatus !== 'CANCELADA' && c.estatus !== 'RECIBIDA' ? '' : 'none';
            
            document.getElementById('chatterCreado').textContent = formatFechaHora(c.fecha);
            
            cambiarVista('form');
            actualizarBreadcrumb(c);
        }
    } catch (e) {
        toast('Error al cargar', 'error');
    }
}

function actualizarStatusBar(estatusActual) {
    const estados = ['BORRADOR', 'PENDIENTE', 'PARCIAL', 'RECIBIDA'];
    const idx = estados.indexOf(estatusActual);
    
    document.querySelectorAll('.o-status-btn').forEach((btn, i) => {
        btn.classList.remove('active', 'done');
        if (i < idx) btn.classList.add('done');
        if (i === idx) btn.classList.add('active');
    });
}

function actualizarSmartButtons() {
    const pagos = compraActual?.pagos?.length || 0;
    document.getElementById('smartPagos').textContent = pagos;
    
    if (productosCompra.length > 0) {
        const totalCant = productosCompra.reduce((s, p) => s + p.cantidad, 0);
        const totalRec = productosCompra.reduce((s, p) => s + (p.cantidad_recibida || 0), 0);
        const pct = totalCant > 0 ? Math.round((totalRec / totalCant) * 100) : 0;
        document.getElementById('smartRecibido').textContent = pct + '%';
    } else {
        document.getElementById('smartRecibido').textContent = '0%';
    }
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
            <td>${editable ? `<button class="o-btn-remove" onclick="quitarLinea(${i})"><i class="fas fa-times"></i></button>` : ''}</td>
        </tr>
    `).join('');
}

function actualizarLinea(i, campo, valor) {
    if (campo === 'cantidad') {
        productosCompra[i].cantidad = parseFloat(valor) || 1;
    } else if (campo === 'costo') {
        productosCompra[i].costo_unitario = parseFloat(valor) || 0;
    } else if (campo === 'iva') {
        productosCompra[i].iva_pct = parseFloat(valor) || 0;
    }
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

// ==================== ACCIONES ====================

async function confirmarCompra() {
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
        estatus: 'PENDIENTE',
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
            toast('Compra confirmada', 'success');
            abrirCompra(id || r.compra_id);
        } else {
            toast(r.error || 'Error', 'error');
        }
    } catch (e) {
        toast('Error al guardar', 'error');
    }
}

async function cancelarCompra() {
    if (!compraActual || !confirm('¿Cancelar esta compra?')) return;
    try {
        const r = await API.request(`/compras/cancelar/${compraActual.compra_id}`, 'PUT');
        if (r.success) {
            toast('Compra cancelada', 'success');
            volverALista();
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
            abrirCompra(compraActual.compra_id);
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
            abrirCompra(compraActual.compra_id);
        } else { toast(r.error || 'Error', 'error'); }
    } catch (e) { toast('Error', 'error'); }
}

function mostrarPagos() {
    if (!compraActual?.pagos?.length) { toast('No hay pagos', 'error'); return; }
    
    document.getElementById('tablaPagosLista').innerHTML = compraActual.pagos.map(p => `
        <tr>
            <td>${formatFecha(p.fecha_pago)}</td>
            <td>${p.metodo_nombre || '-'}</td>
            <td>${p.referencia || '-'}</td>
            <td class="text-right"><strong>${formatMoney(p.monto)}</strong></td>
            <td class="text-center">${p.estatus === 'APLICADO' ? '<span class="o-badge o-badge-green">Aplicado</span>' : '<span class="o-badge o-badge-red">Cancelado</span>'}</td>
            <td>${p.estatus === 'APLICADO' ? `<button class="o-btn-link" onclick="cancelarPago('${p.pago_compra_id}')">Cancelar</button>` : ''}</td>
        </tr>
    `).join('');
    
    abrirModal('modalPagosLista');
}

async function cancelarPago(pagoId) {
    if (!confirm('¿Cancelar este pago?')) return;
    try {
        const r = await API.request(`/pago-compras/cancelar/${pagoId}`, 'PUT');
        if (r.success) {
            toast('Pago cancelado', 'success');
            cerrarModal('modalPagosLista');
            abrirCompra(compraActual.compra_id);
        }
    } catch (e) { toast('Error', 'error'); }
}

function mostrarProductosRecibidos() {
    // Ya visible en la tabla
    toast('Ver columna "Recibido" en productos', 'success');
}

// ==================== UTILS ====================

function toggleSelectAll() {
    const checked = document.getElementById('selectAll').checked;
    document.querySelectorAll('.o-list-checkbox input[data-id]').forEach(cb => cb.checked = checked);
}

function abrirModal(id) { document.getElementById(id)?.classList.add('show'); }
function cerrarModal(id) { document.getElementById(id)?.classList.remove('show'); }

function formatMoney(v) {
    return '$' + (parseFloat(v) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatFecha(f) {
    if (!f) return '-';
    return new Date(f).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatFechaHora(f) {
    if (!f) return '-';
    return new Date(f).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function toast(msg, tipo = 'success') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = `o-toast show ${tipo}`;
    setTimeout(() => t.classList.remove('show'), 3000);
}
