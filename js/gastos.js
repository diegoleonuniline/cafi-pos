/* ============================================
   GASTOS.JS - CAFI POS
   ============================================ */

const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
const empresaId = usuario.empresa_id || localStorage.getItem('empresa_id') || 1;

// Data
let gastosData = [];
let categoriasGastoData = [];
let conceptosGastoData = [];
let proveedoresData = [];
let sucursalesData = [];
let metodosPagoData = [];
let cuentasData = [];

// Paginación
let paginaActual = 1;
const registrosPorPagina = 20;
let totalPaginas = 1;

// Charts
let chartCategorias = null;
let chartDiario = null;

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
    initUsuario();
    initFechas();
    cargarCatalogos();
    cargarKPIs();
    cargarGastos();
    
    // Checkbox factura
    document.getElementById('gastoTieneFactura')?.addEventListener('change', (e) => {
        document.getElementById('uuidContainer').style.display = e.target.checked ? 'block' : 'none';
    });
});

function initUsuario() {
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    document.getElementById('userName').textContent = usuario.nombre || 'Usuario';
    document.getElementById('userSucursal').textContent = usuario.sucursal_nombre || 'Sucursal';
    document.getElementById('userAvatar').textContent = (usuario.nombre || 'US').substring(0, 2).toUpperCase();
}

function initFechas() {
    const hoy = new Date();
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    
    document.getElementById('filtroDesde').value = formatDate(primerDia);
    document.getElementById('filtroHasta').value = formatDate(hoy);
    document.getElementById('gastoFecha').value = formatDate(hoy);
}

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

function formatMoney(num) {
    return '$' + parseFloat(num || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateDisplay(dateStr) {
    if (!dateStr) return '-';
    // Limpiar el string de fecha
    const cleanDate = dateStr.toString().split('T')[0];
    const [year, month, day] = cleanDate.split('-');
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ==================== CARGAR CATÁLOGOS ====================
async function cargarCatalogos() {
    try {
        const [catRes, provRes, sucRes, metRes, ctaRes] = await Promise.all([
            API.request(`/categorias-gasto/${empresaId}`),
            API.request(`/proveedores/${empresaId}`),
            API.request(`/sucursales/${empresaId}`),
            API.request(`/metodos-pago/${empresaId}`),
            API.request(`/cuentas-bancarias/${empresaId}`)
        ]);
        
        if (catRes.success) {
            categoriasGastoData = catRes.categorias || [];
            llenarSelect('filtroCategoria', categoriasGastoData, 'categoria_gasto_id', 'nombre', true);
            llenarSelect('gastoCategoria', categoriasGastoData, 'categoria_gasto_id', 'nombre');
        }
        
        if (provRes.success) {
            proveedoresData = provRes.proveedores || [];
            llenarSelect('gastoProveedor', proveedoresData.filter(p => p.activo === 'Y'), 'proveedor_id', 'nombre_comercial', true, 'Sin proveedor / Otro');
        }
        
        if (sucRes.success) {
            sucursalesData = sucRes.sucursales || [];
            llenarSelect('gastoSucursal', sucursalesData.filter(s => s.activo === 'Y'), 'sucursal_id', 'nombre', true, 'Todas');
        }
        
        if (metRes.success) {
            metodosPagoData = metRes.metodos || [];
            llenarSelect('gastoMetodoPago', metodosPagoData.filter(m => m.activo === 'Y'), 'metodo_pago_id', 'nombre', true);
        }
        
        if (ctaRes.success) {
            cuentasData = ctaRes.cuentas || [];
            llenarSelect('gastoCuenta', cuentasData.filter(c => c.activa === 'Y'), 'cuenta_id', 'banco', true);
        }
    } catch (e) {
        console.error('Error cargando catálogos:', e);
    }
}

function llenarSelect(id, data, valueField, textField, addEmpty = false, emptyText = 'Seleccionar...') {
    const sel = document.getElementById(id);
    if (!sel) return;
    
    sel.innerHTML = addEmpty ? `<option value="">${emptyText}</option>` : '';
    data.forEach(item => {
        if (item.activo === 'Y' || item.activo === undefined || item.activa === 'Y') {
            sel.innerHTML += `<option value="${item[valueField]}">${item[textField]}</option>`;
        }
    });
}

async function cargarConceptosPorCategoria() {
    const categoriaId = document.getElementById('gastoCategoria').value;
    const selConcepto = document.getElementById('gastoConcepto');
    
    if (!categoriaId) {
        selConcepto.innerHTML = '<option value="">Primero seleccione categoría...</option>';
        return;
    }
    
    selConcepto.innerHTML = '<option value="">Cargando...</option>';
    
    try {
        const r = await API.request(`/conceptos-gasto/${empresaId}`);
        if (r.success) {
            conceptosGastoData = r.conceptos || [];
            const filtrados = conceptosGastoData.filter(c => c.categoria_gasto_id == categoriaId && c.activo === 'Y');
            
            selConcepto.innerHTML = '<option value="">Seleccionar...</option>';
            filtrados.forEach(c => {
                selConcepto.innerHTML += `<option value="${c.concepto_gasto_id}">${c.nombre}</option>`;
            });
        }
    } catch (e) {
        selConcepto.innerHTML = '<option value="">Error al cargar</option>';
    }
}

// ==================== KPIs ====================
async function cargarKPIs() {
    try {
        const r = await API.request(`/gastos/kpis/${empresaId}`);
        if (r.success) {
            document.getElementById('kpiHoy').textContent = formatMoney(r.hoy || 0);
            document.getElementById('kpiSemana').textContent = formatMoney(r.semana || 0);
            document.getElementById('kpiMes').textContent = formatMoney(r.mes || 0);
            document.getElementById('kpiRegistros').textContent = r.registros || 0;
            
            if (r.porCategoria) renderChartCategorias(r.porCategoria);
            if (r.porDia) renderChartDiario(r.porDia);
        }
    } catch (e) {
        console.error('Error cargando KPIs:', e);
    }
}

function renderChartCategorias(data) {
    const ctx = document.getElementById('chartCategorias');
    if (!ctx) return;
    
    if (chartCategorias) chartCategorias.destroy();
    
    const colores = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#6366f1', '#ec4899', '#14b8a6'];
    
    chartCategorias = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.map(d => d.categoria || 'Sin categoría'),
            datasets: [{
                data: data.map(d => d.total),
                backgroundColor: colores.slice(0, data.length),
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { boxWidth: 12, padding: 12, font: { size: 11 } }
                }
            }
        }
    });
}

