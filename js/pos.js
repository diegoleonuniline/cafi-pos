// ==================== POS.JS ====================
if (!API.isLoggedIn()) window.location.href = '../index.html';

var productos = [];
var categorias = [];
var clientes = [];
var metodosPago = [];
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
    focusBuscar();
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
                metodosPago = r.metodos || [];
                renderCategoriasSelect();
                renderMetodosPago();
                console.log('Datos cargados:', productos.length, 'productos,', metodosPago.length, 'métodos de pago');
            }
        })
        .catch(function(e) { 
            console.error(e); 
            mostrarToast('Error cargando datos', 'error'); 
        });
}

// ========== FOCUS SIEMPRE AL BUSCADOR ==========
function focusBuscar() {
    setTimeout(function() {
        var input = document.getElementById('inputBuscar');
        if (input && !document.querySelector('.modal-overlay.active')) {
            input.focus();
        }
    }, 100);
}

function renderCategoriasSelect() {
    var sel = document.getElementById('filtroCategoria');
    if (!sel) return;
    sel.innerHTML = '<option value="">Todas</option>';
    categorias.forEach(function(c) {
        if (c.activo !== 'N') {
            sel.innerHTML += '<option value="' + c.categoria_id + '">' + c.nombre + '</option>';
        }
    });
}

function renderMetodosPago() {
    var cont = document.getElementById('metodosPagoContainer');
    if (!cont) return;
    
    if (!metodosPago.length) {
        cont.innerHTML = '<button type="button" class="metodo-btn active" data-metodo-id="EFECTIVO" data-metodo="EFECTIVO"><i class="fas fa-money-bill"></i> Efectivo</button>';
        return;
    }
    
    var html = '';
    metodosPago.forEach(function(m, i) {
        var icono = 'fa-money-bill';
        var nombre = (m.nombre || '').toLowerCase();
        var tipo = (m.tipo || '').toUpperCase();
        
        if (tipo === 'TARJETA' || nombre.indexOf('tarjeta') >= 0) icono = 'fa-credit-card';
        else if (tipo === 'TRANSFERENCIA' || nombre.indexOf('transfer') >= 0) icono = 'fa-exchange-alt';
        
        html += '<button type="button" class="metodo-btn' + (i === 0 ? ' active' : '') + '" ' +
            'data-metodo-id="' + m.metodo_pago_id + '" data-metodo="' + (m.tipo || m.nombre) + '">' +
            '<i class="fas ' + icono + '"></i> ' + m.nombre +
        '</button>';
    });
    cont.innerHTML = html;
    
    document.querySelectorAll('.metodo-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.metodo-btn').forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
        });
    });
}

function setupEventos() {
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.modal') && !e.target.closest('input') && !e.target.closest('button')) {
            focusBuscar();
        }
    });
}

function setupKeyboard() {
    document.addEventListener('keydown', function(e) {
        if (e.key === 'F2') { e.preventDefault(); abrirModalProductos(); }
        if (e.key === 'F4') { e.preventDefault(); cancelarVenta(); }
        if (e.key === 'F12') { e.preventDefault(); if (carrito.length > 0) abrirModalCobro(); }
        if (e.key === 'Escape') { cerrarTodosModales(); focusBuscar(); }
    });
}

function onBuscarKeypress(e) {
    if (e.key === 'Enter') {
        var codigo = e.target.value.trim();
        if (codigo) {
            var prod = productos.find(function(p) { 
                return p.codigo_barras === codigo || p.codigo_interno === codigo; 
            });
            if (prod) { 
                verificarYAgregar(prod); 
                e.target.value = ''; 
            } else { 
                mostrarToast('Producto no encontrado', 'error'); 
            }
        }
        focusBuscar();
    }
}

// ========== OBTENER PRECIO CON IMPUESTOS ==========
function getPrecioConImpuestos(prod, numPrecio) {
    numPrecio = numPrecio || tipoPrecio;
    
    if (numPrecio === 1 && prod.precio_venta) return parseFloat(prod.precio_venta) || 0;
    if (numPrecio === 2 && prod.precio_venta2) return parseFloat(prod.precio_venta2) || 0;
    if (numPrecio === 3 && prod.precio_venta3) return parseFloat(prod.precio_venta3) || 0;
    if (numPrecio === 4 && prod.precio_venta4) return parseFloat(prod.precio_venta4) || 0;
    
    return parseFloat(prod['precio' + numPrecio] || prod.precio1) || 0;
}

