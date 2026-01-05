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
function setElementText(id, text, isHtml) {
    var el = document.getElementById(id);
    if (el) {
        if (isHtml) {
            el.innerHTML = text;
        } else {
            el.textContent = text;
        }
    }
}
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
    if (cartEmpty) {
        if (!habilitar) {
            cartEmpty.innerHTML = '<i class="fas fa-lock"></i><h3>Turno Cerrado</h3><p>Abre un turno para comenzar a vender</p>';
        } else {
            cartEmpty.innerHTML = '<i class="fas fa-shopping-cart"></i><h3>Carrito vacío</h3><p>Escanea un producto o presiona F2 para buscar</p>';
        }
    }
}

function abrirModalAbrirTurno() {
    var saldoInput = document.getElementById('saldoInicial');
    if (saldoInput) saldoInput.value = '';
    var modal = document.getElementById('modalAbrirTurno');
    if (modal) modal.classList.add('active');
    setTimeout(function() { if (saldoInput) saldoInput.focus(); }, 100);
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
// ==================== CORTE DE CAJA ====================
function abrirModalCerrarTurno() {
    if (!turnoActual) return;
    
    limpiarContador();
    
    API.request('/turnos/resumen/' + turnoActual.turno_id)
        .then(function(r) {
            if (r.success) {
                corteData = r;
                renderFormularioCorte(r);
                var modal = document.getElementById('modalCerrarTurno');
                if (modal) modal.classList.add('active');
            } else {
                mostrarToast('Error cargando datos del turno', 'error');
            }
        })
        .catch(function(e) {
            console.error('Error:', e);
            mostrarToast('Error de conexión', 'error');
        });
}

function renderFormularioCorte(data) {
    var movimientos = data.movimientos || { ingresos: 0, egresos: 0 };
    var ingresos = parseFloat(movimientos.ingresos) || 0;
    var egresos = parseFloat(movimientos.egresos) || 0;
    
    // Mostrar movimientos
    setElementText('corteIngresosDisplay', '$' + ingresos.toFixed(2));
    setElementText('corteEgresosDisplay', '$' + egresos.toFixed(2));
    
    // Renderizar métodos de pago para declarar
    var metodosHtml = '';
    var pagosPorMetodo = data.pagos_por_metodo || [];
    
    // Siempre incluir efectivo primero (ya se cuenta con billetes)
    // Los demás métodos se declaran manualmente
    
    pagosPorMetodo.forEach(function(p) {
        var tipo = (p.tipo || 'EFECTIVO').toUpperCase();
        
        // El efectivo se cuenta con billetes, no se declara aquí
        if (tipo === 'EFECTIVO') return;
        
        var iconClass = 'otro';
        var iconName = 'fa-money-bill';
        
        if (tipo === 'TARJETA') {
            iconClass = 'tarjeta';
            iconName = 'fa-credit-card';
        } else if (tipo === 'TRANSFERENCIA') {
            iconClass = 'transferencia';
            iconName = 'fa-exchange-alt';
        }
        
        var metodoPagoId = p.metodo_pago_id.replace(/-/g, '_');
        
        metodosHtml += '<div class="metodo-declarar-row">' +
            '<div class="metodo-icon ' + iconClass + '"><i class="fas ' + iconName + '"></i></div>' +
            '<div class="metodo-info">' +
                '<div class="metodo-nombre">' + (p.nombre || 'Sin nombre') + '</div>' +
                '<div class="metodo-hint">' + (p.cantidad || 0) + ' transacciones registradas</div>' +
            '</div>' +
            '<div class="metodo-input">' +
                '<span>$</span>' +
                '<input type="number" step="0.01" min="0" id="declarar_' + metodoPagoId + '" ' +
                    'data-metodo-id="' + p.metodo_pago_id + '" ' +
                    'data-tipo="' + tipo + '" ' +
                    'placeholder="0.00" value="">' +
            '</div>' +
        '</div>';
    });
    
    if (!metodosHtml) {
        metodosHtml = '<p style="text-align:center;color:#9ca3af;padding:20px">Solo hay pagos en efectivo</p>';
    }
    
    setElementText('metodosDeclarar', metodosHtml, true);
}

// ==================== CONTADOR DE BILLETES Y MONEDAS ====================
function ajustarContador(valor, delta) {
    var inputId = 'cont_' + String(valor).replace('.', '');
    var input = document.getElementById(inputId);
    if (!input) return;
    var actual = parseInt(input.value) || 0;
    input.value = Math.max(0, actual + delta);
    calcularTotalContado();
}

function calcularTotalContado() {
    var total = 0;
    
    denominaciones.forEach(function(d) {
        var inputId = 'cont_' + String(d).replace('.', '');
        var subId = 'sub_' + String(d).replace('.', '');
        var input = document.getElementById(inputId);
        var subEl = document.getElementById(subId);
        
        if (input) {
            var cantidad = parseInt(input.value) || 0;
            var subtotal = cantidad * d;
            total += subtotal;
            if (subEl) subEl.textContent = '$' + subtotal.toFixed(0);
        }
    });
    
    setElementText('totalContado', '$' + total.toFixed(2));
}

function limpiarContador() {
    denominaciones.forEach(function(d) {
        var inputId = 'cont_' + String(d).replace('.', '');
        var input = document.getElementById(inputId);
        if (input) input.value = 0;
        
        var subId = 'sub_' + String(d).replace('.', '');
        var subEl = document.getElementById(subId);
        if (subEl) subEl.textContent = '$0';
    });
    setElementText('totalContado', '$0.00');
}

// ==================== CONFIRMAR CIERRE ====================
function confirmarCerrarTurno() {
    if (!turnoActual || !corteData) return;
    
    // Calcular efectivo contado
    var efectivoContado = 0;
    denominaciones.forEach(function(d) {
        var inputId = 'cont_' + String(d).replace('.', '');
        var input = document.getElementById(inputId);
        if (input) {
            var cantidad = parseInt(input.value) || 0;
            efectivoContado += cantidad * d;
        }
    });
    
    // Recopilar declaraciones por método
    var declaraciones = [];
    var totalDeclaradoOtros = 0;
    
    document.querySelectorAll('[id^="declarar_"]').forEach(function(input) {
        var metodoId = input.getAttribute('data-metodo-id');
        var tipo = input.getAttribute('data-tipo');
        var monto = parseFloat(input.value) || 0;
        
        declaraciones.push({
            metodo_pago_id: metodoId,
            tipo: tipo,
            declarado: monto
        });
        
        totalDeclaradoOtros += monto;
    });
    
    var obsInput = document.getElementById('observacionesCierre');
    var observaciones = obsInput ? obsInput.value : '';
    
    // Confirmar cierre
    if (!confirm('¿Confirmar cierre de turno?')) return;
    
    API.request('/turnos/cerrar/' + turnoActual.turno_id, 'POST', {
        efectivo_declarado: efectivoContado,
        declaraciones_metodos: JSON.stringify(declaraciones),
        observaciones: observaciones,
        cerrado_por: API.usuario.id
    }).then(function(r) {
        if (r.success) {
            cerrarModal('modalCerrarTurno');
            mostrarCorteResumen(r.corte, efectivoContado, declaraciones);
        } else {
            mostrarToast(r.error || 'Error al cerrar turno', 'error');
        }
    }).catch(function(e) {
        mostrarToast('Error de conexión', 'error');
    });
}

function mostrarCorteResumen(corte, efectivoDeclarado, declaraciones) {
    var diferencia = corte.diferencia || 0;
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
    
    var difMonto = Math.abs(diferencia) < 0.01 ? '$0.00' : (diferencia > 0 ? '+' : '-') + '$' + Math.abs(diferencia).toFixed(2);
    
    // Construir HTML del resumen comparativo
    var html = '<div class="corte-resumen-container">' +
        '<div class="corte-resumen-header-resultado ' + headerClass + '">' +
            '<div class="icono"><i class="fas ' + icono + '"></i></div>' +
            '<h3>' + titulo + '</h3>' +
            '<div class="diferencia-monto">' + difMonto + '</div>' +
        '</div>' +
        
        '<div class="corte-comparativo">' +
            '<div class="corte-comparativo-titulo">Comparativo Esperado vs Declarado</div>' +
            '<div class="corte-comparativo-grid">' +
                
                // Columna izquierda: Sistema (esperado)
                '<div class="corte-columna">' +
                    '<h5><i class="fas fa-laptop"></i> Sistema (Esperado)</h5>' +
                    '<div class="corte-linea"><span>Saldo Inicial:</span><span class="esperado">$' + (corte.saldo_inicial || 0).toFixed(2) + '</span></div>' +
                    '<div class="corte-linea"><span>Ventas Efectivo:</span><span class="esperado">$' + (corte.ventas_efectivo || 0).toFixed(2) + '</span></div>' +
                    '<div class="corte-linea"><span>Ventas Tarjeta:</span><span class="esperado">$' + (corte.ventas_tarjeta || 0).toFixed(2) + '</span></div>' +
                    '<div class="corte-linea"><span>Ventas Transferencia:</span><span class="esperado">$' + (corte.ventas_transferencia || 0).toFixed(2) + '</span></div>' +
                    '<div class="corte-linea"><span>Ventas Crédito:</span><span class="esperado">$' + (corte.ventas_credito || 0).toFixed(2) + '</span></div>' +
                    '<div class="corte-linea"><span style="color:#10b981">+ Ingresos:</span><span class="esperado" style="color:#10b981">$' + (corte.ingresos || 0).toFixed(2) + '</span></div>' +
                    '<div class="corte-linea"><span style="color:#ef4444">- Egresos:</span><span class="esperado" style="color:#ef4444">$' + (corte.egresos || 0).toFixed(2) + '</span></div>' +
                    '<div class="corte-linea total"><span>Efectivo Esperado:</span><span class="esperado">$' + (corte.efectivo_esperado || 0).toFixed(2) + '</span></div>' +
                '</div>' +
                
                // Columna derecha: Declarado
                '<div class="corte-columna">' +
                    '<h5><i class="fas fa-user"></i> Declarado (Contado)</h5>' +
                    '<div class="corte-linea"><span>Efectivo Contado:</span><span class="declarado">$' + efectivoDeclarado.toFixed(2) + '</span></div>';
    
    // Agregar declaraciones de otros métodos
    declaraciones.forEach(function(d) {
        var esperado = 0;
        if (corteData && corteData.pagos_por_metodo) {
            var metodo = corteData.pagos_por_metodo.find(function(m) { return m.metodo_pago_id === d.metodo_pago_id; });
            if (metodo) esperado = parseFloat(metodo.total) || 0;
        }
        
        var dif = d.declarado - esperado;
        var difClass = Math.abs(dif) < 0.01 ? 'diferencia-cero' : (dif > 0 ? 'diferencia-positiva' : 'diferencia-negativa');
        var difText = Math.abs(dif) < 0.01 ? '✓' : (dif > 0 ? '+' : '') + '$' + dif.toFixed(2);
        
        html += '<div class="corte-linea"><span>' + d.tipo + ':</span><span class="declarado">$' + d.declarado.toFixed(2) + ' <small class="' + difClass + '">(' + difText + ')</small></span></div>';
    });
    
    // Diferencia final
    var difClass = Math.abs(diferencia) < 0.01 ? 'diferencia-cero' : (diferencia > 0 ? 'diferencia-positiva' : 'diferencia-negativa');
    
    html += '<div class="corte-linea total"><span>Diferencia:</span><span class="' + difClass + '">' + difMonto + '</span></div>' +
                '</div>' +
            '</div>' +
        '</div>' +
        
        '<div class="corte-stats-footer">' +
            '<span><i class="fas fa-receipt"></i> ' + (corte.cantidad_ventas || 0) + ' ventas</span>' +
            '<span><i class="fas fa-times-circle"></i> ' + (corte.cantidad_canceladas || 0) + ' canceladas</span>' +
            '<span><i class="fas fa-clock"></i> ' + new Date().toLocaleString('es-MX') + '</span>' +
        '</div>' +
    '</div>';
    
    setElementText('corteResumenContent', html, true);
    
    // Cambiar color del header según resultado
    var headerEl = document.getElementById('corteResumenHeader');
    if (headerEl) {
        if (headerClass === 'correcto') {
            headerEl.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
        } else if (headerClass === 'sobrante') {
            headerEl.style.background = 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)';
        } else {
            headerEl.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
        }
    }
    
    var modal = document.getElementById('modalCorteResumen');
    if (modal) modal.classList.add('active');
}

