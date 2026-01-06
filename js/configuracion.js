// ==================== VARIABLES GLOBALES ====================
const empresaId = localStorage.getItem('empresa_id') || 'DEMO';
let sucursalesData = [];
let usuariosData = [];
let impuestosData = [];
let metodosData = [];
let unidadesData = [];

// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('empresaNombre').textContent = localStorage.getItem('empresa_nombre') || 'Mi Empresa';
    initTabs();
    initForms();
    cargarTab('empresa');
});

function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.config-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            const tab = btn.dataset.tab;
            document.getElementById(`panel-${tab}`).classList.add('active');
            cargarTab(tab);
        });
    });
}

function initForms() {
    document.getElementById('formEmpresa').addEventListener('submit', guardarEmpresa);
    document.getElementById('formSucursal').addEventListener('submit', guardarSucursal);
    document.getElementById('formUsuario').addEventListener('submit', guardarUsuario);
    document.getElementById('formImpuesto').addEventListener('submit', guardarImpuesto);
    document.getElementById('formMetodo').addEventListener('submit', guardarMetodo);
    document.getElementById('formUnidad').addEventListener('submit', guardarUnidad);
}

// ==================== CARGAR TABS ====================
async function cargarTab(tab) {
    switch(tab) {
        case 'empresa': await cargarEmpresa(); break;
        case 'sucursales': await cargarSucursales(); break;
        case 'usuarios': await cargarUsuarios(); break;
        case 'impuestos': await cargarImpuestos(); break;
        case 'metodos': await cargarMetodos(); break;
        case 'unidades': await cargarUnidades(); break;
    }
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
    } catch (e) {
        console.error('Error cargando empresa:', e);
    }
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
        if (r.success) {
            toast('Empresa actualizada', 'success');
            localStorage.setItem('empresa_nombre', data.nombre);
            document.getElementById('empresaNombre').textContent = data.nombre;
        } else {
            toast(r.error || 'Error al guardar', 'error');
        }
    } catch (e) {
        toast('Error: ' + e.message, 'error');
    }
}

// ==================== SUCURSALES ====================
async function cargarSucursales() {
    try {
        const r = await API.request(`/sucursales/${empresaId}`);
        if (r.success) {
            sucursalesData = r.sucursales || [];
            const tabla = document.getElementById('tablaSucursales');
            if (sucursalesData.length === 0) {
                tabla.innerHTML = '<tr><td colspan="8" class="empty-state"><i class="fas fa-store"></i><p>No hay sucursales</p></td></tr>';
                return;
            }
            tabla.innerHTML = sucursalesData.map(s => {
                const activa = s.activo === 'Y' || s.activa === 'Y';
                const horario = (s.horario_apertura && s.horario_cierre) 
                    ? `${s.horario_apertura.substring(0,5)} - ${s.horario_cierre.substring(0,5)}` 
                    : '-';
                return `
                <tr>
                    <td>${s.codigo || '-'}</td>
                    <td><strong>${s.nombre}</strong></td>
                    <td><span class="badge badge-info">${s.tipo || 'TIENDA'}</span></td>
                    <td>${s.ciudad || '-'}</td>
                    <td>${s.responsable || '-'}</td>
                    <td>${horario}</td>
                    <td class="text-center"><span class="badge badge-${activa ? 'success' : 'danger'}">${activa ? 'Activa' : 'Inactiva'}</span></td>
                    <td class="text-center">
                        <div class="btn-actions">
                            <button class="btn-edit" onclick="editarSucursal('${s.sucursal_id}')"><i class="fas fa-edit"></i></button>
                            <button class="btn-delete" onclick="eliminarSucursal('${s.sucursal_id}')"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `}).join('');
        }
    } catch (e) {
        console.error('Error cargando sucursales:', e);
    }
}

function abrirModalSucursal() {
    document.getElementById('formSucursal').reset();
    document.getElementById('sucursalId').value = '';
    document.getElementById('modalSucursalTitulo').textContent = 'Nueva Sucursal';
    document.getElementById('sucActivo').checked = true;
    document.getElementById('sucPermiteVenta').checked = true;
    document.getElementById('sucPermiteCompra').checked = true;
    document.getElementById('sucPermiteTraspaso').checked = true;
    document.getElementById('sucHoraApertura').value = '09:00';
    document.getElementById('sucHoraCierre').value = '20:00';
    // Días por defecto
    ['L','M','X','J','V','S'].forEach(d => document.getElementById('dia'+d).checked = true);
    document.getElementById('diaD').checked = false;
    abrirModal('modalSucursal');
}

