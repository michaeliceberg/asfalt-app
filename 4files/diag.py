# diag.py
# /Users/mac/Desktop/asfalt2027/asfalt-app/4files/diag.py

import pandas as pd

files = ['hotimprodat.xlsx', 'postup.xlsx', 'realiz.xlsx', 'peremeshenie.xlsx']

for f in files:
    try:
        print(f"\n=== {f} ===")
        df = pd.read_excel(f)
        print(f"Колонки ({len(df.columns)}):")
        for col in df.columns:
            print(f"  - '{col}'")
        print(f"Первая строка: {df.iloc[0].to_dict() if len(df) > 0 else 'нет'}")
    except Exception as e:
        print(f"Ошибка {f}: {e}")