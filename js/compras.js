/* ============================================
   COMPRAS.JS - CAFI POS (Completo)
   ============================================ */

const empresaId = localStorage.getItem('empresa_id') || (JSON.parse(localStorage.getItem('usuario') || '{}')).empresa_id;
const sucursalId = localStorage.getItem('sucursal_id') || (JSON.parse(localStorage.getItem('usuario') || '{}')).sucursal_id;
const usuarioId = (JSON.parse(localStorage.getItem('usuario') || '{}')).id;

let comprasData = [], comprasFiltradas = [], pagosData = [], pagosFiltrados = [];
let proveedoresData = [], almacenesData = [], productosData = [], metodosData = [], cuentasData = [];
let sucursalesData = [], categoriasData = [];
let lineasCompra = [];
let compraActual = null;
let autocompleteIdx = -1;

// ==================== INIT ====================

document.addEventListener('DOMContentLoaded', () => {
    initUsuario();
    initTabs();
    initFiltros();
    cargarDatosIniciales();
    agregarLineaVacia();
    document.getElementById('compFecha').value = new Date().toISOString().split('T')[0];
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

function initFiltros() {
    const hoy = new Date();
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    document.getElementById('filtroDesde').value = inicio.toISOString().split('T')[0];
    document.getElementById('filtroHasta').value = hoy.toISOString().split('T')[0];
    document.getElementById('filtroPagosDesde').value = inicio.toISOString().split('T')[0];
    document.getElementById('filtroPagosHasta').value = hoy.toISOString().split('T')[0];
}

async function cargarDatosIniciales() {
    await Promise.all([
        cargarProveedores(), 
        cargarAlmacenes(), 
        cargarProductos(), 
        cargarMetodosPago(), 
        cargarCuentasBancarias(),
        cargarSucursales(),
        cargarCategorias()
    ]);
}

// ==================== CATALOGOS ====================

async function cargarProveedores() {
    try {
        const r = await API.request(`/proveedores/${empresaId}`);
        if (r.success) {
            proveedoresData = r.proveedores.filter(p => p.activo === 'Y');
            const opts = proveedoresData.map(p => `<option value="${p.proveedor_id}">${p.nombre_comercial}</option>`).join('');
            document.getElementById('filtroProveedor').innerHTML = '<option value="">Todos</option>' + opts;
            document.getElementById('filtroPagosProveedor').innerHTML = '<option value="">Todos</option>' + opts;
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

async function cargarSucursales() {
    try {
        const r = await API.request(`/sucursales/${empresaId}`);
        if (r.success) {
            sucursalesData = r.sucursales || [];
            document.getElementById('almSucursal').innerHTML = '<option value="">Seleccionar...</option>' + sucursalesData.map(s => `<option value="${s.sucursal_id}">${s.nombre}</option>`).join('');
        }
    } catch (e) { console.error(e); }
}

async function cargarCategorias() {
    try {
        const r = await API.request(`/categorias/${empresaId}`);
        if (r.success) {
            categoriasData = r.categorias || [];
            document.getElementById('prodCategoria').innerHTML = '<option value="">Seleccionar...</option>' + categoriasData.map(c => `<option value="${c.categoria_id}">${c.nombre}</option>`).join('');
        }
    } catch (e) { console.error(e); }
}

// ==================== LINEAS (PRODUCTOS) ====================

function agregarLineaVacia() {
    lineasCompra.push({ 
        producto_id: '', 
        nombre: '', 
        codigo: '', 
        cantidad: 1, 
        unidad: 'PZA', 
        costo: 0, 
        iva: 16, 
        ieps: 0,
        importe: 0 
    });
    renderLineas();
    // Focus en el input del producto de la nueva línea
    setTimeout(() => {
        const inputs = document.querySelectorAll('.input-producto');
        if (inputs.length > 0) inputs[inputs.length - 1].focus();
    }, 50);
}

function renderLineas() {
    const tbody = document.getElementById('tablaLineas');
    const editable = !compraActual || compraActual.estatus === 'BORRADOR';
    
    tbody.innerHTML = lineasCompra.map((l, i) => `
        <tr data-idx="${i}">
            <td class="producto-cell">
                <div class="producto-input-wrap">
                    <input type="text" 
                        class="input-producto" 
                        id="prod-input-${i}"
                        value="${l.nombre}" 
                        placeholder="Buscar producto..." 
                        oninput="buscarProductoEnLinea(${i}, this.value)" 
                        onkeydown="navegarAutocomplete(event, ${i})"
                        onfocus="mostrarAutocompletado(${i})"
                        autocomplete="off"
                        ${editable ? '' : 'disabled'}>
                    ${l.codigo ? `<span class="producto-codigo">${l.codigo}</span>` : ''}
                    <div class="producto-autocomplete" id="autocomplete-${i}"></div>
                </div>
            </td>
            <td>
                <input type="number" 
                    class="input-number" 
                    id="cant-input-${i}"
                    value="${l.cantidad}" 
                    min="0.01" 
                    step="0.01"
                    onchange="actualizarLinea(${i}, 'cantidad', this.value)" 
                    onkeydown="if(event.key==='Enter'){event.preventDefault(); agregarLineaVacia();}"
                    ${editable ? '' : 'disabled'}>
            </td>
            <td><span style="color:var(--gray-500); font-size:12px">${l.unidad}</span></td>
            <td>
                <input type="number" 
                    class="input-number" 
                    value="${l.costo.toFixed(2)}" 
                    min="0" 
                    step="0.01" 
                    onchange="actualizarLinea(${i}, 'costo', this.value)" 
                    ${editable ? '' : 'disabled'}>
            </td>
            <td>
                <input type="number" 
                    class="input-number" 
                    value="${l.iva}" 
                    min="0" 
                    max="100"
                    step="1" 
                    style="width:60px"
                    onchange="actualizarLinea(${i}, 'iva', this.value)" 
                    ${editable ? '' : 'disabled'}>
            </td>
            <td>
                <input type="number" 
                    class="input-number" 
                    value="${l.ieps}" 
                    min="0" 
                    max="100"
                    step="0.01" 
                    style="width:60px"
                    onchange="actualizarLinea(${i}, 'ieps', this.value)" 
                    ${editable ? '' : 'disabled'}>
            </td>
            <td class="importe">${formatMoney(l.importe)}</td>
            <td>${editable ? `<button class="btn-remove" onclick="quitarLinea(${i})"><i class="fas fa-trash"></i></button>` : ''}</td>
        </tr>
    `).join('');
    
    calcularTotales();
}

function buscarProductoEnLinea(idx, texto) {
    const dropdown = document.getElementById(`autocomplete-${idx}`);
    autocompleteIdx = -1;
    
    if (texto.length < 1) { 
        dropdown.classList.remove('show'); 
        return; 
    }
    
    const textoLower = texto.toLowerCase();
    const resultados = productosData.filter(p => 
        (p.nombre?.toLowerCase().includes(textoLower)) ||
        (p.codigo_barras?.toLowerCase().includes(textoLower)) ||
        (p.codigo_interno?.toLowerCase().includes(textoLower))
    ).slice(0, 8);
    
    if (resultados.length === 0) {
        dropdown.innerHTML = `<div style="padding:12px;text-align:center;color:var(--gray-400)">
            No encontrado - <a href="#" onclick="abrirModal('modalProducto'); cerrarAutocomplete(${idx}); return false;" style="color:var(--primary)">Crear nuevo</a>
        </div>`;
    } else {
        dropdown.innerHTML = resultados.map((p, i) => `
            <div class="producto-option" data-option="${i}" onclick="seleccionarProductoEnLinea(${idx}, '${p.producto_id}')">
                <div class="info">
                    <div class="name">${p.nombre}</div>
                    <div class="code">${p.codigo_barras || p.codigo_interno || '-'}</div>
                </div>
                <div class="price">${formatMoney(p.costo || p.precio1 || 0)}</div>
            </div>
        `).join('');
    }
    dropdown.classList.add('show');
}

function navegarAutocomplete(event, idx) {
    const dropdown = document.getElementById(`autocomplete-${idx}`);
    const opciones = dropdown.querySelectorAll('.producto-option');
    
    if (!dropdown.classList.contains('show') || opciones.length === 0) {
        if (event.key === 'Enter') {
            event.preventDefault();
        }
        return;
    }
    
    if (event.key === 'ArrowDown') {
        event.preventDefault();
        autocompleteIdx = Math.min(autocompleteIdx + 1, opciones.length - 1);
        actualizarSeleccionAutocomplete(opciones);
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        autocompleteIdx = Math.max(autocompleteIdx - 1, 0);
        actualizarSeleccionAutocomplete(opciones);
    } else if (event.key === 'Enter') {
        event.preventDefault();
        if (autocompleteIdx >= 0 && opciones[autocompleteIdx]) {
            opciones[autocompleteIdx].click();
        }
    } else if (event.key === 'Escape') {
        dropdown.classList.remove('show');
        autocompleteIdx = -1;
    } else if (event.key === 'Tab') {
        dropdown.classList.remove('show');
    }
}

function actualizarSeleccionAutocomplete(opciones) {
    opciones.forEach((op, i) => {
        op.classList.toggle('selected', i === autocompleteIdx);
    });
    if (autocompleteIdx >= 0 && opciones[autocompleteIdx]) {
        opciones[autocompleteIdx].scrollIntoView({ block: 'nearest' });
    }
}

function mostrarAutocompletado(idx) {
    const texto = lineasCompra[idx].nombre;
    if (texto.length >= 1) buscarProductoEnLinea(idx, texto);
}

function cerrarAutocomplete(idx) {
    document.getElementById(`autocomplete-${idx}`)?.classList.remove('show');
}

function seleccionarProductoEnLinea(idx, productoId) {
    const p = productosData.find(x => x.producto_id === productoId);
    if (!p) return;
    
    const cantidad = lineasCompra[idx].cantidad || 1;
    const costo = parseFloat(p.costo || p.precio1 || 0);
    const iva = parseFloat(p.iva || 16);
    const ieps = parseFloat(p.ieps || 0);
    
    lineasCompra[idx] = {
        producto_id: p.producto_id,
        nombre: p.nombre,
        codigo: p.codigo_barras || p.codigo_interno || '',
        cantidad: cantidad,
        unidad: p.unidad_medida || 'PZA',
        costo: costo,
        iva: iva,
        ieps: ieps,
        importe: 0
    };
    
    calcularImporteLinea(idx);
    document.getElementById(`autocomplete-${idx}`).classList.remove('show');
    autocompleteIdx = -1;
    renderLineas();
    
    // Focus en cantidad
    setTimeout(() => {
        const cantInput = document.getElementById(`cant-input-${idx}`);
        if (cantInput) {
            cantInput.focus();
            cantInput.select();
        }
    }, 50);
}

function actualizarLinea(idx, campo, valor) {
    const val = parseFloat(valor) || 0;
    if (campo === 'cantidad') lineasCompra[idx].cantidad = val;
    if (campo === 'costo') lineasCompra[idx].costo = val;
    if (campo === 'iva') lineasCompra[idx].iva = val;
    if (campo === 'ieps') lineasCompra[idx].ieps = val;
    calcularImporteLinea(idx);
    calcularTotales();
}

function calcularImporteLinea(idx) {
    const l = lineasCompra[idx];
    const subtotal = l.cantidad * l.costo;
    const ivaAmount = subtotal * (l.iva / 100);
    const iepsAmount = subtotal * (l.ieps / 100);
    l.importe = subtotal + ivaAmount + iepsAmount;
}

function quitarLinea(idx) {
    if (lineasCompra.length === 1) {
        lineasCompra[0] = { producto_id: '', nombre: '', codigo: '', cantidad: 1, unidad: 'PZA', costo: 0, iva: 16, ieps: 0, importe: 0 };
    } else {
        lineasCompra.splice(idx, 1);
    }
    renderLineas();
}

function calcularTotales() {
    const lineasValidas = lineasCompra.filter(l => l.producto_id);
    const subtotal = lineasValidas.reduce((s, l) => s + (l.cantidad * l.costo), 0);
    const iva = lineasValidas.reduce((s, l) => s + (l.cantidad * l.costo * l.iva / 100), 0);
    const ieps = lineasValidas.reduce((s, l) => s + (l.cantidad * l.costo * l.ieps / 100), 0);
    const total = subtotal + iva + ieps;
    
    document.getElementById('compSubtotal').textContent = formatMoney(subtotal);
    document.getElementById('compIVA').textContent = formatMoney(iva);
    document.getElementById('compIEPS').textContent = formatMoney(ieps);
    document.getElementById('compTotal').textContent = formatMoney(total);
}

// Cerrar autocomplete al hacer clic fuera
document.addEventListener('click', e => {
    if (!e.target.closest('.producto-cell')) {
        document.querySelectorAll('.producto-autocomplete').forEach(d => d.classList.remove('show'));
        autocompleteIdx = -1;
    }
});

// ==================== CATALOGO ====================

function abrirCatalogo() {
    renderCatalogo(productosData.slice(0, 30));
    abrirModal('modalCatalogo');
    setTimeout(() => document.getElementById('catalogoBuscar').focus(), 100);
}

function renderCatalogo(productos) {
    document.getElementById('catalogoGrid').innerHTML = productos.length === 0 
        ? '<div style="grid-column:span 3;text-align:center;padding:40px;color:var(--gray-400)">No hay productos</div>'
        : productos.map(p => `
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
    
    let idx = lineasCompra.findIndex(l => !l.producto_id);
    if (idx === -1) {
        lineasCompra.push({ producto_id: '', nombre: '', codigo: '', cantidad: 1, unidad: 'PZA', costo: 0, iva: 16, ieps: 0, importe: 0 });
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
    document.getElementById('compFecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('compFechaVencimiento').value = '';
    document.getElementById('compFactura').value = '';
    document.getElementById('compNotas').value = '';
    document.getElementById('compraFolio').textContent = '';
    
    document.getElementById('compProveedor').disabled = false;
    document.getElementById('compAlmacen').disabled = false;
    
    // Ocultar sección de pagos
    document.getElementById('seccionPagos').style.display = 'none';
    
    actualizarStatusBar('BORRADOR');
    actualizarBotones();
    agregarLineaVacia();
}

function actualizarStatusBar(estatus) {
    // Mapeo de estados del backend a visuales
    const estadoVisual = {
        'BORRADOR': 'BORRADOR',
        'PENDIENTE': 'CONFIRMADA',
        'CONFIRMADA': 'CONFIRMADA',
        'PARCIAL': 'CONFIRMADA',
        'RECIBIDA': 'PAGADA',
        'PAGADA': 'PAGADA'
    };
    
    const estatusVisual = estadoVisual[estatus] || estatus;
    
    document.querySelectorAll('.statusbar .step').forEach(step => {
        step.classList.remove('active', 'done');
        const estados = ['BORRADOR', 'CONFIRMADA', 'PAGADA'];
        const idx = estados.indexOf(estatusVisual);
        const stepIdx = estados.indexOf(step.dataset.status);
        if (stepIdx < idx) step.classList.add('done');
        if (stepIdx === idx) step.classList.add('active');
    });
}

function actualizarBotones() {
    const estatus = compraActual?.estatus || 'BORRADOR';
    const saldo = parseFloat(compraActual?.saldo || 0);
    
    // Estados del backend: BORRADOR, PENDIENTE, PARCIAL, RECIBIDA, PAGADA, CANCELADA
    const esBorrador = estatus === 'BORRADOR';
    const estaConfirmada = ['PENDIENTE', 'PARCIAL', 'CONFIRMADA'].includes(estatus);
    const estaPagada = ['RECIBIDA', 'PAGADA'].includes(estatus) || (estaConfirmada && saldo <= 0);
    const estaCancelada = estatus === 'CANCELADA';
    
    document.getElementById('btnGuardar').style.display = esBorrador ? '' : 'none';
    document.getElementById('btnConfirmar').style.display = esBorrador ? '' : 'none';
    document.getElementById('btnPago').style.display = (estaConfirmada && saldo > 0 && !estaCancelada) ? '' : 'none';
    document.getElementById('btnPDF').style.display = (compraActual && !esBorrador) ? '' : 'none';
    document.getElementById('btnReabrir').style.display = (estaPagada && !estaCancelada) ? '' : 'none';
    document.getElementById('btnCancelar').style.display = (!estaCancelada && !estaPagada && compraActual) ? '' : 'none';
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
            document.getElementById('compFecha').value = c.fecha ? c.fecha.split('T')[0] : '';
            document.getElementById('compFechaVencimiento').value = c.fecha_vencimiento ? c.fecha_vencimiento.split('T')[0] : '';
            document.getElementById('compFactura').value = c.factura_proveedor || '';
            document.getElementById('compNotas').value = c.notas || '';
            document.getElementById('compraFolio').textContent = `${c.serie || 'C'}-${c.folio}`;
            
            const editable = c.estatus === 'BORRADOR';
            document.getElementById('compProveedor').disabled = !editable;
            document.getElementById('compAlmacen').disabled = !editable;
            
            lineasCompra = r.productos.map(p => ({
                producto_id: p.producto_id,
                nombre: p.producto_nombre || p.descripcion,
                codigo: p.codigo_barras || '',
                cantidad: parseFloat(p.cantidad),
                unidad: p.unidad_medida || 'PZA',
                costo: parseFloat(p.costo_unitario),
                iva: parseFloat(p.iva_pct || p.impuesto_pct || 16),
                ieps: parseFloat(p.ieps_pct || 0),
                importe: 0,
                detalle_id: p.detalle_id
            }));
            
            lineasCompra.forEach((l, i) => calcularImporteLinea(i));
            
            if (editable) agregarLineaVacia();
            
            actualizarStatusBar(c.estatus);
            actualizarBotones();
            renderLineas();
            renderHistorialPagos();
            
            // Ir a tab crear
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            document.querySelector('[data-tab="crear"]').classList.add('active');
            document.getElementById('panel-crear').classList.add('active');
        }
    } catch (e) { toast('Error al cargar', 'error'); }
}

function renderHistorialPagos() {
    const seccion = document.getElementById('seccionPagos');
    const lista = document.getElementById('listaPagos');
    const saldoBadge = document.getElementById('saldoPendiente');
    
    if (!compraActual || !compraActual.pagos || compraActual.pagos.length === 0) {
        seccion.style.display = 'none';
        return;
    }
    
    seccion.style.display = 'block';
    const pagos = compraActual.pagos;
    const saldo = parseFloat(compraActual.saldo || 0);
    
    lista.innerHTML = pagos.map(p => {
        const metodo = metodosData.find(m => m.metodo_pago_id === p.metodo_pago_id);
        const metodoNombre = metodo?.nombre || p.metodo || 'Pago';
        const icono = getIconoMetodo(metodoNombre);
        
        return `
            <div class="pago-card">
                <div class="pago-card-info">
                    <div class="pago-card-icon ${icono.clase}"><i class="fas ${icono.icon}"></i></div>
                    <div class="pago-card-details">
                        <span class="metodo">${metodoNombre}</span>
                        <span class="fecha">${formatFecha(p.fecha)}</span>
                        ${p.referencia ? `<span class="referencia">${p.referencia}</span>` : ''}
                    </div>
                </div>
                <div class="pago-card-monto">${formatMoney(p.monto)}</div>
            </div>
        `;
    }).join('');
    
    saldoBadge.textContent = `Saldo: ${formatMoney(saldo)}`;
    saldoBadge.className = saldo <= 0 ? 'saldo-badge pagado' : 'saldo-badge';
}

function getIconoMetodo(metodo) {
    const lower = (metodo || '').toLowerCase();
    if (lower.includes('efectivo') || lower.includes('cash')) return { icon: 'fa-money-bill-wave', clase: 'efectivo' };
    if (lower.includes('tarjeta') || lower.includes('card')) return { icon: 'fa-credit-card', clase: 'tarjeta' };
    if (lower.includes('transfer')) return { icon: 'fa-exchange-alt', clase: 'transferencia' };
    return { icon: 'fa-dollar-sign', clase: '' };
}

async function guardarCompra(estatusVisual) {
    const proveedor = document.getElementById('compProveedor').value;
    const almacen = document.getElementById('compAlmacen').value;
    
    if (!proveedor) { toast('Seleccione proveedor', 'error'); return; }
    if (!almacen) { toast('Seleccione almacén', 'error'); return; }
    
    const lineasValidas = lineasCompra.filter(l => l.producto_id);
    if (lineasValidas.length === 0) { toast('Agregue productos', 'error'); return; }
    
    const subtotal = lineasValidas.reduce((s, l) => s + (l.cantidad * l.costo), 0);
    const iva = lineasValidas.reduce((s, l) => s + (l.cantidad * l.costo * l.iva / 100), 0);
    const ieps = lineasValidas.reduce((s, l) => s + (l.cantidad * l.costo * l.ieps / 100), 0);
    const total = subtotal + iva + ieps;
    
    const id = document.getElementById('compraId').value;
    
    // Mapear estado visual a estado del backend
    const estatusBackend = estatusVisual === 'CONFIRMADA' ? 'PENDIENTE' : estatusVisual;
    
    const data = {
        empresa_id: empresaId,
        sucursal_id: sucursalId,
        almacen_id: almacen,
        proveedor_id: proveedor,
        usuario_id: usuarioId,
        tipo: 'COMPRA',
        fecha: document.getElementById('compFecha').value || null,
        fecha_vencimiento: document.getElementById('compFechaVencimiento').value || null,
        factura_proveedor: document.getElementById('compFactura').value,
        notas: document.getElementById('compNotas').value,
        subtotal, 
        impuestos: iva + ieps,
        iva,
        ieps,
        total, 
        estatus: estatusBackend,
        productos: lineasValidas.map(l => ({
            producto_id: l.producto_id,
            descripcion: l.nombre,
            cantidad: l.cantidad,
            costo_unitario: l.costo,
            subtotal: l.cantidad * l.costo,
            iva_pct: l.iva,
            iva_monto: l.cantidad * l.costo * l.iva / 100,
            ieps_pct: l.ieps,
            ieps_monto: l.cantidad * l.costo * l.ieps / 100
        }))
    };
    
    try {
        const r = await API.request(id ? `/compras/${id}` : '/compras', id ? 'PUT' : 'POST', data);
        if (r.success) {
            toast(estatusVisual === 'BORRADOR' ? 'Guardado como borrador' : 'Compra confirmada', 'success');
            cargarCompraEnFormulario(id || r.compra_id);
        } else { toast(r.error || 'Error al guardar', 'error'); }
    } catch (e) { toast('Error de conexión', 'error'); }
}

async function cancelarCompraActual() {
    if (!compraActual || !confirm('¿Cancelar esta compra? Esta acción no se puede deshacer.')) return;
    try {
        const r = await API.request(`/compras/cancelar/${compraActual.compra_id}`, 'PUT');
        if (r.success) { 
            toast('Compra cancelada', 'success'); 
            limpiarFormulario(); 
        }
    } catch (e) { toast('Error', 'error'); }
}

async function reabrirCompra() {
    if (!compraActual || !confirm('¿Reabrir esta compra para agregar más pagos o modificaciones?')) return;
    try {
        const r = await API.request(`/compras/${compraActual.compra_id}`, 'PUT', {
            estatus: 'PENDIENTE'
        });
        if (r.success) { 
            toast('Compra reabierta', 'success'); 
            cargarCompraEnFormulario(compraActual.compra_id); 
        } else {
            toast(r.error || 'Error al reabrir', 'error');
        }
    } catch (e) { toast('Error', 'error'); }
}

// ==================== GENERAR PDF ====================

function generarPDF() {
    if (!compraActual) return;
    
    const c = compraActual;
    const proveedor = proveedoresData.find(p => p.proveedor_id === c.proveedor_id);
    const lineasValidas = lineasCompra.filter(l => l.producto_id);
    
    // Crear contenido HTML para el PDF
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 12px; color: #333; padding: 40px; }
        .header { display: flex; justify-content: space-between; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #2D3DBF; }
        .logo { font-size: 28px; font-weight: bold; color: #2D3DBF; }
        .doc-info { text-align: right; }
        .doc-title { font-size: 20px; font-weight: bold; color: #2D3DBF; }
        .doc-folio { font-size: 16px; color: #666; margin-top: 4px; }
        .doc-fecha { font-size: 12px; color: #888; margin-top: 4px; }
        .section { margin-bottom: 25px; }
        .section-title { font-size: 11px; font-weight: bold; color: #666; text-transform: uppercase; margin-bottom: 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .info-box { background: #f9f9f9; padding: 15px; border-radius: 6px; }
        .info-label { font-size: 10px; color: #888; text-transform: uppercase; }
        .info-value { font-size: 13px; font-weight: 500; margin-top: 2px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background: #2D3DBF; color: #fff; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; }
        td { padding: 10px 12px; border-bottom: 1px solid #eee; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .totals { margin-top: 20px; display: flex; justify-content: flex-end; }
        .totals-box { width: 280px; }
        .total-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
        .total-row.final { border-top: 2px solid #2D3DBF; border-bottom: none; margin-top: 8px; padding-top: 12px; font-size: 16px; font-weight: bold; color: #2D3DBF; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #888; font-size: 10px; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: bold; }
        .badge-confirmada { background: #fef3c7; color: #d97706; }
        .badge-pagada { background: #dcfce7; color: #16a34a; }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">CAFI POS</div>
        <div class="doc-info">
            <div class="doc-title">ORDEN DE COMPRA</div>
            <div class="doc-folio">${c.serie || 'C'}-${c.folio}</div>
            <div class="doc-fecha">${formatFecha(c.fecha)}</div>
            <div style="margin-top:8px"><span class="badge badge-${c.estatus.toLowerCase()}">${c.estatus}</span></div>
        </div>
    </div>

    <div class="section">
        <div class="info-grid">
            <div class="info-box">
                <div class="info-label">Proveedor</div>
                <div class="info-value">${proveedor?.nombre_comercial || '-'}</div>
                <div style="font-size:11px;color:#666;margin-top:4px">${proveedor?.rfc || ''}</div>
                <div style="font-size:11px;color:#666">${proveedor?.direccion || ''}</div>
            </div>
            <div class="info-box">
                <div class="info-label">Información de la Compra</div>
                <div style="margin-top:4px"><span style="color:#888">Factura:</span> ${c.factura_proveedor || '-'}</div>
                <div><span style="color:#888">Vencimiento:</span> ${c.fecha_vencimiento ? formatFecha(c.fecha_vencimiento) : '-'}</div>
                <div><span style="color:#888">Almacén:</span> ${almacenesData.find(a => a.almacen_id === c.almacen_id)?.nombre || '-'}</div>
            </div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Detalle de Productos</div>
        <table>
            <thead>
                <tr>
                    <th style="width:40%">Producto</th>
                    <th class="text-center">Cantidad</th>
                    <th class="text-right">Costo Unit.</th>
                    <th class="text-center">IVA</th>
                    <th class="text-center">IEPS</th>
                    <th class="text-right">Importe</th>
                </tr>
            </thead>
            <tbody>
                ${lineasValidas.map(l => `
                    <tr>
                        <td><strong>${l.nombre}</strong><br><span style="font-size:10px;color:#888">${l.codigo || ''}</span></td>
                        <td class="text-center">${l.cantidad} ${l.unidad}</td>
                        <td class="text-right">${formatMoney(l.costo)}</td>
                        <td class="text-center">${l.iva}%</td>
                        <td class="text-center">${l.ieps}%</td>
                        <td class="text-right"><strong>${formatMoney(l.importe)}</strong></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="totals">
        <div class="totals-box">
            <div class="total-row"><span>Subtotal:</span><span>${formatMoney(c.subtotal)}</span></div>
            <div class="total-row"><span>IVA:</span><span>${formatMoney(c.iva || 0)}</span></div>
            <div class="total-row"><span>IEPS:</span><span>${formatMoney(c.ieps || 0)}</span></div>
            <div class="total-row final"><span>TOTAL:</span><span>${formatMoney(c.total)}</span></div>
        </div>
    </div>

    ${c.notas ? `<div class="section"><div class="section-title">Observaciones</div><p style="background:#f9f9f9;padding:12px;border-radius:6px">${c.notas}</p></div>` : ''}

    <div class="footer">
        <p>Documento generado por CAFI POS - ${new Date().toLocaleString('es-MX')}</p>
    </div>
</body>
</html>`;
    
    // Abrir en nueva ventana para imprimir/guardar como PDF
    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.onload = () => {
        printWindow.print();
    };
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
        
        // Stats
        const total = comprasData.reduce((s, c) => s + parseFloat(c.total || 0), 0);
        const pendiente = comprasData.reduce((s, c) => s + parseFloat(c.saldo || 0), 0);
        const pagado = total - pendiente;
        
        document.getElementById('statCompras').textContent = comprasData.length;
        document.getElementById('statTotal').textContent = formatMoney(total);
        document.getElementById('statPendiente').textContent = formatMoney(pendiente);
        document.getElementById('statPagado').textContent = formatMoney(pagado);
        
        renderComprasList();
        document.getElementById('totalCompras').textContent = `${comprasData.length} compras`;
        document.getElementById('emptyCompras').classList.toggle('show', comprasData.length === 0);
    } catch (e) { comprasData = []; }
}

function renderComprasList() {
    document.getElementById('tablaCompras').innerHTML = comprasFiltradas.map(c => `
        <tr>
            <td><strong style="color:var(--primary)">${c.serie || 'C'}-${c.folio}</strong></td>
            <td>${c.proveedor_nombre || '-'}</td>
            <td>${formatFecha(c.fecha)}</td>
            <td>${c.factura_proveedor || '-'}</td>
            <td class="text-right"><strong>${formatMoney(c.total)}</strong></td>
            <td class="text-right">${parseFloat(c.saldo) > 0 ? `<span style="color:var(--danger)">${formatMoney(c.saldo)}</span>` : '<span style="color:var(--success)">$0.00</span>'}</td>
            <td class="text-center">${getBadge(c.estatus)}</td>
            <td class="text-center">
                <button class="btn btn-sm" onclick="cargarCompraEnFormulario('${c.compra_id}')" title="Ver/Editar"><i class="fas fa-eye"></i></button>
            </td>
        </tr>
    `).join('');
}

function getBadge(estatus) {
    const mapeo = { 
        BORRADOR: { color: 'gray', texto: 'Borrador' },
        PENDIENTE: { color: 'orange', texto: 'Confirmada' },
        CONFIRMADA: { color: 'orange', texto: 'Confirmada' },
        PARCIAL: { color: 'blue', texto: 'Pago Parcial' },
        RECIBIDA: { color: 'green', texto: 'Pagada' },
        PAGADA: { color: 'green', texto: 'Pagada' },
        CANCELADA: { color: 'red', texto: 'Cancelada' }
    };
    const e = mapeo[estatus] || { color: 'gray', texto: estatus };
    return `<span class="badge badge-${e.color}">${e.texto}</span>`;
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
                    <td class="text-center"><button class="btn btn-sm" onclick="verComprasProveedor('${c.proveedor_id}')"><i class="fas fa-eye"></i> Ver</button></td>
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
        
        // Stats por método
        let efectivo = 0, tarjeta = 0, transferencia = 0;
        pagosData.filter(p => p.estatus === 'APLICADO').forEach(p => {
            const metodo = (p.metodo_nombre || '').toLowerCase();
            if (metodo.includes('efectivo')) efectivo += parseFloat(p.monto);
            else if (metodo.includes('tarjeta')) tarjeta += parseFloat(p.monto);
            else if (metodo.includes('transferencia')) transferencia += parseFloat(p.monto);
        });
        
        document.getElementById('pagosEfectivo').textContent = formatMoney(efectivo);
        document.getElementById('pagosTarjeta').textContent = formatMoney(tarjeta);
        document.getElementById('pagosTransferencia').textContent = formatMoney(transferencia);
        
        renderPagos();
    } catch (e) { pagosData = []; }
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
        if (r.success) { toast('Pago cancelado', 'success'); cargarPagos(); }
    } catch (e) { toast('Error', 'error'); }
}

// ==================== PAGO MODAL ====================

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
    
    const saldoActual = parseFloat(compraActual.saldo || 0);
    
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
            // Verificar si el pago liquida la compra
            const nuevoSaldo = saldoActual - monto;
            if (nuevoSaldo <= 0.01) {
                // Actualizar estatus a PAGADA/RECIBIDA
                await API.request(`/compras/${compraActual.compra_id}`, 'PUT', {
                    estatus: 'RECIBIDA'
                });
            }
            
            toast('Pago registrado', 'success'); 
            cerrarModal('modalPago'); 
            cargarCompraEnFormulario(compraActual.compra_id); 
        } else { toast(r.error || 'Error', 'error'); }
    } catch (e) { toast('Error', 'error'); }
}

// ==================== GUARDAR PROVEEDOR ====================

async function guardarProveedor() {
    const nombre = document.getElementById('provNombre').value.trim();
    if (!nombre) { toast('Nombre requerido', 'error'); return; }
    
    try {
        const r = await API.request('/proveedores', 'POST', {
            empresa_id: empresaId,
            nombre_comercial: nombre,
            razon_social: document.getElementById('provRazon').value,
            rfc: document.getElementById('provRFC').value,
            telefono: document.getElementById('provTelefono').value,
            email: document.getElementById('provEmail').value,
            direccion: document.getElementById('provDireccion').value,
            activo: 'Y'
        });
        if (r.success) {
            toast('Proveedor creado', 'success');
            cerrarModal('modalProveedor');
            // Limpiar
            ['provNombre', 'provRazon', 'provRFC', 'provTelefono', 'provEmail', 'provDireccion'].forEach(id => document.getElementById(id).value = '');
            await cargarProveedores();
            document.getElementById('compProveedor').value = r.proveedor_id;
        } else { toast(r.error || 'Error', 'error'); }
    } catch (e) { toast('Error', 'error'); }
}

// ==================== GUARDAR ALMACÉN ====================

async function guardarAlmacen() {
    const nombre = document.getElementById('almNombre').value.trim();
    if (!nombre) { toast('Nombre requerido', 'error'); return; }
    
    try {
        const r = await API.request('/almacenes', 'POST', {
            empresa_id: empresaId,
            sucursal_id: document.getElementById('almSucursal').value || sucursalId,
            nombre: nombre,
            descripcion: document.getElementById('almDescripcion').value
        });
        if (r.success) {
            toast('Almacén creado', 'success');
            cerrarModal('modalAlmacen');
            ['almNombre', 'almDescripcion'].forEach(id => document.getElementById(id).value = '');
            document.getElementById('almSucursal').value = '';
            await cargarAlmacenes();
            document.getElementById('compAlmacen').value = r.almacen_id;
        } else { toast(r.error || 'Error', 'error'); }
    } catch (e) { toast('Error', 'error'); }
}

// ==================== GUARDAR PRODUCTO ====================

async function guardarProducto() {
    const nombre = document.getElementById('prodNombre').value.trim();
    if (!nombre) { toast('Nombre requerido', 'error'); return; }
    
    try {
        const r = await API.request('/productos', 'POST', {
            empresa_id: empresaId,
            nombre: nombre,
            codigo_barras: document.getElementById('prodCodigo').value,
            codigo_interno: document.getElementById('prodInterno').value,
            categoria_id: document.getElementById('prodCategoria').value || null,
            costo: parseFloat(document.getElementById('prodCosto').value) || 0,
            precio1: parseFloat(document.getElementById('prodPrecio').value) || 0,
            iva: parseFloat(document.getElementById('prodIVA').value) || 16,
            ieps: parseFloat(document.getElementById('prodIEPS').value) || 0,
            activo: 'Y'
        });
        if (r.success) {
            toast('Producto creado', 'success');
            cerrarModal('modalProducto');
            ['prodCodigo', 'prodInterno', 'prodNombre', 'prodCosto', 'prodPrecio'].forEach(id => document.getElementById(id).value = '');
            document.getElementById('prodCategoria').value = '';
            document.getElementById('prodIVA').value = '16';
            document.getElementById('prodIEPS').value = '0';
            await cargarProductos();
        } else { toast(r.error || 'Error', 'error'); }
    } catch (e) { toast('Error', 'error'); }
}

// ==================== GUARDAR SUCURSAL ====================

async function guardarSucursal() {
    const nombre = document.getElementById('sucNombre').value.trim();
    if (!nombre) { toast('Nombre requerido', 'error'); return; }
    
    try {
        const r = await API.request('/sucursales', 'POST', {
            empresa_id: empresaId,
            nombre: nombre,
            direccion: document.getElementById('sucDireccion').value,
            telefono: document.getElementById('sucTelefono').value,
            codigo: document.getElementById('sucCodigo').value,
            activa: 'Y'
        });
        if (r.success) {
            toast('Sucursal creada', 'success');
            cerrarModal('modalSucursal');
            ['sucNombre', 'sucDireccion', 'sucTelefono', 'sucCodigo'].forEach(id => document.getElementById(id).value = '');
            await cargarSucursales();
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
