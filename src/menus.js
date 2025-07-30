const { Markup } = require('telegraf');

const mainMenu = Markup.keyboard([
  ['🏋️ Фитнес-центр', '📆 Мероприятия'],
  ['🎁 Преференции', '❔Вопрос администрации'],
  ['📚 Консультация по договору']
]).resize();

module.exports = { mainMenu }; 