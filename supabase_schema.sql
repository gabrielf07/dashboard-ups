-- Esquema de base de datos para Sistema de Gestión de UPS (Supabase / PostgreSQL)

-- 1. Regiones y Estados
CREATE TABLE regiones_estados (
    id SERIAL PRIMARY KEY,
    region VARCHAR(100) NOT NULL,
    estado VARCHAR(100) NOT NULL,
    UNIQUE(region, estado)
);

-- 2. Agencias
CREATE TABLE agencias (
    id SERIAL PRIMARY KEY,
    cod VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    estado_id INT REFERENCES regiones_estados(id),
    estatus_agencia VARCHAR(50) DEFAULT 'Activa'
);

-- 3. Equipos UPS
CREATE TABLE equipos_ups (
    id SERIAL PRIMARY KEY,
    agencia_id INT REFERENCES agencias(id) ON DELETE CASCADE,
    marca VARCHAR(100),
    modelo VARCHAR(100),
    capacidad_kva DECIMAL(10, 2),
    serial VARCHAR(100) UNIQUE,
    baterias_internas_cantidad INT,
    baterias_internas_tipo VARCHAR(100)
);

-- 4. Histórico de Mantenimientos
CREATE TABLE historico_mantenimientos (
    id SERIAL PRIMARY KEY,
    equipo_id INT REFERENCES equipos_ups(id) ON DELETE CASCADE,
    tipo_actividad VARCHAR(150) NOT NULL,
    fecha_visita DATE NOT NULL,
    fecha_proximo_mtto DATE GENERATED ALWAYS AS (fecha_visita + INTERVAL '6 months') STORED,
    presupuesto_asociado DECIMAL(12, 2),
    equipo_desincorporado VARCHAR(150),
    is_operativo BOOLEAN DEFAULT TRUE,
    estatus_textual VARCHAR(100),
    respalda TEXT,
    UNIQUE(equipo_id, tipo_actividad, fecha_visita)
);

-- 5. Registro Fotográfico
CREATE TABLE registro_fotografico (
    id SERIAL PRIMARY KEY,
    mantenimiento_id INT REFERENCES historico_mantenimientos(id) ON DELETE CASCADE,
    url_imagen TEXT NOT NULL,
    etapa VARCHAR(50), -- Antes/Durante/Después, Instalación/Reparación
    coordenada_origen VARCHAR(100), -- Ej: Fila_X_Columna_Y
    tipo_archivo VARCHAR(50) DEFAULT 'imagen' -- imagen / planilla_pdf
);

-- 6. Incidencias
CREATE TABLE incidencias (
    id SERIAL PRIMARY KEY,
    agencia_id INT REFERENCES agencias(id) ON DELETE CASCADE,
    descripcion_problema TEXT NOT NULL,
    estatus VARCHAR(50) DEFAULT 'Abierto', -- Abierto / Resuelto
    fecha_reporte TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_resolucion TIMESTAMP
);

-- Índices recomendados para optimizar el Dashboard interactivo
CREATE INDEX idx_agencias_cod ON agencias(cod);
CREATE INDEX idx_agencias_estado ON agencias(estado_id);
CREATE INDEX idx_mantenimientos_proximo ON historico_mantenimientos(fecha_proximo_mtto);
CREATE INDEX idx_incidencias_estatus ON incidencias(estatus);
