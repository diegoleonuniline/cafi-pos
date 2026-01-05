if (!API.isLoggedIn()) window.location.href = '../index.html';

// Variables globales
window.datos = [];
window.categorias = [];
window.impuestosEmpresa = [];
window.impuestosProducto = [];
window.preciosBase = { precio1: 0, precio2: 0, precio3: 0, precio4: 0 };

document.addEventListener('DOMContentLoaded', async function() {
    cargarUsuario();
    await cargarCategorias();
    await cargarImpuestos();
    await cargarDatos();
    setupTabs();
    setupEventos();
});

function cargarUsuario() {
    var u = API.usuario;
    document.getElementById('userName').textContent = u.nombre;
    document.getElementById('userSucursal').textContent = u.sucursal_nombre || 'Sucursal';
    document.getElementById('userAvatar').textContent = u.nombre.charAt(0).toUpperCase();
}

async function cargarCategorias() {
    try {
        var r = await API.request('/categorias/' + API.usuario.empresa_id);
        if (r.success) {
            window.categorias = r.categorias || r.data || [];
            var selFiltro = document.getElementById('filtroCategoria');
            var selForm = document.getElementById('categoria_id');
            
            selFiltro.innerHTML = '<option value="">Todas</option>';
            selForm.innerHTML = '<option value="">Sin categoría</option>';
            
            window.categorias.forEach(function(c) {
                if (c.activo === 'Y') {
                    selFiltro.innerHTML += '<option value="' + c.categoria_id + '">' + c.nombre + '</option>';
                    selForm.innerHTML += '<option value="' + c.categoria_id + '">' + c.nombre + '</option>';
                }
            });
        }
    } catch (e) { 
        console.error('Error cargando categorías:', e); 
    }
}

async function cargarImpuestos() {
    try {
        var r = await API.request('/impuestos/' + API.usuario.empresa_id);
        if (r.success) {
            window.impuestosEmpresa = r.impuestos || r.data || [];
            console.log('Impuestos cargados:', window.impuestosEmpresa);
        }
    } catch (e) { 
        console.error('Error cargando impuestos:', e); 
    }
}

async function cargarDatos() {
    try {
        var r = await API.request('/productos/' + API.usuario.empresa_id);
        if (r.success) {
            window.datos = r.productos || r.data || [];
            filtrar();
        }
    } catch (e) {
        console.error(e);
        mostrarToast('Error cargando datos', 'error');
    }
}

function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
            document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });
            btn.classList.add('active');
            document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
        });
    });
}

function setupEventos() {
    var precioImp = document.getElementById('precio_incluye_impuesto');
    if (precioImp) {
        precioImp.addEventListener('change', function() {
            convertirPrecios(this.checked);
        });
    }

    ['precio1', 'precio2', 'precio3', 'precio4'].forEach(function(id) {
        var input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', function() {
                var num = id.replace('precio', '');
                var valor = parseFloat(this.value) || 0;
                var factor = getFactorImpuestos();
                var montoFijo = getMontoFijoImpuestos();
                
                if (document.getElementById('precio_incluye_impuesto').checked) {
                    // El usuario escribe precio CON impuesto, calcular base
                    window.preciosBase['precio' + num] = (valor - montoFijo) / factor;
                } else {
                    // El usuario escribe precio SIN impuesto (base)
                    window.preciosBase['precio' + num] = valor;
                }
                
                calcularMargen(parseInt(num));
                calcularImpuestosResumen();
            });
        }
    });

    var imgInput = document.getElementById('imagen_url');
    if (imgInput) {
        imgInput.addEventListener('input', function(e) {
            var preview = document.getElementById('imgPreview');
            if (e.target.value) {
                preview.innerHTML = '<img src="' + e.target.value + '" onerror="this.parentElement.innerHTML=\'<i class=\\\'fas fa-image\\\'></i>\'">';
            } else {
                preview.innerHTML = '<i class="fas fa-image"></i>';
            }
        });
    }

    var colorPos = document.getElementById('color_pos');
    if (colorPos) {
        colorPos.addEventListener('input', function(e) {
            document.getElementById('color_pos_text').value = e.target.value;
        });
    }

    var caducidad = document.getElementById('maneja_caducidad');
    if (caducidad) {
        caducidad.addEventListener('change', function(e) {
            document.getElementById('rowCaducidad').style.display = e.target.checked ? 'flex' : 'none';
        });
    }
}

