/* ============================================
   REPORTES.JS - CAFI POS
   ============================================ */

let datosReporte = {};
const sucursalId = localStorage.getItem('sucursal_id') || 1;

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
    document.getElementById('userSucursal').textContent = sucursal.nombre || 'Sucursal';
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
        const r = await API.get(`/categorias?sucursal_id=${sucursalId}`);
        if (r.success) {
            const sel = document.getElementById('productosCategoria');
            r.categorias.forEach(c => {
                sel.innerHTML += `<option value="${c.categoria_id}">${c.nombre}</option>`;
            });
        }
    } catch (e) { console.error(e); }
}

async function cargarUsuarios() {
    try {
        const r = await API.get(`/usuarios?sucursal_id=${sucursalId}`);
        if (r.success) {
            const sel = document.getElementById('cortesUsuario');
            r.usuarios.forEach(u => {
                sel.innerHTML += `<option value="${u.usuario_id}">${u.nombre}</option>`;
            });
        }
    } catch (e) { console.error(e); }
}

async function cargarMetodosPago() {
    try {
        const r = await API.get(`/metodos-pago?sucursal_id=${sucursalId}`);
        if (r.success) {
            const sel = document.getElementById('pagosMetodo');
            r.metodos.forEach(m => {
                sel.innerHTML += `<option value="${m.metodo_id}">${m.nombre}</option>`;
            });
        }
    } catch (e) { console.error(e); }
}

