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

// ==================== ELIMINAR VENTA EN ESPERA (CON AUTORIZACIÓN) ====================
function eliminarVentaEspera(index) {
    var venta = ventasEnEspera[index];
    if (!venta) return;
    
    solicitarAutorizacionAdmin('¿Autorizar eliminación de venta en espera ($' + venta.total.toFixed(2) + ')?', function(admin) {
        ventasEnEspera.splice(index, 1);
        localStorage.setItem('ventasEnEspera', JSON.stringify(ventasEnEspera));
        renderEsperaList();
        actualizarBadgeEspera();
        mostrarToast('Venta eliminada por ' + admin, 'success');
    });
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
        cont.innerHTML = '<button type="button" class="metodo-btn active" data-metodo-id="EFECTIVO"><i class="fas fa-money-bill-wave"></i><span>Efectivo</span></button>';
        return;
    }
    
    var html = '';
    metodosPago.forEach(function(m, i) {
        // Asignar icono basado en tipo o nombre
        var icono = getIconoMetodo(m);
        
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

function getIconoMetodo(metodo) {
    var tipo = (metodo.tipo || '').toUpperCase();
    var nombre = (metodo.nombre || '').toLowerCase();
    
    // Por tipo
    if (tipo === 'EFECTIVO') return 'fa-money-bill-wave';
    if (tipo === 'TARJETA' || tipo === 'TARJETA_DEBITO') return 'fa-credit-card';
    if (tipo === 'TARJETA_CREDITO') return 'fa-credit-card';
    if (tipo === 'TRANSFERENCIA') return 'fa-university';
    if (tipo === 'CHEQUE') return 'fa-money-check';
    if (tipo === 'VALES') return 'fa-ticket-alt';
    
    // Por nombre
    if (nombre.indexOf('efectivo') >= 0 || nombre.indexOf('cash') >= 0) return 'fa-money-bill-wave';
    if (nombre.indexOf('tarjeta') >= 0 || nombre.indexOf('card') >= 0) return 'fa-credit-card';
    if (nombre.indexOf('débito') >= 0 || nombre.indexOf('debito') >= 0) return 'fa-credit-card';
    if (nombre.indexOf('crédito') >= 0 || nombre.indexOf('credito') >= 0) return 'fa-credit-card';
    if (nombre.indexOf('transfer') >= 0 || nombre.indexOf('spei') >= 0) return 'fa-university';
    if (nombre.indexOf('cheque') >= 0) return 'fa-money-check';
    if (nombre.indexOf('vale') >= 0 || nombre.indexOf('voucher') >= 0) return 'fa-ticket-alt';
    if (nombre.indexOf('paypal') >= 0) return 'fa-paypal';
    if (nombre.indexOf('mercado') >= 0) return 'fa-handshake';
    
    // Default
    return 'fa-wallet';
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
    var item = carrito.find(function(i) { return i.producto_id === id; });
    if (!item) return;
    
    solicitarAutorizacionAdmin('¿Autorizar eliminación de "' + item.nombre + '"?', function(admin) {
        carrito = carrito.filter(function(i) { return i.producto_id !== id; });
        renderCarrito();
        mostrarToast('Producto eliminado por ' + admin, 'success');
        focusBuscar();
    });
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

// ==================== CANCELAR VENTA (CON AUTORIZACIÓN) ====================
function cancelarVenta() {
    if (!carrito.length) return;
    
    solicitarAutorizacionAdmin('¿Autorizar cancelación de venta completa?', function(admin) {
        limpiarVentaActual();
        mostrarToast('Venta cancelada por ' + admin, 'success');
        focusBuscar();
    });
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

// ==================== MODAL CONFIRMAR (REEMPLAZO DE confirm()) ====================
var confirmarCallback = null;

function mostrarConfirmar(mensaje, onAceptar, opciones) {
    opciones = opciones || {};
    
    var titulo = opciones.titulo || 'Confirmar';
    var textoBoton = opciones.textoBoton || 'Aceptar';
    var tipo = opciones.tipo || 'primary'; // primary, danger, warning, success
    var icono = opciones.icono || 'fa-question-circle';
    
    setElementText('confirmarMensaje', mensaje);
    document.querySelector('#confirmarTitulo span').textContent = titulo;
    document.querySelector('#confirmarTitulo i').className = 'fas ' + icono;
    setElementText('confirmarBtnTexto', textoBoton);
    
    var btnAceptar = document.getElementById('btnConfirmarAceptar');
    btnAceptar.className = 'btn btn-' + tipo;
    
    var header = document.getElementById('confirmarHeader');
    if (tipo === 'danger') {
        header.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
        header.style.color = 'white';
    } else if (tipo === 'warning') {
        header.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
        header.style.color = 'white';
    } else if (tipo === 'success') {
        header.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
        header.style.color = 'white';
    } else {
        header.style.background = 'var(--gradient)';
        header.style.color = 'white';
    }
    
    confirmarCallback = onAceptar;
    
    btnAceptar.onclick = function() {
        cerrarConfirmar(true);
    };
    
    var modal = document.getElementById('modalConfirmar');
    if (modal) modal.classList.add('active');
}

function cerrarConfirmar(aceptado) {
    cerrarModal('modalConfirmar');
    if (aceptado && confirmarCallback) {
        confirmarCallback();
    }
    confirmarCallback = null;
}
// ==================== AUTORIZACIÓN ADMIN ====================
var accionPendienteAdmin = null;

function solicitarAutorizacionAdmin(mensaje, onAutorizado, opciones) {
    opciones = opciones || {};
    
    accionPendienteAdmin = onAutorizado;
    
    // Mostrar mensaje personalizado
    var msgEl = document.getElementById('adminAuthMensaje');
    if (msgEl) msgEl.textContent = mensaje || 'Se requiere autorización de administrador';
    
    // Limpiar input
    var claveInput = document.getElementById('claveAdminAuth');
    if (claveInput) claveInput.value = '';
    
    // Mostrar modal
    var modal = document.getElementById('modalAutorizarAdmin');
    if (modal) modal.classList.add('active');
    
    setTimeout(function() { 
        if (claveInput) claveInput.focus(); 
    }, 100);
}

function confirmarAutorizacionAdmin() {
    var claveInput = document.getElementById('claveAdminAuth');
    var clave = claveInput ? claveInput.value : '';
    
    if (!clave) {
        mostrarToast('Ingresa la clave de administrador', 'error');
        return;
    }
    
    // Validar con el servidor
    API.request('/auth/validar-admin', 'POST', {
        empresa_id: API.usuario.empresa_id,
        password: clave
    }).then(function(r) {
        if (r.success) {
            cerrarModal('modalAutorizarAdmin');
            mostrarToast('Autorizado por: ' + r.admin, 'success');
            
            // Ejecutar la acción pendiente
            if (accionPendienteAdmin) {
                accionPendienteAdmin(r.admin);
                accionPendienteAdmin = null;
            }
        } else {
            mostrarToast('Clave incorrecta', 'error');
            if (claveInput) {
                claveInput.value = '';
                claveInput.focus();
            }
        }
    }).catch(function(e) {
        mostrarToast('Error de conexión', 'error');
    });
}

function cancelarAutorizacionAdmin() {
    cerrarModal('modalAutorizarAdmin');
    accionPendienteAdmin = null;
}
// ==================== MIS VENTAS DEL TURNO ====================
// Agregar estas funciones a pos.js

var ventasTurno = [];
var ventaSeleccionada = null;
var productosVentaSeleccionada = [];
var pagosVentaSeleccionada = [];
var historialVentaSeleccionada = [];

// ==================== CARGAR VENTAS DEL TURNO ====================
function abrirModalVentasTurno() {
    if (!turnoActual) {
        mostrarToast('No hay turno abierto', 'error');
        return;
    }
    
    var modal = document.getElementById('modalVentasTurno');
    if (modal) modal.classList.add('active');
    
    cargarVentasTurno();
}

function cargarVentasTurno() {
    API.request('/ventas/turno/' + turnoActual.turno_id)
        .then(function(r) {
            if (r.success) {
                ventasTurno = r.ventas || [];
                calcularStatsTurno();
                filtrarVentasTurno();
            } else {
                mostrarToast('Error cargando ventas', 'error');
            }
        })
        .catch(function(e) {
            console.error(e);
            mostrarToast('Error de conexión', 'error');
        });
}

function calcularStatsTurno() {
    var activas = ventasTurno.filter(function(v) { return v.estatus !== 'CANCELADA'; });
    var canceladas = ventasTurno.filter(function(v) { return v.estatus === 'CANCELADA'; });
    var total = activas.reduce(function(sum, v) { return sum + parseFloat(v.total || 0); }, 0);
    
    setElementText('statVentasTurno', activas.length);
    setElementText('statMontoTurno', '$' + total.toFixed(2));
    setElementText('statCanceladasTurno', canceladas.length);
}

function filtrarVentasTurno() {
    var busqueda = (document.getElementById('filtroVentasTurno').value || '').toLowerCase();
    var estado = document.getElementById('filtroEstadoVenta').value;
    var tipo = document.getElementById('filtroTipoVentaTurno').value;
    
    var filtradas = ventasTurno.filter(function(v) {
        var matchBusq = !busqueda || 
            (v.folio && v.folio.toString().indexOf(busqueda) >= 0) ||
            (v.cliente_nombre && v.cliente_nombre.toLowerCase().indexOf(busqueda) >= 0);
        var matchEstado = !estado || v.estatus === estado;
        var matchTipo = !tipo || v.tipo_venta === tipo;
        return matchBusq && matchEstado && matchTipo;
    });
    
    renderVentasTurno(filtradas);
}

function renderVentasTurno(ventas) {
    var tbody = document.getElementById('ventasTurnoBody');
    if (!tbody) return;
    
    if (!ventas.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="ventas-empty">' +
            '<i class="fas fa-receipt"></i>' +
            '<h4>No hay ventas</h4>' +
            '<p>Las ventas de este turno aparecerán aquí</p>' +
        '</td></tr>';
        return;
    }
    
    var html = '';
    ventas.forEach(function(v) {
        var fecha = v.fecha_hora ? new Date(v.fecha_hora.replace(' ', 'T')) : new Date();
        var hora = fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
        var esCancelada = v.estatus === 'CANCELADA';
        var folioStr = v.serie ? v.serie + '-' + v.folio : (v.folio || v.venta_id.slice(-8));
        
        var estadoClass = (v.estatus || 'PAGADA').toLowerCase();
        var tipoClass = (v.tipo_venta || 'CONTADO').toLowerCase();
        
        html += '<tr class="' + (esCancelada ? 'cancelada' : '') + '" onclick="verDetalleVenta(\'' + v.venta_id + '\')">' +
            '<td><span class="folio">' + folioStr + '</span></td>' +
            '<td class="hora">' + hora + '</td>' +
            '<td>' + (v.cliente_nombre || 'Público General') + '</td>' +
            '<td class="text-center">' + (v.num_productos || '-') + '</td>' +
            '<td class="text-center"><span class="badge-estado ' + tipoClass + '">' + (v.tipo_venta || 'CONTADO') + '</span></td>' +
            '<td class="text-center"><span class="badge-estado ' + estadoClass + '">' + (v.estatus || 'PAGADA') + '</span></td>' +
            '<td class="total">$' + parseFloat(v.total || 0).toFixed(2) + '</td>' +
            '<td>' +
                '<div class="acciones-venta">' +
                    '<button class="btn-ver" onclick="event.stopPropagation();verDetalleVenta(\'' + v.venta_id + '\')" title="Ver detalle">' +
                        '<i class="fas fa-eye"></i>' +
                    '</button>' +
                    '<button class="btn-print" onclick="event.stopPropagation();imprimirVentaDirecto(\'' + v.venta_id + '\')" title="Imprimir">' +
                        '<i class="fas fa-print"></i>' +
                    '</button>' +
                '</div>' +
            '</td>' +
        '</tr>';
    });
    tbody.innerHTML = html;
}

// ==================== VER DETALLE DE VENTA ====================
function verDetalleVenta(ventaId) {
    API.request('/ventas/detalle-completo/' + ventaId)
        .then(function(r) {
            if (r.success) {
                ventaSeleccionada = r.venta;
                productosVentaSeleccionada = r.productos || [];
                pagosVentaSeleccionada = r.pagos || [];
                historialVentaSeleccionada = r.historial || [];
                
                mostrarDetalleVenta();
            } else {
                mostrarToast('Error cargando detalle', 'error');
            }
        })
        .catch(function(e) {
            console.error(e);
            mostrarToast('Error de conexión', 'error');
        });
}

function mostrarDetalleVenta() {
    var v = ventaSeleccionada;
    if (!v) return;
    
    var fecha = v.fecha_hora ? new Date(v.fecha_hora.replace(' ', 'T')) : new Date();
    var fechaStr = fecha.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    var horaStr = fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    var folioStr = v.serie ? v.serie + '-' + v.folio : (v.folio || v.venta_id.slice(-8));
    var esCancelada = v.estatus === 'CANCELADA';
    
    // Header
    setElementText('detalleVentaFolio', '#' + folioStr);
    setElementText('detalleVentaFecha', fechaStr + ' - ' + horaStr);
    
    var badgeEstado = document.getElementById('detalleVentaEstado');
    if (badgeEstado) {
        badgeEstado.textContent = v.estatus || 'PAGADA';
        badgeEstado.className = 'badge-estado-lg ' + (v.estatus || 'PAGADA').toLowerCase();
    }
    
    // Info grid
    setElementText('detalleVentaCliente', v.cliente_nombre || 'Público General');
    setElementText('detalleVentaVendedor', v.usuario_nombre || 'Usuario');
    setElementText('detalleVentaTipo', v.tipo_venta || 'Contado');
    
    // Método de pago principal
    var metodoPrincipal = 'Efectivo';
    if (pagosVentaSeleccionada.length > 0) {
        metodoPrincipal = pagosVentaSeleccionada[0].metodo_nombre || 'Efectivo';
    }
    setElementText('detalleVentaMetodo', metodoPrincipal);
    
    // Productos
    var productosHtml = '';
    productosVentaSeleccionada.forEach(function(p) {
        var subtotal = parseFloat(p.cantidad) * parseFloat(p.precio_unitario);
        var descMonto = subtotal * (parseFloat(p.descuento_pct) || 0) / 100;
        var total = subtotal - descMonto;
        var cancelado = p.estatus === 'CANCELADO';
        
        productosHtml += '<tr class="' + (cancelado ? 'cancelado' : '') + '">' +
            '<td class="producto-nombre">' + (p.producto_nombre || p.descripcion) + 
                (cancelado ? ' <small style="color:#dc2626">(Cancelado)</small>' : '') + '</td>' +
            '<td class="text-center">' + parseFloat(p.cantidad).toFixed(p.unidad === 'KG' ? 3 : 0) + ' ' + (p.unidad || p.unidad_id || 'PZ') + '</td>' +
            '<td class="text-right">$' + parseFloat(p.precio_unitario).toFixed(2) + '</td>' +
            '<td class="text-right">$' + total.toFixed(2) + '</td>' +
            '<td class="producto-estado">' +
                (cancelado ? '<span class="badge-estado cancelada">Cancelado</span>' :
                    (!esCancelada ? '<button class="btn-cancelar-prod" onclick="abrirModalCancelarProducto(\'' + p.detalle_id + '\')" title="Cancelar producto"><i class="fas fa-minus"></i></button>' : '')) +
            '</td>' +
        '</tr>';
    });
    document.getElementById('detalleVentaProductos').innerHTML = productosHtml;
    
    // Pagos
    var pagosHtml = '';
    pagosVentaSeleccionada.forEach(function(p) {
        var tipo = (p.tipo || 'EFECTIVO').toLowerCase();
        var icono = tipo === 'efectivo' ? 'fa-money-bill-wave' : (tipo === 'tarjeta' ? 'fa-credit-card' : 'fa-exchange-alt');
        var cancelado = p.estatus === 'CANCELADO';
        
        pagosHtml += '<div class="pago-item-detalle ' + (cancelado ? 'cancelado' : '') + '">' +
            '<div class="pago-metodo">' +
                '<i class="fas ' + icono + ' ' + tipo + '"></i>' +
                '<span>' + (p.metodo_nombre || 'Efectivo') + (cancelado ? ' (Cancelado)' : '') + '</span>' +
            '</div>' +
            '<div class="pago-monto">$' + parseFloat(p.monto).toFixed(2) + '</div>' +
        '</div>';
    });
    document.getElementById('detalleVentaPagos').innerHTML = pagosHtml || '<p style="color:#9ca3af;text-align:center">Sin pagos registrados</p>';
    
    // Historial
    var historialContainer = document.getElementById('detalleHistorialContainer');
    if (historialVentaSeleccionada.length > 0) {
        historialContainer.style.display = 'block';
        var historialHtml = '';
        historialVentaSeleccionada.forEach(function(h) {
            var tipo = (h.tipo_accion || 'modificacion').toLowerCase();
            var icono = 'fa-edit';
            if (tipo === 'creacion') icono = 'fa-plus-circle';
            if (tipo === 'cancelacion') icono = 'fa-times-circle';
            if (tipo === 'pago' || tipo === 'cambio_pago') icono = 'fa-credit-card';
            if (tipo === 'reapertura') icono = 'fa-folder-open';
            
            var fecha = h.fecha ? new Date(h.fecha.replace(' ', 'T')) : new Date();
            var fechaStr = fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
            
            historialHtml += '<div class="historial-item ' + tipo + '">' +
                '<div class="historial-icono"><i class="fas ' + icono + '"></i></div>' +
                '<div class="historial-contenido">' +
                    '<div class="historial-texto">' + (h.descripcion || 'Modificación') + '</div>' +
                    '<div class="historial-meta">' + (h.usuario_nombre || 'Usuario') + ' • ' + fechaStr + '</div>' +
                '</div>' +
            '</div>';
        });
        document.getElementById('detalleVentaHistorial').innerHTML = historialHtml;
    } else {
        historialContainer.style.display = 'none';
    }
    
    // Totales
    var subtotal = parseFloat(v.subtotal) || parseFloat(v.total) || 0;
    var descuento = parseFloat(v.descuento) || 0;
    var total = parseFloat(v.total) || 0;
    var pagado = parseFloat(v.pagado) || 0;
    var pendiente = total - pagado;
    
    setElementText('detalleVentaSubtotal', '$' + subtotal.toFixed(2));
    
    var rowDescuentos = document.getElementById('rowDescuentos');
    if (descuento > 0) {
        rowDescuentos.style.display = 'flex';
        setElementText('detalleVentaDescuentos', '-$' + descuento.toFixed(2));
    } else {
        rowDescuentos.style.display = 'none';
    }
    
    setElementText('detalleVentaTotal', '$' + total.toFixed(2));
    setElementText('detalleVentaPagado', '$' + pagado.toFixed(2));
    
    var rowPendiente = document.getElementById('rowPendiente');
    if (pendiente > 0.01) {
        rowPendiente.style.display = 'flex';
        setElementText('detalleVentaPendiente', '$' + pendiente.toFixed(2));
    } else {
        rowPendiente.style.display = 'none';
    }
    
    // Mostrar/ocultar acciones según estado
    var accionesActiva = document.getElementById('accionesVentaActiva');
    if (accionesActiva) {
        accionesActiva.style.display = esCancelada ? 'none' : 'flex';
    }
    
    var modal = document.getElementById('modalDetalleVenta');
    if (modal) modal.classList.add('active');
}

// ==================== CANCELAR VENTA COMPLETA ====================
function abrirModalCancelarVenta() {
    if (!ventaSeleccionada) return;
    
    var v = ventaSeleccionada;
    var folioStr = v.serie ? v.serie + '-' + v.folio : (v.folio || v.venta_id.slice(-8));
    var pagado = parseFloat(v.pagado) || 0;
    
    setElementText('cancelarVentaFolio', '#' + folioStr);
    setElementText('cancelarVentaTotal', '$' + parseFloat(v.total).toFixed(2));
    setElementText('cancelarVentaDevolucion', pagado > 0 ? '$' + pagado.toFixed(2) : '$0.00');
    
    document.getElementById('motivoCancelarVenta').value = '';
    document.getElementById('otroMotivoCancelar').value = '';
    document.getElementById('otroMotivoCancelarGrupo').style.display = 'none';
    
    var modal = document.getElementById('modalCancelarVenta');
    if (modal) modal.classList.add('active');
}

function toggleOtroMotivoCancelar() {
    var select = document.getElementById('motivoCancelarVenta');
    var grupo = document.getElementById('otroMotivoCancelarGrupo');
    grupo.style.display = select.value === 'OTRO' ? 'block' : 'none';
}

function confirmarCancelarVenta() {
    var motivoSelect = document.getElementById('motivoCancelarVenta').value;
    var motivoOtro = document.getElementById('otroMotivoCancelar').value;
    
    if (!motivoSelect) {
        mostrarToast('Selecciona un motivo de cancelación', 'error');
        return;
    }
    
    if (motivoSelect === 'OTRO' && !motivoOtro.trim()) {
        mostrarToast('Especifica el motivo de cancelación', 'error');
        return;
    }
    
    var motivo = motivoSelect === 'OTRO' ? motivoOtro : motivoSelect;
    
    solicitarAutorizacionAdmin('¿Autorizar cancelación de venta #' + ventaSeleccionada.folio + '?', function(admin) {
        API.request('/ventas/cancelar-completa/' + ventaSeleccionada.venta_id, 'POST', {
            motivo_cancelacion: motivo,
            cancelado_por: API.usuario.id,
            autorizado_por: admin
        }).then(function(r) {
            if (r.success) {
                cerrarModal('modalCancelarVenta');
                cerrarModal('modalDetalleVenta');
                mostrarToast('Venta cancelada correctamente', 'success');
                cargarVentasTurno();
            } else {
                mostrarToast(r.error || 'Error al cancelar', 'error');
            }
        }).catch(function(e) {
            mostrarToast('Error de conexión', 'error');
        });
    });
}

// ==================== CANCELAR PRODUCTO INDIVIDUAL ====================
function abrirModalCancelarProducto(detalleId) {
    var prod = productosVentaSeleccionada.find(function(p) { return p.detalle_id === detalleId; });
    if (!prod || prod.estatus === 'CANCELADO') return;
    
    setElementText('cancelarProdNombre', prod.producto_nombre || prod.descripcion);
    setElementText('cancelarProdDetalle', 'Cantidad: ' + parseFloat(prod.cantidad) + ' | Precio: $' + parseFloat(prod.precio_unitario).toFixed(2));
    setElementText('unidadCancelarProd', prod.unidad || prod.unidad_id || 'PZ');
    
    document.getElementById('cancelarProductoDetalleId').value = detalleId;
    document.getElementById('cancelarProductoPrecio').value = prod.precio_unitario;
    document.getElementById('cancelarProductoCantMax').value = prod.cantidad;
    document.getElementById('cantidadCancelarProd').value = parseFloat(prod.cantidad);
    document.getElementById('motivoCancelarProducto').value = '';
    
    calcularDevolucionProducto();
    
    var modal = document.getElementById('modalCancelarProducto');
    if (modal) modal.classList.add('active');
}

function ajustarCantidadCancelar(delta) {
    var input = document.getElementById('cantidadCancelarProd');
    var max = parseFloat(document.getElementById('cancelarProductoCantMax').value) || 1;
    var nuevo = Math.max(0.001, Math.min(max, (parseFloat(input.value) || 0) + delta));
    input.value = nuevo;
    calcularDevolucionProducto();
}

function calcularDevolucionProducto() {
    var cantidad = parseFloat(document.getElementById('cantidadCancelarProd').value) || 0;
    var precio = parseFloat(document.getElementById('cancelarProductoPrecio').value) || 0;
    var devolucion = cantidad * precio;
    setElementText('devolucionProducto', '$' + devolucion.toFixed(2));
}

function confirmarCancelarProducto() {
    var detalleId = document.getElementById('cancelarProductoDetalleId').value;
    var cantidad = parseFloat(document.getElementById('cantidadCancelarProd').value) || 0;
    var motivo = document.getElementById('motivoCancelarProducto').value;
    
    if (!motivo) {
        mostrarToast('Selecciona un motivo', 'error');
        return;
    }
    
    solicitarAutorizacionAdmin('¿Autorizar cancelación de producto?', function(admin) {
        API.request('/ventas/cancelar-producto/' + detalleId, 'POST', {
            venta_id: ventaSeleccionada.venta_id,
            cantidad_cancelar: cantidad,
            motivo: motivo,
            cancelado_por: API.usuario.id,
            autorizado_por: admin
        }).then(function(r) {
            if (r.success) {
                cerrarModal('modalCancelarProducto');
                mostrarToast('Producto cancelado. Devolución: $' + r.devolucion.toFixed(2), 'success');
                verDetalleVenta(ventaSeleccionada.venta_id);
                cargarVentasTurno();
            } else {
                mostrarToast(r.error || 'Error al cancelar producto', 'error');
            }
        }).catch(function(e) {
            mostrarToast('Error de conexión', 'error');
        });
    });
}

// ==================== CAMBIAR MÉTODO DE PAGO ====================
function abrirModalCambiarPago() {
    if (!ventaSeleccionada || !pagosVentaSeleccionada.length) {
        mostrarToast('No hay pagos para modificar', 'error');
        return;
    }
    
    var pagoActual = pagosVentaSeleccionada.find(function(p) { return p.estatus !== 'CANCELADO'; });
    if (!pagoActual) {
        mostrarToast('No hay pagos activos', 'error');
        return;
    }
    
    var tipo = (pagoActual.tipo || 'EFECTIVO').toLowerCase();
    var icono = tipo === 'efectivo' ? 'fa-money-bill-wave' : (tipo === 'tarjeta' ? 'fa-credit-card' : 'fa-exchange-alt');
    
    document.getElementById('pagoActualIcono').className = 'fas ' + icono;
    setElementText('pagoActualMetodo', pagoActual.metodo_nombre || 'Efectivo');
    setElementText('pagoActualMonto', '$' + parseFloat(pagoActual.monto).toFixed(2));
    document.getElementById('cambiarPagoId').value = pagoActual.pago_id;
    document.getElementById('referenciaCambio').value = '';
    document.getElementById('motivoCambioPago').value = '';
    
    // Renderizar métodos disponibles
    var metodosHtml = '';
    metodosPago.forEach(function(m) {
        var mTipo = (m.tipo || 'EFECTIVO').toLowerCase();
        var mIcono = 'fa-wallet';
        if (mTipo === 'efectivo') mIcono = 'fa-money-bill-wave';
        else if (mTipo === 'tarjeta' || mTipo.indexOf('tarjeta') >= 0) mIcono = 'fa-credit-card';
        else if (mTipo === 'transferencia') mIcono = 'fa-university';
        
        metodosHtml += '<button type="button" class="metodo-opcion" data-metodo-id="' + m.metodo_pago_id + '" onclick="seleccionarMetodoCambio(this)">' +
            '<i class="fas ' + mIcono + '"></i>' +
            '<span>' + m.nombre + '</span>' +
        '</button>';
    });
    document.getElementById('metodosCambioContainer').innerHTML = metodosHtml;
    
    var modal = document.getElementById('modalCambiarPago');
    if (modal) modal.classList.add('active');
}

function seleccionarMetodoCambio(btn) {
    document.querySelectorAll('#metodosCambioContainer .metodo-opcion').forEach(function(b) {
        b.classList.remove('active');
    });
    btn.classList.add('active');
}

function confirmarCambiarPago() {
    var pagoId = document.getElementById('cambiarPagoId').value;
    var metodoActivo = document.querySelector('#metodosCambioContainer .metodo-opcion.active');
    var referencia = document.getElementById('referenciaCambio').value;
    var motivo = document.getElementById('motivoCambioPago').value;
    
    if (!metodoActivo) {
        mostrarToast('Selecciona el nuevo método de pago', 'error');
        return;
    }
    
    if (!motivo.trim()) {
        mostrarToast('Ingresa el motivo del cambio', 'error');
        return;
    }
    
    var nuevoMetodoId = metodoActivo.getAttribute('data-metodo-id');
    
    solicitarAutorizacionAdmin('¿Autorizar cambio de método de pago?', function(admin) {
        API.request('/ventas/cambiar-pago/' + pagoId, 'POST', {
            venta_id: ventaSeleccionada.venta_id,
            nuevo_metodo_id: nuevoMetodoId,
            referencia: referencia,
            motivo: motivo,
            modificado_por: API.usuario.id,
            autorizado_por: admin
        }).then(function(r) {
            if (r.success) {
                cerrarModal('modalCambiarPago');
                mostrarToast('Método de pago cambiado correctamente', 'success');
                verDetalleVenta(ventaSeleccionada.venta_id);
            } else {
                mostrarToast(r.error || 'Error al cambiar pago', 'error');
            }
        }).catch(function(e) {
            mostrarToast('Error de conexión', 'error');
        });
    });
}

// ==================== REABRIR VENTA ====================
function abrirModalReabrirVenta() {
    if (!ventaSeleccionada) return;
    
    solicitarAutorizacionAdmin('¿Autorizar reapertura de venta #' + ventaSeleccionada.folio + ' para agregar productos?', function(admin) {
        // Cargar productos de la venta al carrito
        if (carrito.length > 0) {
            if (!confirm('Hay productos en el carrito actual. ¿Guardarlos en espera?')) {
                return;
            }
            ponerEnEspera();
        }
        
        // Marcar venta como reabierta
        API.request('/ventas/reabrir/' + ventaSeleccionada.venta_id, 'POST', {
            usuario_id: API.usuario.id,
            autorizado_por: admin
        }).then(function(r) {
            if (r.success) {
                // Cargar productos al carrito
                productosVentaSeleccionada.forEach(function(p) {
                    if (p.estatus !== 'CANCELADO') {
                        carrito.push({
                            producto_id: p.producto_id,
                            codigo: p.codigo_barras || '',
                            nombre: p.producto_nombre || p.descripcion,
                            precio: parseFloat(p.precio_unitario),
                            precioOriginal: parseFloat(p.precio_unitario),
                            cantidad: parseFloat(p.cantidad),
                            unidad: p.unidad || p.unidad_id || 'PZ',
                            esGranel: ['KG', 'GR', 'LT', 'ML', 'MT'].indexOf((p.unidad || 'PZ').toUpperCase()) >= 0,
                            descuento: parseFloat(p.descuento_pct) || 0,
                            esReabierto: true,
                            detalle_original_id: p.detalle_id
                        });
                    }
                });
                
                // Guardar referencia de venta reabierta
                ventaReabierta = {
                    venta_id: ventaSeleccionada.venta_id,
                    total_original: parseFloat(ventaSeleccionada.total),
                    pagado: parseFloat(ventaSeleccionada.pagado) || 0,
                    cliente: ventaSeleccionada.cliente_id ? {
                        cliente_id: ventaSeleccionada.cliente_id,
                        nombre: ventaSeleccionada.cliente_nombre
                    } : null
                };
                
                if (ventaReabierta.cliente) {
                    clienteSeleccionado = ventaReabierta.cliente;
                    setElementText('clienteNombre', ventaReabierta.cliente.nombre);
                    setElementText('clientePanel', ventaReabierta.cliente.nombre);
                }
                
                cerrarModal('modalDetalleVenta');
                cerrarModal('modalVentasTurno');
                renderCarrito();
                mostrarToast('Venta reabierta. Agrega productos y cobra la diferencia.', 'success');
            } else {
                mostrarToast(r.error || 'Error al reabrir venta', 'error');
            }
        });
    });
}

var ventaReabierta = null;

// Modificar abrirModalCobro para manejar ventas reabiertas
var _abrirModalCobroOriginal = abrirModalCobro;
abrirModalCobro = function() {
    if (ventaReabierta) {
        abrirModalCobrarPendiente();
    } else {
        _abrirModalCobroOriginal();
    }
};

// ==================== COBRAR PENDIENTE (VENTA REABIERTA) ====================
function abrirModalCobrarPendiente() {
    if (!ventaReabierta) return;
    
    var totalActual = calcularTotalFinal();
    var nuevos = totalActual - ventaReabierta.total_original;
    var porCobrar = totalActual - ventaReabierta.pagado;
    
    setElementText('pendienteMonto', '$' + porCobrar.toFixed(2));
    setElementText('pendienteOriginal', '$' + ventaReabierta.total_original.toFixed(2));
    setElementText('pendienteNuevos', '$' + (nuevos > 0 ? nuevos.toFixed(2) : '0.00'));
    setElementText('pendientePagado', '$' + ventaReabierta.pagado.toFixed(2));
    setElementText('pendientePorCobrar', '$' + porCobrar.toFixed(2));
    
    document.getElementById('inputEfectivoPendiente').value = '';
    setElementText('cambioPendiente', '$0.00');
    
    // Renderizar métodos de pago
    var metodosHtml = '';
    metodosPago.forEach(function(m, i) {
        var tipo = (m.tipo || 'EFECTIVO').toLowerCase();
        var icono = getIconoMetodo(m);
        metodosHtml += '<button type="button" class="metodo-btn' + (i === 0 ? ' active' : '') + '" data-metodo-id="' + m.metodo_pago_id + '">' +
            '<i class="fas ' + icono + '"></i><span>' + m.nombre + '</span>' +
        '</button>';
    });
    document.getElementById('metodosPendienteContainer').innerHTML = metodosHtml;
    
    document.querySelectorAll('#metodosPendienteContainer .metodo-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('#metodosPendienteContainer .metodo-btn').forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
        });
    });
    
    var modal = document.getElementById('modalCobrarPendiente');
    if (modal) modal.classList.add('active');
    
    setTimeout(function() {
        document.getElementById('inputEfectivoPendiente').focus();
    }, 100);
}

function addEfectivoPendiente(monto) {
    var inp = document.getElementById('inputEfectivoPendiente');
    if (inp) {
        inp.value = (parseFloat(inp.value) || 0) + monto;
        calcularCambioPendiente();
    }
}

function setExactoPendiente() {
    var porCobrar = calcularTotalFinal() - ventaReabierta.pagado;
    document.getElementById('inputEfectivoPendiente').value = porCobrar.toFixed(2);
    calcularCambioPendiente();
}

function limpiarEfectivoPendiente() {
    document.getElementById('inputEfectivoPendiente').value = '';
    calcularCambioPendiente();
}

function calcularCambioPendiente() {
    var porCobrar = calcularTotalFinal() - ventaReabierta.pagado;
    var recibido = parseFloat(document.getElementById('inputEfectivoPendiente').value) || 0;
    var cambio = Math.max(0, recibido - porCobrar);
    setElementText('cambioPendiente', '$' + cambio.toFixed(2));
}

function confirmarCobroPendiente() {
    var porCobrar = calcularTotalFinal() - ventaReabierta.pagado;
    var recibido = parseFloat(document.getElementById('inputEfectivoPendiente').value) || 0;
    
    if (recibido < porCobrar) {
        mostrarToast('Monto insuficiente', 'error');
        return;
    }
    
    var metodoActivo = document.querySelector('#metodosPendienteContainer .metodo-btn.active');
    var metodoPagoId = metodoActivo ? metodoActivo.getAttribute('data-metodo-id') : (metodosPago[0] ? metodosPago[0].metodo_pago_id : 'EFECTIVO');
    
    // Productos nuevos (los que no tienen detalle_original_id)
    var productosNuevos = carrito.filter(function(item) { return !item.esReabierto; });
    
    API.request('/ventas/cobrar-complemento/' + ventaReabierta.venta_id, 'POST', {
        monto_cobrado: porCobrar,
        metodo_pago_id: metodoPagoId,
        cambio: recibido - porCobrar,
        productos_nuevos: productosNuevos.map(function(item) {
            return {
                producto_id: item.producto_id,
                descripcion: item.nombre,
                cantidad: item.cantidad,
                unidad_id: item.unidad,
                precio_unitario: item.precio,
                descuento: item.descuento || 0,
                subtotal: item.precio * item.cantidad * (1 - (item.descuento || 0) / 100)
            };
        }),
        nuevo_total: calcularTotalFinal(),
        usuario_id: API.usuario.id,
        turno_id: turnoActual.turno_id
    }).then(function(r) {
        if (r.success) {
            cerrarModal('modalCobrarPendiente');
            
            // Mostrar éxito
            setElementText('exitoFolio', '#' + (ventaReabierta.folio || r.folio));
            setElementText('exitoTotal', '$' + calcularTotalFinal().toFixed(2));
            setElementText('exitoCambio', '$' + (recibido - porCobrar).toFixed(2));
            
            var modal = document.getElementById('modalExito');
            if (modal) modal.classList.add('active');
            
            // Limpiar
            ventaReabierta = null;
            limpiarVentaActual();
        } else {
            mostrarToast(r.error || 'Error al procesar pago', 'error');
        }
    }).catch(function(e) {
        mostrarToast('Error de conexión', 'error');
    });
}

// ==================== IMPRIMIR ====================
function imprimirVentaDetalle() {
    if (!ventaSeleccionada) return;
    imprimirVentaDirecto(ventaSeleccionada.venta_id);
}

function imprimirVentaDirecto(ventaId) {
    var venta = ventasTurno.find(function(v) { return v.venta_id === ventaId; });
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
