if (!API.isLoggedIn()) window.location.href = '../index.html';

window.impuestos = [];
window.metodos = [];
window.cortes = [];
window.devoluciones = [];
window.pagos = [];

document.addEventListener('DOMContentLoaded', function() {
    cargarUsuario();
    cargarImpuestos();
    cargarMetodos();
    cargarEmpresa();
    setupTabs();
    initFechasFiltros();
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
            
            // Cargar datos al cambiar de tab
            if (btn.dataset.tab === 'cortes' && window.cortes.length === 0) cargarCortes();
            if (btn.dataset.tab === 'devoluciones' && window.devoluciones.length === 0) cargarDevoluciones();
            if (btn.dataset.tab === 'pagos' && window.pagos.length === 0) cargarPagos();
        });
    });
}

function initFechasFiltros() {
    var hoy = new Date();
    var hace30 = new Date();
    hace30.setDate(hace30.getDate() - 30);
    
    var formatDate = function(d) {
        return d.toISOString().split('T')[0];
    };
    
    // Cortes
    if (document.getElementById('corteFechaDesde')) {
        document.getElementById('corteFechaDesde').value = formatDate(hace30);
        document.getElementById('corteFechaHasta').value = formatDate(hoy);
    }
    // Devoluciones
    if (document.getElementById('devFechaDesde')) {
        document.getElementById('devFechaDesde').value = formatDate(hace30);
        document.getElementById('devFechaHasta').value = formatDate(hoy);
    }
    // Pagos
    if (document.getElementById('pagoFechaDesde')) {
        document.getElementById('pagoFechaDesde').value = formatDate(hace30);
        document.getElementById('pagoFechaHasta').value = formatDate(hoy);
    }
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
            llenarSelectMetodos();
        }
    } catch (e) {
        var r2 = await API.request('/metodos-pago/' + API.usuario.empresa_id);
        if (r2.success) {
            window.metodos = r2.metodos || [];
            renderMetodos();
            llenarSelectMetodos();
        }
    }
}

