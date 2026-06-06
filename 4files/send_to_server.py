  
    
    
    
    
    # TODO: ЭТО ДЛЯ 7.22
# import requests
# import pandas as pd
# import os
# import re
# from datetime import datetime
# from collections import defaultdict
# import urllib3

# urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# API_URL = "https://abziceberg.ru/api/excel-import"

# def detect_factory_by_warehouse(warehouse: str) -> str:
#     """Определяет завод по названию склада"""
#     if pd.isna(warehouse):
#         return None
    
#     warehouse_lower = str(warehouse).lower()
    
#     # Щёлково
#     if 'щелково' in warehouse_lower or 'заречная' in warehouse_lower:
#         return 'Щ'
    
#     # Сергиев Посад (Скоропусковский)
#     if 'скоропусковский' in warehouse_lower:
#         return 'СП'
    
#     return None

# def extract_order_number(order_str: str) -> str:
#     """Извлекает числовой номер заказа из строки 'Заказ покупателя айс00000543 от ...'"""
#     if pd.isna(order_str):
#         return None
#     match = re.search(r'айс(\d+)', str(order_str))
#     if match:
#         return match.group(1)
#     return str(order_str)

# def process_shipments(filepath):
#     """Обработка отгрузок (10realiz.xlsx) - определяем завод по складу"""
#     print(f"\n📄 Обработка отгрузок: {filepath}")
#     df = pd.read_excel(filepath, header=0)
    
#     shipments_by_factory = defaultdict(list)
#     # Также запоминаем, какой завод соответствует каждому заказу
#     order_factory_map = {}
    
#     for _, row in df.iterrows():
#         number = row.get('Номер')
#         if pd.isna(number):
#             continue
        
#         # Определяем завод по складу
#         warehouse = row.get('Склад', '')
#         factory = detect_factory_by_warehouse(warehouse)
        
#         if not factory:
#             print(f"   ⚠️ Не удалось определить завод для склада: {warehouse}")
#             continue
        
#         # Извлекаем номер заказа
#         client_order = row.get('ЗаказПокупателя', '')
#         order_number = extract_order_number(client_order)
        
#         # Запоминаем, какой завод у этого заказа
#         if order_number and order_number not in order_factory_map:
#             order_factory_map[order_number] = factory
        
#         record = {
#             'number': str(number),
#             'date': str(row.get('ДатаДокум', '')),
#             'division': factory,
#             'customer': str(row.get('Контрагент', '')),
#             'consignee': str(row.get('Грузополучатель', '')),
#             'material': str(row.get('Номенклатура', '')),
#             'quantity': float(row.get('Количество', 0)),
#             'driver': str(row.get('Водитель', '')) if not pd.isna(row.get('Водитель')) else None,
#             'licensePlate': str(row.get('ГосНомер', '')) if not pd.isna(row.get('ГосНомер')) else None,
#             'clientRequestNumber': order_number,
#         }
#         shipments_by_factory[factory].append(record)
    
#     # Отправляем отгрузки
#     for factory, records in shipments_by_factory.items():
#         payload = {'factory': factory, 'type': 'shipments', 'data': records}
#         response = requests.post(API_URL, json=payload, verify=False, timeout=30)
#         if response.status_code == 200:
#             print(f"   ✅ {factory}: {len(records)} отгрузок")
#         else:
#             print(f"   ❌ {factory}: {response.status_code}")
    
#     return order_factory_map

# def process_requests(filepath, order_factory_map):
#     """Обработка заявок (40hotimprodat.xlsx) - завод определяем по карте заказов"""
#     print(f"\n📄 Обработка заявок: {filepath}")
#     df = pd.read_excel(filepath, header=0)
    
#     requests_by_factory = defaultdict(list)
    
#     for _, row in df.iterrows():
#         order_number_raw = row.get('ЗаказПокупателя')
#         if pd.isna(order_number_raw):
#             continue
        
#         # Извлекаем номер заказа
#         order_number = extract_order_number(order_number_raw)
        
#         # Определяем завод по карте (из отгрузок)
#         factory = order_factory_map.get(order_number)
        
