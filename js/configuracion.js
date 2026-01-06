// ==================== DATA ====================
let categoriasData = [];
let subcategoriasData = [];
let marcasData = [];
let gruposData = [];
let proveedoresData = [];
let cuentasData = [];
let categoriasGastoData = [];
let conceptosGastoData = [];

// ==================== CATEGORÍAS ====================
async function cargarCategorias() {
    try {
        const r = await API.request(`/categorias/${empresaId}`);
        if (r.success) {
            categoriasData = r.categorias || [];
            const tabla = document.getElementById('tablaCategorias');
            if (categoriasData.length === 0) {
                tabla.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="fas fa-folder"></i><p>No hay categorías</p></td></tr>';
                return;
            }
            tabla.innerHTML = categoriasData.map(c => `
                <tr>
                    <td>${c.codigo || '-'}</td>
                    <td><strong>${c.nombre}</strong></td>
                    <td><span style="display:inline-block;width:20px;height:20px;background:${c.color || '#3498db'};border-radius:4px"></span> ${c.color || '#3498db'}</td>
                    <td class="center">${c.mostrar_pos === 'Y' ? '<i class="fas fa-check text-success"></i>' : '<i class="fas fa-times text-danger"></i>'}</td>
                    <td class="center"><span class="badge badge-${c.activo === 'Y' ? 'success' : 'danger'}">${c.activo === 'Y' ? 'Activo' : 'Inactivo'}</span></td>
                    <td class="center">
                        <div class="btn-actions">
                            <button class="btn-edit" onclick="editarCategoria('${c.categoria_id}')"><i class="fas fa-edit"></i></button>
                            <button class="btn-delete" onclick="eliminarCategoria('${c.categoria_id}')"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }
    } catch (e) { console.error('Error:', e); }
}

function abrirModalCategoria() {
    document.getElementById('formCategoria').reset();
    document.getElementById('categoriaId').value = '';
    document.getElementById('modalCategoriaTitulo').textContent = 'Nueva Categoría';
    document.getElementById('catColor').value = '#3498db';
    document.getElementById('catMostrarPOS').checked = true;
    document.getElementById('catActivo').checked = true;
    abrirModal('modalCategoria');
}

function editarCategoria(id) {
    const c = categoriasData.find(x => x.categoria_id === id);
    if (!c) return;
    document.getElementById('categoriaId').value = c.categoria_id;
    document.getElementById('catCodigo').value = c.codigo || '';
    document.getElementById('catNombre').value = c.nombre || '';
    document.getElementById('catDescripcion').value = c.descripcion || '';
    document.getElementById('catColor').value = c.color || '#3498db';
    document.getElementById('catIcono').value = c.icono || '';
    document.getElementById('catOrden').value = c.orden || 0;
    document.getElementById('catMostrarPOS').checked = c.mostrar_pos === 'Y';
    document.getElementById('catActivo').checked = c.activo === 'Y';
    document.getElementById('modalCategoriaTitulo').textContent = 'Editar Categoría';
    abrirModal('modalCategoria');
}

async function guardarCategoria(ev) {
    ev.preventDefault();
    const id = document.getElementById('categoriaId').value;
    const data = {
        empresa_id: empresaId,
        codigo: document.getElementById('catCodigo').value,
        nombre: document.getElementById('catNombre').value,
        descripcion: document.getElementById('catDescripcion').value,
        color: document.getElementById('catColor').value,
        icono: document.getElementById('catIcono').value,
        orden: parseInt(document.getElementById('catOrden').value) || 0,
        mostrar_pos: document.getElementById('catMostrarPOS').checked ? 'Y' : 'N',
        activo: document.getElementById('catActivo').checked ? 'Y' : 'N'
    };
    try {
        const r = await API.request(id ? `/categorias/${id}` : '/categorias', id ? 'PUT' : 'POST', data);
        if (r.success) { toast(id ? 'Actualizado' : 'Creado', 'success'); cerrarModal('modalCategoria'); cargarCategorias(); }
        else toast(r.error || 'Error', 'error');
    } catch (e) { toast('Error: ' + e.message, 'error'); }
}

async function eliminarCategoria(id) {
    if (!confirm('¿Desactivar categoría?')) return;
    try {
        const r = await API.request(`/categorias/${id}`, 'DELETE');
        if (r.success) { toast('Desactivada', 'success'); cargarCategorias(); }
    } catch (e) { toast('Error: ' + e.message, 'error'); }
}

// ==================== SUBCATEGORÍAS ====================
async function cargarSubcategorias() {
    try {
        const r = await API.request(`/subcategorias/${empresaId}`);
        if (r.success) {
            subcategoriasData = r.subcategorias || [];
            const tabla = document.getElementById('tablaSubcategorias');
            if (subcategoriasData.length === 0) {
                tabla.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="fas fa-folder-tree"></i><p>No hay subcategorías</p></td></tr>';
                return;
            }
            tabla.innerHTML = subcategoriasData.map(s => `
                <tr>
                    <td>${s.codigo || '-'}</td>
                    <td><strong>${s.nombre}</strong></td>
                    <td>${s.categoria_nombre || '-'}</td>
                    <td class="center">${s.orden || 0}</td>
                    <td class="center"><span class="badge badge-${s.activo === 'Y' ? 'success' : 'danger'}">${s.activo === 'Y' ? 'Activo' : 'Inactivo'}</span></td>
                    <td class="center">
                        <div class="btn-actions">
                            <button class="btn-edit" onclick="editarSubcategoria('${s.subcategoria_id}')"><i class="fas fa-edit"></i></button>
                            <button class="btn-delete" onclick="eliminarSubcategoria('${s.subcategoria_id}')"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }
    } catch (e) { console.error('Error:', e); }
}

function abrirModalSubcategoria() {
    document.getElementById('formSubcategoria').reset();
    document.getElementById('subcategoriaId').value = '';
    document.getElementById('modalSubcategoriaTitulo').textContent = 'Nueva Subcategoría';
    document.getElementById('scatActivo').checked = true;
    cargarSelectCategorias('scatCategoria');
    abrirModal('modalSubcategoria');
}

function editarSubcategoria(id) {
    const s = subcategoriasData.find(x => x.subcategoria_id === id);
    if (!s) return;
    cargarSelectCategorias('scatCategoria', s.categoria_id);
    document.getElementById('subcategoriaId').value = s.subcategoria_id;
    document.getElementById('scatCodigo').value = s.codigo || '';
    document.getElementById('scatNombre').value = s.nombre || '';
    document.getElementById('scatOrden').value = s.orden || 0;
    document.getElementById('scatActivo').checked = s.activo === 'Y';
    document.getElementById('modalSubcategoriaTitulo').textContent = 'Editar Subcategoría';
    abrirModal('modalSubcategoria');
}

async function guardarSubcategoria(ev) {
    ev.preventDefault();
    const id = document.getElementById('subcategoriaId').value;
    const data = {
        empresa_id: empresaId,
        categoria_id: document.getElementById('scatCategoria').value,
        codigo: document.getElementById('scatCodigo').value,
        nombre: document.getElementById('scatNombre').value,
        orden: parseInt(document.getElementById('scatOrden').value) || 0,
        activo: document.getElementById('scatActivo').checked ? 'Y' : 'N'
    };
    try {
        const r = await API.request(id ? `/subcategorias/${id}` : '/subcategorias', id ? 'PUT' : 'POST', data);
        if (r.success) { toast(id ? 'Actualizado' : 'Creado', 'success'); cerrarModal('modalSubcategoria'); cargarSubcategorias(); }
        else toast(r.error || 'Error', 'error');
    } catch (e) { toast('Error: ' + e.message, 'error'); }
}

async function eliminarSubcategoria(id) {
    if (!confirm('¿Desactivar subcategoría?')) return;
    try {
        const r = await API.request(`/subcategorias/${id}`, 'DELETE');
        if (r.success) { toast('Desactivada', 'success'); cargarSubcategorias(); }
    } catch (e) { toast('Error: ' + e.message, 'error'); }
}

function cargarSelectCategorias(selectId, selected = '') {
    const sel = document.getElementById(selectId);
    sel.innerHTML = '<option value="">Seleccionar...</option>' + categoriasData.filter(c => c.activo === 'Y').map(c => `<option value="${c.categoria_id}" ${c.categoria_id === selected ? 'selected' : ''}>${c.nombre}</option>`).join('');
}

// ==================== MARCAS ====================
async function cargarMarcas() {
    try {
        const r = await API.request(`/marcas/${empresaId}`);
        if (r.success) {
            marcasData = r.marcas || [];
            const tabla = document.getElementById('tablaMarcas');
            if (marcasData.length === 0) {
                tabla.innerHTML = '<tr><td colspan="4" class="empty-state"><i class="fas fa-tag"></i><p>No hay marcas</p></td></tr>';
                return;
            }
            tabla.innerHTML = marcasData.map(m => `
                <tr>
                    <td><strong>${m.nombre}</strong></td>
                    <td>${m.logo_url ? `<img src="${m.logo_url}" style="height:30px">` : '-'}</td>
                    <td class="center"><span class="badge badge-${m.activo === 'Y' ? 'success' : 'danger'}">${m.activo === 'Y' ? 'Activo' : 'Inactivo'}</span></td>
                    <td class="center">
                        <div class="btn-actions">
                            <button class="btn-edit" onclick="editarMarca('${m.marca_id}')"><i class="fas fa-edit"></i></button>
                            <button class="btn-delete" onclick="eliminarMarca('${m.marca_id}')"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }
    } catch (e) { console.error('Error:', e); }
}

function abrirModalMarca() {
    document.getElementById('formMarca').reset();
    document.getElementById('marcaId').value = '';
    document.getElementById('modalMarcaTitulo').textContent = 'Nueva Marca';
    document.getElementById('mrcActivo').checked = true;
    abrirModal('modalMarca');
}

function editarMarca(id) {
    const m = marcasData.find(x => x.marca_id === id);
    if (!m) return;
    document.getElementById('marcaId').value = m.marca_id;
    document.getElementById('mrcNombre').value = m.nombre || '';
    document.getElementById('mrcLogo').value = m.logo_url || '';
    document.getElementById('mrcActivo').checked = m.activo === 'Y';
    document.getElementById('modalMarcaTitulo').textContent = 'Editar Marca';
    abrirModal('modalMarca');
}

async function guardarMarca(ev) {
    ev.preventDefault();
    const id = document.getElementById('marcaId').value;
    const data = {
        empresa_id: empresaId,
        nombre: document.getElementById('mrcNombre').value,
        logo_url: document.getElementById('mrcLogo').value,
        activo: document.getElementById('mrcActivo').checked ? 'Y' : 'N'
    };
    try {
        const r = await API.request(id ? `/marcas/${id}` : '/marcas', id ? 'PUT' : 'POST', data);
        if (r.success) { toast(id ? 'Actualizado' : 'Creado', 'success'); cerrarModal('modalMarca'); cargarMarcas(); }
        else toast(r.error || 'Error', 'error');
    } catch (e) { toast('Error: ' + e.message, 'error'); }
}

async function eliminarMarca(id) {
    if (!confirm('¿Desactivar marca?')) return;
    try {
        const r = await API.request(`/marcas/${id}`, 'DELETE');
        if (r.success) { toast('Desactivada', 'success'); cargarMarcas(); }
    } catch (e) { toast('Error: ' + e.message, 'error'); }
}

// ==================== GRUPOS CLIENTE ====================
async function cargarGrupos() {
    try {
        const r = await API.request(`/grupos-cliente/${empresaId}`);
        if (r.success) {
            gruposData = r.grupos || [];
            const tabla = document.getElementById('tablaGrupos');
            if (gruposData.length === 0) {
                tabla.innerHTML = '<tr><td colspan="5" class="empty-state"><i class="fas fa-users-cog"></i><p>No hay grupos</p></td></tr>';
                return;
            }
            tabla.innerHTML = gruposData.map(g => `
                <tr>
                    <td><strong>${g.nombre}</strong></td>
                    <td class="center">Precio ${g.tipo_precio || 1}</td>
                    <td class="center">${parseFloat(g.descuento_general || 0).toFixed(2)}%</td>
                    <td class="center"><span class="badge badge-${g.activo === 'Y' ? 'success' : 'danger'}">${g.activo === 'Y' ? 'Activo' : 'Inactivo'}</span></td>
                    <td class="center">
                        <div class="btn-actions">
                            <button class="btn-edit" onclick="editarGrupo('${g.grupo_id}')"><i class="fas fa-edit"></i></button>
                            <button class="btn-delete" onclick="eliminarGrupo('${g.grupo_id}')"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }
    } catch (e) { console.error('Error:', e); }
}

function abrirModalGrupo() {
    document.getElementById('formGrupo').reset();
    document.getElementById('grupoId').value = '';
    document.getElementById('modalGrupoTitulo').textContent = 'Nuevo Grupo';
    document.getElementById('grpActivo').checked = true;
    abrirModal('modalGrupo');
}

function editarGrupo(id) {
    const g = gruposData.find(x => x.grupo_id === id);
    if (!g) return;
    document.getElementById('grupoId').value = g.grupo_id;
    document.getElementById('grpNombre').value = g.nombre || '';
    document.getElementById('grpTipoPrecio').value = g.tipo_precio || 1;
    document.getElementById('grpDescuento').value = g.descuento_general || 0;
    document.getElementById('grpActivo').checked = g.activo === 'Y';
    document.getElementById('modalGrupoTitulo').textContent = 'Editar Grupo';
    abrirModal('modalGrupo');
}

async function guardarGrupo(ev) {
    ev.preventDefault();
    const id = document.getElementById('grupoId').value;
    const data = {
        empresa_id: empresaId,
        nombre: document.getElementById('grpNombre').value,
        tipo_precio: parseInt(document.getElementById('grpTipoPrecio').value) || 1,
        descuento_general: parseFloat(document.getElementById('grpDescuento').value) || 0,
        activo: document.getElementById('grpActivo').checked ? 'Y' : 'N'
    };
    try {
        const r = await API.request(id ? `/grupos-cliente/${id}` : '/grupos-cliente', id ? 'PUT' : 'POST', data);
        if (r.success) { toast(id ? 'Actualizado' : 'Creado', 'success'); cerrarModal('modalGrupo'); cargarGrupos(); }
        else toast(r.error || 'Error', 'error');
    } catch (e) { toast('Error: ' + e.message, 'error'); }
}

async function eliminarGrupo(id) {
    if (!confirm('¿Desactivar grupo?')) return;
    try {
        const r = await API.request(`/grupos-cliente/${id}`, 'DELETE');
        if (r.success) { toast('Desactivado', 'success'); cargarGrupos(); }
    } catch (e) { toast('Error: ' + e.message, 'error'); }
}

// ==================== PROVEEDORES ====================
async function cargarProveedores() {
    try {
        const r = await API.request(`/proveedores/${empresaId}`);
        if (r.success) {
            proveedoresData = r.proveedores || [];
            const tabla = document.getElementById('tablaProveedores');
            if (proveedoresData.length === 0) {
                tabla.innerHTML = '<tr><td colspan="7" class="empty-state"><i class="fas fa-truck"></i><p>No hay proveedores</p></td></tr>';
                return;
            }
            tabla.innerHTML = proveedoresData.map(p => `
                <tr>
                    <td>${p.codigo || '-'}</td>
                    <td><strong>${p.nombre_comercial}</strong></td>
                    <td>${p.rfc || '-'}</td>
                    <td>${p.telefono || '-'}</td>
                    <td>${p.email || '-'}</td>
                    <td class="center"><span class="badge badge-${p.activo === 'Y' ? 'success' : 'danger'}">${p.activo === 'Y' ? 'Activo' : 'Inactivo'}</span></td>
                    <td class="center">
                        <div class="btn-actions">
                            <button class="btn-edit" onclick="editarProveedor('${p.proveedor_id}')"><i class="fas fa-edit"></i></button>
                            <button class="btn-delete" onclick="eliminarProveedor('${p.proveedor_id}')"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }
    } catch (e) { console.error('Error:', e); }
}

function abrirModalProveedor() {
    document.getElementById('formProveedor').reset();
    document.getElementById('proveedorId').value = '';
    document.getElementById('modalProveedorTitulo').textContent = 'Nuevo Proveedor';
    document.getElementById('provActivo').checked = true;
    abrirModal('modalProveedor');
}

function editarProveedor(id) {
    const p = proveedoresData.find(x => x.proveedor_id === id);
    if (!p) return;
    document.getElementById('proveedorId').value = p.proveedor_id;
    document.getElementById('provCodigo').value = p.codigo || '';
    document.getElementById('provTipo').value = p.tipo_persona || 'MORAL';
    document.getElementById('provRFC').value = p.rfc || '';
    document.getElementById('provRazonSocial').value = p.razon_social || '';
    document.getElementById('provNombre').value = p.nombre_comercial || '';
    document.getElementById('provEstado').value = p.estado || '';
    document.getElementById('provCiudad').value = p.ciudad || '';
    document.getElementById('provCP').value = p.codigo_postal || '';
    document.getElementById('provDireccion').value = p.direccion || '';
    document.getElementById('provTelefono').value = p.telefono || '';
    document.getElementById('provCelular').value = p.celular || '';
    document.getElementById('provEmail').value = p.email || '';
    document.getElementById('provContacto').value = p.contacto_nombre || '';
    document.getElementById('provContactoTel').value = p.contacto_telefono || '';
    document.getElementById('provContactoEmail').value = p.contacto_email || '';
    document.getElementById('provBanco').value = p.banco || '';
    document.getElementById('provCuentaBanco').value = p.cuenta_banco || '';
    document.getElementById('provClabe').value = p.clabe || '';
    document.getElementById('provDiasCredito').value = p.dias_credito || 0;
    document.getElementById('provLimiteCredito').value = p.limite_credito || 0;
    document.getElementById('provNotas').value = p.notas || '';
    document.getElementById('provActivo').checked = p.activo === 'Y';
    document.getElementById('modalProveedorTitulo').textContent = 'Editar Proveedor';
    abrirModal('modalProveedor');
}

async function guardarProveedor(ev) {
    ev.preventDefault();
    const id = document.getElementById('proveedorId').value;
    const data = {
        empresa_id: empresaId,
        codigo: document.getElementById('provCodigo').value,
        tipo_persona: document.getElementById('provTipo').value,
        rfc: document.getElementById('provRFC').value,
        razon_social: document.getElementById('provRazonSocial').value,
        nombre_comercial: document.getElementById('provNombre').value,
        estado: document.getElementById('provEstado').value,
        ciudad: document.getElementById('provCiudad').value,
        codigo_postal: document.getElementById('provCP').value,
        direccion: document.getElementById('provDireccion').value,
        telefono: document.getElementById('provTelefono').value,
        celular: document.getElementById('provCelular').value,
        email: document.getElementById('provEmail').value,
        contacto_nombre: document.getElementById('provContacto').value,
        contacto_telefono: document.getElementById('provContactoTel').value,
        contacto_email: document.getElementById('provContactoEmail').value,
        banco: document.getElementById('provBanco').value,
        cuenta_banco: document.getElementById('provCuentaBanco').value,
        clabe: document.getElementById('provClabe').value,
        dias_credito: parseInt(document.getElementById('provDiasCredito').value) || 0,
        limite_credito: parseFloat(document.getElementById('provLimiteCredito').value) || 0,
        notas: document.getElementById('provNotas').value,
        activo: document.getElementById('provActivo').checked ? 'Y' : 'N'
    };
    try {
        const r = await API.request(id ? `/proveedores/${id}` : '/proveedores', id ? 'PUT' : 'POST', data);
        if (r.success) { toast(id ? 'Actualizado' : 'Creado', 'success'); cerrarModal('modalProveedor'); cargarProveedores(); }
        else toast(r.error || 'Error', 'error');
    } catch (e) { toast('Error: ' + e.message, 'error'); }
}

async function eliminarProveedor(id) {
    if (!confirm('¿Desactivar proveedor?')) return;
    try {
        const r = await API.request(`/proveedores/${id}`, 'DELETE');
        if (r.success) { toast('Desactivado', 'success'); cargarProveedores(); }
    } catch (e) { toast('Error: ' + e.message, 'error'); }
}

// ==================== CUENTAS BANCARIAS ====================
async function cargarCuentas() {
    try {
        const r = await API.request(`/cuentas-bancarias/${empresaId}`);
        if (r.success) {
            cuentasData = r.cuentas || [];
            const tabla = document.getElementById('tablaCuentas');
            if (cuentasData.length === 0) {
                tabla.innerHTML = '<tr><td colspan="7" class="empty-state"><i class="fas fa-university"></i><p>No hay cuentas</p></td></tr>';
                return;
            }
            tabla.innerHTML = cuentasData.map(c => `
                <tr>
                    <td><strong>${c.banco}</strong></td>
                    <td>${c.numero_cuenta || '-'}</td>
                    <td>${c.clabe || '-'}</td>
                    <td>${c.moneda_id || 'MXN'}</td>
                    <td class="right">$${parseFloat(c.saldo || 0).toLocaleString('es-MX', {minimumFractionDigits: 2})}</td>
                    <td class="center"><span class="badge badge-${c.activa === 'Y' ? 'success' : 'danger'}">${c.activa === 'Y' ? 'Activa' : 'Inactiva'}</span></td>
                    <td class="center">
                        <div class="btn-actions">
                            <button class="btn-edit" onclick="editarCuenta('${c.cuenta_id}')"><i class="fas fa-edit"></i></button>
                            <button class="btn-delete" onclick="eliminarCuenta('${c.cuenta_id}')"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }
    } catch (e) { console.error('Error:', e); }
}

function abrirModalCuenta() {
    document.getElementById('formCuenta').reset();
    document.getElementById('cuentaId').value = '';
    document.getElementById('modalCuentaTitulo').textContent = 'Nueva Cuenta';
    document.getElementById('ctaActiva').checked = true;
    abrirModal('modalCuenta');
}

function editarCuenta(id) {
    const c = cuentasData.find(x => x.cuenta_id === id);
    if (!c) return;
    document.getElementById('cuentaId').value = c.cuenta_id;
    document.getElementById('ctaBanco').value = c.banco || '';
    document.getElementById('ctaNumero').value = c.numero_cuenta || '';
    document.getElementById('ctaClabe').value = c.clabe || '';
    document.getElementById('ctaMoneda').value = c.moneda_id || 'MXN';
    document.getElementById('ctaSaldo').value = c.saldo || 0;
    document.getElementById('ctaActiva').checked = c.activa === 'Y';
    document.getElementById('modalCuentaTitulo').textContent = 'Editar Cuenta';
    abrirModal('modalCuenta');
}

async function guardarCuenta(ev) {
    ev.preventDefault();
    const id = document.getElementById('cuentaId').value;
    const data = {
        empresa_id: empresaId,
        banco: document.getElementById('ctaBanco').value,
        numero_cuenta: document.getElementById('ctaNumero').value,
        clabe: document.getElementById('ctaClabe').value,
        moneda_id: document.getElementById('ctaMoneda').value,
        saldo: parseFloat(document.getElementById('ctaSaldo').value) || 0,
        activa: document.getElementById('ctaActiva').checked ? 'Y' : 'N'
    };
    try {
        const r = await API.request(id ? `/cuentas-bancarias/${id}` : '/cuentas-bancarias', id ? 'PUT' : 'POST', data);
        if (r.success) { toast(id ? 'Actualizado' : 'Creado', 'success'); cerrarModal('modalCuenta'); cargarCuentas(); }
        else toast(r.error || 'Error', 'error');
    } catch (e) { toast('Error: ' + e.message, 'error'); }
}

async function eliminarCuenta(id) {
    if (!confirm('¿Desactivar cuenta?')) return;
    try {
        const r = await API.request(`/cuentas-bancarias/${id}`, 'DELETE');
        if (r.success) { toast('Desactivada', 'success'); cargarCuentas(); }
    } catch (e) { toast('Error: ' + e.message, 'error'); }
}

// ==================== CATEGORÍAS GASTO ====================
async function cargarCategoriasGasto() {
    try {
        const r = await API.request(`/categorias-gasto/${empresaId}`);
        if (r.success) {
            categoriasGastoData = r.categorias || [];
            const tabla = document.getElementById('tablaCategoriasGasto');
            if (categoriasGastoData.length === 0) {
                tabla.innerHTML = '<tr><td colspan="5" class="empty-state"><i class="fas fa-receipt"></i><p>No hay categorías</p></td></tr>';
                return;
            }
            tabla.innerHTML = categoriasGastoData.map(c => `
                <tr>
                    <td>${c.codigo || '-'}</td>
                    <td><strong>${c.nombre}</strong></td>
                    <td><span class="badge badge-info">${c.tipo || 'OPERATIVO'}</span></td>
                    <td class="center"><span class="badge badge-${c.activo === 'Y' ? 'success' : 'danger'}">${c.activo === 'Y' ? 'Activo' : 'Inactivo'}</span></td>
                    <td class="center">
                        <div class="btn-actions">
                            <button class="btn-edit" onclick="editarCategoriaGasto('${c.categoria_gasto_id}')"><i class="fas fa-edit"></i></button>
                            <button class="btn-delete" onclick="eliminarCategoriaGasto('${c.categoria_gasto_id}')"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }
    } catch (e) { console.error('Error:', e); }
}

function abrirModalCategoriaGasto() {
    document.getElementById('formCategoriaGasto').reset();
    document.getElementById('categoriaGastoId').value = '';
    document.getElementById('modalCategoriaGastoTitulo').textContent = 'Nueva Categoría de Gasto';
    document.getElementById('catgActivo').checked = true;
    abrirModal('modalCategoriaGasto');
}

function editarCategoriaGasto(id) {
    const c = categoriasGastoData.find(x => x.categoria_gasto_id === id);
    if (!c) return;
    document.getElementById('categoriaGastoId').value = c.categoria_gasto_id;
    document.getElementById('catgCodigo').value = c.codigo || '';
    document.getElementById('catgNombre').value = c.nombre || '';
    document.getElementById('catgTipo').value = c.tipo || 'OPERATIVO';
    document.getElementById('catgCuenta').value = c.cuenta_contable || '';
    document.getElementById('catgActivo').checked = c.activo === 'Y';
    document.getElementById('modalCategoriaGastoTitulo').textContent = 'Editar Categoría de Gasto';
    abrirModal('modalCategoriaGasto');
}

async function guardarCategoriaGasto(ev) {
    ev.preventDefault();
    const id = document.getElementById('categoriaGastoId').value;
    const data = {
        empresa_id: empresaId,
        codigo: document.getElementById('catgCodigo').value,
        nombre: document.getElementById('catgNombre').value,
        tipo: document.getElementById('catgTipo').value,
        cuenta_contable: document.getElementById('catgCuenta').value,
        activo: document.getElementById('catgActivo').checked ? 'Y' : 'N'
    };
    try {
        const r = await API.request(id ? `/categorias-gasto/${id}` : '/categorias-gasto', id ? 'PUT' : 'POST', data);
        if (r.success) { toast(id ? 'Actualizado' : 'Creado', 'success'); cerrarModal('modalCategoriaGasto'); cargarCategoriasGasto(); }
        else toast(r.error || 'Error', 'error');
    } catch (e) { toast('Error: ' + e.message, 'error'); }
}

async function eliminarCategoriaGasto(id) {
    if (!confirm('¿Desactivar categoría?')) return;
    try {
        const r = await API.request(`/categorias-gasto/${id}`, 'DELETE');
        if (r.success) { toast('Desactivada', 'success'); cargarCategoriasGasto(); }
    } catch (e) { toast('Error: ' + e.message, 'error'); }
}

// ==================== CONCEPTOS GASTO ====================
async function cargarConceptosGasto() {
    try {
        const r = await API.request(`/conceptos-gasto/${empresaId}`);
        if (r.success) {
            conceptosGastoData = r.conceptos || [];
            const tabla = document.getElementById('tablaConceptosGasto');
            if (conceptosGastoData.length === 0) {
                tabla.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="fas fa-file-invoice-dollar"></i><p>No hay conceptos</p></td></tr>';
                return;
            }
            tabla.innerHTML = conceptosGastoData.map(c => `
                <tr>
                    <td>${c.codigo || '-'}</td>
                    <td><strong>${c.nombre}</strong></td>
                    <td>${c.categoria_nombre || '-'}</td>
                    <td class="center">${c.requiere_factura === 'Y' ? '<i class="fas fa-check text-success"></i>' : '<i class="fas fa-times text-danger"></i>'}</td>
                    <td class="center"><span class="badge badge-${c.activo === 'Y' ? 'success' : 'danger'}">${c.activo === 'Y' ? 'Activo' : 'Inactivo'}</span></td>
                    <td class="center">
                        <div class="btn-actions">
                            <button class="btn-edit" onclick="editarConceptoGasto('${c.concepto_gasto_id}')"><i class="fas fa-edit"></i></button>
                            <button class="btn-delete" onclick="eliminarConceptoGasto('${c.concepto_gasto_id}')"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }
    } catch (e) { console.error('Error:', e); }
}

function abrirModalConceptoGasto() {
    document.getElementById('formConceptoGasto').reset();
    document.getElementById('conceptoGastoId').value = '';
    document.getElementById('modalConceptoGastoTitulo').textContent = 'Nuevo Concepto de Gasto';
    document.getElementById('congActivo').checked = true;
    cargarSelectCategoriasGasto('congCategoria');
    abrirModal('modalConceptoGasto');
}

function editarConceptoGasto(id) {
    const c = conceptosGastoData.find(x => x.concepto_gasto_id === id);
    if (!c) return;
    cargarSelectCategoriasGasto('congCategoria', c.categoria_gasto_id);
    document.getElementById('conceptoGastoId').value = c.concepto_gasto_id;
    document.getElementById('congCodigo').value = c.codigo || '';
    document.getElementById('congNombre').value = c.nombre || '';
    document.getElementById('congDescripcion').value = c.descripcion || '';
    document.getElementById('congReqFactura').checked = c.requiere_factura === 'Y';
    document.getElementById('congActivo').checked = c.activo === 'Y';
    document.getElementById('modalConceptoGastoTitulo').textContent = 'Editar Concepto de Gasto';
    abrirModal('modalConceptoGasto');
}

async function guardarConceptoGasto(ev) {
    ev.preventDefault();
    const id = document.getElementById('conceptoGastoId').value;
    const data = {
        empresa_id: empresaId,
        categoria_gasto_id: document.getElementById('congCategoria').value,
        codigo: document.getElementById('congCodigo').value,
        nombre: document.getElementById('congNombre').value,
        descripcion: document.getElementById('congDescripcion').value,
        requiere_factura: document.getElementById('congReqFactura').checked ? 'Y' : 'N',
        activo: document.getElementById('congActivo').checked ? 'Y' : 'N'
    };
    try {
        const r = await API.request(id ? `/conceptos-gasto/${id}` : '/conceptos-gasto', id ? 'PUT' : 'POST', data);
        if (r.success) { toast(id ? 'Actualizado' : 'Creado', 'success'); cerrarModal('modalConceptoGasto'); cargarConceptosGasto(); }
        else toast(r.error || 'Error', 'error');
    } catch (e) { toast('Error: ' + e.message, 'error'); }
}

async function eliminarConceptoGasto(id) {
    if (!confirm('¿Desactivar concepto?')) return;
    try {
        const r = await API.request(`/conceptos-gasto/${id}`, 'DELETE');
        if (r.success) { toast('Desactivado', 'success'); cargarConceptosGasto(); }
    } catch (e) { toast('Error: ' + e.message, 'error'); }
}

function cargarSelectCategoriasGasto(selectId, selected = '') {
    const sel = document.getElementById(selectId);
    sel.innerHTML = '<option value="">Seleccionar...</option>' + categoriasGastoData.filter(c => c.activo === 'Y').map(c => `<option value="${c.categoria_gasto_id}" ${c.categoria_gasto_id === selected ? 'selected' : ''}>${c.nombre}</option>`).join('');
}
