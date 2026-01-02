// ==================== POS.JS ====================
// Verificar sesión
if (!API.isLoggedIn()) window.location.href = '../index.html';

// Variables globales
var productos = [];
var categorias = [];
var clientes = [];
var metodosPago = [];
var carrito = [];
var clienteSeleccionado = null;
var tipoVenta = 'CONTADO';
var tipoPrecio = 1;
var productoParaCantidad = null;

// Unidades granel
var UNIDADES_GRANEL = ['KG', 'GR', 'LT', 'ML', 'MT'];

// ==================== INICIALIZACIÓN ====================
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
                metodosPago = r.metodos || [];
                console.log('Datos cargados:', productos.length, 'productos,', categorias.length, 'categorías,', clientes.length, 'clientes');
                renderCategoriasSelect();
            } else {
                mostrarToast('Error cargando datos', 'error');
            }
        })
        .catch(function(e) {
            console.error(e);
            mostrarToast('Error de conexión', 'error');
        });
}

function renderCategoriasSelect() {
    var sel = document.getElementById('filtroCategoria');
    sel.innerHTML = '<option value="">Todas</option>';
    categorias.forEach(function(c) {
        if (c.activo === 'Y') {
            sel.innerHTML += '<option value="' + c.categoria_id + '">' + c.nombre + '</option>';
        }
    });
}

// ==================== EVENTOS ====================
function setupEventos() {
    // Métodos de pago en modal cobro
    document.querySelectorAll('.metodo-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.metodo-btn').forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
        });
    });
}

function setupKeyboard() {
    document.addEventListener('keydown', function(e) {
        // F2 - Buscar productos
        if (e.key === 'F2') {
            e.preventDefault();
            abrirModalProductos();
        }
        // F4 - Cancelar
        if (e.key === 'F4') {
            e.preventDefault();
            cancelarVenta();
        }
        // F12 - Cobrar
        if (e.key === 'F12') {
            e.preventDefault();
            if (carrito.length > 0) abrirModalCobro();
        }
        // Escape - Cerrar modales
        if (e.key === 'Escape') {
            cerrarTodosModales();
        }
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
    }
}

// ==================== TIPO DE VENTA ====================
function setTipoVenta(tipo) {
    tipoVenta = tipo;
    document.getElementById('btnContado').classList.toggle('active', tipo === 'CONTADO');
    document.getElementById('btnCredito').classList.toggle('active', tipo === 'CREDITO');
    document.getElementById('tipoVentaLabel').textContent = tipo === 'CONTADO' ? 'Contado' : 'Crédito';
    document.getElementById('cobroBadge').textContent = tipo;
}

function cambiarTipoPrecio() {
    tipoPrecio = parseInt(document.getElementById('selectPrecio').value);
    actualizarPreciosCarrito();
}

function actualizarPreciosCarrito() {
    carrito.forEach(function(item) {
        var prod = productos.find(function(p) { return p.producto_id === item.producto_id; });
        if (prod) {
            item.precio = parseFloat(prod['precio' + tipoPrecio] || prod.precio1) || 0;
        }
    });
    renderCarrito();
}

// ==================== MODAL PRODUCTOS ====================
function abrirModalProductos() {
    document.getElementById('modalProductos').classList.add('active');
    document.getElementById('filtroNombre').value = '';
    document.getElementById('filtroCategoria').value = '';
    document.getElementById('filtroCantidad').value = '1';
    filtrarProductos();
    setTimeout(function() {
        document.getElementById('filtroNombre').focus();
    }, 100);
}

function filtrarProductos() {
    var nombre = document.getElementById('filtroNombre').value.toLowerCase();
    var categoria = document.getElementById('filtroCategoria').value;
    var precioTipo = document.getElementById('filtroPrecio').value;
    
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
    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:#9ca3af">No se encontraron productos</td></tr>';
        return;
    }
    
    var html = '';
    items.forEach(function(p) {
        var precio = parseFloat(p['precio' + precioTipo] || p.precio1) || 0;
        var unidad = p.unidad_venta || p.unidad_venta_id || 'PZ';
        var descuento = p.descuento || 0;
        var imgSrc = p.imagen_url || 'https://via.placeholder.com/48?text=' + encodeURIComponent(p.nombre.charAt(0));
        
        html += '<tr onclick="seleccionarProducto(\'' + p.producto_id + '\')">' +
            '<td><img class="producto-img" src="' + imgSrc + '" onerror="this.src=\'https://via.placeholder.com/48?text=P\'"></td>' +
            '<td class="producto-codigo">' + (p.codigo_barras || p.codigo_interno || '-') + '</td>' +
            '<td class="producto-nombre">' + p.nombre + '</td>' +
            '<td class="producto-unidad"><span class="badge-unidad">' + unidad + '</span></td>' +
            '<td class="producto-descuento">' + (descuento > 0 ? '<span class="badge-descuento"><i class="fas fa-tag"></i> ' + descuento + '%</span>' : '-') + '</td>' +
            '<td class="producto-precio">$' + precio.toFixed(2) + '</td>' +
        '</tr>';
    });
    tbody.innerHTML = html;
}

