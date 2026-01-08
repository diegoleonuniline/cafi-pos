/* ============================================
   VENTAS.JS - CAFI POS
   Módulo Ventas Estilo Odoo
   Tabs: General | Productos | Pagos
   ============================================ */

const empresaId = localStorage.getItem('empresa_id') || (JSON.parse(localStorage.getItem('usuario') || '{}')).empresa_id;
const sucursalId = localStorage.getItem('sucursal_id') || (JSON.parse(localStorage.getItem('usuario') || '{}')).sucursal_id;
const usuarioId = (JSON.parse(localStorage.getItem('usuario') || '{}')).id;

// Data
let clientesData = [], almacenesData = [], productosData = [], metodosData = [], categoriasData = [], usuariosData = [];
let ventasData = [], devolucionesData = [];

// Estado venta actual
let ventaActual = null;
let lineasVenta = [];
let pagosVenta = [];
let metodoSeleccionado = null;
let categoriaFiltro = null;

// ==================== INIT ====================

document.addEventListener('DOMContentLoaded', () => {
    initUsuario();
    initTabs();
    initInnerTabs();
    initFiltros();
    cargarDatosIniciales();
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
            
            if (tab === 'lista') cargarVentas();
            if (tab === 'devoluciones') cargarDevoluciones();
        });
    });
}

function initInnerTabs() {
    document.querySelectorAll('.inner-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.inner;
            document.querySelectorAll('.inner-tab').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.inner-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`inner-${tab}`)?.classList.add('active');
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
    renderMetodosPago();
    agregarLineaVacia(); // Siempre inicia con una línea lista
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
    } catch (e) { console.error('Error cargando clientes:', e); }
}

async function cargarAlmacenes() {
    try {
        const r = await API.request(`/almacenes/${empresaId}`);
        if (r.success) {
            almacenesData = r.almacenes || [];
            const opts = almacenesData.map(a => `<option value="${a.almacen_id}">${a.sucursal_nombre ? a.sucursal_nombre + ' - ' : ''}${a.nombre}</option>`).join('');
            document.getElementById('ventaAlmacen').innerHTML = '<option value="">Seleccionar...</option>' + opts;
            if (almacenesData.length === 1) document.getElementById('ventaAlmacen').value = almacenesData[0].almacen_id;
        }
    } catch (e) { console.error('Error cargando almacenes:', e); }
}

async function cargarProductos() {
    try {
        const r = await API.request(`/productos/${empresaId}`);
        if (r.success) {
            productosData = (r.productos || r.data || []).filter(p => p.activo === 'Y' && p.es_vendible !== 'N');
        }
    } catch (e) { console.error('Error cargando productos:', e); }
}

async function cargarMetodosPago() {
    try {
        const r = await API.request(`/metodos-pago/${empresaId}`);
        if (r.success) {
            metodosData = (r.metodos || []).filter(m => m.activo === 'Y');
            document.getElementById('nuevoMetodoPago').innerHTML = metodosData.map(m => `<option value="${m.metodo_pago_id}">${m.nombre}</option>`).join('');
        }
    } catch (e) { console.error('Error cargando métodos de pago:', e); }
}

async function cargarCategorias() {
    try {
        const r = await API.request(`/categorias/${empresaId}`);
        if (r.success) {
            categoriasData = r.categorias || r.data || [];
        }
    } catch (e) { console.error('Error cargando categorías:', e); }
}

async function cargarUsuarios() {
    try {
        const r = await API.request(`/usuarios/${empresaId}`);
        if (r.success) {
            usuariosData = r.usuarios || [];
            document.getElementById('ventaVendedor').innerHTML = '<option value="">Sin vendedor</option>' + usuariosData.map(u => `<option value="${u.usuario_id}">${u.nombre}</option>`).join('');
        }
    } catch (e) { console.error('Error cargando usuarios:', e); }
}

function renderMetodosPago() {
    const grid = document.getElementById('metodosPagoGrid');
    grid.innerHTML = metodosData.map(m => {
        const icono = getIconoMetodo(m.nombre);
        return `
            <div class="metodo-btn ${metodoSeleccionado === m.metodo_pago_id ? 'active' : ''}" 
                 data-id="${m.metodo_pago_id}" 
                 data-tipo="${m.tipo || 'EFECTIVO'}"
                 data-ref="${m.requiere_referencia || 'N'}"
                 onclick="seleccionarMetodoPago('${m.metodo_pago_id}')">
                <i class="fas ${icono}"></i>
                <span>${m.nombre}</span>
            </div>
        `;
    }).join('');
    
    // Seleccionar efectivo por defecto
    const efectivo = metodosData.find(m => (m.tipo || '').toUpperCase() === 'EFECTIVO' || m.nombre.toLowerCase().includes('efectivo'));
    if (efectivo && !metodoSeleccionado) {
        seleccionarMetodoPago(efectivo.metodo_pago_id);
    }
}

function getIconoMetodo(nombre) {
    const n = (nombre || '').toLowerCase();
    if (n.includes('efectivo') || n.includes('cash')) return 'fa-money-bill-wave';
    if (n.includes('tarjeta') || n.includes('card') || n.includes('debito') || n.includes('credito')) return 'fa-credit-card';
    if (n.includes('transfer')) return 'fa-university';
    if (n.includes('cheque')) return 'fa-money-check';
    return 'fa-dollar-sign';
}

// ==================== EVENTOS ====================

function onClienteChange() {
    const clienteId = document.getElementById('ventaCliente').value;
    const infoCard = document.getElementById('clienteInfoCard');
    
    if (!clienteId) {
        infoCard.style.display = 'none';
        return;
    }
    
    const cliente = clientesData.find(c => c.cliente_id === clienteId);
    if (cliente) {
        document.getElementById('clienteInfoNombre').textContent = cliente.nombre;
        document.getElementById('clienteInfoTel').textContent = cliente.telefono || '-';
        document.getElementById('clienteInfoPrecio').textContent = `Precio ${cliente.tipo_precio || 1}`;
        document.getElementById('clienteInfoCredito').textContent = cliente.permite_credito === 'Y' ? 'Sí' : 'No';
        document.getElementById('clienteInfoLimite').textContent = formatMoney(cliente.limite_credito || 0);
        document.getElementById('clienteInfoSaldo').textContent = formatMoney(cliente.saldo || 0);
        infoCard.style.display = 'block';
        
        // Si el cliente no permite crédito, forzar a contado
        if (cliente.permite_credito !== 'Y' && document.getElementById('ventaTipo').value === 'CREDITO') {
            document.getElementById('ventaTipo').value = 'CONTADO';
            onTipoVentaChange();
            toast('Este cliente no tiene crédito habilitado', 'warning');
        }
        
        // Actualizar precios según tipo de precio del cliente
        actualizarPreciosCliente(cliente.tipo_precio || 1);
    }
}

