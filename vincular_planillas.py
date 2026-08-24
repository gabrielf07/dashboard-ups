import os
import shutil
import re
import json

SRC_DIR = r"C:\Users\Usuario1\Downloads\5. Planillas UPS 2024-2025\5. Planillas UPS 2024-2025"
DEST_DIR = r"C:\Users\Usuario1\.gemini\antigravity-ide\scratch\ups_management_system\frontend\public\planillas"
JSON_PATH = r"C:\Users\Usuario1\.gemini\antigravity-ide\scratch\ups_management_system\frontend\src\data.json"

def extract_code(filename):
    m = re.search(r'\b(?:AGENCIA|AG\.|AG)\s*(\d{3,4})\b', filename, re.IGNORECASE)
    if m: return m.group(1)
    
    m = re.search(r'^(\d{3,4})\b', filename)
    if m: return m.group(1)
    
    matches = re.findall(r'\b(\d{3,4})\b', filename)
    valid_codes = [x for x in matches if x not in ['2023', '2024', '2025', '2026']]
    if valid_codes:
        return valid_codes[0]
        
    return None

def main():
    # Limpiar directorio destino si existe
    if os.path.exists(DEST_DIR):
        for f in os.listdir(DEST_DIR):
            os.remove(os.path.join(DEST_DIR, f))
    else:
        os.makedirs(DEST_DIR)

    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        agencias = json.load(f)

    agencias_dict = {str(a['cod']): a for a in agencias}
    
    # Inicializar arreglos y remover asignaciones de inspecciones
    for cod, ag in agencias_dict.items():
        ag['planillas_generales'] = []
        for insp in ag['inspecciones']:
            if 'planillas' in insp:
                del insp['planillas'] # Remover de la inspeccion

    files = [f for f in os.listdir(SRC_DIR) if f.lower().endswith('.pdf')]
    print(f"Total PDFs encontrados en origen: {len(files)}")

    matched = 0
    
    for filename in files:
        cod = extract_code(filename)
        
        # Limpiar nombre para URL
        clean_name = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', filename)
        dest_path = os.path.join(DEST_DIR, clean_name)
        public_url = f"/planillas/{clean_name}"
        
        # Copiar todos los archivos, sin importar si hay duplicados
        src_path = os.path.join(SRC_DIR, filename)
        if not os.path.exists(dest_path):
            shutil.copy2(src_path, dest_path)
            
        if cod and cod in agencias_dict:
            ag = agencias_dict[cod]
            # Asignar TODO a planillas generales
            ag['planillas_generales'].append(public_url)
            matched += 1

    # Guardar JSON
    with open(JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(agencias, f, ensure_ascii=False, indent=2)

    print(f"Archivos asignados exitosamente a la sección general de las agencias: {matched} de {len(files)}")

if __name__ == "__main__":
    main()
