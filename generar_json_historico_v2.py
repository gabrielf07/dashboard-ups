import os
import pandas as pd
import json
import re
from datetime import datetime
from dateutil.relativedelta import relativedelta

file_base = r"C:\Users\Usuario1\Downloads\SUPRESORES Y UPS JUN 2026 POWER BI.xlsx"
file_hist = r"C:\Users\Usuario1\Downloads\RESUMEN GENERAL UPS 2024 2025 Y 2026 A MARZO 2026.xlsx"
json_out_path = r"C:\Users\Usuario1\.gemini\antigravity-ide\scratch\ups_management_system\frontend\src\data.json"
img_dir = r"C:\Users\Usuario1\.gemini\antigravity-ide\scratch\ups_management_system\frontend\public\imagenes_asociadas"

# Diccionario de normalización de estados
ESTADOS_NORMALIZADOS = {
    'DTTO.CAPITAL': 'Distrito Capital',
    'DTO. CAPITAL': 'Distrito Capital',
    'DTTO. CAPITAL': 'Distrito Capital',
    'ZULIA/LA GUAJIRA': 'Zulia',
    'SAN CRISTOBAL- TARIBA': 'Táchira',
    'SAN CRISTOBAL': 'Táchira',
    'SAN CRISTÓBAL': 'Táchira',
    'SAN CRISTÓBAL - TARIBA': 'Táchira',
    'LA GRITA': 'Táchira',
    'PUNTO FIJO': 'Falcón',
    'CORO': 'Falcón',
    'FALCÓN DABAJURO': 'Falcón',
    'SANTA BÁRBARA DEL ZULIA': 'Zulia',
    'MARACAIBO': 'Zulia',
    'ROSARIO DE PERIJÁ': 'Zulia',
    'GUARICO': 'Guárico',
    'FALCON': 'Falcón',
    'TACHIRA': 'Táchira',
    'MERIDA': 'Mérida',
    'DTO CAPITAL': 'Distrito Capital',
    'SIN ESTADO': ''
}

INFERENCIA_ESTADOS = {
    'ACARIGUA': 'Portuguesa',
    'GUANARE': 'Portuguesa',
    'ARAURE': 'Portuguesa',
    'TUREN': 'Portuguesa',
    'EL LIMON': 'Aragua',
    'MARACAY': 'Aragua',
    'PALO NEGRO': 'Aragua',
    'CAGUA': 'Aragua',
    'TURMERO': 'Aragua',
    'LA VICTORIA': 'Aragua',
    'EL VIÑEDO': 'Carabobo',
    'VALENCIA': 'Carabobo',
    'GUACARA': 'Carabobo',
    'SAN FERNANDO': 'Apure',
    'APURE': 'Apure',
    'BARINAS': 'Barinas'
}

def normalizar_estado(estado_str):
    if not estado_str: return ""
    e = str(estado_str).strip().upper()
    if e in ESTADOS_NORMALIZADOS:
        return ESTADOS_NORMALIZADOS[e]
    return estado_str.title()

# Palabras clave para inferir región
LLANOS_KEYWORDS = ['APURE', 'BARINAS', 'COJEDES', 'GUARICO', 'GUÁRICO', 'PORTUGUESA']
OCCIDENTE_KEYWORDS = ['ZULIA', 'FALCON', 'FALCÓN', 'LARA', 'YARACUY', 'MERIDA', 'MÉRIDA', 'TACHIRA', 'TÁCHIRA', 'TRUJILLO', 'MARACAIBO']

def deducir_region(sheet_name, estado_str):
    sn = sheet_name.upper()
    if 'LLANOS' in sn:
        return 'Los Llanos'
    if 'OCCI' in sn:
        return 'Occidente'
        
    e = str(estado_str).upper()
    for k in LLANOS_KEYWORDS:
        if k in e or k in sn:
            return 'Los Llanos'
    for k in OCCIDENTE_KEYWORDS:
        if k in e or k in sn:
            return 'Occidente'
            
    # Default fallback
    return 'Occidente'

def limpiar_estatus(estatus_str):
    if not isinstance(estatus_str, str): return "Activa"
    s = estatus_str.upper().strip()
    if 'CERRAD' in s: return "Inactiva"
    if 'MTTO' in s or 'MANTENIMIENTO' in s: return "Mantenimiento"
    return "Activa"
    
def clean_cod(cod):
    cod = str(cod).strip()
    if cod.endswith('.0'): cod = cod[:-2]
    return cod

def parse_date(d):
    if pd.isna(d): return None
    if isinstance(d, datetime):
        return d.strftime("%Y-%m-%d")
    try:
        return pd.to_datetime(d, errors='coerce').strftime("%Y-%m-%d")
    except:
        return None

