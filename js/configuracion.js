/* ============================================
   CONFIGURACION.JS - CAFI POS
   ============================================ */

const empresaId = localStorage.getItem('empresa_id') || (JSON.parse(localStorage.getItem('usuario') || '{}')).empresa_id || 1;
let sucursalesData = [];

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
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.config-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`panel-${tab}`).classList.add('active');
            cargarTab(tab);
        });
    });
}

function cargarTab(tab) {
    const loaders = {
        'empresa': cargarEmpresa,
        'sucursales': cargarSucursales,
        'usuarios': cargarUsuarios,
        'impuestos': cargarImpuestos,
        'metodos-pago': cargarMetodos,
        'unidades': cargarUnidades
    };
    if (loaders[tab]) loaders[tab]();
}

function initForms() {
    document.getElementById('formEmpresa').addEventListener('submit', guardarEmpresa);
    document.getElementById('formSucursal').addEventListener('submit', guardarSucursal);
    document.getElementById('formUsuario').addEventListener('submit', guardarUsuario);
    document.getElementById('formImpuesto').addEventListener('submit', guardarImpuesto);
    document.getElementById('formMetodo').addEventListener('submit', guardarMetodo);
    document.getElementById('formUnidad').addEventListener('submit', guardarUnidad);
}

// ==================== EMPRESA ====================
async function cargarEmpresa() {
    try {
        const r = await API.request(`/empresas/${empresaId}`);
        if (r.success && r.empresa) {
            const e = r.empresa;
            document.getElementById('empNombre').value = e.nombre || '';
            document.getElementById('empRfc').value = e.rfc || '';
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
            rfc: document.getElementById('empRfc').value,
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
                    <td class="text-center"><span class="badge badge-${s.activo === 'Y' ? 'success' : 'danger'}">${s.activo === 'Y' ? 'Activa' : 'Inactiva'}</span></td>
                    <td class="text-center">
                        <div class="btn-actions">
                            <button class="btn-edit" onclick="editarSucursal(${s.sucursal_id})"><i class="fas fa-edit"></i></button>
                            <button class="btn-delete" onclick="eliminarSucursal(${s.sucursal_id})"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `).join('');
            cargarSelectSucursales();
        } else {
            tabla.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-store"></i><p>No hay sucursales</p></div></td></tr>`;
        }
    } catch (e) { tabla.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error</p></div></td></tr>`; }
}

function cargarSelectSucursales() {
    const sel = document.getElementById('usrSucursal');
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
let usuariosData = [];

async function cargarUsuarios() {
    const tabla = document.getElementById('tablaUsuarios');
    tabla.innerHTML = `<tr class="loading-row"><td colspan="7"><div class="spinner"></div>Cargando...</td></tr>`;
    
    if (!sucursalesData.length) await cargarSucursales();
    
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
                    <td class="text-center"><span class="badge badge-${u.activo === 'Y' ? 'success' : 'danger'}">${u.activo === 'Y' ? 'Activo' : 'Inactivo'}</span></td>
                    <td class="text-center">
                        <div class="btn-actions">
                            <button class="btn-edit" onclick="editarUsuario(${u.usuario_id})"><i class="fas fa-edit"></i></button>
                            <button class="btn-delete" onclick="eliminarUsuario(${u.usuario_id})"><i class="fas fa-trash"></i></button>
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
    
    if (pass && pass !== pass2) {
        toast('Las contraseñas no coinciden', 'error');
        return;
    }
    
    if (!id && !pass) {
        toast('La contraseña es requerida', 'error');
        return;
    }
    
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
        } else {
            toast(r.error || 'Error', 'error');
        }
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
let impuestosData = [];

async function cargarImpuestos() {
    const tabla = document.getElementById('tablaImpuestos');
    tabla.innerHTML = `<tr class="loading-row"><td colspan="6"><div class="spinner"></div>Cargando...</td></tr>`;
    
    try {
        const r = await API.request(`/impuestos/${empresaId}`);
        if (r.success && r.impuestos?.length) {
            impuestosData = r.impuestos;
            tabla.innerHTML = r.impuestos.map(i => `
                <tr>
                    <td><strong>${i.nombre}</strong></td>
                    <td>${i.clave_sat || '-'}</td>
                    <td class="text-center">${i.tasa}%</td>
                    <td class="text-center">${i.es_defecto === 'Y' ? '<i class="fas fa-check-circle" style="color:#22c55e"></i>' : '-'}</td>
                    <td class="text-center"><span class="badge badge-${i.activo === 'Y' ? 'success' : 'danger'}">${i.activo === 'Y' ? 'Activo' : 'Inactivo'}</span></td>
                    <td class="text-center">
                        <div class="btn-actions">
                            <button class="btn-edit" onclick="editarImpuesto(${i.impuesto_id})"><i class="fas fa-edit"></i></button>
                            <button class="btn-delete" onclick="eliminarImpuesto(${i.impuesto_id})"><i class="fas fa-trash"></i></button>
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
        } else {
            toast(r.error || 'Error', 'error');
        }
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
let metodosData = [];

async function cargarMetodos() {
    const tabla = document.getElementById('tablaMetodos');
    tabla.innerHTML = `<tr class="loading-row"><td colspan="5"><div class="spinner"></div>Cargando...</td></tr>`;
    
    try {
        const r = await API.request(`/metodos-pago/${empresaId}`);
        if (r.success && r.metodos?.length) {
            metodosData = r.metodos;
            tabla.innerHTML = r.metodos.map(m => `
                <tr>
                    <td><strong>${m.nombre}</strong></td>
                    <td>${m.clave_sat || '-'}</td>
                    <td class="text-center">${m.requiere_referencia === 'Y' ? '<i class="fas fa-check" style="color:#22c55e"></i>' : '-'}</td>
                    <td class="text-center"><span class="badge badge-${m.activo === 'Y' ? 'success' : 'danger'}">${m.activo === 'Y' ? 'Activo' : 'Inactivo'}</span></td>
                    <td class="text-center">
                        <div class="btn-actions">
                            <button class="btn-edit" onclick="editarMetodo(${m.metodo_pago_id})"><i class="fas fa-edit"></i></button>
                            <button class="btn-delete" onclick="eliminarMetodo(${m.metodo_pago_id})"><i class="fas fa-trash"></i></button>
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
        } else {
            toast(r.error || 'Error', 'error');
        }
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

// ==================== UNIDADES ====================
let unidadesData = [];

async function cargarUnidades() {
    const tabla = document.getElementById('tablaUnidades');
    tabla.innerHTML = `<tr class="loading-row"><td colspan="5"><div class="spinner"></div>Cargando...</td></tr>`;
    
    try {
        const r = await API.request(`/unidades/${empresaId}`);
        if (r.success && r.unidades?.length) {
            unidadesData = r.unidades;
            tabla.innerHTML = r.unidades.map(u => `
                <tr>
                    <td><strong>${u.nombre}</strong></td>
                    <td>${u.abreviatura || '-'}</td>
                    <td>${u.clave_sat || '-'}</td>
                    <td class="text-center"><span class="badge badge-${u.activo === 'Y' ? 'success' : 'danger'}">${u.activo === 'Y' ? 'Activa' : 'Inactiva'}</span></td>
                    <td class="text-center">
                        <div class="btn-actions">
                            <button class="btn-edit" onclick="editarUnidad(${u.unidad_id})"><i class="fas fa-edit"></i></button>
                            <button class="btn-delete" onclick="eliminarUnidad(${u.unidad_id})"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `).join('');
        } else {
            tabla.innerHTML = `<tr><td colspan="5"><div class="empty-state"><i class="fas fa-balance-scale"></i><p>No hay unidades</p></div></td></tr>`;
        }
    } catch (e) { tabla.innerHTML = `<tr><td colspan="5"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error</p></div></td></tr>`; }
}

function abrirModalUnidad() {
    document.getElementById('formUnidad').reset();
    document.getElementById('unidadId').value = '';
    document.getElementById('modalUnidadTitulo').textContent = 'Nueva Unidad';
    document.getElementById('uniActivo').checked = true;
    abrirModal('modalUnidad');
}

function editarUnidad(id) {
    const u = unidadesData.find(x => x.unidad_id == id);
    if (!u) return;
    document.getElementById('unidadId').value = u.unidad_id;
    document.getElementById('uniNombre').value = u.nombre || '';
    document.getElementById('uniAbrev').value = u.abreviatura || '';
    document.getElementById('uniClave').value = u.clave_sat || '';
    document.getElementById('uniActivo').checked = u.activo === 'Y';
    document.getElementById('modalUnidadTitulo').textContent = 'Editar Unidad';
    abrirModal('modalUnidad');
}

async function guardarUnidad(ev) {
    ev.preventDefault();
    const id = document.getElementById('unidadId').value;
    const data = {
        empresa_id: empresaId,
        nombre: document.getElementById('uniNombre').value,
        abreviatura: document.getElementById('uniAbrev').value,
        clave_sat: document.getElementById('uniClave').value,
        activo: document.getElementById('uniActivo').checked ? 'Y' : 'N'
    };
    
    try {
        const r = await API.request(id ? `/unidades/${id}` : '/unidades', id ? 'PUT' : 'POST', data);
        if (r.success) {
            toast(id ? 'Unidad actualizada' : 'Unidad creada', 'success');
            cerrarModal('modalUnidad');
            cargarUnidades();
        } else {
            toast(r.error || 'Error', 'error');
        }
    } catch (e) { toast('Error al guardar', 'error'); }
}

async function eliminarUnidad(id) {
    if (!confirm('¿Eliminar esta unidad?')) return;
    try {
        const r = await API.request(`/unidades/${id}`, 'DELETE');
        toast(r.success ? 'Unidad eliminada' : 'Error', r.success ? 'success' : 'error');
        if (r.success) cargarUnidades();
    } catch (e) { toast('Error', 'error'); }
}

// ==================== UTILS ====================
function abrirModal(id) { document.getElementById(id).classList.add('active'); }
function cerrarModal(id) { document.getElementById(id).classList.remove('active'); }
function toast(msg, tipo = 'success') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = `toast show ${tipo}`;
    setTimeout(() => t.classList.remove('show'), 3000);
}