function solicitarReconteo() {
    // Abrir modal de validación admin
    var claveInput = document.getElementById('claveAdmin');
    if (claveInput) claveInput.value = '';
    
    var modal = document.getElementById('modalValidarAdmin');
    if (modal) modal.classList.add('active');
    
    setTimeout(function() { if (claveInput) claveInput.focus(); }, 100);
}

function validarClaveAdmin() {
    var claveInput = document.getElementById('claveAdmin');
    var clave = claveInput ? claveInput.value : '';
    
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
            cerrarModal('modalCorteResumen');
            
            // Reabrir turno para reconteo
            API.request('/turnos/reabrir/' + turnoActual.turno_id, 'POST', {
                autorizado_por: r.admin
            }).then(function(r2) {
                if (r2.success) {
                    mostrarToast('Turno reabierto por ' + r.admin + '. Puede volver a contar.', 'success');
                    abrirModalCerrarTurno();
                } else {
                    mostrarToast('Error al reabrir turno', 'error');
                }
            });
        } else {
            mostrarToast('Clave incorrecta', 'error');
        }
    });
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
    
    var tipoInput = document.getElementById('movimientoTipo');
    var tituloEl = document.getElementById('movimientoTitulo');
    var iconoEl = document.getElementById('movimientoIcono');
    var montoInput = document.getElementById('movimientoMonto');
    var conceptoInput = document.getElementById('movimientoConcepto');
    var refInput = document.getElementById('movimientoReferencia');
    
    if (tipoInput) tipoInput.value = tipo;
    if (tituloEl) tituloEl.textContent = tipo === 'INGRESO' ? 'Ingreso de Efectivo' : 'Retiro de Efectivo';
    if (iconoEl) iconoEl.className = 'fas fa-' + (tipo === 'INGRESO' ? 'arrow-down' : 'arrow-up');
    if (montoInput) montoInput.value = '';
    if (conceptoInput) conceptoInput.value = '';
    if (refInput) refInput.value = '';
    
    var header = document.querySelector('#modalMovimiento .modal-header');
    if (header) {
        header.style.background = tipo === 'INGRESO' ? 
            'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 
            'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
    }
    
    var modal = document.getElementById('modalMovimiento');
    if (modal) modal.classList.add('active');
    setTimeout(function() { if (montoInput) montoInput.focus(); }, 100);
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
    var modal = document.getElementById('modalEspera');
    if (modal) modal.classList.add('active');
}