def calc_next_maint(d_str):
    if not d_str or d_str == 'NaT': return None
    try:
        dt = datetime.strptime(d_str, "%Y-%m-%d")
        next_dt = dt + relativedelta(months=6)
        return next_dt.strftime("%Y-%m-%d")
    except:
        return None

def find_photos(sheet_name, row_num, df_columns):
    # Devuelve un diccionario estructurado
    photos = {"bypass": [], "ups": [], "otras": []}
    if not os.path.exists(img_dir): return photos
    
    prefix = f"{sheet_name}_Fila_{row_num}_"
    prefix_strip = f"{sheet_name.strip()}_Fila_{row_num}_"
    
    all_files = os.listdir(img_dir)
    for f in all_files:
        if (f.startswith(prefix) or f.startswith(prefix_strip)) and f.endswith(".png"):
            # Extraer el numero de columna X_Columna_Y.png
            match = re.search(r'Columna_(\d+)', f)
            categoria = "otras"
            if match:
                col_idx = int(match.group(1)) - 1 # openpyxl usa 1-based, pero probemos indices
                # Buscamos en los headers para ver si la palabra UPS o BYPASS aparece cerca de esa columna
                # En realidad openpyxl da el índice real, así que podemos mapearlo directo si df_columns no estuviera recortado.
                # Como df_columns está recortado, buscaremos los headers directamente que contengan esas palabras.
                # Si no podemos asociarlo directo por index exacto, lo asociamos inferiendo el nombre del archivo si es posible,
                # Pero en la extraccion, "Columna_Y" nos dice la posicion original.
                
                # Vamos a iterar sobre los nombres de df_columns. Como sabemos que la columna Bypass se llama 'REGISTRO FOTOGRÁFICO TABLERO BYPASS'
                # y Ups 'REGISTRO FOTOGRÁFICO UPS'. Si la columna Y de excel cae cerca de esos headers (que suelen estar al final)
                # podemos mapearlo.
                # Para ser seguros, en la mayoria de los archivos: BYPASS está antes de UPS, y están al final.
                
                # Estrategia: 
                # Bypass suele ser la columna 11 o L. UPS la 12 o M. 
                # Si la columna > 8, podemos inferirlo.
                pass
            
            # Un enfoque mejor: si la foto se asigno, y no sabemos el indice exacto de forma confiable,
            # lo mejor es chequear el indice de la columna Y con el array original de headers de openpyxl
            # Como aqui no tenemos openpyxl, vamos a asignar las primeras columnas a Bypass y las siguientes a UPS
            pass

    # Reimplementación estricta de mapeo:
    # Como la extracción de Openpyxl enumera "Columna_Y" basándose en el 1-index de excel.
    # En el excel: Columna K (11) es BYPASS. Columna L (12) es UPS.
    # En la plantilla general, 11=Bypass, 12=UPS. 
    for f in all_files:
        if (f.startswith(prefix) or f.startswith(prefix_strip)) and (f.endswith(".png") or f.endswith(".jpg") or f.endswith(".jpeg")):
            path = f"/imagenes_asociadas/{f}"
            match = re.search(r'Columna_(\d+)', f)
            if match:
                col_idx = int(match.group(1))
                # Asumiendo el estandar del archivo:
                # Bypass suele estar en la penultima columna y UPS en la ultima.
                # Por inspeccion: 11 = Bypass, 12 = UPS, o 12 = Bypass, 13 = UPS.
                # Si hay varias fotos, podemos agrupar las de menor índice a Bypass, y mayor a UPS.
                # Lo más seguro es que la primera columna fotografica es Bypass y la segunda UPS.
                if col_idx % 2 == 1: # Un truco heurístico: 11 es impar (Bypass), 12 es par (UPS).
                    photos["bypass"].append(path)
                else:
                    photos["ups"].append(path)
            else:
                photos["otras"].append(path)
                
    # Si tenemos fotos y pudimos separarlas mejor, aplicamos la corrección.
    # Como no tenemos el mapa perfecto, dividimos por la mitad si no estamos seguros
    if not photos["bypass"] and not photos["ups"] and photos["otras"]:
        half = len(photos["otras"]) // 2
        photos["bypass"] = photos["otras"][:half]
        photos["ups"] = photos["otras"][half:]
        photos["otras"] = []
        
    return photos

def parse_equipo(row, df_columns):
    equipo = ""
    if 'EQUIPO EN SITIO/ INSTALADO' in df_columns:
        equipo = str(row['EQUIPO EN SITIO/ INSTALADO']).strip()
    elif 'EQUIPO' in df_columns:
        equipo = str(row['EQUIPO']).strip()
    if equipo.lower() == 'nan':
        return ""
    return re.sub(r'\s+', ' ', equipo).strip().upper()

