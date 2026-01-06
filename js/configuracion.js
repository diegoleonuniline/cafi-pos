if (!API.isLoggedIn()) window.location.href = '../index.html';

window.impuestos = [];
window.metodos = [];

document.addEventListener('DOMContentLoaded', function() {
    cargarUsuario();
    cargarImpuestos();
    cargarMetodos();
    cargarEmpresa();
    setupTabs();
});

function cargarUsuario() {
    var u = API.usuario;
    document.getElementById('userName').textContent = u.nombre;
    document.getElementById('userSucursal').textContent = u.sucursal_nombre || 'Sucursal';
    document.getElementById('userAvatar').textContent = u.nombre.charAt(0).toUpperCase();
}

function setupTabs() {
    document.querySelectorAll('.config-tab').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.config-tab').forEach(function(b) { b.classList.remove('active'); });
            document.querySelectorAll('.config-content').forEach(function(c) { c.classList.remove('active'); });
            btn.classList.add('active');
            document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
        });
    });
}

// ==================== IMPUESTOS ====================

async function cargarImpuestos() {
    try {
        var r = await API.request('/impuestos/' + API.usuario.empresa_id + '/todos');
        if (r.success) {
            window.impuestos = r.impuestos || [];
            renderImpuestos();
        }
    } catch (e) {
        // Si falla el endpoint /todos, usar el normal
        var r2 = await API.request('/impuestos/' + API.usuario.empresa_id);
        if (r2.success) {
            window.impuestos = r2.impuestos || r2.data || [];
            renderImpuestos();
        }
    }
}

function renderImpuestos() {
    var tbody = document.getElementById('tablaImpuestos');
    if (window.impuestos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-msg">No hay impuestos configurados</td></tr>';
        return;
    }
    
    var html = '';
    window.impuestos.forEach(function(imp) {
        html += '<tr>' +
            '<td><strong>' + imp.nombre + '</strong></td>' +
            '<td>' + imp.tipo + '</td>' +
            '<td>' + parseFloat(imp.valor).toFixed(2) + (imp.tipo === 'PORCENTAJE' ? '%' : '$') + '</td>' +
            '<td class="text-center">' + (imp.aplica_ventas === 'Y' ? '<i class="fas fa-check text-success"></i>' : '<i class="fas fa-times text-danger"></i>') + '</td>' +
            '<td class="text-center">' + (imp.aplica_compras === 'Y' ? '<i class="fas fa-check text-success"></i>' : '<i class="fas fa-times text-danger"></i>') + '</td>' +
            '<td class="text-center"><span class="badge-status ' + (imp.activo === 'Y' ? 'active' : 'inactive') + '">' + (imp.activo === 'Y' ? 'Activo' : 'Inactivo') + '</span></td>' +
            '<td class="text-center">' +
                '<div class="actions-cell">' +
                    '<button class="btn-action edit" onclick="editarImpuesto(\'' + imp.impuesto_id + '\')"><i class="fas fa-edit"></i></button>' +
                    '<button class="btn-action delete" onclick="eliminarImpuesto(\'' + imp.impuesto_id + '\')"><i class="fas fa-trash"></i></button>' +
                '</div>' +
            '</td>' +
        '</tr>';
    });
    tbody.innerHTML = html;
}

function abrirModalImpuesto(item) {
    document.getElementById('modalImpuestoTitulo').textContent = item ? 'Editar Impuesto' : 'Nuevo Impuesto';
    document.getElementById('formImpuesto').reset();
    document.getElementById('impuestoId').value = '';
    document.getElementById('impuestoVentas').checked = true;
    document.getElementById('impuestoCompras').checked = true;
    
    if (item) {
        document.getElementById('impuestoId').value = item.impuesto_id;
        document.getElementById('impuestoNombre').value = item.nombre;
        document.getElementById('impuestoTipo').value = item.tipo;
        document.getElementById('impuestoValor').value = item.valor;
        document.getElementById('impuestoVentas').checked = item.aplica_ventas === 'Y';
        document.getElementById('impuestoCompras').checked = item.aplica_compras === 'Y';
    }
    
    document.getElementById('modalImpuesto').classList.add('active');
}

function cerrarModalImpuesto() {
    document.getElementById('modalImpuesto').classList.remove('active');
}

function editarImpuesto(id) {
    var item = window.impuestos.find(function(i) { return i.impuesto_id === id; });
    if (item) abrirModalImpuesto(item);
}

async function guardarImpuesto(e) {
    e.preventDefault();
    var id = document.getElementById('impuestoId').value;
    
    var data = {
        empresa_id: API.usuario.empresa_id,
        nombre: document.getElementById('impuestoNombre').value,
        tipo: document.getElementById('impuestoTipo').value,
        valor: parseFloat(document.getElementById('impuestoValor').value),
        aplica_ventas: document.getElementById('impuestoVentas').checked ? 'Y' : 'N',
        aplica_compras: document.getElementById('impuestoCompras').checked ? 'Y' : 'N'
    };
    
    try {
        var url = id ? '/impuestos/' + id : '/impuestos';
        var method = id ? 'PUT' : 'POST';
        var r = await API.request(url, method, data);
        
        if (r.success) {
            mostrarToast(id ? 'Impuesto actualizado' : 'Impuesto creado');
            cerrarModalImpuesto();
            cargarImpuestos();
        } else {
            mostrarToast('Error: ' + r.error, 'error');
        }
    } catch (e) {
        mostrarToast('Error de conexión', 'error');
    }
}

