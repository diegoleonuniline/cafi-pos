/* ============================================
   COMPRAS.JS - CAFI POS
   ============================================ */

const empresaId = localStorage.getItem('empresa_id') || (JSON.parse(localStorage.getItem('usuario') || '{}')).empresa_id;
const sucursalId = localStorage.getItem('sucursal_id') || (JSON.parse(localStorage.getItem('usuario') || '{}')).sucursal_id;
const usuarioId = (JSON.parse(localStorage.getItem('usuario') || '{}')).id;

let comprasData = [];
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
    initBusqueda();
    cargarDatosIniciales();
});

function initUsuario() {
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    document.getElementById('userName').textContent = usuario.nombre || 'Usuario';
    document.getElementById('userSucursal').textContent = usuario.sucursal_nombre || 'Sucursal';
    document.getElementById('userAvatar').textContent = (usuario.nombre || 'US').substring(0, 2).toUpperCase();
}

function initTabs() {
    document.querySelectorAll('.tab').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`panel-${tab}`)?.classList.add('active');
            if (tab === 'cuentas') cargarCuentasPagar();
        });
    });
    
    document.querySelectorAll('.dtab').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.dtab;
            document.querySelectorAll('.dtab').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.dtab-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`dtab-${tab}`)?.classList.add('active');
        });
    });
}

function initFiltros() {
    const hoy = new Date();
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    document.getElementById('filtroDesde').value = inicio.toISOString().split('T')[0];
    document.getElementById('filtroHasta').value = hoy.toISOString().split('T')[0];
}

function initBusqueda() {
    const input = document.getElementById('buscarProducto');
    const dropdown = document.getElementById('sugerenciasDropdown');
    
    input.addEventListener('input', () => {
        const texto = input.value.trim().toLowerCase();
        if (texto.length < 2) {
            dropdown.classList.remove('active');
            return;
        }
        
        const resultados = productosData.filter(p => 
            (p.nombre && p.nombre.toLowerCase().includes(texto)) ||
            (p.codigo_barras && p.codigo_barras.toLowerCase().includes(texto)) ||
            (p.codigo_interno && p.codigo_interno.toLowerCase().includes(texto))
        ).slice(0, 10);
        
        if (resultados.length === 0) {
            dropdown.innerHTML = '<div class="sugerencias-empty"><i class="fas fa-search"></i> No encontrado</div>';
        } else {
            dropdown.innerHTML = resultados.map(p => `
                <div class="sugerencia-item" onclick="seleccionarProducto('${p.producto_id}')">
                    <div class="sugerencia-info">
                        <div class="sugerencia-nombre">${p.nombre}</div>
                        <div class="sugerencia-codigo">${p.codigo_barras || p.codigo_interno || '-'}</div>
                    </div>
                    <div class="sugerencia-costo">${formatMoney(p.costo || p.precio1 || 0)}</div>
                </div>
            `).join('');
        }
        dropdown.classList.add('active');
    });
    
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const texto = input.value.trim().toLowerCase();
            const producto = productosData.find(p => 
                (p.codigo_barras && p.codigo_barras.toLowerCase() === texto) ||
                (p.codigo_interno && p.codigo_interno.toLowerCase() === texto)
            );
            if (producto) {
                agregarProductoCompra(producto);
                input.value = '';
                dropdown.classList.remove('active');
            }
        }
        if (e.key === 'Escape') {
            dropdown.classList.remove('active');
        }
    });
    
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.busqueda-input-wrapper')) {
            dropdown.classList.remove('active');
        }
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
    cargarKPIs();
    cargarCompras();
}

// ==================== CATÁLOGOS ====================

async function cargarProveedores() {
    try {
        const r = await API.request(`/proveedores/${empresaId}`);
        if (r.success) {
            proveedoresData = r.proveedores.filter(p => p.activo === 'Y');
            const opts = proveedoresData.map(p => `<option value="${p.proveedor_id}">${p.nombre_comercial}</option>`).join('');
            document.getElementById('filtroProveedor').innerHTML = '<option value="">Todos</option>' + opts;
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
            
            if (almacenesData.length === 1) {
                document.getElementById('compAlmacen').value = almacenesData[0].almacen_id;
            }
        }
    } catch (e) { console.error(e); }
}

