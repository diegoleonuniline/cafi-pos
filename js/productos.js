if (!API.isLoggedIn()) window.location.href = '../index.html';

let datos = [];
let categorias = [];

document.addEventListener('DOMContentLoaded', async () => {
    cargarUsuario();
    await cargarCategorias();
    await cargarDatos();
});

function cargarUsuario() {
    const u = API.usuario;
    document.getElementById('userName').textContent = u.nombre;
    document.getElementById('userSucursal').textContent = u.sucursal_nombre || 'Sucursal';
    document.getElementById('userAvatar').textContent = u.nombre.charAt(0).toUpperCase();
}

async function cargarCategorias() {
    try {
        const r = await API.request(`/categorias/${API.usuario.empresa_id}`);
        if (r.success) {
            categorias = r.data || [];
            const selFiltro = document.getElementById('filtroCategoria');
            const selForm = document.getElementById('categoria_id');
            categorias.filter(c => c.activo === 'Y').forEach(c => {
                selFiltro.innerHTML += `<option value="${c.categoria_id}">${c.nombre}</option>`;
                selForm.innerHTML += `<option value="${c.categoria_id}">${c.nombre}</option>`;
            });
        }
    } catch (e) { console.error(e); }
}

async function cargarDatos() {
    try {
        const r = await API.request(`/productos/${API.usuario.empresa_id}`);
        if (r.success) {
            datos = r.data || [];
            filtrar();
        }
    } catch (e) {
        mostrarToast('Error cargando datos', 'error');
    }
}

function filtrar() {
    const busqueda = document.getElementById('inputBuscar').value.toLowerCase();
    const categoria = document.getElementById('filtroCategoria').value;
    const estado = document.getElementById('filtroEstado').value;

    let filtrados = datos.filter(item => {
        const matchBusq = !busqueda || 
            item.nombre.toLowerCase().includes(busqueda) ||
            (item.codigo_barras && item.codigo_barras.includes(busqueda)) ||
            (item.codigo_interno && item.codigo_interno.toLowerCase().includes(busqueda));
        const matchCat = !categoria || item.categoria_id === categoria;
        const matchEstado = !estado || item.activo === estado;
        return matchBusq && matchCat && matchEstado;
    });

    document.getElementById('totalRegistros').textContent = filtrados.length;
    renderTabla(filtrados);
}

function renderTabla(items) {
    const tbody = document.getElementById('tablaBody');
    if (items.length === 0) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="10">No hay productos</td></tr>';
        return;
    }

    tbody.innerHTML = items.map(p => `
        <tr>
            <td>${p.codigo_barras || p.codigo_interno || '-'}</td>
            <td><strong>${p.nombre}</strong></td>
            <td>${p.categoria_nombre || '-'}</td>
            <td>${p.unidad_venta || 'PZ'}</td>
            <td class="text-right">$${parseFloat(p.costo || 0).toFixed(2)}</td>
            <td class="text-right">$${parseFloat(p.precio1 || 0).toFixed(2)}</td>
            <td class="text-right">$${parseFloat(p.precio2 || 0).toFixed(2)}</td>
            <td class="text-right">$${parseFloat(p.precio3 || 0).toFixed(2)}</td>
            <td class="text-center">
                <span class="badge-status ${p.activo === 'Y' ? 'active' : 'inactive'}">
                    ${p.activo === 'Y' ? 'Activo' : 'Inactivo'}
                </span>
            </td>
            <td class="text-center">
                <div class="actions-cell">
                    <button class="btn-action edit" onclick="editar('${p.producto_id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-action delete" onclick="eliminar('${p.producto_id}')" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function abrirModal(item = null) {
    document.getElementById('modalTitulo').textContent = item ? 'Editar Producto' : 'Nuevo Producto';
    document.getElementById('formProducto').reset();
    document.getElementById('editId').value = '';
    document.getElementById('permite_descuento').checked = true;
    document.getElementById('es_inventariable').checked = true;
    document.getElementById('es_vendible').checked = true;

    if (item) {
        document.getElementById('editId').value = item.producto_id;
        document.getElementById('nombre').value = item.nombre || '';
        document.getElementById('nombre_corto').value = item.nombre_corto || '';
        document.getElementById('nombre_pos').value = item.nombre_pos || '';
        document.getElementById('codigo_barras').value = item.codigo_barras || '';
        document.getElementById('codigo_interno').value = item.codigo_interno || '';
        document.getElementById('categoria_id').value = item.categoria_id || '';
        document.getElementById('unidad_venta').value = item.unidad_venta || 'PZ';
        document.getElementById('costo').value = item.costo || '';
        document.getElementById('precio1').value = item.precio1 || '';
        document.getElementById('precio2').value = item.precio2 || '';
        document.getElementById('precio3').value = item.precio3 || '';
        document.getElementById('precio4').value = item.precio4 || '';
        document.getElementById('permite_descuento').checked = item.permite_descuento === 'Y';
        document.getElementById('descuento_maximo').value = item.descuento_maximo || '';
        document.getElementById('es_inventariable').checked = item.es_inventariable === 'Y';
        document.getElementById('es_vendible').checked = item.es_vendible === 'Y';
    }

    document.getElementById('modalForm').classList.add('active');
}

function cerrarModal() {
    document.getElementById('modalForm').classList.remove('active');
}

function editar(id) {
    const item = datos.find(d => d.producto_id === id);
    if (item) abrirModal(item);
}

async function guardar(e) {
    e.preventDefault();
    const id = document.getElementById('editId').value;
    const data = {
        empresa_id: API.usuario.empresa_id,
        nombre: document.getElementById('nombre').value,
        nombre_corto: document.getElementById('nombre_corto').value,
        nombre_pos: document.getElementById('nombre_pos').value,
        codigo_barras: document.getElementById('codigo_barras').value,
        codigo_interno: document.getElementById('codigo_interno').value,
        categoria_id: document.getElementById('categoria_id').value || null,
        unidad_venta: document.getElementById('unidad_venta').value,
        costo: parseFloat(document.getElementById('costo').value) || 0,
        precio1: parseFloat(document.getElementById('precio1').value) || 0,
        precio2: parseFloat(document.getElementById('precio2').value) || 0,
        precio3: parseFloat(document.getElementById('precio3').value) || 0,
        precio4: parseFloat(document.getElementById('precio4').value) || 0,
        permite_descuento: document.getElementById('permite_descuento').checked ? 'Y' : 'N',
        descuento_maximo: parseFloat(document.getElementById('descuento_maximo').value) || 0,
        es_inventariable: document.getElementById('es_inventariable').checked ? 'Y' : 'N',
        es_vendible: document.getElementById('es_vendible').checked ? 'Y' : 'N',
        activo: 'Y'
    };

    try {
        const r = id 
            ? await API.request(`/productos/${id}`, 'PUT', data)
            : await API.request('/productos', 'POST', data);

        if (r.success) {
            mostrarToast(id ? 'Producto actualizado' : 'Producto creado');
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
    if (!confirm('¿Eliminar este producto?')) return;
    try {
        const r = await API.request(`/productos/${id}`, 'DELETE');
        if (r.success) {
            mostrarToast('Producto eliminado');
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