function editarSucursal(id) {
    const s = sucursalesData.find(x => x.sucursal_id === id);
    if (!s) return;
    document.getElementById('sucursalId').value = s.sucursal_id;
    document.getElementById('sucCodigo').value = s.codigo || '';
    document.getElementById('sucNombre').value = s.nombre || '';
    document.getElementById('sucTipo').value = s.tipo || 'TIENDA';
    document.getElementById('sucResponsable').value = s.responsable || '';
    document.getElementById('sucDireccion').value = s.direccion || '';
    document.getElementById('sucColonia').value = s.colonia || '';
    document.getElementById('sucCiudad').value = s.ciudad || '';
    document.getElementById('sucEstado').value = s.estado || '';
    document.getElementById('sucCP').value = s.codigo_postal || '';
    document.getElementById('sucTelefono').value = s.telefono || '';
    document.getElementById('sucEmail').value = s.email || '';
    document.getElementById('sucHoraApertura').value = s.horario_apertura ? s.horario_apertura.substring(0,5) : '09:00';
    document.getElementById('sucHoraCierre').value = s.horario_cierre ? s.horario_cierre.substring(0,5) : '20:00';
    
    // Días de operación
    const dias = s.dias_operacion || 'L,M,X,J,V,S';
    ['L','M','X','J','V','S','D'].forEach(d => {
        document.getElementById('dia'+d).checked = dias.includes(d);
    });
    
    document.getElementById('sucPermiteVenta').checked = s.permite_venta === 'Y';
    document.getElementById('sucPermiteCompra').checked = s.permite_compra === 'Y';
    document.getElementById('sucPermiteTraspaso').checked = s.permite_traspaso === 'Y';
    document.getElementById('sucActivo').checked = s.activo === 'Y' || s.activa === 'Y';
    
    document.getElementById('modalSucursalTitulo').textContent = 'Editar Sucursal';
    abrirModal('modalSucursal');
}

async function guardarSucursal(ev) {
    ev.preventDefault();
    const id = document.getElementById('sucursalId').value;
    
    // Construir días de operación
    const dias = [];
    ['L','M','X','J','V','S','D'].forEach(d => {
        if (document.getElementById('dia'+d).checked) dias.push(d);
    });
    
    const data = {
        empresa_id: empresaId,
        codigo: document.getElementById('sucCodigo').value,
        nombre: document.getElementById('sucNombre').value,
        tipo: document.getElementById('sucTipo').value,
        responsable: document.getElementById('sucResponsable').value,
        direccion: document.getElementById('sucDireccion').value,
        colonia: document.getElementById('sucColonia').value,
        ciudad: document.getElementById('sucCiudad').value,
        estado: document.getElementById('sucEstado').value,
        codigo_postal: document.getElementById('sucCP').value,
        telefono: document.getElementById('sucTelefono').value,
        email: document.getElementById('sucEmail').value,
        horario_apertura: document.getElementById('sucHoraApertura').value,
        horario_cierre: document.getElementById('sucHoraCierre').value,
        dias_operacion: dias.join(','),
        permite_venta: document.getElementById('sucPermiteVenta').checked ? 'Y' : 'N',
        permite_compra: document.getElementById('sucPermiteCompra').checked ? 'Y' : 'N',
        permite_traspaso: document.getElementById('sucPermiteTraspaso').checked ? 'Y' : 'N',
        activo: document.getElementById('sucActivo').checked ? 'Y' : 'N'
    };
    
    try {
        const url = id ? `/sucursales/${id}` : '/sucursales';
        const method = id ? 'PUT' : 'POST';
        const r = await API.request(url, method, data);
        if (r.success) {
            toast(id ? 'Sucursal actualizada' : 'Sucursal creada', 'success');
            cerrarModal('modalSucursal');
            await cargarSucursales();
        } else {
            toast(r.error || 'Error al guardar', 'error');
        }
    } catch (e) {
        toast('Error: ' + e.message, 'error');
    }
}

async function eliminarSucursal(id) {
    if (!confirm('¿Desactivar esta sucursal?')) return;
    try {
        const r = await API.request(`/sucursales/${id}`, 'DELETE');
        if (r.success) {
            toast('Sucursal desactivada', 'success');
            await cargarSucursales();
        }
    } catch (e) {
        toast('Error: ' + e.message, 'error');
    }
}

