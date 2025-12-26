const express = require('express');
const router = express.Router();
const db = require('../config/database');

// ============================================
// LOGIN
// ============================================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [usuarios] = await db.query(
      'SELECT * FROM Usuarios WHERE UsuarioEmail = ? AND Activo = 1',
      [email]
    );
    
    if (usuarios.length === 0) {
      return res.json({ success: false, error: 'Usuario no encontrado' });
    }
    
    const usuario = usuarios[0];
    if (usuario.Contrasena !== password) {
      return res.json({ success: false, error: 'Contraseña incorrecta' });
    }
    
    const [empresas] = await db.query('SELECT * FROM Empresas WHERE EmpresaID = ?', [usuario.EmpresaID]);
    const [sucursales] = await db.query('SELECT * FROM Sucursales WHERE SucursalID = ?', [usuario.SucursalID]);
    
    res.json({
      success: true,
      usuario: {
        email: usuario.UsuarioEmail,
        nombre: usuario.Nombre,
        rol: usuario.Rol,
        empresaID: usuario.EmpresaID,
        sucursalID: usuario.SucursalID,
        empresaNombre: empresas[0]?.NombreEmpresa || usuario.EmpresaID,
        sucursalNombre: sucursales[0]?.NombreSucursal || usuario.SucursalID
      }
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// ============================================
// CARGA INICIAL POS
// ============================================
router.get('/pos/datos/:empresaID', async (req, res) => {
  try {
    const { empresaID } = req.params;
    
    const [productos] = await db.query('SELECT * FROM Productos WHERE EmpresaID = ? AND Activo = 1', [empresaID]);
    const [clientes] = await db.query('SELECT * FROM Clientes WHERE EmpresaID = ? AND Activo = 1', [empresaID]);
    const [metodosPago] = await db.query('SELECT * FROM MetodosPago WHERE EmpresaID = ? AND Activo = 1', [empresaID]);
    const [proveedores] = await db.query('SELECT * FROM Proveedores WHERE EmpresaID = ? AND Activo = 1', [empresaID]);
    
    res.json({ success: true, productos, clientes, metodosPago, proveedores });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// ============================================
// PRODUCTOS
// ============================================
router.get('/productos/:empresaID', async (req, res) => {
  try {
    const [productos] = await db.query('SELECT * FROM Productos WHERE EmpresaID = ? AND Activo = 1', [req.params.empresaID]);
    res.json({ success: true, productos });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

router.post('/productos', async (req, res) => {
  try {
    const data = req.body;
    const productoID = 'PROD_' + Math.random().toString(36).substring(2, 10).toUpperCase();
    
    await db.query(`
      INSERT INTO Productos (ProductoID, EmpresaID, ProveedorID, NombreProducto, PuntoVentaNombre, 
        CodigoBarras, Imagen, UnidadCompra, ContenidoUnidadCompra, UnidadVenta,
        Precio1, Precio2, Precio3, Precio4, Precio5, Precio6,
        PermiteDescuento, DescuentoMax, Activo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [productoID, data.empresaID, data.proveedorID || '', data.nombreProducto, 
        data.puntoVentaNombre || data.nombreProducto, data.codigoBarras || '', data.imagen || '',
        data.unidadCompra || 'PZ', data.contenidoUnidadCompra || 1, data.unidadVenta || 'PZ',
        data.precio1 || 0, data.precio2 || 0, data.precio3 || 0, 
        data.precio4 || 0, data.precio5 || 0, data.precio6 || 0,
        data.permiteDescuento || 0, data.descuentoMax || 0]);
    
    res.json({ success: true, productoID });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

router.put('/productos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const campos = Object.keys(data).map(k => `${k} = ?`).join(', ');
    const valores = Object.values(data);
    
    await db.query(`UPDATE Productos SET ${campos} WHERE ProductoID = ?`, [...valores, id]);
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

router.delete('/productos/:id', async (req, res) => {
  try {
    await db.query('UPDATE Productos SET Activo = 0 WHERE ProductoID = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// ============================================
// CLIENTES
// ============================================
router.get('/clientes/:empresaID', async (req, res) => {
  try {
    const [clientes] = await db.query('SELECT * FROM Clientes WHERE EmpresaID = ? AND Activo = 1', [req.params.empresaID]);
    res.json({ success: true, clientes });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

router.post('/clientes', async (req, res) => {
  try {
    const data = req.body;
    const clienteID = 'CLI_' + Math.random().toString(36).substring(2, 10).toUpperCase();
    
    await db.query(`
      INSERT INTO Clientes (ClienteID, EmpresaID, Nombre, Telefono, TipoPrecio, Credito, LimiteCredito, Activo)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `, [clienteID, data.empresaID, data.nombre, data.telefono || '', data.tipoPrecio || 1, data.credito || 0, data.limiteCredito || 0]);
    
    res.json({ success: true, clienteID });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

router.put('/clientes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const campos = Object.keys(data).map(k => `${k} = ?`).join(', ');
    const valores = Object.values(data);
    
    await db.query(`UPDATE Clientes SET ${campos} WHERE ClienteID = ?`, [...valores, id]);
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

router.delete('/clientes/:id', async (req, res) => {
  try {
    await db.query('UPDATE Clientes SET Activo = 0 WHERE ClienteID = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// ============================================
// VENTAS
// ============================================
router.post('/ventas', async (req, res) => {
  try {
    const data = req.body;
    const ventaID = 'VTA_' + Math.random().toString(36).substring(2, 10).toUpperCase();
    const fechaHora = new Date();
    
    await db.query(`
      INSERT INTO Ventas (VentaID, EmpresaID, SucursalID, ClienteID, UsuarioEmail, FechaHora, TipoPrecio, Total, TipoVenta, Estatus)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [ventaID, data.empresaID, data.sucursalID, data.clienteID || '', data.usuarioEmail, fechaHora, 
        data.tipoPrecio || 1, data.total, data.tipoVenta || 'CONTADO', data.estatus || 'PAGADA']);
    
    // Insertar detalles
    for (const item of data.items) {
      const detalleID = 'DET_' + Math.random().toString(36).substring(2, 10).toUpperCase();
      await db.query(`
        INSERT INTO DetalleVenta (DetalleID, VentaID, ProductoID, Cantidad, PrecioUnitario, DescuentoPct, DescuentoMonto, Subtotal, FechaHora)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [detalleID, ventaID, item.productoID, item.cantidad, item.precioUnitario, item.descuentoPct || 0, item.descuentoMonto || 0, item.subtotal, fechaHora]);
    }
    
    // Insertar pagos
    if (data.pagos && data.pagos.length > 0) {
      for (const pago of data.pagos) {
        if (pago.monto > 0) {
          const abonoID = 'ABO_' + Math.random().toString(36).substring(2, 10).toUpperCase();
          await db.query(`
            INSERT INTO Abonos (AbonoID, VentaID, EmpresaID, MetodoPagoID, Monto, UsuarioEmail, FechaHora)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [abonoID, ventaID, data.empresaID, pago.metodoPagoID, pago.monto, data.usuarioEmail, fechaHora]);
        }
      }
    }
    
    res.json({ success: true, ventaID });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

router.get('/ventas/:empresaID/:sucursalID/hoy', async (req, res) => {
  try {
    const { empresaID, sucursalID } = req.params;
    const [ventas] = await db.query(`
      SELECT * FROM Ventas 
      WHERE EmpresaID = ? AND SucursalID = ? AND DATE(FechaHora) = CURDATE()
    `, [empresaID, sucursalID]);
    
    res.json({ success: true, ventas });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

router.get('/ventas/:empresaID/:sucursalID/espera', async (req, res) => {
  try {
    const { empresaID, sucursalID } = req.params;
    const [ventas] = await db.query(`
      SELECT * FROM Ventas 
      WHERE EmpresaID = ? AND SucursalID = ? AND Estatus = 'EN_ESPERA'
    `, [empresaID, sucursalID]);
    
    for (let venta of ventas) {
      const [items] = await db.query('SELECT * FROM DetalleVenta WHERE VentaID = ?', [venta.VentaID]);
      venta.items = items;
    }
    
    res.json({ success: true, ventas });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

router.put('/ventas/:id/estatus', async (req, res) => {
  try {
    const { id } = req.params;
    const { estatus } = req.body;
    await db.query('UPDATE Ventas SET Estatus = ? WHERE VentaID = ?', [estatus, id]);
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

router.get('/ventas/ticket/:empresaID/:sucursalID', async (req, res) => {
  try {
    const { empresaID, sucursalID } = req.params;
    const [result] = await db.query(`
      SELECT COUNT(*) as total FROM Ventas 
      WHERE EmpresaID = ? AND SucursalID = ? AND DATE(FechaHora) = CURDATE()
    `, [empresaID, sucursalID]);
    
    res.json({ success: true, ticket: (result[0]?.total || 0) + 1 });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

module.exports = router;