function renderChartDiario(data) {
    const ctx = document.getElementById('chartDiario');
    if (!ctx) return;
    
    if (chartDiario) chartDiario.destroy();
    
    chartDiario = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d.dia),
            datasets: [{
                label: 'Total',
                data: data.map(d => d.total),
                backgroundColor: 'rgba(45, 61, 191, 0.8)',
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: v => '$' + v.toLocaleString()
                    }
                }
            }
        }
    });
}

// ==================== GASTOS ====================
async function cargarGastos() {
    const tabla = document.getElementById('tablaGastos');
    tabla.innerHTML = `<tr class="loading-row"><td colspan="10"><div class="spinner"></div>Cargando...</td></tr>`;
    
    const desde = document.getElementById('filtroDesde').value;
    const hasta = document.getElementById('filtroHasta').value;
    const categoria = document.getElementById('filtroCategoria').value;
    const estado = document.getElementById('filtroEstado').value;
    
    let url = `/gastos/${empresaId}?desde=${desde}&hasta=${hasta}`;
    if (categoria) url += `&categoria=${categoria}`;
    if (estado) url += `&estado=${estado}`;
    url += `&page=${paginaActual}&limit=${registrosPorPagina}`;
    
    try {
        const r = await API.request(url);
        if (r.success) {
            gastosData = r.gastos || [];
            totalPaginas = Math.ceil((r.total || 0) / registrosPorPagina) || 1;
            
            if (gastosData.length) {
                tabla.innerHTML = gastosData.map(g => `
                    <tr>
                        <td>${formatDateDisplay(g.fecha)}</td>
                        <td>${g.numero_documento || '-'}</td>
                        <td><span class="badge badge-purple">${g.categoria_nombre || '-'}</span></td>
                        <td>${g.concepto_nombre || '-'}</td>
                        <td>${truncate(g.descripcion, 30)}</td>
                        <td>${g.proveedor_nombre || '-'}</td>
                        <td class="right"><strong>${formatMoney(g.total)}</strong></td>
                        <td class="center">${g.tiene_factura === 'Y' ? '<i class="fas fa-check-circle text-success"></i>' : '<i class="fas fa-times-circle text-danger"></i>'}</td>
                        <td class="center"><span class="badge badge-${getEstadoClass(g.estado)}">${g.estado}</span></td>
                        <td class="center">
                            <div class="btn-actions">
                                <button class="btn-view" onclick="verGasto(${g.gasto_id})"><i class="fas fa-eye"></i></button>
                                <button class="btn-edit" onclick="editarGasto(${g.gasto_id})"><i class="fas fa-edit"></i></button>
                                <button class="btn-delete" onclick="eliminarGasto(${g.gasto_id})"><i class="fas fa-trash"></i></button>
                            </div>
                        </td>
                    </tr>
                `).join('');
                
                // Totales
                document.getElementById('totalSubtotal').textContent = formatMoney(r.totales?.subtotal || 0);
                document.getElementById('totalIVA').textContent = formatMoney(r.totales?.iva || 0);
                document.getElementById('totalGeneral').textContent = formatMoney(r.totales?.total || 0);
            } else {
                tabla.innerHTML = `<tr><td colspan="10"><div class="empty-state"><i class="fas fa-receipt"></i><p>No hay gastos en este período</p></div></td></tr>`;
                document.getElementById('totalSubtotal').textContent = '$0.00';
                document.getElementById('totalIVA').textContent = '$0.00';
                document.getElementById('totalGeneral').textContent = '$0.00';
            }
            
            actualizarPaginacion();
        }
    } catch (e) {
        tabla.innerHTML = `<tr><td colspan="10"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error al cargar</p></div></td></tr>`;
    }
}

