import pandas as pd
import json

file_path = r"C:\Users\Usuario1\Downloads\RESUMEN GENERAL UPS 2024 2025 Y 2026 A MARZO 2026.xlsx"
xl = pd.ExcelFile(file_path)

output = {}
for sheet in xl.sheet_names:
    df = pd.read_excel(file_path, sheet_name=sheet, header=None, nrows=15)
    # Convert all to string, handling NaNs
    output[sheet] = df.fillna("").astype(str).values.tolist()

with open("inspect_excel2.json", "w", encoding="utf-8") as f:
    json.dump(output, f, indent=2, ensure_ascii=False)
