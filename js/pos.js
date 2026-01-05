// ==================== POS.JS ====================
if (!API.isLoggedIn()) window.location.href = '../index.html';

var productos = [];
var categorias = [];
var clientes = [];
var metodosPago = [];
var carrito = [];
var clienteSeleccionado = null;
var tipoVenta = 'CONTADO';
var tipoPrecio = 1;
var descuentoGlobal = 0;
var turnoActual = null;
var corteData = null;
var ventasEnEspera = JSON.parse(localStorage.getItem('ventasEnEspera') || '[]');
var UNIDADES_GRANEL = ['KG', 'GR', 'LT', 'ML', 'MT'];
var denominaciones = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5];

document.addEventListener('DOMContentLoaded', function() {
    cargarUsuario();
    verificarTurno();
    setupEventos();
    setupKeyboard();
    actualizarBadgeEspera();
});

function cargarUsuario() {
    var u = API.usuario;
    document.getElementById('userName').textContent = u.nombre || 'Usuario';
    document.getElementById('userSucursal').textContent = u.sucursal_nombre || 'Sucursal';
    var iniciales = (u.nombre || 'U').split(' ').map(function(n) { return n.charAt(0); }).join('').substring(0, 2);
    document.getElementById('userAvatar').textContent = iniciales.toUpperCase();
}

// ==================== TURNOS ====================
function verificarTurno() {
    API.request('/turnos/activo/' + API.usuario.sucursal_id + '/' + API.usuario.id)
        .then(function(r) {
            if (r.success && r.activo) {
                turnoActual = r.turno;
                actualizarUITurno(true);
                cargarDatos();
            } else {
                turnoActual = null;
                actualizarUITurno(false);
                abrirModalAbrirTurno();
            }
        })
        .catch(function(e) {
            console.error('Error verificando turno:', e);
            mostrarToast('Error verificando turno', 'error');
        });
}

function actualizarUITurno(abierto) {
    var badge = document.getElementById('turnoBadge');
    var btnCerrar = document.getElementById('btnCerrarTurno');
    
    if (abierto) {
        badge.innerHTML = '<i class="fas fa-circle"></i><span>Turno Abierto</span>';
        badge.className = 'turno-badge abierto';
        badge.onclick = null;
        if (btnCerrar) btnCerrar.style.display = 'flex';
        habilitarPOS(true);
    } else {
        badge.innerHTML = '<i class="fas fa-circle"></i><span>Sin Turno</span>';
        badge.className = 'turno-badge cerrado';
        badge.onclick = abrirModalAbrirTurno;
        if (btnCerrar) btnCerrar.style.display = 'none';
        habilitarPOS(false);
    }
}

function habilitarPOS(habilitar) {
    var elementos = document.querySelectorAll('.pos-main input, .pos-main button, .cliente-selector');
    elementos.forEach(function(el) {
        if (habilitar) {
            el.removeAttribute('disabled');
            el.style.pointerEvents = '';
            el.style.opacity = '';
        } else {
            el.setAttribute('disabled', 'disabled');
            el.style.pointerEvents = 'none';
            el.style.opacity = '0.5';
        }
    });
    
    var cartEmpty = document.getElementById('cartEmpty');
    if (!habilitar) {
        cartEmpty.innerHTML = '<i class="fas fa-lock"></i><h3>Turno Cerrado</h3><p>Abre un turno para comenzar a vender</p>';
    } else {
        cartEmpty.innerHTML = '<i class="fas fa-shopping-cart"></i><h3>Carrito vacío</h3><p>Escanea un producto o presiona F2 para buscar</p>';
    }
}

function abrirModalAbrirTurno() {
    document.getElementById('saldoInicial').value = '';
    document.getElementById('modalAbrirTurno').classList.add('active');
    setTimeout(function() { document.getElementById('saldoInicial').focus(); }, 100);
}

function confirmarAbrirTurno() {
    var saldo = parseFloat(document.getElementById('saldoInicial').value) || 0;
    
    API.request('/turnos/abrir', 'POST', {
        empresa_id: API.usuario.empresa_id,
        sucursal_id: API.usuario.sucursal_id,
        caja_id: API.usuario.caja_id || 'CAJA-01',
        usuario_id: API.usuario.id,
        saldo_inicial: saldo
    }).then(function(r) {
        if (r.success) {
            cerrarModal('modalAbrirTurno');
            mostrarToast('Turno abierto correctamente', 'success');
            verificarTurno();
        } else {
            mostrarToast(r.error || 'Error al abrir turno', 'error');
        }
    }).catch(function(e) {
        mostrarToast('Error de conexión', 'error');
    });
}

// ==================== CORTE DE CAJA ====================
function abrirModalCerrarTurno() {
    if (!turnoActual) return;
    
    limpiarContador();
    
    API.request('/turnos/resumen/' + turnoActual.turno_id)
        .then(function(r) {
            if (r.success) {
                corteData = r;
                renderResumenCorte(r);
                document.getElementById('modalCerrarTurno').classList.add('active');
            } else {
                mostrarToast('Error cargando datos del turno', 'error');
            }
        })
        .catch(function(e) {
            mostrarToast('Error de conexión', 'error');
        });
}

function renderResumenCorte(data) {
    var t = data.turno;
    var saldoInicial = parseFloat(t.saldo_inicial) || 0;
    
    var pagosHtml = '';
    var totalVentas = 0;
    var efectivoVentas = 0;
    
    data.pagos_por_metodo.forEach(function(p) {
        var iconClass = 'otro';
        var iconName = 'fa-money-bill';
        
        if (p.tipo === 'EFECTIVO') {
            iconClass = 'efectivo';
            iconName = 'fa-money-bill-wave';
            efectivoVentas = p.total;
        } else if (p.tipo === 'TARJETA') {
            iconClass = 'tarjeta';
            iconName = 'fa-credit-card';
        } else if (p.tipo === 'TRANSFERENCIA') {
            iconClass = 'transferencia';
            iconName = 'fa-exchange-alt';
        }
        
        totalVentas += p.total;
        
        pagosHtml += '<div class="metodo-pago-row">' +
            '<div class="metodo-info">' +
                '<div class="metodo-icon ' + iconClass + '"><i class="fas ' + iconName + '"></i></div>' +
                '<div>' +
                    '<div class="metodo-nombre">' + p.nombre + '</div>' +
                    '<div class="metodo-cantidad">' + p.cantidad + ' cobros</div>' +
                '</div>' +
            '</div>' +
            '<div class="metodo-total">$' + p.total.toFixed(2) + '</div>' +
        '</div>';
    });
    
    if (!pagosHtml) {
        pagosHtml = '<p style="text-align:center;color:#9ca3af;padding:20px">Sin ventas en este turno</p>';
    }
    
    document.getElementById('cortePagosPorMetodo').innerHTML = pagosHtml;
    document.getElementById('corteTotalVentas').textContent = '$' + totalVentas.toFixed(2);
    
    document.getElementById('corteIngresos').textContent = '+$' + data.movimientos.ingresos.toFixed(2);
    document.getElementById('corteEgresos').textContent = '-$' + data.movimientos.egresos.toFixed(2);
    
    document.getElementById('corteSaldoInicial').textContent = '$' + saldoInicial.toFixed(2);
    document.getElementById('corteVentasEfectivo').textContent = '$' + efectivoVentas.toFixed(2);
    document.getElementById('corteIngresosArqueo').textContent = '+$' + data.movimientos.ingresos.toFixed(2);
    document.getElementById('corteEgresosArqueo').textContent = '-$' + data.movimientos.egresos.toFixed(2);
    document.getElementById('corteEsperado').textContent = '$' + data.efectivo_esperado.toFixed(2);
    
    document.getElementById('corteNumVentas').textContent = data.ventas.cantidad_ventas;
    document.getElementById('corteNumCanceladas').textContent = data.ventas.cantidad_canceladas;
}