// ==================== IMPUESTOS EDITABLES ====================

function renderImpuestosForm() {
    var container = document.getElementById('impuestosContainer');
    if (!container) {
        console.error('No se encontró impuestosContainer');
        return;
    }
    
    if (!window.impuestosEmpresa || window.impuestosEmpresa.length === 0) {
        container.innerHTML = '<p class="text-muted">No hay impuestos configurados. <a href="configuracion.html">Crear impuestos</a></p>';
        return;
    }
    
    var html = '<div class="impuestos-list">';
    window.impuestosEmpresa.forEach(function(imp) {
        var productoImp = window.impuestosProducto.find(function(pi) { 
            return pi.impuesto_id === imp.impuesto_id; 
        });
        var isChecked = !!productoImp;
        var valorActual = productoImp ? productoImp.valor : imp.valor;
        var tipoActual = productoImp ? productoImp.tipo : imp.tipo;
        
        html += '<div class="impuesto-row ' + (isChecked ? 'active' : '') + '">' +
            '<label class="impuesto-check">' +
                '<input type="checkbox" name="impuestos" value="' + imp.impuesto_id + '" ' + 
                    'data-valor-default="' + imp.valor + '" data-tipo-default="' + imp.tipo + '" ' +
                    (isChecked ? 'checked' : '') + ' onchange="toggleImpuestoRow(this)">' +
                '<span class="imp-nombre">' + imp.nombre + '</span>' +
            '</label>' +
            '<div class="impuesto-config">' +
                '<select class="imp-tipo" data-id="' + imp.impuesto_id + '" ' + (isChecked ? '' : 'disabled') + ' onchange="recalcularDesdeImpuestos()">' +
                    '<option value="PORCENTAJE" ' + (tipoActual === 'PORCENTAJE' ? 'selected' : '') + '>%</option>' +
                    '<option value="FIJO" ' + (tipoActual === 'FIJO' ? 'selected' : '') + '>$</option>' +
                '</select>' +
                '<input type="number" class="imp-valor" data-id="' + imp.impuesto_id + '" value="' + parseFloat(valorActual || 0) + '" step="0.01" placeholder="Valor" ' + (isChecked ? '' : 'disabled') + ' oninput="recalcularDesdeImpuestos()">' +
            '</div>' +
        '</div>';
    });
    html += '</div>';
    container.innerHTML = html;
}

function toggleImpuestoRow(checkbox) {
    var row = checkbox.closest('.impuesto-row');
    var tipo = row.querySelector('.imp-tipo');
    var valor = row.querySelector('.imp-valor');
    
    if (checkbox.checked) {
        row.classList.add('active');
        tipo.disabled = false;
        valor.disabled = false;
        if (!valor.value || valor.value === '0') {
            valor.value = checkbox.dataset.valorDefault || 0;
        }
    } else {
        row.classList.remove('active');
        tipo.disabled = true;
        valor.disabled = true;
    }
    
    recalcularDesdeImpuestos();
}

function getImpuestosSeleccionados() {
    var impuestos = [];
    document.querySelectorAll('input[name="impuestos"]:checked').forEach(function(cb) {
        var id = cb.value;
        var tipoEl = document.querySelector('.imp-tipo[data-id="' + id + '"]');
        var valorEl = document.querySelector('.imp-valor[data-id="' + id + '"]');
        
        impuestos.push({
            impuesto_id: id,
            tipo: tipoEl ? tipoEl.value : 'PORCENTAJE',
            valor: valorEl ? (parseFloat(valorEl.value) || 0) : 0
        });
    });
    return impuestos;
}

// ==================== FUNCIONES DE IMPUESTOS ====================

function getFactorImpuestos() {
    var total = 0;
    document.querySelectorAll('input[name="impuestos"]:checked').forEach(function(cb) {
        var id = cb.value;
        var tipoEl = document.querySelector('.imp-tipo[data-id="' + id + '"]');
        var valorEl = document.querySelector('.imp-valor[data-id="' + id + '"]');
        var tipo = tipoEl ? tipoEl.value : 'PORCENTAJE';
        var valor = valorEl ? (parseFloat(valorEl.value) || 0) : 0;
        
        if (tipo === 'PORCENTAJE') {
            total += valor;
        }
    });
    return 1 + (total / 100);
}