def parse_respalda(row, df_columns):
    respalda = ""
    if 'EQUIPO RESPALDA' in df_columns:
        respalda = str(row['EQUIPO RESPALDA']).strip()
    elif 'RESPALDA' in df_columns:
        respalda = str(row['RESPALDA']).strip()
    if respalda.lower() == 'nan':
        return ""
    return re.sub(r'\s+', ' ', respalda).strip().upper()

def extraer_codigo_y_nombre(row, df_columns):
    cod = ""
    nombre = ""
    col_nombre = None
    
    if 'AGENCIA' in df_columns: col_nombre = 'AGENCIA'
    elif 'NOMBRE DE LA AGENCIA' in df_columns: col_nombre = 'NOMBRE DE LA AGENCIA'
    
    if 'CODIGO DE AGENCIA' in df_columns:
        cod = str(row['CODIGO DE AGENCIA']).strip()
        
    if col_nombre:
        nombre = str(row[col_nombre]).strip()
        
    if cod.lower() == 'nan': cod = ""
    if nombre.lower() == 'nan': nombre = ""
    
    # Si el codigo no es un numero y el nombre tiene numero al inicio (ej. "395 TUREN")
    if not cod.isdigit() and nombre:
        match = re.search(r'^\s*0*(\d{2,4})\b', nombre)
        if match:
            cod = match.group(1)
            nombre = re.sub(r'^\s*0*\d{2,4}\s*', '', nombre).strip()
            
    # Si el codigo tiene el nombre mezclado (ej. "395 TUREN" en la columna COD)
    if cod and not cod.isdigit():
        match = re.search(r'^\s*0*(\d{2,4})\b(.*)', cod)
        if match:
            cod = match.group(1)
            if not nombre:
                nombre = match.group(2).strip()
                
    cod = clean_cod(cod)
    return cod, nombre.upper()

def obtener_zona_estado(row, df_columns, nombre_agencia):
    z = ""
    for col in df_columns:
        if 'ZONA' in col or 'ESTADO' in col:
            z = str(row[col]).strip()
            break
            
    z = normalizar_estado(z.title())
    
    if not z or z.upper() == 'SIN ESTADO':
        nombre_upper = str(nombre_agencia).upper()
        for key, est in INFERENCIA_ESTADOS.items():
            if key in nombre_upper:
                z = est
                break
                
    if not z: z = "Sin Estado"
    return z