// ==================== CONTADOR DE BILLETES Y MONEDAS ====================
function ajustarContador(valor, delta) {
    var inputId = 'cont_' + String(valor).replace('.', '');
    var input = document.getElementById(inputId);
    var actual = parseInt(input.value) || 0;
    input.value = Math.max(0, actual + delta);
    calcularTotalContado();
}

function calcularTotalContado() {
    var total = 0;
    
    denominaciones.forEach(function(d) {
        var inputId = 'cont_' + String(d).replace('.', '');
        var subId = 'sub_' + String(d).replace('.', '');
        var cantidad = parseInt(document.getElementById(inputId).value) || 0;
        var subtotal = cantidad * d;
        total += subtotal;
        document.getElementById(subId).textContent = '$' + subtotal.toFixed(0);
    });
    
    document.getElementById('totalContado').textContent = '$' + total.toFixed(2);
    
    if (corteData) {
        var esperado = corteData.efectivo_esperado;
        var diferencia = total - esperado;
        
        var difBox = document.getElementById('contDiferenciaBox');
        var difText = document.getElementById('contDiferencia');
        var statusBox = document.getElementById('conteoStatus');
        
        if (total === 0) {
            difText.textContent = '$0.00';
            difBox.className = 'conteo-diferencia';
            statusBox.className = 'conteo-status pendiente';
            statusBox.innerHTML = '<i class="fas fa-clock"></i><span>Cuenta el efectivo para continuar</span>';
        } else if (Math.abs(diferencia) < 0.01) {
            difText.textContent = '$0.00';
            difBox.className = 'conteo-diferencia exacto';
            statusBox.className = 'conteo-status correcto';
            statusBox.innerHTML = '<i class="fas fa-check-circle"></i><span>¡Caja cuadrada! Todo correcto</span>';
        } else if (diferencia > 0) {
            difText.textContent = '+$' + diferencia.toFixed(2);
            difBox.className = 'conteo-diferencia positivo';
            statusBox.className = 'conteo-status sobrante';
            statusBox.innerHTML = '<i class="fas fa-arrow-up"></i><span>Sobrante de $' + diferencia.toFixed(2) + '</span>';
        } else {
            difText.textContent = '-$' + Math.abs(diferencia).toFixed(2);
            difBox.className = 'conteo-diferencia negativo';
            statusBox.className = 'conteo-status faltante';
            statusBox.innerHTML = '<i class="fas fa-exclamation-triangle"></i><span>Faltante de $' + Math.abs(diferencia).toFixed(2) + '</span>';
        }
    }
}

function limpiarContador() {
    denominaciones.forEach(function(d) {
        var inputId = 'cont_' + String(d).replace('.', '');
        document.getElementById(inputId).value = 0;
    });
    calcularTotalContado();
}

function validarClaveAdmin() {
    var clave = document.getElementById('claveAdmin').value;
    
    if (!clave) {
        mostrarToast('Ingresa la clave de administrador', 'error');
        return;
    }
    
    API.request('/turnos/validar-admin', 'POST', {
        empresa_id: API.usuario.empresa_id,
        password: clave
    }).then(function(r) {
        if (r.success) {
            cerrarModal('modalValidarAdmin');
            limpiarContador();
            mostrarToast('Autorizado por ' + r.admin + '. Puede volver a contar.', 'success');
        } else {
            mostrarToast('Clave incorrecta', 'error');
        }
    });
}

// ==================== CONFIRMAR CIERRE ====================
function confirmarCerrarTurno() {
    if (!turnoActual || !corteData) return;
    
    var totalContado = 0;
    denominaciones.forEach(function(d) {
        var inputId = 'cont_' + String(d).replace('.', '');
        var cantidad = parseInt(document.getElementById(inputId).value) || 0;
        totalContado += cantidad * d;
    });
    
    if (totalContado === 0) {
        mostrarToast('Debes contar el efectivo en caja', 'error');
        return;
    }
    
    var diferencia = totalContado - corteData.efectivo_esperado;
    var mensaje = '';
    
    if (Math.abs(diferencia) < 0.01) {
        mensaje = '¿Confirmar cierre de turno? La caja está cuadrada.';
    } else if (diferencia > 0) {
        mensaje = '¿Confirmar cierre de turno? Hay un sobrante de $' + diferencia.toFixed(2);
    } else {
        mensaje = '¿Confirmar cierre de turno? Hay un faltante de $' + Math.abs(diferencia).toFixed(2);
    }
    
    if (!confirm(mensaje)) return;
    
    var observaciones = document.getElementById('observacionesCierre').value;
    
    var desglose = {};
    denominaciones.forEach(function(d) {
        var inputId = 'cont_' + String(d).replace('.', '');
        desglose['d' + String(d).replace('.', '_')] = parseInt(document.getElementById(inputId).value) || 0;
    });
    
    API.request('/turnos/cerrar/' + turnoActual.turno_id, 'POST', {
        efectivo_declarado: totalContado,
        desglose_efectivo: JSON.stringify(desglose),
        observaciones: observaciones,
        cerrado_por: API.usuario.id
    }).then(function(r) {
        if (r.success) {
            cerrarModal('modalCerrarTurno');
            mostrarCorteResumen(r.corte);
        } else {
            mostrarToast(r.error || 'Error al cerrar turno', 'error');
        }
    }).catch(function(e) {
        mostrarToast('Error de conexión', 'error');
    });
}

function mostrarCorteResumen(corte) {
    var diferencia = corte.diferencia;
    var headerClass = 'correcto';
    var icono = 'fa-check-circle';
    var titulo = '¡Caja Cuadrada!';
    
    if (diferencia > 0.01) {
        headerClass = 'sobrante';
        icono = 'fa-arrow-circle-up';
        titulo = 'Sobrante en Caja';
    } else if (diferencia < -0.01) {
        headerClass = 'faltante';
        icono = 'fa-exclamation-circle';
        titulo = 'Faltante en Caja';
    }
    
    var difText = Math.abs(diferencia) < 0.01 ? '$0.00' : (diferencia > 0 ? '+' : '-') + '$' + Math.abs(diferencia).toFixed(2);
    
    var html = '<div class="corte-resumen-final">' +
        '<div class="corte-resumen-header ' + headerClass + '">' +
            '<div class="icono"><i class="fas ' + icono + '"></i></div>' +
            '<h3>' + titulo + '</h3>' +
            '<div class="diferencia-final">' + difText + '</div>' +
        '</div>' +
        '<div class="corte-resumen-body">' +
            '<div class="corte-resumen-grid">' +
                '<div class="corte-resumen-seccion">' +
                    '<h5>Ventas por Método</h5>' +
                    '<div class="item"><span>Efectivo:</span><strong>$' + corte.ventas_efectivo.toFixed(2) + '</strong></div>' +
                    '<div class="item"><span>Tarjeta:</span><strong>$' + corte.ventas_tarjeta.toFixed(2) + '</strong></div>' +
                    '<div class="item"><span>Transferencia:</span><strong>$' + corte.ventas_transferencia.toFixed(2) + '</strong></div>' +
                    '<div class="item"><span>Crédito:</span><strong>$' + corte.ventas_credito.toFixed(2) + '</strong></div>' +
                    '<div class="item total"><span>Total Ventas:</span><strong>$' + corte.total_ventas.toFixed(2) + '</strong></div>' +
                '</div>' +
                '<div class="corte-resumen-seccion">' +
                    '<h5>Arqueo de Efectivo</h5>' +
                    '<div class="item"><span>Saldo Inicial:</span><strong>$' + corte.saldo_inicial.toFixed(2) + '</strong></div>' +
                    '<div class="item"><span>+ Ventas Efectivo:</span><strong>$' + corte.ventas_efectivo.toFixed(2) + '</strong></div>' +
                    '<div class="item" style="color:#10b981"><span>+ Ingresos:</span><strong>$' + corte.ingresos.toFixed(2) + '</strong></div>' +
                    '<div class="item" style="color:#ef4444"><span>- Egresos:</span><strong>$' + corte.egresos.toFixed(2) + '</strong></div>' +
                    '<div class="item total"><span>Esperado:</span><strong>$' + corte.efectivo_esperado.toFixed(2) + '</strong></div>' +
                    '<div class="item total"><span>Declarado:</span><strong>$' + corte.efectivo_declarado.toFixed(2) + '</strong></div>' +
                '</div>' +
            '</div>' +
        '</div>' +
        '<div class="corte-resumen-footer">' +
            '<span><i class="fas fa-receipt"></i> ' + corte.cantidad_ventas + ' ventas</span>' +
            '<span><i class="fas fa-times-circle"></i> ' + corte.cantidad_canceladas + ' canceladas</span>' +
            '<span><i class="fas fa-clock"></i> ' + new Date().toLocaleString('es-MX') + '</span>' +
        '</div>' +
    '</div>';
    
    document.getElementById('corteResumenContent').innerHTML = html;
    document.getElementById('modalCorteResumen').classList.add('active');
}