function llenarSelectMetodos() {
    var select = document.getElementById('pagoMetodo');
    if (!select) return;
    var html = '<option value="">Todos</option>';
    window.metodos.forEach(function(m) {
        html += '<option value="' + m.metodo_pago_id + '">' + m.nombre + '</option>';
    });
    select.innerHTML = html;
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

// ==================== CORTES DE CAJA ====================

async function cargarCortes() {
    try {
        var desde = document.getElementById('corteFechaDesde').value;
        var hasta = document.getElementById('corteFechaHasta').value;
        var params = '?sucursal_id=' + API.usuario.sucursal_id;
        if (desde) params += '&desde=' + desde;
        if (hasta) params += '&hasta=' + hasta;
        
        var r = await API.request('/cortes' + params);
        if (r.success) {
            window.cortes = r.cortes || r.data || [];
            renderCortes();
            llenarSelectUsuariosCortes();
        }
    } catch (e) {
        console.error('Error cargando cortes:', e);
        renderCortesEmpty();
    }
}

function llenarSelectUsuariosCortes() {
    var usuarios = [];
    window.cortes.forEach(function(c) {
        if (c.usuario_nombre && usuarios.indexOf(c.usuario_nombre) === -1) {
            usuarios.push(c.usuario_nombre);
        }
    });
    var select = document.getElementById('corteUsuario');
    var html = '<option value="">Todos</option>';
    usuarios.forEach(function(u) {
        html += '<option value="' + u + '">' + u + '</option>';
    });
    select.innerHTML = html;
}

function renderCortes() {
    var tbody = document.getElementById('tablaCortes');
    document.getElementById('totalCortes').textContent = window.cortes.length;
    
    if (window.cortes.length === 0) {
        renderCortesEmpty();
        return;
    }
    
    var html = '';
    window.cortes.forEach(function(c) {
        var diferencia = parseFloat(c.total_declarado || 0) - parseFloat(c.total_esperado || 0);
        var estado = diferencia === 0 ? 'CORRECTO' : (diferencia > 0 ? 'SOBRANTE' : 'FALTANTE');
        var badgeClass = estado === 'CORRECTO' ? 'active' : (estado === 'SOBRANTE' ? 'info' : 'inactive');
        
        html += '<tr>' +
            '<td><strong class="folio">' + (c.folio || c.corte_id) + '</strong></td>' +
            '<td>' + formatFecha(c.fecha_cierre || c.created_at) + '</td>' +
            '<td>' + (c.usuario_nombre || '-') + '</td>' +
            '<td>' + (c.turno_folio || '-') + '</td>' +
            '<td class="text-right">$' + formatMoney(c.total_esperado) + '</td>' +
            '<td class="text-right">$' + formatMoney(c.total_declarado) + '</td>' +
            '<td class="text-right ' + (diferencia < 0 ? 'text-danger' : diferencia > 0 ? 'text-success' : '') + '">' + 
                (diferencia >= 0 ? '+' : '') + '$' + formatMoney(diferencia) + '</td>' +
            '<td><span class="badge-status ' + badgeClass + '">' + estado + '</span></td>' +
            '<td class="text-center">' +
                '<div class="actions-cell">' +
                    '<button class="btn-action view" onclick="verDetalleCorte(\'' + c.corte_id + '\')"><i class="fas fa-eye"></i></button>' +
                '</div>' +
            '</td>' +
        '</tr>';
    });
    tbody.innerHTML = html;
}

function renderCortesEmpty() {
    document.getElementById('tablaCortes').innerHTML = '<tr><td colspan="9" class="empty-msg"><i class="fas fa-cash-register"></i><br>No hay cortes en el período seleccionado</td></tr>';
}

function filtrarCortes() {
    cargarCortes();
}

async function verDetalleCorte(id) {
    var corte = window.cortes.find(function(c) { return c.corte_id === id; });
    if (!corte) return;
    
    var diferencia = parseFloat(corte.total_declarado || 0) - parseFloat(corte.total_esperado || 0);
    var estado = diferencia === 0 ? 'CORRECTO' : (diferencia > 0 ? 'SOBRANTE' : 'FALTANTE');
    
    var html = '<div class="detalle-corte">' +
        '<div class="corte-resumen-header ' + estado.toLowerCase() + '">' +
            '<div class="resultado-icono"><i class="fas fa-' + (estado === 'CORRECTO' ? 'check-circle' : estado === 'SOBRANTE' ? 'arrow-up' : 'arrow-down') + '"></i></div>' +
            '<h3>' + estado + '</h3>' +
            '<div class="diferencia-monto">' + (diferencia >= 0 ? '+' : '') + '$' + formatMoney(diferencia) + '</div>' +
        '</div>' +
        '<div class="detalle-info-grid">' +
            '<div class="info-item"><label>Folio</label><span>' + (corte.folio || corte.corte_id) + '</span></div>' +
            '<div class="info-item"><label>Fecha</label><span>' + formatFecha(corte.fecha_cierre || corte.created_at) + '</span></div>' +
            '<div class="info-item"><label>Usuario</label><span>' + (corte.usuario_nombre || '-') + '</span></div>' +
            '<div class="info-item"><label>Turno</label><span>' + (corte.turno_folio || '-') + '</span></div>' +
        '</div>' +
        '<div class="detalle-totales-grid">' +
            '<div class="total-box esperado"><label>Esperado</label><span>$' + formatMoney(corte.total_esperado) + '</span></div>' +
            '<div class="total-box declarado"><label>Declarado</label><span>$' + formatMoney(corte.total_declarado) + '</span></div>' +
        '</div>';
    
    if (corte.observaciones) {
        html += '<div class="observaciones-box"><label>Observaciones</label><p>' + corte.observaciones + '</p></div>';
    }
    
    html += '</div>';
    
    document.getElementById('detalleCorteContent').innerHTML = html;
    document.getElementById('modalDetalleCorte').classList.add('active');
}

function cerrarModalDetalleCorte() {
    document.getElementById('modalDetalleCorte').classList.remove('active');
}

function imprimirCorte() {
    window.print();
}

function exportarCortes() {
    exportarTabla(window.cortes, 'cortes');
}

// ==================== DEVOLUCIONES ====================

async function cargarDevoluciones() {
    try {
        var desde = document.getElementById('devFechaDesde').value;
        var hasta = document.getElementById('devFechaHasta').value;
        var params = '?sucursal_id=' + API.usuario.sucursal_id;
        if (desde) params += '&desde=' + desde;
        if (hasta) params += '&hasta=' + hasta;
        
        var r = await API.request('/devoluciones' + params);
        if (r.success) {
            window.devoluciones = r.devoluciones || r.data || [];
            renderDevoluciones();
        }
    } catch (e) {
        console.error('Error cargando devoluciones:', e);
        renderDevolucionesEmpty();
    }
}

function renderDevoluciones() {
    var tbody = document.getElementById('tablaDevoluciones');
    var total = window.devoluciones.length;
    var monto = window.devoluciones.reduce(function(sum, d) { return sum + parseFloat(d.monto || 0); }, 0);
    
    document.getElementById('totalDevoluciones').textContent = total;
    document.getElementById('montoDevoluciones').textContent = formatMoney(monto);
    
    if (total === 0) {
        renderDevolucionesEmpty();
        return;
    }
    
    var html = '';
    window.devoluciones.forEach(function(d) {
        var motivoClass = d.motivo === 'DEFECTUOSO' ? 'danger' : d.motivo === 'GARANTIA' ? 'warning' : 'info';
        html += '<tr>' +
            '<td><strong class="folio">' + (d.folio || d.devolucion_id) + '</strong></td>' +
            '<td>' + formatFecha(d.fecha || d.created_at) + '</td>' +
            '<td>' + (d.venta_folio || '-') + '</td>' +
            '<td>' + (d.cliente_nombre || 'Público General') + '</td>' +
            '<td>' + (d.producto_nombre || '-') + '</td>' +
            '<td class="text-center">' + (d.cantidad || 1) + '</td>' +
            '<td class="text-right text-danger">$' + formatMoney(d.monto) + '</td>' +
            '<td><span class="badge-motivo ' + motivoClass + '">' + (d.motivo || '-') + '</span></td>' +
            '<td>' + (d.usuario_nombre || '-') + '</td>' +
            '<td class="text-center">' +
                '<div class="actions-cell">' +
                    '<button class="btn-action view" onclick="verDetalleDevolucion(\'' + d.devolucion_id + '\')"><i class="fas fa-eye"></i></button>' +
                '</div>' +
            '</td>' +
        '</tr>';
    });
    tbody.innerHTML = html;
}

function renderDevolucionesEmpty() {
    document.getElementById('tablaDevoluciones').innerHTML = '<tr><td colspan="10" class="empty-msg"><i class="fas fa-undo-alt"></i><br>No hay devoluciones en el período seleccionado</td></tr>';
}

function filtrarDevoluciones() {
    cargarDevoluciones();
}

function verDetalleDevolucion(id) {
    var dev = window.devoluciones.find(function(d) { return d.devolucion_id === id; });
    if (!dev) return;
    
    var html = '<div class="detalle-devolucion">' +
        '<div class="dev-header">' +
            '<div class="dev-icono"><i class="fas fa-undo-alt"></i></div>' +
            '<div class="dev-monto">$' + formatMoney(dev.monto) + '</div>' +
        '</div>' +
        '<div class="detalle-info-grid">' +
            '<div class="info-item"><label>Folio</label><span>' + (dev.folio || dev.devolucion_id) + '</span></div>' +
            '<div class="info-item"><label>Fecha</label><span>' + formatFecha(dev.fecha || dev.created_at) + '</span></div>' +
            '<div class="info-item"><label>Venta Original</label><span>' + (dev.venta_folio || '-') + '</span></div>' +
            '<div class="info-item"><label>Cliente</label><span>' + (dev.cliente_nombre || 'Público General') + '</span></div>' +
        '</div>' +
        '<div class="producto-devuelto">' +
            '<label>Producto Devuelto</label>' +
            '<div class="prod-info">' +
                '<strong>' + (dev.producto_nombre || '-') + '</strong>' +
                '<span>Cantidad: ' + (dev.cantidad || 1) + '</span>' +
            '</div>' +
        '</div>' +
        '<div class="motivo-box ' + (dev.motivo || '').toLowerCase() + '">' +
            '<label>Motivo</label>' +
            '<span>' + (dev.motivo || '-') + '</span>' +
        '</div>';
    
    if (dev.notas) {
        html += '<div class="notas-box"><label>Notas</label><p>' + dev.notas + '</p></div>';
    }
    
    html += '<div class="usuario-info"><small>Procesado por: ' + (dev.usuario_nombre || '-') + '</small></div></div>';
    
    document.getElementById('detalleDevolucionContent').innerHTML = html;
    document.getElementById('modalDetalleDevolucion').classList.add('active');
}

function cerrarModalDetalleDevolucion() {
    document.getElementById('modalDetalleDevolucion').classList.remove('active');
}

function imprimirDevolucion() {
    window.print();
}

function exportarDevoluciones() {
    exportarTabla(window.devoluciones, 'devoluciones');
}

// ==================== PAGOS RECIBIDOS ====================

async function cargarPagos() {
    try {
        var desde = document.getElementById('pagoFechaDesde').value;
        var hasta = document.getElementById('pagoFechaHasta').value;
        var params = '?sucursal_id=' + API.usuario.sucursal_id;
        if (desde) params += '&desde=' + desde;
        if (hasta) params += '&hasta=' + hasta;
        
        var r = await API.request('/pagos' + params);
        if (r.success) {
            window.pagos = r.pagos || r.data || [];
            renderPagos();
        }
    } catch (e) {
        console.error('Error cargando pagos:', e);
        renderPagosEmpty();
    }
}

function renderPagos() {
    var tbody = document.getElementById('tablaPagos');
    var total = window.pagos.length;
    var monto = window.pagos.reduce(function(sum, p) { 
        return sum + (p.estado !== 'CANCELADO' ? parseFloat(p.monto || 0) : 0); 
    }, 0);
    
    document.getElementById('totalPagos').textContent = total;
    document.getElementById('montoPagos').textContent = formatMoney(monto);
    
    if (total === 0) {
        renderPagosEmpty();
        return;
    }
    
    var html = '';
    window.pagos.forEach(function(p) {
        var metodoIcono = getMetodoIcono(p.metodo_nombre || p.metodo_pago_nombre);
        var estadoClass = p.estado === 'CANCELADO' ? 'inactive' : 'active';
        
        html += '<tr class="' + (p.estado === 'CANCELADO' ? 'cancelada' : '') + '">' +
            '<td><strong class="folio">' + (p.folio || p.pago_id) + '</strong></td>' +
            '<td>' + formatFecha(p.fecha || p.created_at) + '</td>' +
            '<td>' + (p.venta_folio || '-') + '</td>' +
            '<td>' + (p.cliente_nombre || 'Público General') + '</td>' +
            '<td><span class="metodo-pago ' + metodoIcono.clase + '"><i class="fas ' + metodoIcono.icono + '"></i> ' + (p.metodo_nombre || p.metodo_pago_nombre || '-') + '</span></td>' +
            '<td class="text-right text-success">$' + formatMoney(p.monto) + '</td>' +
            '<td>' + (p.referencia || '-') + '</td>' +
            '<td><span class="badge-status ' + estadoClass + '">' + (p.estado || 'APLICADO') + '</span></td>' +
            '<td>' + (p.usuario_nombre || '-') + '</td>' +
            '<td class="text-center">' +
                '<div class="actions-cell">' +
                    '<button class="btn-action view" onclick="verDetallePago(\'' + p.pago_id + '\')"><i class="fas fa-eye"></i></button>' +
                '</div>' +
            '</td>' +
        '</tr>';
    });
    tbody.innerHTML = html;
}

function renderPagosEmpty() {
    document.getElementById('tablaPagos').innerHTML = '<tr><td colspan="10" class="empty-msg"><i class="fas fa-hand-holding-usd"></i><br>No hay pagos en el período seleccionado</td></tr>';
}

function getMetodoIcono(nombre) {
    if (!nombre) return { icono: 'fa-money-bill-wave', clase: 'efectivo' };
    var n = nombre.toLowerCase();
    if (n.includes('efectivo') || n.includes('cash')) return { icono: 'fa-money-bill-wave', clase: 'efectivo' };
    if (n.includes('tarjeta') || n.includes('card')) return { icono: 'fa-credit-card', clase: 'tarjeta' };
    if (n.includes('transfer')) return { icono: 'fa-exchange-alt', clase: 'transferencia' };
    return { icono: 'fa-money-bill-wave', clase: 'efectivo' };
}

function filtrarPagos() {
    cargarPagos();
}

function verDetallePago(id) {
    var pago = window.pagos.find(function(p) { return p.pago_id === id; });
    if (!pago) return;
    
    var metodoIcono = getMetodoIcono(pago.metodo_nombre || pago.metodo_pago_nombre);
    
    var html = '<div class="detalle-pago">' +
        '<div class="pago-header">' +
            '<div class="pago-icono ' + metodoIcono.clase + '"><i class="fas ' + metodoIcono.icono + '"></i></div>' +
            '<div class="pago-monto">$' + formatMoney(pago.monto) + '</div>' +
            '<div class="pago-metodo">' + (pago.metodo_nombre || pago.metodo_pago_nombre || '-') + '</div>' +
        '</div>' +
        '<div class="detalle-info-grid">' +
            '<div class="info-item"><label>Folio Pago</label><span>' + (pago.folio || pago.pago_id) + '</span></div>' +
            '<div class="info-item"><label>Fecha</label><span>' + formatFecha(pago.fecha || pago.created_at) + '</span></div>' +
            '<div class="info-item"><label>Venta</label><span>' + (pago.venta_folio || '-') + '</span></div>' +
            '<div class="info-item"><label>Cliente</label><span>' + (pago.cliente_nombre || 'Público General') + '</span></div>' +
        '</div>';
    
    if (pago.referencia) {
        html += '<div class="referencia-box"><label>Referencia</label><span>' + pago.referencia + '</span></div>';
    }
    
    html += '<div class="estado-box ' + (pago.estado === 'CANCELADO' ? 'cancelado' : 'aplicado') + '">' +
        '<label>Estado</label><span>' + (pago.estado || 'APLICADO') + '</span></div>' +
        '<div class="usuario-info"><small>Registrado por: ' + (pago.usuario_nombre || '-') + '</small></div></div>';
    
    document.getElementById('detallePagoContent').innerHTML = html;
    document.getElementById('modalDetallePago').classList.add('active');
}

function cerrarModalDetallePago() {
    document.getElementById('modalDetallePago').classList.remove('active');
}

function imprimirPago() {
    window.print();
}

function exportarPagos() {
    exportarTabla(window.pagos, 'pagos');
}

// ==================== EMPRESA ====================

function cargarEmpresa() {
    var u = API.usuario;
    document.getElementById('empresaNombre').textContent = u.empresa_nombre || '-';
    document.getElementById('empresaRFC').textContent = u.empresa_rfc || '-';
    document.getElementById('empresaSucursal').textContent = u.sucursal_nombre || '-';
}

// ==================== UTILIDADES ====================

function formatFecha(fecha) {
    if (!fecha) return '-';
    var d = new Date(fecha);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatMoney(num) {
    return parseFloat(num || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function exportarTabla(data, nombre) {
    if (!data || data.length === 0) {
        mostrarToast('No hay datos para exportar', 'error');
        return;
    }
    
    // Crear CSV simple
    var headers = Object.keys(data[0]);
    var csv = headers.join(',') + '\n';
    data.forEach(function(row) {
        var values = headers.map(function(h) {
            var val = row[h] || '';
            return '"' + String(val).replace(/"/g, '""') + '"';
        });
        csv += values.join(',') + '\n';
    });
    
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = nombre + '_' + new Date().toISOString().split('T')[0] + '.csv';
    link.click();
    
    mostrarToast('Archivo exportado');
}

function mostrarToast(msg, tipo) {
    tipo = tipo || 'success';
    var toast = document.getElementById('toast');
    toast.innerHTML = '<i class="fas fa-' + (tipo === 'error' ? 'exclamation-circle' : 'check-circle') + '"></i> ' + msg;
    toast.className = 'toast show ' + tipo;
    setTimeout(function() { toast.classList.remove('show'); }, 3000);
}
