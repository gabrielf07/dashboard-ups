import os
import pandas as pd
import json
import glob
from datetime import datetime
from dateutil.relativedelta import relativedelta

file_base = r"C:\Users\Usuario1\Downloads\SUPRESORES Y UPS JUN 2026 POWER BI.xlsx"
file_hist = r"C:\Users\Usuario1\Downloads\RESUMEN GENERAL UPS 2024 2025 Y 2026 A MARZO 2026.xlsx"
json_out_path = r"C:\Users\Usuario1\.gemini\antigravity-ide\scratch\ups_management_system\frontend\src\data.json"
img_dir = r"C:\Users\Usuario1\.gemini\antigravity-ide\scratch\ups_management_system\frontend\public\imagenes_asociadas"

REGION_MAP = {
    'ZULIA': 'Occidente', 'FALCON': 'Occidente', 'LARA': 'Occidente', 'FALCÓN': 'Occidente',
    'ARAGUA': 'Central', 'CARABOBO': 'Central', 'MIRANDA': 'Capital', 'DISTRITO CAPITAL': 'Capital', 'CARACAS': 'Capital',
    'APURE': 'Los Llanos', 'BARINAS': 'Los Llanos', 'COJEDES': 'Los Llanos', 'GUARICO': 'Los Llanos', 'GUÁRICO': 'Los Llanos', 'PORTUGUESA': 'Los Llanos',
    'MERIDA': 'Andes', 'MÉRIDA': 'Andes', 'TACHIRA': 'Andes', 'TÁCHIRA': 'Andes', 'TRUJILLO': 'Andes',
    'YARACUY': 'Centro Occidente'
}

def obtener_region(estado_str):
    if not isinstance(estado_str, str): return "Otras Regiones"
    e = estado_str.upper().strip()
    return REGION_MAP.get(e, "Otras Regiones")

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
        return pd.to_datetime(d).strftime("%Y-%m-%d")
    except:
        return None

def calc_next_maint(d_str):
    if not d_str: return None
    try:
        dt = datetime.strptime(d_str, "%Y-%m-%d")
        next_dt = dt + relativedelta(months=6)
        return next_dt.strftime("%Y-%m-%d")
    except:
        return None