function renderEsperaList() {
    var cont = document.getElementById('esperaList');
    if (!cont) return;
    
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
    
    setElementText('clienteNombre', venta.clienteNombre);
    setElementText('clientePanel', venta.clienteNombre);
    
    var btnContado = document.getElementById('btnContado');
    var btnCredito = document.getElementById('btnCredito');
    if (btnContado) btnContado.classList.toggle('active', tipoVenta === 'CONTADO');
    if (btnCredito) btnCredito.classList.toggle('active', tipoVenta === 'CREDITO');
    
    setElementText('tipoVentaLabel', tipoVenta === 'CONTADO' ? 'Contado' : 'Crédito');
    
    var selectPrecio = document.getElementById('selectPrecio');
    if (selectPrecio) selectPrecio.value = tipoPrecio;
    
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
    
    setElementText('clienteNombre', 'Público General');
    setElementText('clientePanel', 'Público General');
    
    var btnContado = document.getElementById('btnContado');
    var btnCredito = document.getElementById('btnCredito');
    if (btnContado) btnContado.classList.add('active');
    if (btnCredito) btnCredito.classList.remove('active');
    
    setElementText('tipoVentaLabel', 'Contado');
    
    var selectPrecio = document.getElementById('selectPrecio');
    if (selectPrecio) selectPrecio.value = '1';
    
    var inputBuscar = document.getElementById('inputBuscar');
    if (inputBuscar) inputBuscar.value = '';
    
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
    var btnContado = document.getElementById('btnContado');
    var btnCredito = document.getElementById('btnCredito');
    if (btnContado) btnContado.classList.toggle('active', tipo === 'CONTADO');
    if (btnCredito) btnCredito.classList.toggle('active', tipo === 'CREDITO');
    setElementText('tipoVentaLabel', tipo === 'CONTADO' ? 'Contado' : 'Crédito');
    focusBuscar();
}