#         if not factory:
#             # Если заказ ещё не встречался в отгрузках, пропускаем
#             print(f"   ⚠️ Заказ {order_number} не найден в отгрузках, пропускаем")
#             continue
        
#         record = {
#             'number': order_number,
#             'original_number': str(order_number_raw),
#             'date': str(row.get('Дата', '')),
#             'division': factory,
#             'customer': str(row.get('Контрагент', '')),
#             'consignee': str(row.get('Грузополучатель', '')),
#             'material': str(row.get('Номенклатура', '')),
#             'plan_quantity': float(row.get('КоличествоПриход', 0)),
#             'fact_quantity': float(row.get('КоличествоРасход', 0)),
#             'comment': str(row.get('Комментарий', '')),
#         }
#         requests_by_factory[factory].append(record)
    
#     # Отправляем заявки
#     for factory, records in requests_by_factory.items():
#         payload = {'factory': factory, 'type': 'requests', 'data': records}
#         response = requests.post(API_URL, json=payload, verify=False, timeout=30)
#         if response.status_code == 200:
#             print(f"   ✅ {factory}: {len(records)} заявок")
#         else:
#             print(f"   ❌ {factory}: {response.status_code}")

# def process_incoming(filepath):
#     """Обработка поступлений (10postup.xlsx)"""
#     print(f"\n📄 Обработка поступлений: {filepath}")
#     df = pd.read_excel(filepath, header=0)
    
#     records_by_factory = defaultdict(list)
    
#     for _, row in df.iterrows():
#         number = row.get('Номер')
#         if pd.isna(number):
#             continue
        
#         # Определяем завод по складу или по номеру документа
#         warehouse = row.get('Склад', '')
#         factory = detect_factory_by_warehouse(warehouse)
        
#         if not factory:
#             number_str = str(number)
#             if 'Щ' in number_str or 'щелково' in number_str.lower():
#                 factory = 'Щ'
#             elif 'СП' in number_str or 'скоропусковский' in number_str.lower():
#                 factory = 'СП'
        
#         if not factory:
#             print(f"   ⚠️ Не удалось определить завод для поступления: {number}")
#             continue
        
#         record = {
#             'number': str(number),
#             'date': str(row.get('ДатаДокум', '')),
#             'division': factory,
#             'supplier': str(row.get('Контрагент', '')),
#             'material': str(row.get('Номенклатура', '')),
#             'quantity': float(row.get('Количество', 0)),
#             'driver': str(row.get('Водитель', '')) if not pd.isna(row.get('Водитель')) else None,
#             'licensePlate': str(row.get('ГосНомер', '')) if not pd.isna(row.get('ГосНомер')) else None,
#         }
#         records_by_factory[factory].append(record)
    
#     for factory, records in records_by_factory.items():
#         payload = {'factory': factory, 'type': 'incoming', 'data': records}
#         response = requests.post(API_URL, json=payload, verify=False, timeout=30)
#         if response.status_code == 200:
#             print(f"   ✅ {factory}: {len(records)} поступлений")
#         else:
#             print(f"   ❌ {factory}: {response.status_code}")

# def main():
#     print("🚀 Отправка данных на iCombinator")
#     print("=" * 60)
    
#     base_path = "F:/obmen/Delta/"
    
#     # 1. Сначала обрабатываем отгрузки (realiz) - получаем карту заказ -> завод
#     realiz_path = os.path.join(base_path, '10realiz.xlsx')
#     order_factory_map = {}
    
#     if os.path.exists(realiz_path):
#         order_factory_map = process_shipments(realiz_path)
#         print(f"\n📊 Определено {len(order_factory_map)} заказов с привязкой к заводам")
#     else:
#         print(f"⚠️ Файл не найден: {realiz_path}")
#         return
    
#     # 2. Обрабатываем заявки (hotimprodat) с использованием карты
#     hotimprodat_path = os.path.join(base_path, '40hotimprodat.xlsx')
#     if os.path.exists(hotimprodat_path):
#         process_requests(hotimprodat_path, order_factory_map)
#     else:
#         print(f"⚠️ Файл не найден: {hotimprodat_path}")
    
#     # 3. Обрабатываем поступления (postup)
#     postup_path = os.path.join(base_path, '10postup.xlsx')
#     if os.path.exists(postup_path):
#         process_incoming(postup_path)
#     else:
#         print(f"⚠️ Файл не найден: {postup_path}")
    
