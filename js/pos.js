if (!API.isLoggedIn()) window.location.href = '../index.html';

var productos = [], categorias = [], clientes = [], metodosPago = [];
var carrito = [];
var clienteSeleccionado = null;
var tipoVenta = 'CONTADO';
var tipoPrecio = 1;
var productoParaCantidad = null;

document.addEventListener('DOMContentLoaded', async function() {
    cargarUsuario();
    verificarPermisos();
    await cargarDatos();
    setupEventos();
});

function cargarUsuario() {
    var u = API.usuario;
    document.getElementById('userName').textContent = u.nombre;
    document.getElementById('userSucursal').textContent = u.sucursal_nombre || 'Sucursal';
    document.getElementById('userAvatar').textContent = u.nombre.charAt(0).toUpperCase();
}

function verificarPermisos() {
    var u = API.usuario;
    // Mostrar nav admin solo si es admin o tiene permisos
    var esAdmin = u.rol === 'ADMIN' || u.rol === 'SUPERADMIN' || u.tipo === 'ADMIN' || u.es_admin === 'Y';
    var navAdmin = document.getElementById('navAdmin');
    if (navAdmin) {
        navAdmin.style.display = esAdmin ? 'flex' : 'none';
    }
}

async function cargarDatos() {
    try {
        // Cargar productos
        var rProd = await API.request('/productos/' + API.usuario.empresa_id);
        if (rProd.success) {
            productos = rProd.productos || rProd.data || [];
        }
        
        // Cargar categorías
        var rCat = await API.request('/categorias/' + API.usuario.empresa_id);
        if (rCat.success) {
            categorias = rCat.categorias || rCat.data || [];
        }
        
        // Cargar clientes
        var rCli = await API.request('/clientes/' + API.usuario.empresa_id);
        if (rCli.success) {
            clientes = rCli.clientes || rCli.data || [];
        }
        
        renderCategoriasModal();
        console.log('Datos cargados:', productos.length, 'productos,', categorias.length, 'categorías,', clientes.length, 'clientes');
    } catch (e) {
        console.error(e);
        mostrarToast('Error cargando datos', 'error');
    }
}

function setupEventos() {
    document.getElementById('inputBuscar').addEventListener('keypress', function(e) {
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
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'F2') { e.preventDefault(); abrirModal('modalBusqueda'); }
        if (e.key === 'F3') { e.preventDefault(); abrirModalCliente(); }
        if (e.key === 'F4') { e.preventDefault(); cancelarVenta(); }
        if (e.key === 'F12') { e.preventDefault(); if (carrito.length) abrirModalCobro(); }
        if (e.key === 'Escape') cerrarModales();
    });
}

function renderCategoriasModal() {
    var sel = document.getElementById('filtroCategoria');
    sel.innerHTML = '<option value="">Todas las categorías</option>';
    categorias.forEach(function(c) {
        if (c.activo === 'Y') {
            sel.innerHTML += '<option value="' + c.categoria_id + '">' + c.nombre + '</option>';
        }
    });
}

// ============ MODALES ============
function abrirModal(id) {
    document.getElementById(id).classList.add('active');
    if (id === 'modalBusqueda') {
        document.getElementById('buscarProducto').value = '';
        document.getElementById('buscarProducto').focus();
        renderProductosModal();
    }
}

function cerrarModal(id) {
    document.getElementById(id).classList.remove('active');
}

function cerrarModales() {
    document.querySelectorAll('.modal-overlay').forEach(function(m) {
        m.classList.remove('active');
    });
}

// ============ BÚSQUEDA PRODUCTOS ============
function filtrarProductos() {
    renderProductosModal();
}

