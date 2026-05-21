import fs from 'fs';

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let inQuotes = false;
  let current = '';
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

const content = fs.readFileSync('/tmp/status.csv', 'utf-8');
const lines = content.split('\n');

console.log('Всего строк в файле:', lines.length);
console.log('Первая строка (заголовок):', lines[0].substring(0, 200));
console.log('');

for (let i = 1; i <= 5; i++) {
  if (!lines[i]) continue;
  const cols = parseCSVLine(lines[i]);
  console.log(`\n=== Строка ${i+1} (индекс ${i}) ===`);
  console.log(`Количество колонок: ${cols.length}`);
  for (let j = 0; j < Math.min(cols.length, 15); j++) {
    console.log(`  [${j}] = ${cols[j].substring(0, 60)}`);
  }
}
