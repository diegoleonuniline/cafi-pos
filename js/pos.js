// ==================== POS.JS ====================
if (!API.isLoggedIn()) window.location.href = '../index.html';

var productos = [];
var categorias = [];
var clientes = [];
var carrito = [];
var clienteSeleccionado = null;
var tipoVenta = 'CONTADO';
var tipoPrecio = 1;
var descuentoGlobal = 0;
var UNIDADES_GRANEL = ['KG', 'GR', 'LT', 'ML', 'MT'];

document.addEventListener('DOMContentLoaded', function() {
    cargarUsuario();
    cargarDatos();
    setupEventos();
    setupKeyboard();
});

function cargarUsuario() {
    var u = API.usuario;
    document.getElementById('userName').textContent = u.nombre || 'Usuario';
    document.getElementById('userSucursal').textContent = u.sucursal_nombre || 'Sucursal';
    var iniciales = (u.nombre || 'U').split(' ').map(function(n) { return n.charAt(0); }).join('').substring(0, 2);
    document.getElementById('userAvatar').textContent = iniciales.toUpperCase();
}

function cargarDatos() {
    API.request('/pos/cargar/' + API.usuario.empresa_id + '/' + API.usuario.sucursal_id)
        .then(function(r) {
            if (r.success) {
                productos = r.productos || [];
                categorias = r.categorias || [];
                clientes = r.clientes || [];
                renderCategoriasSelect();
                console.log('Datos cargados:', productos.length, 'productos');
            }
        })
        .catch(function(e) { console.error(e); mostrarToast('Error cargando datos', 'error'); });
}

function renderCategoriasSelect() {
    var sel = document.getElementById('filtroCategoria');
    if (!sel) return;
    sel.innerHTML = '<option value="">Todas</option>';
    categorias.forEach(function(c) {
        if (c.activo !== 'N') sel.innerHTML += '<option value="' + c.categoria_id + '">' + c.nombre + '</option>';
    });
}

function setupEventos() {
    document.querySelectorAll('.metodo-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.metodo-btn').forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
        });
    });
}

function setupKeyboard() {
    document.addEventListener('keydown', function(e) {
        if (e.key === 'F2') { e.preventDefault(); abrirModalProductos(); }
        if (e.key === 'F4') { e.preventDefault(); cancelarVenta(); }
        if (e.key === 'F12') { e.preventDefault(); if (carrito.length > 0) abrirModalCobro(); }
        if (e.key === 'Escape') { cerrarTodosModales(); }
    });
}

function onBuscarKeypress(e) {
    if (e.key === 'Enter') {
        var codigo = e.target.value.trim();
        if (codigo) {
            var prod = productos.find(function(p) { return p.codigo_barras === codigo || p.codigo_interno === codigo; });
            if (prod) { verificarYAgregar(prod); e.target.value = ''; }
            else { mostrarToast('Producto no encontrado', 'error'); }
        }
    }
}

// ========== TIPO VENTA ==========
function setTipoVenta(tipo) {
    tipoVenta = tipo;
    document.getElementById('btnContado').classList.toggle('active', tipo === 'CONTADO');
    document.getElementById('btnCredito').classList.toggle('active', tipo === 'CREDITO');
    document.getElementById('tipoVentaLabel').textContent = tipo === 'CONTADO' ? 'Contado' : 'Crédito';
}

function cambiarTipoPrecio() {
    tipoPrecio = parseInt(document.getElementById('selectPrecio').value);
    carrito.forEach(function(item) {
        var prod = productos.find(function(p) { return p.producto_id === item.producto_id; });
        if (prod) item.precio = parseFloat(prod['precio' + tipoPrecio] || prod.precio1) || 0;
    });
    renderCarrito();
}

// ========== MODAL PRODUCTOS ==========
function abrirModalProductos() {
    document.getElementById('modalProductos').classList.add('active');
    document.getElementById('filtroNombre').value = '';
    document.getElementById('filtroCantidad').value = '1';
    filtrarProductos();
    setTimeout(function() { document.getElementById('filtroNombre').focus(); }, 100);
}

