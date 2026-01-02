// Verificar sesión
if (!API.isLoggedIn()) {
    window.location.href = '../index.html';
}

// Variables globales
let productos = [];
let categorias = [];
let clientes = [];
let metodosPago = [];
let carrito = [];
let categoriaActual = '';

// Inicializar
document.addEventListener('DOMContentLoaded', async () => {
    cargarUsuario();
    await cargarDatos();
    setupEventos();
});

function cargarUsuario() {
    const u = API.usuario;
    document.getElementById('userName').textContent = u.nombre;
    document.getElementById('userRole').textContent = u.rol;
    document.getElementById('userAvatar').textContent = u.nombre.charAt(0).toUpperCase();
}

async function cargarDatos() {
    try {
        const result = await API.cargarPOS();
        if (result.success) {
            productos = result.productos || [];
            categorias = result.categorias || [];
            clientes = result.clientes || [];
            metodosPago = result.metodos || [];
            
            renderCategorias();
            renderProductos();
            renderClientes();
            renderMetodosPago();
        } else {
            alert('Error cargando datos: ' + result.error);
        }
    } catch (e) {
        alert('Error de conexión');
        console.error(e);
    }
}

function renderCategorias() {
    const container = document.getElementById('categorias');
    container.innerHTML = '<button class="categoria-btn active" data-id="">Todos</button>';
    
    categorias.forEach(c => {
        container.innerHTML += `<button class="categoria-btn" data-id="${c.categoria_id}" style="background:${c.color || '#f0f0f0'}">${c.nombre}</button>`;
    });
}

function renderProductos(filtro = '') {
    const container = document.getElementById('productos');
    const busqueda = filtro.toLowerCase();
    
    let prods = productos.filter(p => {
        const matchCategoria = !categoriaActual || p.categoria_id === categoriaActual;
        const matchBusqueda = !busqueda || 
            p.nombre.toLowerCase().includes(busqueda) ||
            (p.codigo_barras && p.codigo_barras.includes(busqueda)) ||
            (p.codigo_interno && p.codigo_interno.toLowerCase().includes(busqueda));
        return matchCategoria && matchBusqueda;
    });
    
    if (prods.length === 0) {
        container.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#999;">No hay productos</p>';
        return;
    }
    
    container.innerHTML = prods.map(p => `
        <div class="producto-card" onclick="agregarAlCarrito('${p.producto_id}')">
            <div class="producto-nombre">${p.nombre_pos || p.nombre_corto || p.nombre}</div>
            <div class="producto-precio">$${parseFloat(p.precio1).toFixed(2)}</div>
        </div>
    `).join('');
}

function renderClientes() {
    const select = document.getElementById('clienteSelect');
    select.innerHTML = '<option value="">Público en General</option>';
    clientes.forEach(c => {
        select.innerHTML += `<option value="${c.cliente_id}">${c.nombre}</option>`;
    });
}

function renderMetodosPago() {
    const select = document.getElementById('metodoPago');
    select.innerHTML = metodosPago.map(m => 
        `<option value="${m.metodo_pago_id}">${m.nombre}</option>`
    ).join('');
}

function setupEventos() {
    // Categorías
    document.getElementById('categorias').addEventListener('click', (e) => {
        if (e.target.classList.contains('categoria-btn')) {
            document.querySelectorAll('.categoria-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            categoriaActual = e.target.dataset.id;
            renderProductos(document.getElementById('buscar').value);
        }
    });
    
    // Búsqueda
    document.getElementById('buscar').addEventListener('input', (e) => {
        renderProductos(e.target.value);
    });
    
    // Enter en búsqueda (código de barras)
    document.getElementById('buscar').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const codigo = e.target.value.trim();
            const prod = productos.find(p => p.codigo_barras === codigo);
            if (prod) {
                agregarAlCarrito(prod.producto_id);
                e.target.value = '';
                renderProductos();
            }
        }
    });
    
    // Cobrar
    document.getElementById('btnCobrar').addEventListener('click', abrirModalCobro);
    
    // Recibido
    document.getElementById('recibido').addEventListener('input', calcularCambio);
    
    // Confirmar venta
    document.getElementById('btnConfirmarVenta').addEventListener('click', confirmarVenta);
}