function ajustarCantidadFiltro(delta) {
    var input = document.getElementById('filtroCantidad');
    var val = parseFloat(input.value) || 1;
    val = Math.max(0.001, val + delta);
    input.value = val;
}

function seleccionarProducto(productoId) {
    var prod = productos.find(function(p) { return p.producto_id === productoId; });
    if (!prod) return;
    
    var cantidad = parseFloat(document.getElementById('filtroCantidad').value) || 1;
    
    // Verificar si es granel
    var unidad = (prod.unidad_venta || prod.unidad_venta_id || 'PZ').toUpperCase();
    if (UNIDADES_GRANEL.indexOf(unidad) >= 0 && cantidad === 1) {
        cerrarModal('modalProductos');
        abrirModalCantidad(prod);
    } else {
        agregarAlCarrito(prod, cantidad);
        cerrarModal('modalProductos');
    }
}

// ==================== MODAL CANTIDAD (GRANEL) ====================
function verificarYAgregar(prod) {
    var unidad = (prod.unidad_venta || prod.unidad_venta_id || 'PZ').toUpperCase();
    if (UNIDADES_GRANEL.indexOf(unidad) >= 0) {
        abrirModalCantidad(prod);
    } else {
        agregarAlCarrito(prod, 1);
    }
}

function abrirModalCantidad(prod) {
    productoParaCantidad = prod;
    var unidad = (prod.unidad_venta || prod.unidad_venta_id || 'KG').toUpperCase();
    var precio = parseFloat(prod['precio' + tipoPrecio] || prod.precio1) || 0;
    
    document.getElementById('cantidadProductoId').value = prod.producto_id;
    document.getElementById('cantidadTitulo').textContent = 'Cantidad en ' + unidad;
    document.getElementById('cantidadNombre').textContent = prod.nombre;
    document.getElementById('cantidadPrecioUnit').textContent = '$' + precio.toFixed(2) + ' / ' + unidad;
    document.getElementById('cantidadUnidad').textContent = unidad;
    document.getElementById('inputCantidadModal').value = '1';
    
    // Imagen
    var img = document.getElementById('cantidadImagen');
    if (prod.imagen_url) {
        img.src = prod.imagen_url;
        img.style.display = 'block';
    } else {
        img.style.display = 'none';
    }
    
    // Presets según unidad
    var presets = [];
    if (unidad === 'KG') {
        presets = [{v: 0.25, l: '250g'}, {v: 0.5, l: '500g'}, {v: 1, l: '1kg'}, {v: 2, l: '2kg'}, {v: 5, l: '5kg'}];
    } else if (unidad === 'GR') {
        presets = [{v: 100, l: '100g'}, {v: 250, l: '250g'}, {v: 500, l: '500g'}, {v: 1000, l: '1000g'}];
    } else if (unidad === 'LT') {
        presets = [{v: 0.5, l: '500ml'}, {v: 1, l: '1lt'}, {v: 2, l: '2lt'}, {v: 5, l: '5lt'}];
    } else if (unidad === 'ML') {
        presets = [{v: 250, l: '250ml'}, {v: 500, l: '500ml'}, {v: 750, l: '750ml'}, {v: 1000, l: '1lt'}];
    } else if (unidad === 'MT') {
        presets = [{v: 0.5, l: '50cm'}, {v: 1, l: '1mt'}, {v: 2, l: '2mt'}, {v: 5, l: '5mt'}];
    }
    
    var presetsHtml = '';
    presets.forEach(function(p) {
        presetsHtml += '<button onclick="setCantidadPreset(' + p.v + ')">' + p.l + '</button>';
    });
    document.getElementById('cantidadPresets').innerHTML = presetsHtml;
    
    calcularSubtotalModal();
    document.getElementById('modalCantidad').classList.add('active');
    setTimeout(function() {
        document.getElementById('inputCantidadModal').select();
    }, 100);
}

