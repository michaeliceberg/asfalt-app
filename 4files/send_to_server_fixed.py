import requests
import pandas as pd
import os
import re
from datetime import datetime
from collections import defaultdict
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# API_URL = "http://127.0.0.1:3000/api/excel-import"
API_URL = "https://abziceberg.ru/api/excel-import"

def detect_factory_by_warehouse(warehouse: str) -> str:
    if pd.isna(warehouse):
        return None
    warehouse_lower = str(warehouse).lower()
    if 'щелково' in warehouse_lower or 'заречная' in warehouse_lower:
        return 'Щ'
    if 'скоропусковский' in warehouse_lower:
        return 'СП'
    return None

def extract_order_number(order_str: str) -> str:
    if pd.isna(order_str):
        return None
    match = re.search(r'айс(\d+)', str(order_str))
    if match:
        return match.group(1)
    return str(order_str)

def format_date(date_value):
    if pd.isna(date_value):
        return datetime.now().strftime('%d.%m.%Y %H:%M:%S')
    if isinstance(date_value, datetime):
        return date_value.strftime('%d.%m.%Y %H:%M:%S')
    date_str = str(date_value)
    if re.match(r'\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}:\d{2}', date_str):
        return date_str
    if re.match(r'\d{2}\.\d{2}\.\d{4}', date_str):
        return date_str + ' 00:00:00'
    return date_str

def get_material_type(material: str) -> str:
    material_lower = str(material).lower()
    if 'асфальт' in material_lower or 'а/б' in material_lower or 'щма' in material_lower:
        return 'asphalt'
    if 'бст' in material_lower or 'бетон' in material_lower:
        return 'concrete'
    return 'unknown'

def convert_quantity(quantity: float, unit: str, material: str) -> float:
    if pd.isna(quantity):
        return 0
    unit_lower = str(unit).lower()
    material_type = get_material_type(material)
    if unit_lower in ['т', 'тонна', 'тонны']:
        return quantity
    if unit_lower in ['м3', 'м³', 'куб.м']:
        if material_type == 'concrete':
            return quantity * 2.4
        else:
            return quantity * 2.5
    if material_type == 'asphalt':
        if quantity > 1000:
            return quantity / 1000
        return quantity
    elif material_type == 'concrete':
        if quantity < 100:
            return quantity * 2.4
        return quantity
    return quantity

def process_shipments(filepath):
    print(f"\n📄 Обработка отгрузок: {filepath}")
    # Пропускаем первую строку (с датами), заголовки на второй строке
    df = pd.read_excel(filepath, header=0, skiprows=1)
    print(f"   Всего строк: {len(df)}")

    shipments_by_factory = defaultdict(list)
    order_factory_map = {}
    skipped = 0
    converted_count = 0

    for idx, row in df.iterrows():
        number = row.get('Номер')
        if pd.isna(number):
            skipped += 1
            continue

        warehouse = row.get('Склад', '')
        factory = detect_factory_by_warehouse(warehouse)
        if not factory:
            skipped += 1
            continue

        quantity_raw = float(row.get('Количество', 0))
        unit = row.get('ЕдиницаИзмерения', '')
        material = str(row.get('Номенклатура', ''))
        quantity = convert_quantity(quantity_raw, unit, material)

        if unit in ['м3', 'м³']:
            converted_count += 1

        client_order = row.get('ЗаказПокупателя', '')
        order_number = extract_order_number(client_order)

        if order_number and order_number not in order_factory_map:
            order_factory_map[order_number] = factory

        date_value = row.get('ДатаДокум', '')
        if pd.isna(date_value):
            date_value = row.get('Дата', '')
        date_str = format_date(date_value)

        record = {
            'number': str(number),
            'date': date_str,
            'division': factory,
            'customer': str(row.get('Контрагент', '')),
            'consignee': str(row.get('Грузополучатель', '')),
            'material': material,
            'quantity': quantity,
            'driver': str(row.get('Водитель', '')) if not pd.isna(row.get('Водитель')) else None,
            'licensePlate': str(row.get('ГосНомер', '')) if not pd.isna(row.get('ГосНомер')) else None,
            'clientRequestNumber': order_number,
        }
        shipments_by_factory[factory].append(record)

    print(f"\n   Обработано: {len(df) - skipped} строк, пропущено: {skipped}")
    print(f"   Конвертировано из м³ в тонны: {converted_count}")

    for factory, records in shipments_by_factory.items():
        print(f"   Отправка {factory}: {len(records)} отгрузок")
        for i in range(0, len(records), 50):
            chunk = records[i:i+50]
            payload = {'factory': factory, 'type': 'shipments', 'data': chunk}
            try:
                response = requests.post(API_URL, json=payload, verify=False, timeout=30)
                if response.status_code == 200:
                    result = response.json()
                    print(f"   ✅ {factory}: {result.get('processed', 0)}/{len(chunk)}")
                else:
                    print(f"   ❌ {factory}: {response.status_code}")
            except Exception as e:
                print(f"   ❌ {factory}: {e}")

    return order_factory_map