function agregarAlCarrito(productoId) {
    const prod = productos.find(p => p.producto_id === productoId);
    if (!prod) return;
    
    const existe = carrito.find(item => item.producto_id === productoId);
    if (existe) {
        existe.cantidad++;
    } else {
        carrito.push({
            producto_id: prod.producto_id,
            nombre: prod.nombre_pos || prod.nombre_corto || prod.nombre,
            precio: parseFloat(prod.precio1),
            cantidad: 1
        });
    }
    
    renderCarrito();
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

function renderCarrito() {
    const container = document.getElementById('carritoItems');
    
    if (carrito.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#999;padding:40px;">Agrega productos</p>';
        document.getElementById('totalVenta').textContent = '$0.00';
        document.getElementById('btnCobrar').disabled = true;
        return;
    }
    
    container.innerHTML = carrito.map(item => `
        <div class="carrito-item">
            <div class="item-info">
                <div class="item-nombre">${item.nombre}</div>
                <div class="item-precio">$${item.precio.toFixed(2)} c/u</div>
            </div>
            <div class="item-cantidad">
                <button class="btn btn-sm" onclick="cambiarCantidad('${item.producto_id}', -1)">-</button>
                <span>${item.cantidad}</span>
                <button class="btn btn-sm" onclick="cambiarCantidad('${item.producto_id}', 1)">+</button>
            </div>
            <div class="item-subtotal">$${(item.precio * item.cantidad).toFixed(2)}</div>
        </div>
    `).join('');
    
    const total = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
    document.getElementById('totalVenta').textContent = '$' + total.toFixed(2);
    document.getElementById('btnCobrar').disabled = false;
}

function abrirModalCobro() {
    if (carrito.length === 0) return;
    
    const total = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
    document.getElementById('modalTotal').textContent = '$' + total.toFixed(2);
    document.getElementById('recibido').value = '';
    document.getElementById('cambio').textContent = '$0.00';
    document.getElementById('modalCobro').classList.add('active');
    document.getElementById('recibido').focus();
}

function cerrarModal() {
    document.getElementById('modalCobro').classList.remove('active');
}

function calcularCambio() {
    const total = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
    const recibido = parseFloat(document.getElementById('recibido').value) || 0;
    const cambio = recibido - total;
    document.getElementById('cambio').textContent = '$' + (cambio >= 0 ? cambio.toFixed(2) : '0.00');
    document.getElementById('cambio').style.color = cambio >= 0 ? '#27ae60' : '#e74c3c';
}

async function confirmarVenta() {
    const total = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
    const recibido = parseFloat(document.getElementById('recibido').value) || 0;
    
    if (recibido < total) {
        alert('El monto recibido es menor al total');
        return;
    }
    
    const venta = {
        empresa_id: API.usuario.empresa_id,
        sucursal_id: API.usuario.sucursal_id,
        almacen_id: API.usuario.almacen_id,
        usuario_id: API.usuario.id,
        cliente_id: document.getElementById('clienteSelect').value || null,
        total: total,
        items: carrito.map(item => ({
            producto_id: item.producto_id,
            cantidad: item.cantidad,
            precio_unitario: item.precio,
            subtotal: item.precio * item.cantidad
        })),
        pagos: [{
            metodo_pago_id: document.getElementById('metodoPago').value,
            monto: total
        }]
    };
    
    try {
        const result = await API.request('/ventas', 'POST', venta);
        if (result.success) {
            alert('✅ Venta registrada!\nCambio: $' + (recibido - total).toFixed(2));
            carrito = [];
            renderCarrito();
            cerrarModal();
        } else {
            alert('Error: ' + result.error);
        }
    } catch (e) {
        alert('Error de conexión');
    }
}
