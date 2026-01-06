/* ============================================
   CONFIGURACION.JS - CAFI POS
   ============================================ */

const empresaId = localStorage.getItem('empresa_id') || (JSON.parse(localStorage.getItem('usuario') || '{}')).empresa_id || 1;

// ==================== DATA ====================
let sucursalesData = [];
let usuariosData = [];
let impuestosData = [];
let metodosData = [];
let unidadesData = [];
let categoriasData = [];
let subcategoriasData = [];
let marcasData = [];
let gruposData = [];
let proveedoresData = [];
let cuentasData = [];
let categoriasGastoData = [];
let conceptosGastoData = [];

document.addEventListener('DOMContentLoaded', () => {
    initUsuario();
    initTabs();
    initForms();
    cargarEmpresa();
});

function initUsuario() {
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    document.getElementById('userName').textContent = usuario.nombre || 'Usuario';
    document.getElementById('userSucursal').textContent = usuario.sucursal_nombre || 'Sucursal';
    document.getElementById('userAvatar').textContent = (usuario.nombre || 'US').substring(0, 2).toUpperCase();
}

function initTabs() {
    document.querySelectorAll('.config-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            document.querySelectorAll('.config-tab').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.config-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`panel-${tab}`)?.classList.add('active');
            cargarTab(tab);
        });
    });
}

function cargarTab(tab) {
    const loaders = {
        'empresa': cargarEmpresa,
        'sucursales': cargarSucursales,
        'usuarios': () => { cargarSucursales(); cargarUsuarios(); },
        'impuestos': cargarImpuestos,
        'metodos': cargarMetodos,
        'unidades': cargarUnidades,
        'categorias': cargarCategorias,
        'subcategorias': () => { cargarCategorias(); cargarSubcategorias(); },
        'marcas': cargarMarcas,
        'grupos': cargarGrupos,
        'proveedores': cargarProveedores,
        'cuentas': cargarCuentas,
        'categorias-gasto': cargarCategoriasGasto,
        'conceptos-gasto': () => { cargarCategoriasGasto(); cargarConceptosGasto(); }
    };
    if (loaders[tab]) loaders[tab]();
}

function initForms() {
    document.getElementById('formEmpresa')?.addEventListener('submit', guardarEmpresa);
    document.getElementById('formSucursal')?.addEventListener('submit', guardarSucursal);
    document.getElementById('formUsuario')?.addEventListener('submit', guardarUsuario);
    document.getElementById('formImpuesto')?.addEventListener('submit', guardarImpuesto);
    document.getElementById('formMetodo')?.addEventListener('submit', guardarMetodo);
    // Unidades es solo lectura, no tiene formulario
    document.getElementById('formCategoria')?.addEventListener('submit', guardarCategoria);
    document.getElementById('formSubcategoria')?.addEventListener('submit', guardarSubcategoria);
    document.getElementById('formMarca')?.addEventListener('submit', guardarMarca);
    document.getElementById('formGrupo')?.addEventListener('submit', guardarGrupo);
    document.getElementById('formProveedor')?.addEventListener('submit', guardarProveedor);
    document.getElementById('formCuenta')?.addEventListener('submit', guardarCuenta);
    document.getElementById('formCategoriaGasto')?.addEventListener('submit', guardarCategoriaGasto);
    document.getElementById('formConceptoGasto')?.addEventListener('submit', guardarConceptoGasto);
}

// ==================== EMPRESA ====================
async function cargarEmpresa() {
    try {
        const r = await API.request(`/empresas/${empresaId}`);
        if (r.success && r.empresa) {
            const e = r.empresa;
            document.getElementById('empNombre').value = e.nombre || '';
            document.getElementById('empRFC').value = e.rfc || '';
            document.getElementById('empTelefono').value = e.telefono || '';
            document.getElementById('empEmail').value = e.email || '';
            document.getElementById('empDireccion').value = e.direccion || '';
            document.getElementById('empRegimen').value = e.regimen_fiscal || '';
            document.getElementById('empCP').value = e.codigo_postal || '';
        }
    } catch (e) { console.error(e); }
}