def process_requests(filepath, order_factory_map):
    print(f"\n📄 Обработка заявок: {filepath}")
    # Заголовки на строке 1 (индекс 1), данные со строки 2
    df = pd.read_excel(filepath, header=1)
    print(f"   Всего строк: {len(df)}")
    print(f"   Колонки: {list(df.columns)}")

    requests_by_factory = defaultdict(list)
    skipped = 0
    matched = 0
    converted_count = 0

    for idx, row in df.iterrows():
        order_number_raw = row.get('ЗаказПокупателя')
        if pd.isna(order_number_raw):
            skipped += 1
            continue

        order_number = extract_order_number(order_number_raw)
        factory = order_factory_map.get(order_number)

        if not factory:
            # Не пропускаем, а выводим предупреждение
            if idx < 20:  # только первые 20 для отладки
                print(f"   ⚠️ Строка {idx}: заказ {order_number} не найден в отгрузках")
            skipped += 1
            continue

        matched += 1
        plan_qty_raw = float(row.get('КоличествоПриход', 0))
        material = str(row.get('Номенклатура', ''))
        material_type = get_material_type(material)

        if material_type == 'asphalt':
            if plan_qty_raw > 1000:
                plan_qty = plan_qty_raw / 1000
                converted_count += 1
            else:
                plan_qty = plan_qty_raw
        elif material_type == 'concrete':
            if plan_qty_raw < 1000:
                plan_qty = plan_qty_raw * 2.4
                converted_count += 1
            else:
                plan_qty = plan_qty_raw
        else:
            plan_qty = plan_qty_raw

        date_value = row.get('Дата', '')
        date_str = format_date(date_value)

        record = {
            'number': order_number,
            'date': date_str,
            'division': factory,
            'customer': str(row.get('Контрагент', '')),
            'consignee': str(row.get('Грузополучатель', '')),
            'material': material,
            'quantity': plan_qty,
            'clientRequestNumber': order_number,
            'closed': False,
            'delivery_date': date_str.split()[0] if date_str else None,
        }
        requests_by_factory[factory].append(record)

    print(f"\n   Совпадений: {matched}, пропущено: {skipped}")
    print(f"   Конвертировано в тонны: {converted_count}")

    for factory, records in requests_by_factory.items():
        print(f"   Отправка {factory}: {len(records)} заявок")
        for i in range(0, len(records), 50):
            chunk = records[i:i+50]
            payload = {'factory': factory, 'type': 'requests', 'data': chunk}
            try:
                response = requests.post(API_URL, json=payload, verify=False, timeout=30)
                if response.status_code == 200:
                    result = response.json()
                    print(f"   ✅ {factory}: {result.get('processed', 0)}/{len(chunk)}")
                else:
                    print(f"   ❌ {factory}: {response.status_code}")
            except Exception as e:
                print(f"   ❌ {factory}: {e}")

