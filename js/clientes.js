if (!API.isLoggedIn()) window.location.href = '../index.html';

let datos = [];

document.addEventListener('DOMContentLoaded', async function() {
    cargarUsuario();
    await cargarDatos();
});

function cargarUsuario() {
    var u = API.usuario;
    document.getElementById('userName').textContent = u.nombre;
    document.getElementById('userSucursal').textContent = u.sucursal_nombre || 'Sucursal';
    document.getElementById('userAvatar').textContent = u.nombre.charAt(0).toUpperCase();
}

async function cargarDatos() {
    try {
        var r = await API.request('/clientes/' + API.usuario.empresa_id);
        console.log('Clientes:', r);
        if (r.success) {
            datos = r.data || [];
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
        var matchBusq = !busqueda || 
            item.nombre.toLowerCase().indexOf(busqueda) >= 0 ||
            (item.telefono && item.telefono.indexOf(busqueda) >= 0) ||
            (item.email && item.email.toLowerCase().indexOf(busqueda) >= 0);
        var matchEstado = !estado || item.activo === estado;
        return matchBusq && matchEstado;
    });

    document.getElementById('totalRegistros').textContent = filtrados.length;
    renderTabla(filtrados);
}

function renderTabla(items) {
    var tbody = document.getElementById('tablaBody');
    if (items.length === 0) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="9">No hay clientes</td></tr>';
        return;
    }

    var html = '';
    items.forEach(function(c) {
        html += '<tr>' +
            '<td><strong>' + c.nombre + '</strong></td>' +
            '<td>' + (c.telefono || '-') + '</td>' +
            '<td>' + (c.email || '-') + '</td>' +
            '<td>' + (c.rfc || '-') + '</td>' +
            '<td class="text-center">P' + (c.tipo_precio || 1) + '</td>' +
            '<td class="text-center">' + (c.permite_credito === 'Y' ? '<i class="fas fa-check" style="color:#10b981"></i>' : '<i class="fas fa-times" style="color:#ef4444"></i>') + '</td>' +
            '<td class="text-right">$' + parseFloat(c.limite_credito || 0).toFixed(2) + '</td>' +
            '<td class="text-center">' +
                '<span class="badge-status ' + (c.activo === 'Y' ? 'active' : 'inactive') + '">' +
                    (c.activo === 'Y' ? 'Activo' : 'Inactivo') +
                '</span>' +
            '</td>' +
            '<td class="text-center">' +
                '<div class="actions-cell">' +
                    '<button class="btn-action edit" onclick="editar(\'' + c.cliente_id + '\')" title="Editar">' +
                        '<i class="fas fa-edit"></i>' +
                    '</button>' +
                    '<button class="btn-action delete" onclick="eliminar(\'' + c.cliente_id + '\')" title="Eliminar">' +
                        '<i class="fas fa-trash"></i>' +
                    '</button>' +
                '</div>' +
            '</td>' +
        '</tr>';
    });
    tbody.innerHTML = html;
}

function toggleCredito() {
    var grupo = document.getElementById('grupoLimite');
    if (grupo) {
        grupo.style.display = document.getElementById('permite_credito').checked ? 'block' : 'none';
    }
}

function abrirModal(item) {
    document.getElementById('modalTitulo').textContent = item ? 'Editar Cliente' : 'Nuevo Cliente';
    document.getElementById('formCliente').reset();
    document.getElementById('editId').value = '';
    var grupo = document.getElementById('grupoLimite');
    if (grupo) grupo.style.display = 'none';

    if (item) {
        document.getElementById('editId').value = item.cliente_id;
        document.getElementById('nombre').value = item.nombre || '';
        document.getElementById('telefono').value = item.telefono || '';
        document.getElementById('email').value = item.email || '';
        document.getElementById('direccion').value = item.direccion || '';
        document.getElementById('rfc').value = item.rfc || '';
        
        var tipoPrecio = item.tipo_precio || 1;
        var radioTipo = document.querySelector('input[name="tipo_precio"][value="' + tipoPrecio + '"]');
        if (radioTipo) radioTipo.checked = true;
        
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
    var item = datos.find(function(d) { return d.cliente_id === id; });
    if (item) abrirModal(item);
}

async function guardar(e) {
    e.preventDefault();
    var id = document.getElementById('editId').value;
    var tipoPrecioRadio = document.querySelector('input[name="tipo_precio"]:checked');
    
    var data = {
        empresa_id: API.usuario.empresa_id,
        nombre: document.getElementById('nombre').value,
        telefono: document.getElementById('telefono').value || null,
        email: document.getElementById('email').value || null,
        direccion: document.getElementById('direccion').value || null,
        rfc: document.getElementById('rfc').value || null,
        tipo_precio: tipoPrecioRadio ? tipoPrecioRadio.value : 1,
        permite_credito: document.getElementById('permite_credito').checked ? 'Y' : 'N',
        limite_credito: parseFloat(document.getElementById('limite_credito').value) || 0,
        activo: 'Y'
    };

    try {
        var url = id ? '/clientes/' + id : '/clientes';
        var method = id ? 'PUT' : 'POST';
        var r = await API.request(url, method, data);

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
        var r = await API.request('/clientes/' + id, 'DELETE');
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

function mostrarToast(msg, tipo) {
    tipo = tipo || 'success';
    var toast = document.getElementById('toast');
    toast.innerHTML = '<i class="fas fa-' + (tipo === 'error' ? 'exclamation-circle' : 'check-circle') + '"></i> ' + msg;
    toast.className = 'toast show ' + tipo;
    setTimeout(function() { toast.classList.remove('show'); }, 3000);
}