function setCantidadPreset(val) {
    document.getElementById('inputCantidadModal').value = val;
    calcularSubtotalModal();
}

function ajustarCantidadModal(delta) {
    var input = document.getElementById('inputCantidadModal');
    var val = parseFloat(input.value) || 0;
    val = Math.max(0.001, val + delta);
    input.value = val.toFixed(3);
    calcularSubtotalModal();
}

function calcularSubtotalModal() {
    if (!productoParaCantidad) return;
    var cantidad = parseFloat(document.getElementById('inputCantidadModal').value) || 0;
    var precio = parseFloat(productoParaCantidad['precio' + tipoPrecio] || productoParaCantidad.precio1) || 0;
    var subtotal = cantidad * precio;
    document.getElementById('subtotalModal').textContent = '$' + subtotal.toFixed(2);
}

function confirmarCantidad() {
    if (!productoParaCantidad) return;
    var cantidad = parseFloat(document.getElementById('inputCantidadModal').value) || 0;
    if (cantidad <= 0) {
        mostrarToast('Ingresa una cantidad válida', 'error');
        return;
    }
    agregarAlCarrito(productoParaCantidad, cantidad);
    cerrarModal('modalCantidad');
    productoParaCantidad = null;
}

// ==================== MODAL CLIENTE ====================
function abrirModalCliente() {
    document.getElementById('modalCliente').classList.add('active');
    document.getElementById('buscarCliente').value = '';
    filtrarClientes();
    setTimeout(function() {
        document.getElementById('buscarCliente').focus();
    }, 100);
}

function filtrarClientes() {
    var busqueda = document.getElementById('buscarCliente').value.toLowerCase();
    var filtrados = clientes.filter(function(c) {
        return !busqueda ||
            c.nombre.toLowerCase().indexOf(busqueda) >= 0 ||
            (c.telefono && c.telefono.indexOf(busqueda) >= 0) ||
            (c.rfc && c.rfc.toLowerCase().indexOf(busqueda) >= 0);
    });
    renderClientesLista(filtrados);
}

function renderClientesLista(items) {
    var container = document.getElementById('clientesList');
    if (items.length === 0) {
        container.innerHTML = '<p style="text-align:center;padding:40px;color:#9ca3af">No se encontraron clientes</p>';
        return;
    }
    
    var html = '';
    items.forEach(function(c) {
        var inicial = c.nombre.charAt(0).toUpperCase();
        html += '<div class="cliente-item" onclick="seleccionarCliente(\'' + c.cliente_id + '\')">' +
            '<div class="cliente-item-avatar">' + inicial + '</div>' +
            '<div class="cliente-item-info">' +
                '<div class="cliente-item-name">' + c.nombre + '</div>' +
                '<div class="cliente-item-detail">' + (c.telefono || c.email || '-') + '</div>' +
            '</div>' +
            '<span class="cliente-item-badge">P' + (c.tipo_precio || 1) + '</span>' +
        '</div>';
    });
    container.innerHTML = html;
}

function seleccionarCliente(clienteId) {
    if (clienteId) {
        clienteSeleccionado = clientes.find(function(c) { return c.cliente_id === clienteId; });
        if (clienteSeleccionado) {
            document.getElementById('clienteNombre').textContent = clienteSeleccionado.nombre;
            document.getElementById('clientePanel').textContent = clienteSeleccionado.nombre;
            // Cambiar tipo de precio según cliente
            tipoPrecio = parseInt(clienteSeleccionado.tipo_precio) || 1;
            document.getElementById('selectPrecio').value = tipoPrecio;
            actualizarPreciosCarrito();
        }
    } else {
        clienteSeleccionado = null;
        document.getElementById('clienteNombre').textContent = 'Público General';
        document.getElementById('clientePanel').textContent = 'Público General';
    }
    cerrarModal('modalCliente');
}