async function eliminarImpuesto(id) {
    if (!confirm('¿Eliminar este impuesto?')) return;
    try {
        var r = await API.request('/impuestos/' + id, 'DELETE');
        if (r.success) {
            mostrarToast('Impuesto eliminado');
            cargarImpuestos();
        } else {
            mostrarToast('Error: ' + r.error, 'error');
        }
    } catch (e) {
        mostrarToast('Error de conexión', 'error');
    }
}

// ==================== MÉTODOS DE PAGO ====================

async function cargarMetodos() {
    try {
        var r = await API.request('/metodos-pago/' + API.usuario.empresa_id + '/todos');
        if (r.success) {
            window.metodos = r.metodos || [];
            renderMetodos();
        }
    } catch (e) {
        var r2 = await API.request('/metodos-pago/' + API.usuario.empresa_id);
        if (r2.success) {
            window.metodos = r2.metodos || [];
            renderMetodos();
        }
    }
}

function renderMetodos() {
    var tbody = document.getElementById('tablaMetodos');
    if (window.metodos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-msg">No hay métodos de pago configurados</td></tr>';
        return;
    }
    
    var html = '';
    window.metodos.forEach(function(m) {
        html += '<tr>' +
            '<td class="text-center"><i class="fas ' + (m.icono || 'fa-money-bill-wave') + '"></i></td>' +
            '<td><strong>' + m.nombre + '</strong></td>' +
            '<td>' + (m.clave_sat || '-') + '</td>' +
            '<td class="text-center">' + (m.requiere_referencia === 'Y' ? '<i class="fas fa-check text-success"></i>' : '-') + '</td>' +
            '<td class="text-center">' + (m.orden || 0) + '</td>' +
            '<td class="text-center"><span class="badge-status ' + (m.activo === 'Y' ? 'active' : 'inactive') + '">' + (m.activo === 'Y' ? 'Activo' : 'Inactivo') + '</span></td>' +
            '<td class="text-center">' +
                '<div class="actions-cell">' +
                    '<button class="btn-action edit" onclick="editarMetodo(\'' + m.metodo_pago_id + '\')"><i class="fas fa-edit"></i></button>' +
                    '<button class="btn-action delete" onclick="eliminarMetodo(\'' + m.metodo_pago_id + '\')"><i class="fas fa-trash"></i></button>' +
                '</div>' +
            '</td>' +
        '</tr>';
    });
    tbody.innerHTML = html;
}

function abrirModalMetodo(item) {
    document.getElementById('modalMetodoTitulo').textContent = item ? 'Editar Método' : 'Nuevo Método';
    document.getElementById('formMetodo').reset();
    document.getElementById('metodoId').value = '';
    document.getElementById('metodoOrden').value = 0;
    
    if (item) {
        document.getElementById('metodoId').value = item.metodo_pago_id;
        document.getElementById('metodoNombre').value = item.nombre;
        document.getElementById('metodoIcono').value = item.icono || 'fa-money-bill-wave';
        document.getElementById('metodoClaveSAT').value = item.clave_sat || '';
        document.getElementById('metodoOrden').value = item.orden || 0;
        document.getElementById('metodoReferencia').checked = item.requiere_referencia === 'Y';
    }
    
    document.getElementById('modalMetodo').classList.add('active');
}

function cerrarModalMetodo() {
    document.getElementById('modalMetodo').classList.remove('active');
}

function editarMetodo(id) {
    var item = window.metodos.find(function(m) { return m.metodo_pago_id === id; });
    if (item) abrirModalMetodo(item);
}

async function guardarMetodo(e) {
    e.preventDefault();
    var id = document.getElementById('metodoId').value;
    
    var data = {
        empresa_id: API.usuario.empresa_id,
        nombre: document.getElementById('metodoNombre').value,
        icono: document.getElementById('metodoIcono').value,
        clave_sat: document.getElementById('metodoClaveSAT').value || null,
        orden: parseInt(document.getElementById('metodoOrden').value) || 0,
        requiere_referencia: document.getElementById('metodoReferencia').checked ? 'Y' : 'N'
    };
    
    try {
        var url = id ? '/metodos-pago/' + id : '/metodos-pago';
        var method = id ? 'PUT' : 'POST';
        var r = await API.request(url, method, data);
        
        if (r.success) {
            mostrarToast(id ? 'Método actualizado' : 'Método creado');
            cerrarModalMetodo();
            cargarMetodos();
        } else {
            mostrarToast('Error: ' + r.error, 'error');
        }
    } catch (e) {
        mostrarToast('Error de conexión', 'error');
    }
}

async function eliminarMetodo(id) {
    if (!confirm('¿Eliminar este método de pago?')) return;
    try {
        var r = await API.request('/metodos-pago/' + id, 'DELETE');
        if (r.success) {
            mostrarToast('Método eliminado');
            cargarMetodos();
        } else {
            mostrarToast('Error: ' + r.error, 'error');
        }
    } catch (e) {
        mostrarToast('Error de conexión', 'error');
    }
}

// ==================== EMPRESA ====================

function cargarEmpresa() {
    var u = API.usuario;
    document.getElementById('empresaNombre').textContent = u.empresa_nombre || '-';
    document.getElementById('empresaRFC').textContent = u.empresa_rfc || '-';
    document.getElementById('empresaSucursal').textContent = u.sucursal_nombre || '-';
}

// ==================== TOAST ====================

function mostrarToast(msg, tipo) {
    tipo = tipo || 'success';
    var toast = document.getElementById('toast');
    toast.innerHTML = '<i class="fas fa-' + (tipo === 'error' ? 'exclamation-circle' : 'check-circle') + '"></i> ' + msg;
    toast.className = 'toast show ' + tipo;
    setTimeout(function() { toast.classList.remove('show'); }, 3000);
}