function filtrarProductos() {
    var nombre = (document.getElementById('filtroNombre').value || '').toLowerCase();
    var categoria = document.getElementById('filtroCategoria').value;
    var precioTipo = document.getElementById('filtroPrecio').value;
    
    var filtrados = productos.filter(function(p) {
        var matchNombre = !nombre || p.nombre.toLowerCase().indexOf(nombre) >= 0 ||
            (p.codigo_barras && p.codigo_barras.indexOf(nombre) >= 0);
        var matchCategoria = !categoria || p.categoria_id === categoria;
        return matchNombre && matchCategoria && p.activo !== 'N';
    });
    renderProductosModal(filtrados, precioTipo);
}

function renderProductosModal(items, precioTipo) {
    var tbody = document.getElementById('productosBody');
    if (!items.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:#9ca3af">No hay productos</td></tr>';
        return;
    }
    var html = '';
    items.forEach(function(p) {
        var precio = parseFloat(p['precio' + precioTipo] || p.precio1) || 0;
        var unidad = p.unidad_venta || 'PZ';
        var desc = p.descuento || 0;
        html += '<tr onclick="seleccionarProducto(\'' + p.producto_id + '\')">' +
            '<td><img class="producto-img" src="' + (p.imagen_url || 'https://via.placeholder.com/48?text=P') + '" onerror="this.src=\'https://via.placeholder.com/48?text=P\'"></td>' +
            '<td class="producto-codigo">' + (p.codigo_barras || p.codigo_interno || '-') + '</td>' +
            '<td class="producto-nombre">' + p.nombre + '</td>' +
            '<td><span class="badge-unidad">' + unidad + '</span></td>' +
            '<td>' + (desc > 0 ? '<span class="badge-descuento"><i class="fas fa-tag"></i> ' + desc + '%</span>' : '-') + '</td>' +
            '<td class="producto-precio">$' + precio.toFixed(2) + '</td>' +
        '</tr>';
    });
    tbody.innerHTML = html;
}

function ajustarCantidadFiltro(d) {
    var inp = document.getElementById('filtroCantidad');
    inp.value = Math.max(0.001, (parseFloat(inp.value) || 1) + d);
}

function seleccionarProducto(id) {
    var prod = productos.find(function(p) { return p.producto_id === id; });
    if (!prod) return;
    var cantidad = parseFloat(document.getElementById('filtroCantidad').value) || 1;
    var unidad = (prod.unidad_venta || 'PZ').toUpperCase();
    if (UNIDADES_GRANEL.indexOf(unidad) >= 0 && cantidad === 1) {
        cerrarModal('modalProductos');
        abrirModalCantidad(prod);
    } else {
        agregarAlCarrito(prod, cantidad);
        cerrarModal('modalProductos');
    }
}

function verificarYAgregar(prod) {
    var unidad = (prod.unidad_venta || 'PZ').toUpperCase();
    if (UNIDADES_GRANEL.indexOf(unidad) >= 0) abrirModalCantidad(prod);
    else agregarAlCarrito(prod, 1);
}

// ========== MODAL CANTIDAD ==========
var productoParaCantidad = null;
function abrirModalCantidad(prod) {
    productoParaCantidad = prod;
    var unidad = (prod.unidad_venta || 'KG').toUpperCase();
    var precio = parseFloat(prod['precio' + tipoPrecio] || prod.precio1) || 0;
    document.getElementById('cantidadTitulo').textContent = 'Cantidad en ' + unidad;
    document.getElementById('cantidadNombre').textContent = prod.nombre;
    document.getElementById('cantidadPrecioUnit').textContent = '$' + precio.toFixed(2) + ' / ' + unidad;
    document.getElementById('cantidadUnidad').textContent = unidad;
    document.getElementById('inputCantidadModal').value = '1';
    calcularSubtotalModal();
    document.getElementById('modalCantidad').classList.add('active');
}