async function cargarProductos() {
    try {
        const r = await API.request(`/productos/${empresaId}`);
        if (r.success) {
            productosData = r.productos || r.data || [];
        }
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

// ==================== KPIs ====================

async function cargarKPIs() {
    try {
        const r = await API.request(`/compras/kpis/${empresaId}`);
        if (r.success) {
            document.getElementById('kpiHoy').textContent = formatMoney(r.hoy.total);
            document.getElementById('kpiMes').textContent = formatMoney(r.mes.total);
            document.getElementById('kpiPendientes').textContent = formatMoney(r.pendientes.total);
            document.getElementById('kpiRecibir').textContent = r.por_recibir;
        }
    } catch (e) { console.error(e); }
}

// ==================== COMPRAS ====================

async function cargarCompras() {
    const tabla = document.getElementById('tablaCompras');
    tabla.innerHTML = '<tr class="loading-row"><td colspan="8"><div class="spinner"></div>Cargando...</td></tr>';
    
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
        
        if (r.success && r.compras?.length) {
            comprasData = r.compras;
            tabla.innerHTML = comprasData.map(c => `
                <tr>
                    <td><strong>${c.serie || 'C'}-${c.folio}</strong></td>
                    <td>${formatFecha(c.fecha)}</td>
                    <td>${c.proveedor_nombre || '-'}</td>
                    <td class="center">${c.num_productos || 0}</td>
                    <td class="right"><strong>${formatMoney(c.total)}</strong></td>
                    <td class="right">${parseFloat(c.saldo) > 0 ? `<span style="color:var(--danger)">${formatMoney(c.saldo)}</span>` : '<span style="color:var(--success)">$0.00</span>'}</td>
                    <td class="center">${getBadgeEstatus(c.estatus)}</td>
                    <td class="center">
                        <div class="btn-actions">
                            <button class="btn-action view" onclick="verDetalle('${c.compra_id}')" title="Ver"><i class="fas fa-eye"></i></button>
                            ${c.estatus === 'BORRADOR' ? `<button class="btn-action edit" onclick="editarCompra('${c.compra_id}')" title="Editar"><i class="fas fa-edit"></i></button>` : ''}
                            ${parseFloat(c.saldo) > 0 && c.estatus !== 'CANCELADA' ? `<button class="btn-action pay" onclick="pagoRapido('${c.compra_id}')" title="Pagar"><i class="fas fa-dollar-sign"></i></button>` : ''}
                        </div>
                    </td>
                </tr>
            `).join('');
        } else {
            tabla.innerHTML = '<tr><td colspan="8"><div class="empty-state"><i class="fas fa-truck-loading"></i><p>No hay compras</p></div></td></tr>';
        }
    } catch (e) {
        tabla.innerHTML = '<tr><td colspan="8"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error al cargar</p></div></td></tr>';
    }
}

function getBadgeEstatus(estatus) {
    const badges = {
        'BORRADOR': '<span class="badge badge-gray">Borrador</span>',
        'PENDIENTE': '<span class="badge badge-warning">Pendiente</span>',
        'PARCIAL': '<span class="badge badge-info">Parcial</span>',
        'RECIBIDA': '<span class="badge badge-success">Recibida</span>',
        'CANCELADA': '<span class="badge badge-danger">Cancelada</span>'
    };
    return badges[estatus] || `<span class="badge badge-gray">${estatus}</span>`;
}

// ==================== MODAL COMPRA ====================

function abrirModalCompra() {
    document.getElementById('compraId').value = '';
    document.getElementById('compProveedor').value = '';
    document.getElementById('compAlmacen').value = almacenesData.length === 1 ? almacenesData[0].almacen_id : '';
    document.getElementById('compFechaEntrega').value = '';
    document.getElementById('compFechaVencimiento').value = '';
    document.getElementById('compNotas').value = '';
    document.getElementById('compConIVA').checked = true;
    document.getElementById('modalCompraTitulo').textContent = 'Nueva Compra';
    document.getElementById('buscarProducto').value = '';
    
    productosCompra = [];
    renderProductosCompra();
    calcularTotales();
    abrirModal('modalCompra');
    
    setTimeout(() => document.getElementById('buscarProducto').focus(), 300);
}

async function editarCompra(id) {
    try {
        const r = await API.request(`/compras/detalle/${id}`);
        if (r.success) {
            const c = r.compra;
            document.getElementById('compraId').value = c.compra_id;
            document.getElementById('compProveedor').value = c.proveedor_id || '';
            document.getElementById('compAlmacen').value = c.almacen_id || '';
            document.getElementById('compFechaEntrega').value = c.fecha_entrega ? c.fecha_entrega.split('T')[0] : '';
            document.getElementById('compFechaVencimiento').value = c.fecha_vencimiento ? c.fecha_vencimiento.split('T')[0] : '';
            document.getElementById('compNotas').value = c.notas || '';
            document.getElementById('compConIVA').checked = parseFloat(c.impuestos) > 0;
            document.getElementById('modalCompraTitulo').textContent = 'Editar Compra';
            
            productosCompra = r.productos.map(p => ({
                producto_id: p.producto_id,
                nombre: p.producto_nombre || p.descripcion,
                codigo: p.codigo_barras,
                cantidad: parseFloat(p.cantidad),
                costo_unitario: parseFloat(p.costo_unitario),
                subtotal: parseFloat(p.subtotal)
            }));
            
            renderProductosCompra();
            calcularTotales();
            abrirModal('modalCompra');
        }
    } catch (e) {
        toast('Error al cargar', 'error');
    }
}

async function guardarCompra(estatus) {
    const proveedor = document.getElementById('compProveedor').value;
    const almacen = document.getElementById('compAlmacen').value;
    
    if (!proveedor) { toast('Seleccione un proveedor', 'error'); return; }
    if (!almacen) { toast('Seleccione un almacén', 'error'); return; }
    if (productosCompra.length === 0) { toast('Agregue productos', 'error'); return; }
    
    const conIVA = document.getElementById('compConIVA').checked;
    const subtotal = productosCompra.reduce((sum, p) => sum + p.subtotal, 0);
    const impuestos = conIVA ? subtotal * 0.16 : 0;
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
        subtotal,
        impuestos,
        total,
        estatus,
        productos: productosCompra.map(p => ({
            producto_id: p.producto_id,
            descripcion: p.nombre,
            cantidad: p.cantidad,
            costo_unitario: p.costo_unitario,
            subtotal: p.subtotal,
            impuesto_pct: conIVA ? 16 : 0,
            impuesto_monto: conIVA ? p.subtotal * 0.16 : 0
        }))
    };
    
    try {
        const r = await API.request(id ? `/compras/${id}` : '/compras', id ? 'PUT' : 'POST', data);
        if (r.success) {
            toast(id ? 'Compra actualizada' : 'Compra creada', 'success');
            cerrarModal('modalCompra');
            cargarCompras();
            cargarKPIs();
        } else {
            toast(r.error || 'Error', 'error');
        }
    } catch (e) {
        toast('Error al guardar', 'error');
    }
}

