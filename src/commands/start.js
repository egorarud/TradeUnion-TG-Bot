const { Markup } = require('telegraf');

module.exports = (bot) => {
  bot.start((ctx) => {
    ctx.reply(
      'Добро пожаловать в чат-бот профсоюзной поддержки!\n\n' +
      'Доступные функции:\n' +
      '• Запись в фитнес-центр\n' +
      '• Запись на мероприятия\n' +
      '• Программа преференций\n' +
      '• Консультация по договору\n' +
      '• Обратная связь',
      Markup.inlineKeyboard([
        [Markup.button.callback('Узнать о привилегиях', 'show_privileges')]
      ])
    );
  });

  bot.action('show_privileges', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply(
      'Профсоюзная программа преференций:\n' +
      '— Скидки на фитнес и спорт\n' +
      '— Партнёрские предложения\n' +
      '— Бонусы для членов профсоюза\n\n' +
      'Актуальный список доступен на сайте: https://example.com/privileges\n' +
      'Или скачайте PDF: [Скачать](https://example.com/privileges.pdf)',
      { parse_mode: 'Markdown' }
    );
  });
}; 