function ajustarCantidadModal(d) {
    var inp = document.getElementById('inputCantidadModal');
    inp.value = Math.max(0.001, (parseFloat(inp.value) || 0) + d).toFixed(3);
    calcularSubtotalModal();
}

function calcularSubtotalModal() {
    if (!productoParaCantidad) return;
    var cant = parseFloat(document.getElementById('inputCantidadModal').value) || 0;
    var precio = parseFloat(productoParaCantidad['precio' + tipoPrecio] || productoParaCantidad.precio1) || 0;
    document.getElementById('subtotalModal').textContent = '$' + (cant * precio).toFixed(2);
}

function confirmarCantidad() {
    if (!productoParaCantidad) return;
    var cant = parseFloat(document.getElementById('inputCantidadModal').value) || 0;
    if (cant <= 0) { mostrarToast('Cantidad inválida', 'error'); return; }
    agregarAlCarrito(productoParaCantidad, cant);
    cerrarModal('modalCantidad');
    productoParaCantidad = null;
}

// ========== MODAL CLIENTE ==========
function abrirModalCliente() {
    document.getElementById('modalCliente').classList.add('active');
    document.getElementById('buscarCliente').value = '';
    filtrarClientes();
}

function filtrarClientes() {
    var busq = (document.getElementById('buscarCliente').value || '').toLowerCase();
    var filtrados = clientes.filter(function(c) {
        return !busq || c.nombre.toLowerCase().indexOf(busq) >= 0 ||
            (c.telefono && c.telefono.indexOf(busq) >= 0);
    });
    renderClientesLista(filtrados);
}

function renderClientesLista(items) {
    var cont = document.getElementById('clientesList');
    if (!items.length) { cont.innerHTML = '<p style="text-align:center;padding:40px;color:#9ca3af">No hay clientes</p>'; return; }
    var html = '';
    items.forEach(function(c) {
        html += '<div class="cliente-item" onclick="seleccionarCliente(\'' + c.cliente_id + '\')">' +
            '<div class="cliente-item-avatar">' + c.nombre.charAt(0).toUpperCase() + '</div>' +
            '<div class="cliente-item-info"><div class="cliente-item-name">' + c.nombre + '</div><div class="cliente-item-detail">' + (c.telefono || c.email || '-') + '</div></div>' +
            '<span class="cliente-item-badge">P' + (c.tipo_precio || 1) + '</span></div>';
    });
    cont.innerHTML = html;
}

function seleccionarCliente(id) {
    if (id) {
        clienteSeleccionado = clientes.find(function(c) { return c.cliente_id === id; });
        if (clienteSeleccionado) {
            document.getElementById('clienteNombre').textContent = clienteSeleccionado.nombre;
            document.getElementById('clientePanel').textContent = clienteSeleccionado.nombre;
            tipoPrecio = parseInt(clienteSeleccionado.tipo_precio) || 1;
            document.getElementById('selectPrecio').value = tipoPrecio;
            cambiarTipoPrecio();
        }
    } else {
        clienteSeleccionado = null;
        document.getElementById('clienteNombre').textContent = 'Público General';
        document.getElementById('clientePanel').textContent = 'Público General';
    }
    cerrarModal('modalCliente');
}

// ========== MODAL NUEVO PRODUCTO RAPIDO ==========
function abrirModalNuevoProducto() {
    document.getElementById('modalNuevoProducto').classList.add('active');
    document.getElementById('formNuevoProducto').reset();
}

function guardarNuevoProducto(e) {
    e.preventDefault();
    var data = {
        empresa_id: API.usuario.empresa_id,
        sucursal_id: API.usuario.sucursal_id,
        codigo_barras: document.getElementById('np_codigo').value,
        nombre: document.getElementById('np_nombre').value,
        precio1: parseFloat(document.getElementById('np_precio').value) || 0,
        unidad_venta: document.getElementById('np_unidad').value,
        activo: 'Y'
    };
    API.request('/productos', 'POST', data).then(function(r) {
        if (r.success) {
            mostrarToast('Producto creado', 'success');
            cerrarModal('modalNuevoProducto');
            cargarDatos();
        } else { mostrarToast('Error: ' + (r.error || 'No se pudo guardar'), 'error'); }
    });
}

