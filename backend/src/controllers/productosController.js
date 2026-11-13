// backend/src/controllers/productosController.js
const db = require('../config/db');

/**
 * GET /api/productos/buscar?codigo=...&sucursal=...
 * Búsqueda optimizada para caja POS, lector de códigos de barras y balanzas etiquetadoras.
 */
const buscarProductoPorCodigo = async (req, res) => {
  try {
    const { codigo, sucursal } = req.query;
    const comercioId = req.usuario?.comercio_id;

    if (!codigo) {
      return res.status(400).json({ error: 'Debe ingresar un código de producto' });
    }

    if (!comercioId) {
      return res.status(403).json({ error: 'Comercio no especificado en la sesión' });
    }

    // Sanitización robusta de la sucursal para evitar NaN o strings 'null'/'undefined'
    const rawSucursal = sucursal || req.query.sucursalId || req.usuario?.sucursalId;
    let sucursalNum = parseInt(rawSucursal, 10);
    if (isNaN(sucursalNum) || sucursalNum <= 0) {
      if (req.usuario?.sucursalId) {
        sucursalNum = parseInt(req.usuario.sucursalId, 10);
      }
    }
    if (isNaN(sucursalNum) || sucursalNum <= 0) {
      const sucursalDefault = await db.query(
        'SELECT id FROM public.sucursales WHERE comercio_id = $1 ORDER BY id ASC LIMIT 1',
        [comercioId]
      );
      if (sucursalDefault.rows.length > 0) {
        sucursalNum = sucursalDefault.rows[0].id;
      }
    }

    if (!sucursalNum) {
      return res.status(400).json({ error: 'Debe especificar una sucursal' });
    }

    const codigoSanitizado = String(codigo).trim();
    let producto = null;
    let cantidadDetectada = 1;

    // =========================================================================
    // 1. PROTOCOLO BALANZA ETIQUETADORA (EAN-13 Prefijo 20 + 13 dígitos)
    // Formato estándar: [20][PLU 5 dígitos][PESO en gramos 5 dígitos][Dígito de control]
    // Ejemplo: 2000145012503 -> PLU '00145', Peso: 1.250 kg
    // =========================================================================
    if (codigoSanitizado.startsWith('20') && codigoSanitizado.length === 13) {
      const codigoPlu = codigoSanitizado.slice(2, 7);
      const pesoGramos = Number(codigoSanitizado.slice(7, 12));
      cantidadDetectada = Math.round((pesoGramos / 1000) * 1000) / 1000;

      const queryBalanza = `
        SELECT 
          p.id AS producto_id,
          p.id AS producto_unificado_id,
          p.nombre AS nombre_producto,
          p.nombre,
          p.categoria AS tipo_producto,
          p.categoria,
          p.codigo_barras,
          p.es_pesable,
          p.codigo_plu,
          p.unidad_medida,
          p.precio_compra,
          p.precio_efectivo,
          p.precio_tarjeta,
          p.atributos,
          COALESCE(st.cantidad, 0) AS cantidad,
          COALESCE(st.stock_minimo, 0) AS stock_minimo
        FROM public.productos p
        LEFT JOIN public.stock st ON st.producto_unificado_id = p.id 
                                  AND st.comercio_id = p.comercio_id 
                                  AND st.sucursal_id = $3
        WHERE p.comercio_id = $1 
          AND p.es_pesable = true 
          AND (p.codigo_plu = $2 OR TRIM(LEADING '0' FROM p.codigo_plu) = TRIM(LEADING '0' FROM $2))
          AND p.activo = true
        LIMIT 1
      `;

      const resBalanza = await db.query(queryBalanza, [comercioId, codigoPlu, sucursalNum]);
      if (resBalanza.rows.length > 0) {
        producto = resBalanza.rows[0];
      }
    }

    // =========================================================================
    // 2. BÚSQUEDA NORMAL POR CÓDIGO DE BARRAS, PLU O NOMBRE (CATÁLOGO UNIFICADO)
    // =========================================================================
    if (!producto) {
      const queryNormal = `
        SELECT 
          p.id AS producto_id,
          p.id AS producto_unificado_id,
          p.nombre AS nombre_producto,
          p.nombre,
          p.categoria AS tipo_producto,
          p.categoria,
          p.codigo_barras,
          p.es_pesable,
          p.codigo_plu,
          p.unidad_medida,
          p.precio_compra,
          p.precio_efectivo,
          p.precio_tarjeta,
          p.atributos,
          COALESCE(st.cantidad, 0) AS cantidad,
          COALESCE(st.stock_minimo, 0) AS stock_minimo
        FROM public.productos p
        LEFT JOIN public.stock st ON st.producto_unificado_id = p.id 
                                  AND st.comercio_id = p.comercio_id 
                                  AND st.sucursal_id = $3
        WHERE p.comercio_id = $1 
          AND (TRIM(p.codigo_barras) = $2 OR TRIM(p.codigo_plu) = $2 OR LOWER(p.nombre) = LOWER($2))
          AND p.activo = true
        LIMIT 1
      `;

      const resNormal = await db.query(queryNormal, [comercioId, codigoSanitizado, sucursalNum]);
      if (resNormal.rows.length > 0) {
        producto = resNormal.rows[0];
      }
    }

    // 2.1 Fallback si no tiene registro de stock aún en esa sucursal
    if (!producto) {
      const querySinStock = `
        SELECT 
          p.id AS producto_id,
          p.id AS producto_unificado_id,
          p.nombre AS nombre_producto,
          p.nombre,
          p.categoria AS tipo_producto,
          p.categoria,
          p.codigo_barras,
          p.es_pesable,
          p.codigo_plu,
          p.unidad_medida,
          p.precio_compra,
          p.precio_efectivo,
          p.precio_tarjeta,
          p.atributos,
          0 AS cantidad,
          0 AS stock_minimo
        FROM public.productos p
        WHERE p.comercio_id = $1 
          AND (TRIM(p.codigo_barras) = $2 OR TRIM(p.codigo_plu) = $2 OR LOWER(p.nombre) = LOWER($2))
          AND p.activo = true
        LIMIT 1
      `;
      const resSinStock = await db.query(querySinStock, [comercioId, codigoSanitizado]);
      if (resSinStock.rows.length > 0) {
        producto = resSinStock.rows[0];
      }
    }

    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    // Parsear campos numéricos para evitar strings decimales como "0.000"
    producto.cantidad = Number(producto.cantidad) || 0;
    producto.stock_minimo = Number(producto.stock_minimo) || 0;
    producto.precio_efectivo = Number(producto.precio_efectivo) || 0;
    producto.precio_tarjeta = Number(producto.precio_tarjeta) || 0;
    if (producto.precio_compra !== undefined && producto.precio_compra !== null) {
      producto.precio_compra = Number(producto.precio_compra) || 0;
    }

    // Formatear atributos legacy para compatibilidad con el frontend actual
    const atributos = producto.atributos || {};
    if (atributos.autor && !producto.autor) producto.autor = atributos.autor;
    if (atributos.editorial && !producto.editorial) producto.editorial = atributos.editorial;
    if (atributos.talle && !producto.talle) producto.talle = atributos.talle;
    if (atributos.color && !producto.color) producto.color = atributos.color;
    if (atributos.colegio && !producto.colegio) producto.colegio = atributos.colegio;

    // Adjuntar la cantidad detectada (peso en balanza o 1 unidad estándar)
    producto.cantidad_detectada = cantidadDetectada;

    // Ocultar precio_compra si el usuario no es jefe ni dueño
    if (req.usuario?.rol !== 'jefe' && req.usuario?.rol !== 'DUENO') {
      delete producto.precio_compra;
    }

    return res.json(producto);

  } catch (error) {
    console.error('Error al buscar producto:', error);
    return res.status(500).json({ error: 'Error interno al buscar producto' });
  }
};

