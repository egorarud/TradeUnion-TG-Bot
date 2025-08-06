const { Markup } = require('telegraf');

const mainMenu = Markup.keyboard([
  ['🏋️ Фитнес-центр', '📆 Мероприятия'],
  ['🎁 Преференции', '❔Вопрос администрации'],
  ['📚 Консультация', '🔔 Напоминания']
]).resize();

module.exports = { mainMenu }; 