function getTasaImpuestos() {
    var total = 0;
    document.querySelectorAll('input[name="impuestos"]:checked').forEach(function(cb) {
        var id = cb.value;
        var tipoEl = document.querySelector('.imp-tipo[data-id="' + id + '"]');
        var valorEl = document.querySelector('.imp-valor[data-id="' + id + '"]');
        var tipo = tipoEl ? tipoEl.value : 'PORCENTAJE';
        var valor = valorEl ? (parseFloat(valorEl.value) || 0) : 0;
        
        if (tipo === 'PORCENTAJE') {
            total += valor;
        }
    });
    return total;
}

function getMontoFijoImpuestos() {
    var total = 0;
    document.querySelectorAll('input[name="impuestos"]:checked').forEach(function(cb) {
        var id = cb.value;
        var tipoEl = document.querySelector('.imp-tipo[data-id="' + id + '"]');
        var valorEl = document.querySelector('.imp-valor[data-id="' + id + '"]');
        var tipo = tipoEl ? tipoEl.value : 'PORCENTAJE';
        var valor = valorEl ? (parseFloat(valorEl.value) || 0) : 0;
        
        if (tipo === 'FIJO') {
            total += valor;
        }
    });
    return total;
}

function recalcularDesdeImpuestos() {
    var factor = getFactorImpuestos();
    var montoFijo = getMontoFijoImpuestos();
    var incluyeImpuesto = document.getElementById('precio_incluye_impuesto').checked;
    
    ['precio1', 'precio2', 'precio3', 'precio4'].forEach(function(id) {
        var input = document.getElementById(id);
        var base = window.preciosBase[id] || 0;
        
        if (base > 0) {
            if (incluyeImpuesto) {
                input.value = (base * factor + montoFijo).toFixed(2);
            } else {
                input.value = base.toFixed(2);
            }
        }
    });
    
    calcularMargen(1);
    calcularMargen(2);
    calcularMargen(3);
    calcularMargen(4);
    calcularImpuestosResumen();
}

function convertirPrecios(incluyeImpuesto) {
    var factor = getFactorImpuestos();
    var montoFijo = getMontoFijoImpuestos();
    
    ['precio1', 'precio2', 'precio3', 'precio4'].forEach(function(id) {
        var input = document.getElementById(id);
        var valorActual = parseFloat(input.value) || 0;
        
        if (valorActual > 0) {
            if (incluyeImpuesto) {
                // ANTES: NO incluía (era base) -> AHORA: SÍ incluye (mostrar con imp)
                window.preciosBase[id] = valorActual;
                input.value = (valorActual * factor + montoFijo).toFixed(2);
            } else {
                // ANTES: SÍ incluía (tenía imp) -> AHORA: NO incluye (mostrar base)
                var precioBase = (valorActual - montoFijo) / factor;
                window.preciosBase[id] = precioBase;
                input.value = precioBase.toFixed(2);
            }
        }
    });
    
    calcularMargen(1);
    calcularMargen(2);
    calcularMargen(3);
    calcularMargen(4);
    calcularImpuestosResumen();
}

function calcularMargen(num) {
    var costo = parseFloat(document.getElementById('costo').value) || 0;
    var badge = document.getElementById('margen' + num);
    var precioBase = window.preciosBase['precio' + num] || 0;
    
    if (costo > 0 && precioBase > 0) {
        var margen = ((precioBase - costo) / costo) * 100;
        badge.textContent = 'Margen: ' + margen.toFixed(1) + '%';
        badge.className = 'margin-badge ' + (margen >= 0 ? 'positive' : 'negative');
    } else {
        badge.textContent = 'Margen: --%';
        badge.className = 'margin-badge';
    }
}

function calcularImpuestosResumen() {
    var precio1 = parseFloat(document.getElementById('precio1').value) || 0;
    var tasa = getTasaImpuestos();
    var montoFijo = getMontoFijoImpuestos();
    var incluyeImp = document.getElementById('precio_incluye_impuesto').checked;
    var factor = 1 + (tasa / 100);

    var precioBase, impPorcentaje, impFijo, total;

    if (incluyeImp) {
        total = precio1;
        precioBase = (precio1 - montoFijo) / factor;
        impPorcentaje = precioBase * (tasa / 100);
        impFijo = montoFijo;
    } else {
        precioBase = precio1;
        impPorcentaje = precioBase * (tasa / 100);
        impFijo = montoFijo;
        total = precioBase + impPorcentaje + impFijo;
    }

    var impTotal = impPorcentaje + impFijo;

    document.getElementById('tasaTotal').textContent = tasa.toFixed(2) + '%' + (montoFijo > 0 ? ' + $' + montoFijo.toFixed(2) : '');
    document.getElementById('precioSinImp').textContent = '$' + precioBase.toFixed(2);
    document.getElementById('impAmount').textContent = '$' + impTotal.toFixed(2);
    document.getElementById('precioFinal').textContent = '$' + total.toFixed(2);
}

