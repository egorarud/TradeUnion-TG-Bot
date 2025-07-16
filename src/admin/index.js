// Здесь будет логика админ-панели для Telegram (ограничение по Telegram ID)

module.exports = (bot) => {
  // Пример: команда только для админов
  bot.command('admin', (ctx) => {
    const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',') : [];
    if (!adminIds.includes(String(ctx.from.id))) {
      return ctx.reply('Доступ запрещён.');
    }
    ctx.reply('Добро пожаловать в админ-панель!');
  });
}; 