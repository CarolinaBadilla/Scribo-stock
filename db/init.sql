-- 1. Crear Secuencias
CREATE SEQUENCE IF NOT EXISTS sucursales_id_seq;
CREATE SEQUENCE IF NOT EXISTS libros_id_seq;
CREATE SEQUENCE IF NOT EXISTS ropa_id_seq;
CREATE SEQUENCE IF NOT EXISTS stock_id_seq;
CREATE SEQUENCE IF NOT EXISTS movimientos_id_seq;

-- 2. Tabla Sucursales
CREATE TABLE IF NOT EXISTS public.sucursales (
  id integer NOT NULL DEFAULT nextval('sucursales_id_seq'::regclass),
  nombre character varying NOT NULL,
  direccion text,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT sucursales_pkey PRIMARY KEY (id)
);

-- Insertar Sucursal Central por defecto (id: 1)
INSERT INTO public.sucursales (id, nombre, direccion)
VALUES (1, 'Casa Central', 'Av. Argentina 123')
ON CONFLICT (id) DO NOTHING;

-- 3. Tabla Libros
CREATE TABLE IF NOT EXISTS public.libros (
  id integer NOT NULL DEFAULT nextval('libros_id_seq'::regclass),
  codigo_barras character varying NOT NULL UNIQUE,
  titulo character varying NOT NULL,
  autor character varying,
  editorial character varying,
  precio_compra numeric NOT NULL,
  precio_efectivo numeric NOT NULL,
  precio_tarjeta numeric NOT NULL,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT libros_pkey PRIMARY KEY (id)
);

-- 4. Tabla Ropa
CREATE TABLE IF NOT EXISTS public.ropa (
  id integer NOT NULL DEFAULT nextval('ropa_id_seq'::regclass),
  codigo_barras character varying NOT NULL UNIQUE,
  nombre character varying NOT NULL,
  colegio character varying NOT NULL,
  talle character varying,
  color character varying,
  precio_compra numeric NOT NULL,
  precio_efectivo numeric NOT NULL,
  precio_tarjeta numeric,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  ganancia numeric DEFAULT 0,
  CONSTRAINT ropa_pkey PRIMARY KEY (id)
);

-- 5. Tabla Stock
CREATE TABLE IF NOT EXISTS public.stock (
  id integer NOT NULL DEFAULT nextval('stock_id_seq'::regclass),
  tipo_producto character varying CHECK (tipo_producto::text = ANY (ARRAY['libro'::character varying, 'ropa'::character varying]::text[])),
  producto_id integer NOT NULL,
  sucursal_id integer,
  cantidad integer DEFAULT 0 CHECK (cantidad >= 0),
  stock_minimo integer DEFAULT 5,
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT stock_pkey PRIMARY KEY (id),
  CONSTRAINT stock_sucursal_id_fkey FOREIGN KEY (sucursal_id) REFERENCES public.sucursales(id)
);

-- 6. Tabla Movimientos
CREATE TABLE IF NOT EXISTS public.movimientos (
  id integer NOT NULL DEFAULT nextval('movimientos_id_seq'::regclass),
  tipo_producto character varying CHECK (tipo_producto::text = ANY (ARRAY['libro'::character varying, 'ropa'::character varying]::text[])),
  producto_id integer NOT NULL,
  sucursal_id integer,
  tipo_movimiento character varying CHECK (tipo_movimiento::text = ANY (ARRAY['venta'::character varying, 'compra'::character varying]::text[])),
  cantidad integer NOT NULL CHECK (cantidad > 0),
  precio_unitario numeric NOT NULL,
  fecha timestamp without time zone DEFAULT now(),
  usuario_id uuid,
  descuento_porcentaje integer DEFAULT 0,
  CONSTRAINT movimientos_pkey PRIMARY KEY (id),
  CONSTRAINT movimientos_sucursal_id_fkey FOREIGN KEY (sucursal_id) REFERENCES public.sucursales(id)
);

-- 7. Tabla Perfiles
CREATE TABLE IF NOT EXISTS public.perfiles (
  id uuid NOT NULL,
  rol character varying NOT NULL CHECK (rol::text = ANY (ARRAY['empleado'::character varying, 'jefe'::character varying]::text[])),
  sucursal_id integer,
  created_at timestamp without time zone DEFAULT now(),
  email character varying UNIQUE,
  CONSTRAINT perfiles_pkey PRIMARY KEY (id),
  CONSTRAINT perfiles_sucursal_id_fkey FOREIGN KEY (sucursal_id) REFERENCES public.sucursales(id)
);