// ==================== FILTRAR Y TABLA ====================

function filtrar() {
    var busqueda = document.getElementById('inputBuscar').value.toLowerCase();
    var categoria = document.getElementById('filtroCategoria').value;
    var estado = document.getElementById('filtroEstado').value;

    var filtrados = window.datos.filter(function(item) {
        var matchBusq = !busqueda || 
            item.nombre.toLowerCase().indexOf(busqueda) >= 0 ||
            (item.codigo_barras && item.codigo_barras.indexOf(busqueda) >= 0) ||
            (item.codigo_interno && item.codigo_interno.toLowerCase().indexOf(busqueda) >= 0);
        var matchCat = !categoria || item.categoria_id === categoria;
        var matchEstado = !estado || item.activo === estado;
        return matchBusq && matchCat && matchEstado;
    });

    document.getElementById('totalRegistros').textContent = filtrados.length;
    renderTabla(filtrados);
}

function renderTabla(items) {
    var tbody = document.getElementById('tablaBody');
    if (items.length === 0) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="11">No hay productos</td></tr>';
        return;
    }
    var html = '';
    items.forEach(function(p) {
        var precio = parseFloat(p.precio1) || 0;
        var precioFinal = p.precio_venta || precio;
        
        // Formatear impuestos como badges
        var impuestosHtml = '-';
        if (p.impuestos_detalle && p.impuestos_detalle.trim() !== '') {
            var partes = p.impuestos_detalle.split(',');
            impuestosHtml = partes.map(function(imp) {
                var datos = imp.split(':');
                var nombre = datos[0] || '';
                var tipo = datos[1] || 'PORCENTAJE';
                var valor = parseFloat(datos[2]) || 0;
                
                if (tipo === 'FIJO') {
                    return '<span class="impuesto-badge fijo">' + nombre + ' $' + valor.toFixed(2) + '</span>';
                } else {
                    return '<span class="impuesto-badge">' + nombre + ' ' + valor + '%</span>';
                }
            }).join(' ');
        }
        
        html += '<tr>' +
            '<td>' + (p.codigo_barras || p.codigo_interno || '-') + '</td>' +
            '<td><strong>' + p.nombre + '</strong></td>' +
            '<td>' + (p.categoria_nombre || '-') + '</td>' +
            '<td class="text-center">' + (p.unidad_compra || 'PZ') + '</td>' +
            '<td class="text-center">' + (p.unidad_venta || 'PZ') + '</td>' +
            '<td class="text-center">' + parseFloat(p.factor_conversion || 1) + '</td>' +
            '<td class="text-right">$' + parseFloat(p.costo || 0).toFixed(2) + '</td>' +
            '<td class="text-right">$' + precioFinal.toFixed(2) + '</td>' +
            '<td>' + impuestosHtml + '</td>' +
            '<td class="text-center">' +
                '<span class="badge-status ' + (p.activo === 'Y' ? 'active' : 'inactive') + '">' +
                    (p.activo === 'Y' ? 'Activo' : 'Inactivo') +
                '</span>' +
            '</td>' +
            '<td class="text-center">' +
                '<div class="actions-cell">' +
                    '<button class="btn-action view" onclick="verDetalle(\'' + p.producto_id + '\')" title="Ver detalle">' +
                        '<i class="fas fa-eye"></i>' +
                    '</button>' +
                    '<button class="btn-action edit" onclick="editar(\'' + p.producto_id + '\')" title="Editar">' +
                        '<i class="fas fa-edit"></i>' +
                    '</button>' +
                    '<button class="btn-action delete" onclick="eliminar(\'' + p.producto_id + '\')" title="Eliminar">' +
                        '<i class="fas fa-trash"></i>' +
                    '</button>' +
                '</div>' +
            '</td>' +
        '</tr>';
    });
    tbody.innerHTML = html;
}

// ==================== VER DETALLE ====================

