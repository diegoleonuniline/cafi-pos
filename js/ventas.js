/* ============================================
   VENTAS.JS - CAFI POS (Módulo Ventas)
   Estilo Odoo - Sin turno requerido
   ============================================ */

const empresaId = localStorage.getItem('empresa_id') || (JSON.parse(localStorage.getItem('usuario') || '{}')).empresa_id;
const sucursalId = localStorage.getItem('sucursal_id') || (JSON.parse(localStorage.getItem('usuario') || '{}')).sucursal_id;
const usuarioId = (JSON.parse(localStorage.getItem('usuario') || '{}')).id;

let ventasData = [], ventasFiltradas = [], devolucionesData = [];
let clientesData = [], almacenesData = [], productosData = [], metodosData = [], categoriasData = [], usuariosData = [];
let lineasVenta = [];
let ventaActual = null;
let autocompleteIdx = -1;
let pagosTemporales = [];
let metodoSeleccionado = null;
let categoriaFiltro = null;

// ==================== INIT ====================

document.addEventListener('DOMContentLoaded', () => {
    initUsuario();
    initTabs();
    initFiltros();
    cargarDatosIniciales();
    agregarLineaVacia();
    document.getElementById('ventaFecha').value = new Date().toISOString().split('T')[0];
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
            
            if (tab === 'ventas') cargarVentas();
            if (tab === 'devoluciones') cargarDevoluciones();
        });
    });
}

function initFiltros() {
    const hoy = new Date();
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    document.getElementById('filtroDesde').value = inicio.toISOString().split('T')[0];
    document.getElementById('filtroHasta').value = hoy.toISOString().split('T')[0];
    document.getElementById('filtroDevDesde').value = inicio.toISOString().split('T')[0];
    document.getElementById('filtroDevHasta').value = hoy.toISOString().split('T')[0];
}

async function cargarDatosIniciales() {
    await Promise.all([
        cargarClientes(),
        cargarAlmacenes(),
        cargarProductos(),
        cargarMetodosPago(),
        cargarCategorias(),
        cargarUsuarios()
    ]);
}

// ==================== CATALOGOS ====================

async function cargarClientes() {
    try {
        const r = await API.request(`/clientes/${empresaId}`);
        if (r.success) {
            clientesData = (r.clientes || r.data || []).filter(c => c.activo === 'Y');
            const opts = clientesData.map(c => `<option value="${c.cliente_id}">${c.nombre}</option>`).join('');
            document.getElementById('filtroCliente').innerHTML = '<option value="">Todos</option>' + opts;
            document.getElementById('ventaCliente').innerHTML = '<option value="">Público General</option>' + opts;
        }
    } catch (e) { console.error(e); }
}

async function cargarAlmacenes() {
    try {
        const r = await API.request(`/almacenes/${empresaId}`);
        if (r.success) {
            almacenesData = r.almacenes;
            const opts = almacenesData.map(a => `<option value="${a.almacen_id}">${a.sucursal_nombre ? a.sucursal_nombre + ' - ' : ''}${a.nombre}</option>`).join('');
            document.getElementById('ventaAlmacen').innerHTML = '<option value="">Seleccionar...</option>' + opts;
            if (almacenesData.length === 1) document.getElementById('ventaAlmacen').value = almacenesData[0].almacen_id;
        }
    } catch (e) { console.error(e); }
}

async function cargarProductos() {
    try {
        const r = await API.request(`/productos/${empresaId}`);
        if (r.success) {
            productosData = (r.productos || r.data || []).filter(p => p.activo === 'Y' && p.es_vendible !== 'N');
        }
    } catch (e) { console.error(e); }
}

async function cargarMetodosPago() {
    try {
        const r = await API.request(`/metodos-pago/${empresaId}`);
        if (r.success) {
            metodosData = r.metodos.filter(m => m.activo === 'Y');
            document.getElementById('nuevoMetodoPago').innerHTML = metodosData.map(m => `<option value="${m.metodo_pago_id}">${m.nombre}</option>`).join('');
        }
    } catch (e) { console.error(e); }
}

async function cargarCategorias() {
    try {
        const r = await API.request(`/categorias/${empresaId}`);
        if (r.success) {
            categoriasData = r.categorias || r.data || [];
            document.getElementById('prodCategoria').innerHTML = '<option value="">Sin categoría</option>' + categoriasData.map(c => `<option value="${c.categoria_id}">${c.nombre}</option>`).join('');
        }
    } catch (e) { console.error(e); }
}

async function cargarUsuarios() {
    try {
        const r = await API.request(`/usuarios/${empresaId}`);
        if (r.success) {
            usuariosData = r.usuarios || [];
            document.getElementById('ventaVendedor').innerHTML = '<option value="">Sin vendedor</option>' + usuariosData.map(u => `<option value="${u.usuario_id}">${u.nombre}</option>`).join('');
        }
    } catch (e) { console.error(e); }
}

// ==================== LINEAS (PRODUCTOS) ====================

function agregarLineaVacia() {
    lineasVenta.push({
        producto_id: '',
        nombre: '',
        codigo: '',
        cantidad: 1,
        unidad: 'PZ',
        precio: 0,
        precio_original: 0,
        descuento_pct: 0,
        descuento_monto: 0,
        iva: 16,
        importe: 0,
        stock: 0
    });
    renderLineas();
    setTimeout(() => {
        const inputs = document.querySelectorAll('.input-producto');
        if (inputs.length > 0) inputs[inputs.length - 1].focus();
    }, 50);
}