function actualizarPreciosCliente(tipoPrecio) {
    lineasVenta.forEach((linea, idx) => {
        if (linea.producto_id) {
            const producto = productosData.find(p => p.producto_id === linea.producto_id);
            if (producto) {
                let precio = parseFloat(producto.precio_venta || producto.precio1 || 0);
                if (tipoPrecio === 2 && producto.precio2) precio = parseFloat(producto.precio2);
                if (tipoPrecio === 3 && producto.precio3) precio = parseFloat(producto.precio3);
                if (tipoPrecio === 4 && producto.precio4) precio = parseFloat(producto.precio4);
                linea.precio = precio;
                linea.precio_original = precio;
                // Recalcular descuento_monto si hay descuento_pct
                if (linea.descuento_pct > 0) {
                    const subtotal = linea.cantidad * linea.precio;
                    linea.descuento_monto = subtotal * linea.descuento_pct / 100;
                }
                calcularImporteLinea(idx);
            }
        }
    });
    renderLineas();
}

function onTipoVentaChange() {
    const tipo = document.getElementById('ventaTipo').value;
    const badge = document.getElementById('tipoVentaBadge');
    const alertaContado = document.getElementById('alertaContado');
    const alertaCredito = document.getElementById('alertaCredito');
    
    badge.textContent = tipo;
    badge.className = `tipo-venta-badge ${tipo.toLowerCase()}`;
    
    if (tipo === 'CONTADO') {
        alertaContado.style.display = 'flex';
        alertaCredito.style.display = 'none';
    } else {
        alertaContado.style.display = 'none';
        alertaCredito.style.display = 'flex';
        
        // Validar que el cliente permita crédito
        const clienteId = document.getElementById('ventaCliente').value;
        if (clienteId) {
            const cliente = clientesData.find(c => c.cliente_id === clienteId);
            if (cliente && cliente.permite_credito !== 'Y') {
                toast('Este cliente no tiene crédito habilitado', 'error');
                document.getElementById('ventaTipo').value = 'CONTADO';
                onTipoVentaChange();
                return;
            }
        } else {
            toast('Seleccione un cliente para venta a crédito', 'warning');
        }
    }
    
    actualizarBadgePagos();
}

// ==================== NUEVA VENTA ====================

function nuevaVenta() {
    ventaActual = null;
    lineasVenta = [];
    pagosVenta = [];
    metodoSeleccionado = null;
    
    document.getElementById('ventaId').value = '';
    document.getElementById('ventaCliente').value = '';
    document.getElementById('ventaCliente').disabled = false;
    document.getElementById('ventaAlmacen').value = almacenesData.length === 1 ? almacenesData[0].almacen_id : '';
    document.getElementById('ventaAlmacen').disabled = false;
    document.getElementById('ventaFecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('ventaTipo').value = 'CONTADO';
    document.getElementById('ventaTipo').disabled = false;
    document.getElementById('ventaDescuentoGlobal').value = '0';
    document.getElementById('ventaDescuentoGlobal').disabled = false;
    document.getElementById('ventaVendedor').value = '';
    document.getElementById('ventaNotas').value = '';
    document.getElementById('ventaFolio').textContent = '';
    document.getElementById('clienteInfoCard').style.display = 'none';
    
    onTipoVentaChange();
    actualizarStatusBar('BORRADOR');
    actualizarBotones('BORRADOR');
    agregarLineaVacia(); // Siempre inicia con una línea lista
    renderPagos();
    renderMetodosPago();
    calcularTotales();
    actualizarResumenPagos();
    
    // Ir a tab formulario y pestaña productos
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelector('[data-tab="formulario"]').classList.add('active');
    document.getElementById('panel-formulario').classList.add('active');
    
    document.querySelectorAll('.inner-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.inner-panel').forEach(p => p.classList.remove('active'));
    document.querySelector('[data-inner="productos"]').classList.add('active');
    document.getElementById('inner-productos').classList.add('active');
}

// ==================== LINEAS DE PRODUCTOS ====================

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
    
    // Siempre tener al menos una línea vacía para escribir
    if (lineasVenta.length === 0 || (editable && lineasVenta[lineasVenta.length - 1].producto_id)) {
        lineasVenta.push({
            producto_id: '', nombre: '', codigo: '', cantidad: 1, unidad: 'PZ',
            precio: 0, precio_original: 0, descuento_pct: 0, descuento_monto: 0,
            iva: 16, importe: 0, stock: 0
        });
    }
    
    const lineasValidas = lineasVenta.filter(l => l.producto_id).length;
    document.getElementById('contadorProductos').textContent = lineasValidas;
    
    tbody.innerHTML = lineasVenta.map((l, i) => `
        <tr data-idx="${i}">
            <td class="producto-cell">
                <div class="producto-input-wrap">
                    <input type="text" 
                        class="input-producto" 
                        id="prod-input-${i}"
                        value="${l.nombre}" 
                        placeholder="Buscar producto..." 
                        oninput="lineasVenta[${i}].nombre = this.value; buscarProducto(${i}, this.value)" 
                        onkeydown="navegarAutocomplete(event, ${i})"
                        onfocus="if(this.value.length > 0) buscarProducto(${i}, this.value)"
                        autocomplete="off"
                        ${editable ? '' : 'disabled'}>
                    ${l.codigo ? `<span class="codigo-badge">${l.codigo}</span>` : ''}
                    <div class="autocomplete-dropdown" id="autocomplete-${i}"></div>
                </div>
            </td>
            <td>
                <input type="number" 
                    class="input-sm text-center" 
                    id="cant-input-${i}"
                    value="${l.cantidad}" 
                    min="0.01" 
                    step="0.01"
                    oninput="actualizarLinea(${i}, 'cantidad', this.value)"
                    onkeydown="if(event.key==='Enter'){event.preventDefault(); agregarLineaVacia();}"
                    ${editable ? '' : 'disabled'}>
            </td>
            <td class="text-center text-muted">${l.unidad}</td>
            <td>
                <input type="number" 
                    class="input-sm text-right" 
                    value="${l.precio.toFixed(2)}" 
                    min="0" 
                    step="0.01"
                    oninput="actualizarLinea(${i}, 'precio', this.value)"
                    ${editable ? '' : 'disabled'}>
            </td>
            <td>
                <input type="number" 
                    class="input-sm text-center" 
                    value="${l.descuento_pct}" 
                    min="0" 
                    max="100"
                    step="0.01"
                    oninput="actualizarLinea(${i}, 'descuento_pct', this.value)"
                    ${editable ? '' : 'disabled'}>
            </td>
            <td>
                <input type="number" 
                    class="input-sm text-right" 
                    value="${l.descuento_monto.toFixed(2)}" 
                    min="0" 
                    step="0.01"
                    oninput="actualizarLinea(${i}, 'descuento_monto', this.value)"
                    ${editable ? '' : 'disabled'}>
            </td>
            <td class="text-right importe-cell">${formatMoney(l.importe)}</td>
            <td class="actions-cell">
                ${editable ? `<button class="btn-icon danger" onclick="quitarLinea(${i})" title="Eliminar"><i class="fas fa-trash"></i></button>` : ''}
                ${esPagada && l.producto_id && l.detalle_id ? `<button class="btn-icon warning" onclick="abrirCancelarProducto(${i})" title="Cancelar"><i class="fas fa-times-circle"></i></button>` : ''}
            </td>
        </tr>
    `).join('');
    
    calcularTotales();
}