function getEstadoClass(estado) {
    const clases = { PAGADO: 'success', PENDIENTE: 'warning', CANCELADO: 'danger' };
    return clases[estado] || 'gray';
}

function truncate(str, len) {
    if (!str) return '-';
    return str.length > len ? str.substring(0, len) + '...' : str;
}

function actualizarPaginacion() {
    document.getElementById('paginaInfo').textContent = `${paginaActual} de ${totalPaginas}`;
    document.getElementById('btnPrev').disabled = paginaActual <= 1;
    document.getElementById('btnNext').disabled = paginaActual >= totalPaginas;
}

function cambiarPagina(delta) {
    const nuevaPagina = paginaActual + delta;
    if (nuevaPagina >= 1 && nuevaPagina <= totalPaginas) {
        paginaActual = nuevaPagina;
        cargarGastos();
    }
}

function limpiarFiltros() {
    initFechas();
    document.getElementById('filtroCategoria').value = '';
    document.getElementById('filtroEstado').value = '';
    paginaActual = 1;
    cargarGastos();
}

// ==================== MODAL GASTO ====================
function abrirModalGasto() {
    document.getElementById('formGasto').reset();
    document.getElementById('gastoId').value = '';
    document.getElementById('modalGastoTitulo').textContent = 'Nuevo Gasto';
    document.getElementById('gastoFecha').value = formatDate(new Date());
    document.getElementById('gastoConcepto').innerHTML = '<option value="">Primero seleccione categoría...</option>';
    document.getElementById('uuidContainer').style.display = 'none';
    document.getElementById('gastoTotal').value = '';
    abrirModal('modalGasto');
}

async function editarGasto(id) {
    const g = gastosData.find(x => x.gasto_id == id);
    if (!g) return;
    
    document.getElementById('gastoId').value = g.gasto_id;
    document.getElementById('modalGastoTitulo').textContent = 'Editar Gasto';
    document.getElementById('gastoFecha').value = g.fecha?.split('T')[0] || '';
    document.getElementById('gastoDocumento').value = g.numero_documento || '';
    document.getElementById('gastoSucursal').value = g.sucursal_id || '';
    document.getElementById('gastoCategoria').value = g.categoria_gasto_id || '';
    
    // Cargar conceptos y seleccionar
    await cargarConceptosPorCategoria();
    document.getElementById('gastoConcepto').value = g.concepto_gasto_id || '';
    
    document.getElementById('gastoDescripcion').value = g.descripcion || '';
    document.getElementById('gastoProveedor').value = g.proveedor_id || '';
    document.getElementById('gastoProveedorNombre').value = g.proveedor_nombre || '';
    document.getElementById('gastoSubtotal').value = g.subtotal || 0;
    document.getElementById('gastoIVA').value = g.iva || 0;
    document.getElementById('gastoTotal').value = g.total || 0;
    document.getElementById('gastoISR').value = g.isr_retenido || 0;
    document.getElementById('gastoIVARet').value = g.iva_retenido || 0;
    document.getElementById('gastoMetodoPago').value = g.metodo_pago_id || '';
    document.getElementById('gastoCuenta').value = g.cuenta_bancaria_id || '';
    document.getElementById('gastoReferencia').value = g.referencia_pago || '';
    document.getElementById('gastoEstado').value = g.estado || 'PAGADO';
    document.getElementById('gastoTieneFactura').checked = g.tiene_factura === 'Y';
    document.getElementById('uuidContainer').style.display = g.tiene_factura === 'Y' ? 'block' : 'none';
    document.getElementById('gastoUUID').value = g.uuid_factura || '';
    
    abrirModal('modalGasto');
}

