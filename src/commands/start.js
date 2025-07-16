const { Markup } = require('telegraf');
const { getAllPrivileges } = require('../services/privilegeService');

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

  bot.action('show_privileges', async (ctx) => {
    ctx.answerCbQuery();
    const privileges = await getAllPrivileges();
    if (!privileges.length) {
      return ctx.reply('Список привилегий пока пуст.');
    }
    let text = '*Профсоюзная программа преференций:*\n\n';
    privileges.forEach((p, i) => {
      text += `${i + 1}. *${p.title}*\n${p.details}`;
      if (p.link) text += `\n[Подробнее](${p.link})`;
      text += '\n\n';
    });
    ctx.reply(text, { parse_mode: 'Markdown' });
  });
}; 