function buscarProducto(idx, texto) {
    const dropdown = document.getElementById(`autocomplete-${idx}`);
    
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
        dropdown.innerHTML = `<div class="autocomplete-empty">No encontrado</div>`;
    } else {
        dropdown.innerHTML = resultados.map((p, i) => `
            <div class="autocomplete-item" data-idx="${i}" onclick="seleccionarProducto(${idx}, '${p.producto_id}')">
                <div class="item-info">
                    <span class="item-name">${p.nombre}</span>
                    <span class="item-code">${p.codigo_barras || p.codigo_interno || '-'}</span>
                </div>
                <div class="item-right">
                    <span class="item-price">${formatMoney(p.precio_venta || p.precio1 || 0)}</span>
                    <span class="item-stock">Stock: ${p.stock || 0}</span>
                </div>
            </div>
        `).join('');
    }
    dropdown.classList.add('show');
}

function navegarAutocomplete(event, idx) {
    const dropdown = document.getElementById(`autocomplete-${idx}`);
    const items = dropdown.querySelectorAll('.autocomplete-item');
    
    if (!dropdown.classList.contains('show') || items.length === 0) {
        if (event.key === 'Enter') event.preventDefault();
        return;
    }
    
    let currentIdx = Array.from(items).findIndex(el => el.classList.contains('selected'));
    
    if (event.key === 'ArrowDown') {
        event.preventDefault();
        currentIdx = Math.min(currentIdx + 1, items.length - 1);
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        currentIdx = Math.max(currentIdx - 1, 0);
    } else if (event.key === 'Enter') {
        event.preventDefault();
        if (currentIdx >= 0) items[currentIdx].click();
        return;
    } else if (event.key === 'Escape') {
        dropdown.classList.remove('show');
        return;
    } else {
        return;
    }
    
    items.forEach((el, i) => el.classList.toggle('selected', i === currentIdx));
    if (currentIdx >= 0) items[currentIdx].scrollIntoView({ block: 'nearest' });
}

function seleccionarProducto(idx, productoId) {
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
    renderLineas();
    
    // Focus en cantidad después de seleccionar
    setTimeout(() => {
        const cantInput = document.getElementById(`cant-input-${idx}`);
        if (cantInput) {
            cantInput.focus();
            cantInput.select();
        }
    }, 50);
}

function buscarPorCodigo(event) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    
    const input = document.getElementById('buscarCodigo');
    const codigo = input.value.trim();
    if (!codigo) return;
    
    const producto = productosData.find(p => 
        p.codigo_barras === codigo || 
        p.codigo_interno === codigo
    );
    
    if (producto) {
        // Buscar si ya existe en lineas
        const existeIdx = lineasVenta.findIndex(l => l.producto_id === producto.producto_id);
        if (existeIdx >= 0) {
            lineasVenta[existeIdx].cantidad += 1;
            calcularImporteLinea(existeIdx);
        } else {
            let idx = lineasVenta.findIndex(l => !l.producto_id);
            if (idx === -1) {
                lineasVenta.push({});
                idx = lineasVenta.length - 1;
            }
            seleccionarProducto(idx, producto.producto_id);
        }
        renderLineas();
        input.value = '';
        toast(`${producto.nombre} agregado`, 'success');
    } else {
        toast('Producto no encontrado', 'error');
    }
    
    input.focus();
}

function actualizarLinea(idx, campo, valor) {
    const val = parseFloat(valor) || 0;
    const l = lineasVenta[idx];
    
    if (campo === 'cantidad') {
        l.cantidad = val;
        // Recalcular descuento_monto si hay descuento_pct
        if (l.descuento_pct > 0) {
            const subtotal = l.cantidad * l.precio;
            l.descuento_monto = subtotal * l.descuento_pct / 100;
        }
    } else if (campo === 'precio') {
        l.precio = val;
        // Recalcular descuento_monto si hay descuento_pct
        if (l.descuento_pct > 0) {
            const subtotal = l.cantidad * l.precio;
            l.descuento_monto = subtotal * l.descuento_pct / 100;
        }
    } else if (campo === 'descuento_pct') {
        l.descuento_pct = val;
        const subtotal = l.cantidad * l.precio;
        l.descuento_monto = subtotal * val / 100;
    } else if (campo === 'descuento_monto') {
        l.descuento_monto = val;
        const subtotal = l.cantidad * l.precio;
        l.descuento_pct = subtotal > 0 ? (val / subtotal) * 100 : 0;
    }
    
    calcularImporteLinea(idx);
    
    // Actualizar solo la celda de importe sin re-renderizar todo
    const row = document.querySelector(`tr[data-idx="${idx}"]`);
    if (row) {
        const importeCell = row.querySelector('.importe-cell');
        if (importeCell) importeCell.textContent = formatMoney(lineasVenta[idx].importe);
    }
    
    calcularTotales();
    actualizarResumenPagos();
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
    lineasVenta.splice(idx, 1);
    renderLineas();
    actualizarResumenPagos();
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
    actualizarResumenPagos();
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
    document.getElementById('pagoTotalVenta').textContent = formatMoney(total);
    
    return { subtotal, descuento, iva, total };
}

