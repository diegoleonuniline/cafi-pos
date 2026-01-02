if (!API.isLoggedIn()) window.location.href = '../index.html';

var datos = [];
var categorias = [];
var preciosBase = { precio1: 0, precio2: 0, precio3: 0, precio4: 0 };

document.addEventListener('DOMContentLoaded', async function() {
    cargarUsuario();
    await cargarCategorias();
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
            categorias = r.categorias || r.data || [];
            var selFiltro = document.getElementById('filtroCategoria');
            var selForm = document.getElementById('categoria_id');
            
            selFiltro.innerHTML = '<option value="">Todas</option>';
            selForm.innerHTML = '<option value="">Sin categoría</option>';
            
            categorias.forEach(function(c) {
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

async function cargarDatos() {
    try {
        var r = await API.request('/productos/' + API.usuario.empresa_id);
        if (r.success) {
            datos = r.productos || r.data || [];
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
    // Eventos de IVA - recalcular precios cuando cambie
    document.querySelectorAll('input[name="iva"]').forEach(function(radio) {
        radio.addEventListener('change', function() {
            document.querySelectorAll('.radio-card').forEach(function(c) { c.classList.remove('active'); });
            radio.closest('.radio-card').classList.add('active');
            recalcularPreciosConImpuestos();
        });
    });

    // Evento IEPS - recalcular precios cuando cambie
    var iepsInput = document.getElementById('ieps');
    if (iepsInput) {
        iepsInput.addEventListener('input', recalcularPreciosConImpuestos);
    }
    
    // Evento toggle incluye impuesto - convertir precios
    var precioImp = document.getElementById('precio_incluye_impuesto');
    if (precioImp) {
        precioImp.addEventListener('change', function() {
            convertirPrecios(this.checked);
        });
    }

    // Eventos de precios - guardar como precio base
    ['precio1', 'precio2', 'precio3', 'precio4'].forEach(function(id) {
        var input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', function() {
                var num = id.replace('precio', '');
                var valor = parseFloat(this.value) || 0;
                
                if (document.getElementById('precio_incluye_impuesto').checked) {
                    var factor = getFactorImpuestos();
                    preciosBase['precio' + num] = valor / factor;
                } else {
                    preciosBase['precio' + num] = valor;
                }
                
                calcularMargen(parseInt(num));
                calcularImpuestos();
            });
        }
    });

    // Imagen preview
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

    // Color POS
    var colorPos = document.getElementById('color_pos');
    if (colorPos) {
        colorPos.addEventListener('input', function(e) {
            document.getElementById('color_pos_text').value = e.target.value;
        });
    }

    // Caducidad toggle
    var caducidad = document.getElementById('maneja_caducidad');
    if (caducidad) {
        caducidad.addEventListener('change', function(e) {
            document.getElementById('rowCaducidad').style.display = e.target.checked ? 'flex' : 'none';
        });
    }
}

// ==================== FUNCIONES DE IMPUESTOS ====================

function getFactorImpuestos() {
    var ivaRadio = document.querySelector('input[name="iva"]:checked');
    var iva = ivaRadio ? parseFloat(ivaRadio.value) : 16;
    var ieps = parseFloat(document.getElementById('ieps').value) || 0;
    return 1 + (iva / 100) + (ieps / 100);
}

function convertirPrecios(incluyeImpuesto) {
    var factor = getFactorImpuestos();
    
    ['precio1', 'precio2', 'precio3', 'precio4'].forEach(function(id) {
        var input = document.getElementById(id);
        var valorActual = parseFloat(input.value) || 0;
        
        if (valorActual > 0) {
            if (incluyeImpuesto) {
                // Estaba sin impuestos, ahora incluye -> multiplicar
                preciosBase[id] = valorActual;
                input.value = (valorActual * factor).toFixed(2);
            } else {
                // Estaba con impuestos, ahora sin -> dividir
                preciosBase[id] = valorActual / factor;
                input.value = preciosBase[id].toFixed(2);
            }
        }
    });
    
    calcularMargen(1);
    calcularMargen(2);
    calcularMargen(3);
    calcularMargen(4);
    calcularImpuestos();
}

function recalcularPreciosConImpuestos() {
    var factor = getFactorImpuestos();
    var incluyeImpuesto = document.getElementById('precio_incluye_impuesto').checked;
    
    ['precio1', 'precio2', 'precio3', 'precio4'].forEach(function(id) {
        var input = document.getElementById(id);
        var base = preciosBase[id] || 0;
        
        if (base > 0) {
            if (incluyeImpuesto) {
                input.value = (base * factor).toFixed(2);
            } else {
                input.value = base.toFixed(2);
            }
        }
    });
    
    calcularMargen(1);
    calcularMargen(2);
    calcularMargen(3);
    calcularMargen(4);
    calcularImpuestos();
}

function calcularMargen(num) {
    var costo = parseFloat(document.getElementById('costo').value) || 0;
    var precioInput = parseFloat(document.getElementById('precio' + num).value) || 0;
    var badge = document.getElementById('margen' + num);
    
    // Margen sobre precio base (sin impuestos)
    var precioBase = preciosBase['precio' + num] || precioInput;
    if (document.getElementById('precio_incluye_impuesto').checked && precioInput > 0) {
        precioBase = precioInput / getFactorImpuestos();
    }
    
    if (costo > 0 && precioBase > 0) {
        var margen = ((precioBase - costo) / costo) * 100;
        badge.textContent = 'Margen: ' + margen.toFixed(1) + '%';
        badge.className = 'margin-badge ' + (margen >= 0 ? 'positive' : 'negative');
    } else {
        badge.textContent = 'Margen: --%';
        badge.className = 'margin-badge';
    }
}

function calcularImpuestos() {
    var precio1 = parseFloat(document.getElementById('precio1').value) || 0;
    var ivaRadio = document.querySelector('input[name="iva"]:checked');
    var iva = ivaRadio ? parseFloat(ivaRadio.value) : 16;
    var ieps = parseFloat(document.getElementById('ieps').value) || 0;
    var incluyeImp = document.getElementById('precio_incluye_impuesto').checked;

    var precioBase, ivaAmt, iepsAmt, total;

    if (incluyeImp) {
        var factorImp = 1 + (iva / 100) + (ieps / 100);
        precioBase = precio1 / factorImp;
        ivaAmt = precioBase * (iva / 100);
        iepsAmt = precioBase * (ieps / 100);
        total = precio1;
    } else {
        precioBase = precio1;
        ivaAmt = precioBase * (iva / 100);
        iepsAmt = precioBase * (ieps / 100);
        total = precioBase + ivaAmt + iepsAmt;
    }

    document.getElementById('ivaPercent').textContent = iva;
    document.getElementById('iepsPercent').textContent = ieps;
    document.getElementById('precioSinImp').textContent = '$' + precioBase.toFixed(2);
    document.getElementById('ivaAmount').textContent = '$' + ivaAmt.toFixed(2);
    document.getElementById('iepsAmount').textContent = '$' + iepsAmt.toFixed(2);
    document.getElementById('precioFinal').textContent = '$' + total.toFixed(2);
}

// ==================== FILTRAR Y TABLA ====================

function filtrar() {
    var busqueda = document.getElementById('inputBuscar').value.toLowerCase();
    var categoria = document.getElementById('filtroCategoria').value;
    var estado = document.getElementById('filtroEstado').value;

    var filtrados = datos.filter(function(item) {
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
        var iva = parseFloat(p.iva || 16);
        var ieps = parseFloat(p.ieps || 0);
        var precio = parseFloat(p.precio1 || 0);
        var precioFinal = precio;
        
        // Si precio NO incluye impuestos, calcular precio final
        if (p.precio_incluye_impuesto !== 'Y') {
            precioFinal = precio * (1 + (iva/100) + (ieps/100));
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
            '<td class="text-center">' + iva + '%</td>' +
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
    var p = datos.find(function(d) { return d.producto_id === id; });
    if (!p) return;
    
    var iva = parseFloat(p.iva || 16);
    var ieps = parseFloat(p.ieps || 0);
    var precio = parseFloat(p.precio1 || 0);
    var precioBase, ivaAmt, iepsAmt, precioFinal;
    
    if (p.precio_incluye_impuesto === 'Y') {
        var factor = 1 + (iva/100) + (ieps/100);
        precioBase = precio / factor;
        ivaAmt = precioBase * (iva/100);
        iepsAmt = precioBase * (ieps/100);
        precioFinal = precio;
    } else {
        precioBase = precio;
        ivaAmt = precioBase * (iva/100);
        iepsAmt = precioBase * (ieps/100);
        precioFinal = precioBase + ivaAmt + iepsAmt;
    }
    
    // Calcular precios finales para todos los precios
    var precios = [1,2,3,4].map(function(n) {
        var pr = parseFloat(p['precio' + n] || 0);
        if (p.precio_incluye_impuesto === 'Y') return pr;
        return pr * (1 + (iva/100) + (ieps/100));
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
                '<div class="info-row"><span>IVA:</span><strong>' + iva + '%</strong></div>' +
                '<div class="info-row"><span>IEPS:</span><strong>' + ieps + '%</strong></div>' +
                '<div class="info-row"><span>Incluye imp:</span><strong>' + (p.precio_incluye_impuesto === 'Y' ? 'Sí' : 'No') + '</strong></div>' +
            '</div>' +
        '</div>' +
        
        '<div class="detalle-precio-final">' +
            '<div class="precio-row"><span>Precio base (sin imp.):</span><span>$' + precioBase.toFixed(2) + '</span></div>' +
            '<div class="precio-row"><span>IVA (' + iva + '%):</span><span>$' + ivaAmt.toFixed(2) + '</span></div>' +
            (ieps > 0 ? '<div class="precio-row"><span>IEPS (' + ieps + '%):</span><span>$' + iepsAmt.toFixed(2) + '</span></div>' : '') +
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

function abrirModal(item) {
    document.getElementById('modalTitulo').textContent = item ? 'Editar Producto' : 'Nuevo Producto';
    document.getElementById('formProducto').reset();
    document.getElementById('editId').value = '';
    
    // Reset preciosBase
    preciosBase = { precio1: 0, precio2: 0, precio3: 0, precio4: 0 };

    // Reset tabs
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
    document.getElementById('ieps').value = 0;
    
    // IVA default 16%
    var iva16 = document.querySelector('input[name="iva"][value="16"]');
    if (iva16) iva16.checked = true;
    document.querySelectorAll('.radio-card').forEach(function(c) { c.classList.remove('active'); });
    if (iva16) iva16.closest('.radio-card').classList.add('active');

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

        // IVA
        var ivaVal = '16';
        if (item.impuesto_id === 'IVA0' || item.iva == 0) ivaVal = '0';
        else if (item.impuesto_id === 'IVA8' || item.iva == 8) ivaVal = '8';
        var ivaRadio = document.querySelector('input[name="iva"][value="' + ivaVal + '"]');
        if (ivaRadio) {
            ivaRadio.checked = true;
            document.querySelectorAll('.radio-card').forEach(function(c) { c.classList.remove('active'); });
            ivaRadio.closest('.radio-card').classList.add('active');
        }
        
        document.getElementById('ieps').value = item.ieps || 0;
        document.getElementById('precio_incluye_impuesto').checked = item.precio_incluye_impuesto === 'Y';

        // Guardar precios base
        var iva = parseFloat(ivaVal);
        var ieps = parseFloat(item.ieps || 0);
        var factor = 1 + (iva/100) + (ieps/100);
        
        ['precio1', 'precio2', 'precio3', 'precio4'].forEach(function(id) {
            var precio = parseFloat(item[id] || 0);
            if (item.precio_incluye_impuesto === 'Y') {
                preciosBase[id] = precio / factor;
            } else {
                preciosBase[id] = precio;
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
        calcularImpuestos();

        if (item.imagen_url) {
            document.getElementById('imgPreview').innerHTML = '<img src="' + item.imagen_url + '" onerror="this.parentElement.innerHTML=\'<i class=\\\'fas fa-image\\\'></i>\'">';
        }
    }

    document.getElementById('modalForm').classList.add('active');
}

function cerrarModal() {
    document.getElementById('modalForm').classList.remove('active');
}

function editar(id) {
    var item = datos.find(function(d) { return d.producto_id === id; });
    if (item) abrirModal(item);
}

// ==================== GUARDAR ====================

async function guardar(e) {
    e.preventDefault();
    var id = document.getElementById('editId').value;

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

// ==================== EXPORTAR ====================

function exportarExcel() {
    mostrarToast('Función próximamente disponible');
}

// ==================== TOAST ====================

function mostrarToast(msg, tipo) {
    tipo = tipo || 'success';
    var toast = document.getElementById('toast');
    toast.innerHTML = '<i class="fas fa-' + (tipo === 'error' ? 'exclamation-circle' : 'check-circle') + '"></i> ' + msg;
    toast.className = 'toast show ' + tipo;
    setTimeout(function() { toast.classList.remove('show'); }, 3000);
}
