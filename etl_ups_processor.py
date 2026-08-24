import os
import re
import pandas as pd
from supabase import create_client, Client
from datetime import datetime

# ==========================================
# CONFIGURACIÓN DE RUTAS Y CREENCIALES
# ==========================================
# Cambiar con las credenciales reales de Supabase
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://tu-proyecto.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "tu-anon-key")

try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:
    print(f"Advertencia: No se pudo conectar a Supabase. {e}")
    supabase = None

BASE_DIR = r"C:\Users\Usuario1\Downloads"
EXCEL_PROCESADO_DIR = os.path.join(BASE_DIR, "Excel_Procesado")
IMAGENES_DIR = os.path.join(EXCEL_PROCESADO_DIR, "imagenes_asociadas")

# ==========================================
# FUNCIONES AUXILIARES
# ==========================================
def limpiar_cod(cod):
    if pd.isna(cod):
        return None
    return str(cod).strip().upper()

def generar_hash(cod_agencia, fecha_visita, tipo_actividad):
    """Genera una clave única para identificar duplicados"""
    return f"{cod_agencia}_{fecha_visita}_{tipo_actividad}".lower()

# ==========================================
# FASE 1: PROCESAMIENTO DEL EXCEL MAESTRO
# ==========================================
def procesar_excel_maestro(ruta_excel):
    print(f"Procesando Excel Maestro: {ruta_excel}")
    try:
        df = pd.read_excel(ruta_excel)
        # Asumimos que las columnas se llaman 'COD' y 'AGENCIA'
        if 'COD' in df.columns:
            df['COD_LIMPIO'] = df['COD'].apply(limpiar_cod)
            # Aquí se insertaría la lógica para actualizar o insertar agencias en la DB
            print(f"Se encontraron {len(df)} agencias en el archivo maestro.")
            return df
        else:
            print("Columna 'COD' no encontrada en el maestro.")
            return None
    except Exception as e:
        print(f"Error procesando maestro: {e}")
        return None

# ==========================================
# FASE 2: PROCESAMIENTO DE ARCHIVOS DE TEXTO (HISTÓRICOS)
# ==========================================
def procesar_archivos_texto():
    print(f"Buscando archivos de texto en {EXCEL_PROCESADO_DIR}")
    archivos_txt = [f for f in os.listdir(EXCEL_PROCESADO_DIR) if f.endswith('.txt')]
    
    mantenimientos_extraidos = []
    hashes_existentes = set()
    
    # Expresión regular básica para buscar COD (ej. 4 dígitos), Fecha (DD/MM/YYYY)
    # Esta regex se debe adaptar al formato real de extracción flotante de los TXT
    regex_cod = re.compile(r'(?i)COD[:\s]*([A-Z0-9]+)')
    regex_fecha = re.compile(r'(\d{2}/\d{2}/\d{4})')
    
    for archivo in archivos_txt:
        ruta_completa = os.path.join(EXCEL_PROCESADO_DIR, archivo)
        nombre_region = archivo.replace("_estructura_y_texto.txt", "").strip()
        
        try:
            with open(ruta_completa, 'r', encoding='utf-8') as f:
                contenido = f.read()
                
                # Ejemplo simplificado de extracción. En la realidad dependerá de la estructura de filas/bloques
                cods_encontrados = regex_cod.findall(contenido)
                fechas_encontradas = regex_fecha.findall(contenido)
                
                # Mockup de iteración por cada registro encontrado
                for idx, cod in enumerate(cods_encontrados):
                    cod_limpio = limpiar_cod(cod)
                    # Tomar la fecha correspondiente o una por defecto
                    fecha_visita = fechas_encontradas[idx] if idx < len(fechas_encontradas) else "01/01/2021"
                    tipo_actividad = "Mantenimiento Preventivo" # Esto también se extraería con Regex
                    
                    hash_registro = generar_hash(cod_limpio, fecha_visita, tipo_actividad)
                    
                    if hash_registro not in hashes_existentes:
                        hashes_existentes.add(hash_registro)
                        mantenimientos_extraidos.append({
                            "archivo_origen": nombre_region,
                            "cod_agencia": cod_limpio,
                            "fecha_visita": fecha_visita,
                            "tipo_actividad": tipo_actividad
                        })
                        
        except Exception as e:
            print(f"Error procesando {archivo}: {e}")
            
    print(f"Total mantenimientos únicos extraídos: {len(mantenimientos_extraidos)}")
    return mantenimientos_extraidos

# ==========================================
# FASE 3: MAPEO DE IMÁGENES
# ==========================================
def mapear_imagenes():
    print(f"Analizando imágenes en {IMAGENES_DIR}")
    if not os.path.exists(IMAGENES_DIR):
        print("Directorio de imágenes no existe.")
        return []
        
    imagenes = os.listdir(IMAGENES_DIR)
    mapeo_fotos = []
    
    # Formato esperado: NombreHoja_Fila_X_Columna_Y.png
    regex_img = re.compile(r'(.*)_Fila_(\d+)_Columna_(\d+)\.png')
    
    for img in imagenes:
        match = regex_img.match(img)
        if match:
            nombre_hoja = match.group(1)
            fila = match.group(2)
            columna = match.group(3)
            
            mapeo_fotos.append({
                "archivo": img,
                "hoja_origen": nombre_hoja,
                "coordenada": f"Fila_{fila}_Columna_{columna}"
            })
            
    print(f"Se mapearon {len(mapeo_fotos)} imágenes.")
    return mapeo_fotos

# ==========================================
# EJECUCIÓN PRINCIPAL
# ==========================================
if __name__ == "__main__":
    print("Iniciando Ingestión ETL de UPS...")
    
    # 1. Maestro
    ruta_maestro = os.path.join(BASE_DIR, "SUPRESORES Y UPS JUN 2026 POWER BI.xlsx")
    df_maestro = procesar_excel_maestro(ruta_maestro)
    
    # 2. Históricos Textos
    mantenimientos = procesar_archivos_texto()
    
    # 3. Imágenes
    fotos = mapear_imagenes()
    
    # 4. (Pendiente) Subida de datos y fotos a Supabase
    print("ETL completado en entorno local. Listo para inserción en Base de Datos.")
