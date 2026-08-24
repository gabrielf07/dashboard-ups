import os
import re
import json
import shutil
from datetime import datetime

frontend_public_dir = r"C:\Users\Usuario1\.gemini\antigravity-ide\scratch\ups_management_system\frontend\public"
imagenes_src_dir = r"C:\Users\Usuario1\Downloads\Excel_Procesado\imagenes_asociadas"
planillas_src_dir = r"C:\Users\Usuario1\Downloads\5. Planillas UPS 2024-2025\5. Planillas UPS 2024-2025"
data_json_path = r"C:\Users\Usuario1\.gemini\antigravity-ide\scratch\ups_management_system\frontend\src\data.json"

imagenes_dest_dir = os.path.join(frontend_public_dir, "imagenes_asociadas")
planillas_dest_dir = os.path.join(frontend_public_dir, "planillas")

os.makedirs(imagenes_dest_dir, exist_ok=True)
os.makedirs(planillas_dest_dir, exist_ok=True)

def parse_date_str(date_str):
    if not date_str:
        return None
    for fmt in ('%d/%m/%Y', '%d.%m.%Y', '%d-%m-%Y'):
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            pass
    return None

def copy_images():
    print("Copiando imágenes asociadas...")
    if os.path.exists(imagenes_src_dir):
        for filename in os.listdir(imagenes_src_dir):
            if filename.lower().endswith(('.png', '.jpg', '.jpeg')):
                src = os.path.join(imagenes_src_dir, filename)
                dst = os.path.join(imagenes_dest_dir, filename)
                shutil.copy2(src, dst)
    else:
        print(f"Advertencia: Directorio de imágenes no encontrado: {imagenes_src_dir}")

def process_planillas():
    print("Procesando planillas...")
    planillas_map = {}
    if os.path.exists(planillas_src_dir):
        for filename in os.listdir(planillas_src_dir):
            if filename.startswith('.'): continue
            src = os.path.join(planillas_src_dir, filename)
            if not os.path.isfile(src): continue
            
            cod_match = re.match(r'^\s*0*(\d+)', filename)
            cod = str(int(cod_match.group(1))) if cod_match else None
            
            if cod:
                date_match = re.search(r'(\d{1,2})[\.\-/](\d{1,2})[\.\-/](\d{2,4})', filename)
                p_date = None
                if date_match:
                    try:
                        d, m, y = date_match.groups()
                        if len(y) == 2: y = "20" + y
                        p_date = datetime(int(y), int(m), int(d))
                    except:
                        pass
                
                dst = os.path.join(planillas_dest_dir, filename)
                shutil.copy2(src, dst)
                
                if cod not in planillas_map:
                    planillas_map[cod] = []
                planillas_map[cod].append({
                    "filename": filename,
                    "date": p_date,
                    "path": f"/planillas/{filename}"
                })
    return planillas_map

def main():
    copy_images()
    planillas_map = process_planillas()
    
    print("Actualizando data.json...")
    with open(data_json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    for agencia in data:
        cod = str(agencia.get('cod', ''))
        if 'inspecciones' in agencia:
            for insp in agencia['inspecciones']:
                if 'fotos' in insp:
                    if isinstance(insp['fotos'], dict):
                        cleaned_fotos = {"bypass": [], "ups": [], "otras": []}
                        for cat, cat_fotos in insp['fotos'].items():
                            for foto in cat_fotos:
                                basename = os.path.basename(foto).replace('\\', '/')
                                cleaned_fotos[cat].append(f"/imagenes_asociadas/{basename}")
                        insp['fotos'] = cleaned_fotos
                    else:
                        cleaned_fotos = []
                        for foto in insp['fotos']:
                            basename = os.path.basename(foto).replace('\\', '/')
                            cleaned_fotos.append(f"/imagenes_asociadas/{basename}")
                        insp['fotos'] = cleaned_fotos
                
                if 'planillas' not in insp:
                    insp['planillas'] = []
                    
        if cod in planillas_map:
            for p_info in planillas_map[cod]:
                p_path = p_info['path']
                p_date = p_info['date']
                
                if 'inspecciones' in agencia and len(agencia['inspecciones']) > 0:
                    closest_insp = None
                    min_diff = None
                    for insp in agencia['inspecciones']:
                        i_date_str = insp.get('fecha')
                        i_date = parse_date_str(i_date_str)
                        if p_date and i_date:
                            diff = abs((p_date - i_date).days)
                            if min_diff is None or diff < min_diff:
                                min_diff = diff
                                closest_insp = insp
                    
                    if closest_insp:
                        if min_diff is not None and min_diff < 60:
                            if p_path not in closest_insp.setdefault('planillas', []):
                                closest_insp['planillas'].append(p_path)
                        else:
                            latest_insp = agencia['inspecciones'][0]
                            if p_path not in latest_insp.setdefault('planillas', []):
                                latest_insp['planillas'].append(p_path)
                    else:
                        latest_insp = agencia['inspecciones'][0]
                        if p_path not in latest_insp.setdefault('planillas', []):
                            latest_insp['planillas'].append(p_path)

    with open(data_json_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        
    print("¡Archivos vinculados y data.json actualizado exitosamente!")

if __name__ == "__main__":
    main()