// ==================== CARRITO ====================
function agregarAlCarrito(prod, cantidad) {
    var precio = parseFloat(prod['precio' + tipoPrecio] || prod.precio1) || 0;
    var unidad = prod.unidad_venta || prod.unidad_venta_id || 'PZ';
    var esGranel = UNIDADES_GRANEL.indexOf(unidad.toUpperCase()) >= 0;
    
    var existe = carrito.find(function(item) { return item.producto_id === prod.producto_id; });
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
            esGranel: esGranel
        });
    }
    
    renderCarrito();
    mostrarToast(prod.nombre + ' agregado');
}

function cambiarCantidad(productoId, delta) {
    var item = carrito.find(function(i) { return i.producto_id === productoId; });
    if (!item) return;
    
    item.cantidad += delta;
    if (item.cantidad <= 0) {
        carrito = carrito.filter(function(i) { return i.producto_id !== productoId; });
    }
    renderCarrito();
}

function editarCantidadGranel(productoId) {
    var item = carrito.find(function(i) { return i.producto_id === productoId; });
    if (!item) return;
    
    var prod = productos.find(function(p) { return p.producto_id === productoId; });
    if (prod) {
        abrirModalCantidad(prod);
        document.getElementById('inputCantidadModal').value = item.cantidad;
        calcularSubtotalModal();
    }
}

function eliminarDelCarrito(productoId) {
    carrito = carrito.filter(function(i) { return i.producto_id !== productoId; });
    renderCarrito();
}

function renderCarrito() {
    var tbody = document.getElementById('cartBody');
    var empty = document.getElementById('cartEmpty');
    
    if (carrito.length === 0) {
        tbody.innerHTML = '';
        empty.style.display = 'flex';
        actualizarTotales();
        return;
    }
    
    empty.style.display = 'none';
    var html = '';
    
    carrito.forEach(function(item) {
        var subtotal = item.precio * item.cantidad;
        var cantidadDisplay;
        
        if (item.esGranel) {
            cantidadDisplay = '<button class="qty-granel" onclick="editarCantidadGranel(\'' + item.producto_id + '\')">' + 
                item.cantidad.toFixed(3) + '</button>';
        } else {
            cantidadDisplay = '<div class="qty-control">' +
                '<button onclick="cambiarCantidad(\'' + item.producto_id + '\', -1)">−</button>' +
                '<span>' + item.cantidad + '</span>' +
                '<button onclick="cambiarCantidad(\'' + item.producto_id + '\', 1)">+</button>' +
            '</div>';
        }
        
        html += '<tr>' +
            '<td>' +
                '<div class="cart-item-name">' + item.nombre + '</div>' +
                '<div class="cart-item-code">' + item.codigo + '</div>' +
            '</td>' +
            '<td class="cart-item-price">$' + item.precio.toFixed(2) + '</td>' +
            '<td class="cart-item-qty">' + cantidadDisplay + '</td>' +
            '<td class="cart-item-unit"><span class="badge' + (item.esGranel ? ' granel' : '') + '">' + item.unidad + '</span></td>' +
            '<td class="cart-item-total">$' + subtotal.toFixed(2) + '</td>' +
            '<td class="cart-item-delete">' +
                '<button class="btn-delete" onclick="eliminarDelCarrito(\'' + item.producto_id + '\')">' +
                    '<i class="fas fa-trash"></i>' +
                '</button>' +
            '</td>' +
        '</tr>';
    });
    
    tbody.innerHTML = html;
    actualizarTotales();
}

function actualizarTotales() {
    var articulos = 0;
    var subtotal = 0;
    
    carrito.forEach(function(item) {
        articulos += item.cantidad;
        subtotal += item.precio * item.cantidad;
    });
    
    document.getElementById('totalArticulos').textContent = articulos.toFixed(2);
    document.getElementById('subtotalVenta').textContent = '$' + subtotal.toFixed(2);
    document.getElementById('totalAmount').textContent = '$' + subtotal.toFixed(2);
    
    // Habilitar/deshabilitar botón cobrar
    document.getElementById('btnCobrar').disabled = carrito.length === 0;
}

function cancelarVenta() {
    if (carrito.length === 0) return;
    if (confirm('¿Cancelar la venta actual?')) {
        carrito = [];
        renderCarrito();
        mostrarToast('Venta cancelada');
    }
}

