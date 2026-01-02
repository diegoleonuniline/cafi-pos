if (!API.isLoggedIn()) window.location.href = '../index.html';

var datos = [];

document.addEventListener('DOMContentLoaded', async function() {
    cargarUsuario();
    await cargarDatos();
    
    var colorInput = document.getElementById('color');
    if (colorInput) {
        colorInput.addEventListener('input', function(e) {
            document.getElementById('colorText').value = e.target.value;
        });
    }
});

function cargarUsuario() {
    var u = API.usuario;
    document.getElementById('userName').textContent = u.nombre;
    document.getElementById('userSucursal').textContent = u.sucursal_nombre || 'Sucursal';
    document.getElementById('userAvatar').textContent = u.nombre.charAt(0).toUpperCase();
}

async function cargarDatos() {
    try {
        var r = await API.request('/categorias/' + API.usuario.empresa_id);
        console.log('Categorias:', r);
        if (r.success) {
            datos = r.categorias || r.data || [];
            filtrar();
        }
    } catch (e) {
        console.error(e);
        mostrarToast('Error cargando datos', 'error');
    }
}

function filtrar() {
    var busqueda = document.getElementById('inputBuscar').value.toLowerCase();
    var estado = document.getElementById('filtroEstado').value;

    var filtrados = datos.filter(function(item) {
        var matchBusq = !busqueda || item.nombre.toLowerCase().indexOf(busqueda) >= 0;
        var matchEstado = !estado || item.activo === estado;
        return matchBusq && matchEstado;
    });

    document.getElementById('totalRegistros').textContent = filtrados.length;
    renderTabla(filtrados);
}

function renderTabla(items) {
    var tbody = document.getElementById('tablaBody');
    if (items.length === 0) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No hay categorías</td></tr>';
        return;
    }

    var html = '';
    items.forEach(function(c) {
        html += '<tr>' +
            '<td><span class="color-dot" style="background:' + (c.color || '#3498db') + '"></span></td>' +
            '<td><strong>' + c.nombre + '</strong></td>' +
            '<td class="text-center">' + (c.orden || 0) + '</td>' +
            '<td class="text-center">' +
                '<span class="badge-status ' + (c.activo === 'Y' ? 'active' : 'inactive') + '">' +
                    (c.activo === 'Y' ? 'Activo' : 'Inactivo') +
                '</span>' +
            '</td>' +
            '<td class="text-center">' +
                '<div class="actions-cell">' +
                    '<button class="btn-action edit" onclick="editar(\'' + c.categoria_id + '\')" title="Editar">' +
                        '<i class="fas fa-edit"></i>' +
                    '</button>' +
                    '<button class="btn-action delete" onclick="eliminar(\'' + c.categoria_id + '\')" title="Eliminar">' +
                        '<i class="fas fa-trash"></i>' +
                    '</button>' +
                '</div>' +
            '</td>' +
        '</tr>';
    });
    tbody.innerHTML = html;
}

function abrirModal(item) {
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
    var item = datos.find(function(d) { return d.categoria_id === id; });
    if (item) abrirModal(item);
}

async function guardar(e) {
    e.preventDefault();
    var id = document.getElementById('editId').value;
    var data = {
        empresa_id: API.usuario.empresa_id,
        nombre: document.getElementById('nombre').value,
        color: document.getElementById('color').value,
        orden: parseInt(document.getElementById('orden').value) || 0,
        activo: 'Y'
    };

    try {
        var url = id ? '/categorias/' + id : '/categorias';
        var method = id ? 'PUT' : 'POST';
        var r = await API.request(url, method, data);

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
        var r = await API.request('/categorias/' + id, 'DELETE');
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

function mostrarToast(msg, tipo) {
    tipo = tipo || 'success';
    var toast = document.getElementById('toast');
    toast.innerHTML = '<i class="fas fa-' + (tipo === 'error' ? 'exclamation-circle' : 'check-circle') + '"></i> ' + msg;
    toast.className = 'toast show ' + tipo;
    setTimeout(function() { toast.classList.remove('show'); }, 3000);
}