function renderLineas() {
    const tbody = document.getElementById('tablaLineas');
    const editable = !ventaActual || ventaActual.estatus === 'BORRADOR';
    const esPagada = ventaActual && ['PAGADA', 'RECIBIDA'].includes(ventaActual.estatus);
    
    tbody.innerHTML = lineasVenta.map((l, i) => `
        <tr data-idx="${i}">
            <td class="producto-cell">
                <div class="producto-input-wrap">
                    <input type="text" 
                        class="input-producto" 
                        id="prod-input-${i}"
                        value="${l.nombre}" 
                        placeholder="Buscar producto..." 
                        oninput="lineasVenta[${i}].nombre = this.value; buscarProductoEnLinea(${i}, this.value)" 
                        onkeydown="navegarAutocomplete(event, ${i})"
                        onfocus="if(this.value.length > 0) buscarProductoEnLinea(${i}, this.value)"
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
                    oninput="actualizarLinea(${i}, 'cantidad', this.value)" 
                    onkeydown="if(event.key==='Enter'){event.preventDefault(); agregarLineaVacia();}"
                    ${editable ? '' : 'disabled'}>
            </td>
            <td><span style="color:var(--gray-500); font-size:12px">${l.unidad}</span></td>
            <td>
                <input type="number" 
                    class="input-number" 
                    value="${l.precio.toFixed(2)}" 
                    min="0" 
                    step="0.01" 
                    oninput="actualizarLinea(${i}, 'precio', this.value)" 
                    ${editable ? '' : 'disabled'}>
            </td>
            <td>
                <input type="number" 
                    class="input-number" 
                    value="${l.descuento_pct}" 
                    min="0" 
                    max="100"
                    step="0.01" 
                    style="width:70px"
                    oninput="actualizarLinea(${i}, 'descuento_pct', this.value)" 
                    ${editable ? '' : 'disabled'}>
            </td>
            <td>
                <input type="number" 
                    class="input-number" 
                    value="${l.descuento_monto.toFixed(2)}" 
                    min="0" 
                    step="0.01" 
                    style="width:80px"
                    oninput="actualizarLinea(${i}, 'descuento_monto', this.value)" 
                    ${editable ? '' : 'disabled'}>
            </td>
            <td class="importe">${formatMoney(l.importe)}</td>
            <td>
                <div class="line-actions">
                    ${editable ? `<button class="danger" onclick="quitarLinea(${i})" title="Eliminar"><i class="fas fa-trash"></i></button>` : ''}
                    ${esPagada && l.producto_id ? `<button onclick="abrirCancelarProducto(${i})" title="Cancelar producto"><i class="fas fa-times-circle"></i></button>` : ''}
                </div>
            </td>
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
                <div style="text-align:right">
                    <div class="price">${formatMoney(p.precio_venta || p.precio1 || 0)}</div>
                    <div class="stock">Stock: ${p.stock || 0}</div>
                </div>
            </div>
        `).join('');
    }
    dropdown.classList.add('show');
}