/**
 * GET /api/productos
 * Obtiene el listado de productos del comercio autenticado con su stock por sucursal.
 */
const obtenerProductos = async (req, res) => {
  try {
    const comercioId = req.usuario?.comercio_id;
    const { sucursal_id, sucursalId, categoria, es_pesable, busqueda, activo } = req.query;
    const targetSucursal = sucursal_id || sucursalId || null;

    let sql = `
      SELECT 
        p.id,
        p.id AS producto_id,
        p.id AS producto_unificado_id,
        p.comercio_id,
        p.categoria,
        p.categoria AS tipo_producto,
        p.nombre,
        p.nombre AS nombre_producto,
        p.codigo_barras,
        p.es_pesable,
        p.codigo_plu,
        p.unidad_medida,
        p.precio_compra,
        p.precio_efectivo,
        p.precio_tarjeta,
        p.atributos,
        p.activo,
        p.created_at,
        p.updated_at,
        COALESCE(st.cantidad, 0) AS cantidad,
        COALESCE(st.stock_minimo, 0) AS stock_minimo,
        st.sucursal_id
      FROM public.productos p
      LEFT JOIN public.stock st ON st.producto_unificado_id = p.id 
                                AND st.comercio_id = p.comercio_id
                                AND (st.sucursal_id = $2 OR $2 IS NULL)
      WHERE p.comercio_id = $1
    `;

    const params = [comercioId, targetSucursal ? Number(targetSucursal) : null];

    if (activo !== undefined && activo !== null && activo !== '') {
      params.push(activo === 'true' || activo === true);
      sql += ` AND p.activo = $${params.length}`;
    } else {
      sql += ` AND p.activo = true`;
    }

    if (categoria && categoria.trim() !== '') {
      params.push(categoria.trim());
      sql += ` AND p.categoria = $${params.length}`;
    }

    if (es_pesable !== undefined && es_pesable !== null && es_pesable !== '') {
      params.push(es_pesable === 'true' || es_pesable === true);
      sql += ` AND p.es_pesable = $${params.length}`;
    }

    if (busqueda && busqueda.trim() !== '') {
      params.push(`%${busqueda.trim()}%`);
      const exactParamIndex = params.length + 1;
      params.push(busqueda.trim());
      sql += ` AND (p.nombre ILIKE $${params.length - 1} OR p.codigo_barras = $${exactParamIndex} OR p.codigo_plu = $${exactParamIndex})`;
    }

    sql += ` ORDER BY p.nombre ASC`;

    const result = await db.query(sql, params);
    const esAdmin = req.usuario?.rol === 'jefe' || req.usuario?.rol === 'DUENO';

    const productos = result.rows.map(prod => {
      prod.cantidad = Number(prod.cantidad) || 0;
      prod.stock_minimo = Number(prod.stock_minimo) || 0;
      prod.precio_efectivo = Number(prod.precio_efectivo) || 0;
      prod.precio_tarjeta = Number(prod.precio_tarjeta) || 0;
      if (prod.precio_compra !== undefined && prod.precio_compra !== null) {
        if (!esAdmin) {
          delete prod.precio_compra;
        } else {
          prod.precio_compra = Number(prod.precio_compra) || 0;
        }
      }
      return prod;
    });

    return res.json(productos);
  } catch (error) {
    console.error('Error al obtener productos:', error);
    return res.status(500).json({ error: 'Error interno al consultar productos' });
  }
};