// ==================== PRODUCTOS ====================

function seleccionarProducto(id) {
    const producto = productosData.find(p => p.producto_id === id);
    if (producto) {
        agregarProductoCompra(producto);
        document.getElementById('buscarProducto').value = '';
        document.getElementById('sugerenciasDropdown').classList.remove('active');
        document.getElementById('buscarProducto').focus();
    }
}

function agregarProductoCompra(producto) {
    const existente = productosCompra.find(p => p.producto_id === producto.producto_id);
    
    if (existente) {
        existente.cantidad += 1;
        existente.subtotal = existente.cantidad * existente.costo_unitario;
    } else {
        productosCompra.push({
            producto_id: producto.producto_id,
            nombre: producto.nombre,
            codigo: producto.codigo_barras || producto.codigo_interno,
            cantidad: 1,
            costo_unitario: parseFloat(producto.costo || producto.precio1 || 0),
            subtotal: parseFloat(producto.costo || producto.precio1 || 0)
        });
    }
    
    renderProductosCompra();
    calcularTotales();
}

function renderProductosCompra() {
    const tbody = document.getElementById('tablaProductosCompra');
    const empty = document.getElementById('productosEmpty');
    
    if (productosCompra.length === 0) {
        tbody.innerHTML = '';
        empty.classList.remove('hidden');
        empty.style.display = 'flex';
        return;
    }
    
    empty.classList.add('hidden');
    empty.style.display = 'none';
    
    tbody.innerHTML = productosCompra.map((p, i) => `
        <tr>
            <td>
                <strong>${p.nombre}</strong>
                ${p.codigo ? `<br><small style="color:var(--gray-500)">${p.codigo}</small>` : ''}
            </td>
            <td><input type="number" value="${p.cantidad}" min="1" step="1" onchange="actualizarCantidad(${i}, this.value)"></td>
            <td><input type="number" class="costo" value="${p.costo_unitario.toFixed(2)}" min="0" step="0.01" onchange="actualizarCosto(${i}, this.value)"></td>
            <td class="right"><strong>${formatMoney(p.subtotal)}</strong></td>
            <td class="center"><button type="button" class="btn-quitar" onclick="quitarProducto(${i})"><i class="fas fa-times"></i></button></td>
        </tr>
    `).join('');
}