function renderProductosModal() {
    var busqueda = (document.getElementById('buscarProducto').value || '').toLowerCase();
    var catId = document.getElementById('filtroCategoria').value || '';

    var prods = productos.filter(function(p) {
        if (p.activo !== 'Y' || p.es_vendible === 'N') return false;
        var matchCat = !catId || p.categoria_id === catId;
        var matchBusq = !busqueda || 
            p.nombre.toLowerCase().indexOf(busqueda) >= 0 ||
            (p.codigo_barras && p.codigo_barras.indexOf(busqueda) >= 0) ||
            (p.codigo_interno && p.codigo_interno.toLowerCase().indexOf(busqueda) >= 0);
        return matchCat && matchBusq;
    });

    var tbody = document.getElementById('tbodyProductos');
    if (prods.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:#9ca3af">No hay productos</td></tr>';
        return;
    }

    tbody.innerHTML = prods.map(function(p) {
        var precioVal = parseFloat(p['precio' + tipoPrecio] || p.precio1) || 0;
        var unidad = p.unidad_venta || 'PZ';
        var esGranel = unidad === 'KG' || unidad === 'GR' || unidad === 'LT' || unidad === 'ML' || unidad === 'MT';
        
        return '<tr>' +
            '<td><img src="' + (p.imagen_url || 'https://via.placeholder.com/44?text=P') + '" class="producto-img" onerror="this.src=\'https://via.placeholder.com/44?text=P\'"></td>' +
            '<td>' + (p.codigo_barras || p.codigo_interno || '-') + '</td>' +
            '<td><strong>' + (p.nombre_pos || p.nombre_corto || p.nombre) + '</strong></td>' +
            '<td><span class="badge-unidad ' + (esGranel ? 'granel' : '') + '">' + unidad + '</span></td>' +
            '<td class="text-right"><strong>$' + precioVal.toFixed(2) + '</strong></td>' +
            '<td>' +
                '<button class="btn btn-sm btn-success" onclick="agregarDesdeModal(\'' + p.producto_id + '\')">' +
                    '<i class="fas fa-plus"></i> Agregar' +
                '</button>' +
            '</td>' +
        '</tr>';
    }).join('');
}

function agregarDesdeModal(productoId) {
    var prod = productos.find(function(p) { return p.producto_id === productoId; });
    if (prod) {
        verificarYAgregar(prod);
        cerrarModal('modalBusqueda');
    }
}

// ============ VERIFICAR SI ES GRANEL ============
function verificarYAgregar(prod) {
    var unidad = prod.unidad_venta || 'PZ';
    var esGranel = unidad === 'KG' || unidad === 'GR' || unidad === 'LT' || unidad === 'ML' || unidad === 'MT';
    
    if (esGranel) {
        abrirModalCantidad(prod);
    } else {
        agregarAlCarrito(prod.producto_id, 1);
    }
}

