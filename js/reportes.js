/* ============================================
   REPORTES.JS - CAFI POS
   ============================================ */

let datosReporte = {};
const empresaId = localStorage.getItem('empresa_id') || JSON.parse(localStorage.getItem('usuario') || '{}').empresa_id || 1;
const sucursalId = localStorage.getItem('sucursal_id') || JSON.parse(localStorage.getItem('usuario') || '{}').sucursal_id || 1;

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initUsuario();
    initFechas();
    initTabs();
    cargarCategorias();
    cargarUsuarios();
    cargarMetodosPago();
    cargarClientesSelect();
    cargarVentasPeriodo();
});

function initUsuario() {
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    const sucursal = JSON.parse(localStorage.getItem('sucursal') || '{}');
    document.getElementById('userName').textContent = usuario.nombre || 'Usuario';
    document.getElementById('userSucursal').textContent = sucursal.nombre || usuario.sucursal_nombre || 'Sucursal';
    document.getElementById('userAvatar').textContent = (usuario.nombre || 'US').substring(0, 2).toUpperCase();
}

function initFechas() {
    const hoy = new Date();
    const hace30 = new Date();
    hace30.setDate(hace30.getDate() - 30);
    
    const fechaHoy = hoy.toISOString().split('T')[0];
    const fecha30 = hace30.toISOString().split('T')[0];
    
    document.querySelectorAll('input[type="date"]').forEach(input => {
        if (input.id.includes('Desde')) input.value = fecha30;
        if (input.id.includes('Hasta')) input.value = fechaHoy;
    });
}

function initTabs() {
    document.querySelectorAll('.reporte-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const reporte = btn.dataset.reporte;
            document.querySelectorAll('.reporte-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.reporte-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`panel-${reporte}`).classList.add('active');
            cargarReporteActivo(reporte);
        });
    });
}

function cargarReporteActivo(reporte) {
    const funciones = {
        'ventas-periodo': cargarVentasPeriodo,
        'ventas-usuario': cargarVentasUsuario,
        'productos-vendidos': cargarProductosVendidos,
        'cortes': cargarCortes,
        'pagos': cargarPagos,
        'movimientos': cargarMovimientos,
        'devoluciones': cargarDevoluciones,
        'cancelaciones': cargarCancelaciones,
        'clientes-frecuentes': cargarClientesFrecuentes,
        'cuentas-cobrar': cargarCuentasCobrar
    };
    if (funciones[reporte]) funciones[reporte]();
}

// ============================================
// CARGAR SELECTS
// ============================================

async function cargarCategorias() {
    try {
        const r = await API.get(`/categorias/${empresaId}`);
        if (r.success) {
            const sel = document.getElementById('productosCategoria');
            (r.categorias || r.data || []).forEach(c => {
                sel.innerHTML += `<option value="${c.categoria_id}">${c.nombre}</option>`;
            });
        }
    } catch (e) { console.error(e); }
}

async function cargarUsuarios() {
    try {
        const r = await API.get(`/usuarios/${empresaId}`);
        if (r.success) {
            const sel = document.getElementById('cortesUsuario');
            (r.usuarios || []).forEach(u => {
                sel.innerHTML += `<option value="${u.usuario_id}">${u.nombre}</option>`;
            });
        }
    } catch (e) { console.error(e); }
}

async function cargarMetodosPago() {
    try {
        const r = await API.get(`/metodos-pago/${empresaId}`);
        if (r.success) {
            const sel = document.getElementById('pagosMetodo');
            (r.metodos || []).forEach(m => {
                sel.innerHTML += `<option value="${m.metodo_pago_id}">${m.nombre}</option>`;
            });
        }
    } catch (e) { console.error(e); }
}

async function cargarClientesSelect() {
    try {
        const r = await API.get(`/clientes/${empresaId}`);
        if (r.success) {
            const sel = document.getElementById('cxcCliente');
            (r.clientes || r.data || []).forEach(c => {
                sel.innerHTML += `<option value="${c.cliente_id}">${c.nombre}</option>`;
            });
        }
    } catch (e) { console.error(e); }
}

// ============================================
// VENTAS POR PERÍODO
// ============================================