async function guardarGasto(ev) {
    ev.preventDefault();
    
    const id = document.getElementById('gastoId').value;
    const proveedorId = document.getElementById('gastoProveedor').value;
    const proveedorNombre = document.getElementById('gastoProveedorNombre').value || 
        (proveedorId ? proveedoresData.find(p => p.proveedor_id == proveedorId)?.nombre_comercial : '');
    
    const data = {
        empresa_id: empresaId,
        sucursal_id: document.getElementById('gastoSucursal').value || null,
        categoria_gasto_id: document.getElementById('gastoCategoria').value || null,
        concepto_gasto_id: document.getElementById('gastoConcepto').value || null,
        fecha: document.getElementById('gastoFecha').value,
        numero_documento: document.getElementById('gastoDocumento').value,
        descripcion: document.getElementById('gastoDescripcion').value,
        proveedor_id: proveedorId || null,
        proveedor_nombre: proveedorNombre,
        subtotal: parseFloat(document.getElementById('gastoSubtotal').value) || 0,
        iva: parseFloat(document.getElementById('gastoIVA').value) || 0,
        isr_retenido: parseFloat(document.getElementById('gastoISR').value) || 0,
        iva_retenido: parseFloat(document.getElementById('gastoIVARet').value) || 0,
        total: parseFloat(document.getElementById('gastoTotal').value) || 0,
        metodo_pago_id: document.getElementById('gastoMetodoPago').value || null,
        cuenta_bancaria_id: document.getElementById('gastoCuenta').value || null,
        referencia_pago: document.getElementById('gastoReferencia').value,
        tiene_factura: document.getElementById('gastoTieneFactura').checked ? 'Y' : 'N',
        uuid_factura: document.getElementById('gastoUUID').value,
        estado: document.getElementById('gastoEstado').value
    };
    
    try {
        const r = await API.request(id ? `/gastos/${id}` : '/gastos', id ? 'PUT' : 'POST', data);
        if (r.success) {
            toast(id ? 'Gasto actualizado' : 'Gasto registrado', 'success');
            cerrarModal('modalGasto');
            cargarGastos();
            cargarKPIs();
        } else {
            toast(r.error || 'Error al guardar', 'error');
        }
    } catch (e) {
        toast('Error: ' + e.message, 'error');
    }
}

async function eliminarGasto(id) {
    if (!confirm('¿Eliminar este gasto?')) return;
    
    try {
        const r = await API.request(`/gastos/${id}`, 'DELETE');
        if (r.success) {
            toast('Gasto eliminado', 'success');
            cargarGastos();
            cargarKPIs();
        } else {
            toast(r.error || 'Error', 'error');
        }
    } catch (e) {
        toast('Error', 'error');
    }
}

