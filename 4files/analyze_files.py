# analyze_files.py
import pandas as pd

files = [
    '10realiz.xlsx',
    '40hotimprodat.xlsx', 
    '10postup.xlsx'
]

for file in files:
    print(f"\n{'='*60}")
    print(f"Файл: {file}")
    print('='*60)
    
    df = pd.read_excel(file, header=0)
    print(f"Всего строк: {len(df)}")
    print(f"\nКолонки:")
    for i, col in enumerate(df.columns):
        print(f"  {i}: '{col}'")
    
    print(f"\nПервые 3 строки:")
    print(df.head(3).to_string())
    print()