// ========== TIPO VENTA ==========
function setTipoVenta(tipo) {
    tipoVenta = tipo;
    document.getElementById('btnContado').classList.toggle('active', tipo === 'CONTADO');
    document.getElementById('btnCredito').classList.toggle('active', tipo === 'CREDITO');
    document.getElementById('tipoVentaLabel').textContent = tipo === 'CONTADO' ? 'Contado' : 'Crédito';
    focusBuscar();
}

function cambiarTipoPrecio() {
    tipoPrecio = parseInt(document.getElementById('selectPrecio').value);
    carrito.forEach(function(item) {
        var prod = productos.find(function(p) { return p.producto_id === item.producto_id; });
        if (prod) item.precio = getPrecioConImpuestos(prod, tipoPrecio);
    });
    renderCarrito();
    focusBuscar();
}

// ========== MODAL PRODUCTOS ==========
function abrirModalProductos() {
    document.getElementById('modalProductos').classList.add('active');
    document.getElementById('filtroNombre').value = '';
    document.getElementById('filtroCantidad').value = '1';
    document.getElementById('filtroPrecio').value = tipoPrecio;
    filtrarProductos();
    setTimeout(function() { document.getElementById('filtroNombre').focus(); }, 100);
}

function filtrarProductos() {
    var nombre = (document.getElementById('filtroNombre').value || '').toLowerCase();
    var categoria = document.getElementById('filtroCategoria').value;
    var precioTipo = parseInt(document.getElementById('filtroPrecio').value) || 1;
    
    var filtrados = productos.filter(function(p) {
        var matchNombre = !nombre || 
            p.nombre.toLowerCase().indexOf(nombre) >= 0 ||
            (p.codigo_barras && p.codigo_barras.indexOf(nombre) >= 0) ||
            (p.codigo_interno && p.codigo_interno.toLowerCase().indexOf(nombre) >= 0);
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
        var precio = getPrecioConImpuestos(p, precioTipo);
        var unidad = p.unidad_venta || 'PZ';
        var esGranel = UNIDADES_GRANEL.indexOf(unidad.toUpperCase()) >= 0;
        
        html += '<tr onclick="seleccionarProducto(\'' + p.producto_id + '\')">' +
            '<td><img class="producto-img" src="' + (p.imagen_url || 'https://via.placeholder.com/48?text=P') + '" onerror="this.src=\'https://via.placeholder.com/48?text=P\'"></td>' +
            '<td class="producto-codigo">' + (p.codigo_barras || p.codigo_interno || '-') + '</td>' +
            '<td class="producto-nombre">' + p.nombre + (esGranel ? ' <small style="color:#10b981">(Granel)</small>' : '') + '</td>' +
            '<td><span class="badge-unidad">' + unidad + '</span></td>' +
            '<td>' + (p.descuento > 0 ? '<span class="badge-descuento"><i class="fas fa-tag"></i> ' + p.descuento + '%</span>' : '-') + '</td>' +
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
    
    if (UNIDADES_GRANEL.indexOf(unidad) >= 0) {
        cerrarModal('modalProductos');
        abrirModalCantidad(prod);
    } else {
        agregarAlCarrito(prod, cantidad);
        cerrarModal('modalProductos');
        focusBuscar();
    }
}

function verificarYAgregar(prod) {
    var unidad = (prod.unidad_venta || 'PZ').toUpperCase();
    if (UNIDADES_GRANEL.indexOf(unidad) >= 0) {
        abrirModalCantidad(prod);
    } else {
        agregarAlCarrito(prod, 1);
        focusBuscar();
    }
}

// ========== MODAL CANTIDAD (GRANEL) ==========
var productoParaCantidad = null;

function abrirModalCantidad(prod) {
    productoParaCantidad = prod;
    var unidad = (prod.unidad_venta || 'KG').toUpperCase();
    var precio = getPrecioConImpuestos(prod, tipoPrecio);
    
    document.getElementById('cantidadTitulo').textContent = 'Cantidad en ' + unidad;
    document.getElementById('cantidadNombre').textContent = prod.nombre;
    document.getElementById('cantidadPrecioUnit').textContent = '$' + precio.toFixed(2) + ' / ' + unidad;
    document.getElementById('cantidadUnidad').textContent = unidad;
    document.getElementById('inputCantidadModal').value = '1';
    calcularSubtotalModal();
    document.getElementById('modalCantidad').classList.add('active');
    setTimeout(function() { document.getElementById('inputCantidadModal').select(); }, 100);
}

function ajustarCantidadModal(d) {
    var inp = document.getElementById('inputCantidadModal');
    inp.value = Math.max(0.001, (parseFloat(inp.value) || 0) + d).toFixed(3);
    calcularSubtotalModal();
}

function calcularSubtotalModal() {
    if (!productoParaCantidad) return;
    var cant = parseFloat(document.getElementById('inputCantidadModal').value) || 0;
    var precio = getPrecioConImpuestos(productoParaCantidad, tipoPrecio);
    document.getElementById('subtotalModal').textContent = '$' + (cant * precio).toFixed(2);
}

function confirmarCantidad() {
    if (!productoParaCantidad) return;
    var cant = parseFloat(document.getElementById('inputCantidadModal').value) || 0;
    if (cant <= 0) { 
        mostrarToast('Cantidad inválida', 'error'); 
        return; 
    }
    agregarAlCarrito(productoParaCantidad, cant);
    cerrarModal('modalCantidad');
    productoParaCantidad = null;
    focusBuscar();
}

// ========== MODAL CLIENTE ==========
function abrirModalCliente() {
    document.getElementById('modalCliente').classList.add('active');
    document.getElementById('buscarCliente').value = '';
    filtrarClientes();
    setTimeout(function() { document.getElementById('buscarCliente').focus(); }, 100);
}

function filtrarClientes() {
    var busq = (document.getElementById('buscarCliente').value || '').toLowerCase();
    var filtrados = clientes.filter(function(c) {
        return !busq || 
            c.nombre.toLowerCase().indexOf(busq) >= 0 ||
            (c.telefono && c.telefono.indexOf(busq) >= 0);
    });
    renderClientesLista(filtrados);
}

function renderClientesLista(items) {
    var cont = document.getElementById('clientesList');
    if (!items.length) { 
        cont.innerHTML = '<p style="text-align:center;padding:40px;color:#9ca3af">No hay clientes</p>'; 
        return; 
    }
    
    var html = '';
    items.forEach(function(c) {
        var saldo = parseFloat(c.saldo) || 0;
        var limite = parseFloat(c.limite_credito) || 0;
        var disponible = limite - saldo;
        
        html += '<div class="cliente-item" onclick="seleccionarCliente(\'' + c.cliente_id + '\')">' +
            '<div class="cliente-item-avatar">' + c.nombre.charAt(0).toUpperCase() + '</div>' +
            '<div class="cliente-item-info">' +
                '<div class="cliente-item-name">' + c.nombre + '</div>' +
                '<div class="cliente-item-detail">' + (c.telefono || '-') + '</div>' +
                (c.permite_credito === 'Y' ? '<small style="color:#6366f1">Crédito: $' + disponible.toFixed(2) + ' disponible</small>' : '') +
            '</div>' +
            '<span class="cliente-item-badge">P' + (c.tipo_precio || 1) + '</span>' +
        '</div>';
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
    focusBuscar();
}

// ========== MODAL NUEVO PRODUCTO RAPIDO ==========
function abrirModalNuevoProducto() {
    document.getElementById('modalNuevoProducto').classList.add('active');
    document.getElementById('formNuevoProducto').reset();
    setTimeout(function() { document.getElementById('np_codigo').focus(); }, 100);
}

function guardarNuevoProducto(e) {
    e.preventDefault();
    var data = {
        empresa_id: API.usuario.empresa_id,
        codigo_barras: document.getElementById('np_codigo').value,
        nombre: document.getElementById('np_nombre').value,
        precio1: parseFloat(document.getElementById('np_precio').value) || 0,
        unidad_venta: document.getElementById('np_unidad').value,
        precio_incluye_impuesto: 'Y',
        activo: 'Y'
    };
    
    API.request('/productos', 'POST', data).then(function(r) {
        if (r.success) {
            mostrarToast('Producto creado', 'success');
            cerrarModal('modalNuevoProducto');
            cargarDatos();
            focusBuscar();
        } else { 
            mostrarToast('Error: ' + (r.error || 'No se pudo guardar'), 'error'); 
        }
    });
}

// ========== MODAL NUEVO CLIENTE RAPIDO ==========
function abrirModalNuevoCliente() {
    document.getElementById('modalNuevoCliente').classList.add('active');
    document.getElementById('formNuevoCliente').reset();
    setTimeout(function() { document.getElementById('nc_nombre').focus(); }, 100);
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
            focusBuscar();
        } else { 
            mostrarToast('Error: ' + (r.error || 'No se pudo guardar'), 'error'); 
        }
    });
}

// ========== CARRITO ==========
function agregarAlCarrito(prod, cantidad) {
    var precio = getPrecioConImpuestos(prod, tipoPrecio);
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
            precioOriginal: precio,
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
    if (item.cantidad <= 0) {
        carrito = carrito.filter(function(i) { return i.producto_id !== id; });
    }
    renderCarrito();
    focusBuscar();
}

function eliminarDelCarrito(id) {
    carrito = carrito.filter(function(i) { return i.producto_id !== id; });
    renderCarrito();
    focusBuscar();
}

// ========== EDITAR EN LÍNEA CON MODAL BONITO ==========
var editarLineaData = { id: null, tipo: null };

function editarCantidadLinea(id) {
    var item = carrito.find(function(i) { return i.producto_id === id; });
    if (!item) return;
    
    editarLineaData = { id: id, tipo: 'cantidad' };
    
    document.getElementById('editarLineaTitulo').textContent = 'Editar Cantidad';
    document.getElementById('editarLineaProducto').textContent = item.nombre;
    document.getElementById('editarLineaLabel').textContent = 'Nueva cantidad';
    document.getElementById('editarLineaPrefix').textContent = '';
    document.getElementById('editarLineaSuffix').textContent = item.unidad;
    document.getElementById('inputEditarLinea').value = item.cantidad;
    document.getElementById('inputEditarLinea').step = item.esGranel ? '0.001' : '1';
    
    var shortcuts = document.getElementById('editarShortcuts');
    if (item.esGranel) {
        shortcuts.innerHTML = 
            '<button onclick="setEditarValor(0.25)">0.250</button>' +
            '<button onclick="setEditarValor(0.5)">0.500</button>' +
            '<button onclick="setEditarValor(0.75)">0.750</button>' +
            '<button onclick="setEditarValor(1)">1.000</button>' +
            '<button onclick="setEditarValor(1.5)">1.500</button>' +
            '<button onclick="setEditarValor(2)">2.000</button>';
    } else {
        shortcuts.innerHTML = 
            '<button onclick="ajustarEditarValor(-1)">−1</button>' +
            '<button onclick="ajustarEditarValor(1)">+1</button>' +
            '<button onclick="ajustarEditarValor(5)">+5</button>' +
            '<button onclick="ajustarEditarValor(10)">+10</button>';
    }
    
    document.getElementById('modalEditarLinea').classList.add('active');
    setTimeout(function() { document.getElementById('inputEditarLinea').select(); }, 100);
}

function editarPrecioLinea(id) {
    var item = carrito.find(function(i) { return i.producto_id === id; });
    if (!item) return;
    
    editarLineaData = { id: id, tipo: 'precio' };
    
    document.getElementById('editarLineaTitulo').textContent = 'Editar Precio';
    document.getElementById('editarLineaProducto').textContent = item.nombre;
    document.getElementById('editarLineaLabel').textContent = 'Nuevo precio unitario';
    document.getElementById('editarLineaPrefix').textContent = '$';
    document.getElementById('editarLineaSuffix').textContent = '';
    document.getElementById('inputEditarLinea').value = item.precio.toFixed(2);
    document.getElementById('inputEditarLinea').step = '0.01';
    
    var original = item.precioOriginal || item.precio;
    document.getElementById('editarShortcuts').innerHTML = 
        '<button onclick="setEditarValor(' + original.toFixed(2) + ')" class="primary">Original $' + original.toFixed(2) + '</button>' +
        '<button onclick="ajustarEditarValor(-10)">−$10</button>' +
        '<button onclick="ajustarEditarValor(-5)">−$5</button>' +
        '<button onclick="ajustarEditarValor(5)">+$5</button>' +
        '<button onclick="ajustarEditarValor(10)">+$10</button>';
    
    document.getElementById('modalEditarLinea').classList.add('active');
    setTimeout(function() { document.getElementById('inputEditarLinea').select(); }, 100);
}

function editarDescuentoLinea(id) {
    var item = carrito.find(function(i) { return i.producto_id === id; });
    if (!item) return;
    
    editarLineaData = { id: id, tipo: 'descuento' };
    
    document.getElementById('editarLineaTitulo').textContent = 'Aplicar Descuento';
    document.getElementById('editarLineaProducto').textContent = item.nombre;
    document.getElementById('editarLineaLabel').textContent = 'Porcentaje de descuento';
    document.getElementById('editarLineaPrefix').textContent = '';
    document.getElementById('editarLineaSuffix').textContent = '%';
    document.getElementById('inputEditarLinea').value = item.descuento || 0;
    document.getElementById('inputEditarLinea').step = '1';
    
    document.getElementById('editarShortcuts').innerHTML = 
        '<button onclick="setEditarValor(0)">0%</button>' +
        '<button onclick="setEditarValor(5)">5%</button>' +
        '<button onclick="setEditarValor(10)">10%</button>' +
        '<button onclick="setEditarValor(15)">15%</button>' +
        '<button onclick="setEditarValor(20)">20%</button>' +
        '<button onclick="setEditarValor(25)">25%</button>';
    
    document.getElementById('modalEditarLinea').classList.add('active');
    setTimeout(function() { document.getElementById('inputEditarLinea').select(); }, 100);
}

function setEditarValor(val) {
    document.getElementById('inputEditarLinea').value = val;
}

function ajustarEditarValor(delta) {
    var inp = document.getElementById('inputEditarLinea');
    var val = parseFloat(inp.value) || 0;
    inp.value = Math.max(0, val + delta);
}

function onEditarLineaKeypress(e) {
    if (e.key === 'Enter') {
        confirmarEditarLinea();
    }
}

function confirmarEditarLinea() {
    var item = carrito.find(function(i) { return i.producto_id === editarLineaData.id; });
    if (!item) return;
    
    var valor = parseFloat(document.getElementById('inputEditarLinea').value);
    
    if (editarLineaData.tipo === 'cantidad') {
        if (valor > 0) {
            item.cantidad = valor;
        } else {
            carrito = carrito.filter(function(i) { return i.producto_id !== editarLineaData.id; });
        }
    } else if (editarLineaData.tipo === 'precio') {
        if (valor >= 0) {
            item.precio = valor;
        }
    } else if (editarLineaData.tipo === 'descuento') {
        item.descuento = Math.min(100, Math.max(0, valor || 0));
    }
    
    renderCarrito();
    cerrarModal('modalEditarLinea');
    focusBuscar();
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
            '<button class="qty-granel" onclick="editarCantidadLinea(\'' + item.producto_id + '\')">' + item.cantidad.toFixed(3) + '</button>' :
            '<div class="qty-control">' +
                '<button onclick="cambiarCantidad(\'' + item.producto_id + '\',-1)">−</button>' +
                '<span onclick="editarCantidadLinea(\'' + item.producto_id + '\')">' + item.cantidad + '</span>' +
                '<button onclick="cambiarCantidad(\'' + item.producto_id + '\',1)">+</button>' +
            '</div>';
        
        html += '<tr>' +
            '<td><div class="cart-item-name">' + item.nombre + '</div><div class="cart-item-code">' + item.codigo + '</div></td>' +
            '<td class="cart-item-price"><span onclick="editarPrecioLinea(\'' + item.producto_id + '\')" title="Click para editar">$' + item.precio.toFixed(2) + '</span></td>' +
            '<td class="cart-item-qty">' + cantHtml + '</td>' +
            '<td class="cart-item-unit"><span class="badge' + (item.esGranel ? ' granel' : '') + '">' + item.unidad + '</span></td>' +
            '<td class="cart-item-desc"><button class="btn-desc" onclick="editarDescuentoLinea(\'' + item.producto_id + '\')">' + (item.descuento > 0 ? item.descuento + '%' : '-') + '</button></td>' +
            '<td class="cart-item-total">$' + total.toFixed(2) + '</td>' +
            '<td><button class="btn-delete" onclick="eliminarDelCarrito(\'' + item.producto_id + '\')"><i class="fas fa-trash"></i></button></td>' +
        '</tr>';
    });
    tbody.innerHTML = html;
    actualizarTotales();
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
    editarLineaData = { id: null, tipo: 'descuento_global' };
    
    document.getElementById('editarLineaTitulo').textContent = 'Descuento Global';
    document.getElementById('editarLineaProducto').textContent = 'Aplicar a toda la venta';
    document.getElementById('editarLineaLabel').textContent = 'Porcentaje de descuento';
    document.getElementById('editarLineaPrefix').textContent = '';
    document.getElementById('editarLineaSuffix').textContent = '%';
    document.getElementById('inputEditarLinea').value = descuentoGlobal;
    document.getElementById('inputEditarLinea').step = '1';
    
    document.getElementById('editarShortcuts').innerHTML = 
        '<button onclick="setEditarValor(0)">0%</button>' +
        '<button onclick="setEditarValor(5)">5%</button>' +
        '<button onclick="setEditarValor(10)">10%</button>' +
        '<button onclick="setEditarValor(15)">15%</button>' +
        '<button onclick="setEditarValor(20)">20%</button>' +
        '<button onclick="setEditarValor(25)">25%</button>';
    
    document.getElementById('modalEditarLinea').classList.add('active');
    setTimeout(function() { document.getElementById('inputEditarLinea').select(); }, 100);
}

