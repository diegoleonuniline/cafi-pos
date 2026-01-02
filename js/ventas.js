if (!API.isLoggedIn()) window.location.href = '../index.html';

var datos = [];
var ventaActual = null;

document.addEventListener('DOMContentLoaded', async function() {
    cargarUsuario();
    
    var hoy = new Date().toISOString().split('T')[0];
    document.getElementById('fechaDesde').value = hoy;
    document.getElementById('fechaHasta').value = hoy;
    
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
        var desde = document.getElementById('fechaDesde').value;
        var hasta = document.getElementById('fechaHasta').value;
        
        var url = '/ventas/' + API.usuario.empresa_id + '?desde=' + desde + '&hasta=' + hasta;
        if (API.usuario.sucursal_id) {
            url += '&sucursal=' + API.usuario.sucursal_id;
        }
        
        var r = await API.request(url);
        console.log('Ventas:', r);
        if (r.success) {
            datos = r.ventas || r.data || [];
            calcularEstadisticas();
            filtrar();
        }
    } catch (e) {
        console.error(e);
        mostrarToast('Error cargando ventas', 'error');
    }
}

function calcularEstadisticas() {
    var completadas = datos.filter(function(v) { return v.estatus !== 'CANCELADA'; });
    var canceladas = datos.filter(function(v) { return v.estatus === 'CANCELADA'; });
    
    var totalVendido = completadas.reduce(function(sum, v) { return sum + parseFloat(v.total || 0); }, 0);
    var ticketPromedio = completadas.length > 0 ? totalVendido / completadas.length : 0;
    
    document.getElementById('statVentas').textContent = completadas.length;
    document.getElementById('statTotal').textContent = '$' + totalVendido.toFixed(2);
    document.getElementById('statTicket').textContent = '$' + ticketPromedio.toFixed(2);
    document.getElementById('statCanceladas').textContent = canceladas.length;
}

function filtrar() {
    var busqueda = document.getElementById('inputBuscar').value.toLowerCase();
    var estado = document.getElementById('filtroEstado').value;

    var filtrados = datos.filter(function(item) {
        var matchBusq = !busqueda || 
            (item.folio && item.folio.toString().indexOf(busqueda) >= 0) ||
            (item.cliente_nombre && item.cliente_nombre.toLowerCase().indexOf(busqueda) >= 0);
        var matchEstado = !estado || item.estatus === estado;
        return matchBusq && matchEstado;
    });

    renderTabla(filtrados);
}

function renderTabla(items) {
    var tbody = document.getElementById('tablaBody');
    if (items.length === 0) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="8">No hay ventas en este período</td></tr>';
        return;
    }

    var html = '';
    items.forEach(function(v) {
var fecha = v.fecha_hora ? new Date(v.fecha_hora.replace(' ', 'T')) : new Date();
        var fechaStr = fecha.toLocaleDateString('es-MX') + ' ' + fecha.toLocaleTimeString('es-MX', {hour: '2-digit', minute: '2-digit'});
        var esCancelada = v.estatus === 'CANCELADA';
        
        // Determinar método de pago
        var metodoPago = 'EFECTIVO';
        if (parseFloat(v.pagado || 0) > 0) {
            metodoPago = 'EFECTIVO';
        }
        var metodoClass = metodoPago.toLowerCase();
        var metodoIcon = 'fa-money-bill';
        
        var folioStr = v.serie ? v.serie + '-' + v.folio : (v.folio || v.venta_id.slice(-8));
        
        html += '<tr class="venta-row' + (esCancelada ? ' cancelada' : '') + '" onclick="verDetalle(\'' + v.venta_id + '\')">' +
            '<td><span class="folio">' + folioStr + '</span></td>' +
            '<td>' + fechaStr + '</td>' +
            '<td>' + (v.cliente_nombre || 'Público General') + '</td>' +
            '<td class="text-center">' + (v.num_productos || '-') + '</td>' +
            '<td class="text-center"><span class="metodo-pago ' + metodoClass + '"><i class="fas ' + metodoIcon + '"></i> ' + metodoPago + '</span></td>' +
            '<td class="text-right"><strong>$' + parseFloat(v.total || 0).toFixed(2) + '</strong></td>' +
            '<td class="text-center">' +
                '<span class="badge-status ' + (esCancelada ? 'inactive' : 'active') + '">' +
                    (esCancelada ? 'Cancelada' : v.estatus) +
                '</span>' +
            '</td>' +
            '<td class="text-center">' +
                '<div class="actions-cell">' +
                    '<button class="btn-action edit" onclick="event.stopPropagation();imprimirTicket(\'' + v.venta_id + '\')" title="Reimprimir">' +
                        '<i class="fas fa-print"></i>' +
                    '</button>' +
                    (esCancelada ? '' : '<button class="btn-action delete" onclick="event.stopPropagation();abrirCancelar(\'' + v.venta_id + '\',\'' + folioStr + '\')" title="Cancelar"><i class="fas fa-times"></i></button>') +
                '</div>' +
            '</td>' +
        '</tr>';
    });
    tbody.innerHTML = html;
}