function cambiarTipoPrecio() {
    var selectPrecio = document.getElementById('selectPrecio');
    tipoPrecio = selectPrecio ? parseInt(selectPrecio.value) : 1;
    carrito.forEach(function(item) {
        var prod = productos.find(function(p) { return p.producto_id === item.producto_id; });
        if (prod) item.precio = getPrecioConImpuestos(prod, tipoPrecio);
    });
    renderCarrito();
    focusBuscar();
}

// ==================== MODAL PRODUCTOS ====================
function abrirModalProductos() {
    var modal = document.getElementById('modalProductos');
    if (modal) modal.classList.add('active');
    
    var filtroNombre = document.getElementById('filtroNombre');
    var filtroCantidad = document.getElementById('filtroCantidad');
    var filtroPrecio = document.getElementById('filtroPrecio');
    
    if (filtroNombre) filtroNombre.value = '';
    if (filtroCantidad) filtroCantidad.value = '1';
    if (filtroPrecio) filtroPrecio.value = tipoPrecio;
    
    filtrarProductos();
    setTimeout(function() { if (filtroNombre) filtroNombre.focus(); }, 100);
}

function filtrarProductos() {
    var filtroNombre = document.getElementById('filtroNombre');
    var filtroCategoria = document.getElementById('filtroCategoria');
    var filtroPrecio = document.getElementById('filtroPrecio');
    
    var nombre = filtroNombre ? (filtroNombre.value || '').toLowerCase() : '';
    var categoria = filtroCategoria ? filtroCategoria.value : '';
    var precioTipo = filtroPrecio ? (parseInt(filtroPrecio.value) || 1) : 1;
    
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
    if (!tbody) return;
    
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
    if (inp) inp.value = Math.max(0.001, (parseFloat(inp.value) || 1) + d);
}