async function guardarEmpresa(ev) {
    ev.preventDefault();
    try {
        const data = {
            nombre: document.getElementById('empNombre').value,
            rfc: document.getElementById('empRFC').value,
            telefono: document.getElementById('empTelefono').value,
            email: document.getElementById('empEmail').value,
            direccion: document.getElementById('empDireccion').value,
            regimen_fiscal: document.getElementById('empRegimen').value,
            codigo_postal: document.getElementById('empCP').value
        };
        const r = await API.request(`/empresas/${empresaId}`, 'PUT', data);
        toast(r.success ? 'Empresa actualizada' : 'Error al guardar', r.success ? 'success' : 'error');
    } catch (e) { toast('Error al guardar', 'error'); }
}

// ==================== SUCURSALES ====================
async function cargarSucursales() {
    const tabla = document.getElementById('tablaSucursales');
    if (!tabla) return;
    tabla.innerHTML = `<tr class="loading-row"><td colspan="6"><div class="spinner"></div>Cargando...</td></tr>`;
    
    try {
        const r = await API.request(`/sucursales/${empresaId}`);
        if (r.success && r.sucursales?.length) {
            sucursalesData = r.sucursales;
            tabla.innerHTML = r.sucursales.map(s => `
                <tr>
                    <td><strong>${s.nombre}</strong></td>
                    <td>${s.direccion || '-'}</td>
                    <td>${s.telefono || '-'}</td>
                    <td>${s.encargado || '-'}</td>
                    <td class="center"><span class="badge badge-${s.activo === 'Y' ? 'success' : 'danger'}">${s.activo === 'Y' ? 'Activa' : 'Inactiva'}</span></td>
                    <td class="center">
                        <div class="btn-actions">
                            <button class="btn-edit" onclick="editarSucursal('${s.sucursal_id}')"><i class="fas fa-edit"></i></button>
                            <button class="btn-delete" onclick="eliminarSucursal('${s.sucursal_id}')"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `).join('');
            cargarSelectSucursales();
        } else {
            sucursalesData = [];
            tabla.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-store"></i><p>No hay sucursales</p></div></td></tr>`;
        }
    } catch (e) { tabla.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error</p></div></td></tr>`; }
}

function cargarSelectSucursales() {
    const sel = document.getElementById('usrSucursal');
    if (!sel) return;
    sel.innerHTML = '<option value="">Seleccionar...</option>';
    sucursalesData.forEach(s => {
        if (s.activo === 'Y') sel.innerHTML += `<option value="${s.sucursal_id}">${s.nombre}</option>`;
    });
}

function abrirModalSucursal() {
    document.getElementById('formSucursal').reset();
    document.getElementById('sucursalId').value = '';
    document.getElementById('modalSucursalTitulo').textContent = 'Nueva Sucursal';
    document.getElementById('sucActivo').checked = true;
    abrirModal('modalSucursal');
}

function editarSucursal(id) {
    const s = sucursalesData.find(x => x.sucursal_id == id);
    if (!s) return;
    document.getElementById('sucursalId').value = s.sucursal_id;
    document.getElementById('sucNombre').value = s.nombre || '';
    document.getElementById('sucDireccion').value = s.direccion || '';
    document.getElementById('sucTelefono').value = s.telefono || '';
    document.getElementById('sucEmail').value = s.email || '';
    document.getElementById('sucEncargado').value = s.encargado || '';
    document.getElementById('sucActivo').checked = s.activo === 'Y';
    document.getElementById('modalSucursalTitulo').textContent = 'Editar Sucursal';
    abrirModal('modalSucursal');
}

async function guardarSucursal(ev) {
    ev.preventDefault();
    const id = document.getElementById('sucursalId').value;
    const data = {
        empresa_id: empresaId,
        nombre: document.getElementById('sucNombre').value,
        direccion: document.getElementById('sucDireccion').value,
        telefono: document.getElementById('sucTelefono').value,
        email: document.getElementById('sucEmail').value,
        encargado: document.getElementById('sucEncargado').value,
        activo: document.getElementById('sucActivo').checked ? 'Y' : 'N'
    };
    
    try {
        const r = await API.request(id ? `/sucursales/${id}` : '/sucursales', id ? 'PUT' : 'POST', data);
        if (r.success) {
            toast(id ? 'Sucursal actualizada' : 'Sucursal creada', 'success');
            cerrarModal('modalSucursal');
            cargarSucursales();
        } else {
            toast(r.error || 'Error', 'error');
        }
    } catch (e) { toast('Error al guardar', 'error'); }
}

async function eliminarSucursal(id) {
    if (!confirm('¿Eliminar esta sucursal?')) return;
    try {
        const r = await API.request(`/sucursales/${id}`, 'DELETE');
        toast(r.success ? 'Sucursal eliminada' : 'Error', r.success ? 'success' : 'error');
        if (r.success) cargarSucursales();
    } catch (e) { toast('Error', 'error'); }
}

// ==================== USUARIOS ====================
async function cargarUsuarios() {
    const tabla = document.getElementById('tablaUsuarios');
    if (!tabla) return;
    tabla.innerHTML = `<tr class="loading-row"><td colspan="7"><div class="spinner"></div>Cargando...</td></tr>`;
    
    try {
        const r = await API.request(`/usuarios/${empresaId}`);
        if (r.success && r.usuarios?.length) {
            usuariosData = r.usuarios;
            tabla.innerHTML = r.usuarios.map(u => `
                <tr>
                    <td><strong>${u.nombre}</strong></td>
                    <td>${u.usuario}</td>
                    <td>${u.email || '-'}</td>
                    <td><span class="badge badge-${getRolColor(u.rol)}">${u.rol}</span></td>
                    <td>${u.sucursal_nombre || '-'}</td>
                    <td class="center"><span class="badge badge-${u.activo === 'Y' ? 'success' : 'danger'}">${u.activo === 'Y' ? 'Activo' : 'Inactivo'}</span></td>
                    <td class="center">
                        <div class="btn-actions">
                            <button class="btn-edit" onclick="editarUsuario('${u.usuario_id}')"><i class="fas fa-edit"></i></button>
                            <button class="btn-delete" onclick="eliminarUsuario('${u.usuario_id}')"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `).join('');
        } else {
            tabla.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fas fa-users"></i><p>No hay usuarios</p></div></td></tr>`;
        }
    } catch (e) { tabla.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error</p></div></td></tr>`; }
}

function getRolColor(rol) {
    const colors = { ADMIN: 'purple', GERENTE: 'info', CAJERO: 'success', ALMACEN: 'warning' };
    return colors[rol] || 'info';
}

function abrirModalUsuario() {
    document.getElementById('formUsuario').reset();
    document.getElementById('usuarioId').value = '';
    document.getElementById('modalUsuarioTitulo').textContent = 'Nuevo Usuario';
    document.getElementById('lblPassword').textContent = 'Contraseña *';
    document.getElementById('usrPassword').required = true;
    document.getElementById('usrActivo').checked = true;
    abrirModal('modalUsuario');
}

function editarUsuario(id) {
    const u = usuariosData.find(x => x.usuario_id == id);
    if (!u) return;
    document.getElementById('usuarioId').value = u.usuario_id;
    document.getElementById('usrNombre').value = u.nombre || '';
    document.getElementById('usrUsuario').value = u.usuario || '';
    document.getElementById('usrEmail').value = u.email || '';
    document.getElementById('usrTelefono').value = u.telefono || '';
    document.getElementById('usrPassword').value = '';
    document.getElementById('usrPassword2').value = '';
    document.getElementById('usrRol').value = u.rol || '';
    document.getElementById('usrSucursal').value = u.sucursal_id || '';
    document.getElementById('usrActivo').checked = u.activo === 'Y';
    document.getElementById('modalUsuarioTitulo').textContent = 'Editar Usuario';
    document.getElementById('lblPassword').textContent = 'Nueva Contraseña (dejar vacío para no cambiar)';
    document.getElementById('usrPassword').required = false;
    abrirModal('modalUsuario');
}

async function guardarUsuario(ev) {
    ev.preventDefault();
    const id = document.getElementById('usuarioId').value;
    const pass = document.getElementById('usrPassword').value;
    const pass2 = document.getElementById('usrPassword2').value;
    
    if (pass && pass !== pass2) { toast('Las contraseñas no coinciden', 'error'); return; }
    if (!id && !pass) { toast('La contraseña es requerida', 'error'); return; }
    
    const data = {
        empresa_id: empresaId,
        nombre: document.getElementById('usrNombre').value,
        usuario: document.getElementById('usrUsuario').value,
        email: document.getElementById('usrEmail').value,
        telefono: document.getElementById('usrTelefono').value,
        rol: document.getElementById('usrRol').value,
        sucursal_id: document.getElementById('usrSucursal').value,
        activo: document.getElementById('usrActivo').checked ? 'Y' : 'N'
    };
    if (pass) data.password = pass;
    
    try {
        const r = await API.request(id ? `/usuarios/${id}` : '/usuarios', id ? 'PUT' : 'POST', data);
        if (r.success) {
            toast(id ? 'Usuario actualizado' : 'Usuario creado', 'success');
            cerrarModal('modalUsuario');
            cargarUsuarios();
        } else { toast(r.error || 'Error', 'error'); }
    } catch (e) { toast('Error al guardar', 'error'); }
}

async function eliminarUsuario(id) {
    if (!confirm('¿Eliminar este usuario?')) return;
    try {
        const r = await API.request(`/usuarios/${id}`, 'DELETE');
        toast(r.success ? 'Usuario eliminado' : 'Error', r.success ? 'success' : 'error');
        if (r.success) cargarUsuarios();
    } catch (e) { toast('Error', 'error'); }
}

// ==================== IMPUESTOS ====================
async function cargarImpuestos() {
    const tabla = document.getElementById('tablaImpuestos');
    if (!tabla) return;
    tabla.innerHTML = `<tr class="loading-row"><td colspan="6"><div class="spinner"></div>Cargando...</td></tr>`;
    
    try {
        const r = await API.request(`/impuestos/${empresaId}`);
        if (r.success && r.impuestos?.length) {
            impuestosData = r.impuestos;
            tabla.innerHTML = r.impuestos.map(i => `
                <tr>
                    <td><strong>${i.nombre}</strong></td>
                    <td>${i.clave_sat || '-'}</td>
                    <td class="center">${i.tasa}%</td>
                    <td class="center">${i.es_defecto === 'Y' ? '<i class="fas fa-check-circle text-success"></i>' : '-'}</td>
                    <td class="center"><span class="badge badge-${i.activo === 'Y' ? 'success' : 'danger'}">${i.activo === 'Y' ? 'Activo' : 'Inactivo'}</span></td>
                    <td class="center">
                        <div class="btn-actions">
                            <button class="btn-edit" onclick="editarImpuesto('${i.impuesto_id}')"><i class="fas fa-edit"></i></button>
                            <button class="btn-delete" onclick="eliminarImpuesto('${i.impuesto_id}')"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `).join('');
        } else {
            tabla.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-percent"></i><p>No hay impuestos</p></div></td></tr>`;
        }
    } catch (e) { tabla.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error</p></div></td></tr>`; }
}

function abrirModalImpuesto() {
    document.getElementById('formImpuesto').reset();
    document.getElementById('impuestoId').value = '';
    document.getElementById('modalImpuestoTitulo').textContent = 'Nuevo Impuesto';
    document.getElementById('impActivo').checked = true;
    abrirModal('modalImpuesto');
}

function editarImpuesto(id) {
    const i = impuestosData.find(x => x.impuesto_id == id);
    if (!i) return;
    document.getElementById('impuestoId').value = i.impuesto_id;
    document.getElementById('impNombre').value = i.nombre || '';
    document.getElementById('impTasa').value = i.tasa || '';
    document.getElementById('impClave').value = i.clave_sat || '002';
    document.getElementById('impDefecto').checked = i.es_defecto === 'Y';
    document.getElementById('impActivo').checked = i.activo === 'Y';
    document.getElementById('modalImpuestoTitulo').textContent = 'Editar Impuesto';
    abrirModal('modalImpuesto');
}

async function guardarImpuesto(ev) {
    ev.preventDefault();
    const id = document.getElementById('impuestoId').value;
    const data = {
        empresa_id: empresaId,
        nombre: document.getElementById('impNombre').value,
        tasa: document.getElementById('impTasa').value,
        clave_sat: document.getElementById('impClave').value,
        es_defecto: document.getElementById('impDefecto').checked ? 'Y' : 'N',
        activo: document.getElementById('impActivo').checked ? 'Y' : 'N'
    };
    
    try {
        const r = await API.request(id ? `/impuestos/${id}` : '/impuestos', id ? 'PUT' : 'POST', data);
        if (r.success) {
            toast(id ? 'Impuesto actualizado' : 'Impuesto creado', 'success');
            cerrarModal('modalImpuesto');
            cargarImpuestos();
        } else { toast(r.error || 'Error', 'error'); }
    } catch (e) { toast('Error al guardar', 'error'); }
}

async function eliminarImpuesto(id) {
    if (!confirm('¿Eliminar este impuesto?')) return;
    try {
        const r = await API.request(`/impuestos/${id}`, 'DELETE');
        toast(r.success ? 'Impuesto eliminado' : 'Error', r.success ? 'success' : 'error');
        if (r.success) cargarImpuestos();
    } catch (e) { toast('Error', 'error'); }
}

// ==================== MÉTODOS DE PAGO ====================
async function cargarMetodos() {
    const tabla = document.getElementById('tablaMetodos');
    if (!tabla) return;
    tabla.innerHTML = `<tr class="loading-row"><td colspan="5"><div class="spinner"></div>Cargando...</td></tr>`;
    
    try {
        const r = await API.request(`/metodos-pago/${empresaId}`);
        if (r.success && r.metodos?.length) {
            metodosData = r.metodos;
            tabla.innerHTML = r.metodos.map(m => `
                <tr>
                    <td><strong>${m.nombre}</strong></td>
                    <td>${m.clave_sat || '-'}</td>
                    <td class="center">${m.requiere_referencia === 'Y' ? '<i class="fas fa-check text-success"></i>' : '-'}</td>
                    <td class="center"><span class="badge badge-${m.activo === 'Y' ? 'success' : 'danger'}">${m.activo === 'Y' ? 'Activo' : 'Inactivo'}</span></td>
                    <td class="center">
                        <div class="btn-actions">
                            <button class="btn-edit" onclick="editarMetodo('${m.metodo_pago_id}')"><i class="fas fa-edit"></i></button>
                            <button class="btn-delete" onclick="eliminarMetodo('${m.metodo_pago_id}')"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `).join('');
        } else {
            tabla.innerHTML = `<tr><td colspan="5"><div class="empty-state"><i class="fas fa-credit-card"></i><p>No hay métodos</p></div></td></tr>`;
        }
    } catch (e) { tabla.innerHTML = `<tr><td colspan="5"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error</p></div></td></tr>`; }
}

function abrirModalMetodo() {
    document.getElementById('formMetodo').reset();
    document.getElementById('metodoId').value = '';
    document.getElementById('modalMetodoTitulo').textContent = 'Nuevo Método de Pago';
    document.getElementById('metActivo').checked = true;
    abrirModal('modalMetodo');
}

function editarMetodo(id) {
    const m = metodosData.find(x => x.metodo_pago_id == id);
    if (!m) return;
    document.getElementById('metodoId').value = m.metodo_pago_id;
    document.getElementById('metNombre').value = m.nombre || '';
    document.getElementById('metClave').value = m.clave_sat || '99';
    document.getElementById('metReferencia').checked = m.requiere_referencia === 'Y';
    document.getElementById('metActivo').checked = m.activo === 'Y';
    document.getElementById('modalMetodoTitulo').textContent = 'Editar Método de Pago';
    abrirModal('modalMetodo');
}

async function guardarMetodo(ev) {
    ev.preventDefault();
    const id = document.getElementById('metodoId').value;
    const data = {
        empresa_id: empresaId,
        nombre: document.getElementById('metNombre').value,
        clave_sat: document.getElementById('metClave').value,
        requiere_referencia: document.getElementById('metReferencia').checked ? 'Y' : 'N',
        activo: document.getElementById('metActivo').checked ? 'Y' : 'N'
    };
    
    try {
        const r = await API.request(id ? `/metodos-pago/${id}` : '/metodos-pago', id ? 'PUT' : 'POST', data);
        if (r.success) {
            toast(id ? 'Método actualizado' : 'Método creado', 'success');
            cerrarModal('modalMetodo');
            cargarMetodos();
        } else { toast(r.error || 'Error', 'error'); }
    } catch (e) { toast('Error al guardar', 'error'); }
}

async function eliminarMetodo(id) {
    if (!confirm('¿Eliminar este método?')) return;
    try {
        const r = await API.request(`/metodos-pago/${id}`, 'DELETE');
        toast(r.success ? 'Método eliminado' : 'Error', r.success ? 'success' : 'error');
        if (r.success) cargarMetodos();
    } catch (e) { toast('Error', 'error'); }
}

// ==================== UNIDADES (Solo lectura) ====================
async function cargarUnidades() {
    const tabla = document.getElementById('tablaUnidades');
    if (!tabla) return;
    tabla.innerHTML = `<tr class="loading-row"><td colspan="4"><div class="spinner"></div>Cargando...</td></tr>`;
    
    try {
        const r = await API.request(`/unidades/${empresaId}`);
        if (r.success && r.unidades?.length) {
            unidadesData = r.unidades;
            tabla.innerHTML = r.unidades.map(u => `
                <tr>
                    <td><strong>${u.nombre}</strong></td>
                    <td>${u.abreviatura || '-'}</td>
                    <td>${u.clave_sat || '-'}</td>
                    <td class="center"><span class="badge badge-${u.activo === 'Y' ? 'success' : 'danger'}">${u.activo === 'Y' ? 'Activa' : 'Inactiva'}</span></td>
                </tr>
            `).join('');
        } else {
            tabla.innerHTML = `<tr><td colspan="4"><div class="empty-state"><i class="fas fa-balance-scale"></i><p>No hay unidades</p></div></td></tr>`;
        }
    } catch (e) { tabla.innerHTML = `<tr><td colspan="4"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error</p></div></td></tr>`; }
}

// ==================== CATEGORÍAS ====================
async function cargarCategorias() {
    const tabla = document.getElementById('tablaCategorias');
    if (!tabla) return;
    tabla.innerHTML = `<tr class="loading-row"><td colspan="6"><div class="spinner"></div>Cargando...</td></tr>`;
    
    try {
        const r = await API.request(`/categorias/${empresaId}`);
        if (r.success && r.categorias?.length) {
            categoriasData = r.categorias;
            tabla.innerHTML = categoriasData.map(c => `
                <tr>
                    <td>${c.codigo || '-'}</td>
                    <td><strong>${c.nombre}</strong></td>
                    <td><span style="display:inline-block;width:20px;height:20px;background:${c.color || '#3498db'};border-radius:4px;vertical-align:middle"></span> ${c.color || '#3498db'}</td>
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
        } else {
            categoriasData = [];
            tabla.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-folder"></i><p>No hay categorías</p></div></td></tr>`;
        }
    } catch (e) { tabla.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error</p></div></td></tr>`; }
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
    const c = categoriasData.find(x => x.categoria_id == id);
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
    const tabla = document.getElementById('tablaSubcategorias');
    if (!tabla) return;
    tabla.innerHTML = `<tr class="loading-row"><td colspan="6"><div class="spinner"></div>Cargando...</td></tr>`;
    
    try {
        const r = await API.request(`/subcategorias/${empresaId}`);
        if (r.success && r.subcategorias?.length) {
            subcategoriasData = r.subcategorias;
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
        } else {
            subcategoriasData = [];
            tabla.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-folder-tree"></i><p>No hay subcategorías</p></div></td></tr>`;
        }
    } catch (e) { tabla.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error</p></div></td></tr>`; }
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
    const s = subcategoriasData.find(x => x.subcategoria_id == id);
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
    if (!sel) return;
    sel.innerHTML = '<option value="">Seleccionar...</option>' + categoriasData.filter(c => c.activo === 'Y').map(c => `<option value="${c.categoria_id}" ${c.categoria_id == selected ? 'selected' : ''}>${c.nombre}</option>`).join('');
}

// ==================== MARCAS ====================
async function cargarMarcas() {
    const tabla = document.getElementById('tablaMarcas');
    if (!tabla) return;
    tabla.innerHTML = `<tr class="loading-row"><td colspan="4"><div class="spinner"></div>Cargando...</td></tr>`;
    
    try {
        const r = await API.request(`/marcas/${empresaId}`);
        if (r.success && r.marcas?.length) {
            marcasData = r.marcas;
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
        } else {
            marcasData = [];
            tabla.innerHTML = `<tr><td colspan="4"><div class="empty-state"><i class="fas fa-tag"></i><p>No hay marcas</p></div></td></tr>`;
        }
    } catch (e) { tabla.innerHTML = `<tr><td colspan="4"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error</p></div></td></tr>`; }
}

function abrirModalMarca() {
    document.getElementById('formMarca').reset();
    document.getElementById('marcaId').value = '';
    document.getElementById('modalMarcaTitulo').textContent = 'Nueva Marca';
    document.getElementById('mrcActivo').checked = true;
    abrirModal('modalMarca');
}

function editarMarca(id) {
    const m = marcasData.find(x => x.marca_id == id);
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
    const tabla = document.getElementById('tablaGrupos');
    if (!tabla) return;
    tabla.innerHTML = `<tr class="loading-row"><td colspan="5"><div class="spinner"></div>Cargando...</td></tr>`;
    
    try {
        const r = await API.request(`/grupos-cliente/${empresaId}`);
        if (r.success && r.grupos?.length) {
            gruposData = r.grupos;
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
        } else {
            gruposData = [];
            tabla.innerHTML = `<tr><td colspan="5"><div class="empty-state"><i class="fas fa-users-cog"></i><p>No hay grupos</p></div></td></tr>`;
        }
    } catch (e) { tabla.innerHTML = `<tr><td colspan="5"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error</p></div></td></tr>`; }
}

function abrirModalGrupo() {
    document.getElementById('formGrupo').reset();
    document.getElementById('grupoId').value = '';
    document.getElementById('modalGrupoTitulo').textContent = 'Nuevo Grupo';
    document.getElementById('grpActivo').checked = true;
    abrirModal('modalGrupo');
}

function editarGrupo(id) {
    const g = gruposData.find(x => x.grupo_id == id);
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
    const tabla = document.getElementById('tablaProveedores');
    if (!tabla) return;
    tabla.innerHTML = `<tr class="loading-row"><td colspan="7"><div class="spinner"></div>Cargando...</td></tr>`;
    
    try {
        const r = await API.request(`/proveedores/${empresaId}`);
        if (r.success && r.proveedores?.length) {
            proveedoresData = r.proveedores;
            tabla.innerHTML = proveedoresData.map(p => `
                <tr>
                    <td>${p.codigo || '-'}</td>
                    <td><strong>${p.nombre_comercial || p.razon_social}</strong></td>
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
        } else {
            proveedoresData = [];
            tabla.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fas fa-truck"></i><p>No hay proveedores</p></div></td></tr>`;
        }
    } catch (e) { tabla.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error</p></div></td></tr>`; }
}

function abrirModalProveedor() {
    document.getElementById('formProveedor').reset();
    document.getElementById('proveedorId').value = '';
    document.getElementById('modalProveedorTitulo').textContent = 'Nuevo Proveedor';
    document.getElementById('provActivo').checked = true;
    abrirModal('modalProveedor');
}

function editarProveedor(id) {
    const p = proveedoresData.find(x => x.proveedor_id == id);
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
    const tabla = document.getElementById('tablaCuentas');
    if (!tabla) return;
    tabla.innerHTML = `<tr class="loading-row"><td colspan="7"><div class="spinner"></div>Cargando...</td></tr>`;
    
    try {
        const r = await API.request(`/cuentas-bancarias/${empresaId}`);
        if (r.success && r.cuentas?.length) {
            cuentasData = r.cuentas;
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
        } else {
            cuentasData = [];
            tabla.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fas fa-university"></i><p>No hay cuentas</p></div></td></tr>`;
        }
    } catch (e) { tabla.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error</p></div></td></tr>`; }
}

function abrirModalCuenta() {
    document.getElementById('formCuenta').reset();
    document.getElementById('cuentaId').value = '';
    document.getElementById('modalCuentaTitulo').textContent = 'Nueva Cuenta';
    document.getElementById('ctaActiva').checked = true;
    abrirModal('modalCuenta');
}

function editarCuenta(id) {
    const c = cuentasData.find(x => x.cuenta_id == id);
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
    const tabla = document.getElementById('tablaCategoriasGasto');
    if (!tabla) return;
    tabla.innerHTML = `<tr class="loading-row"><td colspan="5"><div class="spinner"></div>Cargando...</td></tr>`;
    
    try {
        const r = await API.request(`/categorias-gasto/${empresaId}`);
        if (r.success && r.categorias?.length) {
            categoriasGastoData = r.categorias;
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
        } else {
            categoriasGastoData = [];
            tabla.innerHTML = `<tr><td colspan="5"><div class="empty-state"><i class="fas fa-receipt"></i><p>No hay categorías</p></div></td></tr>`;
        }
    } catch (e) { tabla.innerHTML = `<tr><td colspan="5"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error</p></div></td></tr>`; }
}

function abrirModalCategoriaGasto() {
    document.getElementById('formCategoriaGasto').reset();
    document.getElementById('categoriaGastoId').value = '';
    document.getElementById('modalCategoriaGastoTitulo').textContent = 'Nueva Categoría de Gasto';
    document.getElementById('catgActivo').checked = true;
    abrirModal('modalCategoriaGasto');
}

function editarCategoriaGasto(id) {
    const c = categoriasGastoData.find(x => x.categoria_gasto_id == id);
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
    const tabla = document.getElementById('tablaConceptosGasto');
    if (!tabla) return;
    tabla.innerHTML = `<tr class="loading-row"><td colspan="6"><div class="spinner"></div>Cargando...</td></tr>`;
    
    try {
        const r = await API.request(`/conceptos-gasto/${empresaId}`);
        if (r.success && r.conceptos?.length) {
            conceptosGastoData = r.conceptos;
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
        } else {
            conceptosGastoData = [];
            tabla.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-file-invoice-dollar"></i><p>No hay conceptos</p></div></td></tr>`;
        }
    } catch (e) { tabla.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error</p></div></td></tr>`; }
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
    const c = conceptosGastoData.find(x => x.concepto_gasto_id == id);
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
    if (!sel) return;
    sel.innerHTML = '<option value="">Seleccionar...</option>' + categoriasGastoData.filter(c => c.activo === 'Y').map(c => `<option value="${c.categoria_gasto_id}" ${c.categoria_gasto_id == selected ? 'selected' : ''}>${c.nombre}</option>`).join('');
}

// ==================== UTILS ====================
function abrirModal(id) { document.getElementById(id)?.classList.add('active'); }
function cerrarModal(id) { document.getElementById(id)?.classList.remove('active'); }
function toast(msg, tipo = 'success') {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = `toast show ${tipo}`;
    setTimeout(() => t.classList.remove('show'), 3000);
}