def procesar():
    agencias_dict = {}
    
    # 1. Cargar Agencias Base
    print(f"Cargando BASE: {file_base}")
    xls_base = pd.ExcelFile(file_base)
    for sheet_name in xls_base.sheet_names:
        df = pd.read_excel(file_base, sheet_name=sheet_name, header=1)
        df.columns = [str(col).strip().upper() for col in df.columns]
        if 'COD' in df.columns and 'AGENCIA' in df.columns:
            df_validos = df.dropna(subset=['COD', 'AGENCIA'])
            for _, row in df_validos.iterrows():
                cod = clean_cod(row['COD'])
                if cod.lower() == 'nan' or cod == '': continue
                nombre = str(row['AGENCIA']).strip()
                estado = normalizar_estado(str(row.get('ESTADO', sheet_name)).strip().title())
                kva_raw = row.get('KVA', 0)
                try: kva = float(kva_raw)
                except: kva = 0.0
                
                base_ups = str(row.get('UPS', '')).strip()
                base_baterias = str(row.get('BATERIAS 12V 9AH', '')).strip() + " " + str(row.get('BATERIAS 12V 4.5AH', '')).strip()
                if base_ups.lower() == 'nan': base_ups = ""
                
                agencias_dict[cod] = {
                    "cod": cod,
                    "nombre": nombre,
                    "estado": estado,
                    "region": deducir_region(sheet_name, estado),
                    "estatus": limpiar_estatus(row.get('ESTATUS AGENCIA', 'Activa')),
                    "equipos": 1 if kva > 0 else 0,
                    "kva": kva,
                    "equipo_base": base_ups,
                    "baterias_base": base_baterias,
                    "inspecciones": [],
                    "equipos_instalados": []
                }
                
    # 2. Cargar Historial
    print(f"Cargando HISTORIAL: {file_hist}")
    xls_hist = pd.ExcelFile(file_hist)
    for sheet_name in xls_hist.sheet_names:
        df = pd.read_excel(file_hist, sheet_name=sheet_name, header=None)
        header_idx = -1
        for i, row in df.iterrows():
            row_str = " ".join([str(x).upper() for x in row.values])
            if "AGENCIA" in row_str and ("FECHA" in row_str or "ESTADO" in row_str or "CODIGO" in row_str):
                header_idx = i
                break
        
        if header_idx != -1:
            df.columns = [str(col).strip().upper() for col in df.iloc[header_idx]]
            df = df.iloc[header_idx+1:].reset_index(drop=True)
            
            for i, row in df.iterrows():
                excel_row_num = i + header_idx + 2
                
                cod, nombre_hist = extraer_codigo_y_nombre(row, df.columns)
                if not cod or len(cod) < 2:
                    continue # No hay codigo valido
                    
                # Si la agencia NO existe en la base, la creamos
                if cod not in agencias_dict:
                    estado_hist = obtener_zona_estado(row, df.columns, nombre_hist)
                    if not estado_hist: estado_hist = "Sin Estado"
                    
                    agencias_dict[cod] = {
                        "cod": cod,
                        "nombre": nombre_hist if nombre_hist else f"Agencia {cod}",
                        "estado": estado_hist,
                        "region": deducir_region(sheet_name, estado_hist),
                        "estatus": "Activa",
                        "equipos": 0,
                        "kva": 0.0,
                        "equipo_base": "",
                        "baterias_base": "",
                        "inspecciones": [],
                        "equipos_instalados": []
                    }
                else:
                    # Si ya existe, quizas podamos mejorar la region si antes decia "Otras Regiones"
                    if agencias_dict[cod]['region'] == 'Otras Regiones' or agencias_dict[cod]['region'] not in ['Occidente', 'Los Llanos']:
                        estado_hist = obtener_zona_estado(row, df.columns, nombre_hist)
                        agencias_dict[cod]['region'] = deducir_region(sheet_name, estado_hist)
                
                fecha = parse_date(row.get('FECHA DE INSPECCIÓN') if 'FECHA DE INSPECCIÓN' in df.columns else row.get('FECHA DEL MANTTO'))
                estatus = str(row.get('STATUS DEL EQUIPO', row.get('ESTATUS', ''))).strip()
                obs1 = str(row.get('OBSERVACION', row.get('OBSERVACIÓN', ''))).strip()
                obs2 = str(row.get('TRABAJO REALIZADO', '')).strip()
                obs = obs1
                if obs2 and obs2.lower() != 'nan':
                    obs += " | " + obs2
                if obs.lower() == 'nan': obs = ""
                
                equipo_str = parse_equipo(row, df.columns)
                respalda_str = parse_respalda(row, df.columns)
                
                if not fecha and not estatus and not obs and not equipo_str:
                    continue
                if fecha == 'NaT': fecha = None
                
                is_operativo = True
                if 'INOPERATIVO' in estatus.upper() or 'DAÑADO' in estatus.upper() or 'NO OPERATIVO' in estatus.upper():
                    is_operativo = False
                
                fotos = find_photos(sheet_name, excel_row_num, df.columns)
                
                inspeccion = {
                    "fecha": fecha,
                    "equipo": equipo_str,
                    "respalda": respalda_str,
                    "proximo_mantenimiento": calc_next_maint(fecha),
                    "estatus": estatus if estatus.lower() != 'nan' else 'Desconocido',
                    "is_operativo": is_operativo,
                    "observacion": obs,
                    "fotos": fotos
                }
                
                agencias_dict[cod]['inspecciones'].append(inspeccion)
                
                if equipo_str:
                    found = False
                    for eq in agencias_dict[cod]['equipos_instalados']:
                        if equipo_str in eq or eq in equipo_str:
                            found = True
                            break
                        nums_eq = set(re.findall(r'\d+', eq))
                        nums_str = set(re.findall(r'\d+', equipo_str))
                        if len(nums_str) > 2 and nums_str.issubset(nums_eq):
                            found = True
                            break

                    if not found:
                        agencias_dict[cod]['equipos_instalados'].append(equipo_str)
                            
    # 3. Postprocesamiento
    agencias_list = list(agencias_dict.values())
    for a in agencias_list:
        valid_insp = [x for x in a['inspecciones'] if x['fecha'] is not None]
        valid_insp.sort(key=lambda x: x['fecha'], reverse=True)
        no_fecha = [x for x in a['inspecciones'] if x['fecha'] is None]
        a['inspecciones'] = valid_insp + no_fecha
        
        if len(a['equipos_instalados']) > 0:
            a['equipos'] = len(a['equipos_instalados'])
        else:
            a['equipos'] = 1 if a['kva'] > 0 else 0
        
        if a['kva'] == 0:
            for eq in a['equipos_instalados']:
                match = re.search(r'(\d+)\s*KVA', eq, re.IGNORECASE)
                if match:
                    a['kva'] = float(match.group(1))
                    break
                    
    with open(json_out_path, 'w', encoding='utf-8') as f:
        json.dump(agencias_list, f, ensure_ascii=False, indent=2)
        
    print(f"Total de Agencias Exportadas: {len(agencias_list)}")
    print(f"JSON exportado con historial y equipos: {json_out_path}")

if __name__ == "__main__":
    procesar()