def process_incoming(filepath):
    print(f"\n📄 Обработка поступлений: {filepath}")
    df = pd.read_excel(filepath, header=0, skiprows=1)
    print(f"   Всего строк: {len(df)}")

    records_by_factory = defaultdict(list)
    skipped = 0
    converted_count = 0

    for idx, row in df.iterrows():
        number = row.get('Номер')
        if pd.isna(number):
            skipped += 1
            continue

        warehouse = row.get('Склад', '')
        factory = detect_factory_by_warehouse(warehouse)

        if not factory:
            number_str = str(number)
            if 'Щ' in number_str or 'щелково' in number_str.lower():
                factory = 'Щ'
            elif 'СП' in number_str or 'скоропусковский' in number_str.lower():
                factory = 'СП'

        if not factory:
            print(f"   ⚠️ Строка {idx}: завод не определён: {number}")
            skipped += 1
            continue

        quantity_raw = float(row.get('Количество', 0))
        unit = row.get('ЕдиницаИзмерения', '')
        material = str(row.get('Номенклатура', ''))
        quantity = convert_quantity(quantity_raw, unit, material)

        if unit in ['м3', 'м³']:
            converted_count += 1

        date_value = row.get('ДатаДокум', '')
        if pd.isna(date_value):
            date_value = row.get('Дата', '')
        date_str = format_date(date_value)

        record = {
            'number': str(number),
            'date': date_str,
            'division': factory,
            'supplier': str(row.get('Контрагент', '')),
            'material': material,
            'quantity': quantity,
            'driver': str(row.get('Водитель', '')) if not pd.isna(row.get('Водитель')) else None,
            'licensePlate': str(row.get('ГосНомер', '')) if not pd.isna(row.get('ГосНомер')) else None,
        }
        records_by_factory[factory].append(record)

    print(f"\n   Обработано: {len(df) - skipped} строк, пропущено: {skipped}")
    print(f"   Конвертировано из м³ в тонны: {converted_count}")

    for factory, records in records_by_factory.items():
        print(f"   Отправка {factory}: {len(records)} поступлений")
        for i in range(0, len(records), 50):
            chunk = records[i:i+50]
            payload = {'factory': factory, 'type': 'incoming', 'data': chunk}
            try:
                response = requests.post(API_URL, json=payload, verify=False, timeout=30)
                if response.status_code == 200:
                    result = response.json()
                    print(f"   ✅ {factory}: {result.get('processed', 0)}/{len(chunk)}")
                else:
                    print(f"   ❌ {factory}: {response.status_code}")
            except Exception as e:
                print(f"   ❌ {factory}: {e}")

def main():
    print("🚀 Отправка данных на iCombinator")
    print("=" * 60)

    # base_path = "/Users/mac/Desktop/asfalt2027/asfalt-app/4files"
    base_path = "F:/obmen/Delta"


    realiz_path = os.path.join(base_path, 'realiz.xlsx')
    order_factory_map = {}

    if os.path.exists(realiz_path):
        order_factory_map = process_shipments(realiz_path)
        print(f"\n📊 Определено {len(order_factory_map)} заказов")
    else:
        print(f"⚠️ Файл не найден: {realiz_path}")
        return

    hotimprodat_path = os.path.join(base_path, 'hotimprodat.xlsx')
    if os.path.exists(hotimprodat_path):
        process_requests(hotimprodat_path, order_factory_map)
    else:
        print(f"⚠️ Файл не найден: {hotimprodat_path}")

    postup_path = os.path.join(base_path, 'postup.xlsx')
    if os.path.exists(postup_path):
        process_incoming(postup_path)
    else:
        print(f"⚠️ Файл не найден: {postup_path}")

    print("\n" + "=" * 60)
    print("✅ Готово!")

if __name__ == '__main__':
    main()


