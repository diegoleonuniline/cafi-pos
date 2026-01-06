/* ============================================
   REPORTES.JS - CAFI POS
   ============================================ */

let datosReporte = {};
const empresaId = localStorage.getItem('empresa_id') || (JSON.parse(localStorage.getItem('usuario') || '{}')).empresa_id || 1;

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
    document.getElementById('userName').textContent = usuario.nombre || 'Usuario';
    document.getElementById('userSucursal').textContent = usuario.sucursal_nombre || 'Sucursal';
    document.getElementById('userAvatar').textContent = (usuario.nombre || 'US').substring(0, 2).toUpperCase();
}

function initFechas() {
    const hoy = new Date();
    const hace30 = new Date();
    hace30.setDate(hace30.getDate() - 30);
    document.querySelectorAll('input[type="date"]').forEach(input => {
        if (input.id.includes('Desde')) input.value = hace30.toISOString().split('T')[0];
        if (input.id.includes('Hasta')) input.value = hoy.toISOString().split('T')[0];
    });
}

function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const reporte = btn.dataset.reporte;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.reporte-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`panel-${reporte}`).classList.add('active');
            cargarReporteActivo(reporte);
        });
    });
}

function cargarReporteActivo(reporte) {
    const fn = {
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
    if (fn[reporte]) fn[reporte]();
}

// CARGAR SELECTS
async function cargarCategorias() {
    try {
        const r = await API.request(`/categorias/${empresaId}`);
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
        const r = await API.request(`/usuarios/${empresaId}`);
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
        const r = await API.request(`/metodos-pago/${empresaId}`);
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
        const r = await API.request(`/clientes/${empresaId}`);
        if (r.success) {
            const sel = document.getElementById('cxcCliente');
            (r.clientes || r.data || []).forEach(c => {
                sel.innerHTML += `<option value="${c.cliente_id}">${c.nombre}</option>`;
            });
        }
    } catch (e) { console.error(e); }
}

// VENTAS POR PERÍODO
async function cargarVentasPeriodo() {
    const desde = document.getElementById('ventasFechaDesde').value;
    const hasta = document.getElementById('ventasFechaHasta').value;
    const agrupar = document.getElementById('ventasAgrupar').value;
    const tabla = document.getElementById('tablaVentasPeriodo');
    tabla.innerHTML = `<tr class="loading-row"><td colspan="6"><div class="spinner"></div>Cargando...</td></tr>`;
    
    try {
        const r = await API.request(`/reportes/ventas-periodo?empresa_id=${empresaId}&desde=${desde}&hasta=${hasta}&agrupar=${agrupar}`);
        if (r.success && r.datos?.length) {
            datosReporte['ventas-periodo'] = r.datos;
            let totalV = 0, totalM = 0, totalP = 0;
            tabla.innerHTML = r.datos.map(d => {
                totalV += +d.ventas || 0;
                totalM += +d.total || 0;
                totalP += +d.productos || 0;
                return `<tr><td><strong>${d.periodo}</strong></td><td class="text-center">${d.ventas}</td><td class="text-right">${formatMoney(d.subtotal)}</td><td class="text-right">${formatMoney(d.impuestos)}</td><td class="text-right"><strong>${formatMoney(d.total)}</strong></td><td class="text-center">${d.productos}</td></tr>`;
            }).join('') + `<tr class="row-total"><td>TOTAL</td><td class="text-center">${totalV}</td><td class="text-right">-</td><td class="text-right">-</td><td class="text-right">${formatMoney(totalM)}</td><td class="text-center">${totalP}</td></tr>`;
            document.getElementById('ventasTotalVentas').textContent = totalV;
            document.getElementById('ventasTotalMonto').textContent = formatMoney(totalM);
            document.getElementById('ventasTicketProm').textContent = formatMoney(totalM / totalV || 0);
            document.getElementById('ventasProductos').textContent = totalP;
        } else {
            tabla.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-inbox"></i><p>No hay datos</p></div></td></tr>`;
            ['ventasTotalVentas','ventasProductos'].forEach(id => document.getElementById(id).textContent = '0');
            ['ventasTotalMonto','ventasTicketProm'].forEach(id => document.getElementById(id).textContent = '$0.00');
        }
    } catch (e) {
        console.error(e);
        tabla.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error al cargar</p></div></td></tr>`;
    }
}

// VENTAS POR USUARIO
async function cargarVentasUsuario() {
    const desde = document.getElementById('usuarioFechaDesde').value;
    const hasta = document.getElementById('usuarioFechaHasta').value;
    const tabla = document.getElementById('tablaVentasUsuario');
    tabla.innerHTML = `<tr class="loading-row"><td colspan="6"><div class="spinner"></div>Cargando...</td></tr>`;
    
    try {
        const r = await API.request(`/reportes/ventas-usuario?empresa_id=${empresaId}&desde=${desde}&hasta=${hasta}`);
        if (r.success && r.datos?.length) {
            datosReporte['ventas-usuario'] = r.datos;
            const totalG = r.datos.reduce((s, d) => s + (+d.total || 0), 0);
            tabla.innerHTML = r.datos.map(d => {
                const pct = totalG > 0 ? ((+d.total / totalG) * 100).toFixed(1) : 0;
                return `<tr><td><strong>${d.usuario}</strong></td><td class="text-center">${d.ventas}</td><td class="text-right">${formatMoney(d.total)}</td><td class="text-right">${formatMoney(d.promedio)}</td><td class="text-center">${d.productos}</td><td class="text-center"><span class="badge badge-info">${pct}%</span></td></tr>`;
            }).join('');
        } else {
            tabla.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-inbox"></i><p>No hay datos</p></div></td></tr>`;
        }
    } catch (e) { tabla.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error</p></div></td></tr>`; }
}

// PRODUCTOS VENDIDOS
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
        const r = await API.request(url);
        if (r.success && r.datos?.length) {
            datosReporte['productos-vendidos'] = r.datos;
            tabla.innerHTML = r.datos.map(d => {
                const util = (+d.total || 0) - (+d.costo || 0);
                return `<tr><td><code>${d.codigo || '-'}</code></td><td><strong>${d.producto}</strong></td><td>${d.categoria}</td><td class="text-center">${d.cantidad}</td><td class="text-right">${formatMoney(d.total)}</td><td class="text-right">${formatMoney(d.costo)}</td><td class="text-right"><span class="badge ${util >= 0 ? 'badge-success' : 'badge-danger'}">${formatMoney(util)}</span></td></tr>`;
            }).join('');
        } else {
            tabla.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fas fa-inbox"></i><p>No hay datos</p></div></td></tr>`;
        }
    } catch (e) { tabla.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error</p></div></td></tr>`; }
}

// CORTES DE CAJA
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
        const r = await API.request(url);
        if (r.success && r.cortes?.length) {
            let datos = r.cortes;
            if (estado) datos = datos.filter(c => getEstadoCorte((+c.total_declarado || 0) - (+c.total_esperado || 0)) === estado);
            datosReporte['cortes'] = datos;
            let ok = 0, sob = 0, fal = 0;
            tabla.innerHTML = datos.map(c => {
                const esp = +c.total_esperado || 0, dec = +c.total_declarado || 0, diff = dec - esp;
                const est = getEstadoCorte(diff);
                if (est === 'CORRECTO') ok++; else if (est === 'SOBRANTE') sob++; else fal++;
                return `<tr><td><strong>${c.folio || c.corte_id}</strong></td><td>${formatFecha(c.fecha_cierre)}</td><td>${c.usuario_nombre}</td><td>${c.turno_folio || '-'}</td><td class="text-right">${formatMoney(esp)}</td><td class="text-right">${formatMoney(dec)}</td><td class="text-right"><span class="${diff >= 0 ? 'text-success' : 'text-danger'}">${formatMoney(diff)}</span></td><td>${getBadgeCorte(est)}</td><td><button class="btn-ver" onclick="verDetalleCorte('${c.corte_id}')"><i class="fas fa-eye"></i></button></td></tr>`;
            }).join('');
            document.getElementById('cortesTotal').textContent = datos.length;
            document.getElementById('cortesCorrectos').textContent = ok;
            document.getElementById('cortesSobrantes').textContent = sob;
            document.getElementById('cortesFaltantes').textContent = fal;
        } else {
            tabla.innerHTML = `<tr><td colspan="9"><div class="empty-state"><i class="fas fa-inbox"></i><p>No hay cortes</p></div></td></tr>`;
            ['cortesTotal','cortesCorrectos','cortesSobrantes','cortesFaltantes'].forEach(id => document.getElementById(id).textContent = '0');
        }
    } catch (e) { tabla.innerHTML = `<tr><td colspan="9"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error</p></div></td></tr>`; }
}

function getEstadoCorte(diff) { return Math.abs(diff) < 0.01 ? 'CORRECTO' : diff > 0 ? 'SOBRANTE' : 'FALTANTE'; }
function getBadgeCorte(est) {
    const c = { CORRECTO: 'success', SOBRANTE: 'info', FALTANTE: 'danger' };
    const i = { CORRECTO: 'check', SOBRANTE: 'arrow-up', FALTANTE: 'arrow-down' };
    return `<span class="badge badge-${c[est]}"><i class="fas fa-${i[est]}"></i> ${est}</span>`;
}

async function verDetalleCorte(id) {
    try {
        const r = await API.request(`/cortes/${id}`);
        if (r.success) {
            const c = r.corte, esp = +c.efectivo_esperado || 0, dec = +c.efectivo_declarado || 0, diff = dec - esp;
            document.getElementById('detalleCorteContent').innerHTML = `
                <div class="detalle-grid">
                    <div class="detalle-item"><label>Folio</label><span>${c.turno_id}</span></div>
                    <div class="detalle-item"><label>Fecha</label><span>${formatFecha(c.fecha_cierre)}</span></div>
                    <div class="detalle-item"><label>Usuario</label><span>${c.usuario_nombre}</span></div>
                    <div class="detalle-item"><label>Estado</label><span>${getBadgeCorte(getEstadoCorte(diff))}</span></div>
                </div>
                <div class="detalle-totales">
                    <h4>Resumen de Efectivo</h4>
                    <div class="total-row"><span>Saldo Inicial</span><span>${formatMoney(c.saldo_inicial)}</span></div>
                    <div class="total-row"><span>Ventas Efectivo</span><span>${formatMoney(c.ventas_efectivo)}</span></div>
                    <div class="total-row"><span>Ingresos</span><span>${formatMoney(c.ingresos)}</span></div>
                    <div class="total-row"><span>Egresos</span><span>-${formatMoney(c.egresos)}</span></div>
                    <div class="total-row"><span>Esperado</span><span>${formatMoney(esp)}</span></div>
                    <div class="total-row"><span>Declarado</span><span>${formatMoney(dec)}</span></div>
                    <div class="total-row diferencia ${diff >= 0 ? 'positivo' : 'negativo'}"><span>Diferencia</span><span>${formatMoney(diff)}</span></div>
                </div>`;
            abrirModal('modalDetalleCorte');
        }
    } catch (e) { toast('Error al cargar', 'error'); }
}

// PAGOS
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
        const r = await API.request(url);
        if (r.success && r.pagos?.length) {
            datosReporte['pagos'] = r.pagos;
            let ef = 0, tar = 0, trans = 0, otros = 0;
            tabla.innerHTML = r.pagos.map(p => {
                const m = +p.monto || 0, mn = (p.metodo_nombre || '').toLowerCase();
                if (p.estado !== 'CANCELADO') {
                    if (mn.includes('efectivo')) ef += m;
                    else if (mn.includes('tarjeta')) tar += m;
                    else if (mn.includes('transfer')) trans += m;
                    else otros += m;
                }
                return `<tr><td><strong>${p.folio || p.pago_id}</strong></td><td>${formatFecha(p.fecha)}</td><td>${p.venta_folio || '-'}</td><td>${p.cliente_nombre || 'Público'}</td><td><i class="${getIconMetodo(p.metodo_nombre)}"></i> ${p.metodo_nombre}</td><td class="text-right"><strong>${formatMoney(m)}</strong></td><td>${p.referencia || '-'}</td><td><span class="badge badge-${p.estado === 'APLICADO' ? 'success' : 'danger'}">${p.estado}</span></td><td>${p.usuario_nombre}</td></tr>`;
            }).join('');
            document.getElementById('pagosEfectivo').textContent = formatMoney(ef);
            document.getElementById('pagosTarjeta').textContent = formatMoney(tar);
            document.getElementById('pagosTransferencia').textContent = formatMoney(trans);
            document.getElementById('pagosOtros').textContent = formatMoney(otros);
        } else {
            tabla.innerHTML = `<tr><td colspan="9"><div class="empty-state"><i class="fas fa-inbox"></i><p>No hay pagos</p></div></td></tr>`;
            ['pagosEfectivo','pagosTarjeta','pagosTransferencia','pagosOtros'].forEach(id => document.getElementById(id).textContent = '$0.00');
        }
    } catch (e) { tabla.innerHTML = `<tr><td colspan="9"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error</p></div></td></tr>`; }
}

function getIconMetodo(n) {
    const m = (n || '').toLowerCase();
    if (m.includes('efectivo')) return 'fas fa-money-bill-wave';
    if (m.includes('tarjeta')) return 'fas fa-credit-card';
    if (m.includes('transfer')) return 'fas fa-exchange-alt';
    return 'fas fa-coins';
}

// MOVIMIENTOS
async function cargarMovimientos() {
    const desde = document.getElementById('movsFechaDesde').value;
    const hasta = document.getElementById('movsFechaHasta').value;
    const tipo = document.getElementById('movsTipo').value;
    const tabla = document.getElementById('tablaMovimientos');
    tabla.innerHTML = `<tr class="loading-row"><td colspan="7"><div class="spinner"></div>Cargando...</td></tr>`;
    
    try {
        let url = `/reportes/movimientos?empresa_id=${empresaId}&desde=${desde}&hasta=${hasta}`;
        if (tipo) url += `&tipo=${tipo}`;
        const r = await API.request(url);
        if (r.success && r.movimientos?.length) {
            datosReporte['movimientos'] = r.movimientos;
            let ing = 0, egr = 0;
            tabla.innerHTML = r.movimientos.map(m => {
                const monto = +m.monto || 0;
                if (m.tipo === 'INGRESO') ing += monto; else egr += monto;
                return `<tr><td>${formatFecha(m.fecha)}</td><td><span class="badge badge-${m.tipo === 'INGRESO' ? 'success' : 'danger'}"><i class="fas fa-arrow-${m.tipo === 'INGRESO' ? 'down' : 'up'}"></i> ${m.tipo}</span></td><td>${m.concepto}</td><td class="text-right"><strong class="${m.tipo === 'INGRESO' ? 'text-success' : 'text-danger'}">${formatMoney(monto)}</strong></td><td>${m.usuario_nombre}</td><td>${m.turno_folio || '-'}</td><td>${m.observaciones || '-'}</td></tr>`;
            }).join('');
            document.getElementById('movsIngresos').textContent = formatMoney(ing);
            document.getElementById('movsEgresos').textContent = formatMoney(egr);
            document.getElementById('movsBalance').textContent = formatMoney(ing - egr);
        } else {
            tabla.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fas fa-inbox"></i><p>No hay movimientos</p></div></td></tr>`;
            ['movsIngresos','movsEgresos','movsBalance'].forEach(id => document.getElementById(id).textContent = '$0.00');
        }
    } catch (e) { tabla.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error</p></div></td></tr>`; }
}

// DEVOLUCIONES
async function cargarDevoluciones() {
    const desde = document.getElementById('devsFechaDesde').value;
    const hasta = document.getElementById('devsFechaHasta').value;
    const motivo = document.getElementById('devsMotivo').value;
    const tabla = document.getElementById('tablaDevoluciones');
    tabla.innerHTML = `<tr class="loading-row"><td colspan="9"><div class="spinner"></div>Cargando...</td></tr>`;
    
    try {
        let url = `/reportes/devoluciones?empresa_id=${empresaId}&desde=${desde}&hasta=${hasta}`;
        if (motivo) url += `&motivo=${motivo}`;
        const r = await API.request(url);
        if (r.success && r.devoluciones?.length) {
            datosReporte['devoluciones'] = r.devoluciones;
            let total = 0, prods = 0;
            tabla.innerHTML = r.devoluciones.map(d => {
                const m = +d.monto || 0, c = +d.cantidad || 1;
                total += m; prods += c;
                return `<tr><td><strong>${d.folio || d.devolucion_id}</strong></td><td>${formatFecha(d.fecha)}</td><td>${d.venta_folio || '-'}</td><td>${d.cliente_nombre || 'Público'}</td><td>${d.producto_nombre || '-'}</td><td class="text-center">${c}</td><td class="text-right">${formatMoney(m)}</td><td><span class="badge badge-${d.motivo === 'DEFECTUOSO' ? 'danger' : d.motivo === 'EQUIVOCADO' ? 'warning' : 'info'}">${d.motivo || 'OTRO'}</span></td><td>${d.usuario_nombre}</td></tr>`;
            }).join('');
            document.getElementById('devsTotal').textContent = r.devoluciones.length;
            document.getElementById('devsMonto').textContent = formatMoney(total);
            document.getElementById('devsProductos').textContent = prods;
        } else {
            tabla.innerHTML = `<tr><td colspan="9"><div class="empty-state"><i class="fas fa-inbox"></i><p>No hay devoluciones</p></div></td></tr>`;
            document.getElementById('devsTotal').textContent = '0';
            document.getElementById('devsMonto').textContent = '$0.00';
            document.getElementById('devsProductos').textContent = '0';
        }
    } catch (e) { tabla.innerHTML = `<tr><td colspan="9"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error</p></div></td></tr>`; }
}

// CANCELACIONES
async function cargarCancelaciones() {
    const desde = document.getElementById('cancFechaDesde').value;
    const hasta = document.getElementById('cancFechaHasta').value;
    const tabla = document.getElementById('tablaCancelaciones');
    tabla.innerHTML = `<tr class="loading-row"><td colspan="7"><div class="spinner"></div>Cargando...</td></tr>`;
    
    try {
        const r = await API.request(`/reportes/cancelaciones?empresa_id=${empresaId}&desde=${desde}&hasta=${hasta}`);
        if (r.success && r.cancelaciones?.length) {
            datosReporte['cancelaciones'] = r.cancelaciones;
            let total = 0;
            tabla.innerHTML = r.cancelaciones.map(c => {
                const m = +c.total || 0; total += m;
                return `<tr><td><strong>${c.folio}</strong></td><td>${formatFecha(c.fecha_venta)}</td><td>${formatFecha(c.fecha_cancelacion)}</td><td>${c.cliente_nombre || 'Público'}</td><td class="text-right">${formatMoney(m)}</td><td>${c.motivo || '-'}</td><td>${c.autorizo || '-'}</td></tr>`;
            }).join('');
            document.getElementById('cancTotal').textContent = r.cancelaciones.length;
            document.getElementById('cancMonto').textContent = formatMoney(total);
        } else {
            tabla.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fas fa-inbox"></i><p>No hay cancelaciones</p></div></td></tr>`;
            document.getElementById('cancTotal').textContent = '0';
            document.getElementById('cancMonto').textContent = '$0.00';
        }
    } catch (e) { tabla.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error</p></div></td></tr>`; }
}

// CLIENTES FRECUENTES
async function cargarClientesFrecuentes() {
    const desde = document.getElementById('clientesFechaDesde').value;
    const hasta = document.getElementById('clientesFechaHasta').value;
    const top = document.getElementById('clientesTop').value;
    const tabla = document.getElementById('tablaClientesFrecuentes');
    tabla.innerHTML = `<tr class="loading-row"><td colspan="7"><div class="spinner"></div>Cargando...</td></tr>`;
    
    try {
        const r = await API.request(`/reportes/clientes-frecuentes?empresa_id=${empresaId}&desde=${desde}&hasta=${hasta}&top=${top}`);
        if (r.success && r.clientes?.length) {
            datosReporte['clientes-frecuentes'] = r.clientes;
            tabla.innerHTML = r.clientes.map((c, i) => `<tr><td class="text-center"><span class="badge badge-${i < 3 ? 'warning' : 'info'}">${i + 1}</span></td><td><strong>${c.nombre}</strong></td><td>${c.telefono || '-'}</td><td class="text-center">${c.compras}</td><td class="text-right">${formatMoney(c.total)}</td><td class="text-right">${formatMoney(c.promedio)}</td><td>${formatFecha(c.ultima_compra)}</td></tr>`).join('');
        } else {
            tabla.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fas fa-inbox"></i><p>No hay datos</p></div></td></tr>`;
        }
    } catch (e) { tabla.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error</p></div></td></tr>`; }
}

// CUENTAS POR COBRAR
async function cargarCuentasCobrar() {
    const estado = document.getElementById('cxcEstado').value;
    const cliente = document.getElementById('cxcCliente').value;
    const tabla = document.getElementById('tablaCuentasCobrar');
    tabla.innerHTML = `<tr class="loading-row"><td colspan="8"><div class="spinner"></div>Cargando...</td></tr>`;
    
    try {
        let url = `/reportes/cuentas-cobrar?empresa_id=${empresaId}`;
        if (cliente) url += `&cliente_id=${cliente}`;
        const r = await API.request(url);
        if (r.success && r.cuentas?.length) {
            let datos = r.cuentas;
            const hoy = new Date();
            if (estado === 'PENDIENTE') datos = datos.filter(c => new Date(c.vencimiento) >= hoy);
            if (estado === 'VENCIDO') datos = datos.filter(c => new Date(c.vencimiento) < hoy);
            datosReporte['cuentas-cobrar'] = datos;
            let totalP = 0, venc = 0;
            tabla.innerHTML = datos.map(c => {
                const t = +c.total || 0, p = +c.pagado || 0, pend = t - p;
                totalP += pend;
                const v = new Date(c.vencimiento) < hoy;
                if (v) venc++;
                return `<tr><td><strong>${c.folio}</strong></td><td>${formatFecha(c.fecha)}</td><td>${c.cliente_nombre}</td><td class="text-right">${formatMoney(t)}</td><td class="text-right">${formatMoney(p)}</td><td class="text-right"><strong>${formatMoney(pend)}</strong></td><td>${formatFecha(c.vencimiento)}</td><td><span class="badge badge-${v ? 'danger' : 'warning'}">${v ? 'VENCIDO' : 'PENDIENTE'}</span></td></tr>`;
            }).join('');
            document.getElementById('cxcCuentas').textContent = datos.length;
            document.getElementById('cxcMonto').textContent = formatMoney(totalP);
            document.getElementById('cxcVencidas').textContent = venc;
        } else {
            tabla.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="fas fa-inbox"></i><p>No hay cuentas</p></div></td></tr>`;
            document.getElementById('cxcCuentas').textContent = '0';
            document.getElementById('cxcMonto').textContent = '$0.00';
            document.getElementById('cxcVencidas').textContent = '0';
        }
    } catch (e) { tabla.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error</p></div></td></tr>`; }
}

// EXPORTAR
function exportarReporte(tipo) {
    const datos = datosReporte[tipo];
    if (!datos?.length) { toast('No hay datos', 'warning'); return; }
    const headers = Object.keys(datos[0]);
    let csv = headers.join(',') + '\n';
    datos.forEach(row => {
        csv += headers.map(h => {
            let v = row[h] ?? '';
            if (typeof v === 'string' && (v.includes(',') || v.includes('"'))) v = '"' + v.replace(/"/g, '""') + '"';
            return v;
        }).join(',') + '\n';
    });
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reporte_${tipo}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast('Exportado', 'success');
}

function imprimirReporte() { window.print(); }

function imprimirCorte() {
    const content = document.getElementById('detalleCorteContent').innerHTML;
    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>Corte</title><style>body{font-family:Arial,sans-serif;padding:20px}.detalle-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px}.detalle-item label{font-size:11px;color:#666;display:block}.detalle-item span{font-weight:bold}.detalle-totales{background:#f5f5f5;padding:15px;border-radius:8px}.total-row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #ddd}.diferencia.positivo{color:#22c55e}.diferencia.negativo{color:#ef4444}.badge{padding:2px 8px;border-radius:12px;font-size:11px}</style></head><body>${content}</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 200);
}

// UTILS
function formatMoney(n) { return '$' + (+n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function formatFecha(f) { if (!f) return '-'; const d = new Date(f); return isNaN(d) ? '-' : d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function abrirModal(id) { document.getElementById(id).classList.add('active'); }
function cerrarModal(id) { document.getElementById(id).classList.remove('active'); }
function toast(msg, tipo = 'success') { const t = document.getElementById('toast'); t.textContent = msg; t.className = `toast show ${tipo}`; setTimeout(() => t.classList.remove('show'), 3000); }