// ========== MODAL NUEVO CLIENTE RAPIDO ==========
function abrirModalNuevoCliente() {
    document.getElementById('modalNuevoCliente').classList.add('active');
    document.getElementById('formNuevoCliente').reset();
}

function guardarNuevoCliente(e) {
    e.preventDefault();
    var data = {
        empresa_id: API.usuario.empresa_id,
        nombre: document.getElementById('nc_nombre').value,
        telefono: document.getElementById('nc_telefono').value,
        tipo_precio: document.getElementById('nc_tipo_precio').value,
        activo: 'Y'
    };
    API.request('/clientes', 'POST', data).then(function(r) {
        if (r.success) {
            mostrarToast('Cliente creado', 'success');
            cerrarModal('modalNuevoCliente');
            cargarDatos();
        } else { mostrarToast('Error: ' + (r.error || 'No se pudo guardar'), 'error'); }
    });
}

// ========== CARRITO ==========
function agregarAlCarrito(prod, cantidad) {
    var precio = parseFloat(prod['precio' + tipoPrecio] || prod.precio1) || 0;
    var unidad = prod.unidad_venta || 'PZ';
    var esGranel = UNIDADES_GRANEL.indexOf(unidad.toUpperCase()) >= 0;
    var descProd = parseFloat(prod.descuento) || 0;

    var existe = carrito.find(function(i) { return i.producto_id === prod.producto_id; });
    if (existe && !esGranel) {
        existe.cantidad += cantidad;
    } else {
        carrito.push({
            producto_id: prod.producto_id,
            codigo: prod.codigo_barras || prod.codigo_interno || '',
            nombre: prod.nombre,
            precio: precio,
            cantidad: cantidad,
            unidad: unidad,
            esGranel: esGranel,
            descuento: descProd
        });
    }
    renderCarrito();
    mostrarToast(prod.nombre + ' agregado');
}

function cambiarCantidad(id, d) {
    var item = carrito.find(function(i) { return i.producto_id === id; });
    if (!item) return;
    item.cantidad += d;
    if (item.cantidad <= 0) carrito = carrito.filter(function(i) { return i.producto_id !== id; });
    renderCarrito();
}

function eliminarDelCarrito(id) {
    carrito = carrito.filter(function(i) { return i.producto_id !== id; });
    renderCarrito();
}

function aplicarDescuentoLinea(id) {
    var item = carrito.find(function(i) { return i.producto_id === id; });
    if (!item) return;
    var desc = prompt('Descuento % para ' + item.nombre + ':', item.descuento || 0);
    if (desc !== null) {
        item.descuento = Math.min(100, Math.max(0, parseFloat(desc) || 0));
        renderCarrito();
    }
}

function renderCarrito() {
    var tbody = document.getElementById('cartBody');
    var empty = document.getElementById('cartEmpty');
    
    if (!carrito.length) {
        tbody.innerHTML = '';
        empty.style.display = 'flex';
        actualizarTotales();
        return;
    }
    empty.style.display = 'none';
    
    var html = '';
    carrito.forEach(function(item) {
        var subtotal = item.precio * item.cantidad;
        var descMonto = subtotal * (item.descuento || 0) / 100;
        var total = subtotal - descMonto;
        
        var cantHtml = item.esGranel ?
            '<button class="qty-granel" onclick="editarCantidadGranel(\'' + item.producto_id + '\')">' + item.cantidad.toFixed(3) + '</button>' :
            '<div class="qty-control"><button onclick="cambiarCantidad(\'' + item.producto_id + '\',-1)">−</button><span>' + item.cantidad + '</span><button onclick="cambiarCantidad(\'' + item.producto_id + '\',1)">+</button></div>';
        
        html += '<tr>' +
            '<td><div class="cart-item-name">' + item.nombre + '</div><div class="cart-item-code">' + item.codigo + '</div></td>' +
            '<td class="cart-item-price">$' + item.precio.toFixed(2) + '</td>' +
            '<td class="cart-item-qty">' + cantHtml + '</td>' +
            '<td class="cart-item-unit"><span class="badge' + (item.esGranel ? ' granel' : '') + '">' + item.unidad + '</span></td>' +
            '<td class="cart-item-desc"><button class="btn-desc" onclick="aplicarDescuentoLinea(\'' + item.producto_id + '\')">' + (item.descuento > 0 ? item.descuento + '%' : '-') + '</button></td>' +
            '<td class="cart-item-total">$' + total.toFixed(2) + '</td>' +
            '<td><button class="btn-delete" onclick="eliminarDelCarrito(\'' + item.producto_id + '\')"><i class="fas fa-trash"></i></button></td>' +
        '</tr>';
    });
    tbody.innerHTML = html;
    actualizarTotales();
}