function verDetalle(id) {
    var p = window.datos.find(function(d) { return d.producto_id === id; });
    if (!p) return;
    
    var tasa = parseFloat(p.tasa_impuesto) || 0;
    var precio = parseFloat(p.precio1) || 0;
    var precioBase, impAmt, precioFinal;
    
    if (p.precio_incluye_impuesto === 'Y') {
        var factor = 1 + (tasa/100);
        precioBase = precio / factor;
        impAmt = precioBase * (tasa/100);
        precioFinal = precio;
    } else {
        precioBase = precio;
        impAmt = precioBase * (tasa/100);
        precioFinal = precioBase + impAmt;
    }
    
    var precios = [1,2,3,4].map(function(n) {
        var pr = parseFloat(p['precio' + n] || 0);
        if (p.precio_incluye_impuesto === 'Y') return pr;
        return pr * (1 + (tasa/100));
    });
    
    var html = '<div class="detalle-producto">' +
        '<div class="detalle-header-prod">' +
            '<div class="prod-img">' + (p.imagen_url ? '<img src="' + p.imagen_url + '">' : '<i class="fas fa-box"></i>') + '</div>' +
            '<div class="prod-info">' +
                '<h2>' + p.nombre + '</h2>' +
                '<p>' + (p.codigo_barras || p.codigo_interno || 'Sin código') + '</p>' +
                '<span class="badge-status ' + (p.activo === 'Y' ? 'active' : 'inactive') + '">' + (p.activo === 'Y' ? 'Activo' : 'Inactivo') + '</span>' +
            '</div>' +
        '</div>' +
        
        '<div class="detalle-grid">' +
            '<div class="detalle-section">' +
                '<h4><i class="fas fa-info-circle"></i> General</h4>' +
                '<div class="info-row"><span>Categoría:</span><strong>' + (p.categoria_nombre || 'Sin categoría') + '</strong></div>' +
                '<div class="info-row"><span>Tipo:</span><strong>' + (p.tipo || 'PRODUCTO') + '</strong></div>' +
                '<div class="info-row"><span>Código SAT:</span><strong>' + (p.codigo_sat || '-') + '</strong></div>' +
            '</div>' +
            
            '<div class="detalle-section">' +
                '<h4><i class="fas fa-boxes"></i> Unidades</h4>' +
                '<div class="info-row"><span>U. Compra:</span><strong>' + (p.unidad_compra || 'PZ') + '</strong></div>' +
                '<div class="info-row"><span>U. Venta:</span><strong>' + (p.unidad_venta || 'PZ') + '</strong></div>' +
                '<div class="info-row"><span>Factor:</span><strong>' + (p.factor_conversion || 1) + '</strong></div>' +
            '</div>' +
            
            '<div class="detalle-section">' +
                '<h4><i class="fas fa-dollar-sign"></i> Precios (con imp.)</h4>' +
                '<div class="info-row"><span>Costo:</span><strong>$' + parseFloat(p.costo || 0).toFixed(2) + '</strong></div>' +
                '<div class="info-row"><span>Precio 1:</span><strong>$' + precios[0].toFixed(2) + '</strong></div>' +
                '<div class="info-row"><span>Precio 2:</span><strong>$' + precios[1].toFixed(2) + '</strong></div>' +
                '<div class="info-row"><span>Precio 3:</span><strong>$' + precios[2].toFixed(2) + '</strong></div>' +
                '<div class="info-row"><span>Precio 4:</span><strong>$' + precios[3].toFixed(2) + '</strong></div>' +
            '</div>' +
            
            '<div class="detalle-section">' +
                '<h4><i class="fas fa-percentage"></i> Impuestos</h4>' +
                '<div class="info-row"><span>Detalle:</span><strong>' + (p.impuestos_detalle || 'Sin impuestos') + '</strong></div>' +
                '<div class="info-row"><span>Incluye imp:</span><strong>' + (p.precio_incluye_impuesto === 'Y' ? 'Sí' : 'No') + '</strong></div>' +
            '</div>' +
        '</div>' +
        
        '<div class="detalle-precio-final">' +
            '<div class="precio-row"><span>Precio base (sin imp.):</span><span>$' + precioBase.toFixed(2) + '</span></div>' +
            '<div class="precio-row"><span>Impuestos:</span><span>$' + impAmt.toFixed(2) + '</span></div>' +
            '<div class="precio-row total"><span>PRECIO VENTA:</span><span>$' + precioFinal.toFixed(2) + '</span></div>' +
        '</div>' +
        
        '<div class="modal-actions">' +
            '<button class="btn btn-outline" onclick="cerrarModalDetalle()"><i class="fas fa-times"></i> Cerrar</button>' +
            '<button class="btn btn-primary" onclick="cerrarModalDetalle();editar(\'' + p.producto_id + '\')"><i class="fas fa-edit"></i> Editar</button>' +
        '</div>' +
    '</div>';
    
    document.getElementById('detalleProductoContent').innerHTML = html;
    document.getElementById('modalDetalleProducto').classList.add('active');
}