function actualizarCantidad(i, val) {
    productosCompra[i].cantidad = parseFloat(val) || 1;
    productosCompra[i].subtotal = productosCompra[i].cantidad * productosCompra[i].costo_unitario;
    renderProductosCompra();
    calcularTotales();
}

function actualizarCosto(i, val) {
    productosCompra[i].costo_unitario = parseFloat(val) || 0;
    productosCompra[i].subtotal = productosCompra[i].cantidad * productosCompra[i].costo_unitario;
    renderProductosCompra();
    calcularTotales();
}

function quitarProducto(i) {
    productosCompra.splice(i, 1);
    renderProductosCompra();
    calcularTotales();
}

function calcularTotales() {
    const subtotal = productosCompra.reduce((sum, p) => sum + p.subtotal, 0);
    const conIVA = document.getElementById('compConIVA').checked;
    const iva = conIVA ? subtotal * 0.16 : 0;
    const total = subtotal + iva;
    
    document.getElementById('compSubtotal').textContent = formatMoney(subtotal);
    document.getElementById('compIVA').textContent = formatMoney(iva);
    document.getElementById('compTotal').textContent = formatMoney(total);
}

document.getElementById('compConIVA')?.addEventListener('change', calcularTotales);

// ==================== DETALLE ====================

async function verDetalle(id) {
    try {
        const r = await API.request(`/compras/detalle/${id}`);
        if (r.success) {
            compraActual = r.compra;
            compraActual.productos = r.productos;
            compraActual.pagos = r.pagos;
            
            const c = compraActual;
            const totalPagado = r.pagos.reduce((sum, p) => sum + parseFloat(p.monto), 0);
            
            document.getElementById('detalleFolio').textContent = `${c.serie || 'C'}-${c.folio}`;
            document.getElementById('detalleProveedor').textContent = c.proveedor_nombre || '-';
            document.getElementById('detalleFecha').textContent = formatFecha(c.fecha);
            document.getElementById('detalleEstatus').innerHTML = getBadgeEstatus(c.estatus);
            document.getElementById('detalleTotal').textContent = formatMoney(c.total);
            document.getElementById('detallePagado').textContent = formatMoney(totalPagado);
            document.getElementById('detalleSaldo').textContent = formatMoney(c.saldo);
            
            document.getElementById('detalleProductos').innerHTML = r.productos.map(p => `
                <tr>
                    <td><strong>${p.producto_nombre || p.descripcion}</strong></td>
                    <td class="center">${parseFloat(p.cantidad).toFixed(2)}</td>
                    <td class="center">${parseFloat(p.cantidad_recibida || 0).toFixed(2)}</td>
                    <td class="right">${formatMoney(p.costo_unitario)}</td>
                    <td class="right"><strong>${formatMoney(p.subtotal)}</strong></td>
                </tr>
            `).join('');
            
            renderPagosDetalle(r.pagos);
            
            document.getElementById('btnRecibir').style.display = ['PENDIENTE', 'PARCIAL'].includes(c.estatus) ? '' : 'none';
            document.getElementById('btnCancelar').style.display = c.estatus !== 'CANCELADA' ? '' : 'none';
            
            document.querySelectorAll('.dtab').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.dtab-panel').forEach(p => p.classList.remove('active'));
            document.querySelector('.dtab[data-dtab="productos"]').classList.add('active');
            document.getElementById('dtab-productos').classList.add('active');
            
            abrirModal('modalDetalle');
        }
    } catch (e) {
        toast('Error al cargar', 'error');
    }
}

