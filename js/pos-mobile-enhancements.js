// ==================== POS MOBILE ENHANCEMENTS ====================
// Agregar después del script principal pos.js

(function() {
    'use strict';
    
    // Esperar a que cargue el DOM
    document.addEventListener('DOMContentLoaded', initMobileEnhancements);
    
    function initMobileEnhancements() {
        // Solo en móvil
        if (window.innerWidth > 768) return;
        
        setupSearchAutocomplete();
        overrideRenderCarrito();
        setupMobileMenu();
        
        // Re-verificar en resize
        window.addEventListener('resize', function() {
            if (window.innerWidth <= 768) {
                setupSearchAutocomplete();
            }
        });
    }
    
    // ==================== BÚSQUEDA CON AUTOCOMPLETADO ====================
    function setupSearchAutocomplete() {
        var searchBar = document.querySelector('.search-bar');
        var inputBuscar = document.getElementById('inputBuscar');
        
        if (!searchBar || !inputBuscar) return;
        
        // Crear dropdown si no existe
        var dropdown = document.getElementById('searchAutocomplete');
        if (!dropdown) {
            dropdown = document.createElement('div');
            dropdown.id = 'searchAutocomplete';
            dropdown.className = 'search-autocomplete';
            searchBar.appendChild(dropdown);
        }
        
        // Evento de escritura
        inputBuscar.removeEventListener('input', handleSearchInput);
        inputBuscar.addEventListener('input', handleSearchInput);
        
        // Cerrar al hacer click fuera
        document.addEventListener('click', function(e) {
            if (!searchBar.contains(e.target)) {
                dropdown.classList.remove('active');
            }
        });
        
        // Mantener abierto al enfocar
        inputBuscar.addEventListener('focus', function() {
            if (inputBuscar.value.length >= 1 && typeof productos !== 'undefined') {
                filterAndShowResults(inputBuscar.value);
            }
        });
    }
    
    function handleSearchInput(e) {
        var query = e.target.value.trim();
        
        if (query.length < 1) {
            hideAutocomplete();
            return;
        }
        
        filterAndShowResults(query);
    }
    
    function filterAndShowResults(query) {
        if (typeof productos === 'undefined' || !productos.length) {
            hideAutocomplete();
            return;
        }
        
        var queryLower = query.toLowerCase();
        var filtered = productos.filter(function(p) {
            if (p.activo === 'N') return false;
            var matchNombre = p.nombre && p.nombre.toLowerCase().indexOf(queryLower) >= 0;
            var matchCodigo = p.codigo_barras && p.codigo_barras.indexOf(query) >= 0;
            var matchInterno = p.codigo_interno && p.codigo_interno.toLowerCase().indexOf(queryLower) >= 0;
            return matchNombre || matchCodigo || matchInterno;
        }).slice(0, 8); // Máximo 8 resultados
        
        showAutocompleteResults(filtered);
    }
    
    function showAutocompleteResults(items) {
        var dropdown = document.getElementById('searchAutocomplete');
        if (!dropdown) return;
        
        if (!items.length) {
            dropdown.innerHTML = '<div class="autocomplete-empty"><i class="fas fa-search"></i> Sin resultados</div>';
            dropdown.classList.add('active');
            return;
        }
        
        var tipoPrecio = typeof tipoPrecio !== 'undefined' ? tipoPrecio : 1;
        
        var html = items.map(function(p) {
            var precio = getPrecioProducto(p, tipoPrecio);
            var codigo = p.codigo_barras || p.codigo_interno || '';
            
            return '<div class="autocomplete-item" data-id="' + p.producto_id + '">' +
                '<div class="autocomplete-img"><i class="fas fa-box"></i></div>' +
                '<div class="autocomplete-info">' +
                    '<div class="autocomplete-name">' + escapeHtml(p.nombre) + '</div>' +
                    '<div class="autocomplete-code">' + escapeHtml(codigo) + ' • ' + (p.unidad_venta || 'PZ') + '</div>' +
                '</div>' +
                '<div class="autocomplete-price">$' + precio.toFixed(2) + '</div>' +
            '</div>';
        }).join('');
        
        dropdown.innerHTML = html;
        dropdown.classList.add('active');
        
        // Eventos click en items
        dropdown.querySelectorAll('.autocomplete-item').forEach(function(item) {
            item.addEventListener('click', function() {
                var prodId = item.getAttribute('data-id');
                selectAutocompleteProduct(prodId);
            });
        });
    }
    
    function hideAutocomplete() {
        var dropdown = document.getElementById('searchAutocomplete');
        if (dropdown) dropdown.classList.remove('active');
    }
    
    function selectAutocompleteProduct(prodId) {
        var prod = productos.find(function(p) { return p.producto_id === prodId; });
        if (!prod) return;
        
        hideAutocomplete();
        document.getElementById('inputBuscar').value = '';
        
        // Usar función existente
        if (typeof verificarYAgregar === 'function') {
            verificarYAgregar(prod);
        } else if (typeof agregarAlCarrito === 'function') {
            agregarAlCarrito(prod, 1);
        }
    }
    
    function getPrecioProducto(prod, numPrecio) {
        numPrecio = numPrecio || 1;
        if (numPrecio === 1 && prod.precio_venta) return parseFloat(prod.precio_venta) || 0;
        if (numPrecio === 2 && prod.precio_venta2) return parseFloat(prod.precio_venta2) || 0;
        if (numPrecio === 3 && prod.precio_venta3) return parseFloat(prod.precio_venta3) || 0;
        if (numPrecio === 4 && prod.precio_venta4) return parseFloat(prod.precio_venta4) || 0;
        return parseFloat(prod['precio' + numPrecio] || prod.precio1 || prod.precio_venta) || 0;
    }
    
    function escapeHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // ==================== RENDER CARRITO MEJORADO PARA MÓVIL ====================
    function overrideRenderCarrito() {
        // Guardar referencia original
        var originalRenderCarrito = window.renderCarrito;
        
        window.renderCarrito = function() {
            var tbody = document.getElementById('cartBody');
            var emptyMsg = document.getElementById('cartEmpty');
            
            if (!tbody) return;
            
            // Verificar si estamos en móvil
            var isMobile = window.innerWidth <= 768;
            
            if (typeof carrito === 'undefined' || carrito.length === 0) {
                tbody.innerHTML = '';
                if (emptyMsg) emptyMsg.style.display = 'flex';
                actualizarTotalesMobile();
                return;
            }
            
            if (emptyMsg) emptyMsg.style.display = 'none';
            
            if (isMobile) {
                // Render móvil
                renderCarritoMobile(tbody);
            } else {
                // Render desktop (usar original si existe)
                if (originalRenderCarrito) {
                    originalRenderCarrito.call(window);
                    return;
                }
                renderCarritoDesktop(tbody);
            }
            
            actualizarTotalesMobile();
            
            if (typeof actualizarTotales === 'function') {
                // Evitar recursión
                var _at = actualizarTotales;
                actualizarTotales = function(){};
                _at();
                actualizarTotales = _at;
            }
        };
    }
    
   function renderCarritoMobile(tbody) {
    var html = '';
    
    // Invertir para mostrar últimos primero
    var carritoInvertido = carrito.slice().reverse();
    
    carritoInvertido.forEach(function(item, idx) {
        // El índice real es inverso
        var index = carrito.length - 1 - idx;
        
        var tieneDescuento = item.descuento > 0;
        var precioConDesc = item.precio * (1 - (item.descuento || 0) / 100);
        var importe = precioConDesc * item.cantidad;
        var esGranel = item.esGranel || ['KG', 'GR', 'LT', 'ML', 'MT'].indexOf((item.unidad || 'PZ').toUpperCase()) >= 0;
        var cantidadDisplay = esGranel ? item.cantidad.toFixed(3) : Math.round(item.cantidad);
        var importeFormateado = '$' + importe.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        
        html += '<tr data-index="' + index + '">' +
            '<td class="mobile-card" colspan="7">' +
                '<div class="card-img" onclick="abrirAccionesProducto(\'' + item.producto_id + '\')"><i class="fas fa-box"></i></div>' +
                '<div class="card-info" onclick="abrirAccionesProducto(\'' + item.producto_id + '\')">' +
                    '<div class="card-name">' + escapeHtml(item.nombre) + '</div>' +
                    '<div class="card-price">' +
                        '$' + item.precio.toFixed(2) + ' / ' + (item.unidad || 'pza').toLowerCase() +
                        (tieneDescuento ? ' <span class="card-descuento">-' + item.descuento + '%</span>' : '') +
                    '</div>' +
                    '<div class="card-qty-row">' +
                        (esGranel ? 
                            '<button class="qty-granel" onclick="event.stopPropagation();editarCantidadLinea(\'' + item.producto_id + '\')">' + cantidadDisplay + ' ' + (item.unidad || 'KG') + '</button>' :
                            '<div class="qty-control" onclick="event.stopPropagation()">' +
                                '<button type="button" onclick="cambiarCantidadMobile(\'' + item.producto_id + '\', -1)">−</button>' +
                                '<span onclick="editarCantidadLinea(\'' + item.producto_id + '\')">' + cantidadDisplay + '</span>' +
                                '<button type="button" onclick="cambiarCantidadMobile(\'' + item.producto_id + '\', 1)">+</button>' +
                            '</div>'
                        ) +
                    '</div>' +
                '</div>' +
                '<div class="card-total" onclick="abrirAccionesProducto(\'' + item.producto_id + '\')">' + importeFormateado + '</div>' +
            '</td>' +
        '</tr>';
    });
    
    tbody.innerHTML = html;
}
// ==================== ACCIONES PRODUCTO MÓVIL ====================
window.abrirAccionesProducto = function(productoId) {
    var item = carrito.find(function(i) { return i.producto_id === productoId; });
    if (!item) return;
    
    var precioConDesc = item.precio * (1 - (item.descuento || 0) / 100);
    var importe = precioConDesc * item.cantidad;
    
    var html = '<div class="acciones-producto-modal">' +
        '<div class="acciones-header">' +
            '<div class="acciones-producto-nombre">' + escapeHtml(item.nombre) + '</div>' +
            '<div class="acciones-producto-detalle">$' + item.precio.toFixed(2) + ' × ' + item.cantidad + ' = $' + importe.toFixed(2) + '</div>' +
        '</div>' +
        '<div class="acciones-lista">' +
            '<button class="accion-btn" onclick="editarCantidadLinea(\'' + productoId + '\');cerrarAccionesProducto()">' +
                '<i class="fas fa-hashtag"></i>' +
                '<span>Cambiar cantidad</span>' +
            '</button>' +
            '<button class="accion-btn" onclick="editarPrecioLinea(\'' + productoId + '\');cerrarAccionesProducto()">' +
                '<i class="fas fa-dollar-sign"></i>' +
                '<span>Cambiar precio</span>' +
            '</button>' +
            '<button class="accion-btn" onclick="editarDescuentoLinea(\'' + productoId + '\');cerrarAccionesProducto()">' +
                '<i class="fas fa-percent"></i>' +
                '<span>Aplicar descuento</span>' +
                (item.descuento > 0 ? '<span class="accion-badge">' + item.descuento + '%</span>' : '') +
            '</button>' +
            '<button class="accion-btn danger" onclick="confirmarEliminarProducto(\'' + productoId + '\')">' +
                '<i class="fas fa-trash"></i>' +
                '<span>Eliminar producto</span>' +
            '</button>' +
        '</div>' +
    '</div>';
    
    var overlay = document.createElement('div');
    overlay.id = 'accionesProductoOverlay';
    overlay.className = 'acciones-overlay';
    overlay.innerHTML = html;
    overlay.onclick = function(e) {
        if (e.target === overlay) cerrarAccionesProducto();
    };
    
    document.body.appendChild(overlay);
    setTimeout(function() { overlay.classList.add('active'); }, 10);
};

window.cerrarAccionesProducto = function() {
    var overlay = document.getElementById('accionesProductoOverlay');
    if (overlay) {
        overlay.classList.remove('active');
        setTimeout(function() { overlay.remove(); }, 300);
    }
};

window.confirmarEliminarProducto = function(productoId) {
    cerrarAccionesProducto();
    var item = carrito.find(function(i) { return i.producto_id === productoId; });
    if (!item) return;
    
    if (typeof eliminarDelCarrito === 'function') {
        eliminarDelCarrito(productoId);
    } else if (typeof eliminarDelCarritoMobile === 'function') {
        eliminarDelCarritoMobile(productoId);
    }
};
    
    function renderCarritoDesktop(tbody) {
        var html = '';
        
        carrito.forEach(function(item, index) {
            var tieneDescuento = item.descuento > 0;
            var descuentoTexto = tieneDescuento ? '-' + item.descuento + '%' : '';
            var precioConDesc = item.precio * (1 - (item.descuento || 0) / 100);
            var importe = precioConDesc * item.cantidad;
            var esGranel = item.esGranel || ['KG', 'GR', 'LT', 'ML', 'MT'].indexOf((item.unidad || 'PZ').toUpperCase()) >= 0;
            
            html += '<tr data-index="' + index + '">' +
                '<td class="col-producto desktop-cell">' +
                    '<div class="cart-item-name">' + escapeHtml(item.nombre) + '</div>' +
                    '<div class="cart-item-code">' + escapeHtml(item.codigo || '') + '</div>' +
                '</td>' +
                '<td class="col-precio desktop-cell">' +
                    '<span' + (tieneDescuento ? ' class="precio-tachado"' : '') + '>$' + item.precio.toFixed(2) + '</span>' +
                    (tieneDescuento ? '<span class="precio-final">$' + precioConDesc.toFixed(2) + '</span>' : '') +
                '</td>' +
                '<td class="col-cantidad desktop-cell">' +
                    (esGranel ? 
                        '<button class="qty-granel" onclick="editarCantidadLinea(\'' + item.producto_id + '\')">' + item.cantidad.toFixed(3) + ' ' + (item.unidad || 'KG') + '</button>' :
                        '<div class="qty-control">' +
                            '<button type="button" onclick="cambiarCantidad(\'' + item.producto_id + '\', -1)">−</button>' +
                            '<span>' + Math.round(item.cantidad) + '</span>' +
                            '<button type="button" onclick="cambiarCantidad(\'' + item.producto_id + '\', 1)">+</button>' +
                        '</div>'
                    ) +
                '</td>' +
                '<td class="col-unidad desktop-cell">' + (item.unidad || 'PZ') + '</td>' +
                '<td class="col-desc desktop-cell">' +
                    '<button class="btn-desc" onclick="editarDescuentoLinea(\'' + item.producto_id + '\')">' + (descuentoTexto || '0%') + '</button>' +
                '</td>' +
                '<td class="col-importe desktop-cell">$' + importe.toFixed(2) + '</td>' +
                '<td class="col-acciones desktop-cell">' +
                    '<button class="btn-delete" onclick="eliminarDelCarrito(\'' + item.producto_id + '\')"><i class="fas fa-trash"></i></button>' +
                '</td>' +
            '</tr>';
        });
        
        tbody.innerHTML = html;
    }
    
    // Funciones globales para móvil
    window.cambiarCantidadMobile = function(id, delta) {
        if (typeof cambiarCantidad === 'function') {
            cambiarCantidad(id, delta);
        }
    };
    
    window.eliminarDelCarritoMobile = function(id) {
        if (typeof eliminarDelCarrito === 'function') {
            eliminarDelCarrito(id);
        }
    };
    
    // ==================== ACTUALIZAR TOTALES MÓVIL ====================
    function actualizarTotalesMobile() {
        if (typeof carrito === 'undefined') return;
        
        var total = 0;
        var articulos = 0;
        
        carrito.forEach(function(item) {
            articulos += item.cantidad;
            var precioConDesc = item.precio * (1 - (item.descuento || 0) / 100);
            total += precioConDesc * item.cantidad;
        });
        
        // Descuento global
        if (typeof descuentoGlobal !== 'undefined' && descuentoGlobal > 0) {
            total = total * (1 - descuentoGlobal / 100);
        }
        
        var mobileTotal = document.getElementById('mobileTotalAmount');
        var mobileArts = document.getElementById('mobileArticulos');
        var mobileBtn = document.getElementById('mobileBtnCobrar');
        
        if (mobileTotal) mobileTotal.textContent = '$' + total.toFixed(2);
        if (mobileArts) mobileArts.textContent = Math.round(articulos) + ' Arts';
        if (mobileBtn) mobileBtn.disabled = articulos === 0;
    }
    
    // ==================== MENÚ MÓVIL ====================
    function setupMobileMenu() {
        // Sincronizar datos de usuario
        setTimeout(function() {
            if (typeof API !== 'undefined' && API.usuario) {
                var u = API.usuario;
                var iniciales = (u.nombre || 'U').split(' ').map(function(n) { return n.charAt(0); }).join('').substring(0, 2);
                
                var mobileAvatar = document.getElementById('mobileUserAvatar');
                var mobileName = document.getElementById('mobileUserName');
                var mobileSuc = document.getElementById('mobileUserSucursal');
                
                if (mobileAvatar) mobileAvatar.textContent = iniciales.toUpperCase();
                if (mobileName) mobileName.textContent = u.nombre || 'Usuario';
                if (mobileSuc) mobileSuc.textContent = u.sucursal_nombre || 'Sucursal';
            }
        }, 500);
    }
    
    // Toggle menú global
    window.toggleMobileMenu = function() {
        var menu = document.getElementById('mobileMenu');
        var overlay = document.getElementById('mobileMenuOverlay');
        if (menu && overlay) {
            menu.classList.toggle('active');
            overlay.classList.toggle('active');
        }
    };
    
})();