function cerrarModalDetalle() {
    document.getElementById('modalDetalleProducto').classList.remove('active');
}

// ==================== UNIDADES ====================

function actualizarConversion() {
    var uCompra = document.getElementById('unidad_compra').value;
    var uVenta = document.getElementById('unidad_venta').value;
    var factor = document.getElementById('factor_conversion').value || 1;

    document.getElementById('convUCompra').textContent = uCompra;
    document.getElementById('convUVenta').textContent = uVenta;
    document.getElementById('convFactor').textContent = factor;
}

function calcularCostoUnitario() {
    var costoCompra = parseFloat(document.getElementById('costo_compra').value) || 0;
    var factor = parseFloat(document.getElementById('factor_conversion').value) || 1;
    var costoUnitario = factor > 0 ? costoCompra / factor : 0;

    document.getElementById('costo').value = costoUnitario.toFixed(4);
    document.getElementById('costoFormula').textContent = '$' + costoCompra.toFixed(2) + ' ÷ ' + factor + ' = $' + costoUnitario.toFixed(2);

    calcularMargen(1);
    calcularMargen(2);
    calcularMargen(3);
    calcularMargen(4);
}

// ==================== MODAL FORMULARIO ====================

async function abrirModal(item) {
    document.getElementById('modalTitulo').textContent = item ? 'Editar Producto' : 'Nuevo Producto';
    document.getElementById('formProducto').reset();
    document.getElementById('editId').value = '';
    
    window.preciosBase = { precio1: 0, precio2: 0, precio3: 0, precio4: 0 };
    window.impuestosProducto = [];

    document.querySelectorAll('.tab-btn').forEach(function(b, i) { b.classList.toggle('active', i === 0); });
    document.querySelectorAll('.tab-content').forEach(function(c, i) { c.classList.toggle('active', i === 0); });

    // Defaults
    document.getElementById('factor_conversion').value = 1;
    document.getElementById('descuento_maximo').value = 100;
    document.getElementById('es_inventariable').checked = true;
    document.getElementById('es_vendible').checked = true;
    document.getElementById('es_comprable').checked = true;
    document.getElementById('mostrar_pos').checked = true;
    document.getElementById('permite_descuento').checked = true;
    document.getElementById('precio_incluye_impuesto').checked = true;

    // Si es edición, cargar impuestos del producto ANTES de renderizar
    if (item && item.producto_id) {
        try {
            var r = await API.request('/productos/' + item.producto_id + '/impuestos');
            if (r.success && r.impuestos) {
                window.impuestosProducto = r.impuestos;
            }
        } catch (e) {
            console.error('Error cargando impuestos del producto:', e);
        }
    }

    // Mostrar modal PRIMERO para que exista el container
    document.getElementById('modalForm').classList.add('active');
    
    // AHORA renderizar impuestos (el container ya existe)
    renderImpuestosForm();

    if (item) {
        document.getElementById('editId').value = item.producto_id;
        document.getElementById('nombre').value = item.nombre || '';
        document.getElementById('nombre_corto').value = item.nombre_corto || '';
        document.getElementById('nombre_pos').value = item.nombre_pos || '';
        document.getElementById('nombre_ticket').value = item.nombre_ticket || '';
        document.getElementById('codigo_barras').value = item.codigo_barras || '';
        document.getElementById('codigo_interno').value = item.codigo_interno || '';
        document.getElementById('codigo_sat').value = item.codigo_sat || '';
        document.getElementById('categoria_id').value = item.categoria_id || '';
        document.getElementById('descripcion').value = item.descripcion || '';
        document.getElementById('tipo').value = item.tipo || 'PRODUCTO';
        document.getElementById('imagen_url').value = item.imagen_url || '';

        document.getElementById('unidad_compra').value = item.unidad_compra || 'PZ';
        document.getElementById('unidad_venta').value = item.unidad_venta || 'PZ';
        document.getElementById('factor_conversion').value = item.factor_conversion || 1;
        document.getElementById('unidad_inventario_id').value = item.unidad_inventario_id || 'PZ';
        document.getElementById('factor_venta').value = item.factor_venta || 1;

        document.getElementById('costo_compra').value = item.costo_compra || '';
        document.getElementById('costo').value = item.costo || '';
        document.getElementById('precio1').value = item.precio1 || '';
        document.getElementById('precio2').value = item.precio2 || '';
        document.getElementById('precio3').value = item.precio3 || '';
        document.getElementById('precio4').value = item.precio4 || '';
        document.getElementById('precio_minimo').value = item.precio_minimo || '';
        document.getElementById('ultimo_costo').value = item.ultimo_costo || '';
        document.getElementById('costo_promedio').value = item.costo_promedio || '';
        document.getElementById('precio_incluye_impuesto').checked = item.precio_incluye_impuesto === 'Y';

        // Guardar precios base después de renderizar impuestos
        var tasa = getTasaImpuestos();
        var montoFijo = getMontoFijoImpuestos();
        var factor = 1 + (tasa/100);
        
        ['precio1', 'precio2', 'precio3', 'precio4'].forEach(function(id) {
            var precio = parseFloat(item[id] || 0);
            if (item.precio_incluye_impuesto === 'Y') {
                window.preciosBase[id] = (precio - montoFijo) / factor;
            } else {
                window.preciosBase[id] = precio;
            }
        });

        document.getElementById('stock_minimo').value = item.stock_minimo || '';
        document.getElementById('stock_maximo').value = item.stock_maximo || '';
        document.getElementById('punto_reorden').value = item.punto_reorden || '';
        document.getElementById('ubicacion_almacen').value = item.ubicacion_almacen || '';
        document.getElementById('maneja_lotes').checked = item.maneja_lotes === 'Y';
        document.getElementById('maneja_caducidad').checked = item.maneja_caducidad === 'Y';
        document.getElementById('maneja_series').checked = item.maneja_series === 'Y';
        document.getElementById('dias_caducidad').value = item.dias_caducidad || '';
        document.getElementById('rowCaducidad').style.display = item.maneja_caducidad === 'Y' ? 'flex' : 'none';

        document.getElementById('es_inventariable').checked = item.es_inventariable !== 'N';
        document.getElementById('es_vendible').checked = item.es_vendible !== 'N';
        document.getElementById('es_comprable').checked = item.es_comprable !== 'N';
        document.getElementById('mostrar_pos').checked = item.mostrar_pos !== 'N';
        document.getElementById('permite_descuento').checked = item.permite_descuento !== 'N';
        document.getElementById('descuento_maximo').value = item.descuento_maximo || 100;
        document.getElementById('color_pos').value = item.color_pos || '#3498db';
        document.getElementById('color_pos_text').value = item.color_pos || '#3498db';
        document.getElementById('orden_pos').value = item.orden_pos || 0;
        document.getElementById('tecla_rapida').value = item.tecla_rapida || '';
        document.getElementById('notas_internas').value = item.notas_internas || '';

        actualizarConversion();
        calcularMargen(1);
        calcularMargen(2);
        calcularMargen(3);
        calcularMargen(4);
        calcularImpuestosResumen();

        if (item.imagen_url) {
            document.getElementById('imgPreview').innerHTML = '<img src="' + item.imagen_url + '" onerror="this.parentElement.innerHTML=\'<i class=\\\'fas fa-image\\\'></i>\'">';
        }
    }
}