function imprimirCorte() {
    mostrarToast('Imprimiendo corte de caja...');
}

function cerrarCorteYSalir() {
    cerrarModal('modalCorteResumen');
    turnoActual = null;
    corteData = null;
    actualizarUITurno(false);
    abrirModalAbrirTurno();
}

// ==================== MOVIMIENTOS DE CAJA ====================
function abrirModalMovimiento(tipo) {
    if (!turnoActual) {
        mostrarToast('No hay turno abierto', 'error');
        return;
    }
    
    document.getElementById('movimientoTipo').value = tipo;
    document.getElementById('movimientoTitulo').textContent = tipo === 'INGRESO' ? 'Ingreso de Efectivo' : 'Retiro de Efectivo';
    document.getElementById('movimientoIcono').className = 'fas fa-' + (tipo === 'INGRESO' ? 'arrow-down' : 'arrow-up');
    document.getElementById('movimientoMonto').value = '';
    document.getElementById('movimientoConcepto').value = '';
    document.getElementById('movimientoReferencia').value = '';
    
    var header = document.querySelector('#modalMovimiento .modal-header');
    header.style.background = tipo === 'INGRESO' ? 
        'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 
        'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
    
    document.getElementById('modalMovimiento').classList.add('active');
    setTimeout(function() { document.getElementById('movimientoMonto').focus(); }, 100);
}

function confirmarMovimiento() {
    var tipo = document.getElementById('movimientoTipo').value;
    var monto = parseFloat(document.getElementById('movimientoMonto').value);
    var concepto = document.getElementById('movimientoConcepto').value.trim();
    var referencia = document.getElementById('movimientoReferencia').value.trim();
    
    if (!monto || monto <= 0) {
        mostrarToast('Ingresa un monto válido', 'error');
        return;
    }
    if (!concepto) {
        mostrarToast('Ingresa un concepto', 'error');
        return;
    }
    
    API.request('/movimientos-caja', 'POST', {
        turno_id: turnoActual.turno_id,
        empresa_id: API.usuario.empresa_id,
        sucursal_id: API.usuario.sucursal_id,
        usuario_id: API.usuario.id,
        tipo: tipo,
        monto: monto,
        concepto: concepto,
        referencia: referencia
    }).then(function(r) {
        if (r.success) {
            cerrarModal('modalMovimiento');
            mostrarToast((tipo === 'INGRESO' ? 'Ingreso' : 'Retiro') + ' de $' + monto.toFixed(2) + ' registrado', 'success');
        } else {
            mostrarToast(r.error || 'Error al registrar movimiento', 'error');
        }
    });
}

// ==================== VENTAS EN ESPERA ====================
function actualizarBadgeEspera() {
    var btn = document.getElementById('btnEspera');
    if (!btn) return;
    
    var badge = btn.querySelector('.espera-badge');
    if (ventasEnEspera.length > 0) {
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'espera-badge';
            btn.appendChild(badge);
        }
        badge.textContent = ventasEnEspera.length;
    } else if (badge) {
        badge.remove();
    }
}

function ponerEnEspera() {
    if (!carrito.length) {
        mostrarToast('No hay productos en el carrito', 'error');
        return;
    }
    
    var ventaEspera = {
        id: Date.now(),
        fecha: new Date().toISOString(),
        cliente: clienteSeleccionado ? JSON.parse(JSON.stringify(clienteSeleccionado)) : null,
        clienteNombre: clienteSeleccionado ? clienteSeleccionado.nombre : 'Público General',
        tipoVenta: tipoVenta,
        tipoPrecio: tipoPrecio,
        descuentoGlobal: descuentoGlobal,
        carrito: JSON.parse(JSON.stringify(carrito)),
        total: calcularTotalFinal(),
        articulos: carrito.reduce(function(s, i) { return s + i.cantidad; }, 0)
    };
    
    ventasEnEspera.push(ventaEspera);
    localStorage.setItem('ventasEnEspera', JSON.stringify(ventasEnEspera));
    
    limpiarVentaActual();
    actualizarBadgeEspera();
    mostrarToast('Venta guardada en espera (' + ventasEnEspera.length + ')');
    focusBuscar();
}

function abrirModalEspera() {
    renderEsperaList();
    document.getElementById('modalEspera').classList.add('active');
}

function renderEsperaList() {
    var cont = document.getElementById('esperaList');
    
    if (!ventasEnEspera.length) {
        cont.innerHTML = '<div class="espera-empty">' +
            '<i class="fas fa-inbox"></i>' +
            '<h4>No hay ventas en espera</h4>' +
            '<p>Las ventas pausadas aparecerán aquí</p>' +
        '</div>';
        return;
    }
    
    var html = '';
    ventasEnEspera.forEach(function(v, index) {
        var fecha = new Date(v.fecha);
        var hora = fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
        
        html += '<div class="espera-item">' +
            '<div class="espera-item-header">' +
                '<span class="espera-item-cliente"><i class="fas fa-user"></i> ' + v.clienteNombre + '</span>' +
                '<span class="espera-item-total">$' + v.total.toFixed(2) + '</span>' +
            '</div>' +
            '<div class="espera-item-meta">' +
                '<span><i class="fas fa-clock"></i> ' + hora + '</span>' +
                '<span><i class="fas fa-shopping-cart"></i> ' + Math.round(v.articulos) + ' artículos</span>' +
                '<span class="badge-' + v.tipoVenta.toLowerCase() + '">' + v.tipoVenta + '</span>' +
            '</div>' +
            '<div class="espera-item-actions">' +
                '<button class="btn-recuperar" onclick="recuperarVenta(' + index + ')"><i class="fas fa-play"></i> Recuperar</button>' +
                '<button class="btn-eliminar-espera" onclick="eliminarVentaEspera(' + index + ')"><i class="fas fa-trash"></i></button>' +
            '</div>' +
        '</div>';
    });
    cont.innerHTML = html;
}