function renderPagosDetalle(pagos) {
    const tbody = document.getElementById('detallePagos');
    if (!pagos?.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--gray-400)">No hay pagos</td></tr>';
        return;
    }
    tbody.innerHTML = pagos.map(p => `
        <tr>
            <td>${formatFecha(p.fecha_pago)}</td>
            <td>${p.metodo_nombre || '-'}</td>
            <td>${p.referencia || '-'}</td>
            <td class="right"><strong>${formatMoney(p.monto)}</strong></td>
            <td class="center">${p.estatus === 'APLICADO' ? '<span class="badge badge-success">Aplicado</span>' : '<span class="badge badge-danger">Cancelado</span>'}</td>
            <td class="center">${p.estatus === 'APLICADO' ? `<button class="btn-action delete" onclick="cancelarPago('${p.pago_compra_id}')"><i class="fas fa-times"></i></button>` : ''}</td>
        </tr>
    `).join('');
}

// ==================== RECIBIR ====================

function abrirModalRecibir() {
    if (!compraActual?.productos) return;
    document.getElementById('tablaRecibir').innerHTML = compraActual.productos.map(p => {
        const pendiente = parseFloat(p.cantidad) - parseFloat(p.cantidad_recibida || 0);
        return `
            <tr>
                <td>${p.producto_nombre || p.descripcion}</td>
                <td class="center">${parseFloat(p.cantidad).toFixed(2)}</td>
                <td class="center">${parseFloat(p.cantidad_recibida || 0).toFixed(2)}</td>
                <td class="center"><input type="number" id="recibir_${p.detalle_id}" value="${Math.max(0, pendiente)}" min="0" max="${pendiente}" style="width:80px;text-align:center" ${pendiente <= 0 ? 'disabled' : ''}></td>
            </tr>
        `;
    }).join('');
    abrirModal('modalRecibir');
}

async function confirmarRecepcion() {
    if (!compraActual) return;
    const productos = compraActual.productos.map(p => ({
        detalle_id: p.detalle_id,
        cantidad_recibir: parseFloat(document.getElementById(`recibir_${p.detalle_id}`)?.value || 0)
    })).filter(p => p.cantidad_recibir > 0);
    
    if (!productos.length) { toast('Ingrese cantidades', 'error'); return; }
    
    try {
        const r = await API.request(`/compras/recibir/${compraActual.compra_id}`, 'POST', { productos, usuario_id: usuarioId });
        if (r.success) {
            toast('Mercancía recibida', 'success');
            cerrarModal('modalRecibir');
            cerrarModal('modalDetalle');
            cargarCompras();
            cargarKPIs();
        } else { toast(r.error || 'Error', 'error'); }
    } catch (e) { toast('Error', 'error'); }
}