/**
 * GET /api/productos/:id
 */
const obtenerProductoPorId = async (req, res) => {
  try {
    const { id } = req.params;
    const comercioId = req.usuario?.comercio_id;

    const result = await db.query(
      `SELECT * FROM public.productos WHERE id = $1 AND comercio_id = $2 AND activo = true`,
      [Number(id), comercioId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const prod = result.rows[0];
    if (req.usuario?.rol !== 'jefe' && req.usuario?.rol !== 'DUENO') {
      delete prod.precio_compra;
    }

    return res.json(prod);
  } catch (error) {
    console.error('Error al obtener producto por ID:', error);
    return res.status(500).json({ error: 'Error interno al consultar producto' });
  }
};

/**
 * POST /api/productos
 * Crea un producto en el catálogo unificado `public.productos` vinculado al tenant,
 * e inserta su registro inicial en `public.stock` dentro de la misma transacción SQL.
 */
const crearProducto = async (req, res) => {
  const comercioId = req.usuario?.comercio_id;

  const {
    categoria,
    tipo,
    nombre,
    codigo_barras,
    es_pesable = false,
    codigo_plu,
    unidad_medida = 'unidad',
    precio_compra = 0,
    precio_efectivo,
    precio_tarjeta,
    atributos = {},
    sucursal_id,
    sucursalId,
    cantidad_inicial = 0,
    autor,
    editorial,
    colegio,
    talle,
    color,
    marca,
    fecha_vencimiento,
    descripcion_extra
  } = req.body;

  let client;
  try {
    client = await db.pool.connect();
    await client.query('BEGIN'); // Transacción atómica requerida

    // Determinar sucursal destino: enviada en body, del token o primera sucursal del comercio
    let targetSucursalId = sucursal_id || sucursalId || req.usuario?.sucursalId;
    if (!targetSucursalId) {
      const sucRes = await client.query(
        'SELECT id FROM public.sucursales WHERE comercio_id = $1 ORDER BY id ASC LIMIT 1',
        [comercioId]
      );
      if (sucRes.rows.length > 0) {
        targetSucursalId = sucRes.rows[0].id;
      }
    }

    // Normalizar categoría y mapear campos legacy hacia JSONB atributos
    const catFinal = (categoria || tipo || 'general').toString().trim().toLowerCase();
    const atributosFinales = { ...(atributos || {}) };

    if (autor) atributosFinales.autor = autor;
    if (editorial) atributosFinales.editorial = editorial;
    if (colegio) atributosFinales.colegio = colegio;
    if (talle) atributosFinales.talle = talle;
    if (color) atributosFinales.color = color;
    if (marca) atributosFinales.marca = marca;
    if (fecha_vencimiento) atributosFinales.fecha_vencimiento = fecha_vencimiento;
    if (descripcion_extra) atributosFinales.descripcion_extra = descripcion_extra;

    const insertSql = `
      INSERT INTO public.productos (
        comercio_id, categoria, nombre, codigo_barras, es_pesable,
        codigo_plu, unidad_medida, precio_compra, precio_efectivo,
        precio_tarjeta, atributos, activo, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, NOW(), NOW())
      RETURNING *;
    `;

    const values = [
      comercioId,
      catFinal,
      nombre.trim(),
      codigo_barras ? codigo_barras.trim() : null,
      Boolean(es_pesable),
      codigo_plu ? codigo_plu.trim() : null,
      unidad_medida || (es_pesable ? 'kg' : 'unidad'),
      Number(precio_compra) || 0,
      Number(precio_efectivo) || 0,
      Number(precio_tarjeta !== undefined && precio_tarjeta !== null ? precio_tarjeta : precio_efectivo),
      atributosFinales
    ];

    const result = await client.query(insertSql, values);
    const nuevoProducto = result.rows[0];

    // Carga de stock inicial con producto_unificado_id en la misma transacción
    const cantInicialNum = Number(cantidad_inicial) || 0;
    if (targetSucursalId) {
      const checkStock = await client.query(
        `SELECT id FROM public.stock 
         WHERE comercio_id = $1 AND sucursal_id = $2 AND producto_unificado_id = $3`,
        [comercioId, Number(targetSucursalId), nuevoProducto.id]
      );

      if (checkStock.rows.length > 0) {
        await client.query(
          `UPDATE public.stock 
           SET cantidad = cantidad + $1, updated_at = NOW() 
           WHERE id = $2`,
          [cantInicialNum, checkStock.rows[0].id]
        );
      } else {
        await client.query(
          `INSERT INTO public.stock (
             comercio_id, producto_unificado_id, sucursal_id, cantidad, stock_minimo, 
             tipo_producto, producto_id, updated_at
           ) VALUES ($1, $2, $3, $4, 5, $5, $2, NOW())`,
          [comercioId, nuevoProducto.id, Number(targetSucursalId), cantInicialNum, catFinal]
        );
      }
    }

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      mensaje: 'Producto creado exitosamente con stock inicial',
      id: nuevoProducto.id,
      producto: nuevoProducto
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('Error al crear producto:', error);
    return res.status(500).json({ error: 'Error al registrar el producto en la base de datos' });
  } finally {
    if (client) client.release();
  }
};

/**
 * PUT /api/productos/:id (y soporte legacy /api/productos/:tipo/:id)
 */
const actualizarProducto = async (req, res) => {
  const { id } = req.params;
  const comercioId = req.usuario?.comercio_id;
  const productoId = parseInt(id, 10);

  const {
    categoria,
    tipo,
    nombre,
    codigo_barras,
    es_pesable,
    codigo_plu,
    unidad_medida,
    precio_compra,
    precio_efectivo,
    precio_tarjeta,
    atributos,
    autor,
    editorial,
    colegio,
    talle,
    color,
    marca,
    fecha_vencimiento,
    descripcion_extra
  } = req.body;

  try {
    // 1. Obtener producto existente para validar tenant
    const prodExistente = await db.query(
      'SELECT * FROM public.productos WHERE id = $1 AND comercio_id = $2',
      [productoId, comercioId]
    );

    if (prodExistente.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado o no pertenece a tu comercio' });
    }

    const anterior = prodExistente.rows[0];

    // Mergear atributos existentes con nuevos
    const atributosActualizados = { ...(anterior.atributos || {}), ...(atributos || {}) };
    if (autor !== undefined) atributosActualizados.autor = autor;
    if (editorial !== undefined) atributosActualizados.editorial = editorial;
    if (colegio !== undefined) atributosActualizados.colegio = colegio;
    if (talle !== undefined) atributosActualizados.talle = talle;
    if (color !== undefined) atributosActualizados.color = color;
    if (marca !== undefined) atributosActualizados.marca = marca;
    if (fecha_vencimiento !== undefined) atributosActualizados.fecha_vencimiento = fecha_vencimiento;
    if (descripcion_extra !== undefined) atributosActualizados.descripcion_extra = descripcion_extra;

    const catFinal = categoria || tipo || anterior.categoria;

    const updateSql = `
      UPDATE public.productos
      SET 
        categoria = COALESCE($1, categoria),
        nombre = COALESCE(NULLIF($2, ''), nombre),
        codigo_barras = COALESCE(NULLIF($3, ''), codigo_barras),
        es_pesable = COALESCE($4, es_pesable),
        codigo_plu = COALESCE(NULLIF($5, ''), codigo_plu),
        unidad_medida = COALESCE(NULLIF($6, ''), unidad_medida),
        precio_compra = COALESCE($7, precio_compra),
        precio_efectivo = COALESCE($8, precio_efectivo),
        precio_tarjeta = COALESCE($9, precio_tarjeta),
        atributos = $10,
        updated_at = NOW()
      WHERE id = $11 AND comercio_id = $12
      RETURNING *;
    `;

    const values = [
      catFinal || null,
      nombre ? nombre.trim() : null,
      codigo_barras ? codigo_barras.trim() : null,
      es_pesable !== undefined ? Boolean(es_pesable) : null,
      codigo_plu ? codigo_plu.trim() : null,
      unidad_medida || null,
      precio_compra !== undefined && precio_compra !== '' ? Number(precio_compra) : null,
      precio_efectivo !== undefined && precio_efectivo !== '' ? Number(precio_efectivo) : null,
      precio_tarjeta !== undefined && precio_tarjeta !== '' ? Number(precio_tarjeta) : null,
      atributosActualizados,
      productoId,
      comercioId
    ];

    const result = await db.query(updateSql, values);
    return res.json({
      success: true,
      mensaje: 'Producto actualizado correctamente',
      producto: result.rows[0]
    });
  } catch (error) {
    console.error('Error actualizando producto:', error);
    return res.status(500).json({ error: 'Error al actualizar el producto' });
  }
};

/**
 * DELETE /api/productos/:id (y soporte legacy /api/productos/:tipo/:id)
 * Soft delete respetando multi-tenant: UPDATE public.productos SET activo = false, updated_at = NOW() WHERE id = $1 AND comercio_id = $2
 */
const eliminarProducto = async (req, res) => {
  const { id, tipo } = req.params;
  const comercioId = req.usuario?.comercio_id;
  const productoId = parseInt(id, 10);

  if (isNaN(productoId)) {
    return res.status(400).json({ error: 'ID de producto inválido' });
  }

  try {
    // 1. Soft delete en catálogo unificado
    const result = await db.query(
      `UPDATE public.productos 
       SET activo = false, updated_at = NOW() 
       WHERE id = $1 AND comercio_id = $2 
       RETURNING id`,
      [productoId, comercioId]
    );

    if (result.rowCount === 0) {
      // Buscar si el ID provisto es de public.stock (id) o de libros/ropa
      const resStock = await db.query(
        `SELECT producto_unificado_id, producto_id, tipo_producto 
         FROM public.stock 
         WHERE (id = $1 OR producto_id = $1 OR producto_unificado_id = $1) AND comercio_id = $2 
         LIMIT 1`,
        [productoId, comercioId]
      );

      if (resStock.rows.length > 0) {
        const row = resStock.rows[0];
        if (row.producto_unificado_id) {
          await db.query(
            `UPDATE public.productos SET activo = false, updated_at = NOW() WHERE id = $1 AND comercio_id = $2`,
            [row.producto_unificado_id, comercioId]
          );
        }
        if (row.tipo_producto === 'libro') {
          await db.query(`UPDATE public.libros SET activo = false WHERE id = $1`, [row.producto_id]);
        } else if (row.tipo_producto === 'ropa') {
          await db.query(`UPDATE public.ropa SET activo = false WHERE id = $1`, [row.producto_id]);
        }
      } else if (tipo === 'libro') {
        await db.query(`UPDATE public.libros SET activo = false WHERE id = $1`, [productoId]);
      } else if (tipo === 'ropa') {
        await db.query(`UPDATE public.ropa SET activo = false WHERE id = $1`, [productoId]);
      } else {
        return res.status(404).json({ error: 'Producto no encontrado o no pertenece a tu comercio' });
      }
    }

    return res.json({ success: true, mensaje: 'Producto dado de baja correctamente' });
  } catch (error) {
    console.error('Error al dar de baja producto:', error);
    return res.status(500).json({ error: 'Error al procesar la baja del producto' });
  }
};

/**
 * PUT /api/productos/precios-lote
 * Actualiza en bloque precios (efectivo y tarjeta) de una lista de productos en una transacción SQL
 */
const actualizarPreciosLote = async (req, res) => {
  const comercioId = req.usuario?.comercio_id;
  const items = Array.isArray(req.body) ? req.body : req.body.productos;

  if (!items || !items.length) {
    return res.status(400).json({ error: 'No se enviaron productos para actualizar' });
  }

  let client;
  try {
    client = await db.pool.connect();
    await client.query('BEGIN');

    let actualizados = 0;
    for (const item of items) {
      const prodId = parseInt(item.id, 10);
      const precioEfectivo = Number(item.precio_efectivo);
      const precioTarjeta = Number(item.precio_tarjeta);

      if (isNaN(prodId) || isNaN(precioEfectivo) || isNaN(precioTarjeta)) {
        continue;
      }

      const resUpd = await client.query(
        `UPDATE public.productos
         SET precio_efectivo = $1,
             precio_tarjeta = $2,
             updated_at = NOW()
         WHERE id = $3 AND comercio_id = $4 AND activo = true
         RETURNING id`,
        [precioEfectivo, precioTarjeta, prodId, comercioId]
      );

      if (resUpd.rowCount > 0) {
        actualizados++;
      }
    }

    await client.query('COMMIT');

    return res.json({
      success: true,
      mensaje: `Se actualizaron los precios de ${actualizados} productos correctamente`,
      actualizados
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('Error al actualizar precios en lote:', error);
    return res.status(500).json({ error: 'Error interno al actualizar precios en lote' });
  } finally {
    if (client) client.release();
  }
};

/**
 * POST /api/productos/actualizar-precios-masivo
 * Actualiza masivamente precio_efectivo y precio_tarjeta por porcentaje y redondeo
 */
const actualizarPreciosMasivo = async (req, res) => {
  try {
    const comercioId = req.usuario?.comercio_id;
    const { categoria, porcentaje, redondeo } = req.body;

    const catNormalizada = (categoria || 'todas').toString().trim().toLowerCase();
    const porcentajeNum = Number(porcentaje);
    const redondeoNum = Number(redondeo) || 1;

    let sql = `
      UPDATE public.productos
      SET 
        precio_efectivo = GREATEST(0, ROUND((precio_efectivo * (1.0 + $1::numeric / 100.0)) / $2::numeric) * $2::numeric),
        precio_tarjeta = GREATEST(0, ROUND((COALESCE(precio_tarjeta, precio_efectivo) * (1.0 + $1::numeric / 100.0)) / $2::numeric) * $2::numeric),
        updated_at = NOW()
      WHERE comercio_id = $3 
        AND activo = true
    `;

    const params = [porcentajeNum, redondeoNum, comercioId];

    if (catNormalizada !== 'todas' && catNormalizada !== '') {
      params.push(catNormalizada);
      sql += ` AND LOWER(categoria) = $${params.length}`;
    }

    sql += ` RETURNING id, nombre, categoria, precio_efectivo, precio_tarjeta;`;

    const result = await db.query(sql, params);

    return res.json({
      success: true,
      mensaje: `Se actualizaron los precios de ${result.rowCount} productos`,
      actualizados: result.rowCount,
      productos: result.rows
    });
  } catch (error) {
    console.error('Error al actualizar precios masivos:', error);
    return res.status(500).json({ error: 'Error interno al actualizar precios masivos' });
  }
};

module.exports = {
  buscarProductoPorCodigo,
  obtenerProductos,
  obtenerProductoPorId,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
  actualizarPreciosMasivo,
  actualizarPreciosLote
};