function cerrarModal() {
    document.getElementById('modalForm').classList.remove('active');
    window.impuestosProducto = [];
}

function editar(id) {
    var item = window.datos.find(function(d) { return d.producto_id === id; });
    if (item) abrirModal(item);
}

// ==================== GUARDAR ====================

async function guardar(e) {
    e.preventDefault();
    var id = document.getElementById('editId').value;

    var impuestosSeleccionados = getImpuestosSeleccionados();

    var data = {
        empresa_id: API.usuario.empresa_id,
        nombre: document.getElementById('nombre').value,
        nombre_corto: document.getElementById('nombre_corto').value || null,
        nombre_pos: document.getElementById('nombre_pos').value || null,
        nombre_ticket: document.getElementById('nombre_ticket').value || null,
        codigo_barras: document.getElementById('codigo_barras').value || null,
        codigo_interno: document.getElementById('codigo_interno').value || null,
        codigo_sat: document.getElementById('codigo_sat').value || null,
        categoria_id: document.getElementById('categoria_id').value || null,
        descripcion: document.getElementById('descripcion').value || null,
        tipo: document.getElementById('tipo').value,
        imagen_url: document.getElementById('imagen_url').value || null,
        unidad_compra: document.getElementById('unidad_compra').value,
        unidad_venta: document.getElementById('unidad_venta').value,
        factor_conversion: parseFloat(document.getElementById('factor_conversion').value) || 1,
        unidad_inventario_id: document.getElementById('unidad_inventario_id').value,
        factor_venta: parseFloat(document.getElementById('factor_venta').value) || 1,
        costo_compra: parseFloat(document.getElementById('costo_compra').value) || 0,
        costo: parseFloat(document.getElementById('costo').value) || 0,
        precio1: parseFloat(document.getElementById('precio1').value) || 0,
        precio2: parseFloat(document.getElementById('precio2').value) || 0,
        precio3: parseFloat(document.getElementById('precio3').value) || 0,
        precio4: parseFloat(document.getElementById('precio4').value) || 0,
        precio_minimo: parseFloat(document.getElementById('precio_minimo').value) || 0,
        precio_incluye_impuesto: document.getElementById('precio_incluye_impuesto').checked ? 'Y' : 'N',
        impuestos: impuestosSeleccionados,
        stock_minimo: parseFloat(document.getElementById('stock_minimo').value) || 0,
        stock_maximo: parseFloat(document.getElementById('stock_maximo').value) || 0,
        punto_reorden: parseFloat(document.getElementById('punto_reorden').value) || 0,
        ubicacion_almacen: document.getElementById('ubicacion_almacen').value || null,
        maneja_lotes: document.getElementById('maneja_lotes').checked ? 'Y' : 'N',
        maneja_caducidad: document.getElementById('maneja_caducidad').checked ? 'Y' : 'N',
        maneja_series: document.getElementById('maneja_series').checked ? 'Y' : 'N',
        dias_caducidad: parseInt(document.getElementById('dias_caducidad').value) || 0,
        es_inventariable: document.getElementById('es_inventariable').checked ? 'Y' : 'N',
        es_vendible: document.getElementById('es_vendible').checked ? 'Y' : 'N',
        es_comprable: document.getElementById('es_comprable').checked ? 'Y' : 'N',
        mostrar_pos: document.getElementById('mostrar_pos').checked ? 'Y' : 'N',
        permite_descuento: document.getElementById('permite_descuento').checked ? 'Y' : 'N',
        descuento_maximo: parseFloat(document.getElementById('descuento_maximo').value) || 0,
        color_pos: document.getElementById('color_pos').value,
        orden_pos: parseInt(document.getElementById('orden_pos').value) || 0,
        tecla_rapida: document.getElementById('tecla_rapida').value || null,
        notas_internas: document.getElementById('notas_internas').value || null,
        activo: 'Y'
    };

    try {
        var url = id ? '/productos/' + id : '/productos';
        var method = id ? 'PUT' : 'POST';
        var r = await API.request(url, method, data);

        if (r.success) {
            mostrarToast(id ? 'Producto actualizado' : 'Producto creado');
            cerrarModal();
            await cargarDatos();
        } else {
            mostrarToast('Error: ' + r.error, 'error');
        }
    } catch (e) {
        mostrarToast('Error de conexión', 'error');
    }
}

// ==================== ELIMINAR ====================

async function eliminar(id) {
    if (!confirm('¿Eliminar este producto?')) return;
    try {
        var r = await API.request('/productos/' + id, 'DELETE');
        if (r.success) {
            mostrarToast('Producto eliminado');
            await cargarDatos();
        } else {
            mostrarToast('Error: ' + r.error, 'error');
        }
    } catch (e) {
        mostrarToast('Error de conexión', 'error');
    }
}

function exportarExcel() {
    mostrarToast('Función próximamente disponible');
}

function mostrarToast(msg, tipo) {
    tipo = tipo || 'success';
    var toast = document.getElementById('toast');
    toast.innerHTML = '<i class="fas fa-' + (tipo === 'error' ? 'exclamation-circle' : 'check-circle') + '"></i> ' + msg;
    toast.className = 'toast show ' + tipo;
    setTimeout(function() { toast.classList.remove('show'); }, 3000);
}
