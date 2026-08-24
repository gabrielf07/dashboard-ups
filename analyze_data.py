import pandas as pd
import json
import re

file_path = r"C:\Users\Usuario1\Downloads\RESUMEN GENERAL UPS 2024 2025 Y 2026 A MARZO 2026.xlsx"
xl = pd.ExcelFile(file_path)

agencias = set()
zonas = set()

for sheet in xl.sheet_names:
    df = pd.read_excel(file_path, sheet_name=sheet, header=None)
    # find where headers are
    # we assume column with "CODIGO DE AGENCIA" or similar
    header_row = -1
    for i, row in df.iterrows():
        row_str = " ".join([str(x).upper() for x in row.values])
        if "AGENCIA" in row_str or "CODIGO" in row_str:
            header_row = i
            break
            
    if header_row != -1:
        df.columns = [str(x).strip().upper() for x in df.iloc[header_row]]
        df = df.iloc[header_row+1:].dropna(how='all')
        
        # Identify COD column
        cod_col = None
        for col in df.columns:
            if "CODIGO" in col or "AGENCIA" in col:
                cod_col = col # We need to be careful, "NOMBRE DE LA AGENCIA" also has AGENCIA
            if "CODIGO" in col or "CÓDIGO" in col or col == "COD":
                cod_col = col
                break
                
        # Identify ZONA/ESTADO column
        zona_col = None
        for col in df.columns:
            if "ZONA" in col or "ESTADO" in col:
                zona_col = col
                break
                
        # Find the agency name column
        nombre_col = None
        for col in df.columns:
            if "NOMBRE" in col or "AGENCIA" in col:
                if col != cod_col:
                    nombre_col = col
                    break
                    
        print(f"Sheet: {sheet} | COD: {cod_col} | ZONA: {zona_col} | NOMBRE: {nombre_col}")
        
        for idx, row in df.iterrows():
            cod = str(row.get(cod_col, "")).strip()
            # If cod is embedded in Agencia name like "395 TUREN"
            if not cod.isdigit() and nombre_col:
                val = str(row.get(nombre_col, "")).strip()
                match = re.search(r'^\s*0*(\d{2,4})\b', val)
                if match:
                    cod = match.group(1)
                else:
                    match = re.search(r'^\s*0*(\d{2,4})\b', cod)
                    if match: cod = match.group(1)
            
            # Clean up COD
            if cod.endswith('.0'): cod = cod[:-2]
            
            if len(cod) >= 2 and cod.isdigit():
                agencias.add(cod)
                z = str(row.get(zona_col, "")).strip()
                if z and z != "nan": zonas.add(z)
                
print(f"Total Unique Agencies found: {len(agencias)}")
print(f"Zonas found: {zonas}")
