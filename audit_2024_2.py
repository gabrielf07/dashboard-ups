import pandas as pd
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
                
    return cod, nombre.upper()

file_hist = r"C:\Users\Usuario1\Downloads\RESUMEN GENERAL UPS 2024 2025 Y 2026 A MARZO 2026.xlsx"
df = pd.read_excel(file_hist, sheet_name=' 2024', header=None)

header_idx = -1
for i, row in df.iterrows():
    row_str = " ".join([str(x).upper() for x in row.values])
    if "AGENCIA" in row_str and ("FECHA" in row_str or "ESTADO" in row_str or "CODIGO" in row_str):
        header_idx = i
        break

if header_idx != -1:
    print(f"Header at {header_idx}")
    df.columns = [str(col).strip().upper() for col in df.iloc[header_idx]]
    print("Columns:", df.columns.tolist())
    df = df.iloc[header_idx+1:].reset_index(drop=True)
    
    for i, row in df.head(5).iterrows():
        cod, nombre = extraer_codigo_y_nombre(row, df.columns)
        print(f"Row {i}: COD={cod} NOMBRE={nombre}")
