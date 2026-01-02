if (!API.isLoggedIn()) window.location.href = '../index.html';

let datos = [];
let categorias = [];

document.addEventListener('DOMContentLoaded', async () => {
    cargarUsuario();
    await cargarCategorias();
    await cargarDatos();
    setupTabs();
    setupEventos();
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

function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
        });
    });
}

function setupEventos() {
    // Radio cards IVA
    document.querySelectorAll('input[name="iva"]').forEach(radio => {
        radio.addEventListener('change', () => {
            document.querySelectorAll('.radio-card').forEach(c => c.classList.remove('active'));
            radio.closest('.radio-card').classList.add('active');
            calcularImpuestos();
        });
    });

    // Imagen preview
    document.getElementById('imagen_url').addEventListener('input', (e) => {
        const preview = document.getElementById('imgPreview');
        if (e.target.value) {
            preview.innerHTML = `<img src="${e.target.value}" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-image\\'></i>'">`;
        } else {
            preview.innerHTML = '<i class="fas fa-image"></i>';
        }
    });

    // Color picker sync
    document.getElementById('color_pos').addEventListener('input', (e) => {
        document.getElementById('color_pos_text').value = e.target.value;
    });

    // Caducidad toggle
    document.getElementById('maneja_caducidad').addEventListener('change', (e) => {
        document.getElementById('rowCaducidad').style.display = e.target.checked ? 'flex' : 'none';
    });

    // Impuestos
    document.getElementById('ieps').addEventListener('input', calcularImpuestos);
    document.getElementById('precio_incluye_impuesto').addEventListener('change', calcularImpuestos);
    document.getElementById('precio1').addEventListener('input', calcularImpuestos);
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
        tbody.innerHTML = '<tr class="empty-row"><td colspan="11">No hay productos</td></tr>';
        return;
    }

    tbody.innerHTML = items.map(p => {
        const iva = p.impuesto_id ? '16%' : '0%';
        return `
        <tr>
            <td>${p.codigo_barras || p.codigo_interno || '-'}</td>
            <td><strong>${p.nombre}</strong></td>
            <td>${p.categoria_nombre || '-'}</td>
            <td class="text-center">${p.unidad_compra || 'PZ'}</td>
            <td class="text-center">${p.unidad_venta || 'PZ'}</td>
            <td class="text-center">${parseFloat(p.factor_conversion || 1)}</td>
            <td class="text-right">$${parseFloat(p.costo || 0).toFixed(2)}</td>
            <td class="text-right">$${parseFloat(p.precio1 || 0).toFixed(2)}</td>
            <td class="text-center">${iva}</td>
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
        </tr>`;
    }).join('');
}

function actualizarConversion() {
    const uCompra = document.getElementById('unidad_compra').value;
    const uVenta = document.getElementById('unidad_venta').value;
    const factor = document.getElementById('factor_conversion').value || 1;

    document.getElementById('convUCompra').textContent = uCompra;
    document.getElementById('convUVenta').textContent = uVenta;
    document.getElementById('convFactor').textContent = factor;
}

function calcularCostoUnitario() {
    const costoCompra = parseFloat(document.getElementById('costo_compra').value) || 0;
    const factor = parseFloat(document.getElementById('factor_conversion').value) || 1;
    const costoUnitario = factor > 0 ? costoCompra / factor : 0;

    document.getElementById('costo').value = costoUnitario.toFixed(4);
    document.getElementById('costoFormula').textContent = `$${costoCompra.toFixed(2)} ÷ ${factor} = $${costoUnitario.toFixed(2)}`;

    calcularMargen(1);
    calcularMargen(2);
    calcularMargen(3);
    calcularMargen(4);
}

function calcularMargen(num) {
    const costo = parseFloat(document.getElementById('costo').value) || 0;
    const precio = parseFloat(document.getElementById('precio' + num).value) || 0;
    const badge = document.getElementById('margen' + num);

    if (costo > 0 && precio > 0) {
        const margen = ((precio - costo) / costo) * 100;
        badge.textContent = `Margen: ${margen.toFixed(1)}%`;
        badge.className = 'margin-badge ' + (margen >= 0 ? 'positive' : 'negative');
    } else {
        badge.textContent = 'Margen: --%';
        badge.className = 'margin-badge';
    }

    if (num === 1) calcularImpuestos();
}

function calcularImpuestos() {
    const precio1 = parseFloat(document.getElementById('precio1').value) || 0;
    const iva = parseFloat(document.querySelector('input[name="iva"]:checked')?.value) || 0;
    const ieps = parseFloat(document.getElementById('ieps').value) || 0;
    const incluyeImp = document.getElementById('precio_incluye_impuesto').checked;

    let precioBase, ivaAmt, iepsAmt, total;

    if (incluyeImp) {
        const factorImp = 1 + (iva / 100) + (ieps / 100);
        precioBase = precio1 / factorImp;
        ivaAmt = precioBase * (iva / 100);
        iepsAmt = precioBase * (ieps / 100);
        total = precio1;
    } else {
        precioBase = precio1;
        ivaAmt = precioBase * (iva / 100);
        iepsAmt = precioBase * (ieps / 100);
        total = precioBase + ivaAmt + iepsAmt;
    }

    document.getElementById('ivaPercent').textContent = iva;
    document.getElementById('iepsPercent').textContent = ieps;
    document.getElementById('precioSinImp').textContent = '$' + precioBase.toFixed(2);
    document.getElementById('ivaAmount').textContent = '$' + ivaAmt.toFixed(2);
    document.getElementById('iepsAmount').textContent = '$' + iepsAmt.toFixed(2);
    document.getElementById('precioFinal').textContent = '$' + total.toFixed(2);
}