function seleccionarProducto(id) {
    var prod = productos.find(function(p) { return p.producto_id === id; });
    if (!prod) return;
    
    var filtroCantidad = document.getElementById('filtroCantidad');
    var cantidad = filtroCantidad ? (parseFloat(filtroCantidad.value) || 1) : 1;
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
    
    setElementText('cantidadTitulo', 'Cantidad en ' + unidad);
    setElementText('cantidadNombre', prod.nombre);
    setElementText('cantidadPrecioUnit', '$' + precio.toFixed(2) + ' / ' + unidad);
    setElementText('cantidadUnidad', unidad);
    
    var inputCantidad = document.getElementById('inputCantidadModal');
    if (inputCantidad) inputCantidad.value = '1';
    
    calcularSubtotalModal();
    
    var modal = document.getElementById('modalCantidad');
    if (modal) modal.classList.add('active');
    setTimeout(function() { if (inputCantidad) inputCantidad.select(); }, 100);
}

function ajustarCantidadModal(d) {
    var inp = document.getElementById('inputCantidadModal');
    if (inp) {
        inp.value = Math.max(0.001, (parseFloat(inp.value) || 0) + d).toFixed(3);
        calcularSubtotalModal();
    }
}

function calcularSubtotalModal() {
    if (!productoParaCantidad) return;
    var inputCantidad = document.getElementById('inputCantidadModal');
    var cant = inputCantidad ? (parseFloat(inputCantidad.value) || 0) : 0;
    var precio = getPrecioConImpuestos(productoParaCantidad, tipoPrecio);
    setElementText('subtotalModal', '$' + (cant * precio).toFixed(2));
}