// Sobreescribir confirmarEditarLinea para manejar descuento global
var _confirmarEditarLineaOriginal = confirmarEditarLinea;
confirmarEditarLinea = function() {
    if (editarLineaData.tipo === 'descuento_global') {
        var valor = parseFloat(document.getElementById('inputEditarLinea').value);
        descuentoGlobal = Math.min(100, Math.max(0, valor || 0));
        renderCarrito();
        cerrarModal('modalEditarLinea');
        mostrarToast('Descuento global: ' + descuentoGlobal + '%');
        focusBuscar();
        return;
    }
    _confirmarEditarLineaOriginal();
};

function cancelarVenta() {
    if (!carrito.length) return;
    if (confirm('¿Cancelar venta?')) {
        carrito = [];
        descuentoGlobal = 0;
        renderCarrito();
        mostrarToast('Venta cancelada');
    }
    focusBuscar();
}

// ========== COBRO ==========
function abrirModalCobro() {
    if (!carrito.length) return;
    
    var total = calcularTotalFinal();
    
    if (tipoVenta === 'CREDITO') {
        if (!clienteSeleccionado) {
            mostrarToast('Selecciona un cliente para venta a crédito', 'error');
            return;
        }
        if (clienteSeleccionado.permite_credito !== 'Y') {
            mostrarToast('Este cliente no tiene crédito autorizado', 'error');
            return;
        }
        
        var saldoActual = parseFloat(clienteSeleccionado.saldo) || 0;
        var limiteCredito = parseFloat(clienteSeleccionado.limite_credito) || 0;
        var disponible = limiteCredito - saldoActual;
        
        if (total > disponible) {
            mostrarToast('Crédito insuficiente. Disponible: $' + disponible.toFixed(2), 'error');
            return;
        }
    }
    
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
    
    if (tipoVenta === 'CREDITO' && clienteSeleccionado) {
        var saldoActual = parseFloat(clienteSeleccionado.saldo) || 0;
        var limiteCredito = parseFloat(clienteSeleccionado.limite_credito) || 0;
        var disponible = limiteCredito - saldoActual;
        
        if (total > disponible) {
            mostrarToast('Crédito insuficiente. Disponible: $' + disponible.toFixed(2), 'error');
            return;
        }
    }
    
    var metodoActivo = document.querySelector('.metodo-btn.active');
    var metodoPagoId = metodoActivo ? metodoActivo.getAttribute('data-metodo-id') : null;
    
    if (!metodoPagoId && metodosPago.length > 0) {
        var efectivoMetodo = metodosPago.find(function(m) {
            var nombre = (m.nombre || '').toLowerCase();
            return m.tipo === 'EFECTIVO' || nombre.indexOf('efectivo') >= 0;
        });
        metodoPagoId = efectivoMetodo ? efectivoMetodo.metodo_pago_id : metodosPago[0].metodo_pago_id;
    }
    
    if (!metodoPagoId) metodoPagoId = 'EFECTIVO';
    
    var subtotalVenta = carrito.reduce(function(s, i) { return s + i.precio * i.cantidad; }, 0);
    
    var venta = {
        empresa_id: API.usuario.empresa_id,
        sucursal_id: API.usuario.sucursal_id,
        almacen_id: API.usuario.almacen_id || null,
        usuario_id: API.usuario.id || API.usuario.usuario_id,
        cliente_id: clienteSeleccionado ? clienteSeleccionado.cliente_id : null,
        tipo: 'VENTA',
        tipo_venta: tipoVenta,
        tipo_precio: tipoPrecio,
        subtotal: subtotalVenta,
        descuento: descuentoGlobal,
        total: total,
        pagado: tipoVenta === 'CREDITO' ? 0 : efectivo,
        cambio: tipoVenta === 'CREDITO' ? 0 : Math.max(0, efectivo - total),
        pagos: tipoVenta === 'CONTADO' ? [{
            metodo_pago_id: metodoPagoId,
            monto: Math.min(efectivo, total)
        }] : [],
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
    
    API.request('/ventas', 'POST', venta)
        .then(function(r) {
            if (r.success) {
                if (tipoVenta === 'CREDITO' && clienteSeleccionado) {
                    clienteSeleccionado.saldo = (parseFloat(clienteSeleccionado.saldo) || 0) + total;
                }
                cerrarModal('modalCobro');
                mostrarExito(r.folio || r.venta_id, total, efectivo - total);
            } else {
                mostrarToast('Error: ' + (r.error || 'No se pudo guardar'), 'error');
            }
        })
        .catch(function(e) {
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

function imprimirTicket() { 
    mostrarToast('Imprimiendo...'); 
}

function nuevaVenta() {
    carrito = [];
    clienteSeleccionado = null;
    tipoVenta = 'CONTADO';
    descuentoGlobal = 0;
    tipoPrecio = 1;
    
    document.getElementById('clienteNombre').textContent = 'Público General';
    document.getElementById('clientePanel').textContent = 'Público General';
    document.getElementById('btnContado').classList.add('active');
    document.getElementById('btnCredito').classList.remove('active');
    document.getElementById('selectPrecio').value = '1';
    document.getElementById('inputBuscar').value = '';
    
    renderCarrito();
    cerrarModal('modalExito');
    focusBuscar();
}

// ========== UTILS ==========
function cerrarModal(id) { 
    document.getElementById(id).classList.remove('active'); 
}

function cerrarTodosModales() { 
    document.querySelectorAll('.modal-overlay.active').forEach(function(m) { 
        m.classList.remove('active'); 
    }); 
}

function mostrarToast(msg, tipo) {
    var toast = document.getElementById('toast');
    toast.innerHTML = '<i class="fas fa-' + (tipo === 'error' ? 'exclamation-circle' : 'check-circle') + '"></i> ' + msg;
    toast.className = 'toast show ' + (tipo || 'success');
    setTimeout(function() { toast.classList.remove('show'); }, 3000);
    // ========== VENTAS EN ESPERA ==========
var ventasEnEspera = JSON.parse(localStorage.getItem('ventasEnEspera') || '[]');

function actualizarBadgeEspera() {
    var btn = document.querySelector('.header-btn.warning');
    if (!btn) return;
    
    var badge = btn.querySelector('.espera-badge');
    if (ventasEnEspera.length > 0) {
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'espera-badge';
            btn.style.position = 'relative';
            btn.appendChild(badge);
        }
        badge.textContent = ventasEnEspera.length;
    } else if (badge) {
        badge.remove();
    }
}

function ponerEnEspera() {
    if (!carrito.length) {
        mostrarToast('No hay productos en el carrito', 'error');
        return;
    }
    
    var ventaEspera = {
        id: Date.now(),
        fecha: new Date().toISOString(),
        cliente: clienteSeleccionado ? { ...clienteSeleccionado } : null,
        clienteNombre: clienteSeleccionado ? clienteSeleccionado.nombre : 'Público General',
        tipoVenta: tipoVenta,
        tipoPrecio: tipoPrecio,
        descuentoGlobal: descuentoGlobal,
        carrito: JSON.parse(JSON.stringify(carrito)),
        total: calcularTotalFinal(),
        articulos: carrito.reduce(function(s, i) { return s + i.cantidad; }, 0)
    };
    
    ventasEnEspera.push(ventaEspera);
    localStorage.setItem('ventasEnEspera', JSON.stringify(ventasEnEspera));
    
    // Limpiar venta actual
    carrito = [];
    clienteSeleccionado = null;
    tipoVenta = 'CONTADO';
    descuentoGlobal = 0;
    tipoPrecio = 1;
    
    document.getElementById('clienteNombre').textContent = 'Público General';
    document.getElementById('clientePanel').textContent = 'Público General';
    document.getElementById('btnContado').classList.add('active');
    document.getElementById('btnCredito').classList.remove('active');
    document.getElementById('selectPrecio').value = '1';
    
    renderCarrito();
    actualizarBadgeEspera();
    mostrarToast('Venta guardada en espera');
    focusBuscar();
}

function abrirModalEspera() {
    renderEsperaList();
    document.getElementById('modalEspera').classList.add('active');
}

function renderEsperaList() {
    var cont = document.getElementById('esperaList');
    
    if (!ventasEnEspera.length) {
        cont.innerHTML = '<div class="espera-empty">' +
            '<i class="fas fa-inbox"></i>' +
            '<h4>No hay ventas en espera</h4>' +
            '<p>Las ventas pausadas aparecerán aquí</p>' +
        '</div>';
        return;
    }
    
    var html = '';
    ventasEnEspera.forEach(function(v, index) {
        var fecha = new Date(v.fecha);
        var hora = fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
        
        html += '<div class="espera-item">' +
            '<div class="espera-item-header">' +
                '<span class="espera-item-cliente"><i class="fas fa-user"></i> ' + v.clienteNombre + '</span>' +
                '<span class="espera-item-total">$' + v.total.toFixed(2) + '</span>' +
            '</div>' +
            '<div class="espera-item-meta">' +
                '<span><i class="fas fa-clock"></i> ' + hora + '</span>' +
                '<span><i class="fas fa-shopping-cart"></i> ' + v.articulos.toFixed(0) + ' artículos</span>' +
                '<span><i class="fas fa-tag"></i> ' + v.tipoVenta + '</span>' +
            '</div>' +
            '<div class="espera-item-actions">' +
                '<button class="btn-recuperar" onclick="recuperarVenta(' + index + ')"><i class="fas fa-play"></i> Recuperar</button>' +
                '<button class="btn-eliminar" onclick="eliminarVentaEspera(' + index + ')"><i class="fas fa-trash"></i> Eliminar</button>' +
            '</div>' +
        '</div>';
    });
    cont.innerHTML = html;
}

function recuperarVenta(index) {
    var venta = ventasEnEspera[index];
    if (!venta) return;
    
    // Si hay carrito actual, preguntar
    if (carrito.length > 0) {
        if (!confirm('Hay una venta en curso. ¿Deseas guardarla en espera y recuperar la seleccionada?')) {
            return;
        }
        ponerEnEspera();
    }
    
    // Restaurar venta
    carrito = venta.carrito;
    clienteSeleccionado = venta.cliente;
    tipoVenta = venta.tipoVenta;
    tipoPrecio = venta.tipoPrecio;
    descuentoGlobal = venta.descuentoGlobal;
    
    document.getElementById('clienteNombre').textContent = venta.clienteNombre;
    document.getElementById('clientePanel').textContent = venta.clienteNombre;
    document.getElementById('btnContado').classList.toggle('active', tipoVenta === 'CONTADO');
    document.getElementById('btnCredito').classList.toggle('active', tipoVenta === 'CREDITO');
    document.getElementById('tipoVentaLabel').textContent = tipoVenta === 'CONTADO' ? 'Contado' : 'Crédito';
    document.getElementById('selectPrecio').value = tipoPrecio;
    
    // Eliminar de espera
    ventasEnEspera.splice(index, 1);
    localStorage.setItem('ventasEnEspera', JSON.stringify(ventasEnEspera));
    
    renderCarrito();
    actualizarBadgeEspera();
    cerrarModal('modalEspera');
    mostrarToast('Venta recuperada');
    focusBuscar();
}

function eliminarVentaEspera(index) {
    if (!confirm('¿Eliminar esta venta en espera?')) return;
    
    ventasEnEspera.splice(index, 1);
    localStorage.setItem('ventasEnEspera', JSON.stringify(ventasEnEspera));
    
    renderEsperaList();
    actualizarBadgeEspera();
    mostrarToast('Venta eliminada');
}

// Inicializar badge al cargar
document.addEventListener('DOMContentLoaded', function() {
    actualizarBadgeEspera();
});
}