// ==================== CANCELAR ====================

async function cancelarCompra() {
    if (!compraActual || !confirm('¿Cancelar esta compra?')) return;
    try {
        const r = await API.request(`/compras/cancelar/${compraActual.compra_id}`, 'PUT');
        if (r.success) {
            toast('Compra cancelada', 'success');
            cerrarModal('modalDetalle');
            cargarCompras();
            cargarKPIs();
        }
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
    document.getElementById('pagoNotas').value = '';
    abrirModal('modalPago');
}

function pagoRapido(compraId) {
    const compra = comprasData.find(c => c.compra_id === compraId);
    if (compra) { compraActual = compra; abrirModalPago(); }
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
            notas: document.getElementById('pagoNotas').value,
            usuario_id: usuarioId
        });
        
        if (r.success) {
            toast('Pago registrado', 'success');
            cerrarModal('modalPago');
            if (document.getElementById('modalDetalle').classList.contains('active')) {
                verDetalle(compraActual.compra_id);
            }
            cargarCompras();
            cargarKPIs();
        } else { toast(r.error || 'Error', 'error'); }
    } catch (e) { toast('Error', 'error'); }
}

async function cancelarPago(pagoId) {
    if (!confirm('¿Cancelar este pago?')) return;
    try {
        const r = await API.request(`/pago-compras/cancelar/${pagoId}`, 'PUT');
        if (r.success) {
            toast('Pago cancelado', 'success');
            if (compraActual) verDetalle(compraActual.compra_id);
            cargarCompras();
            cargarKPIs();
        }
    } catch (e) { toast('Error', 'error'); }
}

// ==================== CUENTAS POR PAGAR ====================

async function cargarCuentasPagar() {
    const tabla = document.getElementById('tablaCuentas');
    tabla.innerHTML = '<tr class="loading-row"><td colspan="5"><div class="spinner"></div>Cargando...</td></tr>';
    
    try {
        const r = await API.request(`/compras/cuentas-pagar/${empresaId}`);
        if (r.success && r.cuentas?.length) {
            tabla.innerHTML = r.cuentas.map(c => `
                <tr>
                    <td><strong>${c.proveedor_nombre}</strong></td>
                    <td class="center">${c.num_compras}</td>
                    <td class="right"><strong style="color:var(--danger)">${formatMoney(c.saldo_total)}</strong></td>
                    <td class="center">${c.proxima_vencimiento ? formatFecha(c.proxima_vencimiento) : '-'}</td>
                    <td class="center"><button class="btn btn-sm btn-outline" onclick="verComprasProveedor('${c.proveedor_id}')"><i class="fas fa-eye"></i></button></td>
                </tr>
            `).join('');
        } else {
            tabla.innerHTML = '<tr><td colspan="5"><div class="empty-state"><i class="fas fa-check-circle"></i><p>Sin cuentas pendientes</p></div></td></tr>';
        }
    } catch (e) {
        tabla.innerHTML = '<tr><td colspan="5"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error</p></div></td></tr>';
    }
}

function verComprasProveedor(proveedorId) {
    document.getElementById('filtroProveedor').value = proveedorId;
    document.getElementById('filtroEstatus').value = '';
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.querySelector('.tab[data-tab="compras"]').classList.add('active');
    document.getElementById('panel-compras').classList.add('active');
    cargarCompras();
}

// ==================== UTILS ====================

function abrirModal(id) { document.getElementById(id)?.classList.add('active'); }
function cerrarModal(id) { document.getElementById(id)?.classList.remove('active'); }

function formatMoney(v) {
    return '$' + (parseFloat(v) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatFecha(f) {
    if (!f) return '-';
    return new Date(f).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function toast(msg, tipo = 'success') {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = `toast show ${tipo}`;
    setTimeout(() => t.classList.remove('show'), 3000);
}
