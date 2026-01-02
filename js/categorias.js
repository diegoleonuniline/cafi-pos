if (!API.isLoggedIn()) window.location.href = '../index.html';

let datos = [];

document.addEventListener('DOMContentLoaded', async () => {
    cargarUsuario();
    await cargarDatos();
    document.getElementById('color').addEventListener('input', (e) => {
        document.getElementById('colorText').value = e.target.value;
    });
});

function cargarUsuario() {
    const u = API.usuario;
    document.getElementById('userName').textContent = u.nombre;
    document.getElementById('userSucursal').textContent = u.sucursal_nombre || 'Sucursal';
    document.getElementById('userAvatar').textContent = u.nombre.charAt(0).toUpperCase();
}

async function cargarDatos() {
    try {
        const r = await API.request(`/categorias/${API.usuario.empresa_id}`);
        if (r.success) {
            datos = r.categorias || r.data || [];
            filtrar();
        }
    } catch (e) {
        mostrarToast('Error cargando datos', 'error');
    }
}

function filtrar() {
    const busqueda = document.getElementById('inputBuscar').value.toLowerCase();
    const estado = document.getElementById('filtroEstado').value;

    let filtrados = datos.filter(item => {
        const matchBusq = !busqueda || item.nombre.toLowerCase().includes(busqueda);
        const matchEstado = !estado || item.activo === estado;
        return matchBusq && matchEstado;
    });

    document.getElementById('totalRegistros').textContent = filtrados.length;
    renderGrid(filtrados);
}

function renderGrid(items) {
    const grid = document.getElementById('categoriasGrid');
    if (items.length === 0) {
        grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;padding:40px;color:#9ca3af">No hay categorías</p>';
        return;
    }

    grid.innerHTML = items.map(c => `
        <div class="categoria-card" onclick="editar('${c.categoria_id}')">
            <div class="color-bar" style="background:${c.color || '#3498db'}"></div>
            <div class="nombre">${c.nombre}</div>
            <div class="info">Orden: ${c.orden || 0}</div>
            <div class="actions">
                <button class="btn-action edit" onclick="event.stopPropagation();editar('${c.categoria_id}')" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-action delete" onclick="event.stopPropagation();eliminar('${c.categoria_id}')" title="Eliminar">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <span class="badge-status ${c.activo === 'Y' ? 'active' : 'inactive'}">
                ${c.activo === 'Y' ? 'Activo' : 'Inactivo'}
            </span>
        </div>
    `).join('');
}

function abrirModal(item = null) {
    document.getElementById('modalTitulo').textContent = item ? 'Editar Categoría' : 'Nueva Categoría';
    document.getElementById('formCategoria').reset();
    document.getElementById('editId').value = '';
    document.getElementById('color').value = '#3498db';
    document.getElementById('colorText').value = '#3498db';

    if (item) {
        document.getElementById('editId').value = item.categoria_id;
        document.getElementById('nombre').value = item.nombre || '';
        document.getElementById('color').value = item.color || '#3498db';
        document.getElementById('colorText').value = item.color || '#3498db';
        document.getElementById('orden').value = item.orden || 0;
    }

    document.getElementById('modalForm').classList.add('active');
}

function cerrarModal() {
    document.getElementById('modalForm').classList.remove('active');
}

function editar(id) {
    const item = datos.find(d => d.categoria_id === id);
    if (item) abrirModal(item);
}

async function guardar(e) {
    e.preventDefault();
    const id = document.getElementById('editId').value;
    const data = {
        empresa_id: API.usuario.empresa_id,
        nombre: document.getElementById('nombre').value,
        color: document.getElementById('color').value,
        orden: parseInt(document.getElementById('orden').value) || 0,
        activo: 'Y'
    };

    try {
        const r = id 
            ? await API.request(`/categorias/${id}`, 'PUT', data)
            : await API.request('/categorias', 'POST', data);

        if (r.success) {
            mostrarToast(id ? 'Categoría actualizada' : 'Categoría creada');
            cerrarModal();
            await cargarDatos();
        } else {
            mostrarToast('Error: ' + r.error, 'error');
        }
    } catch (e) {
        mostrarToast('Error de conexión', 'error');
    }
}

async function eliminar(id) {
    if (!confirm('¿Eliminar esta categoría?')) return;
    try {
        const r = await API.request(`/categorias/${id}`, 'DELETE');
        if (r.success) {
            mostrarToast('Categoría eliminada');
            await cargarDatos();
        } else {
            mostrarToast('Error: ' + r.error, 'error');
        }
    } catch (e) {
        mostrarToast('Error de conexión', 'error');
    }
}

function mostrarToast(msg, tipo = 'success') {
    const toast = document.getElementById('toast');
    toast.innerHTML = `<i class="fas fa-${tipo === 'error' ? 'exclamation-circle' : 'check-circle'}"></i> ${msg}`;
    toast.className = 'toast show ' + tipo;
    setTimeout(() => toast.classList.remove('show'), 3000);
}