function recuperarVenta(index) {
    var venta = ventasEnEspera[index];
    if (!venta) return;
    
    if (carrito.length > 0) {
        if (!confirm('Hay una venta en curso. ¿Guardarla en espera y recuperar la seleccionada?')) {
            return;
        }
        ponerEnEspera();
    }
    
    carrito = venta.carrito;
    clienteSeleccionado = venta.cliente;
    tipoVenta = venta.tipoVenta;
    tipoPrecio = venta.tipoPrecio;
    descuentoGlobal = venta.descuentoGlobal;
    
    document.getElementById('clienteNombre').textContent = venta.clienteNombre;
    document.getElementById('clientePanel').textContent = venta.clienteNombre;
    document.getElementById('btnContado').classList.toggle('active', tipoVenta === 'CONTADO');
    document.getElementById('btnCredito').classList.toggle('active', tipoVenta === 'CREDITO');
    document.getElementById('tipoVentaLabel').textContent = tipoVenta === 'CONTADO' ? 'Contado' : 'Crédito';
    document.getElementById('selectPrecio').value = tipoPrecio;
    
    ventasEnEspera.splice(index, 1);
    localStorage.setItem('ventasEnEspera', JSON.stringify(ventasEnEspera));
    
    renderCarrito();
    actualizarBadgeEspera();
    cerrarModal('modalEspera');
    mostrarToast('Venta recuperada');
    focusBuscar();
}

function eliminarVentaEspera(index) {
    if (!confirm('¿Eliminar esta venta en espera?')) return;
    
    ventasEnEspera.splice(index, 1);
    localStorage.setItem('ventasEnEspera', JSON.stringify(ventasEnEspera));
    
    renderEsperaList();
    actualizarBadgeEspera();
    mostrarToast('Venta eliminada de espera');
}

function limpiarVentaActual() {
    carrito = [];
    clienteSeleccionado = null;
    tipoVenta = 'CONTADO';
    descuentoGlobal = 0;
    tipoPrecio = 1;
    
    document.getElementById('clienteNombre').textContent = 'Público General';
    document.getElementById('clientePanel').textContent = 'Público General';
    document.getElementById('btnContado').classList.add('active');
    document.getElementById('btnCredito').classList.remove('active');
    document.getElementById('tipoVentaLabel').textContent = 'Contado';
    document.getElementById('selectPrecio').value = '1';
    document.getElementById('inputBuscar').value = '';
    
    renderCarrito();
}

// ==================== CARGAR DATOS ====================
function cargarDatos() {
    API.request('/pos/cargar/' + API.usuario.empresa_id + '/' + API.usuario.sucursal_id)
        .then(function(r) {
            if (r.success) {
                productos = r.productos || [];
                categorias = r.categorias || [];
                clientes = r.clientes || [];
                metodosPago = r.metodos || [];
                renderCategoriasSelect();
                renderMetodosPago();
                focusBuscar();
            }
        })
        .catch(function(e) { 
            console.error(e); 
            mostrarToast('Error cargando datos', 'error'); 
        });
}

function focusBuscar() {
    setTimeout(function() {
        var input = document.getElementById('inputBuscar');
        if (input && !document.querySelector('.modal-overlay.active')) {
            input.focus();
        }
    }, 100);
}

function renderCategoriasSelect() {
    var sel = document.getElementById('filtroCategoria');
    if (!sel) return;
    sel.innerHTML = '<option value="">Todas</option>';
    categorias.forEach(function(c) {
        if (c.activo !== 'N') {
            sel.innerHTML += '<option value="' + c.categoria_id + '">' + c.nombre + '</option>';
        }
    });
}

function renderMetodosPago() {
    var cont = document.getElementById('metodosPagoContainer');
    if (!cont) return;
    
    if (!metodosPago.length) {
        cont.innerHTML = '<button type="button" class="metodo-btn active" data-metodo-id="EFECTIVO"><i class="fas fa-money-bill"></i><span>Efectivo</span></button>';
        return;
    }
    
    var html = '';
    metodosPago.forEach(function(m, i) {
        var icono = m.icono || 'fa-money-bill-wave';
        if (icono.indexOf('fa-') !== 0) icono = 'fa-' + icono;
        
        html += '<button type="button" class="metodo-btn' + (i === 0 ? ' active' : '') + '" data-metodo-id="' + m.metodo_pago_id + '">' +
            '<i class="fas ' + icono + '"></i><span>' + m.nombre + '</span>' +
        '</button>';
    });
    cont.innerHTML = html;
    
    document.querySelectorAll('.metodo-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.metodo-btn').forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
        });
    });
}

function setupEventos() {
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.modal') && !e.target.closest('input') && !e.target.closest('button') && !e.target.closest('select')) {
            focusBuscar();
        }
    });
}

function setupKeyboard() {
    document.addEventListener('keydown', function(e) {
        if (e.key === 'F2') { e.preventDefault(); if (turnoActual) abrirModalProductos(); }
        if (e.key === 'F4') { e.preventDefault(); cancelarVenta(); }
        if (e.key === 'F8') { e.preventDefault(); if (carrito.length && turnoActual) ponerEnEspera(); }
        if (e.key === 'F9') { e.preventDefault(); abrirModalEspera(); }
        if (e.key === 'F12') { e.preventDefault(); if (carrito.length && turnoActual) abrirModalCobro(); }
        if (e.key === 'Escape') { cerrarTodosModales(); focusBuscar(); }
    });
}

function onBuscarKeypress(e) {
    if (e.key === 'Enter') {
        var codigo = e.target.value.trim();
        if (codigo) {
            var prod = productos.find(function(p) { 
                return p.codigo_barras === codigo || p.codigo_interno === codigo; 
            });
            if (prod) { 
                verificarYAgregar(prod); 
                e.target.value = ''; 
            } else { 
                mostrarToast('Producto no encontrado', 'error'); 
            }
        }
        focusBuscar();
    }
}

// ==================== PRECIOS ====================
function getPrecioConImpuestos(prod, numPrecio) {
    numPrecio = numPrecio || tipoPrecio;
    
    if (numPrecio === 1 && prod.precio_venta) return parseFloat(prod.precio_venta) || 0;
    if (numPrecio === 2 && prod.precio_venta2) return parseFloat(prod.precio_venta2) || 0;
    if (numPrecio === 3 && prod.precio_venta3) return parseFloat(prod.precio_venta3) || 0;
    if (numPrecio === 4 && prod.precio_venta4) return parseFloat(prod.precio_venta4) || 0;
    
    return parseFloat(prod['precio' + numPrecio] || prod.precio1) || 0;
}

function setTipoVenta(tipo) {
    tipoVenta = tipo;
    document.getElementById('btnContado').classList.toggle('active', tipo === 'CONTADO');
    document.getElementById('btnCredito').classList.toggle('active', tipo === 'CREDITO');
    document.getElementById('tipoVentaLabel').textContent = tipo === 'CONTADO' ? 'Contado' : 'Crédito';
    focusBuscar();
}

function cambiarTipoPrecio() {
    tipoPrecio = parseInt(document.getElementById('selectPrecio').value);
    carrito.forEach(function(item) {
        var prod = productos.find(function(p) { return p.producto_id === item.producto_id; });
        if (prod) item.precio = getPrecioConImpuestos(prod, tipoPrecio);
    });
    renderCarrito();
    focusBuscar();
}

// ==================== MODAL PRODUCTOS ====================
function abrirModalProductos() {
    document.getElementById('modalProductos').classList.add('active');
    document.getElementById('filtroNombre').value = '';
    document.getElementById('filtroCantidad').value = '1';
    document.getElementById('filtroPrecio').value = tipoPrecio;
    filtrarProductos();
    setTimeout(function() { document.getElementById('filtroNombre').focus(); }, 100);
}