function confirmarCantidad() {
    if (!productoParaCantidad) return;
    var inputCantidad = document.getElementById('inputCantidadModal');
    var cant = inputCantidad ? (parseFloat(inputCantidad.value) || 0) : 0;
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
    var modal = document.getElementById('modalCliente');
    if (modal) modal.classList.add('active');
    
    var buscarCliente = document.getElementById('buscarCliente');
    if (buscarCliente) buscarCliente.value = '';
    
    filtrarClientes();
    setTimeout(function() { if (buscarCliente) buscarCliente.focus(); }, 100);
}

function filtrarClientes() {
    var buscarCliente = document.getElementById('buscarCliente');
    var busq = buscarCliente ? (buscarCliente.value || '').toLowerCase() : '';
    var filtrados = clientes.filter(function(c) {
        return !busq || 
            c.nombre.toLowerCase().indexOf(busq) >= 0 ||
            (c.telefono && c.telefono.indexOf(busq) >= 0);
    });
    renderClientesLista(filtrados);
}

function renderClientesLista(items) {
    var cont = document.getElementById('clientesList');
    if (!cont) return;
    
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
            setElementText('clienteNombre', clienteSeleccionado.nombre);
            setElementText('clientePanel', clienteSeleccionado.nombre);
            tipoPrecio = parseInt(clienteSeleccionado.tipo_precio) || 1;
            var selectPrecio = document.getElementById('selectPrecio');
            if (selectPrecio) selectPrecio.value = tipoPrecio;
            cambiarTipoPrecio();
        }
    } else {
        clienteSeleccionado = null;
        setElementText('clienteNombre', 'Público General');
        setElementText('clientePanel', 'Público General');
    }
    cerrarModal('modalCliente');
    focusBuscar();
}

// ==================== MODAL NUEVO PRODUCTO RAPIDO ====================
function abrirModalNuevoProducto() {
    var modal = document.getElementById('modalNuevoProducto');
    if (modal) modal.classList.add('active');
    
    var form = document.getElementById('formNuevoProducto');
    if (form) form.reset();
    
    setTimeout(function() { 
        var npCodigo = document.getElementById('np_codigo');
        if (npCodigo) npCodigo.focus(); 
    }, 100);
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
    var modal = document.getElementById('modalNuevoCliente');
    if (modal) modal.classList.add('active');
    
    var form = document.getElementById('formNuevoCliente');
    if (form) form.reset();
    
    setTimeout(function() { 
        var ncNombre = document.getElementById('nc_nombre');
        if (ncNombre) ncNombre.focus(); 
    }, 100);
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
    
    setElementText('editarLineaTitulo', 'Editar Cantidad');
    setElementText('editarLineaProducto', item.nombre);
    setElementText('editarLineaLabel', 'Nueva cantidad');
    setElementText('editarLineaPrefix', '');
    setElementText('editarLineaSuffix', item.unidad);
    
    var inputEditar = document.getElementById('inputEditarLinea');
    if (inputEditar) {
        inputEditar.value = item.cantidad;
        inputEditar.step = item.esGranel ? '0.001' : '1';
    }
    
    var shortcuts = document.getElementById('editarShortcuts');
    if (shortcuts) {
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
    }
    
    var modal = document.getElementById('modalEditarLinea');
    if (modal) modal.classList.add('active');
    setTimeout(function() { if (inputEditar) inputEditar.select(); }, 100);
}