// ==================== USUARIOS ====================
async function cargarUsuarios() {
    // Cargar sucursales primero para el select
    if (sucursalesData.length === 0) {
        const r = await API.request(`/sucursales/${empresaId}`);
        if (r.success) sucursalesData = r.sucursales || [];
    }
    cargarSelectSucursales();
    
    try {
        const r = await API.request(`/usuarios/${empresaId}`);
        if (r.success) {
            usuariosData = r.usuarios || [];
            const tabla = document.getElementById('tablaUsuarios');
            if (usuariosData.length === 0) {
                tabla.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="fas fa-users"></i><p>No hay usuarios</p></td></tr>';
                return;
            }
            tabla.innerHTML = usuariosData.map(u => `
                <tr>
                    <td><strong>${u.nombre}</strong></td>
                    <td>${u.email}</td>
                    <td><span class="badge badge-${getRolColor(u.rol)}">${u.rol}</span></td>
                    <td>${u.sucursal_nombre || '-'}</td>
                    <td class="text-center"><span class="badge badge-${u.activo === 'Y' ? 'success' : 'danger'}">${u.activo === 'Y' ? 'Activo' : 'Inactivo'}</span></td>
                    <td class="text-center">
                        <div class="btn-actions">
                            <button class="btn-edit" onclick="editarUsuario('${u.usuario_id}')"><i class="fas fa-edit"></i></button>
                            <button class="btn-delete" onclick="eliminarUsuario('${u.usuario_id}')"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }
    } catch (e) {
        console.error('Error cargando usuarios:', e);
    }
}

function getRolColor(rol) {
    const colors = { 
        SuperAdmin: 'danger', 
        Admin: 'purple', 
        Gerente: 'info', 
        Supervisor: 'info',
        Cajero: 'success', 
        Almacenista: 'warning',
        Vendedor: 'success',
        Contador: 'warning',
        Solo_Lectura: 'secondary'
    };
    return colors[rol] || 'info';
}

function cargarSelectSucursales() {
    const sel = document.getElementById('usrSucursal');
    sel.innerHTML = '<option value="">Seleccionar...</option>';
    sucursalesData.forEach(s => {
        if (s.activo === 'Y' || s.activa === 'Y') {
            sel.innerHTML += `<option value="${s.sucursal_id}">${s.nombre}</option>`;
        }
    });
}

function abrirModalUsuario() {
    document.getElementById('formUsuario').reset();
    document.getElementById('usuarioId').value = '';
    document.getElementById('modalUsuarioTitulo').textContent = 'Nuevo Usuario';
    document.getElementById('lblPassword').textContent = 'Contraseña *';
    document.getElementById('usrPassword').required = true;
    document.getElementById('usrEmail').disabled = false;
    document.getElementById('usrActivo').checked = true;
    abrirModal('modalUsuario');
}

function editarUsuario(id) {
    const u = usuariosData.find(x => x.usuario_id === id);
    if (!u) return;
    document.getElementById('usuarioId').value = u.usuario_id;
    document.getElementById('usrNombre').value = u.nombre || '';
    document.getElementById('usrEmail').value = u.email || '';
    document.getElementById('usrEmail').disabled = true;
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
        rol: document.getElementById('usrRol').value,
        sucursal_id: document.getElementById('usrSucursal').value,
        activo: document.getElementById('usrActivo').checked ? 'Y' : 'N'
    };
    
    if (!id) {
        data.email = document.getElementById('usrEmail').value;
    }
    
    if (pass) data.contrasena = pass;
    
    try {
        const url = id ? `/usuarios/${id}` : '/usuarios';
        const method = id ? 'PUT' : 'POST';
        const r = await API.request(url, method, data);
        if (r.success) {
            toast(id ? 'Usuario actualizado' : 'Usuario creado', 'success');
            cerrarModal('modalUsuario');
            await cargarUsuarios();
        } else {
            toast(r.error || 'Error al guardar', 'error');
        }
    } catch (e) {
        toast('Error: ' + e.message, 'error');
    }
}

async function eliminarUsuario(id) {
    if (!confirm('¿Desactivar este usuario?')) return;
    try {
        const r = await API.request(`/usuarios/${id}`, 'DELETE');
        if (r.success) {
            toast('Usuario desactivado', 'success');
            await cargarUsuarios();
        }
    } catch (e) {
        toast('Error: ' + e.message, 'error');
    }
}

// ==================== IMPUESTOS ====================
async function cargarImpuestos() {
    try {
        const r = await API.request(`/impuestos/${empresaId}/todos`);
        if (r.success) {
            impuestosData = r.impuestos || [];
            const tabla = document.getElementById('tablaImpuestos');
            if (impuestosData.length === 0) {
                tabla.innerHTML = '<tr><td colspan="8" class="empty-state"><i class="fas fa-percent"></i><p>No hay impuestos</p></td></tr>';
                return;
            }
            tabla.innerHTML = impuestosData.map(i => {
                const valor = i.tipo === 'PORCENTAJE' ? `${i.valor}%` : `$${parseFloat(i.valor).toFixed(2)}`;
                return `
                <tr>
                    <td><strong>${i.nombre}</strong></td>
                    <td><span class="badge badge-info">${i.tipo}</span></td>
                    <td class="text-center">${valor}</td>
                    <td class="text-center">${i.incluido_en_precio === 'Y' ? '<i class="fas fa-check text-success"></i>' : '-'}</td>
                    <td class="text-center">${i.aplica_ventas === 'Y' ? '<i class="fas fa-check text-success"></i>' : '-'}</td>
                    <td class="text-center">${i.aplica_compras === 'Y' ? '<i class="fas fa-check text-success"></i>' : '-'}</td>
                    <td class="text-center"><span class="badge badge-${i.activo === 'Y' ? 'success' : 'danger'}">${i.activo === 'Y' ? 'Activo' : 'Inactivo'}</span></td>
                    <td class="text-center">
                        <div class="btn-actions">
                            <button class="btn-edit" onclick="editarImpuesto('${i.impuesto_id}')"><i class="fas fa-edit"></i></button>
                            <button class="btn-delete" onclick="eliminarImpuesto('${i.impuesto_id}')"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `}).join('');
        }
    } catch (e) {
        console.error('Error cargando impuestos:', e);
    }
}

function abrirModalImpuesto() {
    document.getElementById('formImpuesto').reset();
    document.getElementById('impuestoId').value = '';
    document.getElementById('modalImpuestoTitulo').textContent = 'Nuevo Impuesto';
    document.getElementById('impActivo').checked = true;
    document.getElementById('impIncluidoPrecio').checked = true;
    document.getElementById('impAplicaVentas').checked = true;
    document.getElementById('impAplicaCompras').checked = true;
    abrirModal('modalImpuesto');
}

function editarImpuesto(id) {
    const i = impuestosData.find(x => x.impuesto_id === id);
    if (!i) return;
    document.getElementById('impuestoId').value = i.impuesto_id;
    document.getElementById('impNombre').value = i.nombre || '';
    document.getElementById('impTipo').value = i.tipo || 'PORCENTAJE';
    document.getElementById('impValor').value = i.valor || 0;
    document.getElementById('impCuenta').value = i.cuenta_contable || '';
    document.getElementById('impIncluidoPrecio').checked = i.incluido_en_precio === 'Y';
    document.getElementById('impAplicaVentas').checked = i.aplica_ventas === 'Y';
    document.getElementById('impAplicaCompras').checked = i.aplica_compras === 'Y';
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
        tipo: document.getElementById('impTipo').value,
        valor: document.getElementById('impValor').value,
        cuenta_contable: document.getElementById('impCuenta').value,
        incluido_en_precio: document.getElementById('impIncluidoPrecio').checked ? 'Y' : 'N',
        aplica_ventas: document.getElementById('impAplicaVentas').checked ? 'Y' : 'N',
        aplica_compras: document.getElementById('impAplicaCompras').checked ? 'Y' : 'N',
        activo: document.getElementById('impActivo').checked ? 'Y' : 'N'
    };
    
    try {
        const url = id ? `/impuestos/${id}` : '/impuestos';
        const method = id ? 'PUT' : 'POST';
        const r = await API.request(url, method, data);
        if (r.success) {
            toast(id ? 'Impuesto actualizado' : 'Impuesto creado', 'success');
            cerrarModal('modalImpuesto');
            await cargarImpuestos();
        } else {
            toast(r.error || 'Error al guardar', 'error');
        }
    } catch (e) {
        toast('Error: ' + e.message, 'error');
    }
}

async function eliminarImpuesto(id) {
    if (!confirm('¿Desactivar este impuesto?')) return;
    try {
        const r = await API.request(`/impuestos/${id}`, 'DELETE');
        if (r.success) {
            toast('Impuesto desactivado', 'success');
            await cargarImpuestos();
        }
    } catch (e) {
        toast('Error: ' + e.message, 'error');
    }
}

// ==================== MÉTODOS DE PAGO ====================
async function cargarMetodos() {
    try {
        const r = await API.request(`/metodos-pago/${empresaId}/todos`);
        if (r.success) {
            metodosData = r.metodos || [];
            const tabla = document.getElementById('tablaMetodos');
            if (metodosData.length === 0) {
                tabla.innerHTML = '<tr><td colspan="8" class="empty-state"><i class="fas fa-credit-card"></i><p>No hay métodos de pago</p></td></tr>';
                return;
            }
            tabla.innerHTML = metodosData.map(m => `
                <tr>
                    <td><strong>${m.nombre}</strong></td>
                    <td><span class="badge badge-info">${m.tipo || 'EFECTIVO'}</span></td>
                    <td class="text-center">${m.requiere_referencia === 'Y' ? '<i class="fas fa-check text-success"></i>' : '-'}</td>
                    <td class="text-center">${m.permite_cambio === 'Y' ? '<i class="fas fa-check text-success"></i>' : '-'}</td>
                    <td class="text-center">${parseFloat(m.comision_porcentaje || 0).toFixed(2)}%</td>
                    <td class="text-center">$${parseFloat(m.comision_fija || 0).toFixed(2)}</td>
                    <td class="text-center"><span class="badge badge-${m.activo === 'Y' ? 'success' : 'danger'}">${m.activo === 'Y' ? 'Activo' : 'Inactivo'}</span></td>
                    <td class="text-center">
                        <div class="btn-actions">
                            <button class="btn-edit" onclick="editarMetodo('${m.metodo_pago_id}')"><i class="fas fa-edit"></i></button>
                            <button class="btn-delete" onclick="eliminarMetodo('${m.metodo_pago_id}')"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }
    } catch (e) {
        console.error('Error cargando métodos:', e);
    }
}

function abrirModalMetodo() {
    document.getElementById('formMetodo').reset();
    document.getElementById('metodoId').value = '';
    document.getElementById('modalMetodoTitulo').textContent = 'Nuevo Método de Pago';
    document.getElementById('metActivo').checked = true;
    abrirModal('modalMetodo');
}

function editarMetodo(id) {
    const m = metodosData.find(x => x.metodo_pago_id === id);
    if (!m) return;
    document.getElementById('metodoId').value = m.metodo_pago_id;
    document.getElementById('metNombre').value = m.nombre || '';
    document.getElementById('metTipo').value = m.tipo || 'EFECTIVO';
    document.getElementById('metComisionPct').value = m.comision_porcentaje || 0;
    document.getElementById('metComisionFija').value = m.comision_fija || 0;
    document.getElementById('metCuenta').value = m.cuenta_contable || '';
    document.getElementById('metOrden').value = m.orden || 0;
    document.getElementById('metRequiereRef').checked = m.requiere_referencia === 'Y';
    document.getElementById('metPermiteCambio').checked = m.permite_cambio === 'Y';
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
        tipo: document.getElementById('metTipo').value,
        comision_porcentaje: document.getElementById('metComisionPct').value || 0,
        comision_fija: document.getElementById('metComisionFija').value || 0,
        cuenta_contable: document.getElementById('metCuenta').value,
        orden: document.getElementById('metOrden').value || 0,
        requiere_referencia: document.getElementById('metRequiereRef').checked ? 'Y' : 'N',
        permite_cambio: document.getElementById('metPermiteCambio').checked ? 'Y' : 'N',
        activo: document.getElementById('metActivo').checked ? 'Y' : 'N'
    };
    
    try {
        const url = id ? `/metodos-pago/${id}` : '/metodos-pago';
        const method = id ? 'PUT' : 'POST';
        const r = await API.request(url, method, data);
        if (r.success) {
            toast(id ? 'Método actualizado' : 'Método creado', 'success');
            cerrarModal('modalMetodo');
            await cargarMetodos();
        } else {
            toast(r.error || 'Error al guardar', 'error');
        }
    } catch (e) {
        toast('Error: ' + e.message, 'error');
    }
}