def find_photos(sheet_name, row_num):
    # Buscar fotos con el patron: NombreHoja_Fila_{row_num}_Columna_*.png
    # Nota: glob.escape() no está disponible en todas las versiones, usaremos replace manual de corchetes si hubiera,
    # pero mejor simplemente listar y filtrar.
    photos = []
    if not os.path.exists(img_dir): return photos
    
    # Normalizar sheet name para buscar (eliminar espacios iniciales/finales, etc)
    # Dependiendo de como se generaron, podria coincidir exacto.
    prefix = f"{sheet_name}_Fila_{row_num}_"
    
    all_files = os.listdir(img_dir)
    for f in all_files:
        if f.startswith(prefix) and f.endswith(".png"):
            photos.append(f"/imagenes_asociadas/{f}")
    
    # Fallback si el sheet_name fue modificado en el generador (ej strip espacios)
    if not photos:
        prefix_strip = f"{sheet_name.strip()}_Fila_{row_num}_"
        for f in all_files:
            if f.startswith(prefix_strip) and f.endswith(".png"):
                photos.append(f"/imagenes_asociadas/{f}")
                
    return photos

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
                estado = str(row.get('ESTADO', sheet_name)).strip().title()
                kva_raw = row.get('KVA', 0)
                try: kva = float(kva_raw)
                except: kva = 0.0
                
                agencias_dict[cod] = {
                    "cod": cod,
                    "nombre": nombre,
                    "estado": estado,
                    "region": obtener_region(estado),
                    "estatus": limpiar_estatus(row.get('ESTATUS AGENCIA', 'Activa')),
                    "equipos": 1 if kva > 0 else 0,
                    "kva": kva,
                    "inspecciones": []
                }
                
    # 2. Cargar Historial
    print(f"Cargando HISTORIAL: {file_hist}")
    xls_hist = pd.ExcelFile(file_hist)
    for sheet_name in xls_hist.sheet_names:
        df = pd.read_excel(file_hist, sheet_name=sheet_name, nrows=20)
        header_idx = -1
        for i, row in df.iterrows():
            if row.notna().sum() > 3:
                header_idx = i
                break
        
        if header_idx != -1:
            df = pd.read_excel(file_hist, sheet_name=sheet_name, header=header_idx)
            df.columns = [str(col).strip().upper() for col in df.columns]
            
            for i, row in df.iterrows():
                excel_row_num = i + header_idx + 2
                
                # Identificar cod y nombre
                cod = None
                nombre_hist = ""
                if 'CODIGO DE AGENCIA' in df.columns:
                    cod = clean_cod(row['CODIGO DE AGENCIA'])
                
                # Campos principales
                fecha = parse_date(row.get('FECHA DE INSPECCIÓN') if 'FECHA DE INSPECCIÓN' in df.columns else row.get('FECHA DEL MANTTO'))
                estatus = str(row.get('STATUS DEL EQUIPO', row.get('ESTATUS', ''))).strip()
                obs1 = str(row.get('OBSERVACION', row.get('OBSERVACIÓN', ''))).strip()
                obs2 = str(row.get('TRABAJO REALIZADO', '')).strip()
                obs = obs1
                if obs2 and obs2.lower() != 'nan':
                    obs += " | " + obs2
                if obs.lower() == 'nan': obs = ""
                
                # Solo guardar si hay algo relevante
                if not fecha and not estatus and not obs:
                    continue
                    
                is_operativo = True
                if 'INOPERATIVO' in estatus.upper() or 'DAÑADO' in estatus.upper():
                    is_operativo = False
                
                # Buscar fotos
                fotos = find_photos(sheet_name, excel_row_num)
                
                inspeccion = {
                    "fecha": fecha,
                    "proximo_mantenimiento": calc_next_maint(fecha),
                    "estatus": estatus if estatus.lower() != 'nan' else 'Desconocido',
                    "is_operativo": is_operativo,
                    "observacion": obs,
                    "fotos": fotos
                }
                
                # Asignar a agencia
                if cod and cod != 'nan' and cod in agencias_dict:
                    agencias_dict[cod]['inspecciones'].append(inspeccion)
                else:
                    # Fuzzy match por nombre si tenemos la columna AGENCIA
                    if 'AGENCIA' in df.columns or 'NOMBRE DE LA AGENCIA' in df.columns:
                        col_nombre = 'AGENCIA' if 'AGENCIA' in df.columns else 'NOMBRE DE LA AGENCIA'
                        n = str(row[col_nombre]).strip().upper()
                        if n != 'NAN':
                            # Buscar en el dict
                            found = False
                            for c, a in agencias_dict.items():
                                if c in n or n in a['nombre'].upper() or a['nombre'].upper() in n:
                                    a['inspecciones'].append(inspeccion)
                                    found = True
                                    break
                            # Si no se encuentra, se podría crear, pero nos apegamos a la base
                            
    # 3. Ordenar inspecciones por fecha y Exportar
    agencias_list = list(agencias_dict.values())
    for a in agencias_list:
        valid_insp = [x for x in a['inspecciones'] if x['fecha'] is not None]
        valid_insp.sort(key=lambda x: x['fecha'], reverse=True)
        # Reañadir las que no tienen fecha al final
        no_fecha = [x for x in a['inspecciones'] if x['fecha'] is None]
        a['inspecciones'] = valid_insp + no_fecha
        
    with open(json_out_path, 'w', encoding='utf-8') as f:
        json.dump(agencias_list, f, ensure_ascii=False, indent=2)
        
    print(f"JSON exportado con historial: {json_out_path}")

if __name__ == "__main__":
    procesar()