function editarCantidadGranel(id) {
    var item = carrito.find(function(i) { return i.producto_id === id; });
    var prod = productos.find(function(p) { return p.producto_id === id; });
    if (prod && item) {
        abrirModalCantidad(prod);
        document.getElementById('inputCantidadModal').value = item.cantidad;
        calcularSubtotalModal();
    }
}

function actualizarTotales() {
    var articulos = 0, subtotal = 0, descuentos = 0;
    carrito.forEach(function(item) {
        articulos += item.cantidad;
        var sub = item.precio * item.cantidad;
        var desc = sub * (item.descuento || 0) / 100;
        subtotal += sub;
        descuentos += desc;
    });
    var descGlobal = (subtotal - descuentos) * descuentoGlobal / 100;
    var total = subtotal - descuentos - descGlobal;
    
    document.getElementById('totalArticulos').textContent = articulos.toFixed(2);
    document.getElementById('subtotalVenta').textContent = '$' + subtotal.toFixed(2);
    document.getElementById('descuentosVenta').textContent = '-$' + (descuentos + descGlobal).toFixed(2);
    document.getElementById('totalAmount').textContent = '$' + total.toFixed(2);
}

function aplicarDescuentoGlobal() {
    var desc = prompt('Descuento % sobre el total:', descuentoGlobal);
    if (desc !== null) {
        descuentoGlobal = Math.min(100, Math.max(0, parseFloat(desc) || 0));
        renderCarrito();
        mostrarToast('Descuento global: ' + descuentoGlobal + '%');
    }
}

function cancelarVenta() {
    if (!carrito.length) return;
    if (confirm('¿Cancelar venta?')) {
        carrito = [];
        descuentoGlobal = 0;
        renderCarrito();
        mostrarToast('Venta cancelada');
    }
}

// ========== COBRO ==========
function abrirModalCobro() {
    if (!carrito.length) return;
    var total = calcularTotalFinal();
    document.getElementById('cobroTotal').textContent = '$' + total.toFixed(2);
    document.getElementById('cobroBadge').textContent = tipoVenta;
    document.getElementById('inputEfectivo').value = '';
    document.getElementById('cobroCambio').textContent = '$0.00';
    document.getElementById('modalCobro').classList.add('active');
    setTimeout(function() { document.getElementById('inputEfectivo').focus(); }, 100);
}

function calcularTotalFinal() {
    var subtotal = 0, descuentos = 0;
    carrito.forEach(function(item) {
        var sub = item.precio * item.cantidad;
        descuentos += sub * (item.descuento || 0) / 100;
        subtotal += sub;
    });
    var descGlobal = (subtotal - descuentos) * descuentoGlobal / 100;
    return subtotal - descuentos - descGlobal;
}

function addEfectivo(m) {
    var inp = document.getElementById('inputEfectivo');
    inp.value = (parseFloat(inp.value) || 0) + m;
    calcularCambio();
}

function setExacto() {
    document.getElementById('inputEfectivo').value = calcularTotalFinal().toFixed(2);
    calcularCambio();
}

function limpiarEfectivo() {
    document.getElementById('inputEfectivo').value = '';
    calcularCambio();
}