// ==================== MODAL COBRO ====================
function abrirModalCobro() {
    if (carrito.length === 0) return;
    
    var total = 0;
    carrito.forEach(function(item) {
        total += item.precio * item.cantidad;
    });
    
    document.getElementById('cobroTotal').textContent = '$' + total.toFixed(2);
    document.getElementById('inputEfectivo').value = '';
    document.getElementById('cobroCambio').textContent = '$0.00';
    document.getElementById('modalCobro').classList.add('active');
    
    setTimeout(function() {
        document.getElementById('inputEfectivo').focus();
    }, 100);
}

function addEfectivo(monto) {
    var input = document.getElementById('inputEfectivo');
    var actual = parseFloat(input.value) || 0;
    input.value = actual + monto;
    calcularCambio();
}

function setExacto() {
    var total = 0;
    carrito.forEach(function(item) {
        total += item.precio * item.cantidad;
    });
    document.getElementById('inputEfectivo').value = total.toFixed(2);
    calcularCambio();
}

function limpiarEfectivo() {
    document.getElementById('inputEfectivo').value = '';
    calcularCambio();
}

function calcularCambio() {
    var total = 0;
    carrito.forEach(function(item) {
        total += item.precio * item.cantidad;
    });
    
    var efectivo = parseFloat(document.getElementById('inputEfectivo').value) || 0;
    var cambio = efectivo - total;
    
    document.getElementById('cobroCambio').textContent = '$' + (cambio >= 0 ? cambio.toFixed(2) : '0.00');
}

function confirmarVenta() {
    var total = 0;
    carrito.forEach(function(item) {
        total += item.precio * item.cantidad;
    });
    
    var efectivo = parseFloat(document.getElementById('inputEfectivo').value) || 0;
    
    if (efectivo < total) {
        mostrarToast('El monto es insuficiente', 'error');
        return;
    }
    
    var venta = {
        empresa_id: API.usuario.empresa_id,
        sucursal_id: API.usuario.sucursal_id,
        almacen_id: API.usuario.almacen_id || null,
        usuario_id: API.usuario.id || API.usuario.usuario_id,
        cliente_id: clienteSeleccionado ? clienteSeleccionado.cliente_id : null,
        tipo: 'VENTA',
        tipo_venta: tipoVenta,
        tipo_precio: tipoPrecio,
        subtotal: total,
        total: total,
        pagado: efectivo,
        cambio: efectivo - total,
        items: carrito.map(function(item) {
            return {
                producto_id: item.producto_id,
                descripcion: item.nombre,
                cantidad: item.cantidad,
                unidad_id: item.unidad,
                precio_unitario: item.precio,
                subtotal: item.precio * item.cantidad
            };
        })
    };
    
    API.request('/ventas', 'POST', venta)
        .then(function(r) {
            if (r.success) {
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
    document.getElementById('exitoCambio').textContent = '$' + cambio.toFixed(2);
    document.getElementById('modalExito').classList.add('active');
}

function imprimirTicket() {
    mostrarToast('Imprimiendo ticket...');
    // Aquí iría la lógica de impresión
}

function nuevaVenta() {
    carrito = [];
    clienteSeleccionado = null;
    tipoVenta = 'CONTADO';
    tipoPrecio = 1;
    
    document.getElementById('clienteNombre').textContent = 'Público General';
    document.getElementById('clientePanel').textContent = 'Público General';
    document.getElementById('btnContado').classList.add('active');
    document.getElementById('btnCredito').classList.remove('active');
    document.getElementById('selectPrecio').value = '1';
    document.getElementById('inputBuscar').value = '';
    
    renderCarrito();
    cerrarModal('modalExito');
}

// ==================== UTILIDADES ====================
function cerrarModal(id) {
    document.getElementById(id).classList.remove('active');
}

function cerrarTodosModales() {
    document.querySelectorAll('.modal-overlay.active').forEach(function(m) {
        m.classList.remove('active');
    });
}

function mostrarToast(msg, tipo) {
    tipo = tipo || 'success';
    var toast = document.getElementById('toast');
    toast.innerHTML = '<i class="fas fa-' + (tipo === 'error' ? 'exclamation-circle' : 'check-circle') + '"></i> ' + msg;
    toast.className = 'toast show ' + tipo;
    setTimeout(function() {
        toast.classList.remove('show');
    }, 3000);
}