// ==================== VER DETALLE ====================
function verGasto(id) {
    const g = gastosData.find(x => x.gasto_id == id);
    if (!g) return;
    
    document.getElementById('detalleGastoContent').innerHTML = `
        <div class="detalle-grid">
            <div class="detalle-item">
                <label>Fecha</label>
                <span>${formatDateDisplay(g.fecha)}</span>
            </div>
            <div class="detalle-item">
                <label>Documento</label>
                <span>${g.numero_documento || '-'}</span>
            </div>
            <div class="detalle-item">
                <label>Categoría</label>
                <span>${g.categoria_nombre || '-'}</span>
            </div>
            <div class="detalle-item">
                <label>Concepto</label>
                <span>${g.concepto_nombre || '-'}</span>
            </div>
            <div class="detalle-item full">
                <label>Descripción</label>
                <span>${g.descripcion || '-'}</span>
            </div>
            <div class="detalle-item full">
                <label>Proveedor</label>
                <span>${g.proveedor_nombre || '-'}</span>
            </div>
            <div class="detalle-item">
                <label>Subtotal</label>
                <span>${formatMoney(g.subtotal)}</span>
            </div>
            <div class="detalle-item">
                <label>IVA</label>
                <span>${formatMoney(g.iva)}</span>
            </div>
            <div class="detalle-item">
                <label>ISR Retenido</label>
                <span>${formatMoney(g.isr_retenido)}</span>
            </div>
            <div class="detalle-item">
                <label>IVA Retenido</label>
                <span>${formatMoney(g.iva_retenido)}</span>
            </div>
            <div class="detalle-item total full">
                <label>Total</label>
                <span>${formatMoney(g.total)}</span>
            </div>
            <div class="detalle-item">
                <label>Método de Pago</label>
                <span>${g.metodo_pago_nombre || '-'}</span>
            </div>
            <div class="detalle-item">
                <label>Estado</label>
                <span class="badge badge-${getEstadoClass(g.estado)}">${g.estado}</span>
            </div>
            <div class="detalle-item">
                <label>Tiene Factura</label>
                <span>${g.tiene_factura === 'Y' ? 'Sí' : 'No'}</span>
            </div>
            <div class="detalle-item">
                <label>UUID</label>
                <span style="font-size:11px;word-break:break-all;">${g.uuid_factura || '-'}</span>
            </div>
        </div>
    `;
    
    abrirModal('modalDetalle');
}

function imprimirGasto() {
    window.print();
}

// ==================== CÁLCULOS ====================
function calcularTotal() {
    const subtotal = parseFloat(document.getElementById('gastoSubtotal').value) || 0;
    const iva = parseFloat(document.getElementById('gastoIVA').value) || 0;
    document.getElementById('gastoTotal').value = (subtotal + iva).toFixed(2);
}

function calcularIVA16() {
    const subtotal = parseFloat(document.getElementById('gastoSubtotal').value) || 0;
    const iva = subtotal * 0.16;
    document.getElementById('gastoIVA').value = iva.toFixed(2);
    calcularTotal();
}

function seleccionarProveedor() {
    const provId = document.getElementById('gastoProveedor').value;
    if (provId) {
        const prov = proveedoresData.find(p => p.proveedor_id == provId);
        if (prov) {
            document.getElementById('gastoProveedorNombre').value = prov.nombre_comercial || prov.razon_social;
        }
    } else {
        document.getElementById('gastoProveedorNombre').value = '';
    }
}

// ==================== EXPORTAR ====================
function exportarExcel() {
    const desde = document.getElementById('filtroDesde').value;
    const hasta = document.getElementById('filtroHasta').value;
    window.open(`${API.baseUrl}/gastos/exportar/${empresaId}?desde=${desde}&hasta=${hasta}`, '_blank');
}

// ==================== UTILS ====================
function abrirModal(id) {
    document.getElementById(id)?.classList.add('active');
}

function cerrarModal(id) {
    document.getElementById(id)?.classList.remove('active');
}

function toast(msg, tipo = 'success') {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = `toast show ${tipo}`;
    setTimeout(() => t.classList.remove('show'), 3000);
}

// ==================== MINI MODALES ====================

function abrirMiniModal(tipo) {
    if (tipo === 'categoria') {
        document.getElementById('miniCategoriaNombre').value = '';
        document.getElementById('miniCategoriaTipo').value = 'OPERATIVO';
        abrirModal('modalMiniCategoria');
        setTimeout(() => document.getElementById('miniCategoriaNombre').focus(), 100);
    } else if (tipo === 'concepto') {
        // Cargar categorías en el select del mini modal
        const selCat = document.getElementById('miniConceptoCategoria');
        selCat.innerHTML = '<option value="">Seleccionar...</option>';
        categoriasGastoData.forEach(c => {
            selCat.innerHTML += `<option value="${c.categoria_gasto_id}">${c.nombre}</option>`;
        });
        // Pre-seleccionar la categoría actual si hay una
        const catActual = document.getElementById('gastoCategoria').value;
        if (catActual) selCat.value = catActual;
        
        document.getElementById('miniConceptoNombre').value = '';
        abrirModal('modalMiniConcepto');
        setTimeout(() => document.getElementById('miniConceptoNombre').focus(), 100);
    } else if (tipo === 'proveedor') {
        document.getElementById('miniProveedorNombre').value = '';
        document.getElementById('miniProveedorRFC').value = '';
        document.getElementById('miniProveedorTelefono').value = '';
        abrirModal('modalMiniProveedor');
        setTimeout(() => document.getElementById('miniProveedorNombre').focus(), 100);
    }
}