async function verDetalle(id) {
    try {
        var r = await API.request('/ventas/detalle/' + id);
        console.log('Detalle:', r);
        if (r.success) {
            ventaActual = r.venta;
            mostrarDetalle(r.venta, r.productos || []);
        }
    } catch (e) {
        console.error(e);
        mostrarToast('Error cargando detalle', 'error');
    }
}

function mostrarDetalle(venta, productos) {
 var fecha = venta.fecha_hora ? new Date(venta.fecha_hora.replace(' ', 'T')) : new Date();
    var fechaStr = fecha.toLocaleDateString('es-MX', {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'});
    var horaStr = fecha.toLocaleTimeString('es-MX', {hour: '2-digit', minute: '2-digit'});
    var esCancelada = venta.estatus === 'CANCELADA';
    var folioStr = venta.serie ? venta.serie + '-' + venta.folio : (venta.folio || venta.venta_id.slice(-8));
    
    var productosHtml = '';
    productos.forEach(function(p) {
        var subtotal = parseFloat(p.cantidad) * parseFloat(p.precio_unitario);
        productosHtml += '<tr>' +
            '<td>' + (p.producto_nombre || p.descripcion || 'Producto') + '</td>' +
            '<td class="text-center">' + parseFloat(p.cantidad) + ' ' + (p.unidad || p.unidad_id || 'PZ') + '</td>' +
            '<td class="text-right">$' + parseFloat(p.precio_unitario).toFixed(2) + '</td>' +
            '<td class="text-right">$' + subtotal.toFixed(2) + '</td>' +
        '</tr>';
    });
    
    var html = '' +
        '<div class="detalle-header">' +
            '<div>' +
                '<div class="detalle-folio">' + folioStr + '</div>' +
                '<div class="detalle-fecha">' + fechaStr + ' • ' + horaStr + '</div>' +
            '</div>' +
            '<div class="detalle-estado">' +
                '<span class="badge-status ' + (esCancelada ? 'inactive' : 'active') + '" style="font-size:14px;padding:8px 16px">' +
                    (esCancelada ? 'CANCELADA' : venta.estatus) +
                '</span>' +
            '</div>' +
        '</div>' +
        
        '<div class="detalle-cliente">' +
            '<i class="fas fa-user"></i>' +
            '<div class="info">' +
                '<strong>' + (venta.cliente_nombre || 'Público General') + '</strong>' +
                '<span>Atendió: ' + (venta.usuario_nombre || 'Usuario') + '</span>' +
            '</div>' +
        '</div>' +
        
        '<div class="detalle-productos">' +
            '<table>' +
                '<thead><tr><th>Producto</th><th class="text-center">Cantidad</th><th class="text-right">Precio</th><th class="text-right">Subtotal</th></tr></thead>' +
                '<tbody>' + productosHtml + '</tbody>' +
            '</table>' +
        '</div>' +
        
        '<div class="detalle-totales">' +
            '<div class="total-row"><span>Subtotal:</span><span>$' + parseFloat(venta.subtotal || venta.total).toFixed(2) + '</span></div>' +
            '<div class="total-row"><span>Impuestos:</span><span>$' + parseFloat(venta.impuestos || 0).toFixed(2) + '</span></div>' +
            (parseFloat(venta.descuento || 0) > 0 ? '<div class="total-row"><span>Descuento:</span><span>-$' + parseFloat(venta.descuento).toFixed(2) + '</span></div>' : '') +
            '<div class="total-row final"><span>TOTAL:</span><span>$' + parseFloat(venta.total).toFixed(2) + '</span></div>' +
            
            '<div class="detalle-pagos">' +
                '<div class="pago-item"><div class="metodo"><i class="fas fa-money-bill"></i> Pagado</div><span>$' + parseFloat(venta.pagado || 0).toFixed(2) + '</span></div>' +
                (parseFloat(venta.cambio || 0) > 0 ? '<div class="pago-item"><div class="metodo"><i class="fas fa-coins"></i> Cambio</div><span>$' + parseFloat(venta.cambio).toFixed(2) + '</span></div>' : '') +
            '</div>' +
        '</div>' +
        
        (esCancelada ? '<div style="margin-top:16px;padding:12px;background:rgba(239,68,68,0.1);border-radius:8px"><strong style="color:#ef4444"><i class="fas fa-info-circle"></i> Motivo de cancelación:</strong><p style="margin:8px 0 0">' + (venta.motivo_cancelacion || 'No especificado') + '</p></div>' : '') +
        
        '<div class="modal-actions">' +
            '<button class="btn btn-outline" onclick="cerrarModalDetalle()"><i class="fas fa-times"></i> Cerrar</button>' +
            '<button class="btn btn-primary" onclick="imprimirTicket(\'' + venta.venta_id + '\')"><i class="fas fa-print"></i> Reimprimir</button>' +
            (esCancelada ? '' : '<button class="btn" style="background:#ef4444;color:white" onclick="cerrarModalDetalle();abrirCancelar(\'' + venta.venta_id + '\',\'' + folioStr + '\')"><i class="fas fa-times"></i> Cancelar</button>') +
        '</div>';
    
    document.getElementById('detalleContent').innerHTML = html;
    document.getElementById('modalDetalle').classList.add('active');
}

function cerrarModalDetalle() {
    document.getElementById('modalDetalle').classList.remove('active');
}

function abrirCancelar(id, folio) {
    document.getElementById('cancelarVentaId').value = id;
    document.getElementById('cancelarFolio').textContent = folio;
    document.getElementById('motivoCancelacion').value = '';
    document.getElementById('modalCancelar').classList.add('active');
}

function cerrarModalCancelar() {
    document.getElementById('modalCancelar').classList.remove('active');
}

async function confirmarCancelacion(e) {
    e.preventDefault();
    var id = document.getElementById('cancelarVentaId').value;
    var motivo = document.getElementById('motivoCancelacion').value;
    
    try {
        var r = await API.request('/ventas/cancelar/' + id, 'PUT', {
            motivo_cancelacion: motivo
        });
        
        if (r.success) {
            mostrarToast('Venta cancelada');
            cerrarModalCancelar();
            await cargarDatos();
        } else {
            mostrarToast('Error: ' + r.error, 'error');
        }
    } catch (e) {
        mostrarToast('Error de conexión', 'error');
    }
}

function imprimirTicket(id) {
    var venta = datos.find(function(v) { return v.venta_id === id; });
    if (!venta) {
        mostrarToast('Venta no encontrada', 'error');
        return;
    }
    
    var fecha = new Date(venta.fecha_hora);
    var folioStr = venta.serie ? venta.serie + '-' + venta.folio : (venta.folio || venta.venta_id.slice(-8));
    
    var ventana = window.open('', '_blank', 'width=350,height=600');
    ventana.document.write(
        '<!DOCTYPE html><html><head><title>Ticket</title>' +
        '<style>' +
            'body{font-family:monospace;font-size:12px;width:280px;margin:0 auto;padding:10px}' +
            '.center{text-align:center}' +
            '.right{text-align:right}' +
            '.bold{font-weight:bold}' +
            '.line{border-top:1px dashed #000;margin:8px 0}' +
            '.row{display:flex;justify-content:space-between}' +
            '.total{font-size:16px;font-weight:bold}' +
        '</style></head><body>' +
        '<div class="center bold" style="font-size:16px">CAFI POS</div>' +
        '<div class="center">Ticket de Venta</div>' +
        '<div class="line"></div>' +
        '<div>Folio: ' + folioStr + '</div>' +
        '<div>Fecha: ' + fecha.toLocaleDateString('es-MX') + ' ' + fecha.toLocaleTimeString('es-MX', {hour:'2-digit',minute:'2-digit'}) + '</div>' +
        '<div>Cliente: ' + (venta.cliente_nombre || 'Público General') + '</div>' +
        '<div class="line"></div>' +
        '<div class="row total"><span>TOTAL:</span><span>$' + parseFloat(venta.total).toFixed(2) + '</span></div>' +
        '<div class="line"></div>' +
        '<div class="center">¡Gracias por su compra!</div>' +
        '<script>window.print();</script>' +
        '</body></html>'
    );
}

function mostrarToast(msg, tipo) {
    tipo = tipo || 'success';
    var toast = document.getElementById('toast');
    toast.innerHTML = '<i class="fas fa-' + (tipo === 'error' ? 'exclamation-circle' : 'check-circle') + '"></i> ' + msg;
    toast.className = 'toast show ' + tipo;
    setTimeout(function() { toast.classList.remove('show'); }, 3000);
}
