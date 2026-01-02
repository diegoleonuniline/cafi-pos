if (!API.isLoggedIn()) window.location.href = '../index.html';

let productos = [], categorias = [], clientes = [], metodosPago = [];
let carrito = [];
let clienteSeleccionado = null;
let tipoVenta = 'CONTADO';
let tipoPrecio = 1;

document.addEventListener('DOMContentLoaded', async () => {
    cargarUsuario();
    await cargarDatos();
    setupEventos();
});

function cargarUsuario() {
    const u = API.usuario;
    document.getElementById('userName').textContent = u.nombre;
    document.getElementById('userSucursal').textContent = u.sucursal_nombre || 'Sucursal';
    document.getElementById('userAvatar').textContent = u.nombre.charAt(0).toUpperCase();
}

async function cargarDatos() {
    try {
        const r = await API.cargarPOS();
        if (r.success) {
            productos = r.productos || [];
            categorias = r.categorias || [];
            clientes = r.clientes || [];
            metodosPago = r.metodos || [];
            renderCategoriasModal();
            renderMetodosPago();
        }
    } catch (e) {
        console.error(e);
        mostrarToast('Error cargando datos', 'error');
    }
}

function setupEventos() {
    document.getElementById('inputBuscar').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const codigo = e.target.value.trim();
            if (codigo) {
                const prod = productos.find(p => p.codigo_barras === codigo || p.codigo_interno === codigo);
                if (prod) {
                    agregarAlCarrito(prod.producto_id);
                    e.target.value = '';
                } else {
                    mostrarToast('Producto no encontrado', 'error');
                }
            }
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'F2') { e.preventDefault(); abrirModal('modalBusqueda'); }
        if (e.key === 'F4') { e.preventDefault(); cancelarVenta(); }
        if (e.key === 'F12') { e.preventDefault(); if (carrito.length) abrirModalCobro(); }
        if (e.key === 'Escape') cerrarModales();
    });
}

function renderCategoriasModal() {
    const sel = document.getElementById('filtroCategoria');
    sel.innerHTML = '<option value="">Todas</option>';
    categorias.forEach(c => {
        sel.innerHTML += `<option value="${c.categoria_id}">${c.nombre}</option>`;
    });
}

function renderMetodosPago() {
    const cont = document.getElementById('cobroMetodos');
    cont.innerHTML = metodosPago.map((m, i) => `
        <button class="${i === 0 ? 'active' : ''}" data-id="${m.metodo_pago_id}" onclick="seleccionarMetodo(this)">
            <i class="fas fa-${m.nombre.toLowerCase().includes('efectivo') ? 'money-bill-wave' : m.nombre.toLowerCase().includes('tarjeta') ? 'credit-card' : 'exchange-alt'}"></i>
            ${m.nombre}
        </button>
    `).join('');
}