function abrirModal(item = null) {
    document.getElementById('modalTitulo').textContent = item ? 'Editar Producto' : 'Nuevo Producto';
    document.getElementById('formProducto').reset();
    document.getElementById('editId').value = '';

    // Reset tabs
    document.querySelectorAll('.tab-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
    document.querySelectorAll('.tab-content').forEach((c, i) => c.classList.toggle('active', i === 0));

    // Defaults
    document.getElementById('factor_conversion').value = 1;
    document.getElementById('descuento_maximo').value = 100;
    document.getElementById('es_inventariable').checked = true;
    document.getElementById('es_vendible').checked = true;
    document.getElementById('es_comprable').checked = true;
    document.getElementById('mostrar_pos').checked = true;
    document.getElementById('permite_descuento').checked = true;
    document.getElementById('precio_incluye_impuesto').checked = true;
    document.querySelector('input[name="iva"][value="16"]').checked = true;
    document.querySelectorAll('.radio-card').forEach(c => c.classList.remove('active'));
    document.querySelector('input[name="iva"][value="16"]').closest('.radio-card').classList.add('active');

    if (item) {
        document.getElementById('editId').value = item.producto_id;
        
        // General
        document.getElementById('nombre').value = item.nombre || '';
        document.getElementById('nombre_corto').value = item.nombre_corto || '';
        document.getElementById('nombre_pos').value = item.nombre_pos || '';
        document.getElementById('nombre_ticket').value = item.nombre_ticket || '';
        document.getElementById('codigo_barras').value = item.codigo_barras || '';
        document.getElementById('codigo_interno').value = item.codigo_interno || '';
        document.getElementById('codigo_sat').value = item.codigo_sat || '';
        document.getElementById('categoria_id').value = item.categoria_id || '';
        document.getElementById('descripcion').value = item.descripcion || '';
        document.getElementById('tipo').value = item.tipo || 'PRODUCTO';
        document.getElementById('imagen_url').value = item.imagen_url || '';

        // Unidades
        document.getElementById('unidad_compra').value = item.unidad_compra || 'PZ';
        document.getElementById('unidad_venta').value = item.unidad_venta || 'PZ';
        document.getElementById('factor_conversion').value = item.factor_conversion || 1;
        document.getElementById('unidad_inventario_id').value = item.unidad_inventario_id || 'PZ';
        document.getElementById('factor_venta').value = item.factor_venta || 1;

        // Precios
        document.getElementById('costo_compra').value = item.costo_compra || '';
        document.getElementById('costo').value = item.costo || '';
        document.getElementById('precio1').value = item.precio1 || '';
        document.getElementById('precio2').value = item.precio2 || '';
        document.getElementById('precio3').value = item.precio3 || '';
        document.getElementById('precio4').value = item.precio4 || '';
        document.getElementById('precio_minimo').value = item.precio_minimo || '';
        document.getElementById('ultimo_costo').value = item.ultimo_costo || '';
        document.getElementById('costo_promedio').value = item.costo_promedio || '';

        // Impuestos - determinar IVA
        let ivaVal = '16';
        if (item.impuesto_id === 'IVA0' || item.iva == 0) ivaVal = '0';
        else if (item.impuesto_id === 'IVA8' || item.iva == 8) ivaVal = '8';
        document.querySelector(`input[name="iva"][value="${ivaVal}"]`).checked = true;
        document.querySelectorAll('.radio-card').forEach(c => c.classList.remove('active'));
        document.querySelector(`input[name="iva"][value="${ivaVal}"]`).closest('.radio-card').classList.add('active');
        document.getElementById('ieps').value = item.ieps || 0;
        document.getElementById('precio_incluye_impuesto').checked = item.precio_incluye_impuesto === 'Y';

        // Inventario
        document.getElementById('stock_minimo').value = item.stock_minimo || '';
        document.getElementById('stock_maximo').value = item.stock_maximo || '';
        document.getElementById('punto_reorden').value = item.punto_reorden || '';
        document.getElementById('ubicacion_almacen').value = item.ubicacion_almacen || '';
        document.getElementById('maneja_lotes').checked = item.maneja_lotes === 'Y';
        document.getElementById('maneja_caducidad').checked = item.maneja_caducidad === 'Y';
        document.getElementById('maneja_series').checked = item.maneja_series === 'Y';
        document.getElementById('dias_caducidad').value = item.dias_caducidad || '';
        document.getElementById('rowCaducidad').style.display = item.maneja_caducidad === 'Y' ? 'flex' : 'none';

        // Config
        document.getElementById('es_inventariable').checked = item.es_inventariable !== 'N';
        document.getElementById('es_vendible').checked = item.es_vendible !== 'N';
        document.getElementById('es_comprable').checked = item.es_comprable !== 'N';
        document.getElementById('mostrar_pos').checked = item.mostrar_pos !== 'N';
        document.getElementById('permite_descuento').checked = item.permite_descuento !== 'N';
        document.getElementById('descuento_maximo').value = item.descuento_maximo || 100;
        document.getElementById('color_pos').value = item.color_pos || '#3498db';
        document.getElementById('color_pos_text').value = item.color_pos || '#3498db';
        document.getElementById('orden_pos').value = item.orden_pos || 0;
        document.getElementById('tecla_rapida').value = item.tecla_rapida || '';
        document.getElementById('notas_internas').value = item.notas_internas || '';

        // Update previews
        actualizarConversion();
        calcularMargen(1);
        calcularMargen(2);
        calcularMargen(3);
        calcularMargen(4);
        calcularImpuestos();

        if (item.imagen_url) {
            document.getElementById('imgPreview').innerHTML = `<img src="${item.imagen_url}" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-image\\'></i>'">`;
        }
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
    const ivaVal = document.querySelector('input[name="iva"]:checked').value;

    const data = {
        empresa_id: API.usuario.empresa_id,
        nombre: document.getElementById('nombre').value,
        nombre_corto: document.getElementById('nombre_corto').value || null,
        nombre_pos: document.getElementById('nombre_pos').value || null,
        nombre_ticket: document.getElementById('nombre_ticket').value || null,
        codigo_barras: document.getElementById('codigo_barras').value || null,
        codigo_interno: document.getElementById('codigo_interno').value || null,
        codigo_sat: document.getElementById('codigo_sat').value || null,
        categoria_id: document.getElementById('categoria_id').value || null,
        descripcion: document.getElementById('descripcion').value || null,
        tipo: document.getElementById('tipo').value,
        imagen_url: document.getElementById('imagen_url').value || null,

        unidad_compra: document.getElementById('unidad_compra').value,
        unidad_venta: document.getElementById('unidad_venta').value,
        factor_conversion: parseFloat(document.getElementById('factor_conversion').value) || 1,
        unidad_inventario_id: document.getElementById('unidad_inventario_id').value,
        factor_venta: parseFloat(document.getElementById('factor_venta').value) || 1,

        costo_compra: parseFloat(document.getElementById('costo_compra').value) || 0,
        costo: parseFloat(document.getElementById('costo').value) || 0,
        precio1: parseFloat(document.getElementById('precio1').value) || 0,
        precio2: parseFloat(document.getElementById('precio2').value) || 0,
        precio3: parseFloat(document.getElementById('precio3').value) || 0,
        precio4: parseFloat(document.getElementById('precio4').value) || 0,
        precio_minimo: parseFloat(document.getElementById('precio_minimo').value) || 0,

        iva: parseFloat(ivaVal),
        ieps: parseFloat(document.getElementById('ieps').value) || 0,
        precio_incluye_impuesto: document.getElementById('precio_incluye_impuesto').checked ? 'Y' : 'N',

        stock_minimo: parseFloat(document.getElementById('stock_minimo').value) || 0,
        stock_maximo: parseFloat(document.getElementById('stock_maximo').value) || 0,
        punto_reorden: parseFloat(document.getElementById('punto_reorden').value) || 0,
        ubicacion_almacen: document.getElementById('ubicacion_almacen').value || null,
        maneja_lotes: document.getElementById('maneja_lotes').checked ? 'Y' : 'N',
        maneja_caducidad: document.getElementById('maneja_caducidad').checked ? 'Y' : 'N',
        maneja_series: document.getElementById('maneja_series').checked ? 'Y' : 'N',
        dias_caducidad: parseInt(document.getElementById('dias_caducidad').value) || 0,

        es_inventariable: document.getElementById('es_inventariable').checked ? 'Y' : 'N',
        es_vendible: document.getElementById('es_vendible').checked ? 'Y' : 'N',
        es_comprable: document.getElementById('es_comprable').checked ? 'Y' : 'N',
        mostrar_pos: document.getElementById('mostrar_pos').checked ? 'Y' : 'N',
        permite_descuento: document.getElementById('permite_descuento').checked ? 'Y' : 'N',
        descuento_maximo: parseFloat(document.getElementById('descuento_maximo').value) || 0,
        color_pos: document.getElementById('color_pos').value,
        orden_pos: parseInt(document.getElementById('orden_pos').value) || 0,
        tecla_rapida: document.getElementById('tecla_rapida').value || null,
        notas_internas: document.getElementById('notas_internas').value || null,

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

function exportarExcel() {
    mostrarToast('Función próximamente disponible');
}

function mostrarToast(msg, tipo = 'success') {
    const toast = document.getElementById('toast');
    toast.innerHTML = `<i class="fas fa-${tipo === 'error' ? 'exclamation-circle' : 'check-circle'}"></i> ${msg}`;
    toast.className = 'toast show ' + tipo;
    setTimeout(() => toast.classList.remove('show'), 3000);
}