function filtrarProductos() {
    var nombre = (document.getElementById('filtroNombre').value || '').toLowerCase();
    var categoria = document.getElementById('filtroCategoria').value;
    var precioTipo = parseInt(document.getElementById('filtroPrecio').value) || 1;
    
    var filtrados = productos.filter(function(p) {
        var matchNombre = !nombre || 
            p.nombre.toLowerCase().indexOf(nombre) >= 0 ||
            (p.codigo_barras && p.codigo_barras.indexOf(nombre) >= 0) ||
            (p.codigo_interno && p.codigo_interno.toLowerCase().indexOf(nombre) >= 0);
        var matchCategoria = !categoria || p.categoria_id === categoria;
        return matchNombre && matchCategoria && p.activo !== 'N';
    });
    
    renderProductosModal(filtrados, precioTipo);
}

function renderProductosModal(items, precioTipo) {
    var tbody = document.getElementById('productosBody');
    if (!items.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding:40px;color:#9ca3af">No hay productos</td></tr>';
        return;
    }
    
    var html = '';
    items.forEach(function(p) {
        var precio = getPrecioConImpuestos(p, precioTipo);
        var unidad = p.unidad_venta || 'PZ';
        var esGranel = UNIDADES_GRANEL.indexOf(unidad.toUpperCase()) >= 0;
        
        html += '<tr onclick="seleccionarProducto(\'' + p.producto_id + '\')">' +
            '<td><img class="producto-img" src="' + (p.imagen_url || 'https://via.placeholder.com/48?text=P') + '" onerror="this.src=\'https://via.placeholder.com/48?text=P\'"></td>' +
            '<td class="producto-codigo">' + (p.codigo_barras || p.codigo_interno || '-') + '</td>' +
            '<td class="producto-nombre">' + p.nombre + (esGranel ? ' <small style="color:#10b981">(Granel)</small>' : '') + '</td>' +
            '<td><span class="badge-unidad">' + unidad + '</span></td>' +
            '<td>' + (p.descuento > 0 ? '<span class="badge-descuento"><i class="fas fa-tag"></i> ' + p.descuento + '%</span>' : '-') + '</td>' +
            '<td class="producto-precio">$' + precio.toFixed(2) + '</td>' +
        '</tr>';
    });
    tbody.innerHTML = html;
}

function ajustarCantidadFiltro(d) {
    var inp = document.getElementById('filtroCantidad');
    inp.value = Math.max(0.001, (parseFloat(inp.value) || 1) + d);
}

function seleccionarProducto(id) {
    var prod = productos.find(function(p) { return p.producto_id === id; });
    if (!prod) return;
    
    var cantidad = parseFloat(document.getElementById('filtroCantidad').value) || 1;
    var unidad = (prod.unidad_venta || 'PZ').toUpperCase();
    
    if (UNIDADES_GRANEL.indexOf(unidad) >= 0) {
        cerrarModal('modalProductos');
        abrirModalCantidad(prod);
    } else {
        agregarAlCarrito(prod, cantidad);
        cerrarModal('modalProductos');
        focusBuscar();
    }
}

function verificarYAgregar(prod) {
    var unidad = (prod.unidad_venta || 'PZ').toUpperCase();
    if (UNIDADES_GRANEL.indexOf(unidad) >= 0) {
        abrirModalCantidad(prod);
    } else {
        agregarAlCarrito(prod, 1);
        focusBuscar();
    }
}

// ==================== MODAL CANTIDAD (GRANEL) ====================
var productoParaCantidad = null;

function abrirModalCantidad(prod) {
    productoParaCantidad = prod;
    var unidad = (prod.unidad_venta || 'KG').toUpperCase();
    var precio = getPrecioConImpuestos(prod, tipoPrecio);
    
    document.getElementById('cantidadTitulo').textContent = 'Cantidad en ' + unidad;
    document.getElementById('cantidadNombre').textContent = prod.nombre;
    document.getElementById('cantidadPrecioUnit').textContent = '$' + precio.toFixed(2) + ' / ' + unidad;
    document.getElementById('cantidadUnidad').textContent = unidad;
    document.getElementById('inputCantidadModal').value = '1';
    calcularSubtotalModal();
    document.getElementById('modalCantidad').classList.add('active');
    setTimeout(function() { document.getElementById('inputCantidadModal').select(); }, 100);
}

function ajustarCantidadModal(d) {
    var inp = document.getElementById('inputCantidadModal');
    inp.value = Math.max(0.001, (parseFloat(inp.value) || 0) + d).toFixed(3);
    calcularSubtotalModal();
}

function calcularSubtotalModal() {
    if (!productoParaCantidad) return;
    var cant = parseFloat(document.getElementById('inputCantidadModal').value) || 0;
    var precio = getPrecioConImpuestos(productoParaCantidad, tipoPrecio);
    document.getElementById('subtotalModal').textContent = '$' + (cant * precio).toFixed(2);
}

function confirmarCantidad() {
    if (!productoParaCantidad) return;
    var cant = parseFloat(document.getElementById('inputCantidadModal').value) || 0;
    if (cant <= 0) { 
        mostrarToast('Cantidad inválida', 'error'); 
        return; 
    }
    agregarAlCarrito(productoParaCantidad, cant);
    cerrarModal('modalCantidad');
    productoParaCantidad = null;
    focusBuscar();
}

// ==================== MODAL CLIENTE ====================
function abrirModalCliente() {
    document.getElementById('modalCliente').classList.add('active');
    document.getElementById('buscarCliente').value = '';
    filtrarClientes();
    setTimeout(function() { document.getElementById('buscarCliente').focus(); }, 100);
}

function filtrarClientes() {
    var busq = (document.getElementById('buscarCliente').value || '').toLowerCase();
    var filtrados = clientes.filter(function(c) {
        return !busq || 
            c.nombre.toLowerCase().indexOf(busq) >= 0 ||
            (c.telefono && c.telefono.indexOf(busq) >= 0);
    });
    renderClientesLista(filtrados);
}

function renderClientesLista(items) {
    var cont = document.getElementById('clientesList');
    if (!items.length) { 
        cont.innerHTML = '<p style="text-align:center;padding:40px;color:#9ca3af">No hay clientes</p>'; 
        return; 
    }
    
    var html = '';
    items.forEach(function(c) {
        var saldo = parseFloat(c.saldo) || 0;
        var limite = parseFloat(c.limite_credito) || 0;
        var disponible = limite - saldo;
        
        html += '<div class="cliente-item" onclick="seleccionarCliente(\'' + c.cliente_id + '\')">' +
            '<div class="cliente-item-avatar">' + c.nombre.charAt(0).toUpperCase() + '</div>' +
            '<div class="cliente-item-info">' +
                '<div class="cliente-item-name">' + c.nombre + '</div>' +
                '<div class="cliente-item-detail">' + (c.telefono || '-') + '</div>' +
                (c.permite_credito === 'Y' ? '<small style="color:#6366f1">Crédito: $' + disponible.toFixed(2) + ' disponible</small>' : '') +
            '</div>' +
            '<span class="cliente-item-badge">P' + (c.tipo_precio || 1) + '</span>' +
        '</div>';
    });
    cont.innerHTML = html;
}

