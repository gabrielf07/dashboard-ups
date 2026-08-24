import os
import re
import json
import shutil

SRC_DIR = r"C:\Users\Usuario1\Downloads\5. Planillas UPS 2024-2025\5. Planillas UPS 2024-2025"
DEST_DIR = r"C:\Users\Usuario1\.gemini\antigravity-ide\scratch\ups_management_system\frontend\public\planillas"
MAP_FILE = r"C:\Users\Usuario1\.gemini\antigravity-ide\scratch\ups_management_system\frontend\public\planillas_map.json"

def extract_code(filename):
    m = re.search(r'\b(?:AGENCIA|AG\.|AG)[_\s]*(\d{3,4})\b', filename, re.IGNORECASE)
    if m: return m.group(1)
    
    m = re.search(r'^(\d{3,4})\b', filename)
    if m: return m.group(1)
    
    matches = re.findall(r'(?:^|[^0-9])(\d{3,4})(?:[^0-9]|$)', filename)
    valid_codes = [x for x in matches if x not in ['2023', '2024', '2025', '2026']]
    if valid_codes:
        return valid_codes[0]
        
    return None

def main():
    if not os.path.exists(DEST_DIR):
        os.makedirs(DEST_DIR)

    # 1. Copiar desde SRC_DIR a DEST_DIR si SRC_DIR existe
    if os.path.exists(SRC_DIR):
        src_files = [f for f in os.listdir(SRC_DIR) if f.lower().endswith('.pdf')]
        for filename in src_files:
            clean_name = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', filename)
            src_path = os.path.join(SRC_DIR, filename)
            dest_path = os.path.join(DEST_DIR, clean_name)
            if not os.path.exists(dest_path):
                shutil.copy2(src_path, dest_path)

    # 2. Leer DEST_DIR y generar el mapa
    planillas_map = {}
    dest_files = [f for f in os.listdir(DEST_DIR) if f.lower().endswith('.pdf')]
    
    for filename in dest_files:
        cod = extract_code(filename)
        if cod:
            public_url = f"/planillas/{filename}"
            if cod not in planillas_map:
                planillas_map[cod] = []
            if public_url not in planillas_map[cod]:
                planillas_map[cod].append(public_url)
                
    with open(MAP_FILE, 'w', encoding='utf-8') as f:
        json.dump(planillas_map, f, ensure_ascii=False, indent=2)

    print(f"Mapa generado exitosamente. {len(dest_files)} archivos procesados.")

if __name__ == "__main__":
    main()
