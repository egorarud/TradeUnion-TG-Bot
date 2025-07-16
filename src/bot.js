require('dotenv').config();
const { Telegraf } = require('telegraf');
const logger = require('./utils/logger');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Команды пользователя
require('./commands/start')(bot);
// ...другие команды

// Админ-панель
require('./admin')(bot);

bot.launch().then(() => logger.info('Бот запущен'));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM')); 