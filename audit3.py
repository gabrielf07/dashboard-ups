import pandas as pd
import json
import re

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
    
    if not cod.isdigit() and nombre:
        match = re.search(r'^\s*0*(\d{2,4})\b', nombre)
        if match:
            cod = match.group(1)
            nombre = re.sub(r'^\s*0*\d{2,4}\s*', '', nombre).strip()
            
    if cod and not cod.isdigit():
        match = re.search(r'^\s*0*(\d{2,4})\b(.*)', cod)
        if match:
            cod = match.group(1)
            if not nombre:
                nombre = match.group(2).strip()
                
    def clean_cod(c):
        c = str(c).strip()
        if c.endswith('.0'): c = c[:-2]
        return c
        
    return clean_cod(cod), nombre.upper()

file_hist = r"C:\Users\Usuario1\Downloads\RESUMEN GENERAL UPS 2024 2025 Y 2026 A MARZO 2026.xlsx"
xls_hist = pd.ExcelFile(file_hist)

with open(r"C:\Users\Usuario1\.gemini\antigravity-ide\scratch\ups_management_system\frontend\src\data.json", 'r', encoding='utf-8') as f:
    data = json.load(f)

json_inspecciones = {}
for a in data:
    json_inspecciones[a['cod']] = len(a['inspecciones'])

total_missing = 0
for sheet_name in xls_hist.sheet_names:
    if sheet_name == 'Hoja1': continue
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
        
        valid_rows = 0
        for i, row in df.iterrows():
            cod, nombre = extraer_codigo_y_nombre(row, df.columns)
            if len(cod) >= 2 and cod.lower() != 'nan':
                # Replicate the skip logic of generar_json
                fecha = row.get('FECHA DE INSPECCIÓN') if 'FECHA DE INSPECCIÓN' in df.columns else row.get('FECHA DEL MANTTO')
                estatus = str(row.get('STATUS DEL EQUIPO', row.get('ESTATUS', ''))).strip()
                obs = str(row.get('OBSERVACION', row.get('OBSERVACIÓN', ''))).strip()
                
                equipo_str = ""
                if 'EQUIPO EN SITIO/ INSTALADO' in df.columns:
                    equipo_str = str(row['EQUIPO EN SITIO/ INSTALADO']).strip()
                elif 'EQUIPO' in df.columns:
                    equipo_str = str(row['EQUIPO']).strip()
                if equipo_str.lower() == 'nan': equipo_str = ""
                
                if (pd.isna(fecha) or str(fecha) == 'NaT') and estatus.lower() == 'nan' and obs.lower() == 'nan' and equipo_str == "":
                    continue # This row would be skipped in generar_json
                
                valid_rows += 1
                
        print(f"Sheet '{sheet_name}': {valid_rows} inspecciones validas (no vacías)")
