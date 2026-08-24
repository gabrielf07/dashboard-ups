import pandas as pd
import re

file_hist = r"C:\Users\Usuario1\Downloads\RESUMEN GENERAL UPS 2024 2025 Y 2026 A MARZO 2026.xlsx"
xls_hist = pd.ExcelFile(file_hist)

print("--- AUDITORIA DE EXCEL ORIGINAL ---")
total_rows_found = 0
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
            # Intentar extraer algo
            cod = ""
            if 'CODIGO DE AGENCIA' in df.columns:
                cod = str(row['CODIGO DE AGENCIA']).strip()
            
            nombre = ""
            if 'AGENCIA' in df.columns: nombre = str(row['AGENCIA']).strip()
            elif 'NOMBRE DE LA AGENCIA' in df.columns: nombre = str(row['NOMBRE DE LA AGENCIA']).strip()
            
            # Mismo script de extraccion de generar_json
            if cod.lower() == 'nan': cod = ""
            if nombre.lower() == 'nan': nombre = ""
            if not cod.isdigit() and nombre:
                match = re.search(r'^\s*0*(\d{2,4})\b', nombre)
                if match:
                    cod = match.group(1)
            if cod and not cod.isdigit():
                match = re.search(r'^\s*0*(\d{2,4})\b(.*)', cod)
                if match:
                    cod = match.group(1)
                    
            if len(cod) >= 2 and cod.lower() != 'nan':
                valid_rows += 1
                
        print(f"Sheet '{sheet_name}': {valid_rows} inspecciones encontradas")
        total_rows_found += valid_rows
    else:
        print(f"Sheet '{sheet_name}': NO SE ENCONTRO HEADER!")
        
print(f"TOTAL INSPECCIONES EN EXCEL: {total_rows_found}")
