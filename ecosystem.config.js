module.exports = {
  apps: [{
    name: 'asfalt-app',
    script: 'npm',
    args: 'start',
    env: {
      NODE_ENV: 'production',
      UNF_LOGIN: 'Robot',
      UNF_PASSWORD: '962vz18d',
      UNF_BASE_URL: 'https://tas-v.corp.rarus-cloud.ru/UNF',
      CRON_SECRET: 'icg72xf3b1',
      DATABASE_URL: 'file:./data/sqlite.db',
      TELEGRAM_BOT_TOKEN: '1963887065:AAFuxC-UXouiiGS2Z0TRaWmM0i0snhoUN3g',
      TELEGRAM_CHAT_IDS: '1005641275,1194197895,1383333084'
    }
  }]
};