// ============ MODAL CANTIDAD (GRANEL) ============
function abrirModalCantidad(prod) {
    productoParaCantidad = prod;
    var precio = parseFloat(prod['precio' + tipoPrecio] || prod.precio1) || 0;
    var unidad = prod.unidad_venta || 'PZ';
    
    document.getElementById('cantidadProductoId').value = prod.producto_id;
    document.getElementById('cantidadTitulo').textContent = 'Cantidad en ' + unidad;
    document.getElementById('cantidadNombre').textContent = prod.nombre_pos || prod.nombre;
    document.getElementById('cantidadPrecio').textContent = '$' + precio.toFixed(2) + ' / ' + unidad;
    document.getElementById('cantidadUnidad').textContent = unidad;
    document.getElementById('inputCantidadModal').value = '1';
    
    var imgEl = document.getElementById('cantidadImagen');
    imgEl.src = prod.imagen_url || 'https://via.placeholder.com/60?text=P';
    
    // Presets según unidad
    var presets = '';
    if (unidad === 'KG') {
        presets = '<button onclick="setCantidadPreset(0.25)">250g</button>' +
                  '<button onclick="setCantidadPreset(0.5)">500g</button>' +
                  '<button onclick="setCantidadPreset(1)">1 KG</button>' +
                  '<button onclick="setCantidadPreset(2)">2 KG</button>' +
                  '<button onclick="setCantidadPreset(5)">5 KG</button>';
    } else if (unidad === 'GR') {
        presets = '<button onclick="setCantidadPreset(100)">100g</button>' +
                  '<button onclick="setCantidadPreset(250)">250g</button>' +
                  '<button onclick="setCantidadPreset(500)">500g</button>' +
                  '<button onclick="setCantidadPreset(1000)">1000g</button>';
    } else if (unidad === 'LT') {
        presets = '<button onclick="setCantidadPreset(0.5)">500ml</button>' +
                  '<button onclick="setCantidadPreset(1)">1 LT</button>' +
                  '<button onclick="setCantidadPreset(2)">2 LT</button>' +
                  '<button onclick="setCantidadPreset(5)">5 LT</button>';
    } else if (unidad === 'MT') {
        presets = '<button onclick="setCantidadPreset(0.5)">50cm</button>' +
                  '<button onclick="setCantidadPreset(1)">1 MT</button>' +
                  '<button onclick="setCantidadPreset(2)">2 MT</button>' +
                  '<button onclick="setCantidadPreset(5)">5 MT</button>';
    } else {
        presets = '<button onclick="setCantidadPreset(1)">1</button>' +
                  '<button onclick="setCantidadPreset(2)">2</button>' +
                  '<button onclick="setCantidadPreset(5)">5</button>' +
                  '<button onclick="setCantidadPreset(10)">10</button>';
    }
    document.getElementById('cantidadPresets').innerHTML = presets;
    
    calcularSubtotalModal();
    abrirModal('modalCantidad');
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
    var unidad = productoParaCantidad ? productoParaCantidad.unidad_venta : 'PZ';
    
    // Incremento según unidad
    var incremento = 1;
    if (unidad === 'KG' || unidad === 'LT' || unidad === 'MT') incremento = 0.1;
    if (unidad === 'GR' || unidad === 'ML') incremento = 50;
    
    val = Math.max(0.001, val + (delta * incremento));
    input.value = val.toFixed(unidad === 'GR' || unidad === 'ML' ? 0 : 3);
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
    agregarAlCarrito(productoParaCantidad.producto_id, cantidad);
    cerrarModal('modalCantidad');
    productoParaCantidad = null;
}

// ============ MODAL CLIENTE ============
function abrirModalCliente() {
    document.getElementById('buscarCliente').value = '';
    filtrarClientes();
    abrirModal('modalCliente');
    setTimeout(function() {
        document.getElementById('buscarCliente').focus();
    }, 100);
}

function filtrarClientes() {
    var busqueda = (document.getElementById('buscarCliente').value || '').toLowerCase();
    var lista = document.getElementById('listaClientes');
    
    var filtrados = clientes.filter(function(c) {
        if (c.activo !== 'Y') return false;
        return !busqueda || 
            c.nombre.toLowerCase().indexOf(busqueda) >= 0 ||
            (c.telefono && c.telefono.indexOf(busqueda) >= 0) ||
            (c.rfc && c.rfc.toLowerCase().indexOf(busqueda) >= 0);
    });
    
    if (filtrados.length === 0) {
        lista.innerHTML = '<div class="cliente-empty"><i class="fas fa-user-slash"></i><p>No se encontraron clientes</p></div>';
        return;
    }
    
    lista.innerHTML = filtrados.map(function(c) {
        var tipoP = c.tipo_precio || 1;
        return '<div class="cliente-item" onclick="seleccionarCliente(\'' + c.cliente_id + '\')">' +
            '<div class="cliente-avatar">' + c.nombre.charAt(0).toUpperCase() + '</div>' +
            '<div class="cliente-data">' +
                '<strong>' + c.nombre + '</strong>' +
                '<span>' + (c.telefono || '') + ' ' + (c.rfc ? '• ' + c.rfc : '') + '</span>' +
            '</div>' +
            '<div class="cliente-precio">P' + tipoP + '</div>' +
        '</div>';
    }).join('');
}