function seleccionarCliente(id) {
    if (id) {
        clienteSeleccionado = clientes.find(function(c) { return c.cliente_id === id; });
        if (clienteSeleccionado) {
            document.getElementById('clienteNombre').textContent = clienteSeleccionado.nombre;
            document.getElementById('clientePanel').textContent = clienteSeleccionado.nombre;
            tipoPrecio = parseInt(clienteSeleccionado.tipo_precio) || 1;
            document.getElementById('selectPrecio').value = tipoPrecio;
            cambiarTipoPrecio();
        }
    } else {
        clienteSeleccionado = null;
        document.getElementById('clienteNombre').textContent = 'Público General';
        document.getElementById('clientePanel').textContent = 'Público General';
    }
    cerrarModal('modalCliente');
    focusBuscar();
}

// ==================== MODAL NUEVO PRODUCTO RAPIDO ====================
function abrirModalNuevoProducto() {
    document.getElementById('modalNuevoProducto').classList.add('active');
    document.getElementById('formNuevoProducto').reset();
    setTimeout(function() { document.getElementById('np_codigo').focus(); }, 100);
}

function guardarNuevoProducto(e) {
    e.preventDefault();
    var data = {
        empresa_id: API.usuario.empresa_id,
        codigo_barras: document.getElementById('np_codigo').value,
        nombre: document.getElementById('np_nombre').value,
        precio1: parseFloat(document.getElementById('np_precio').value) || 0,
        unidad_venta: document.getElementById('np_unidad').value,
        precio_incluye_impuesto: 'Y',
        activo: 'Y'
    };
    
    API.request('/productos', 'POST', data).then(function(r) {
        if (r.success) {
            mostrarToast('Producto creado', 'success');
            cerrarModal('modalNuevoProducto');
            cargarDatos();
            focusBuscar();
        } else { 
            mostrarToast('Error: ' + (r.error || 'No se pudo guardar'), 'error'); 
        }
    });
}

// ==================== MODAL NUEVO CLIENTE RAPIDO ====================
function abrirModalNuevoCliente() {
    document.getElementById('modalNuevoCliente').classList.add('active');
    document.getElementById('formNuevoCliente').reset();
    setTimeout(function() { document.getElementById('nc_nombre').focus(); }, 100);
}

function guardarNuevoCliente(e) {
    e.preventDefault();
    var data = {
        empresa_id: API.usuario.empresa_id,
        nombre: document.getElementById('nc_nombre').value,
        telefono: document.getElementById('nc_telefono').value,
        tipo_precio: document.getElementById('nc_tipo_precio').value,
        activo: 'Y'
    };
    
    API.request('/clientes', 'POST', data).then(function(r) {
        if (r.success) {
            mostrarToast('Cliente creado', 'success');
            cerrarModal('modalNuevoCliente');
            cargarDatos();
            focusBuscar();
        } else { 
            mostrarToast('Error: ' + (r.error || 'No se pudo guardar'), 'error'); 
        }
    });
}

// ==================== CARRITO ====================
function agregarAlCarrito(prod, cantidad) {
    var precio = getPrecioConImpuestos(prod, tipoPrecio);
    var unidad = prod.unidad_venta || 'PZ';
    var esGranel = UNIDADES_GRANEL.indexOf(unidad.toUpperCase()) >= 0;
    var descProd = parseFloat(prod.descuento) || 0;
    
    var existe = carrito.find(function(i) { return i.producto_id === prod.producto_id; });
    
    if (existe && !esGranel) {
        existe.cantidad += cantidad;
    } else {
        carrito.push({
            producto_id: prod.producto_id,
            codigo: prod.codigo_barras || prod.codigo_interno || '',
            nombre: prod.nombre,
            precio: precio,
            precioOriginal: precio,
            cantidad: cantidad,
            unidad: unidad,
            esGranel: esGranel,
            descuento: descProd
        });
    }
    
    renderCarrito();
    mostrarToast(prod.nombre + ' agregado');
}

function cambiarCantidad(id, d) {
    var item = carrito.find(function(i) { return i.producto_id === id; });
    if (!item) return;
    
    item.cantidad += d;
    if (item.cantidad <= 0) {
        carrito = carrito.filter(function(i) { return i.producto_id !== id; });
    }
    renderCarrito();
    focusBuscar();
}

function eliminarDelCarrito(id) {
    carrito = carrito.filter(function(i) { return i.producto_id !== id; });
    renderCarrito();
    focusBuscar();
}

// ==================== EDITAR EN LÍNEA ====================
var editarLineaData = { id: null, tipo: null };

function editarCantidadLinea(id) {
    var item = carrito.find(function(i) { return i.producto_id === id; });
    if (!item) return;
    
    editarLineaData = { id: id, tipo: 'cantidad' };
    
    document.getElementById('editarLineaTitulo').textContent = 'Editar Cantidad';
    document.getElementById('editarLineaProducto').textContent = item.nombre;
    document.getElementById('editarLineaLabel').textContent = 'Nueva cantidad';
    document.getElementById('editarLineaPrefix').textContent = '';
    document.getElementById('editarLineaSuffix').textContent = item.unidad;
    document.getElementById('inputEditarLinea').value = item.cantidad;
    document.getElementById('inputEditarLinea').step = item.esGranel ? '0.001' : '1';
    
    var shortcuts = document.getElementById('editarShortcuts');
    if (item.esGranel) {
        shortcuts.innerHTML = 
            '<button type="button" onclick="setEditarValor(0.25)">0.250</button>' +
            '<button type="button" onclick="setEditarValor(0.5)">0.500</button>' +
            '<button type="button" onclick="setEditarValor(0.75)">0.750</button>' +
            '<button type="button" onclick="setEditarValor(1)">1.000</button>' +
            '<button type="button" onclick="setEditarValor(1.5)">1.500</button>' +
            '<button type="button" onclick="setEditarValor(2)">2.000</button>';
    } else {
        shortcuts.innerHTML = 
            '<button type="button" onclick="ajustarEditarValor(-1)">−1</button>' +
            '<button type="button" onclick="ajustarEditarValor(1)">+1</button>' +
            '<button type="button" onclick="ajustarEditarValor(5)">+5</button>' +
            '<button type="button" onclick="ajustarEditarValor(10)">+10</button>';
    }
    
    document.getElementById('modalEditarLinea').classList.add('active');
    setTimeout(function() { document.getElementById('inputEditarLinea').select(); }, 100);
}

function editarPrecioLinea(id) {
    var item = carrito.find(function(i) { return i.producto_id === id; });
    if (!item) return;
    
    editarLineaData = { id: id, tipo: 'precio' };
    
    document.getElementById('editarLineaTitulo').textContent = 'Editar Precio';
    document.getElementById('editarLineaProducto').textContent = item.nombre;
    document.getElementById('editarLineaLabel').textContent = 'Nuevo precio unitario';
    document.getElementById('editarLineaPrefix').textContent = '$';
    document.getElementById('editarLineaSuffix').textContent = '';
    document.getElementById('inputEditarLinea').value = item.precio.toFixed(2);
    document.getElementById('inputEditarLinea').step = '0.01';
    
    var original = item.precioOriginal || item.precio;
    document.getElementById('editarShortcuts').innerHTML = 
        '<button type="button" onclick="setEditarValor(' + original.toFixed(2) + ')" class="primary">Original $' + original.toFixed(2) + '</button>' +
        '<button type="button" onclick="ajustarEditarValor(-10)">−$10</button>' +
        '<button type="button" onclick="ajustarEditarValor(-5)">−$5</button>' +
        '<button type="button" onclick="ajustarEditarValor(5)">+$5</button>' +
        '<button type="button" onclick="ajustarEditarValor(10)">+$10</button>';
    
    document.getElementById('modalEditarLinea').classList.add('active');
    setTimeout(function() { document.getElementById('inputEditarLinea').select(); }, 100);
}

