import requests
import json

# API_URL = "http://localhost:3000/api/excel-import"

API_URL = "http://127.0.0.1:3000/api/excel-import"

# Тестовая отгрузка
test_data = {
    "factory": "Щ",
    "type": "shipments",
    "data": [{
        "number": "TEST001",
        "date": "05.06.2026 12:00:00",
        "division": "Щ",
        "customer": "Тестовый клиент",
        "consignee": "Тестовый получатель",
        "material": "Асфальт тестовый",
        "quantity": 100,
        "driver": "Тестовый водитель",
        "licensePlate": "ТЕСТ123",
        "clientRequestNumber": "99999"
    }]
}

response = requests.post(API_URL, json=test_data)
print(f"Status: {response.status_code}")
print(f"Response: {response.json()}")