function cerrarMiniModal(tipo) {
    if (tipo === 'categoria') cerrarModal('modalMiniCategoria');
    else if (tipo === 'concepto') cerrarModal('modalMiniConcepto');
    else if (tipo === 'proveedor') cerrarModal('modalMiniProveedor');
}

async function guardarMiniCategoria() {
    const nombre = document.getElementById('miniCategoriaNombre').value.trim();
    const tipo = document.getElementById('miniCategoriaTipo').value;
    
    if (!nombre) {
        toast('Ingresa el nombre de la categoría', 'error');
        return;
    }
    
    try {
        const res = await API.request('/categorias-gasto', {
            method: 'POST',
            body: JSON.stringify({
                empresa_id: empresaId,
                nombre: nombre,
                tipo: tipo
            })
        });
        
        if (res.success) {
            toast('Categoría creada');
            cerrarMiniModal('categoria');
            
            // Recargar categorías y seleccionar la nueva
            await cargarCatalogos();
            document.getElementById('gastoCategoria').value = res.categoria_gasto_id || res.id;
            cargarConceptosPorCategoria();
        } else {
            toast(res.error || 'Error al crear', 'error');
        }
    } catch (e) {
        toast('Error: ' + e.message, 'error');
    }
}

async function guardarMiniConcepto() {
    const categoriaId = document.getElementById('miniConceptoCategoria').value;
    const nombre = document.getElementById('miniConceptoNombre').value.trim();
    
    if (!categoriaId) {
        toast('Selecciona una categoría', 'error');
        return;
    }
    if (!nombre) {
        toast('Ingresa el nombre del concepto', 'error');
        return;
    }
    
    try {
        const res = await API.request('/conceptos-gasto', {
            method: 'POST',
            body: JSON.stringify({
                empresa_id: empresaId,
                categoria_gasto_id: categoriaId,
                nombre: nombre
            })
        });
        
        if (res.success) {
            toast('Concepto creado');
            cerrarMiniModal('concepto');
            
            // Recargar conceptos
            const conRes = await API.request(`/conceptos-gasto/${empresaId}`);
            if (conRes.success) {
                conceptosGastoData = conRes.conceptos || [];
            }
            
            // Seleccionar categoría y cargar sus conceptos
            document.getElementById('gastoCategoria').value = categoriaId;
            cargarConceptosPorCategoria();
            
            // Seleccionar el nuevo concepto
            setTimeout(() => {
                document.getElementById('gastoConcepto').value = res.concepto_gasto_id || res.id;
            }, 100);
        } else {
            toast(res.error || 'Error al crear', 'error');
        }
    } catch (e) {
        toast('Error: ' + e.message, 'error');
    }
}

async function guardarMiniProveedor() {
    const nombre = document.getElementById('miniProveedorNombre').value.trim();
    const rfc = document.getElementById('miniProveedorRFC').value.trim();
    const telefono = document.getElementById('miniProveedorTelefono').value.trim();
    
    if (!nombre) {
        toast('Ingresa el nombre del proveedor', 'error');
        return;
    }
    
    try {
        const res = await API.request('/proveedores', {
            method: 'POST',
            body: JSON.stringify({
                empresa_id: empresaId,
                nombre_comercial: nombre,
                razon_social: nombre,
                rfc: rfc || null,
                telefono: telefono || null
            })
        });
        
        if (res.success) {
            toast('Proveedor creado');
            cerrarMiniModal('proveedor');
            
            // Recargar proveedores y seleccionar el nuevo
            const provRes = await API.request(`/proveedores/${empresaId}`);
            if (provRes.success) {
                proveedoresData = provRes.proveedores || [];
                
                // Actualizar select
                const sel = document.getElementById('gastoProveedor');
                sel.innerHTML = '<option value="">Sin proveedor</option>';
                proveedoresData.forEach(p => {
                    sel.innerHTML += `<option value="${p.proveedor_id}">${p.nombre_comercial || p.razon_social}</option>`;
                });
                
                // Seleccionar el nuevo
                sel.value = res.proveedor_id || res.id;
                seleccionarProveedor();
            }
        } else {
            toast(res.error || 'Error al crear', 'error');
        }
    } catch (e) {
        toast('Error: ' + e.message, 'error');
    }
}