function editarPrecioLinea(id) {
    var item = carrito.find(function(i) { return i.producto_id === id; });
    if (!item) return;
    
    editarLineaData = { id: id, tipo: 'precio' };
    
    setElementText('editarLineaTitulo', 'Editar Precio');
    setElementText('editarLineaProducto', item.nombre);
    setElementText('editarLineaLabel', 'Nuevo precio unitario');
    setElementText('editarLineaPrefix', '$');
    setElementText('editarLineaSuffix', '');
    
    var inputEditar = document.getElementById('inputEditarLinea');
    if (inputEditar) {
        inputEditar.value = item.precio.toFixed(2);
        inputEditar.step = '0.01';
    }
    
    var original = item.precioOriginal || item.precio;
    var shortcuts = document.getElementById('editarShortcuts');
    if (shortcuts) {
        shortcuts.innerHTML = 
            '<button type="button" onclick="setEditarValor(' + original.toFixed(2) + ')" class="primary">Original $' + original.toFixed(2) + '</button>' +
            '<button type="button" onclick="ajustarEditarValor(-10)">−$10</button>' +
            '<button type="button" onclick="ajustarEditarValor(-5)">−$5</button>' +
            '<button type="button" onclick="ajustarEditarValor(5)">+$5</button>' +
            '<button type="button" onclick="ajustarEditarValor(10)">+$10</button>';
    }
    
    var modal = document.getElementById('modalEditarLinea');
    if (modal) modal.classList.add('active');
    setTimeout(function() { if (inputEditar) inputEditar.select(); }, 100);
}

function editarDescuentoLinea(id) {
    var item = carrito.find(function(i) { return i.producto_id === id; });
    if (!item) return;
    
    editarLineaData = { id: id, tipo: 'descuento' };
    
    setElementText('editarLineaTitulo', 'Aplicar Descuento');
    setElementText('editarLineaProducto', item.nombre);
    setElementText('editarLineaLabel', 'Porcentaje de descuento');
    setElementText('editarLineaPrefix', '');
    setElementText('editarLineaSuffix', '%');
    
    var inputEditar = document.getElementById('inputEditarLinea');
    if (inputEditar) {
        inputEditar.value = item.descuento || 0;
        inputEditar.step = '1';
    }
    
    var shortcuts = document.getElementById('editarShortcuts');
    if (shortcuts) {
        shortcuts.innerHTML = 
            '<button type="button" onclick="setEditarValor(0)">0%</button>' +
            '<button type="button" onclick="setEditarValor(5)">5%</button>' +
            '<button type="button" onclick="setEditarValor(10)">10%</button>' +
            '<button type="button" onclick="setEditarValor(15)">15%</button>' +
            '<button type="button" onclick="setEditarValor(20)">20%</button>' +
            '<button type="button" onclick="setEditarValor(25)">25%</button>';
    }
    
    var modal = document.getElementById('modalEditarLinea');
    if (modal) modal.classList.add('active');
    setTimeout(function() { if (inputEditar) inputEditar.select(); }, 100);
}

function setEditarValor(val) {
    var inputEditar = document.getElementById('inputEditarLinea');
    if (inputEditar) inputEditar.value = val;
}

function ajustarEditarValor(delta) {
    var inp = document.getElementById('inputEditarLinea');
    if (inp) {
        var val = parseFloat(inp.value) || 0;
        inp.value = Math.max(0, val + delta);
    }
}

function onEditarLineaKeypress(e) {
    if (e.key === 'Enter') {
        confirmarEditarLinea();
    }
}