function seleccionarCliente(clienteId) {
    if (!clienteId) {
        // Público General
        clienteSeleccionado = null;
        tipoPrecio = 1;
        document.getElementById('clienteNombre').textContent = 'Público General';
        document.getElementById('clientePrecio').textContent = 'Precio 1';
    } else {
        var cliente = clientes.find(function(c) { return c.cliente_id === clienteId; });
        if (cliente) {
            clienteSeleccionado = cliente;
            tipoPrecio = parseInt(cliente.tipo_precio) || 1;
            document.getElementById('clienteNombre').textContent = cliente.nombre;
            document.getElementById('clientePrecio').textContent = 'Precio ' + tipoPrecio;
            
            // Actualizar precios en carrito
            actualizarPreciosCarrito();
        }
    }
    cerrarModal('modalCliente');
    actualizarTotales();
    mostrarToast('Cliente: ' + (clienteSeleccionado ? clienteSeleccionado.nombre : 'Público General'));
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

function abrirNuevoCliente() {
    window.open('clientes.html', '_blank');
}

// ============ CARRITO ============
function agregarAlCarrito(productoId, cantidad) {
    cantidad = cantidad || 1;
    var prod = productos.find(function(p) { return p.producto_id === productoId; });
    if (!prod) return;

    var precio = parseFloat(prod['precio' + tipoPrecio] || prod.precio1) || 0;
    var existe = carrito.find(function(item) { return item.producto_id === productoId; });

    if (existe) {
        existe.cantidad += cantidad;
    } else {
        carrito.push({
            producto_id: prod.producto_id,
            nombre: prod.nombre_pos || prod.nombre_corto || prod.nombre,
            imagen: prod.imagen_url,
            precio: precio,
            cantidad: cantidad,
            unidad: prod.unidad_venta || 'PZ'
        });
    }

    renderCarrito();
    mostrarToast((prod.nombre_pos || prod.nombre) + ' agregado');
}

function cambiarCantidad(productoId, delta) {
    var item = carrito.find(function(i) { return i.producto_id === productoId; });
    if (!item) return;
    
    var prod = productos.find(function(p) { return p.producto_id === productoId; });
    var unidad = prod ? prod.unidad_venta : 'PZ';
    var esGranel = unidad === 'KG' || unidad === 'GR' || unidad === 'LT' || unidad === 'ML' || unidad === 'MT';
    
    if (esGranel) {
        // Para granel, abrir modal para editar
        productoParaCantidad = prod;
        document.getElementById('inputCantidadModal').value = item.cantidad;
        abrirModalCantidad(prod);
    } else {
        item.cantidad += delta;
        if (item.cantidad <= 0) {
            carrito = carrito.filter(function(i) { return i.producto_id !== productoId; });
        }
        renderCarrito();
    }
}

function editarCantidad(productoId) {
    var item = carrito.find(function(i) { return i.producto_id === productoId; });
    var prod = productos.find(function(p) { return p.producto_id === productoId; });
    if (item && prod) {
        productoParaCantidad = prod;
        document.getElementById('inputCantidadModal').value = item.cantidad;
        abrirModalCantidad(prod);
    }
}

function eliminarItem(productoId) {
    carrito = carrito.filter(function(i) { return i.producto_id !== productoId; });
    renderCarrito();
}

function renderCarrito() {
    var tbody = document.getElementById('carritoBody');
    var empty = document.getElementById('carritoEmpty');

    if (carrito.length === 0) {
        tbody.innerHTML = '';
        empty.style.display = 'flex';
        document.getElementById('btnCobrar').disabled = true;
    } else {
        empty.style.display = 'none';
        document.getElementById('btnCobrar').disabled = false;

        tbody.innerHTML = carrito.map(function(item) {
            var esGranel = item.unidad === 'KG' || item.unidad === 'GR' || item.unidad === 'LT' || item.unidad === 'ML' || item.unidad === 'MT';
            var cantidadDisplay = esGranel ? item.cantidad.toFixed(3) : item.cantidad;
            
            return '<tr>' +
                '<td class="col-producto">' +
                    '<div class="producto-cell">' +
                        '<img src="' + (item.imagen || 'https://via.placeholder.com/36?text=P') + '" onerror="this.src=\'https://via.placeholder.com/36?text=P\'">' +
                        '<span>' + item.nombre + '</span>' +
                    '</div>' +
                '</td>' +
                '<td class="col-precio">$' + item.precio.toFixed(2) + '</td>' +
                '<td class="col-cantidad">' +
                    (esGranel ? 
                        '<button class="qty-granel" onclick="editarCantidad(\'' + item.producto_id + '\')">' + cantidadDisplay + ' <i class="fas fa-edit"></i></button>' :
                        '<div class="qty-control">' +
                            '<button onclick="cambiarCantidad(\'' + item.producto_id + '\', -1)">−</button>' +
                            '<span>' + cantidadDisplay + '</span>' +
                            '<button onclick="cambiarCantidad(\'' + item.producto_id + '\', 1)">+</button>' +
                        '</div>'
                    ) +
                '</td>' +
                '<td class="col-und">' + item.unidad + '</td>' +
                '<td class="col-importe">$' + (item.precio * item.cantidad).toFixed(2) + '</td>' +
                '<td class="col-acciones">' +
                    '<button class="btn-delete" onclick="eliminarItem(\'' + item.producto_id + '\')"><i class="fas fa-trash"></i></button>' +
                '</td>' +
            '</tr>';
        }).join('');
    }

    actualizarTotales();
}

function actualizarTotales() {
    var articulos = carrito.reduce(function(sum, i) { return sum + i.cantidad; }, 0);
    var subtotal = carrito.reduce(function(sum, i) { return sum + (i.precio * i.cantidad); }, 0);
    var total = subtotal;

    document.getElementById('totalDisplay').textContent = '$' + total.toFixed(2);
    document.getElementById('rArticulos').textContent = articulos.toFixed(2);
    document.getElementById('rSubtotal').textContent = '$' + subtotal.toFixed(2);
    document.getElementById('rDescuentos').textContent = '-$0.00';
    document.getElementById('rTipo').textContent = tipoVenta;
    document.getElementById('rCliente').textContent = clienteSeleccionado ? clienteSeleccionado.nombre : 'Público General';
}

function setTipoVenta(tipo) {
    tipoVenta = tipo;
    document.getElementById('btnContado').classList.toggle('active', tipo === 'CONTADO');
    document.getElementById('btnCredito').classList.toggle('active', tipo === 'CREDITO');
    actualizarTotales();
}

function cancelarVenta() {
    if (carrito.length === 0) return;
    if (confirm('¿Cancelar la venta actual?')) {
        carrito = [];
        clienteSeleccionado = null;
        tipoPrecio = 1;
        document.getElementById('clienteNombre').textContent = 'Público General';
        document.getElementById('clientePrecio').textContent = 'Precio 1';
        renderCarrito();
    }
}

function nuevaVenta() {
    carrito = [];
    clienteSeleccionado = null;
    tipoPrecio = 1;
    document.getElementById('clienteNombre').textContent = 'Público General';
    document.getElementById('clientePrecio').textContent = 'Precio 1';
    renderCarrito();
    document.getElementById('inputBuscar').focus();
}

function aplicarDescuento() {
    mostrarToast('Función de descuento próximamente');
}

function pausarVenta() {
    mostrarToast('Función pausar próximamente');
}

// ============ COBRO ============
function abrirModalCobro() {
    if (carrito.length === 0) return;
    var total = carrito.reduce(function(sum, i) { return sum + (i.precio * i.cantidad); }, 0);
    document.getElementById('cobroTotal').textContent = '$' + total.toFixed(2);
    document.getElementById('cobroTipo').textContent = tipoVenta;
    document.getElementById('cobroCliente').textContent = clienteSeleccionado ? clienteSeleccionado.nombre : 'Público General';
    document.getElementById('inputRecibido').value = '';
    document.getElementById('displayCambio').textContent = '$0.00';
    
    // Reset método de pago
    document.querySelectorAll('#cobroMetodos button').forEach(function(b, i) {
        b.classList.toggle('active', i === 0);
    });
    
    abrirModal('modalCobro');
    setTimeout(function() { document.getElementById('inputRecibido').focus(); }, 100);
}

function seleccionarMetodo(btn) {
    document.querySelectorAll('#cobroMetodos button').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
}

function addEfectivo(monto) {
    var input = document.getElementById('inputRecibido');
    var actual = parseFloat(input.value.replace(/[^0-9.]/g, '')) || 0;
    input.value = (actual + monto).toFixed(2);
    calcularCambio();
}

function setExacto() {
    var total = carrito.reduce(function(sum, i) { return sum + (i.precio * i.cantidad); }, 0);
    document.getElementById('inputRecibido').value = total.toFixed(2);
    calcularCambio();
}

function limpiarEfectivo() {
    document.getElementById('inputRecibido').value = '';
    document.getElementById('displayCambio').textContent = '$0.00';
}

function calcularCambio() {
    var total = carrito.reduce(function(sum, i) { return sum + (i.precio * i.cantidad); }, 0);
    var recibido = parseFloat(document.getElementById('inputRecibido').value.replace(/[^0-9.]/g, '')) || 0;
    var cambio = recibido - total;
    document.getElementById('displayCambio').textContent = '$' + (cambio >= 0 ? cambio.toFixed(2) : '0.00');
}

async function confirmarVenta() {
    var total = carrito.reduce(function(sum, i) { return sum + (i.precio * i.cantidad); }, 0);
    var recibido = parseFloat(document.getElementById('inputRecibido').value.replace(/[^0-9.]/g, '')) || 0;

    if (tipoVenta === 'CONTADO' && recibido < total) {
        mostrarToast('Monto insuficiente', 'error');
        return;
    }

    var venta = {
        empresa_id: API.usuario.empresa_id,
        sucursal_id: API.usuario.sucursal_id || 'DEMO-S1',
        almacen_id: API.usuario.almacen_id || 'DEMO-A1',
        usuario_id: API.usuario.usuario_id,
        cliente_id: clienteSeleccionado ? clienteSeleccionado.cliente_id : null,
        tipo: 'VENTA',
        tipo_venta: tipoVenta,
        tipo_precio: tipoPrecio,
        subtotal: total,
        total: total,
        pagado: recibido,
        cambio: recibido - total,
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

    try {
        var r = await API.request('/ventas', 'POST', venta);
        if (r.success) {
            cerrarModal('modalCobro');
            document.getElementById('exitoTicket').textContent = '#' + (r.folio || r.venta_id || '0001');
            document.getElementById('exitoTotal').textContent = '$' + total.toFixed(2);
            document.getElementById('exitoCambio').textContent = '$' + (recibido - total).toFixed(2);
            abrirModal('modalExito');
        } else {
            mostrarToast('Error: ' + r.error, 'error');
        }
    } catch (e) {
        console.error(e);
        mostrarToast('Error de conexión', 'error');
    }
}

function cerrarExito() {
    cerrarModal('modalExito');
    nuevaVenta();
}

function imprimirTicket() {
    mostrarToast('Imprimiendo ticket...');
}

function mostrarToast(msg, tipo) {
    tipo = tipo || 'success';
    var toast = document.getElementById('toast');
    toast.innerHTML = '<i class="fas fa-' + (tipo === 'error' ? 'exclamation-circle' : 'check-circle') + '"></i> ' + msg;
    toast.className = 'toast show ' + tipo;
    setTimeout(function() { toast.classList.remove('show'); }, 3000);
}