function navegarAutocomplete(event, idx) {
    const dropdown = document.getElementById(`autocomplete-${idx}`);
    const opciones = dropdown.querySelectorAll('.producto-option');
    
    if (!dropdown.classList.contains('show') || opciones.length === 0) {
        if (event.key === 'Enter') event.preventDefault();
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

function cerrarAutocomplete(idx) {
    document.getElementById(`autocomplete-${idx}`)?.classList.remove('show');
}

function seleccionarProductoEnLinea(idx, productoId) {
    const p = productosData.find(x => x.producto_id === productoId);
    if (!p) return;
    
    const clienteId = document.getElementById('ventaCliente').value;
    const cliente = clientesData.find(c => c.cliente_id === clienteId);
    const tipoPrecio = parseInt(cliente?.tipo_precio) || 1;
    
    let precio = parseFloat(p.precio_venta || p.precio1 || 0);
    if (tipoPrecio === 2 && p.precio2) precio = parseFloat(p.precio2);
    if (tipoPrecio === 3 && p.precio3) precio = parseFloat(p.precio3);
    if (tipoPrecio === 4 && p.precio4) precio = parseFloat(p.precio4);
    
    const cantidad = lineasVenta[idx].cantidad || 1;
    
    lineasVenta[idx] = {
        producto_id: p.producto_id,
        nombre: p.nombre,
        codigo: p.codigo_barras || p.codigo_interno || '',
        cantidad: cantidad,
        unidad: p.unidad_venta || 'PZ',
        precio: precio,
        precio_original: precio,
        descuento_pct: 0,
        descuento_monto: 0,
        iva: parseFloat(p.tasa_impuesto || 16),
        importe: 0,
        stock: parseFloat(p.stock || 0)
    };
    
    calcularImporteLinea(idx);
    document.getElementById(`autocomplete-${idx}`).classList.remove('show');
    autocompleteIdx = -1;
    renderLineas();
    
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
    
    if (campo === 'cantidad') lineasVenta[idx].cantidad = val;
    if (campo === 'precio') lineasVenta[idx].precio = val;
    if (campo === 'descuento_pct') {
        lineasVenta[idx].descuento_pct = val;
        const subtotal = lineasVenta[idx].cantidad * lineasVenta[idx].precio;
        lineasVenta[idx].descuento_monto = subtotal * val / 100;
    }
    if (campo === 'descuento_monto') {
        lineasVenta[idx].descuento_monto = val;
        const subtotal = lineasVenta[idx].cantidad * lineasVenta[idx].precio;
        lineasVenta[idx].descuento_pct = subtotal > 0 ? (val / subtotal) * 100 : 0;
    }
    
    calcularImporteLinea(idx);
    
    const row = document.querySelector(`tr[data-idx="${idx}"]`);
    if (row) {
        const importeCell = row.querySelector('.importe');
        if (importeCell) importeCell.textContent = formatMoney(lineasVenta[idx].importe);
    }
    
    calcularTotales();
}

function calcularImporteLinea(idx) {
    const l = lineasVenta[idx];
    const subtotal = l.cantidad * l.precio;
    const descuento = l.descuento_monto || (subtotal * l.descuento_pct / 100);
    const baseIVA = subtotal - descuento;
    const iva = baseIVA * (l.iva / 100);
    l.importe = baseIVA + iva;
}

function quitarLinea(idx) {
    if (lineasVenta.length === 1) {
        lineasVenta[0] = { producto_id: '', nombre: '', codigo: '', cantidad: 1, unidad: 'PZ', precio: 0, precio_original: 0, descuento_pct: 0, descuento_monto: 0, iva: 16, importe: 0, stock: 0 };
    } else {
        lineasVenta.splice(idx, 1);
    }
    renderLineas();
}

function aplicarDescuentoGlobal() {
    const descGlobal = parseFloat(document.getElementById('ventaDescuentoGlobal').value) || 0;
    lineasVenta.forEach((l, i) => {
        if (l.producto_id) {
            l.descuento_pct = descGlobal;
            const subtotal = l.cantidad * l.precio;
            l.descuento_monto = subtotal * descGlobal / 100;
            calcularImporteLinea(i);
        }
    });
    renderLineas();
}

function calcularTotales() {
    const lineasValidas = lineasVenta.filter(l => l.producto_id);
    const subtotal = lineasValidas.reduce((s, l) => s + (l.cantidad * l.precio), 0);
    const descuento = lineasValidas.reduce((s, l) => s + (l.descuento_monto || (l.cantidad * l.precio * l.descuento_pct / 100)), 0);
    const baseIVA = subtotal - descuento;
    const iva = lineasValidas.reduce((s, l) => {
        const sub = l.cantidad * l.precio;
        const desc = l.descuento_monto || (sub * l.descuento_pct / 100);
        return s + ((sub - desc) * l.iva / 100);
    }, 0);
    const total = baseIVA + iva;
    
    document.getElementById('ventaSubtotal').textContent = formatMoney(subtotal);
    document.getElementById('ventaDescuento').textContent = '-' + formatMoney(descuento);
    document.getElementById('ventaIVA').textContent = formatMoney(iva);
    document.getElementById('ventaTotal').textContent = formatMoney(total);
}

document.addEventListener('click', e => {
    if (!e.target.closest('.producto-cell')) {
        document.querySelectorAll('.producto-autocomplete').forEach(d => d.classList.remove('show'));
        autocompleteIdx = -1;
    }
});

// ==================== CATALOGO ====================

function abrirCatalogo() {
    renderCatalogoCategorias();
    renderCatalogo(productosData.slice(0, 30));
    abrirModal('modalCatalogo');
    setTimeout(() => document.getElementById('catalogoBuscar').focus(), 100);
}

function renderCatalogoCategorias() {
    const cats = document.getElementById('catalogoCategorias');
    cats.innerHTML = `<button class="cat-btn ${!categoriaFiltro ? 'active' : ''}" onclick="filtrarCategoria(null)">Todos</button>` +
        categoriasData.map(c => `<button class="cat-btn ${categoriaFiltro === c.categoria_id ? 'active' : ''}" onclick="filtrarCategoria('${c.categoria_id}')">${c.nombre}</button>`).join('');
}

function filtrarCategoria(catId) {
    categoriaFiltro = catId;
    renderCatalogoCategorias();
    filtrarCatalogo();
}

function renderCatalogo(productos) {
    document.getElementById('catalogoGrid').innerHTML = productos.length === 0
        ? '<div style="grid-column:span 3;text-align:center;padding:40px;color:var(--gray-400)">No hay productos</div>'
        : productos.map(p => `
            <div class="catalog-item" onclick="agregarDesdeCatalogo('${p.producto_id}')">
                <div class="name">${p.nombre}</div>
                <div class="code">${p.codigo_barras || p.codigo_interno || '-'}</div>
                <div class="price">${formatMoney(p.precio_venta || p.precio1 || 0)}</div>
                <div class="stock">Stock: ${p.stock || 0}</div>
            </div>
        `).join('');
}

function filtrarCatalogo() {
    const texto = document.getElementById('catalogoBuscar').value.toLowerCase();
    let filtrados = productosData;
    
    if (categoriaFiltro) {
        filtrados = filtrados.filter(p => p.categoria_id === categoriaFiltro);
    }
    
    if (texto) {
        filtrados = filtrados.filter(p =>
            (p.nombre?.toLowerCase().includes(texto)) ||
            (p.codigo_barras?.toLowerCase().includes(texto))
        );
    }
    
    renderCatalogo(filtrados.slice(0, 30));
}

function agregarDesdeCatalogo(productoId) {
    const p = productosData.find(x => x.producto_id === productoId);
    if (!p) return;
    
    let idx = lineasVenta.findIndex(l => !l.producto_id);
    if (idx === -1) {
        lineasVenta.push({ producto_id: '', nombre: '', codigo: '', cantidad: 1, unidad: 'PZ', precio: 0, precio_original: 0, descuento_pct: 0, descuento_monto: 0, iva: 16, importe: 0, stock: 0 });
        idx = lineasVenta.length - 1;
    }
    
    seleccionarProductoEnLinea(idx, productoId);
    cerrarModal('modalCatalogo');
}

// ==================== FORMULARIO ====================

function limpiarFormulario() {
    ventaActual = null;
    lineasVenta = [];
    pagosTemporales = [];
    
    document.getElementById('ventaId').value = '';
    document.getElementById('ventaCliente').value = '';
    document.getElementById('ventaAlmacen').value = almacenesData.length === 1 ? almacenesData[0].almacen_id : '';
    document.getElementById('ventaFecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('ventaTipo').value = 'CONTADO';
    document.getElementById('ventaDescuentoGlobal').value = '0';
    document.getElementById('ventaVendedor').value = '';
    document.getElementById('ventaNotas').value = '';
    document.getElementById('ventaFolio').textContent = '';
    
    document.getElementById('ventaCliente').disabled = false;
    document.getElementById('ventaAlmacen').disabled = false;
    
    document.getElementById('seccionPagos').style.display = 'none';
    
    actualizarStatusBar('BORRADOR');
    actualizarBotones();
    agregarLineaVacia();
    
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelector('[data-tab="crear"]').classList.add('active');
    document.getElementById('panel-crear').classList.add('active');
}

function actualizarStatusBar(estatus) {
    const estadoVisual = {
        'BORRADOR': 'BORRADOR',
        'PENDIENTE': 'CONFIRMADA',
        'CONFIRMADA': 'CONFIRMADA',
        'PAGADA': 'PAGADA',
        'CANCELADA': 'CANCELADA'
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
    const estatus = ventaActual?.estatus || 'BORRADOR';
    const pagado = parseFloat(ventaActual?.pagado || 0);
    const total = parseFloat(ventaActual?.total || 0);
    const saldo = total - pagado;
    
    const esBorrador = estatus === 'BORRADOR';
    const estaConfirmada = ['PENDIENTE', 'CONFIRMADA'].includes(estatus);
    const estaPagada = estatus === 'PAGADA' || (estaConfirmada && saldo <= 0);
    const estaCancelada = estatus === 'CANCELADA';
    
    document.getElementById('btnGuardar').style.display = esBorrador ? '' : 'none';
    document.getElementById('btnConfirmar').style.display = esBorrador ? '' : 'none';
    document.getElementById('btnCobrar').style.display = (estaConfirmada && saldo > 0 && !estaCancelada) ? '' : 'none';
    document.getElementById('btnPDF').style.display = (ventaActual && !esBorrador) ? '' : 'none';
    document.getElementById('btnReabrir').style.display = (estaPagada && !estaCancelada) ? '' : 'none';
    document.getElementById('btnCancelar').style.display = (!estaCancelada && !estaPagada && ventaActual) ? '' : 'none';
}

async function cargarVentaEnFormulario(id) {
    try {
        const r = await API.request(`/ventas/detalle-completo/${id}`);
        if (r.success) {
            ventaActual = r.venta;
            ventaActual.productos = r.productos;
            ventaActual.pagos = r.pagos;
            
            const v = ventaActual;
            document.getElementById('ventaId').value = v.venta_id;
            document.getElementById('ventaCliente').value = v.cliente_id || '';
            document.getElementById('ventaAlmacen').value = v.almacen_id || '';
            document.getElementById('ventaFecha').value = v.fecha_hora ? v.fecha_hora.split('T')[0] : '';
            document.getElementById('ventaTipo').value = v.tipo_venta || 'CONTADO';
            document.getElementById('ventaDescuentoGlobal').value = v.descuento || 0;
            document.getElementById('ventaVendedor').value = v.vendedor_id || '';
            document.getElementById('ventaNotas').value = v.notas || '';
            document.getElementById('ventaFolio').textContent = `${v.serie || 'V'}-${v.folio}`;
            
            const editable = v.estatus === 'BORRADOR';
            document.getElementById('ventaCliente').disabled = !editable;
            document.getElementById('ventaAlmacen').disabled = !editable;
            
            lineasVenta = r.productos.filter(p => p.estatus === 'ACTIVO').map(p => ({
                producto_id: p.producto_id,
                nombre: p.producto_nombre || p.descripcion,
                codigo: p.codigo_barras || '',
                cantidad: parseFloat(p.cantidad),
                unidad: p.unidad || 'PZ',
                precio: parseFloat(p.precio_unitario),
                precio_original: parseFloat(p.precio_lista || p.precio_unitario),
                descuento_pct: parseFloat(p.descuento_pct || 0),
                descuento_monto: parseFloat(p.descuento_monto || 0),
                iva: 16,
                importe: 0,
                stock: 0,
                detalle_id: p.detalle_id
            }));
            
            lineasVenta.forEach((l, i) => calcularImporteLinea(i));
            
            if (editable) agregarLineaVacia();
            
            actualizarStatusBar(v.estatus);
            actualizarBotones();
            renderLineas();
            renderHistorialPagos();
            
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
    
    if (!ventaActual || !ventaActual.pagos || ventaActual.pagos.length === 0) {
        seccion.style.display = 'none';
        return;
    }
    
    seccion.style.display = 'block';
    const pagos = ventaActual.pagos.filter(p => p.estatus === 'APLICADO');
    const totalPagado = pagos.reduce((s, p) => s + parseFloat(p.monto), 0);
    const total = parseFloat(ventaActual.total) || 0;
    const saldo = Math.max(0, total - totalPagado);
    
    lista.innerHTML = pagos.map(p => {
        const metodo = metodosData.find(m => m.metodo_pago_id === p.metodo_pago_id);
        const metodoNombre = metodo?.nombre || p.metodo_nombre || 'Pago';
        const icono = getIconoMetodo(metodoNombre);
        
        return `
            <div class="pago-card">
                <div class="pago-card-info">
                    <div class="pago-card-icon ${icono.clase}"><i class="fas ${icono.icon}"></i></div>
                    <div class="pago-card-details">
                        <span class="metodo">${metodoNombre}</span>
                        <span class="fecha">${formatFecha(p.fecha_hora)}</span>
                        ${p.referencia ? `<span class="referencia">${p.referencia}</span>` : ''}
                    </div>
                </div>
                <div class="pago-card-monto">${formatMoney(p.monto)}</div>
                <div class="pago-card-actions">
                    <button onclick="abrirCambiarPago('${p.pago_id}')" title="Cambiar método"><i class="fas fa-exchange-alt"></i></button>
                </div>
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

async function guardarVenta(estatusVisual) {
    const almacen = document.getElementById('ventaAlmacen').value;
    if (!almacen) { toast('Seleccione almacén', 'error'); return; }
    
    const lineasValidas = lineasVenta.filter(l => l.producto_id);
    if (lineasValidas.length === 0) { toast('Agregue productos', 'error'); return; }
    
    const subtotal = lineasValidas.reduce((s, l) => s + (l.cantidad * l.precio), 0);
    const descuento = lineasValidas.reduce((s, l) => s + (l.descuento_monto || (l.cantidad * l.precio * l.descuento_pct / 100)), 0);
    const baseIVA = subtotal - descuento;
    const total = lineasValidas.reduce((s, l) => s + l.importe, 0);
    
    const id = document.getElementById('ventaId').value;
    const estatusBackend = estatusVisual === 'CONFIRMADA' ? 'PENDIENTE' : estatusVisual;
    
    const data = {
        empresa_id: empresaId,
        sucursal_id: sucursalId,
        almacen_id: almacen,
        cliente_id: document.getElementById('ventaCliente').value || null,
        usuario_id: usuarioId,
        vendedor_id: document.getElementById('ventaVendedor').value || null,
        tipo_venta: document.getElementById('ventaTipo').value,
        subtotal,
        descuento,
        total,
        notas: document.getElementById('ventaNotas').value,
        estatus: estatusBackend,
        items: lineasValidas.map(l => ({
            producto_id: l.producto_id,
            descripcion: l.nombre,
            cantidad: l.cantidad,
            unidad_id: l.unidad,
            precio_unitario: l.precio,
            descuento: l.descuento_pct,
            descuentoMonto: l.descuento_monto,
            subtotal: l.importe
        }))
    };
    
    try {
        let r;
        if (id) {
            r = await API.request(`/ventas/${id}`, 'PUT', data);
        } else {
            r = await API.request('/ventas', 'POST', data);
        }
        
        if (r.success) {
            toast(estatusVisual === 'BORRADOR' ? 'Guardado como borrador' : 'Venta confirmada', 'success');
            cargarVentaEnFormulario(id || r.venta_id);
        } else {
            toast(r.error || 'Error al guardar', 'error');
        }
    } catch (e) { toast('Error de conexión', 'error'); }
}

async function cancelarVentaActual() {
    if (!ventaActual || !confirm('¿Cancelar esta venta? Esta acción no se puede deshacer.')) return;
    
    document.getElementById('accionPendiente').value = 'cancelar_venta';
    abrirModal('modalAutorizacion');
}

async function reabrirVenta() {
    if (!ventaActual || !confirm('¿Reabrir esta venta para modificarla?')) return;
    
    document.getElementById('accionPendiente').value = 'reabrir_venta';
    abrirModal('modalAutorizacion');
}

async function ejecutarAccionAutorizada(accion, autorizador) {
    if (accion === 'cancelar_venta') {
        try {
            const r = await API.request(`/ventas/cancelar-completa/${ventaActual.venta_id}`, 'POST', {
                motivo_cancelacion: 'Cancelación desde módulo de ventas',
                cancelado_por: usuarioId,
                autorizado_por: autorizador
            });
            if (r.success) {
                toast('Venta cancelada', 'success');
                limpiarFormulario();
            }
        } catch (e) { toast('Error', 'error'); }
    } else if (accion === 'reabrir_venta') {
        try {
            const r = await API.request(`/ventas/reabrir/${ventaActual.venta_id}`, 'POST', {
                usuario_id: usuarioId,
                autorizado_por: autorizador
            });
            if (r.success) {
                toast('Venta reabierta', 'success');
                cargarVentaEnFormulario(ventaActual.venta_id);
            }
        } catch (e) { toast('Error', 'error'); }
    } else if (accion === 'cancelar_producto') {
        await procesarCancelacionProducto(autorizador);
    } else if (accion === 'cambiar_pago') {
        await procesarCambioPago(autorizador);
    }
}

async function validarAutorizacion() {
    const clave = document.getElementById('claveAutorizacion').value;
    if (!clave) { toast('Ingrese la clave', 'error'); return; }
    
    try {
        const r = await API.request('/auth/validar-admin', 'POST', {
            empresa_id: empresaId,
            password: clave
        });
        
        if (r.success) {
            cerrarModal('modalAutorizacion');
            document.getElementById('claveAutorizacion').value = '';
            const accion = document.getElementById('accionPendiente').value;
            await ejecutarAccionAutorizada(accion, r.admin || 'Autorizado');
        } else {
            toast('Clave incorrecta', 'error');
        }
    } catch (e) { toast('Error de validación', 'error'); }
}

// ==================== COBRO ====================

function abrirModalCobro() {
    if (!ventaActual) return;
    
    const total = parseFloat(ventaActual.total) || 0;
    const pagado = ventaActual.pagos?.filter(p => p.estatus === 'APLICADO').reduce((s, p) => s + parseFloat(p.monto), 0) || 0;
    const saldo = Math.max(0, total - pagado);
    
    document.getElementById('cobroTotal').textContent = formatMoney(total);
    
    if (pagado > 0) {
        document.getElementById('cobroSaldoBox').style.display = 'block';
        document.getElementById('cobroSaldo').textContent = formatMoney(saldo);
    } else {
        document.getElementById('cobroSaldoBox').style.display = 'none';
    }
    
    document.getElementById('metodosPagoGrid').innerHTML = metodosData.map(m => `
        <div class="metodo-pago-btn" onclick="seleccionarMetodo('${m.metodo_pago_id}')" data-metodo="${m.metodo_pago_id}">
            <i class="fas ${getIconoMetodo(m.nombre).icon}"></i>
            <span>${m.nombre}</span>
        </div>
    `).join('');
    
    document.getElementById('cobroMonto').value = saldo.toFixed(2);
    document.getElementById('cobroReferencia').value = '';
    document.getElementById('grupoReferencia').style.display = 'none';
    document.getElementById('cobroCambio').textContent = '$0.00';
    
    pagosTemporales = [];
    metodoSeleccionado = null;
    document.getElementById('multiPagos').style.display = 'none';
    renderPagosTemporales();
    
    const efectivo = metodosData.find(m => m.tipo === 'EFECTIVO' || m.nombre.toLowerCase().includes('efectivo'));
    if (efectivo) seleccionarMetodo(efectivo.metodo_pago_id);
    
    abrirModal('modalCobro');
}

function seleccionarMetodo(metodoId) {
    metodoSeleccionado = metodoId;
    document.querySelectorAll('.metodo-pago-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.metodo === metodoId);
    });
    
    const metodo = metodosData.find(m => m.metodo_pago_id === metodoId);
    const requiereRef = metodo?.requiere_referencia === 'Y' || metodo?.tipo !== 'EFECTIVO';
    document.getElementById('grupoReferencia').style.display = requiereRef ? '' : 'none';
    
    calcularCambio();
}

function calcularCambio() {
    const total = parseFloat(ventaActual?.total) || 0;
    const pagado = ventaActual?.pagos?.filter(p => p.estatus === 'APLICADO').reduce((s, p) => s + parseFloat(p.monto), 0) || 0;
    const saldo = total - pagado;
    
    const totalTemp = pagosTemporales.reduce((s, p) => s + p.monto, 0);
    const monto = parseFloat(document.getElementById('cobroMonto').value) || 0;
    const totalAPagar = totalTemp + monto;
    const cambio = Math.max(0, totalAPagar - saldo);
    
    document.getElementById('cobroCambio').textContent = formatMoney(cambio);
}

function agregarPagoMultiple() {
    if (!metodoSeleccionado) { toast('Seleccione método de pago', 'error'); return; }
    
    const monto = parseFloat(document.getElementById('cobroMonto').value) || 0;
    if (monto <= 0) { toast('Ingrese monto válido', 'error'); return; }
    
    const metodo = metodosData.find(m => m.metodo_pago_id === metodoSeleccionado);
    pagosTemporales.push({
        metodo_pago_id: metodoSeleccionado,
        metodo_nombre: metodo?.nombre || 'Pago',
        monto,
        referencia: document.getElementById('cobroReferencia').value
    });
    
    document.getElementById('cobroMonto').value = '';
    document.getElementById('cobroReferencia').value = '';
    document.getElementById('multiPagos').style.display = 'block';
    
    renderPagosTemporales();
}

function renderPagosTemporales() {
    const container = document.getElementById('pagosAplicados');
    container.innerHTML = pagosTemporales.map((p, i) => `
        <div class="pago-aplicado-item">
            <div class="info">
                <i class="fas ${getIconoMetodo(p.metodo_nombre).icon}"></i>
                <span>${p.metodo_nombre}</span>
            </div>
            <span class="monto">${formatMoney(p.monto)}</span>
            <button class="btn-remove-pago" onclick="quitarPagoTemporal(${i})"><i class="fas fa-times"></i></button>
        </div>
    `).join('');
    
    const total = parseFloat(ventaActual?.total) || 0;
    const pagadoPrev = ventaActual?.pagos?.filter(p => p.estatus === 'APLICADO').reduce((s, p) => s + parseFloat(p.monto), 0) || 0;
    const saldo = total - pagadoPrev;
    const totalTemp = pagosTemporales.reduce((s, p) => s + p.monto, 0);
    
    document.getElementById('totalPagado').textContent = formatMoney(totalTemp);
    document.getElementById('restaPagar').textContent = formatMoney(Math.max(0, saldo - totalTemp));
}

function quitarPagoTemporal(idx) {
    pagosTemporales.splice(idx, 1);
    renderPagosTemporales();
    if (pagosTemporales.length === 0) {
        document.getElementById('multiPagos').style.display = 'none';
    }
}

async function procesarCobro() {
    if (!ventaActual) return;
    
    if (pagosTemporales.length === 0) {
        if (!metodoSeleccionado) { toast('Seleccione método de pago', 'error'); return; }
        const monto = parseFloat(document.getElementById('cobroMonto').value) || 0;
        if (monto <= 0) { toast('Ingrese monto válido', 'error'); return; }
        
        pagosTemporales.push({
            metodo_pago_id: metodoSeleccionado,
            monto,
            referencia: document.getElementById('cobroReferencia').value
        });
    }
    
    const total = parseFloat(ventaActual.total) || 0;
    const pagadoPrev = ventaActual.pagos?.filter(p => p.estatus === 'APLICADO').reduce((s, p) => s + parseFloat(p.monto), 0) || 0;
    const saldo = total - pagadoPrev;
    const totalPagos = pagosTemporales.reduce((s, p) => s + p.monto, 0);
    
    if (totalPagos < saldo) {
        if (!confirm(`El monto (${formatMoney(totalPagos)}) es menor al saldo (${formatMoney(saldo)}). ¿Registrar pago parcial?`)) return;
    }
    
    try {
        for (const pago of pagosTemporales) {
            await API.request('/pagos', 'POST', {
                empresa_id: empresaId,
                sucursal_id: sucursalId,
                venta_id: ventaActual.venta_id,
                metodo_pago_id: pago.metodo_pago_id,
                monto: pago.monto,
                referencia: pago.referencia,
                usuario_id: usuarioId
            });
        }
        
        const nuevoSaldo = saldo - totalPagos;
        if (nuevoSaldo <= 0.01) {
            await API.request(`/ventas/${ventaActual.venta_id}`, 'PUT', {
                estatus: 'PAGADA',
                pagado: total,
                cambio: Math.max(0, totalPagos - saldo)
            });
        }
        
        toast('Pago registrado', 'success');
        cerrarModal('modalCobro');
        cargarVentaEnFormulario(ventaActual.venta_id);
    } catch (e) { toast('Error al procesar pago', 'error'); }
}

// ==================== CAMBIAR PAGO ====================

function abrirCambiarPago(pagoId) {
    const pago = ventaActual.pagos.find(p => p.pago_id === pagoId);
    if (!pago) return;
    
    document.getElementById('cambiarPagoId').value = pagoId;
    
    const metodo = metodosData.find(m => m.metodo_pago_id === pago.metodo_pago_id);
    document.getElementById('pagoActualInfo').innerHTML = `
        <strong>${metodo?.nombre || 'Pago'}</strong> - ${formatMoney(pago.monto)}
        ${pago.referencia ? `<br><small>Ref: ${pago.referencia}</small>` : ''}
    `;
    
    document.getElementById('nuevoMetodoPago').innerHTML = metodosData.map(m => `<option value="${m.metodo_pago_id}">${m.nombre}</option>`).join('');
    document.getElementById('nuevaReferencia').value = '';
    document.getElementById('motivoCambio').value = '';
    
    abrirModal('modalCambiarPago');
}

function confirmarCambioPago() {
    document.getElementById('accionPendiente').value = 'cambiar_pago';
    cerrarModal('modalCambiarPago');
    abrirModal('modalAutorizacion');
}

async function procesarCambioPago(autorizador) {
    const pagoId = document.getElementById('cambiarPagoId').value;
    const nuevoMetodo = document.getElementById('nuevoMetodoPago').value;
    const referencia = document.getElementById('nuevaReferencia').value;
    const motivo = document.getElementById('motivoCambio').value;
    
    try {
        const r = await API.request(`/ventas/cambiar-pago/${pagoId}`, 'POST', {
            venta_id: ventaActual.venta_id,
            nuevo_metodo_id: nuevoMetodo,
            referencia,
            motivo,
            modificado_por: usuarioId,
            autorizado_por: autorizador
        });
        
        if (r.success) {
            toast('Método de pago cambiado', 'success');
            cargarVentaEnFormulario(ventaActual.venta_id);
        } else {
            toast(r.error || 'Error', 'error');
        }
    } catch (e) { toast('Error', 'error'); }
}

// ==================== CANCELAR PRODUCTO ====================

function abrirCancelarProducto(idx) {
    const linea = lineasVenta[idx];
    if (!linea || !linea.producto_id) return;
    
    document.getElementById('cancelarDetalleId').value = linea.detalle_id;
    document.getElementById('productoCancelarInfo').innerHTML = `
        <div class="nombre">${linea.nombre}</div>
        <div class="detalles">
            Cantidad: ${linea.cantidad} ${linea.unidad} @ ${formatMoney(linea.precio)}
            <br>Importe: ${formatMoney(linea.importe)}
        </div>
    `;
    document.getElementById('cantidadCancelar').value = linea.cantidad;
    document.getElementById('cantidadCancelar').max = linea.cantidad;
    document.getElementById('motivoCancelacion').value = '';
    actualizarDevolucion();
    
    abrirModal('modalCancelarProducto');
}

function actualizarDevolucion() {
    const detalleId = document.getElementById('cancelarDetalleId').value;
    const linea = lineasVenta.find(l => l.detalle_id === detalleId);
    if (!linea) return;
    
    const cantidad = parseFloat(document.getElementById('cantidadCancelar').value) || 0;
    const devolucion = cantidad * linea.precio;
    document.getElementById('montoDevolucion').textContent = formatMoney(devolucion);
}

function confirmarCancelarProducto() {
    document.getElementById('accionPendiente').value = 'cancelar_producto';
    cerrarModal('modalCancelarProducto');
    abrirModal('modalAutorizacion');
}

async function procesarCancelacionProducto(autorizador) {
    const detalleId = document.getElementById('cancelarDetalleId').value;
    const cantidad = parseFloat(document.getElementById('cantidadCancelar').value) || 0;
    const motivo = document.getElementById('motivoCancelacion').value;
    
    try {
        const r = await API.request(`/ventas/cancelar-producto/${detalleId}`, 'POST', {
            venta_id: ventaActual.venta_id,
            cantidad_cancelar: cantidad,
            motivo,
            cancelado_por: usuarioId,
            autorizado_por: autorizador
        });
        
        if (r.success) {
            toast(`Producto cancelado. Devolución: ${formatMoney(r.devolucion)}`, 'success');
            cargarVentaEnFormulario(ventaActual.venta_id);
        } else {
            toast(r.error || 'Error', 'error');
        }
    } catch (e) { toast('Error', 'error'); }
}

// ==================== LISTA VENTAS ====================

async function cargarVentas() {
    try {
        const params = new URLSearchParams();
        const desde = document.getElementById('filtroDesde').value;
        const hasta = document.getElementById('filtroHasta').value;
        const cliente = document.getElementById('filtroCliente').value;
        const estatus = document.getElementById('filtroEstatus').value;
        const tipo = document.getElementById('filtroTipo').value;
        
        if (desde) params.append('desde', desde);
        if (hasta) params.append('hasta', hasta);
        if (cliente) params.append('cliente', cliente);
        if (estatus) params.append('estatus', estatus);
        if (tipo) params.append('tipo', tipo);
        
        const r = await API.request(`/ventas/${empresaId}?${params.toString()}`);
        ventasData = r.success ? r.ventas : [];
        ventasFiltradas = [...ventasData];
        
        const activas = ventasData.filter(v => v.estatus !== 'CANCELADA');
        const total = activas.reduce((s, v) => s + parseFloat(v.total || 0), 0);
        const pagado = activas.reduce((s, v) => s + parseFloat(v.pagado || 0), 0);
        const pendiente = total - pagado;
        const canceladas = ventasData.filter(v => v.estatus === 'CANCELADA').length;
        
        document.getElementById('statVentas').textContent = activas.length;
        document.getElementById('statTotal').textContent = formatMoney(total);
        document.getElementById('statPendiente').textContent = formatMoney(pendiente);
        document.getElementById('statCanceladas').textContent = canceladas;
        
        renderVentasList();
        document.getElementById('totalVentas').textContent = `${ventasData.length} ventas`;
        document.getElementById('emptyVentas').classList.toggle('show', ventasData.length === 0);
    } catch (e) { ventasData = []; }
}

function renderVentasList() {
    document.getElementById('tablaVentas').innerHTML = ventasFiltradas.map(v => {
        const saldo = Math.max(0, parseFloat(v.total || 0) - parseFloat(v.pagado || 0));
        return `
            <tr onclick="cargarVentaEnFormulario('${v.venta_id}')">
                <td><strong style="color:var(--primary)">${v.serie || 'V'}-${v.folio}</strong></td>
                <td>${v.cliente_nombre || 'Público General'}</td>
                <td>${formatFecha(v.fecha_hora)}</td>
                <td><span class="badge badge-${v.tipo_venta === 'CREDITO' ? 'orange' : 'blue'}">${v.tipo_venta}</span></td>
                <td class="text-right"><strong>${formatMoney(v.total)}</strong></td>
                <td class="text-right">${saldo > 0 ? `<span style="color:var(--danger)">${formatMoney(saldo)}</span>` : '<span style="color:var(--success)">$0.00</span>'}</td>
                <td class="text-center">${getBadge(v.estatus)}</td>
                <td class="text-center">
                    <button class="btn btn-sm" onclick="event.stopPropagation(); cargarVentaEnFormulario('${v.venta_id}')" title="Ver"><i class="fas fa-eye"></i></button>
                </td>
            </tr>
        `;
    }).join('');
}

function getBadge(estatus) {
    const mapeo = {
        BORRADOR: { color: 'gray', texto: 'Borrador' },
        PENDIENTE: { color: 'orange', texto: 'Confirmada' },
        CONFIRMADA: { color: 'orange', texto: 'Confirmada' },
        PAGADA: { color: 'green', texto: 'Pagada' },
        CANCELADA: { color: 'red', texto: 'Cancelada' }
    };
    const e = mapeo[estatus] || { color: 'gray', texto: estatus };
    return `<span class="badge badge-${e.color}">${e.texto}</span>`;
}

// ==================== DEVOLUCIONES ====================

async function cargarDevoluciones() {
    try {
        const desde = document.getElementById('filtroDevDesde').value;
        const hasta = document.getElementById('filtroDevHasta').value;
        
        const r = await API.request(`/reportes/devoluciones?empresa_id=${empresaId}&desde=${desde}&hasta=${hasta}`);
        devolucionesData = r.success ? r.devoluciones : [];
        
        const tbody = document.getElementById('tablaDevoluciones');
        const empty = document.getElementById('emptyDevoluciones');
        
        if (devolucionesData.length === 0) {
            tbody.innerHTML = '';
            empty.classList.add('show');
            document.getElementById('totalDevoluciones').textContent = '0 devoluciones';
            document.getElementById('sumaDevoluciones').textContent = 'Total: $0.00';
        } else {
            empty.classList.remove('show');
            tbody.innerHTML = devolucionesData.map(d => `
                <tr>
                    <td>${formatFecha(d.fecha)}</td>
                    <td>${d.venta_folio || '-'}</td>
                    <td>${d.cliente_nombre || '-'}</td>
                    <td class="text-right"><strong style="color:var(--danger)">${formatMoney(d.monto)}</strong></td>
                    <td>${d.metodo || '-'}</td>
                    <td>${d.motivo || '-'}</td>
                    <td>${d.usuario_nombre || '-'}</td>
                </tr>
            `).join('');
            
            const totalMonto = devolucionesData.reduce((s, d) => s + parseFloat(d.monto || 0), 0);
            document.getElementById('totalDevoluciones').textContent = `${devolucionesData.length} devoluciones`;
            document.getElementById('sumaDevoluciones').textContent = `Total: ${formatMoney(totalMonto)}`;
        }
    } catch (e) { devolucionesData = []; }
}

// ==================== GUARDAR CLIENTE ====================

async function guardarCliente() {
    const nombre = document.getElementById('cliNombre').value.trim();
    if (!nombre) { toast('Nombre requerido', 'error'); return; }
    
    try {
        const r = await API.request('/clientes', 'POST', {
            empresa_id: empresaId,
            nombre,
            telefono: document.getElementById('cliTelefono').value,
            email: document.getElementById('cliEmail').value,
            rfc: document.getElementById('cliRFC').value,
            tipo_precio: document.getElementById('cliTipoPrecio').value,
            direccion: document.getElementById('cliDireccion').value,
            activo: 'Y'
        });
        
        if (r.success) {
            toast('Cliente creado', 'success');
            cerrarModal('modalCliente');
            ['cliNombre', 'cliTelefono', 'cliEmail', 'cliRFC', 'cliDireccion'].forEach(id => document.getElementById(id).value = '');
            document.getElementById('cliTipoPrecio').value = '1';
            await cargarClientes();
            document.getElementById('ventaCliente').value = r.cliente_id;
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
            nombre,
            codigo_barras: document.getElementById('prodCodigo').value,
            codigo_interno: document.getElementById('prodInterno').value,
            categoria_id: document.getElementById('prodCategoria').value || null,
            precio1: parseFloat(document.getElementById('prodPrecio').value) || 0,
            activo: 'Y',
            es_vendible: 'Y'
        });
        
        if (r.success) {
            toast('Producto creado', 'success');
            cerrarModal('modalProducto');
            ['prodCodigo', 'prodInterno', 'prodNombre', 'prodPrecio'].forEach(id => document.getElementById(id).value = '');
            document.getElementById('prodCategoria').value = '';
            await cargarProductos();
        } else { toast(r.error || 'Error', 'error'); }
    } catch (e) { toast('Error', 'error'); }
}

// ==================== PDF ====================

function generarPDF() {
    if (!ventaActual) return;
    
    const v = ventaActual;
    const cliente = clientesData.find(c => c.cliente_id === v.cliente_id);
    const lineasValidas = lineasVenta.filter(l => l.producto_id);
    
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
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .info-box { background: #f9f9f9; padding: 15px; border-radius: 6px; }
        .info-label { font-size: 10px; color: #888; text-transform: uppercase; }
        .info-value { font-size: 13px; font-weight: 500; margin-top: 2px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background: #2D3DBF; color: #fff; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; }
        td { padding: 10px 12px; border-bottom: 1px solid #eee; }
        .text-right { text-align: right; }
        .totals { margin-top: 20px; display: flex; justify-content: flex-end; }
        .totals-box { width: 280px; }
        .total-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
        .total-row.final { border-top: 2px solid #2D3DBF; margin-top: 8px; padding-top: 12px; font-size: 16px; font-weight: bold; color: #2D3DBF; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #888; font-size: 10px; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: bold; background: #dcfce7; color: #16a34a; }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">CAFI POS</div>
        <div class="doc-info">
            <div class="doc-title">NOTA DE VENTA</div>
            <div class="doc-folio">${v.serie || 'V'}-${v.folio}</div>
            <div class="doc-fecha">${formatFecha(v.fecha_hora)}</div>
            <div style="margin-top:8px"><span class="badge">${v.estatus}</span></div>
        </div>
    </div>

    <div class="section">
        <div class="info-grid">
            <div class="info-box">
                <div class="info-label">Cliente</div>
                <div class="info-value">${cliente?.nombre || 'Público General'}</div>
                ${cliente?.telefono ? `<div style="font-size:11px;color:#666">${cliente.telefono}</div>` : ''}
                ${cliente?.email ? `<div style="font-size:11px;color:#666">${cliente.email}</div>` : ''}
            </div>
            <div class="info-box">
                <div class="info-label">Información de Venta</div>
                <div style="margin-top:4px"><span style="color:#888">Tipo:</span> ${v.tipo_venta}</div>
                <div><span style="color:#888">Vendedor:</span> ${v.vendedor_nombre || '-'}</div>
            </div>
        </div>
    </div>

    <div class="section">
        <table>
            <thead>
                <tr>
                    <th style="width:40%">Producto</th>
                    <th class="text-right">Cantidad</th>
                    <th class="text-right">Precio</th>
                    <th class="text-right">Desc.</th>
                    <th class="text-right">Importe</th>
                </tr>
            </thead>
            <tbody>
                ${lineasValidas.map(l => `
                    <tr>
                        <td><strong>${l.nombre}</strong><br><span style="font-size:10px;color:#888">${l.codigo}</span></td>
                        <td class="text-right">${l.cantidad} ${l.unidad}</td>
                        <td class="text-right">${formatMoney(l.precio)}</td>
                        <td class="text-right">${l.descuento_pct > 0 ? l.descuento_pct.toFixed(1) + '%' : '-'}</td>
                        <td class="text-right"><strong>${formatMoney(l.importe)}</strong></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="totals">
        <div class="totals-box">
            <div class="total-row"><span>Subtotal:</span><span>${formatMoney(v.subtotal)}</span></div>
            <div class="total-row"><span>Descuento:</span><span>-${formatMoney(v.descuento || 0)}</span></div>
            <div class="total-row final"><span>TOTAL:</span><span>${formatMoney(v.total)}</span></div>
        </div>
    </div>

    ${v.notas ? `<div class="section"><p style="background:#f9f9f9;padding:12px;border-radius:6px;font-style:italic">${v.notas}</p></div>` : ''}

    <div class="footer">
        <p>¡Gracias por su compra!</p>
        <p style="margin-top:8px">Documento generado por CAFI POS - ${new Date().toLocaleString('es-MX')}</p>
    </div>
</body>
</html>`;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.onload = () => printWindow.print();
}

// ==================== EXPORT ====================

function exportarVentas() {
    if (ventasFiltradas.length === 0) { toast('No hay datos', 'error'); return; }
    
    let csv = 'Folio,Cliente,Fecha,Tipo,Total,Pagado,Saldo,Estatus\n';
    ventasFiltradas.forEach(v => {
        const saldo = Math.max(0, parseFloat(v.total) - parseFloat(v.pagado || 0));
        csv += `${v.serie || 'V'}-${v.folio},${(v.cliente_nombre || 'Público General').replace(/,/g, '')},${v.fecha_hora?.split('T')[0]},${v.tipo_venta},${v.total},${v.pagado || 0},${saldo},${v.estatus}\n`;
    });
    
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ventas_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
}

function imprimirLista() {
    window.print();
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
