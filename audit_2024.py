import pandas as pd

file_hist = r"C:\Users\Usuario1\Downloads\RESUMEN GENERAL UPS 2024 2025 Y 2026 A MARZO 2026.xlsx"
df = pd.read_excel(file_hist, sheet_name=' 2024', header=None)

for i, row in df.head(10).iterrows():
    row_str = " | ".join([str(x) for x in row.values if not pd.isna(x)])
    print(f"Row {i}: {row_str}")