#     print("\n" + "=" * 60)
#     print("✅ Готово!")

# if __name__ == '__main__':
#     main()


    
    
    
    
    
    
    # # send_to_server.py
# import requests
# import pandas as pd
# import os
# from datetime import datetime
# import urllib3

# urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# API_URL = "https://abziceberg.ru/api/excel-import"

# def send_file(filepath, factory, record_type, skiprows=1):
#     """Отправляет данные из Excel на сервер"""
#     try:
#         print(f"\n📄 Обработка {filepath}...")
        
#         # Читаем Excel, пропуская первую строку (там временные метки)
#         df = pd.read_excel(filepath, header=0, skiprows=skiprows)
        
#         print(f"   Прочитано строк: {len(df)}")
#         print(f"   Колонки: {list(df.columns)[:5]}...")
        
#         # Переименовываем колонки для соответствия БД
#         column_mapping = {
#             'Номер': 'number',
#             'Дата': 'date',
#             'Поставщик': 'supplier',
#             'Номенклатура': 'material',
#             'Количество': 'quantity',
#             'КоличествоПриход': 'quantity',
#             'КоличествоРасход': 'quantity',
#             'Грузополучатель': 'consignee',
#             'Контрагент': 'customer',
#             'Водитель': 'driver',
#             'ГосНомер': 'licensePlate',
#             'ЗаказПокупателя': 'clientRequestNumber',
#             'Подразделение': 'division',
#         }
        
#         # Переименовываем колонки
#         df.rename(columns=column_mapping, inplace=True)
        
#         # Оставляем только нужные колонки
#         if record_type == 'shipments':
#             keep_cols = ['number', 'date', 'material', 'quantity', 'consignee', 'customer', 'driver', 'licensePlate', 'clientRequestNumber']
#         elif record_type == 'incoming':
#             keep_cols = ['number', 'date', 'supplier', 'material', 'quantity', 'driver', 'licensePlate']
#         elif record_type == 'requests':
#             keep_cols = ['number', 'date', 'material', 'quantity', 'consignee', 'customer', 'clientRequestNumber']
#         else:
#             keep_cols = []
        
#         for col in keep_cols:
#             if col not in df.columns:
#                 df[col] = None
        
#         df = df[keep_cols]
        
#         # Очистка данных
#         df = df.where(pd.notnull(df), None)
        
#         records = df.to_dict(orient='records')
        
#         # Удаляем пустые записи
#         records = [r for r in records if r.get('number')]
        
#         if not records:
#             print(f"   ⚠️ Нет данных для отправки")
#             return
        
#         payload = {
#             'factory': factory,
#             'type': record_type,
#             'data': records,
#             'timestamp': datetime.now().isoformat()
#         }
        
#         print(f"   Отправка {len(records)} записей...")
#         response = requests.post(API_URL, json=payload, verify=False, timeout=30)
        
#         if response.status_code == 200:
#             result = response.json()
#             print(f"   ✅ {filepath}: {result.get('processed', 0)}/{len(records)} записей")
#         else:
#             print(f"   ❌ {filepath}: {response.status_code} - {response.text[:200]}")
            
#     except Exception as e:
#         print(f"   ❌ {filepath}: {e}")

# def main():
#     print("🚀 Отправка данных на iCombinator")
#     print("=" * 60)
    
#     # Файлы: (путь, завод, тип, пропустить строк)
#     files = [
#         ('40hotimprodat.xlsx', 'СП', 'requests', 1),
#         ('1010postup.xlsx', 'Щ', 'incoming', 1),
#         ('1010realiz.xlsx', 'Щ', 'shipments', 1),
#         ('10peremeshenie.xlsx', 'СП', 'shipments', 1),
#     ]
    
#     for filepath, factory, record_type, skip in files:
#         if os.path.exists(filepath):
#             send_file(filepath, factory, record_type, skip)
#         else:
#             print(f"⚠️ Файл не найден: {filepath}")
    
#     print("\n" + "=" * 60)
#     print("✅ Готово!")

# if __name__ == '__main__':
#     main()