function seleccionarMetodo(btn) {
    document.querySelectorAll('#cobroMetodos button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

function abrirModal(id) {
    document.getElementById(id).classList.add('active');
    if (id === 'modalBusqueda') {
        document.getElementById('buscarProducto').focus();
        renderProductosModal();
    }
}

function cerrarModal(id) {
    document.getElementById(id).classList.remove('active');
}

function cerrarModales() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
}

function filtrarProductos() {
    renderProductosModal();
}

function renderProductosModal() {
    const busqueda = (document.getElementById('buscarProducto')?.value || '').toLowerCase();
    const catId = document.getElementById('filtroCategoria')?.value || '';
    const precio = document.getElementById('precioBusqueda')?.value || '1';

    let prods = productos.filter(p => {
        const matchCat = !catId || p.categoria_id === catId;
        const matchBusq = !busqueda || 
            p.nombre.toLowerCase().includes(busqueda) ||
            (p.codigo_barras && p.codigo_barras.includes(busqueda)) ||
            (p.codigo_interno && p.codigo_interno.toLowerCase().includes(busqueda));
        return matchCat && matchBusq;
    });

    const tbody = document.getElementById('tbodyProductos');
    if (prods.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:#9ca3af">No hay productos</td></tr>';
        return;
    }

    tbody.innerHTML = prods.map(p => {
        const precioVal = parseFloat(p[`precio${precio}`] || p.precio1) || 0;
        const descuento = parseFloat(p.descuento_maximo) || 0;
        return `
        <tr onclick="agregarDesdeModal('${p.producto_id}')">
            <td><img src="${p.imagen_url || 'https://via.placeholder.com/44?text=P'}" class="producto-img" onerror="this.src='https://via.placeholder.com/44?text=P'"></td>
            <td class="col-codigo">${p.codigo_barras || p.codigo_interno || '-'}</td>
            <td class="col-nombre">${p.nombre_pos || p.nombre_corto || p.nombre}</td>
            <td class="col-unidad"><span class="badge-unidad">${p.unidad_venta || 'PZ'}</span></td>
            <td class="col-descuento">${descuento > 0 ? `<span class="badge-descuento"><i class="fas fa-tag"></i> ${descuento}%</span>` : '-'}</td>
            <td class="col-precio">$${precioVal.toFixed(2)}</td>
        </tr>`;
    }).join('');
}

function cambiarCantBusq(delta) {
    const input = document.getElementById('cantBusqueda');
    let val = parseInt(input.value) || 1;
    val = Math.max(1, val + delta);
    input.value = val;
}

function agregarDesdeModal(productoId) {
    const cant = parseInt(document.getElementById('cantBusqueda').value) || 1;
    agregarAlCarrito(productoId, cant);
    cerrarModal('modalBusqueda');
}

function agregarAlCarrito(productoId, cantidad = 1) {
    const prod = productos.find(p => p.producto_id === productoId);
    if (!prod) return;

    const precio = parseFloat(prod[`precio${tipoPrecio}`] || prod.precio1) || 0;
    const existe = carrito.find(item => item.producto_id === productoId);

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
    mostrarToast(`${prod.nombre_pos || prod.nombre} agregado`);
}

function cambiarCantidad(productoId, delta) {
    const item = carrito.find(i => i.producto_id === productoId);
    if (!item) return;
    item.cantidad += delta;
    if (item.cantidad <= 0) {
        carrito = carrito.filter(i => i.producto_id !== productoId);
    }
    renderCarrito();
}

function eliminarItem(productoId) {
    carrito = carrito.filter(i => i.producto_id !== productoId);
    renderCarrito();
}

function renderCarrito() {
    const tbody = document.getElementById('carritoBody');
    const empty = document.getElementById('carritoEmpty');

    if (carrito.length === 0) {
        tbody.innerHTML = '';
        empty.style.display = 'flex';
        document.getElementById('btnCobrar').disabled = true;
    } else {
        empty.style.display = 'none';
        document.getElementById('btnCobrar').disabled = false;

        tbody.innerHTML = carrito.map(item => `
            <tr>
                <td class="col-producto">
                    <div class="producto-cell">
                        <img src="${item.imagen || 'https://via.placeholder.com/36?text=P'}" onerror="this.src='https://via.placeholder.com/36?text=P'">
                        <span>${item.nombre}</span>
                    </div>
                </td>
                <td class="col-precio">$${item.precio.toFixed(2)}</td>
                <td class="col-cantidad">
                    <div class="qty-control">
                        <button onclick="cambiarCantidad('${item.producto_id}', -1)">−</button>
                        <span>${item.cantidad}</span>
                        <button onclick="cambiarCantidad('${item.producto_id}', 1)">+</button>
                    </div>
                </td>
                <td class="col-und">${item.unidad}</td>
                <td class="col-importe">$${(item.precio * item.cantidad).toFixed(2)}</td>
                <td class="col-acciones">
                    <button class="btn-delete" onclick="eliminarItem('${item.producto_id}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
    }

    actualizarTotales();
}

function actualizarTotales() {
    const articulos = carrito.reduce((sum, i) => sum + i.cantidad, 0);
    const subtotal = carrito.reduce((sum, i) => sum + (i.precio * i.cantidad), 0);
    const total = subtotal;

    document.getElementById('totalDisplay').textContent = '$' + total.toFixed(2);
    document.getElementById('rArticulos').textContent = articulos;
    document.getElementById('rSubtotal').textContent = '$' + subtotal.toFixed(2);
    document.getElementById('rDescuentos').textContent = '-$0.00';
    document.getElementById('rTipo').textContent = tipoVenta;
    document.getElementById('rCliente').textContent = clienteSeleccionado?.nombre || 'Público General';
}

function setTipoVenta(tipo) {
    tipoVenta = tipo;
    document.getElementById('btnContado').classList.toggle('active', tipo === 'CONTADO');
    document.getElementById('btnCredito').classList.toggle('active', tipo === 'CREDITO');
    actualizarTotales();
}

function cambiarPrecio() {
    tipoPrecio = parseInt(document.getElementById('tipoPrecio').value);
    carrito.forEach(item => {
        const prod = productos.find(p => p.producto_id === item.producto_id);
        if (prod) item.precio = parseFloat(prod[`precio${tipoPrecio}`] || prod.precio1) || 0;
    });
    renderCarrito();
}

function cancelarVenta() {
    if (carrito.length === 0) return;
    if (confirm('¿Cancelar la venta actual?')) {
        carrito = [];
        clienteSeleccionado = null;
        document.getElementById('clienteNombre').textContent = 'Público General';
        renderCarrito();
    }
}

function nuevaVenta() {
    carrito = [];
    clienteSeleccionado = null;
    document.getElementById('clienteNombre').textContent = 'Público General';
    renderCarrito();
    document.getElementById('inputBuscar').focus();
}

// COBRO
function abrirModalCobro() {
    if (carrito.length === 0) return;
    const total = carrito.reduce((sum, i) => sum + (i.precio * i.cantidad), 0);
    document.getElementById('cobroTotal').textContent = '$' + total.toFixed(2);
    document.getElementById('cobroTipo').textContent = tipoVenta;
    document.getElementById('inputRecibido').value = '';
    document.getElementById('displayCambio').textContent = '$0.00';
    abrirModal('modalCobro');
    setTimeout(() => document.getElementById('inputRecibido').focus(), 100);
}

function addEfectivo(monto) {
    const input = document.getElementById('inputRecibido');
    let actual = parseFloat(input.value.replace(/[^0-9.]/g, '')) || 0;
    input.value = (actual + monto).toFixed(2);
    calcularCambio();
}

function setExacto() {
    const total = carrito.reduce((sum, i) => sum + (i.precio * i.cantidad), 0);
    document.getElementById('inputRecibido').value = total.toFixed(2);
    calcularCambio();
}

function limpiarEfectivo() {
    document.getElementById('inputRecibido').value = '';
    document.getElementById('displayCambio').textContent = '$0.00';
}

function calcularCambio() {
    const total = carrito.reduce((sum, i) => sum + (i.precio * i.cantidad), 0);
    const recibido = parseFloat(document.getElementById('inputRecibido').value.replace(/[^0-9.]/g, '')) || 0;
    const cambio = recibido - total;
    document.getElementById('displayCambio').textContent = '$' + (cambio >= 0 ? cambio.toFixed(2) : '0.00');
}

async function confirmarVenta() {
    const total = carrito.reduce((sum, i) => sum + (i.precio * i.cantidad), 0);
    const recibido = parseFloat(document.getElementById('inputRecibido').value.replace(/[^0-9.]/g, '')) || 0;

    if (tipoVenta === 'CONTADO' && recibido < total) {
        mostrarToast('Monto insuficiente', 'error');
        return;
    }

    const metodoBtn = document.querySelector('#cobroMetodos button.active');
    const metodoId = metodoBtn?.dataset.id || (metodosPago[0]?.metodo_pago_id);

    const venta = {
        empresa_id: API.usuario.empresa_id,
        sucursal_id: API.usuario.sucursal_id,
        almacen_id: API.usuario.almacen_id,
        usuario_id: API.usuario.id,
        cliente_id: clienteSeleccionado?.cliente_id || null,
        total: total,
        items: carrito.map(item => ({
            producto_id: item.producto_id,
            cantidad: item.cantidad,
            precio_unitario: item.precio,
            subtotal: item.precio * item.cantidad
        })),
        pagos: [{
            metodo_pago_id: metodoId,
            monto: total
        }]
    };

    try {
        const r = await API.request('/ventas', 'POST', venta);
        if (r.success) {
            cerrarModal('modalCobro');
            document.getElementById('exitoTicket').textContent = '#' + (r.venta_id || '0001');
            document.getElementById('exitoTotal').textContent = '$' + total.toFixed(2);
            document.getElementById('exitoCambio').textContent = '$' + (recibido - total).toFixed(2);
            abrirModal('modalExito');
        } else {
            mostrarToast('Error: ' + r.error, 'error');
        }
    } catch (e) {
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

function mostrarToast(msg, tipo = 'success') {
    const toast = document.getElementById('toast');
    toast.innerHTML = `<i class="fas fa-${tipo === 'error' ? 'exclamation-circle' : 'check-circle'}"></i> ${msg}`;
    toast.className = 'toast show ' + tipo;
    setTimeout(() => toast.classList.remove('show'), 3000);
}
