import os
import pandas as pd
import json

excel_path = r"C:\Users\Usuario1\Downloads\SUPRESORES Y UPS JUN 2026 POWER BI.xlsx"
json_out_path = r"C:\Users\Usuario1\.gemini\antigravity-ide\scratch\ups_management_system\frontend\src\data.json"

# Mapeo de estados a regiones (basado en la geografía de Venezuela)
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

def procesar_excel():
    print(f"Leyendo archivo: {excel_path}")
    agencias = []
    
    try:
        xls = pd.ExcelFile(excel_path)
        for sheet_name in xls.sheet_names:
            # Leemos asumiendo que la fila 1 (índice 0 en pandas) es un título, y la fila 2 (índice 1) son las cabeceras.
            # Por lo tanto, pasamos header=1
            df = pd.read_excel(excel_path, sheet_name=sheet_name, header=1)
            
            # Limpiamos los nombres de columnas para que no tengan espacios en blanco
            df.columns = [str(col).strip().upper() for col in df.columns]
            
            # Verificamos si tiene las columnas necesarias
            if 'COD' in df.columns and 'AGENCIA' in df.columns:
                print(f"Procesando hoja: {sheet_name}")
                
                # Filtrar filas donde el COD no sea nulo y sea un string o int válido
                df_validos = df.dropna(subset=['COD', 'AGENCIA'])
                
                for _, row in df_validos.iterrows():
                    cod = str(row['COD']).strip()
                    # Si el cod es algo como 'nan' lo omitimos
                    if cod.lower() == 'nan' or cod == '':
                        continue
                        
                    nombre = str(row['AGENCIA']).strip()
                    estado = str(row.get('ESTADO', sheet_name)).strip().title()
                    
                    # Convertir a float kva
                    kva_raw = row.get('KVA', 0)
                    try:
                        kva = float(kva_raw)
                    except:
                        kva = 0.0
                    
                    # Aproximación de equipos por cantidad de KVA o sumando UPS
                    # En los datos reales podría haber un desglose, aquí estimamos 1 si hay KVA > 0
                    equipos = 1 if kva > 0 else 0
                    
                    agencia_data = {
                        "cod": cod,
                        "nombre": nombre,
                        "estado": estado,
                        "region": obtener_region(estado),
                        "estatus": limpiar_estatus(row.get('ESTATUS AGENCIA', 'Activa')),
                        "equipos": equipos,
                        "kva": kva
                    }
                    agencias.append(agencia_data)
                    
    except Exception as e:
        print(f"Error general procesando excel: {e}")
        return
        
    print(f"Se procesaron {len(agencias)} agencias.")
    
    # Escribir a JSON
    with open(json_out_path, 'w', encoding='utf-8') as f:
        json.dump(agencias, f, ensure_ascii=False, indent=2)
        
    print(f"JSON exportado exitosamente a: {json_out_path}")

if __name__ == "__main__":
    procesar_excel()