async function cargarClientesSelect() {
    try {
        const r = await API.get(`/clientes?sucursal_id=${sucursalId}`);
        if (r.success) {
            const sel = document.getElementById('cxcCliente');
            r.clientes.forEach(c => {
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
        const r = await API.get(`/reportes/ventas-periodo?sucursal_id=${sucursalId}&desde=${desde}&hasta=${hasta}&agrupar=${agrupar}`);
        
        if (r.success && r.datos.length > 0) {
            datosReporte['ventas-periodo'] = r.datos;
            let totalVentas = 0, totalMonto = 0, totalProductos = 0;
            
            tabla.innerHTML = r.datos.map(d => {
                totalVentas += d.ventas;
                totalMonto += d.total;
                totalProductos += d.productos;
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
            tabla.innerHTML = `<tr><td colspan="6" class="empty-state"><i class="fas fa-inbox"></i><p>No hay datos para mostrar</p></td></tr>`;
            limpiarStats('ventas');
        }
    } catch (e) {
        tabla.innerHTML = `<tr><td colspan="6" class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error al cargar datos</p></td></tr>`;
    }
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
        const r = await API.get(`/reportes/ventas-usuario?sucursal_id=${sucursalId}&desde=${desde}&hasta=${hasta}`);
        
        if (r.success && r.datos.length > 0) {
            datosReporte['ventas-usuario'] = r.datos;
            const totalGeneral = r.datos.reduce((s, d) => s + d.total, 0);
            
            tabla.innerHTML = r.datos.map(d => {
                const porcentaje = ((d.total / totalGeneral) * 100).toFixed(1);
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
            tabla.innerHTML = `<tr><td colspan="6" class="empty-state"><i class="fas fa-inbox"></i><p>No hay datos</p></td></tr>`;
        }
    } catch (e) {
        tabla.innerHTML = `<tr><td colspan="6" class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error al cargar</p></td></tr>`;
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
        let url = `/reportes/productos-vendidos?sucursal_id=${sucursalId}&desde=${desde}&hasta=${hasta}&orden=${orden}`;
        if (categoria) url += `&categoria_id=${categoria}`;
        
        const r = await API.get(url);
        
        if (r.success && r.datos.length > 0) {
            datosReporte['productos-vendidos'] = r.datos;
            
            tabla.innerHTML = r.datos.map(d => {
                const utilidad = d.total - d.costo;
                return `<tr>
                    <td><code>${d.codigo}</code></td>
                    <td><strong>${d.producto}</strong></td>
                    <td>${d.categoria}</td>
                    <td class="text-center">${d.cantidad}</td>
                    <td class="text-right">${formatMoney(d.total)}</td>
                    <td class="text-right">${formatMoney(d.costo)}</td>
                    <td class="text-right"><span class="badge ${utilidad >= 0 ? 'badge-success' : 'badge-danger'}">${formatMoney(utilidad)}</span></td>
                </tr>`;
            }).join('');
        } else {
            tabla.innerHTML = `<tr><td colspan="7" class="empty-state"><i class="fas fa-inbox"></i><p>No hay datos</p></td></tr>`;
        }
    } catch (e) {
        tabla.innerHTML = `<tr><td colspan="7" class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error al cargar</p></td></tr>`;
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
        let url = `/reportes/cortes?sucursal_id=${sucursalId}&desde=${desde}&hasta=${hasta}`;
        if (usuario) url += `&usuario_id=${usuario}`;
        
        const r = await API.get(url);
        
        if (r.success && r.cortes.length > 0) {
            let datos = r.cortes;
            if (estado) datos = datos.filter(c => getEstadoCorte(c.total_declarado - c.total_esperado) === estado);
            
            datosReporte['cortes'] = datos;
            
            let correctos = 0, sobrantes = 0, faltantes = 0;
            
            tabla.innerHTML = datos.map(c => {
                const diff = c.total_declarado - c.total_esperado;
                const est = getEstadoCorte(diff);
                if (est === 'CORRECTO') correctos++;
                else if (est === 'SOBRANTE') sobrantes++;
                else faltantes++;
                
                return `<tr>
                    <td><strong>${c.folio}</strong></td>
                    <td>${formatFecha(c.fecha_cierre)}</td>
                    <td>${c.usuario_nombre}</td>
                    <td>${c.turno_folio || '-'}</td>
                    <td class="text-right">${formatMoney(c.total_esperado)}</td>
                    <td class="text-right">${formatMoney(c.total_declarado)}</td>
                    <td class="text-right"><span class="${diff >= 0 ? 'text-success' : 'text-danger'}">${formatMoney(diff)}</span></td>
                    <td>${getBadgeEstadoCorte(est)}</td>
                    <td><button class="btn-ver" onclick="verDetalleCorte(${c.corte_id})"><i class="fas fa-eye"></i></button></td>
                </tr>`;
            }).join('');
            
            document.getElementById('cortesTotal').textContent = datos.length;
            document.getElementById('cortesCorrectos').textContent = correctos;
            document.getElementById('cortesSobrantes').textContent = sobrantes;
            document.getElementById('cortesFaltantes').textContent = faltantes;
        } else {
            tabla.innerHTML = `<tr><td colspan="9" class="empty-state"><i class="fas fa-inbox"></i><p>No hay cortes</p></td></tr>`;
            limpiarStatsCortes();
        }
    } catch (e) {
        tabla.innerHTML = `<tr><td colspan="9" class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error al cargar</p></td></tr>`;
    }
}

function getEstadoCorte(diff) {
    if (diff === 0) return 'CORRECTO';
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
            const diff = c.total_declarado - c.total_esperado;
            const estado = getEstadoCorte(diff);
            
            document.getElementById('detalleCorteContent').innerHTML = `
                <div class="detalle-grid">
                    <div class="detalle-item"><label>Folio</label><span>${c.folio}</span></div>
                    <div class="detalle-item"><label>Fecha</label><span>${formatFecha(c.fecha_cierre)}</span></div>
                    <div class="detalle-item"><label>Usuario</label><span>${c.usuario_nombre}</span></div>
                    <div class="detalle-item"><label>Turno</label><span>${c.turno_folio || '-'}</span></div>
                    <div class="detalle-item"><label>Estado</label><span>${getBadgeEstadoCorte(estado)}</span></div>
                </div>
                <div class="detalle-totales">
                    <h4>Resumen</h4>
                    <div class="total-row"><span>Total Esperado</span><span>${formatMoney(c.total_esperado)}</span></div>
                    <div class="total-row"><span>Total Declarado</span><span>${formatMoney(c.total_declarado)}</span></div>
                    <div class="total-row diferencia ${diff >= 0 ? 'positivo' : 'negativo'}"><span>Diferencia</span><span>${formatMoney(diff)}</span></div>
                </div>
                ${c.observaciones ? `<div style="margin-top:16px;padding:12px;background:#fef3c7;border-radius:8px;"><strong>Observaciones:</strong> ${c.observaciones}</div>` : ''}
            `;
            abrirModal('modalDetalleCorte');
        }
    } catch (e) { toast('Error al cargar detalle', 'error'); }
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
        let url = `/reportes/pagos?sucursal_id=${sucursalId}&desde=${desde}&hasta=${hasta}`;
        if (metodo) url += `&metodo_id=${metodo}`;
        if (estado) url += `&estado=${estado}`;
        
        const r = await API.get(url);
        
        if (r.success && r.pagos.length > 0) {
            datosReporte['pagos'] = r.pagos;
            
            let efectivo = 0, tarjeta = 0, transferencia = 0, otros = 0;
            
            tabla.innerHTML = r.pagos.map(p => {
                if (p.estado !== 'CANCELADO') {
                    const m = p.metodo_nombre.toLowerCase();
                    if (m.includes('efectivo')) efectivo += p.monto;
                    else if (m.includes('tarjeta')) tarjeta += p.monto;
                    else if (m.includes('transfer')) transferencia += p.monto;
                    else otros += p.monto;
                }
                
                return `<tr>
                    <td><strong>${p.folio}</strong></td>
                    <td>${formatFecha(p.fecha)}</td>
                    <td>${p.venta_folio || '-'}</td>
                    <td>${p.cliente_nombre || 'Público General'}</td>
                    <td><i class="${getIconoMetodo(p.metodo_nombre)}"></i> ${p.metodo_nombre}</td>
                    <td class="text-right"><strong>${formatMoney(p.monto)}</strong></td>
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
            tabla.innerHTML = `<tr><td colspan="9" class="empty-state"><i class="fas fa-inbox"></i><p>No hay pagos</p></td></tr>`;
            limpiarStatsPagos();
        }
    } catch (e) {
        tabla.innerHTML = `<tr><td colspan="9" class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error al cargar</p></td></tr>`;
    }
}

function getIconoMetodo(nombre) {
    const n = nombre.toLowerCase();
    if (n.includes('efectivo')) return 'fas fa-money-bill-wave';
    if (n.includes('tarjeta')) return 'fas fa-credit-card';
    if (n.includes('transfer')) return 'fas fa-exchange-alt';
    return 'fas fa-coins';
}

function getBadgeEstado(estado) {
    const clase = estado === 'APLICADO' ? 'success' : 'danger';
    return `<span class="badge badge-${clase}">${estado}</span>`;
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
        let url = `/reportes/movimientos?sucursal_id=${sucursalId}&desde=${desde}&hasta=${hasta}`;
        if (tipo) url += `&tipo=${tipo}`;
        
        const r = await API.get(url);
        
        if (r.success && r.movimientos.length > 0) {
            datosReporte['movimientos'] = r.movimientos;
            
            let ingresos = 0, egresos = 0;
            
            tabla.innerHTML = r.movimientos.map(m => {
                if (m.tipo === 'INGRESO') ingresos += m.monto;
                else egresos += m.monto;
                
                return `<tr>
                    <td>${formatFecha(m.fecha)}</td>
                    <td>${m.tipo === 'INGRESO' ? '<span class="badge badge-success"><i class="fas fa-arrow-down"></i> INGRESO</span>' : '<span class="badge badge-danger"><i class="fas fa-arrow-up"></i> EGRESO</span>'}</td>
                    <td>${m.concepto}</td>
                    <td class="text-right"><strong class="${m.tipo === 'INGRESO' ? 'text-success' : 'text-danger'}">${formatMoney(m.monto)}</strong></td>
                    <td>${m.usuario_nombre}</td>
                    <td>${m.turno_folio || '-'}</td>
                    <td>${m.observaciones || '-'}</td>
                </tr>`;
            }).join('');
            
            document.getElementById('movsIngresos').textContent = formatMoney(ingresos);
            document.getElementById('movsEgresos').textContent = formatMoney(egresos);
            document.getElementById('movsBalance').textContent = formatMoney(ingresos - egresos);
        } else {
            tabla.innerHTML = `<tr><td colspan="7" class="empty-state"><i class="fas fa-inbox"></i><p>No hay movimientos</p></td></tr>`;
            document.getElementById('movsIngresos').textContent = '$0.00';
            document.getElementById('movsEgresos').textContent = '$0.00';
            document.getElementById('movsBalance').textContent = '$0.00';
        }
    } catch (e) {
        tabla.innerHTML = `<tr><td colspan="7" class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error al cargar</p></td></tr>`;
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
        let url = `/reportes/devoluciones?sucursal_id=${sucursalId}&desde=${desde}&hasta=${hasta}`;
        if (motivo) url += `&motivo=${motivo}`;
        
        const r = await API.get(url);
        
        if (r.success && r.devoluciones.length > 0) {
            datosReporte['devoluciones'] = r.devoluciones;
            
            let total = 0, productos = 0;
            
            tabla.innerHTML = r.devoluciones.map(d => {
                total += d.monto;
                productos += d.cantidad;
                return `<tr>
                    <td><strong>${d.folio}</strong></td>
                    <td>${formatFecha(d.fecha)}</td>
                    <td>${d.venta_folio}</td>
                    <td>${d.cliente_nombre || 'Público General'}</td>
                    <td>${d.producto_nombre}</td>
                    <td class="text-center">${d.cantidad}</td>
                    <td class="text-right">${formatMoney(d.monto)}</td>
                    <td>${getBadgeMotivo(d.motivo)}</td>
                    <td>${d.usuario_nombre}</td>
                </tr>`;
            }).join('');
            
            document.getElementById('devsTotal').textContent = r.devoluciones.length;
            document.getElementById('devsMonto').textContent = formatMoney(total);
            document.getElementById('devsProductos').textContent = productos;
        } else {
            tabla.innerHTML = `<tr><td colspan="9" class="empty-state"><i class="fas fa-inbox"></i><p>No hay devoluciones</p></td></tr>`;
            document.getElementById('devsTotal').textContent = '0';
            document.getElementById('devsMonto').textContent = '$0.00';
            document.getElementById('devsProductos').textContent = '0';
        }
    } catch (e) {
        tabla.innerHTML = `<tr><td colspan="9" class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error al cargar</p></td></tr>`;
    }
}

function getBadgeMotivo(motivo) {
    const clases = { DEFECTUOSO: 'danger', EQUIVOCADO: 'warning', GARANTIA: 'info', OTRO: 'purple' };
    return `<span class="badge badge-${clases[motivo] || 'info'}">${motivo}</span>`;
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
        const r = await API.get(`/reportes/cancelaciones?sucursal_id=${sucursalId}&desde=${desde}&hasta=${hasta}`);
        
        if (r.success && r.cancelaciones.length > 0) {
            datosReporte['cancelaciones'] = r.cancelaciones;
            
            let total = 0;
            
            tabla.innerHTML = r.cancelaciones.map(c => {
                total += c.total;
                return `<tr>
                    <td><strong>${c.folio}</strong></td>
                    <td>${formatFecha(c.fecha_venta)}</td>
                    <td>${formatFecha(c.fecha_cancelacion)}</td>
                    <td>${c.cliente_nombre || 'Público General'}</td>
                    <td class="text-right">${formatMoney(c.total)}</td>
                    <td>${c.motivo || '-'}</td>
                    <td>${c.autorizo || '-'}</td>
                </tr>`;
            }).join('');
            
            document.getElementById('cancTotal').textContent = r.cancelaciones.length;
            document.getElementById('cancMonto').textContent = formatMoney(total);
        } else {
            tabla.innerHTML = `<tr><td colspan="7" class="empty-state"><i class="fas fa-inbox"></i><p>No hay cancelaciones</p></td></tr>`;
            document.getElementById('cancTotal').textContent = '0';
            document.getElementById('cancMonto').textContent = '$0.00';
        }
    } catch (e) {
        tabla.innerHTML = `<tr><td colspan="7" class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error al cargar</p></td></tr>`;
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
        const r = await API.get(`/reportes/clientes-frecuentes?sucursal_id=${sucursalId}&desde=${desde}&hasta=${hasta}&top=${top}`);
        
        if (r.success && r.clientes.length > 0) {
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
            tabla.innerHTML = `<tr><td colspan="7" class="empty-state"><i class="fas fa-inbox"></i><p>No hay datos</p></td></tr>`;
        }
    } catch (e) {
        tabla.innerHTML = `<tr><td colspan="7" class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error al cargar</p></td></tr>`;
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
        let url = `/reportes/cuentas-cobrar?sucursal_id=${sucursalId}`;
        if (cliente) url += `&cliente_id=${cliente}`;
        
        const r = await API.get(url);
        
        if (r.success && r.cuentas.length > 0) {
            let datos = r.cuentas;
            if (estado === 'PENDIENTE') datos = datos.filter(c => new Date(c.vencimiento) >= new Date());
            if (estado === 'VENCIDO') datos = datos.filter(c => new Date(c.vencimiento) < new Date());
            
            datosReporte['cuentas-cobrar'] = datos;
            
            let totalPendiente = 0, vencidas = 0;
            
            tabla.innerHTML = datos.map(c => {
                const pendiente = c.total - c.pagado;
                totalPendiente += pendiente;
                const vencida = new Date(c.vencimiento) < new Date();
                if (vencida) vencidas++;
                
                return `<tr>
                    <td><strong>${c.folio}</strong></td>
                    <td>${formatFecha(c.fecha)}</td>
                    <td>${c.cliente_nombre}</td>
                    <td class="text-right">${formatMoney(c.total)}</td>
                    <td class="text-right">${formatMoney(c.pagado)}</td>
                    <td class="text-right"><strong>${formatMoney(pendiente)}</strong></td>
                    <td>${formatFecha(c.vencimiento)}</td>
                    <td>${vencida ? '<span class="badge badge-danger">VENCIDO</span>' : '<span class="badge badge-warning">PENDIENTE</span>'}</td>
                </tr>`;
            }).join('');
            
            document.getElementById('cxcCuentas').textContent = datos.length;
            document.getElementById('cxcMonto').textContent = formatMoney(totalPendiente);
            document.getElementById('cxcVencidas').textContent = vencidas;
        } else {
            tabla.innerHTML = `<tr><td colspan="8" class="empty-state"><i class="fas fa-inbox"></i><p>No hay cuentas</p></td></tr>`;
            document.getElementById('cxcCuentas').textContent = '0';
            document.getElementById('cxcMonto').textContent = '$0.00';
            document.getElementById('cxcVencidas').textContent = '0';
        }
    } catch (e) {
        tabla.innerHTML = `<tr><td colspan="8" class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error al cargar</p></td></tr>`;
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
        csv += headers.map(h => `"${row[h] || ''}"`).join(',') + '\n';
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
        <html><head><title>Corte de Caja</title>
        <style>body{font-family:Arial,sans-serif;padding:20px;}</style>
        </head><body>${content}</body></html>
    `);
    win.document.close();
    win.print();
}

// ============================================
// UTILIDADES
// ============================================

function formatMoney(num) {
    return '$' + (num || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatFecha(fecha) {
    if (!fecha) return '-';
    const d = new Date(fecha);
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

function limpiarStats(prefix) {
    document.getElementById(`${prefix}TotalVentas`).textContent = '0';
    document.getElementById(`${prefix}TotalMonto`).textContent = '$0.00';
    document.getElementById(`${prefix}TicketProm`).textContent = '$0.00';
    document.getElementById(`${prefix}Productos`).textContent = '0';
}

function limpiarStatsCortes() {
    document.getElementById('cortesTotal').textContent = '0';
    document.getElementById('cortesCorrectos').textContent = '0';
    document.getElementById('cortesSobrantes').textContent = '0';
    document.getElementById('cortesFaltantes').textContent = '0';
}

function limpiarStatsPagos() {
    document.getElementById('pagosEfectivo').textContent = '$0.00';
    document.getElementById('pagosTarjeta').textContent = '$0.00';
    document.getElementById('pagosTransferencia').textContent = '$0.00';
    document.getElementById('pagosOtros').textContent = '$0.00';
}

// Clases para colores texto
document.head.insertAdjacentHTML('beforeend', `
<style>
.text-success { color: #10b981; }
.text-danger { color: #ef4444; }
</style>
`);