// Cerrar autocomplete al hacer click afuera
document.addEventListener('click', e => {
    if (!e.target.closest('.producto-cell')) {
        document.querySelectorAll('.autocomplete-dropdown').forEach(d => d.classList.remove('show'));
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
        categoriasData.filter(c => c.activo !== 'N').map(c => 
            `<button class="cat-btn ${categoriaFiltro === c.categoria_id ? 'active' : ''}" onclick="filtrarCategoria('${c.categoria_id}')">${c.nombre}</button>`
        ).join('');
}

function filtrarCategoria(catId) {
    categoriaFiltro = catId;
    renderCatalogoCategorias();
    filtrarCatalogo();
}

function renderCatalogo(productos) {
    document.getElementById('catalogoGrid').innerHTML = productos.length === 0
        ? '<div class="catalog-empty">No hay productos</div>'
        : productos.map(p => `
            <div class="catalog-item" onclick="agregarDesdeCatalogo('${p.producto_id}')">
                <div class="catalog-name">${p.nombre}</div>
                <div class="catalog-code">${p.codigo_barras || p.codigo_interno || '-'}</div>
                <div class="catalog-price">${formatMoney(p.precio_venta || p.precio1 || 0)}</div>
                <div class="catalog-stock">Stock: ${p.stock || 0}</div>
            </div>
        `).join('');
}

function filtrarCatalogo() {
    const texto = document.getElementById('catalogoBuscar').value.toLowerCase();
    let filtrados = productosData;
    
    if (categoriaFiltro) filtrados = filtrados.filter(p => p.categoria_id === categoriaFiltro);
    if (texto) filtrados = filtrados.filter(p => p.nombre?.toLowerCase().includes(texto) || p.codigo_barras?.toLowerCase().includes(texto));
    
    renderCatalogo(filtrados.slice(0, 30));
}

function agregarDesdeCatalogo(productoId) {
    let idx = lineasVenta.findIndex(l => !l.producto_id);
    if (idx === -1) {
        lineasVenta.push({});
        idx = lineasVenta.length - 1;
    }
    seleccionarProducto(idx, productoId);
    cerrarModal('modalCatalogo');
}

// ==================== PAGOS ====================

function seleccionarMetodoPago(metodoId) {
    metodoSeleccionado = metodoId;
    document.querySelectorAll('.metodo-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.id === metodoId);
    });
    
    const metodo = metodosData.find(m => m.metodo_pago_id === metodoId);
    const requiereRef = metodo?.requiere_referencia === 'Y' || (metodo?.tipo || '').toUpperCase() !== 'EFECTIVO';
    document.getElementById('campoReferencia').style.display = requiereRef ? '' : 'none';
    
    // Prellenar monto con saldo pendiente
    const totales = calcularTotales();
    const totalPagado = pagosVenta.reduce((s, p) => s + p.monto, 0);
    const saldo = Math.max(0, totales.total - totalPagado);
    document.getElementById('pagoMonto').value = saldo.toFixed(2);
    calcularCambio();
}

function calcularCambio() {
    const totales = calcularTotales();
    const totalPagado = pagosVenta.reduce((s, p) => s + p.monto, 0);
    const saldo = totales.total - totalPagado;
    const monto = parseFloat(document.getElementById('pagoMonto').value) || 0;
    const cambio = Math.max(0, monto - saldo);
    
    document.getElementById('pagoCambio').textContent = formatMoney(cambio);
    document.getElementById('pagoCambio').classList.toggle('has-cambio', cambio > 0);
}

function agregarPago() {
    if (!metodoSeleccionado) {
        toast('Seleccione un método de pago', 'error');
        return;
    }
    
    const monto = parseFloat(document.getElementById('pagoMonto').value) || 0;
    if (monto <= 0) {
        toast('Ingrese un monto válido', 'error');
        return;
    }
    
    const metodo = metodosData.find(m => m.metodo_pago_id === metodoSeleccionado);
    const referencia = document.getElementById('pagoReferencia').value.trim();
    
    if ((metodo?.requiere_referencia === 'Y' || (metodo?.tipo || '').toUpperCase() !== 'EFECTIVO') && !referencia) {
        toast('Ingrese la referencia del pago', 'error');
        return;
    }
    
    const totales = calcularTotales();
    const totalPagado = pagosVenta.reduce((s, p) => s + p.monto, 0);
    const saldo = totales.total - totalPagado;
    const cambio = Math.max(0, monto - saldo);
    const montoReal = monto - cambio;
    
    pagosVenta.push({
        temp_id: Date.now(),
        metodo_pago_id: metodoSeleccionado,
        metodo_nombre: metodo?.nombre || 'Pago',
        tipo: metodo?.tipo || 'EFECTIVO',
        monto: montoReal,
        referencia: referencia,
        cambio: cambio
    });
    
    document.getElementById('pagoMonto').value = '';
    document.getElementById('pagoReferencia').value = '';
    
    renderPagos();
    actualizarResumenPagos();
    actualizarBadgePagos();
    
    if (cambio > 0) {
        toast(`Pago aplicado. Cambio: ${formatMoney(cambio)}`, 'success');
    } else {
        toast('Pago aplicado', 'success');
    }
}

function quitarPago(tempId) {
    pagosVenta = pagosVenta.filter(p => p.temp_id !== tempId);
    renderPagos();
    actualizarResumenPagos();
    actualizarBadgePagos();
}

function renderPagos() {
    const lista = document.getElementById('listaPagos');
    
    if (pagosVenta.length === 0) {
        lista.innerHTML = `<div class="empty-pagos"><i class="fas fa-receipt"></i><p>Sin pagos registrados</p></div>`;
        return;
    }
    
    lista.innerHTML = pagosVenta.map(p => `
        <div class="pago-item">
            <div class="pago-icon ${p.tipo?.toLowerCase() || 'efectivo'}">
                <i class="fas ${getIconoMetodo(p.metodo_nombre)}"></i>
            </div>
            <div class="pago-info">
                <span class="pago-metodo">${p.metodo_nombre}</span>
                ${p.referencia ? `<span class="pago-ref">${p.referencia}</span>` : ''}
            </div>
            <div class="pago-monto">${formatMoney(p.monto)}</div>
            ${p.temp_id ? `<button class="btn-icon danger" onclick="quitarPago(${p.temp_id})" title="Quitar"><i class="fas fa-times"></i></button>` : ''}
        </div>
    `).join('');
}

function actualizarResumenPagos() {
    const totales = calcularTotales();
    const totalPagado = pagosVenta.reduce((s, p) => s + p.monto, 0);
    const saldo = Math.max(0, totales.total - totalPagado);
    
    document.getElementById('pagoTotalPagado').textContent = formatMoney(totalPagado);
    document.getElementById('pagoSaldoPendiente').textContent = formatMoney(saldo);
    
    const saldoEl = document.getElementById('pagoSaldoPendiente');
    saldoEl.classList.toggle('pagado', saldo <= 0);
    saldoEl.classList.toggle('pendiente', saldo > 0);
}

function actualizarBadgePagos() {
    const badge = document.getElementById('badgePagos');
    const tipo = document.getElementById('ventaTipo').value;
    const totales = calcularTotales();
    const totalPagado = pagosVenta.reduce((s, p) => s + p.monto, 0);
    const saldo = totales.total - totalPagado;
    
    if (saldo <= 0) {
        badge.textContent = '✓';
        badge.className = 'tab-badge success';
    } else if (tipo === 'CONTADO') {
        badge.textContent = '!';
        badge.className = 'tab-badge warning';
    } else {
        badge.textContent = '';
        badge.className = 'tab-badge';
    }
}

// ==================== STATUS Y BOTONES ====================

function actualizarStatusBar(estatus) {
    const estados = ['BORRADOR', 'CONFIRMADA', 'PAGADA'];
    const mapa = { 'PENDIENTE': 'CONFIRMADA' };
    const estatusVisual = mapa[estatus] || estatus;
    
    document.querySelectorAll('.statusbar .step').forEach(step => {
        step.classList.remove('active', 'done');
        const stepEstatus = step.dataset.status;
        const idxStep = estados.indexOf(stepEstatus);
        const idxActual = estados.indexOf(estatusVisual);
        
        if (idxStep < idxActual) step.classList.add('done');
        if (idxStep === idxActual) step.classList.add('active');
    });
}

function actualizarBotones(estatus) {
    const esBorrador = estatus === 'BORRADOR';
    const estaConfirmada = ['PENDIENTE', 'CONFIRMADA'].includes(estatus);
    const estaPagada = estatus === 'PAGADA';
    const estaCancelada = estatus === 'CANCELADA';
    
    document.getElementById('btnGuardar').style.display = esBorrador ? '' : 'none';
    document.getElementById('btnConfirmar').style.display = esBorrador ? '' : 'none';
    document.getElementById('btnPDF').style.display = (ventaActual && !esBorrador) ? '' : 'none';
    document.getElementById('btnReabrir').style.display = (estaPagada && !estaCancelada) ? '' : 'none';
    document.getElementById('btnCancelar').style.display = (!estaCancelada && !estaPagada && ventaActual) ? '' : 'none';
    
    // Deshabilitar campos si no es borrador
    const editable = esBorrador || !ventaActual;
    document.getElementById('ventaCliente').disabled = !editable;
    document.getElementById('ventaAlmacen').disabled = !editable;
    document.getElementById('ventaTipo').disabled = !editable;
    document.getElementById('ventaDescuentoGlobal').disabled = !editable;
    
    // Mostrar/ocultar sección de nuevo pago
    const mostrarNuevoPago = estaConfirmada || esBorrador;
    document.getElementById('seccionNuevoPago').style.display = mostrarNuevoPago ? '' : 'none';
}

// ==================== GUARDAR / CONFIRMAR ====================

async function guardarVenta(estatus) {
    const almacen = document.getElementById('ventaAlmacen').value;
    if (!almacen) {
        toast('Seleccione un almacén', 'error');
        irATab('general');
        return;
    }
    
    const lineasValidas = lineasVenta.filter(l => l.producto_id);
    if (lineasValidas.length === 0) {
        toast('Agregue al menos un producto', 'error');
        irATab('productos');
        return;
    }
    
    const totales = calcularTotales();
    const id = document.getElementById('ventaId').value;
    
    const data = {
        empresa_id: empresaId,
        sucursal_id: sucursalId,
        almacen_id: almacen,
        cliente_id: document.getElementById('ventaCliente').value || null,
        usuario_id: usuarioId,
        vendedor_id: document.getElementById('ventaVendedor').value || null,
        tipo_venta: document.getElementById('ventaTipo').value,
        subtotal: totales.subtotal,
        descuento: totales.descuento,
        total: totales.total,
        notas: document.getElementById('ventaNotas').value,
        estatus: estatus,
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
    
    // Agregar pagos si hay
    if (pagosVenta.length > 0) {
        data.pagos = pagosVenta.map(p => ({
            metodo_pago_id: p.metodo_pago_id,
            monto: p.monto,
            referencia: p.referencia
        }));
        data.pagado = pagosVenta.reduce((s, p) => s + p.monto, 0);
        data.cambio = pagosVenta.reduce((s, p) => s + (p.cambio || 0), 0);
    }
    
    try {
        let r;
        if (id) {
            r = await API.request(`/ventas/${id}`, 'PUT', data);
        } else {
            r = await API.request('/ventas', 'POST', data);
        }
        
        if (r.success) {
            toast(estatus === 'BORRADOR' ? 'Borrador guardado' : 'Venta guardada', 'success');
            cargarVentaEnFormulario(id || r.venta_id);
        } else {
            toast(r.error || 'Error al guardar', 'error');
        }
    } catch (e) {
        console.error(e);
        toast('Error de conexión', 'error');
    }
}

async function confirmarVenta() {
    const tipo = document.getElementById('ventaTipo').value;
    const totales = calcularTotales();
    const totalPagado = pagosVenta.reduce((s, p) => s + p.monto, 0);
    const saldo = totales.total - totalPagado;
    
    // Si es CONTADO, exigir pago completo
    if (tipo === 'CONTADO' && saldo > 0.01) {
        toast('Venta de contado requiere pago completo', 'error');
        irATab('pagos');
        return;
    }
    
    // Si es CREDITO, validar cliente
    if (tipo === 'CREDITO') {
        const clienteId = document.getElementById('ventaCliente').value;
        if (!clienteId) {
            toast('Seleccione un cliente para venta a crédito', 'error');
            irATab('general');
            return;
        }
        
        const cliente = clientesData.find(c => c.cliente_id === clienteId);
        if (cliente && cliente.permite_credito !== 'Y') {
            toast('Este cliente no tiene crédito habilitado', 'error');
            return;
        }
        
        // Validar límite de crédito
        if (cliente && cliente.limite_credito > 0) {
            const saldoActual = parseFloat(cliente.saldo || 0);
            const disponible = parseFloat(cliente.limite_credito) - saldoActual;
            if (saldo > disponible) {
                toast(`Crédito insuficiente. Disponible: ${formatMoney(disponible)}`, 'error');
                return;
            }
        }
    }
    
    // El estatus final depende de si está pagada o no
    const estatusFinal = saldo <= 0.01 ? 'PAGADA' : 'PENDIENTE';
    await guardarVenta(estatusFinal);
}

function irATab(tab) {
    document.querySelectorAll('.inner-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.inner-panel').forEach(p => p.classList.remove('active'));
    document.querySelector(`[data-inner="${tab}"]`).classList.add('active');
    document.getElementById(`inner-${tab}`).classList.add('active');
}

// ==================== CARGAR VENTA ====================

async function cargarVentaEnFormulario(ventaId) {
    try {
        const r = await API.request(`/ventas/detalle-completo/${ventaId}`);
        if (r.success) {
            ventaActual = r.venta;
            
            const v = ventaActual;
            document.getElementById('ventaId').value = v.venta_id;
            document.getElementById('ventaCliente').value = v.cliente_id || '';
            document.getElementById('ventaAlmacen').value = v.almacen_id || '';
            document.getElementById('ventaFecha').value = v.fecha_hora ? v.fecha_hora.split('T')[0] : '';
            document.getElementById('ventaTipo').value = v.tipo_venta || 'CONTADO';
            document.getElementById('ventaDescuentoGlobal').value = v.descuento || 0;
            document.getElementById('ventaVendedor').value = v.vendedor_id || '';
            document.getElementById('ventaNotas').value = v.notas || '';
            document.getElementById('ventaFolio').textContent = v.folio ? `${v.serie || 'V'}-${v.folio}` : '';
            
            onClienteChange();
            onTipoVentaChange();
            
            // Cargar líneas
            lineasVenta = (r.productos || []).filter(p => p.estatus === 'ACTIVO').map(p => ({
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
            
            lineasVenta.forEach((l, i) => {
                // Si no hay descuento_monto pero sí descuento_pct, calcularlo
                if (!l.descuento_monto && l.descuento_pct > 0) {
                    const subtotal = l.cantidad * l.precio;
                    l.descuento_monto = subtotal * l.descuento_pct / 100;
                }
                calcularImporteLinea(i);
            });
            
            // Cargar pagos
            pagosVenta = (r.pagos || []).filter(p => p.estatus === 'APLICADO').map(p => ({
                pago_id: p.pago_id,
                metodo_pago_id: p.metodo_pago_id,
                metodo_nombre: p.metodo_nombre || 'Pago',
                tipo: p.tipo || 'EFECTIVO',
                monto: parseFloat(p.monto),
                referencia: p.referencia,
                fecha: p.fecha_hora
            }));
            
            actualizarStatusBar(v.estatus);
            actualizarBotones(v.estatus);
            renderLineas();
            renderPagos();
            actualizarResumenPagos();
            actualizarBadgePagos();
            
            // Ir a formulario
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            document.querySelector('[data-tab="formulario"]').classList.add('active');
            document.getElementById('panel-formulario').classList.add('active');
        }
    } catch (e) {
        console.error(e);
        toast('Error al cargar venta', 'error');
    }
}

// ==================== AUTORIZACIÓN ====================

function solicitarAutorizacion(accion) {
    const mensajes = {
        'cancelar': 'Se requiere autorización para cancelar esta venta.',
        'reabrir': 'Se requiere autorización para reabrir esta venta.',
        'cancelar_producto': 'Se requiere autorización para cancelar este producto.'
    };
    
    document.getElementById('authMessage').textContent = mensajes[accion] || 'Esta acción requiere autorización.';
    document.getElementById('accionPendiente').value = accion;
    document.getElementById('claveAutorizacion').value = '';
    abrirModal('modalAutorizacion');
}

async function validarAutorizacion() {
    const clave = document.getElementById('claveAutorizacion').value;
    if (!clave) {
        toast('Ingrese la clave', 'error');
        return;
    }
    
    try {
        const r = await API.request('/auth/validar-admin', 'POST', {
            empresa_id: empresaId,
            password: clave
        });
        
        if (r.success) {
            cerrarModal('modalAutorizacion');
            const accion = document.getElementById('accionPendiente').value;
            await ejecutarAccion(accion, r.admin || 'Autorizado');
        } else {
            toast('Clave incorrecta', 'error');
        }
    } catch (e) {
        toast('Error de validación', 'error');
    }
}

async function ejecutarAccion(accion, autorizador) {
    if (accion === 'cancelar') {
        await cancelarVenta(autorizador);
    } else if (accion === 'reabrir') {
        await reabrirVenta(autorizador);
    } else if (accion === 'cancelar_producto') {
        await procesarCancelacionProducto(autorizador);
    } else if (accion === 'cambiar_pago') {
        await procesarCambioPago(autorizador);
    }
}

async function cancelarVenta(autorizador) {
    if (!ventaActual) return;
    
    try {
        const r = await API.request(`/ventas/cancelar-completa/${ventaActual.venta_id}`, 'POST', {
            motivo_cancelacion: 'Cancelación desde módulo de ventas',
            cancelado_por: usuarioId,
            autorizado_por: autorizador
        });
        
        if (r.success) {
            toast('Venta cancelada', 'success');
            nuevaVenta();
        } else {
            toast(r.error || 'Error al cancelar', 'error');
        }
    } catch (e) {
        toast('Error', 'error');
    }
}

async function reabrirVenta(autorizador) {
    if (!ventaActual) return;
    
    try {
        const r = await API.request(`/ventas/reabrir/${ventaActual.venta_id}`, 'POST', {
            usuario_id: usuarioId,
            autorizado_por: autorizador
        });
        
        if (r.success) {
            toast('Venta reabierta', 'success');
            cargarVentaEnFormulario(ventaActual.venta_id);
        } else {
            toast(r.error || 'Error', 'error');
        }
    } catch (e) {
        toast('Error', 'error');
    }
}

// ==================== CANCELAR PRODUCTO ====================

function abrirCancelarProducto(idx) {
    const linea = lineasVenta[idx];
    if (!linea || !linea.producto_id) return;
    
    document.getElementById('cancelarDetalleId').value = linea.detalle_id;
    document.getElementById('cancelarIdx').value = idx;
    document.getElementById('productoCancelarInfo').innerHTML = `
        <div class="cancel-product-name">${linea.nombre}</div>
        <div class="cancel-product-details">
            ${linea.cantidad} ${linea.unidad} × ${formatMoney(linea.precio)} = ${formatMoney(linea.importe)}
        </div>
    `;
    document.getElementById('cantidadCancelar').value = linea.cantidad;
    document.getElementById('cantidadCancelar').max = linea.cantidad;
    document.getElementById('motivoCancelacion').value = '';
    
    abrirModal('modalCancelarProducto');
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
    } catch (e) {
        toast('Error', 'error');
    }
}

// ==================== CAMBIAR PAGO ====================

function abrirCambiarPago(pagoId) {
    const pago = pagosVenta.find(p => p.pago_id === pagoId);
    if (!pago) return;
    
    document.getElementById('cambiarPagoId').value = pagoId;
    document.getElementById('pagoActualInfo').innerHTML = `
        <strong>${pago.metodo_nombre}</strong> - ${formatMoney(pago.monto)}
        ${pago.referencia ? `<br><small>Ref: ${pago.referencia}</small>` : ''}
    `;
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
    } catch (e) {
        toast('Error', 'error');
    }
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
        
        // Stats
        const activas = ventasData.filter(v => v.estatus !== 'CANCELADA');
        const total = activas.reduce((s, v) => s + parseFloat(v.total || 0), 0);
        const pagado = activas.reduce((s, v) => s + parseFloat(v.pagado || 0), 0);
        const pendiente = total - pagado;
        const canceladas = ventasData.filter(v => v.estatus === 'CANCELADA').length;
        
        document.getElementById('statVentas').textContent = activas.length;
        document.getElementById('statTotal').textContent = formatMoney(total);
        document.getElementById('statPendiente').textContent = formatMoney(pendiente);
        document.getElementById('statCanceladas').textContent = canceladas;
        
        renderListaVentas();
    } catch (e) {
        console.error(e);
        ventasData = [];
        renderListaVentas();
    }
}

function renderListaVentas() {
    const tbody = document.getElementById('tablaVentas');
    const empty = document.getElementById('emptyVentas');
    
    if (ventasData.length === 0) {
        tbody.innerHTML = '';
        empty.style.display = 'flex';
        document.getElementById('totalVentasLabel').textContent = '0 ventas';
        return;
    }
    
    empty.style.display = 'none';
    document.getElementById('totalVentasLabel').textContent = `${ventasData.length} ventas`;
    
    tbody.innerHTML = ventasData.map(v => {
        const saldo = Math.max(0, parseFloat(v.total || 0) - parseFloat(v.pagado || 0));
        return `
            <tr onclick="cargarVentaEnFormulario('${v.venta_id}')">
                <td><strong class="folio-link">${v.serie || 'V'}-${v.folio}</strong></td>
                <td>${v.cliente_nombre || 'Público General'}</td>
                <td>${formatFecha(v.fecha_hora)}</td>
                <td><span class="badge ${v.tipo_venta === 'CREDITO' ? 'badge-orange' : 'badge-blue'}">${v.tipo_venta}</span></td>
                <td class="text-right"><strong>${formatMoney(v.total)}</strong></td>
                <td class="text-right">${saldo > 0 ? `<span class="text-danger">${formatMoney(saldo)}</span>` : '<span class="text-success">$0.00</span>'}</td>
                <td class="text-center">${getBadgeEstatus(v.estatus)}</td>
                <td class="text-center">
                    <button class="btn-icon" onclick="event.stopPropagation(); cargarVentaEnFormulario('${v.venta_id}')" title="Ver">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function getBadgeEstatus(estatus) {
    const mapeo = {
        BORRADOR: { clase: 'badge-gray', texto: 'Borrador' },
        PENDIENTE: { clase: 'badge-orange', texto: 'Confirmada' },
        CONFIRMADA: { clase: 'badge-orange', texto: 'Confirmada' },
        PAGADA: { clase: 'badge-green', texto: 'Pagada' },
        CANCELADA: { clase: 'badge-red', texto: 'Cancelada' }
    };
    const e = mapeo[estatus] || { clase: 'badge-gray', texto: estatus };
    return `<span class="badge ${e.clase}">${e.texto}</span>`;
}

// ==================== DEVOLUCIONES ====================

async function cargarDevoluciones() {
    try {
        const desde = document.getElementById('filtroDevDesde').value;
        const hasta = document.getElementById('filtroDevHasta').value;
        
        const r = await API.request(`/reportes/devoluciones?empresa_id=${empresaId}&desde=${desde}&hasta=${hasta}`);
        devolucionesData = r.success ? (r.devoluciones || []) : [];
        
        renderDevoluciones();
    } catch (e) {
        console.error(e);
        devolucionesData = [];
        renderDevoluciones();
    }
}

function renderDevoluciones() {
    const tbody = document.getElementById('tablaDevoluciones');
    const empty = document.getElementById('emptyDevoluciones');
    
    if (devolucionesData.length === 0) {
        tbody.innerHTML = '';
        empty.style.display = 'flex';
        document.getElementById('totalDevolucionesLabel').textContent = '0 devoluciones';
        document.getElementById('sumaDevoluciones').textContent = 'Total: $0.00';
        return;
    }
    
    empty.style.display = 'none';
    
    const totalMonto = devolucionesData.reduce((s, d) => s + parseFloat(d.monto || 0), 0);
    document.getElementById('totalDevolucionesLabel').textContent = `${devolucionesData.length} devoluciones`;
    document.getElementById('sumaDevoluciones').textContent = `Total: ${formatMoney(totalMonto)}`;
    
    tbody.innerHTML = devolucionesData.map(d => `
        <tr>
            <td>${formatFecha(d.fecha)}</td>
            <td>${d.venta_folio || '-'}</td>
            <td>${d.cliente_nombre || '-'}</td>
            <td class="text-right"><strong class="text-danger">${formatMoney(d.monto)}</strong></td>
            <td>${d.metodo || '-'}</td>
            <td>${d.motivo || '-'}</td>
            <td>${d.usuario_nombre || '-'}</td>
        </tr>
    `).join('');
}

// ==================== CLIENTE ====================

async function guardarCliente() {
    const nombre = document.getElementById('cliNombre').value.trim();
    if (!nombre) {
        toast('Nombre requerido', 'error');
        return;
    }
    
    try {
        const r = await API.request('/clientes', 'POST', {
            empresa_id: empresaId,
            nombre,
            telefono: document.getElementById('cliTelefono').value,
            email: document.getElementById('cliEmail').value,
            rfc: document.getElementById('cliRFC').value,
            tipo_precio: document.getElementById('cliTipoPrecio').value,
            permite_credito: document.getElementById('cliPermiteCredito').value,
            limite_credito: parseFloat(document.getElementById('cliLimiteCredito').value) || 0,
            direccion: document.getElementById('cliDireccion').value,
            activo: 'Y'
        });
        
        if (r.success) {
            toast('Cliente creado', 'success');
            cerrarModal('modalCliente');
            
            // Limpiar formulario
            ['cliNombre', 'cliTelefono', 'cliEmail', 'cliRFC', 'cliDireccion'].forEach(id => document.getElementById(id).value = '');
            document.getElementById('cliTipoPrecio').value = '1';
            document.getElementById('cliPermiteCredito').value = 'N';
            document.getElementById('cliLimiteCredito').value = '0';
            
            await cargarClientes();
            document.getElementById('ventaCliente').value = r.cliente_id;
            onClienteChange();
        } else {
            toast(r.error || 'Error', 'error');
        }
    } catch (e) {
        toast('Error', 'error');
    }
}

// ==================== PDF ====================

function generarPDF() {
    if (!ventaActual) return;
    
    const v = ventaActual;
    const cliente = clientesData.find(c => c.cliente_id === v.cliente_id);
    const lineasValidas = lineasVenta.filter(l => l.producto_id);
    
    const html = `
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
        .section { margin-bottom: 20px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .info-box { background: #f9f9f9; padding: 15px; border-radius: 6px; }
        .info-label { font-size: 10px; color: #888; text-transform: uppercase; }
        .info-value { font-size: 13px; font-weight: 500; margin-top: 2px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background: #2D3DBF; color: #fff; padding: 10px 12px; text-align: left; font-size: 11px; }
        td { padding: 10px 12px; border-bottom: 1px solid #eee; }
        .text-right { text-align: right; }
        .totals { margin-top: 20px; display: flex; justify-content: flex-end; }
        .totals-box { width: 280px; }
        .total-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
        .total-row.final { border-top: 2px solid #2D3DBF; margin-top: 8px; padding-top: 12px; font-size: 16px; font-weight: bold; }
        .footer { margin-top: 40px; text-align: center; color: #888; font-size: 10px; }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">CAFI POS</div>
        <div class="doc-info">
            <div class="doc-title">NOTA DE VENTA</div>
            <div>${v.serie || 'V'}-${v.folio}</div>
            <div>${formatFecha(v.fecha_hora)}</div>
        </div>
    </div>
    <div class="section">
        <div class="info-grid">
            <div class="info-box">
                <div class="info-label">Cliente</div>
                <div class="info-value">${cliente?.nombre || 'Público General'}</div>
                ${cliente?.telefono ? `<div style="font-size:11px;color:#666">${cliente.telefono}</div>` : ''}
            </div>
            <div class="info-box">
                <div class="info-label">Tipo de Venta</div>
                <div class="info-value">${v.tipo_venta}</div>
            </div>
        </div>
    </div>
    <table>
        <thead>
            <tr>
                <th style="width:45%">Producto</th>
                <th class="text-right">Cant.</th>
                <th class="text-right">Precio</th>
                <th class="text-right">Desc.</th>
                <th class="text-right">Importe</th>
            </tr>
        </thead>
        <tbody>
            ${lineasValidas.map(l => `
                <tr>
                    <td>${l.nombre}<br><small style="color:#888">${l.codigo}</small></td>
                    <td class="text-right">${l.cantidad} ${l.unidad}</td>
                    <td class="text-right">${formatMoney(l.precio)}</td>
                    <td class="text-right">${l.descuento_pct > 0 ? l.descuento_pct + '%' : '-'}</td>
                    <td class="text-right"><strong>${formatMoney(l.importe)}</strong></td>
                </tr>
            `).join('')}
        </tbody>
    </table>
    <div class="totals">
        <div class="totals-box">
            <div class="total-row"><span>Subtotal:</span><span>${formatMoney(v.subtotal)}</span></div>
            <div class="total-row"><span>Descuento:</span><span>-${formatMoney(v.descuento || 0)}</span></div>
            <div class="total-row final"><span>TOTAL:</span><span>${formatMoney(v.total)}</span></div>
        </div>
    </div>
    <div class="footer">
        <p>¡Gracias por su compra!</p>
        <p>Generado por CAFI POS - ${new Date().toLocaleString('es-MX')}</p>
    </div>
</body>
</html>`;
    
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.onload = () => win.print();
}

// ==================== EXPORTAR ====================

function exportarVentas() {
    if (ventasData.length === 0) {
        toast('No hay datos para exportar', 'error');
        return;
    }
    
    let csv = 'Folio,Cliente,Fecha,Tipo,Total,Pagado,Saldo,Estatus\n';
    ventasData.forEach(v => {
        const saldo = Math.max(0, parseFloat(v.total) - parseFloat(v.pagado || 0));
        csv += `${v.serie || 'V'}-${v.folio},"${(v.cliente_nombre || 'Público General').replace(/"/g, '""')}",${v.fecha_hora?.split('T')[0]},${v.tipo_venta},${v.total},${v.pagado || 0},${saldo},${v.estatus}\n`;
    });
    
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ventas_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
}

// ==================== UTILS ====================

function abrirModal(id) {
    document.getElementById(id)?.classList.add('show');
}

function cerrarModal(id) {
    document.getElementById(id)?.classList.remove('show');
}

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
