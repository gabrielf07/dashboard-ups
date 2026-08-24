import os
import hashlib
import json
import re

PUBLIC_DIR = r"C:\Users\Usuario1\.gemini\antigravity-ide\scratch\ups_management_system\frontend\public\planillas"
JSON_PATH = r"C:\Users\Usuario1\.gemini\antigravity-ide\scratch\ups_management_system\frontend\src\data.json"

def get_md5(file_path):
    hash_md5 = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()

def prefer_original(filename):
    # Damos preferencia a los nombres que NO tengan (1), (2), - copia, etc.
    # Entre más limpio y corto el nombre, mejor.
    score = len(filename)
    if re.search(r'\(\d+\)', filename):
        score += 1000 # Penalizar archivos con (1)
    if 'copia' in filename.lower():
        score += 1000
    return score

def main():
    files = [f for f in os.listdir(PUBLIC_DIR) if f.lower().endswith('.pdf')]
    print(f"Total archivos a analizar: {len(files)}")
    
    hashes = {}
    for f in files:
        path = os.path.join(PUBLIC_DIR, f)
        h = get_md5(path)
        if h not in hashes:
            hashes[h] = []
        hashes[h].append(f)
        
    duplicados_a_borrar = set()
    grupos_duplicados = 0
    
    for h, file_list in hashes.items():
        if len(file_list) > 1:
            grupos_duplicados += 1
            # Ordenar para dejar el "mejor" nombre de primero
            file_list.sort(key=prefer_original)
            keeper = file_list[0]
            to_delete = file_list[1:]
            
            for d in to_delete:
                duplicados_a_borrar.add(d)
                # Borrar del disco
                try:
                    os.remove(os.path.join(PUBLIC_DIR, d))
                except Exception as e:
                    print(f"Error borrando {d}: {e}")
                    
    print(f"Se encontraron {grupos_duplicados} grupos de archivos idénticos.")
    print(f"Se eliminarán {len(duplicados_a_borrar)} archivos redundantes.")
    
    # Actualizar JSON
    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        agencias = json.load(f)
        
    urls_a_borrar = {f"/planillas/{d}" for d in duplicados_a_borrar}
    
    for ag in agencias:
        if 'planillas_generales' in ag:
            ag['planillas_generales'] = [p for p in ag['planillas_generales'] if p not in urls_a_borrar]
            
        for insp in ag.get('inspecciones', []):
            if 'planillas' in insp:
                insp['planillas'] = [p for p in insp['planillas'] if p not in urls_a_borrar]
                
    with open(JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(agencias, f, ensure_ascii=False, indent=2)
        
    print("Base de datos actualizada. Referencias a duplicados eliminadas.")

if __name__ == "__main__":
    main()