async function eliminarMetodo(id) {
    if (!confirm('¿Desactivar este método de pago?')) return;
    try {
        const r = await API.request(`/metodos-pago/${id}`, 'DELETE');
        if (r.success) {
            toast('Método desactivado', 'success');
            await cargarMetodos();
        }
    } catch (e) {
        toast('Error: ' + e.message, 'error');
    }
}

// ==================== UNIDADES DE MEDIDA ====================
async function cargarUnidades() {
    try {
        const r = await API.request(`/unidades/${empresaId}/todos`);
        if (r.success) {
            unidadesData = r.unidades || [];
            const tabla = document.getElementById('tablaUnidades');
            if (unidadesData.length === 0) {
                tabla.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="fas fa-balance-scale"></i><p>No hay unidades</p></td></tr>';
                return;
            }
            tabla.innerHTML = unidadesData.map(u => `
                <tr>
                    <td><strong>${u.nombre}</strong></td>
                    <td>${u.abreviatura}</td>
                    <td><span class="badge badge-info">${u.tipo || 'UNIDAD'}</span></td>
                    <td class="text-center">${u.es_sistema === 'Y' ? '<i class="fas fa-lock text-warning"></i>' : '-'}</td>
                    <td class="text-center"><span class="badge badge-${u.activo === 'Y' ? 'success' : 'danger'}">${u.activo === 'Y' ? 'Activa' : 'Inactiva'}</span></td>
                    <td class="text-center">
                        <div class="btn-actions">
                            <button class="btn-edit" onclick="editarUnidad('${u.unidad_id}')" ${u.es_sistema === 'Y' ? 'disabled' : ''}><i class="fas fa-edit"></i></button>
                            <button class="btn-delete" onclick="eliminarUnidad('${u.unidad_id}')" ${u.es_sistema === 'Y' ? 'disabled' : ''}><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }
    } catch (e) {
        console.error('Error cargando unidades:', e);
    }
}

function abrirModalUnidad() {
    document.getElementById('formUnidad').reset();
    document.getElementById('unidadId').value = '';
    document.getElementById('modalUnidadTitulo').textContent = 'Nueva Unidad de Medida';
    document.getElementById('uniActivo').checked = true;
    document.getElementById('uniSistema').checked = false;
    abrirModal('modalUnidad');
}

function editarUnidad(id) {
    const u = unidadesData.find(x => x.unidad_id === id);
    if (!u) return;
    document.getElementById('unidadId').value = u.unidad_id;
    document.getElementById('uniNombre').value = u.nombre || '';
    document.getElementById('uniAbreviatura').value = u.abreviatura || '';
    document.getElementById('uniTipo').value = u.tipo || 'UNIDAD';
    document.getElementById('uniSistema').checked = u.es_sistema === 'Y';
    document.getElementById('uniActivo').checked = u.activo === 'Y';
    document.getElementById('modalUnidadTitulo').textContent = 'Editar Unidad de Medida';
    abrirModal('modalUnidad');
}

async function guardarUnidad(ev) {
    ev.preventDefault();
    const id = document.getElementById('unidadId').value;
    
    const data = {
        empresa_id: empresaId,
        nombre: document.getElementById('uniNombre').value,
        abreviatura: document.getElementById('uniAbreviatura').value,
        tipo: document.getElementById('uniTipo').value,
        es_sistema: document.getElementById('uniSistema').checked ? 'Y' : 'N',
        activo: document.getElementById('uniActivo').checked ? 'Y' : 'N'
    };
    
    try {
        const url = id ? `/unidades/${id}` : '/unidades';
        const method = id ? 'PUT' : 'POST';
        const r = await API.request(url, method, data);
        if (r.success) {
            toast(id ? 'Unidad actualizada' : 'Unidad creada', 'success');
            cerrarModal('modalUnidad');
            await cargarUnidades();
        } else {
            toast(r.error || 'Error al guardar', 'error');
        }
    } catch (e) {
        toast('Error: ' + e.message, 'error');
    }
}

async function eliminarUnidad(id) {
    if (!confirm('¿Desactivar esta unidad?')) return;
    try {
        const r = await API.request(`/unidades/${id}`, 'DELETE');
        if (r.success) {
            toast('Unidad desactivada', 'success');
            await cargarUnidades();
        }
    } catch (e) {
        toast('Error: ' + e.message, 'error');
    }
}

// ==================== UTILIDADES ====================
function abrirModal(id) {
    document.getElementById(id).classList.add('active');
    document.body.style.overflow = 'hidden';
}

function cerrarModal(id) {
    document.getElementById(id).classList.remove('active');
    document.body.style.overflow = '';
}

function toast(mensaje, tipo = 'info') {
    const t = document.getElementById('toast');
    t.textContent = mensaje;
    t.className = `toast toast-${tipo} show`;
    setTimeout(() => t.classList.remove('show'), 3000);
}

// Cerrar modales con ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(m => {
            cerrarModal(m.id);
        });
    }
});

// Cerrar modal al hacer clic fuera
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            cerrarModal(overlay.id);
        }
    });
});