async function cargarVentasPeriodo() {
    const desde = document.getElementById('ventasFechaDesde').value;
    const hasta = document.getElementById('ventasFechaHasta').value;
    const agrupar = document.getElementById('ventasAgrupar').value;
    const tabla = document.getElementById('tablaVentasPeriodo');
    
    tabla.innerHTML = `<tr class="loading-row"><td colspan="6"><div class="spinner"></div>Cargando...</td></tr>`;
    
    try {
        const r = await API.get(`/reportes/ventas-periodo?empresa_id=${empresaId}&desde=${desde}&hasta=${hasta}&agrupar=${agrupar}`);
        
        if (r.success && r.datos && r.datos.length > 0) {
            datosReporte['ventas-periodo'] = r.datos;
            let totalVentas = 0, totalMonto = 0, totalProductos = 0;
            
            tabla.innerHTML = r.datos.map(d => {
                totalVentas += parseInt(d.ventas) || 0;
                totalMonto += parseFloat(d.total) || 0;
                totalProductos += parseInt(d.productos) || 0;
                return `<tr>
                    <td><strong>${d.periodo}</strong></td>
                    <td class="text-center">${d.ventas}</td>
                    <td class="text-right">${formatMoney(d.subtotal)}</td>
                    <td class="text-right">${formatMoney(d.impuestos)}</td>
                    <td class="text-right"><strong>${formatMoney(d.total)}</strong></td>
                    <td class="text-center">${d.productos}</td>
                </tr>`;
            }).join('');
            
            tabla.innerHTML += `<tr class="row-total">
                <td>TOTAL</td>
                <td class="text-center">${totalVentas}</td>
                <td class="text-right">-</td>
                <td class="text-right">-</td>
                <td class="text-right">${formatMoney(totalMonto)}</td>
                <td class="text-center">${totalProductos}</td>
            </tr>`;
            
            document.getElementById('ventasTotalVentas').textContent = totalVentas;
            document.getElementById('ventasTotalMonto').textContent = formatMoney(totalMonto);
            document.getElementById('ventasTicketProm').textContent = formatMoney(totalMonto / totalVentas || 0);
            document.getElementById('ventasProductos').textContent = totalProductos;
        } else {
            tabla.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-inbox"></i><p>No hay datos para mostrar</p></div></td></tr>`;
            limpiarStatsVentas();
        }
    } catch (e) {
        console.error('Error cargando ventas:', e);
        tabla.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error al cargar datos</p></div></td></tr>`;
    }
}

function limpiarStatsVentas() {
    document.getElementById('ventasTotalVentas').textContent = '0';
    document.getElementById('ventasTotalMonto').textContent = '$0.00';
    document.getElementById('ventasTicketProm').textContent = '$0.00';
    document.getElementById('ventasProductos').textContent = '0';
}

// ============================================
// VENTAS POR USUARIO
// ============================================

async function cargarVentasUsuario() {
    const desde = document.getElementById('usuarioFechaDesde').value;
    const hasta = document.getElementById('usuarioFechaHasta').value;
    const tabla = document.getElementById('tablaVentasUsuario');
    
    tabla.innerHTML = `<tr class="loading-row"><td colspan="6"><div class="spinner"></div>Cargando...</td></tr>`;
    
    try {
        const r = await API.get(`/reportes/ventas-usuario?empresa_id=${empresaId}&desde=${desde}&hasta=${hasta}`);
        
        if (r.success && r.datos && r.datos.length > 0) {
            datosReporte['ventas-usuario'] = r.datos;
            const totalGeneral = r.datos.reduce((s, d) => s + (parseFloat(d.total) || 0), 0);
            
            tabla.innerHTML = r.datos.map(d => {
                const porcentaje = totalGeneral > 0 ? ((parseFloat(d.total) / totalGeneral) * 100).toFixed(1) : 0;
                return `<tr>
                    <td><strong>${d.usuario}</strong></td>
                    <td class="text-center">${d.ventas}</td>
                    <td class="text-right">${formatMoney(d.total)}</td>
                    <td class="text-right">${formatMoney(d.promedio)}</td>
                    <td class="text-center">${d.productos}</td>
                    <td class="text-center"><span class="badge badge-info">${porcentaje}%</span></td>
                </tr>`;
            }).join('');
        } else {
            tabla.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-inbox"></i><p>No hay datos</p></div></td></tr>`;
        }
    } catch (e) {
        console.error('Error:', e);
        tabla.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error al cargar</p></div></td></tr>`;
    }
}

// ============================================
// PRODUCTOS VENDIDOS
// ============================================

async function cargarProductosVendidos() {
    const desde = document.getElementById('productosFechaDesde').value;
    const hasta = document.getElementById('productosFechaHasta').value;
    const categoria = document.getElementById('productosCategoria').value;
    const orden = document.getElementById('productosOrden').value;
    const tabla = document.getElementById('tablaProductosVendidos');
    
    tabla.innerHTML = `<tr class="loading-row"><td colspan="7"><div class="spinner"></div>Cargando...</td></tr>`;
    
    try {
        let url = `/reportes/productos-vendidos?empresa_id=${empresaId}&desde=${desde}&hasta=${hasta}&orden=${orden}`;
        if (categoria) url += `&categoria_id=${categoria}`;
        
        const r = await API.get(url);
        
        if (r.success && r.datos && r.datos.length > 0) {
            datosReporte['productos-vendidos'] = r.datos;
            
            tabla.innerHTML = r.datos.map(d => {
                const total = parseFloat(d.total) || 0;
                const costo = parseFloat(d.costo) || 0;
                const utilidad = total - costo;
                return `<tr>
                    <td><code>${d.codigo || '-'}</code></td>
                    <td><strong>${d.producto}</strong></td>
                    <td>${d.categoria}</td>
                    <td class="text-center">${d.cantidad}</td>
                    <td class="text-right">${formatMoney(total)}</td>
                    <td class="text-right">${formatMoney(costo)}</td>
                    <td class="text-right"><span class="badge ${utilidad >= 0 ? 'badge-success' : 'badge-danger'}">${formatMoney(utilidad)}</span></td>
                </tr>`;
            }).join('');
        } else {
            tabla.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fas fa-inbox"></i><p>No hay datos</p></div></td></tr>`;
        }
    } catch (e) {
        console.error('Error:', e);
        tabla.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error al cargar</p></div></td></tr>`;
    }
}

// ============================================
// CORTES DE CAJA
// ============================================

async function cargarCortes() {
    const desde = document.getElementById('cortesFechaDesde').value;
    const hasta = document.getElementById('cortesFechaHasta').value;
    const usuario = document.getElementById('cortesUsuario').value;
    const estado = document.getElementById('cortesEstado').value;
    const tabla = document.getElementById('tablaCortes');
    
    tabla.innerHTML = `<tr class="loading-row"><td colspan="9"><div class="spinner"></div>Cargando...</td></tr>`;
    
    try {
        let url = `/reportes/cortes?empresa_id=${empresaId}&desde=${desde}&hasta=${hasta}`;
        if (usuario) url += `&usuario_id=${usuario}`;
        
        const r = await API.get(url);
        
        if (r.success && r.cortes && r.cortes.length > 0) {
            let datos = r.cortes;
            if (estado) datos = datos.filter(c => {
                const diff = (parseFloat(c.total_declarado) || 0) - (parseFloat(c.total_esperado) || 0);
                return getEstadoCorte(diff) === estado;
            });
            
            datosReporte['cortes'] = datos;
            
            let correctos = 0, sobrantes = 0, faltantes = 0;
            
            tabla.innerHTML = datos.map(c => {
                const esperado = parseFloat(c.total_esperado) || 0;
                const declarado = parseFloat(c.total_declarado) || 0;
                const diff = declarado - esperado;
                const est = getEstadoCorte(diff);
                if (est === 'CORRECTO') correctos++;
                else if (est === 'SOBRANTE') sobrantes++;
                else faltantes++;
                
                return `<tr>
                    <td><strong>${c.folio || c.corte_id}</strong></td>
                    <td>${formatFecha(c.fecha_cierre)}</td>
                    <td>${c.usuario_nombre}</td>
                    <td>${c.turno_folio || '-'}</td>
                    <td class="text-right">${formatMoney(esperado)}</td>
                    <td class="text-right">${formatMoney(declarado)}</td>
                    <td class="text-right"><span class="${diff >= 0 ? 'text-success' : 'text-danger'}">${formatMoney(diff)}</span></td>
                    <td>${getBadgeEstadoCorte(est)}</td>
                    <td><button class="btn-ver" onclick="verDetalleCorte('${c.corte_id}')"><i class="fas fa-eye"></i></button></td>
                </tr>`;
            }).join('');
            
            document.getElementById('cortesTotal').textContent = datos.length;
            document.getElementById('cortesCorrectos').textContent = correctos;
            document.getElementById('cortesSobrantes').textContent = sobrantes;
            document.getElementById('cortesFaltantes').textContent = faltantes;
        } else {
            tabla.innerHTML = `<tr><td colspan="9"><div class="empty-state"><i class="fas fa-inbox"></i><p>No hay cortes</p></div></td></tr>`;
            limpiarStatsCortes();
        }
    } catch (e) {
        console.error('Error:', e);
        tabla.innerHTML = `<tr><td colspan="9"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error al cargar</p></div></td></tr>`;
    }
}

function getEstadoCorte(diff) {
    if (Math.abs(diff) < 0.01) return 'CORRECTO';
    return diff > 0 ? 'SOBRANTE' : 'FALTANTE';
}

function getBadgeEstadoCorte(estado) {
    const clases = { CORRECTO: 'success', SOBRANTE: 'info', FALTANTE: 'danger' };
    const iconos = { CORRECTO: 'check', SOBRANTE: 'arrow-up', FALTANTE: 'arrow-down' };
    return `<span class="badge badge-${clases[estado]}"><i class="fas fa-${iconos[estado]}"></i> ${estado}</span>`;
}

async function verDetalleCorte(id) {
    try {
        const r = await API.get(`/cortes/${id}`);
        if (r.success) {
            const c = r.corte;
            const esperado = parseFloat(c.efectivo_esperado) || 0;
            const declarado = parseFloat(c.efectivo_declarado) || 0;
            const diff = declarado - esperado;
            const estado = getEstadoCorte(diff);
            
            document.getElementById('detalleCorteContent').innerHTML = `
                <div class="detalle-grid">
                    <div class="detalle-item"><label>Folio</label><span>${c.turno_id}</span></div>
                    <div class="detalle-item"><label>Fecha Cierre</label><span>${formatFecha(c.fecha_cierre)}</span></div>
                    <div class="detalle-item"><label>Usuario</label><span>${c.usuario_nombre}</span></div>
                    <div class="detalle-item"><label>Estado</label><span>${getBadgeEstadoCorte(estado)}</span></div>
                </div>
                <div class="detalle-totales">
                    <h4>Resumen de Efectivo</h4>
                    <div class="total-row"><span>Saldo Inicial</span><span>${formatMoney(c.saldo_inicial)}</span></div>
                    <div class="total-row"><span>Ventas Efectivo</span><span>${formatMoney(c.ventas_efectivo)}</span></div>
                    <div class="total-row"><span>Ingresos</span><span>${formatMoney(c.ingresos)}</span></div>
                    <div class="total-row"><span>Egresos</span><span>-${formatMoney(c.egresos)}</span></div>
                    <div class="total-row"><span>Efectivo Esperado</span><span>${formatMoney(esperado)}</span></div>
                    <div class="total-row"><span>Efectivo Declarado</span><span>${formatMoney(declarado)}</span></div>
                    <div class="total-row diferencia ${diff >= 0 ? 'positivo' : 'negativo'}"><span>Diferencia</span><span>${formatMoney(diff)}</span></div>
                </div>
                <div class="detalle-totales" style="margin-top:16px;">
                    <h4>Resumen de Ventas</h4>
                    <div class="total-row"><span>Ventas Tarjeta</span><span>${formatMoney(c.ventas_tarjeta)}</span></div>
                    <div class="total-row"><span>Ventas Transferencia</span><span>${formatMoney(c.ventas_transferencia)}</span></div>
                    <div class="total-row"><span>Ventas Crédito</span><span>${formatMoney(c.ventas_credito)}</span></div>
                    <div class="total-row"><span>Total Ventas</span><span><strong>${formatMoney(c.total_ventas)}</strong></span></div>
                </div>
                ${c.observaciones ? `<div style="margin-top:16px;padding:12px;background:#fef3c7;border-radius:8px;"><strong>Observaciones:</strong> ${c.observaciones}</div>` : ''}
            `;
            abrirModal('modalDetalleCorte');
        }
    } catch (e) { 
        console.error('Error:', e);
        toast('Error al cargar detalle', 'error'); 
    }
}

function limpiarStatsCortes() {
    document.getElementById('cortesTotal').textContent = '0';
    document.getElementById('cortesCorrectos').textContent = '0';
    document.getElementById('cortesSobrantes').textContent = '0';
    document.getElementById('cortesFaltantes').textContent = '0';
}

// ============================================
// PAGOS RECIBIDOS
// ============================================

async function cargarPagos() {
    const desde = document.getElementById('pagosFechaDesde').value;
    const hasta = document.getElementById('pagosFechaHasta').value;
    const metodo = document.getElementById('pagosMetodo').value;
    const estado = document.getElementById('pagosEstado').value;
    const tabla = document.getElementById('tablaPagos');
    
    tabla.innerHTML = `<tr class="loading-row"><td colspan="9"><div class="spinner"></div>Cargando...</td></tr>`;
    
    try {
        let url = `/reportes/pagos?empresa_id=${empresaId}&desde=${desde}&hasta=${hasta}`;
        if (metodo) url += `&metodo_id=${metodo}`;
        if (estado) url += `&estado=${estado}`;
        
        const r = await API.get(url);
        
        if (r.success && r.pagos && r.pagos.length > 0) {
            datosReporte['pagos'] = r.pagos;
            
            let efectivo = 0, tarjeta = 0, transferencia = 0, otros = 0;
            
            tabla.innerHTML = r.pagos.map(p => {
                const monto = parseFloat(p.monto) || 0;
                if (p.estado !== 'CANCELADO') {
                    const m = (p.metodo_nombre || '').toLowerCase();
                    if (m.includes('efectivo')) efectivo += monto;
                    else if (m.includes('tarjeta')) tarjeta += monto;
                    else if (m.includes('transfer')) transferencia += monto;
                    else otros += monto;
                }
                
                return `<tr>
                    <td><strong>${p.folio || p.pago_id}</strong></td>
                    <td>${formatFecha(p.fecha)}</td>
                    <td>${p.venta_folio || '-'}</td>
                    <td>${p.cliente_nombre || 'Público General'}</td>
                    <td><i class="${getIconoMetodo(p.metodo_nombre)}"></i> ${p.metodo_nombre}</td>
                    <td class="text-right"><strong>${formatMoney(monto)}</strong></td>
                    <td>${p.referencia || '-'}</td>
                    <td>${getBadgeEstado(p.estado)}</td>
                    <td>${p.usuario_nombre}</td>
                </tr>`;
            }).join('');
            
            document.getElementById('pagosEfectivo').textContent = formatMoney(efectivo);
            document.getElementById('pagosTarjeta').textContent = formatMoney(tarjeta);
            document.getElementById('pagosTransferencia').textContent = formatMoney(transferencia);
            document.getElementById('pagosOtros').textContent = formatMoney(otros);
        } else {
            tabla.innerHTML = `<tr><td colspan="9"><div class="empty-state"><i class="fas fa-inbox"></i><p>No hay pagos</p></div></td></tr>`;
            limpiarStatsPagos();
        }
    } catch (e) {
        console.error('Error:', e);
        tabla.innerHTML = `<tr><td colspan="9"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error al cargar</p></div></td></tr>`;
    }
}

function getIconoMetodo(nombre) {
    const n = (nombre || '').toLowerCase();
    if (n.includes('efectivo')) return 'fas fa-money-bill-wave';
    if (n.includes('tarjeta')) return 'fas fa-credit-card';
    if (n.includes('transfer')) return 'fas fa-exchange-alt';
    return 'fas fa-coins';
}

function getBadgeEstado(estado) {
    const clase = estado === 'APLICADO' ? 'success' : 'danger';
    return `<span class="badge badge-${clase}">${estado}</span>`;
}

function limpiarStatsPagos() {
    document.getElementById('pagosEfectivo').textContent = '$0.00';
    document.getElementById('pagosTarjeta').textContent = '$0.00';
    document.getElementById('pagosTransferencia').textContent = '$0.00';
    document.getElementById('pagosOtros').textContent = '$0.00';
}

// ============================================
// MOVIMIENTOS DE CAJA
// ============================================

async function cargarMovimientos() {
    const desde = document.getElementById('movsFechaDesde').value;
    const hasta = document.getElementById('movsFechaHasta').value;
    const tipo = document.getElementById('movsTipo').value;
    const tabla = document.getElementById('tablaMovimientos');
    
    tabla.innerHTML = `<tr class="loading-row"><td colspan="7"><div class="spinner"></div>Cargando...</td></tr>`;
    
    try {
        let url = `/reportes/movimientos?empresa_id=${empresaId}&desde=${desde}&hasta=${hasta}`;
        if (tipo) url += `&tipo=${tipo}`;
        
        const r = await API.get(url);
        
        if (r.success && r.movimientos && r.movimientos.length > 0) {
            datosReporte['movimientos'] = r.movimientos;
            
            let ingresos = 0, egresos = 0;
            
            tabla.innerHTML = r.movimientos.map(m => {
                const monto = parseFloat(m.monto) || 0;
                if (m.tipo === 'INGRESO') ingresos += monto;
                else egresos += monto;
                
                return `<tr>
                    <td>${formatFecha(m.fecha)}</td>
                    <td>${m.tipo === 'INGRESO' ? '<span class="badge badge-success"><i class="fas fa-arrow-down"></i> INGRESO</span>' : '<span class="badge badge-danger"><i class="fas fa-arrow-up"></i> EGRESO</span>'}</td>
                    <td>${m.concepto}</td>
                    <td class="text-right"><strong class="${m.tipo === 'INGRESO' ? 'text-success' : 'text-danger'}">${formatMoney(monto)}</strong></td>
                    <td>${m.usuario_nombre}</td>
                    <td>${m.turno_folio || '-'}</td>
                    <td>${m.observaciones || '-'}</td>
                </tr>`;
            }).join('');
            
            document.getElementById('movsIngresos').textContent = formatMoney(ingresos);
            document.getElementById('movsEgresos').textContent = formatMoney(egresos);
            document.getElementById('movsBalance').textContent = formatMoney(ingresos - egresos);
        } else {
            tabla.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fas fa-inbox"></i><p>No hay movimientos</p></div></td></tr>`;
            document.getElementById('movsIngresos').textContent = '$0.00';
            document.getElementById('movsEgresos').textContent = '$0.00';
            document.getElementById('movsBalance').textContent = '$0.00';
        }
    } catch (e) {
        console.error('Error:', e);
        tabla.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error al cargar</p></div></td></tr>`;
    }
}

// ============================================
// DEVOLUCIONES
// ============================================

async function cargarDevoluciones() {
    const desde = document.getElementById('devsFechaDesde').value;
    const hasta = document.getElementById('devsFechaHasta').value;
    const motivo = document.getElementById('devsMotivo').value;
    const tabla = document.getElementById('tablaDevoluciones');
    
    tabla.innerHTML = `<tr class="loading-row"><td colspan="9"><div class="spinner"></div>Cargando...</td></tr>`;
    
    try {
        let url = `/reportes/devoluciones?empresa_id=${empresaId}&desde=${desde}&hasta=${hasta}`;
        if (motivo) url += `&motivo=${motivo}`;
        
        const r = await API.get(url);
        
        if (r.success && r.devoluciones && r.devoluciones.length > 0) {
            datosReporte['devoluciones'] = r.devoluciones;
            
            let total = 0, productos = 0;
            
            tabla.innerHTML = r.devoluciones.map(d => {
                const monto = parseFloat(d.monto) || 0;
                const cantidad = parseInt(d.cantidad) || 1;
                total += monto;
                productos += cantidad;
                return `<tr>
                    <td><strong>${d.folio || d.devolucion_id}</strong></td>
                    <td>${formatFecha(d.fecha)}</td>
                    <td>${d.venta_folio || '-'}</td>
                    <td>${d.cliente_nombre || 'Público General'}</td>
                    <td>${d.producto_nombre || '-'}</td>
                    <td class="text-center">${cantidad}</td>
                    <td class="text-right">${formatMoney(monto)}</td>
                    <td>${getBadgeMotivo(d.motivo)}</td>
                    <td>${d.usuario_nombre}</td>
                </tr>`;
            }).join('');
            
            document.getElementById('devsTotal').textContent = r.devoluciones.length;
            document.getElementById('devsMonto').textContent = formatMoney(total);
            document.getElementById('devsProductos').textContent = productos;
        } else {
            tabla.innerHTML = `<tr><td colspan="9"><div class="empty-state"><i class="fas fa-inbox"></i><p>No hay devoluciones</p></div></td></tr>`;
            document.getElementById('devsTotal').textContent = '0';
            document.getElementById('devsMonto').textContent = '$0.00';
            document.getElementById('devsProductos').textContent = '0';
        }
    } catch (e) {
        console.error('Error:', e);
        tabla.innerHTML = `<tr><td colspan="9"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error al cargar</p></div></td></tr>`;
    }
}

function getBadgeMotivo(motivo) {
    const clases = { DEFECTUOSO: 'danger', EQUIVOCADO: 'warning', GARANTIA: 'info', OTRO: 'purple' };
    return `<span class="badge badge-${clases[motivo] || 'info'}">${motivo || 'OTRO'}</span>`;
}

// ============================================
// CANCELACIONES
// ============================================

async function cargarCancelaciones() {
    const desde = document.getElementById('cancFechaDesde').value;
    const hasta = document.getElementById('cancFechaHasta').value;
    const tabla = document.getElementById('tablaCancelaciones');
    
    tabla.innerHTML = `<tr class="loading-row"><td colspan="7"><div class="spinner"></div>Cargando...</td></tr>`;
    
    try {
        const r = await API.get(`/reportes/cancelaciones?empresa_id=${empresaId}&desde=${desde}&hasta=${hasta}`);
        
        if (r.success && r.cancelaciones && r.cancelaciones.length > 0) {
            datosReporte['cancelaciones'] = r.cancelaciones;
            
            let total = 0;
            
            tabla.innerHTML = r.cancelaciones.map(c => {
                const monto = parseFloat(c.total) || 0;
                total += monto;
                return `<tr>
                    <td><strong>${c.folio}</strong></td>
                    <td>${formatFecha(c.fecha_venta)}</td>
                    <td>${formatFecha(c.fecha_cancelacion)}</td>
                    <td>${c.cliente_nombre || 'Público General'}</td>
                    <td class="text-right">${formatMoney(monto)}</td>
                    <td>${c.motivo || '-'}</td>
                    <td>${c.autorizo || '-'}</td>
                </tr>`;
            }).join('');
            
            document.getElementById('cancTotal').textContent = r.cancelaciones.length;
            document.getElementById('cancMonto').textContent = formatMoney(total);
        } else {
            tabla.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fas fa-inbox"></i><p>No hay cancelaciones</p></div></td></tr>`;
            document.getElementById('cancTotal').textContent = '0';
            document.getElementById('cancMonto').textContent = '$0.00';
        }
    } catch (e) {
        console.error('Error:', e);
        tabla.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error al cargar</p></div></td></tr>`;
    }
}

// ============================================
// CLIENTES FRECUENTES
// ============================================

async function cargarClientesFrecuentes() {
    const desde = document.getElementById('clientesFechaDesde').value;
    const hasta = document.getElementById('clientesFechaHasta').value;
    const top = document.getElementById('clientesTop').value;
    const tabla = document.getElementById('tablaClientesFrecuentes');
    
    tabla.innerHTML = `<tr class="loading-row"><td colspan="7"><div class="spinner"></div>Cargando...</td></tr>`;
    
    try {
        const r = await API.get(`/reportes/clientes-frecuentes?empresa_id=${empresaId}&desde=${desde}&hasta=${hasta}&top=${top}`);
        
        if (r.success && r.clientes && r.clientes.length > 0) {
            datosReporte['clientes-frecuentes'] = r.clientes;
            
            tabla.innerHTML = r.clientes.map((c, i) => `<tr>
                <td><span class="badge badge-${i < 3 ? 'warning' : 'info'}">${i + 1}</span></td>
                <td><strong>${c.nombre}</strong></td>
                <td>${c.telefono || '-'}</td>
                <td class="text-center">${c.compras}</td>
                <td class="text-right">${formatMoney(c.total)}</td>
                <td class="text-right">${formatMoney(c.promedio)}</td>
                <td>${formatFecha(c.ultima_compra)}</td>
            </tr>`).join('');
        } else {
            tabla.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fas fa-inbox"></i><p>No hay datos</p></div></td></tr>`;
        }
    } catch (e) {
        console.error('Error:', e);
        tabla.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error al cargar</p></div></td></tr>`;
    }
}

// ============================================
// CUENTAS POR COBRAR
// ============================================

async function cargarCuentasCobrar() {
    const estado = document.getElementById('cxcEstado').value;
    const cliente = document.getElementById('cxcCliente').value;
    const tabla = document.getElementById('tablaCuentasCobrar');
    
    tabla.innerHTML = `<tr class="loading-row"><td colspan="8"><div class="spinner"></div>Cargando...</td></tr>`;
    
    try {
        let url = `/reportes/cuentas-cobrar?empresa_id=${empresaId}`;
        if (cliente) url += `&cliente_id=${cliente}`;
        
        const r = await API.get(url);
        
        if (r.success && r.cuentas && r.cuentas.length > 0) {
            let datos = r.cuentas;
            const hoy = new Date();
            
            if (estado === 'PENDIENTE') datos = datos.filter(c => new Date(c.vencimiento) >= hoy);
            if (estado === 'VENCIDO') datos = datos.filter(c => new Date(c.vencimiento) < hoy);
            
            datosReporte['cuentas-cobrar'] = datos;
            
            let totalPendiente = 0, vencidas = 0;
            
            tabla.innerHTML = datos.map(c => {
                const total = parseFloat(c.total) || 0;
                const pagado = parseFloat(c.pagado) || 0;
                const pendiente = total - pagado;
                totalPendiente += pendiente;
                const vencida = new Date(c.vencimiento) < hoy;
                if (vencida) vencidas++;
                
                return `<tr>
                    <td><strong>${c.folio}</strong></td>
                    <td>${formatFecha(c.fecha)}</td>
                    <td>${c.cliente_nombre}</td>
                    <td class="text-right">${formatMoney(total)}</td>
                    <td class="text-right">${formatMoney(pagado)}</td>
                    <td class="text-right"><strong>${formatMoney(pendiente)}</strong></td>
                    <td>${formatFecha(c.vencimiento)}</td>
                    <td>${vencida ? '<span class="badge badge-danger">VENCIDO</span>' : '<span class="badge badge-warning">PENDIENTE</span>'}</td>
                </tr>`;
            }).join('');
            
            document.getElementById('cxcCuentas').textContent = datos.length;
            document.getElementById('cxcMonto').textContent = formatMoney(totalPendiente);
            document.getElementById('cxcVencidas').textContent = vencidas;
        } else {
            tabla.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="fas fa-inbox"></i><p>No hay cuentas</p></div></td></tr>`;
            document.getElementById('cxcCuentas').textContent = '0';
            document.getElementById('cxcMonto').textContent = '$0.00';
            document.getElementById('cxcVencidas').textContent = '0';
        }
    } catch (e) {
        console.error('Error:', e);
        tabla.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error al cargar</p></div></td></tr>`;
    }
}

// ============================================
// EXPORTAR
// ============================================

function exportarReporte(tipo) {
    const datos = datosReporte[tipo];
    if (!datos || datos.length === 0) {
        toast('No hay datos para exportar', 'warning');
        return;
    }
    
    const headers = Object.keys(datos[0]);
    let csv = headers.join(',') + '\n';
    datos.forEach(row => {
        csv += headers.map(h => {
            let val = row[h];
            if (val === null || val === undefined) val = '';
            if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
                val = '"' + val.replace(/"/g, '""') + '"';
            }
            return val;
        }).join(',') + '\n';
    });
    
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reporte_${tipo}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    toast('Reporte exportado', 'success');
}

function imprimirReporte() {
    window.print();
}

function imprimirCorte() {
    const content = document.getElementById('detalleCorteContent').innerHTML;
    const win = window.open('', '_blank');
    win.document.write(`
        <html>
        <head>
            <title>Corte de Caja</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                .detalle-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px; }
                .detalle-item { margin-bottom: 8px; }
                .detalle-item label { font-size: 12px; color: #666; display: block; }
                .detalle-item span { font-weight: bold; }
                .detalle-totales { background: #f5f5f5; padding: 15px; border-radius: 8px; margin-top: 15px; }
                .detalle-totales h4 { margin: 0 0 10px 0; }
                .total-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #ddd; }
                .total-row:last-child { border-bottom: none; font-weight: bold; }
                .badge { padding: 3px 8px; border-radius: 12px; font-size: 11px; }
                .badge-success { background: #d1fae5; color: #047857; }
                .badge-info { background: #dbeafe; color: #1d4ed8; }
                .badge-danger { background: #fee2e2; color: #b91c1c; }
                .positivo { color: #047857; }
                .negativo { color: #b91c1c; }
            </style>
        </head>
        <body>${content}</body>
        </html>
    `);
    win.document.close();
    setTimeout(() => win.print(), 250);
}

// ============================================
// UTILIDADES
// ============================================

function formatMoney(num) {
    const n = parseFloat(num) || 0;
    return '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatFecha(fecha) {
    if (!fecha) return '-';
    const d = new Date(fecha);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function abrirModal(id) {
    document.getElementById(id).classList.add('active');
}

function cerrarModal(id) {
    document.getElementById(id).classList.remove('active');
}

function toast(msg, tipo = 'success') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = `toast show ${tipo}`;
    setTimeout(() => t.classList.remove('show'), 3000);
}

// Estilos adicionales
document.head.insertAdjacentHTML('beforeend', `
<style>
.text-success { color: #10b981; }
.text-danger { color: #ef4444; }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; color: #9ca3af; }
.empty-state i { font-size: 48px; margin-bottom: 12px; }
.empty-state p { margin: 0; font-size: 14px; }
</style>
`);