function confirmarEditarLinea() {
    var inputEditar = document.getElementById('inputEditarLinea');
    var valor = inputEditar ? parseFloat(inputEditar.value) : 0;
    
    if (editarLineaData.tipo === 'descuento_global') {
        descuentoGlobal = Math.min(100, Math.max(0, valor || 0));
        renderCarrito();
        cerrarModal('modalEditarLinea');
        mostrarToast('Descuento global: ' + descuentoGlobal + '%');
        focusBuscar();
        return;
    }
    
    var item = carrito.find(function(i) { return i.producto_id === editarLineaData.id; });
    if (!item) return;
    
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
        if (tbody) tbody.innerHTML = '';
        if (empty) empty.style.display = 'flex';
        actualizarTotales();
        return;
    }
    
    if (empty) empty.style.display = 'none';
    
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
    if (tbody) tbody.innerHTML = html;
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
    
    setElementText('totalArticulos', articulos.toFixed(2));
    setElementText('subtotalVenta', '$' + subtotal.toFixed(2));
    setElementText('descuentosVenta', '-$' + (descuentos + descGlobal).toFixed(2));
    setElementText('totalAmount', '$' + total.toFixed(2));
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
    
    setElementText('editarLineaTitulo', 'Descuento Global');
    setElementText('editarLineaProducto', 'Aplicar a toda la venta');
    setElementText('editarLineaLabel', 'Porcentaje de descuento');
    setElementText('editarLineaPrefix', '');
    setElementText('editarLineaSuffix', '%');
    
    var inputEditar = document.getElementById('inputEditarLinea');
    if (inputEditar) {
        inputEditar.value = descuentoGlobal;
        inputEditar.step = '1';
    }
    
    var shortcuts = document.getElementById('editarShortcuts');
    if (shortcuts) {
        shortcuts.innerHTML = 
            '<button type="button" onclick="setEditarValor(0)">0%</button>' +
            '<button type="button" onclick="setEditarValor(5)">5%</button>' +
            '<button type="button" onclick="setEditarValor(10)">10%</button>' +
            '<button type="button" onclick="setEditarValor(15)">15%</button>' +
            '<button type="button" onclick="setEditarValor(20)">20%</button>' +
            '<button type="button" onclick="setEditarValor(25)">25%</button>';
    }
    
    var modal = document.getElementById('modalEditarLinea');
    if (modal) modal.classList.add('active');
    setTimeout(function() { if (inputEditar) inputEditar.select(); }, 100);
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
    
    setElementText('cobroTotal', '$' + total.toFixed(2));
    setElementText('cobroBadge', tipoVenta);
    
    var cobroBadge = document.getElementById('cobroBadge');
    if (cobroBadge) cobroBadge.className = 'cobro-badge ' + tipoVenta.toLowerCase();
    
    var inputEfectivo = document.getElementById('inputEfectivo');
    if (inputEfectivo) inputEfectivo.value = '';
    
    setElementText('cobroCambio', '$0.00');
    
    var modal = document.getElementById('modalCobro');
    if (modal) modal.classList.add('active');
    
    setTimeout(function() { if (inputEfectivo) inputEfectivo.focus(); }, 100);
}

function addEfectivo(m) {
    var inp = document.getElementById('inputEfectivo');
    if (inp) {
        inp.value = (parseFloat(inp.value) || 0) + m;
        calcularCambio();
    }
}

function setExacto() {
    var inp = document.getElementById('inputEfectivo');
    if (inp) {
        inp.value = calcularTotalFinal().toFixed(2);
        calcularCambio();
    }
}

function limpiarEfectivo() {
    var inp = document.getElementById('inputEfectivo');
    if (inp) {
        inp.value = '';
        calcularCambio();
    }
}

function calcularCambio() {
    var total = calcularTotalFinal();
    var inputEfectivo = document.getElementById('inputEfectivo');
    var efectivo = inputEfectivo ? (parseFloat(inputEfectivo.value) || 0) : 0;
    var cambio = Math.max(0, efectivo - total);
    setElementText('cobroCambio', '$' + cambio.toFixed(2));
}

function confirmarVenta() {
    var total = calcularTotalFinal();
    var inputEfectivo = document.getElementById('inputEfectivo');
    var efectivo = inputEfectivo ? (parseFloat(inputEfectivo.value) || 0) : 0;
    
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
    setElementText('exitoFolio', '#' + folio);
    setElementText('exitoTotal', '$' + total.toFixed(2));
    setElementText('exitoCambio', '$' + Math.max(0, cambio).toFixed(2));
    
    var modal = document.getElementById('modalExito');
    if (modal) modal.classList.add('active');
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
    var modal = document.getElementById(id);
    if (modal) modal.classList.remove('active'); 
}

function cerrarTodosModales() { 
    document.querySelectorAll('.modal-overlay.active').forEach(function(m) { 
        m.classList.remove('active'); 
    }); 
}

function mostrarToast(msg, tipo) {
    var toast = document.getElementById('toast');
    if (toast) {
        toast.innerHTML = '<i class="fas fa-' + (tipo === 'error' ? 'exclamation-circle' : 'check-circle') + '"></i> ' + msg;
        toast.className = 'toast show ' + (tipo || 'success');
        setTimeout(function() { toast.classList.remove('show'); }, 3000);
    }
}
