// PM2 запускает `npm start` (next start). Next.js сам подхватывает
// переменные окружения из .env.production / .env.local в корне проекта —
// поэтому здесь секретов быть не должно. Файл .env.production на сервере
// НЕ коммитится в git, см. .env.example для списка нужных переменных.
module.exports = {
  apps: [{
    name: 'asfalt-app',
    script: 'npm',
    args: 'start',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