function calcularCambio() {
    var total = calcularTotalFinal();
    var efectivo = parseFloat(document.getElementById('inputEfectivo').value) || 0;
    document.getElementById('cobroCambio').textContent = '$' + Math.max(0, efectivo - total).toFixed(2);
}

function confirmarVenta() {
    var total = calcularTotalFinal();
    var efectivo = parseFloat(document.getElementById('inputEfectivo').value) || 0;
    
    if (efectivo < total && tipoVenta === 'CONTADO') {
        mostrarToast('Monto insuficiente', 'error');
        return;
    }
    
    var metodoActivo = document.querySelector('.metodo-btn.active');
    var metodo = metodoActivo ? metodoActivo.getAttribute('data-metodo') : 'efectivo';
    
    var venta = {
        empresa_id: API.usuario.empresa_id,
        sucursal_id: API.usuario.sucursal_id,
        almacen_id: API.usuario.almacen_id || null,
        usuario_id: API.usuario.id || API.usuario.usuario_id,
        cliente_id: clienteSeleccionado ? clienteSeleccionado.cliente_id : null,
        tipo: 'VENTA',
        tipo_venta: tipoVenta,
        tipo_precio: tipoPrecio,
        subtotal: carrito.reduce(function(s, i) { return s + i.precio * i.cantidad; }, 0),
        descuento: descuentoGlobal,
        total: total,
        pagado: efectivo,
        cambio: Math.max(0, efectivo - total),
        pagos: [{
            metodo: metodo,
            monto: Math.min(efectivo, total)
        }],
        items: carrito.map(function(item) {
            var sub = item.precio * item.cantidad;
            var desc = sub * (item.descuento || 0) / 100;
            return {
                producto_id: item.producto_id,
                descripcion: item.nombre,
                cantidad: item.cantidad,
                unidad_id: item.unidad,
                precio_unitario: item.precio,
                descuento: item.descuento || 0,
                subtotal: sub - desc
            };
        })
    };

    API.request('/ventas', 'POST', venta).then(function(r) {
        if (r.success) {
            cerrarModal('modalCobro');
            mostrarExito(r.folio || r.venta_id, total, efectivo - total);
        } else {
            mostrarToast('Error: ' + (r.error || 'No se pudo guardar'), 'error');
        }
    }).catch(function(e) {
        console.error(e);
        mostrarToast('Error de conexión', 'error');
    });
}

function mostrarExito(folio, total, cambio) {
    document.getElementById('exitoFolio').textContent = '#' + folio;
    document.getElementById('exitoTotal').textContent = '$' + total.toFixed(2);
    document.getElementById('exitoCambio').textContent = '$' + Math.max(0, cambio).toFixed(2);
    document.getElementById('modalExito').classList.add('active');
}

function imprimirTicket() { mostrarToast('Imprimiendo...'); }

function nuevaVenta() {
    carrito = [];
    clienteSeleccionado = null;
    tipoVenta = 'CONTADO';
    descuentoGlobal = 0;
    document.getElementById('clienteNombre').textContent = 'Público General';
    document.getElementById('clientePanel').textContent = 'Público General';
    document.getElementById('btnContado').classList.add('active');
    document.getElementById('btnCredito').classList.remove('active');
    document.getElementById('inputBuscar').value = '';
    renderCarrito();
    cerrarModal('modalExito');
}

// ========== UTILS ==========
function cerrarModal(id) { document.getElementById(id).classList.remove('active'); }
function cerrarTodosModales() { document.querySelectorAll('.modal-overlay.active').forEach(function(m) { m.classList.remove('active'); }); }

function mostrarToast(msg, tipo) {
    var toast = document.getElementById('toast');
    toast.innerHTML = '<i class="fas fa-' + (tipo === 'error' ? 'exclamation-circle' : 'check-circle') + '"></i> ' + msg;
    toast.className = 'toast show ' + (tipo || 'success');
    setTimeout(function() { toast.classList.remove('show'); }, 3000);
}