function editarDescuentoLinea(id) {
    var item = carrito.find(function(i) { return i.producto_id === id; });
    if (!item) return;
    
    editarLineaData = { id: id, tipo: 'descuento' };
    
    document.getElementById('editarLineaTitulo').textContent = 'Aplicar Descuento';
    document.getElementById('editarLineaProducto').textContent = item.nombre;
    document.getElementById('editarLineaLabel').textContent = 'Porcentaje de descuento';
    document.getElementById('editarLineaPrefix').textContent = '';
    document.getElementById('editarLineaSuffix').textContent = '%';
    document.getElementById('inputEditarLinea').value = item.descuento || 0;
    document.getElementById('inputEditarLinea').step = '1';
    
    document.getElementById('editarShortcuts').innerHTML = 
        '<button type="button" onclick="setEditarValor(0)">0%</button>' +
        '<button type="button" onclick="setEditarValor(5)">5%</button>' +
        '<button type="button" onclick="setEditarValor(10)">10%</button>' +
        '<button type="button" onclick="setEditarValor(15)">15%</button>' +
        '<button type="button" onclick="setEditarValor(20)">20%</button>' +
        '<button type="button" onclick="setEditarValor(25)">25%</button>';
    
    document.getElementById('modalEditarLinea').classList.add('active');
    setTimeout(function() { document.getElementById('inputEditarLinea').select(); }, 100);
}

function setEditarValor(val) {
    document.getElementById('inputEditarLinea').value = val;
}

function ajustarEditarValor(delta) {
    var inp = document.getElementById('inputEditarLinea');
    var val = parseFloat(inp.value) || 0;
    inp.value = Math.max(0, val + delta);
}

function onEditarLineaKeypress(e) {
    if (e.key === 'Enter') {
        confirmarEditarLinea();
    }
}

function confirmarEditarLinea() {
    if (editarLineaData.tipo === 'descuento_global') {
        var valor = parseFloat(document.getElementById('inputEditarLinea').value);
        descuentoGlobal = Math.min(100, Math.max(0, valor || 0));
        renderCarrito();
        cerrarModal('modalEditarLinea');
        mostrarToast('Descuento global: ' + descuentoGlobal + '%');
        focusBuscar();
        return;
    }
    
    var item = carrito.find(function(i) { return i.producto_id === editarLineaData.id; });
    if (!item) return;
    
    var valor = parseFloat(document.getElementById('inputEditarLinea').value);
    
    if (editarLineaData.tipo === 'cantidad') {
        if (valor > 0) {
            item.cantidad = valor;
        } else {
            carrito = carrito.filter(function(i) { return i.producto_id !== editarLineaData.id; });
        }
    } else if (editarLineaData.tipo === 'precio') {
        if (valor >= 0) {
            item.precio = valor;
        }
    } else if (editarLineaData.tipo === 'descuento') {
        item.descuento = Math.min(100, Math.max(0, valor || 0));
    }
    
    renderCarrito();
    cerrarModal('modalEditarLinea');
    focusBuscar();
}

function renderCarrito() {
    var tbody = document.getElementById('cartBody');
    var empty = document.getElementById('cartEmpty');
    
    if (!carrito.length) {
        tbody.innerHTML = '';
        empty.style.display = 'flex';
        actualizarTotales();
        return;
    }
    
    empty.style.display = 'none';
    
    var html = '';
    carrito.forEach(function(item) {
        var subtotal = item.precio * item.cantidad;
        var descMonto = subtotal * (item.descuento || 0) / 100;
        var total = subtotal - descMonto;
        
        var cantHtml = item.esGranel ?
            '<button class="qty-granel" onclick="editarCantidadLinea(\'' + item.producto_id + '\')">' + item.cantidad.toFixed(3) + '</button>' :
            '<div class="qty-control">' +
                '<button onclick="cambiarCantidad(\'' + item.producto_id + '\',-1)">−</button>' +
                '<span onclick="editarCantidadLinea(\'' + item.producto_id + '\')">' + item.cantidad + '</span>' +
                '<button onclick="cambiarCantidad(\'' + item.producto_id + '\',1)">+</button>' +
            '</div>';
        
        html += '<tr>' +
            '<td><div class="cart-item-name">' + item.nombre + '</div><div class="cart-item-code">' + item.codigo + '</div></td>' +
            '<td class="cart-item-price"><span onclick="editarPrecioLinea(\'' + item.producto_id + '\')" title="Click para editar">$' + item.precio.toFixed(2) + '</span></td>' +
            '<td class="cart-item-qty">' + cantHtml + '</td>' +
            '<td class="cart-item-unit"><span class="badge' + (item.esGranel ? ' granel' : '') + '">' + item.unidad + '</span></td>' +
            '<td class="cart-item-desc"><button class="btn-desc" onclick="editarDescuentoLinea(\'' + item.producto_id + '\')">' + (item.descuento > 0 ? item.descuento + '%' : '-') + '</button></td>' +
            '<td class="cart-item-total">$' + total.toFixed(2) + '</td>' +
            '<td><button class="btn-delete" onclick="eliminarDelCarrito(\'' + item.producto_id + '\')"><i class="fas fa-trash"></i></button></td>' +
        '</tr>';
    });
    tbody.innerHTML = html;
    actualizarTotales();
}

function actualizarTotales() {
    var articulos = 0, subtotal = 0, descuentos = 0;
    
    carrito.forEach(function(item) {
        articulos += item.cantidad;
        var sub = item.precio * item.cantidad;
        var desc = sub * (item.descuento || 0) / 100;
        subtotal += sub;
        descuentos += desc;
    });
    
    var descGlobal = (subtotal - descuentos) * descuentoGlobal / 100;
    var total = subtotal - descuentos - descGlobal;
    
    document.getElementById('totalArticulos').textContent = articulos.toFixed(2);
    document.getElementById('subtotalVenta').textContent = '$' + subtotal.toFixed(2);
    document.getElementById('descuentosVenta').textContent = '-$' + (descuentos + descGlobal).toFixed(2);
    document.getElementById('totalAmount').textContent = '$' + total.toFixed(2);
}

function calcularTotalFinal() {
    var subtotal = 0, descuentos = 0;
    
    carrito.forEach(function(item) {
        var sub = item.precio * item.cantidad;
        descuentos += sub * (item.descuento || 0) / 100;
        subtotal += sub;
    });
    
    var descGlobal = (subtotal - descuentos) * descuentoGlobal / 100;
    return subtotal - descuentos - descGlobal;
}

function aplicarDescuentoGlobal() {
    editarLineaData = { id: null, tipo: 'descuento_global' };
    
    document.getElementById('editarLineaTitulo').textContent = 'Descuento Global';
    document.getElementById('editarLineaProducto').textContent = 'Aplicar a toda la venta';
    document.getElementById('editarLineaLabel').textContent = 'Porcentaje de descuento';
    document.getElementById('editarLineaPrefix').textContent = '';
    document.getElementById('editarLineaSuffix').textContent = '%';
    document.getElementById('inputEditarLinea').value = descuentoGlobal;
    document.getElementById('inputEditarLinea').step = '1';
    
    document.getElementById('editarShortcuts').innerHTML = 
        '<button type="button" onclick="setEditarValor(0)">0%</button>' +
        '<button type="button" onclick="setEditarValor(5)">5%</button>' +
        '<button type="button" onclick="setEditarValor(10)">10%</button>' +
        '<button type="button" onclick="setEditarValor(15)">15%</button>' +
        '<button type="button" onclick="setEditarValor(20)">20%</button>' +
        '<button type="button" onclick="setEditarValor(25)">25%</button>';
    
    document.getElementById('modalEditarLinea').classList.add('active');
    setTimeout(function() { document.getElementById('inputEditarLinea').select(); }, 100);
}

