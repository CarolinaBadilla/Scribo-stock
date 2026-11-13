BEGIN;

-- ============================================================================
-- 1. TABLA MAESTRA DE COMERCIOS (TENANTS) Y SUPERADMIN SAAS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.comercios (
    id SERIAL PRIMARY KEY,
    nombre_comercial VARCHAR(150) NOT NULL,
    razon_social VARCHAR(200),
    cuit VARCHAR(20),
    rubro_principal VARCHAR(50) DEFAULT 'general', -- 'libreria_ropa', 'kiosco', 'almacen', etc.
    plan VARCHAR(30) DEFAULT 'basico',
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Insertamos el comercio inicial (tu negocio actual) para migrar los datos existentes
INSERT INTO public.comercios (id, nombre_comercial, rubro_principal, plan)
VALUES (1, 'Scribo Principal', 'libreria_ropa', 'pro')
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('public.comercios', 'id'), (SELECT MAX(id) FROM public.comercios));

-- ============================================================================
-- 2. CREDENCIALES E INTEGRACIONES POR COMERCIO (MERCADO PAGO QR + AFIP/ARCA)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.integraciones_comercio (
    id SERIAL PRIMARY KEY,
    comercio_id INTEGER NOT NULL UNIQUE REFERENCES public.comercios(id) ON DELETE CASCADE,
    
    -- Mercado Pago (Modelo QR Atendido / OAuth)
    mp_activo BOOLEAN DEFAULT false,
    mp_user_id VARCHAR(100),
    mp_access_token_enc TEXT,      -- Guardado encriptado (AES-256)
    mp_refresh_token_enc TEXT,     -- Para renovación automática OAuth
    mp_webhook_secret_enc TEXT,
    
    -- AFIP / ARCA (Facturación Electrónica)
    afip_activo BOOLEAN DEFAULT false,
    afip_entorno VARCHAR(20) DEFAULT 'homologacion', -- 'homologacion' | 'produccion'
    afip_cuit VARCHAR(20),
    afip_punto_venta INTEGER,
    afip_condicion_iva VARCHAR(30) DEFAULT 'monotributo', -- 'monotributo' | 'responsable_inscripto'
    afip_certificado_enc TEXT,     -- Contenido .crt encriptado
    afip_clave_privada_enc TEXT,   -- Contenido .key encriptado
    afip_token_wsaa TEXT,          -- Cache del Ticket de Acceso (dura 12h)
    afip_sign_wsaa TEXT,
    afip_expiracion_wsaa TIMESTAMPTZ,
    
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO public.integraciones_comercio (comercio_id)
VALUES (1)
ON CONFLICT (comercio_id) DO NOTHING;

-- ============================================================================
-- 3. ACTUALIZAR SUCURSALES (MULTI-TENANT + QR FIJO POR CAJA)
-- ============================================================================
ALTER TABLE public.sucursales 
    ADD COLUMN IF NOT EXISTS comercio_id INTEGER REFERENCES public.comercios(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS mp_external_store_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS mp_external_pos_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS mp_qr_imagen_url TEXT,
    ADD COLUMN IF NOT EXISTS mp_qr_data TEXT; -- String del QR único de mostrador

UPDATE public.sucursales SET comercio_id = 1 WHERE comercio_id IS NULL;
ALTER TABLE public.sucursales ALTER COLUMN comercio_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sucursales_comercio ON public.sucursales(comercio_id);

-- ============================================================================
-- 4. ACTUALIZAR USUARIOS (MULTI-TENANT + ROL SUPERADMIN)
-- ============================================================================
ALTER TABLE public.usuarios 
    ADD COLUMN IF NOT EXISTS comercio_id INTEGER REFERENCES public.comercios(id) ON DELETE CASCADE;

UPDATE public.usuarios SET comercio_id = 1 WHERE comercio_id IS NULL;

-- Permitimos que el mismo nombre de usuario exista en comercios distintos
ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_usuario_key;
ALTER TABLE public.usuarios 
    ADD CONSTRAINT usuarios_comercio_usuario_unique UNIQUE (comercio_id, usuario);

CREATE INDEX IF NOT EXISTS idx_usuarios_comercio ON public.usuarios(comercio_id);

-- ============================================================================
-- 5. NUEVA TABLA UNIFICADA DE PRODUCTOS (CON SOPORTE PARA BALANZAS Y RUBROS)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.productos (
    id SERIAL PRIMARY KEY,
    comercio_id INTEGER NOT NULL REFERENCES public.comercios(id) ON DELETE CASCADE,
    categoria VARCHAR(80) DEFAULT 'general',       -- 'libro', 'ropa', 'kiosco', 'fiambreria', etc.
    nombre VARCHAR(255) NOT NULL,
    codigo_barras VARCHAR(100),
    
    -- Soporte para Balanzas (Etiquetadoras EAN-13 prefijo 20 o Serial USB)
    es_pesable BOOLEAN DEFAULT false,
    codigo_plu VARCHAR(10),                        -- Código de 5 dígitos de la balanza (ej: '00145')
    unidad_medida VARCHAR(10) DEFAULT 'unidad',    -- 'unidad' | 'kg' | 'g'
    
    -- Precios
    precio_compra NUMERIC(10,2) DEFAULT 0,
    precio_efectivo NUMERIC(10,2) DEFAULT 0 NOT NULL,
    precio_tarjeta NUMERIC(10,2) DEFAULT 0 NOT NULL, -- Aplica también a QR Mercado Pago
    
    -- Atributos dinámicos por rubro (autor, editorial, talle, color, fecha_vencimiento, etc.)
    atributos JSONB DEFAULT '{}'::jsonb,
    
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Índices para búsqueda instantánea con lector de código de barras y balanza
CREATE INDEX IF NOT EXISTS idx_productos_comercio_codigo ON public.productos(comercio_id, codigo_barras);
CREATE INDEX IF NOT EXISTS idx_productos_comercio_plu ON public.productos(comercio_id, codigo_plu) WHERE es_pesable = true;

-- ============================================================================
-- 6. MIGRACIÓN DE LIBROS Y ROPA EXISTENTES HACIA PRODUCTOS UNIFICADOS
-- ============================================================================
CREATE TEMP TABLE temp_mapeo_productos (
    tipo_anterior VARCHAR(20),
    id_anterior INTEGER,
    nuevo_producto_id INTEGER
);

-- Migrar libros -> productos
WITH libros_insertados AS (
    INSERT INTO public.productos (
        comercio_id, categoria, nombre, codigo_barras, es_pesable, unidad_medida,
        precio_compra, precio_efectivo, precio_tarjeta, atributos, activo, created_at, updated_at
    )
    SELECT 
        1, 'libro', titulo, codigo_barras, false, 'unidad',
        COALESCE(precio_compra, 0), precio_efectivo, precio_tarjeta,
        jsonb_build_object('autor', autor, 'editorial', editorial),
        COALESCE(activo, true), created_at, updated_at
    FROM public.libros
    RETURNING id, nombre, created_at
)
INSERT INTO temp_mapeo_productos (tipo_anterior, id_anterior, nuevo_producto_id)
SELECT 'libro', l.id, p.id
FROM public.libros l
JOIN public.productos p ON p.comercio_id = 1 AND p.categoria = 'libro' AND p.nombre = l.titulo AND p.created_at = l.created_at;

-- Migrar ropa -> productos
INSERT INTO public.productos (
    comercio_id, categoria, nombre, codigo_barras, es_pesable, unidad_medida,
    precio_compra, precio_efectivo, precio_tarjeta, atributos, activo, created_at, updated_at
)
SELECT 
    1, 'ropa', nombre, codigo_barras, false, 'unidad',
    COALESCE(precio_compra, 0), precio_efectivo, precio_tarjeta,
    jsonb_build_object('colegio', colegio, 'talle', talle, 'color', color, 'ganancia', ganancia),
    COALESCE(activo, true), created_at, updated_at
FROM public.ropa;

INSERT INTO temp_mapeo_productos (tipo_anterior, id_anterior, nuevo_producto_id)
SELECT 'ropa', r.id, p.id
FROM public.ropa r
JOIN public.productos p ON p.comercio_id = 1 AND p.categoria = 'ropa' AND p.nombre = r.nombre AND p.created_at = r.created_at;

-- ============================================================================
-- 7. ACTUALIZAR STOCK (SOPORTE DECIMALES PARA BALANZA Y MULTI-TENANT)
-- ============================================================================
ALTER TABLE public.stock 
    ADD COLUMN IF NOT EXISTS comercio_id INTEGER REFERENCES public.comercios(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS producto_unificado_id INTEGER REFERENCES public.productos(id) ON DELETE CASCADE,
    ALTER COLUMN cantidad TYPE NUMERIC(10,3),
    ALTER COLUMN stock_minimo TYPE NUMERIC(10,3);

UPDATE public.stock s
SET 
    comercio_id = 1,
    producto_unificado_id = m.nuevo_producto_id
FROM temp_mapeo_productos m
WHERE s.tipo_producto = m.tipo_anterior AND s.producto_id = m.id_anterior;

-- Si había filas huérfanas en stock, asignamos comercio_id = 1
UPDATE public.stock SET comercio_id = 1 WHERE comercio_id IS NULL;
ALTER TABLE public.stock ALTER COLUMN comercio_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stock_comercio_sucursal ON public.stock(comercio_id, sucursal_id);

-- ============================================================================
-- 8. ACTUALIZAR MOVIMIENTOS (VENTAS DECIMALES, MERCADO PAGO Y FACTURACIÓN AFIP)
-- ============================================================================
ALTER TABLE public.movimientos
    ADD COLUMN IF NOT EXISTS comercio_id INTEGER REFERENCES public.comercios(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS producto_unificado_id INTEGER REFERENCES public.productos(id) ON DELETE SET NULL,
    ALTER COLUMN cantidad TYPE NUMERIC(10,3),
    -- Trazabilidad Mercado Pago
    ADD COLUMN IF NOT EXISTS mp_payment_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS mp_external_reference VARCHAR(120),
    -- Facturación Electrónica AFIP / ARCA
    ADD COLUMN IF NOT EXISTS facturado_afip BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS afip_tipo_comprobante INTEGER, -- 6 = Factura B, 11 = Factura C, 1 = Factura A
    ADD COLUMN IF NOT EXISTS afip_punto_venta INTEGER,
    ADD COLUMN IF NOT EXISTS afip_numero_comprobante BIGINT,
    ADD COLUMN IF NOT EXISTS afip_cae VARCHAR(30),
    ADD COLUMN IF NOT EXISTS afip_cae_vencimiento DATE,
    ADD COLUMN IF NOT EXISTS cliente_doc_tipo INTEGER DEFAULT 99, -- 99 = Consumidor Final, 96 = DNI, 80 = CUIT
    ADD COLUMN IF NOT EXISTS cliente_doc_nro VARCHAR(20) DEFAULT '0';

UPDATE public.movimientos mov
SET 
    comercio_id = 1,
    producto_unificado_id = m.nuevo_producto_id
FROM temp_mapeo_productos m
WHERE mov.tipo_producto = m.tipo_anterior AND mov.producto_id = m.id_anterior;

UPDATE public.movimientos SET comercio_id = 1 WHERE comercio_id IS NULL;
ALTER TABLE public.movimientos ALTER COLUMN comercio_id SET NOT NULL;

-- Permitimos el valor 'general' o 'pesable' en tipo_producto mientras el backend termina de migrar
ALTER TABLE public.movimientos DROP CONSTRAINT IF EXISTS movimientos_tipo_producto_check;

CREATE INDEX IF NOT EXISTS idx_movimientos_comercio_fecha ON public.movimientos(comercio_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_movimientos_mp_ref ON public.movimientos(mp_external_reference) WHERE mp_external_reference IS NOT NULL;

COMMIT;