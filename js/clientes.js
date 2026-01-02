if (!API.isLoggedIn()) window.location.href = '../index.html';

let datos = [];

document.addEventListener('DOMContentLoaded', async () => {
    cargarUsuario();
    await cargarDatos();
});

function cargarUsuario() {
    const u = API.usuario;
    document.getElementById('userName').textContent = u.nombre;
    document.getElementById('userSucursal').textContent = u.sucursal_nombre || 'Sucursal';
    document.getElementById('userAvatar').textContent = u.nombre.charAt(0).toUpperCase();
}

async function cargarDatos() {
    try {
        const r = await API.request(`/clientes/${API.usuario.empresa_id}`);
        if (r.success) {
            datos = r.clientes || r.data || [];
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
        const matchBusq = !busqueda || 
            item.nombre.toLowerCase().includes(busqueda) ||
            (item.telefono && item.telefono.includes(busqueda)) ||
            (item.email && item.email.toLowerCase().includes(busqueda));
        const matchEstado = !estado || item.activo === estado;
        return matchBusq && matchEstado;
    });

    document.getElementById('totalRegistros').textContent = filtrados.length;
    renderTabla(filtrados);
}

function renderTabla(items) {
    const tbody = document.getElementById('tablaBody');
    if (items.length === 0) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="9">No hay clientes</td></tr>';
        return;
    }

    tbody.innerHTML = items.map(c => `
        <tr>
            <td><strong>${c.nombre}</strong></td>
            <td>${c.telefono || '-'}</td>
            <td>${c.email || '-'}</td>
            <td>${c.rfc || '-'}</td>
            <td class="text-center">P${c.tipo_precio || 1}</td>
            <td class="text-center">${c.permite_credito === 'Y' ? '<i class="fas fa-check text-success"></i>' : '<i class="fas fa-times text-danger"></i>'}</td>
            <td class="text-right">$${parseFloat(c.limite_credito || 0).toFixed(2)}</td>
            <td class="text-center">
                <span class="badge-status ${c.activo === 'Y' ? 'active' : 'inactive'}">
                    ${c.activo === 'Y' ? 'Activo' : 'Inactivo'}
                </span>
            </td>
            <td class="text-center">
                <div class="actions-cell">
                    <button class="btn-action edit" onclick="editar('${c.cliente_id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-action delete" onclick="eliminar('${c.cliente_id}')" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function toggleCredito() {
    document.getElementById('grupoLimite').style.display = 
        document.getElementById('permite_credito').checked ? 'block' : 'none';
}

function abrirModal(item = null) {
    document.getElementById('modalTitulo').textContent = item ? 'Editar Cliente' : 'Nuevo Cliente';
    document.getElementById('formCliente').reset();
    document.getElementById('editId').value = '';
    document.getElementById('grupoLimite').style.display = 'none';

    if (item) {
        document.getElementById('editId').value = item.cliente_id;
        document.getElementById('nombre').value = item.nombre || '';
        document.getElementById('telefono').value = item.telefono || '';
        document.getElementById('email').value = item.email || '';
        document.getElementById('direccion').value = item.direccion || '';
        document.getElementById('rfc').value = item.rfc || '';
        document.querySelector(`input[name="tipo_precio"][value="${item.tipo_precio || 1}"]`).checked = true;
        document.getElementById('permite_credito').checked = item.permite_credito === 'Y';
        document.getElementById('limite_credito').value = item.limite_credito || '';
        toggleCredito();
    }

    document.getElementById('modalForm').classList.add('active');
}

function cerrarModal() {
    document.getElementById('modalForm').classList.remove('active');
}

function editar(id) {
    const item = datos.find(d => d.cliente_id === id);
    if (item) abrirModal(item);
}

async function guardar(e) {
    e.preventDefault();
    const id = document.getElementById('editId').value;
    const data = {
        empresa_id: API.usuario.empresa_id,
        nombre: document.getElementById('nombre').value,
        telefono: document.getElementById('telefono').value,
        email: document.getElementById('email').value,
        direccion: document.getElementById('direccion').value,
        rfc: document.getElementById('rfc').value,
        tipo_precio: document.querySelector('input[name="tipo_precio"]:checked').value,
        permite_credito: document.getElementById('permite_credito').checked ? 'Y' : 'N',
        limite_credito: parseFloat(document.getElementById('limite_credito').value) || 0,
        activo: 'Y'
    };

    try {
        const r = id 
            ? await API.request(`/clientes/${id}`, 'PUT', data)
            : await API.request('/clientes', 'POST', data);

        if (r.success) {
            mostrarToast(id ? 'Cliente actualizado' : 'Cliente creado');
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
    if (!confirm('¿Eliminar este cliente?')) return;
    try {
        const r = await API.request(`/clientes/${id}`, 'DELETE');
        if (r.success) {
            mostrarToast('Cliente eliminado');
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