function cancelarVenta() {
    if (!carrito.length) return;
    if (confirm('¿Cancelar venta actual?')) {
        limpiarVentaActual();
        mostrarToast('Venta cancelada');
    }
    focusBuscar();
}

// ==================== COBRO ====================
function abrirModalCobro() {
    if (!carrito.length) return;
    if (!turnoActual) {
        mostrarToast('No hay turno abierto', 'error');
        return;
    }
    
    var total = calcularTotalFinal();
    
    if (tipoVenta === 'CREDITO') {
        if (!clienteSeleccionado) {
            mostrarToast('Selecciona un cliente para venta a crédito', 'error');
            return;
        }
        if (clienteSeleccionado.permite_credito !== 'Y') {
            mostrarToast('Este cliente no tiene crédito autorizado', 'error');
            return;
        }
        
        var saldoActual = parseFloat(clienteSeleccionado.saldo) || 0;
        var limiteCredito = parseFloat(clienteSeleccionado.limite_credito) || 0;
        var disponible = limiteCredito - saldoActual;
        
        if (total > disponible) {
            mostrarToast('Crédito insuficiente. Disponible: $' + disponible.toFixed(2), 'error');
            return;
        }
    }
    
    document.getElementById('cobroTotal').textContent = '$' + total.toFixed(2);
    document.getElementById('cobroBadge').textContent = tipoVenta;
    document.getElementById('cobroBadge').className = 'cobro-badge ' + tipoVenta.toLowerCase();
    document.getElementById('inputEfectivo').value = '';
    document.getElementById('cobroCambio').textContent = '$0.00';
    document.getElementById('modalCobro').classList.add('active');
    
    setTimeout(function() { document.getElementById('inputEfectivo').focus(); }, 100);
}

function addEfectivo(m) {
    var inp = document.getElementById('inputEfectivo');
    inp.value = (parseFloat(inp.value) || 0) + m;
    calcularCambio();
}

function setExacto() {
    document.getElementById('inputEfectivo').value = calcularTotalFinal().toFixed(2);
    calcularCambio();
}

function limpiarEfectivo() {
    document.getElementById('inputEfectivo').value = '';
    calcularCambio();
}

function calcularCambio() {
    var total = calcularTotalFinal();
    var efectivo = parseFloat(document.getElementById('inputEfectivo').value) || 0;
    var cambio = Math.max(0, efectivo - total);
    document.getElementById('cobroCambio').textContent = '$' + cambio.toFixed(2);
}

function confirmarVenta() {
    var total = calcularTotalFinal();
    var efectivo = parseFloat(document.getElementById('inputEfectivo').value) || 0;
    
    if (efectivo < total && tipoVenta === 'CONTADO') {
        mostrarToast('Monto insuficiente', 'error');
        return;
    }
    
    if (tipoVenta === 'CREDITO' && clienteSeleccionado) {
        var saldoActual = parseFloat(clienteSeleccionado.saldo) || 0;
        var limiteCredito = parseFloat(clienteSeleccionado.limite_credito) || 0;
        var disponible = limiteCredito - saldoActual;
        
        if (total > disponible) {
            mostrarToast('Crédito insuficiente. Disponible: $' + disponible.toFixed(2), 'error');
            return;
        }
    }
    
    var metodoActivo = document.querySelector('.metodo-btn.active');
    var metodoPagoId = metodoActivo ? metodoActivo.getAttribute('data-metodo-id') : null;
    
    if (!metodoPagoId && metodosPago.length > 0) {
        var efectivoMetodo = metodosPago.find(function(m) {
            var nombre = (m.nombre || '').toLowerCase();
            return m.tipo === 'EFECTIVO' || nombre.indexOf('efectivo') >= 0;
        });
        metodoPagoId = efectivoMetodo ? efectivoMetodo.metodo_pago_id : metodosPago[0].metodo_pago_id;
    }
    
    if (!metodoPagoId) metodoPagoId = 'EFECTIVO';
    
    var subtotalVenta = carrito.reduce(function(s, i) { return s + i.precio * i.cantidad; }, 0);
    
    var venta = {
        empresa_id: API.usuario.empresa_id,
        sucursal_id: API.usuario.sucursal_id,
        almacen_id: API.usuario.almacen_id || null,
        usuario_id: API.usuario.id || API.usuario.usuario_id,
        cliente_id: clienteSeleccionado ? clienteSeleccionado.cliente_id : null,
        turno_id: turnoActual ? turnoActual.turno_id : null,
        tipo: 'VENTA',
        tipo_venta: tipoVenta,
        tipo_precio: tipoPrecio,
        subtotal: subtotalVenta,
        descuento: descuentoGlobal,
        total: total,
        pagado: tipoVenta === 'CREDITO' ? 0 : efectivo,
        cambio: tipoVenta === 'CREDITO' ? 0 : Math.max(0, efectivo - total),
        pagos: tipoVenta === 'CONTADO' ? [{
            metodo_pago_id: metodoPagoId,
            monto: Math.min(efectivo, total)
        }] : [],
        items: carrito.map(function(item) {
            var sub = item.precio * item.cantidad;
            var desc = sub * (item.descuento || 0) / 100;
            return {
                producto_id: item.producto_id,
                descripcion: item.nombre,
                cantidad: item.cantidad,
                unidad_id: item.unidad,
                precio_unitario: item.precio,
                descuento: item.descuento || 0,
                subtotal: sub - desc
            };
        })
    };
    
    API.request('/ventas', 'POST', venta)
        .then(function(r) {
            if (r.success) {
                if (tipoVenta === 'CREDITO' && clienteSeleccionado) {
                    clienteSeleccionado.saldo = (parseFloat(clienteSeleccionado.saldo) || 0) + total;
                }
                cerrarModal('modalCobro');
                mostrarExito(r.folio || r.venta_id, total, efectivo - total);
            } else {
                mostrarToast('Error: ' + (r.error || 'No se pudo guardar'), 'error');
            }
        })
        .catch(function(e) {
            console.error(e);
            mostrarToast('Error de conexión', 'error');
        });
}

function mostrarExito(folio, total, cambio) {
    document.getElementById('exitoFolio').textContent = '#' + folio;
    document.getElementById('exitoTotal').textContent = '$' + total.toFixed(2);
    document.getElementById('exitoCambio').textContent = '$' + Math.max(0, cambio).toFixed(2);
    document.getElementById('modalExito').classList.add('active');
}

function imprimirTicket() { 
    mostrarToast('Imprimiendo ticket...'); 
}

function nuevaVenta() {
    limpiarVentaActual();
    cerrarModal('modalExito');
    focusBuscar();
}

// ==================== UTILS ====================
function cerrarModal(id) { 
    document.getElementById(id).classList.remove('active'); 
}

function cerrarTodosModales() { 
    document.querySelectorAll('.modal-overlay.active').forEach(function(m) { 
        m.classList.remove('active'); 
    }); 
}

function mostrarToast(msg, tipo) {
    var toast = document.getElementById('toast');
    toast.innerHTML = '<i class="fas fa-' + (tipo === 'error' ? 'exclamation-circle' : 'check-circle') + '"></i> ' + msg;
    toast.className = 'toast show ' + (tipo || 'success');
    setTimeout(function() { toast.classList.remove('show'); }, 3000);
}
