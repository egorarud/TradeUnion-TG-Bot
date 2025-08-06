require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const logger = require('./utils/logger');
const prisma = require('./models');
const adminPanel = require('./admin');
const fitnessCommands = require('./commands/fitness');
const { mainMenu } = require('./menus');
const { startReminderScheduler } = require('./services/reminderService');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Обработка любого первого сообщения пользователя
// В приветствии и при регистрации используем только mainMenu
bot.on('message', async (ctx, next) => {
  // Логируем взаимодействие пользователя
  logger.info(`User message: id=${ctx.from.id}, name=${ctx.from.first_name || ''} ${ctx.from.last_name || ''}, username=${ctx.from.username || ''}, type=${ctx.message?.chat?.type || ''}, text=${ctx.message.text || ''}`);
  // Не реагируем на команды (их обрабатывают другие модули)
  if (ctx.message.text && ctx.message.text.startsWith('/')) return next();
  const tgId = String(ctx.from.id);
  let user = await prisma.user.findUnique({ where: { telegramId: tgId } });
  if (!user) {
    await prisma.user.create({
      data: {
        telegramId: tgId,
        fullName: ctx.from.first_name || '',
        phone: '',
      }
    });
    await ctx.reply(
      'Добро пожаловать! Для начала работы выберите действие в меню ниже:',
      mainMenu
    );
    return;
  }
  return next();
});

// Кнопка "Старт" вызывает стандартное приветствие и меню
bot.action('first_start', (ctx) => {
  ctx.deleteMessage().catch(() => {});
  ctx.reply(
    'Добро пожаловать в чат-бот профсоюзной поддержки!\n\n' +
    'Доступные функции:\n' +
    '• Запись в фитнес-центр\n' +
    '• Запись на мероприятия\n' +
    '• Программа преференций\n' +
    '• Консультация по договору\n' +
    '• Обратная связь',
    mainMenu
  );
});

// Команды пользователя
require('./commands/start')(bot);
require('./commands/events')(bot);
fitnessCommands(bot);
// ...другие команды

// Админ-панель
adminPanel(bot);

// Глобальное логирование ошибок Telegraf
bot.catch((err, ctx) => {
  logger.error(`Telegraf error for user ${ctx?.from?.id || 'unknown'}: ${err.stack || err}`);
});

// Глобальное логирование необработанных исключений
process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection: ${reason && reason.stack ? reason.stack : reason}`);
});
process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.stack || err}`);
});

bot.launch();
logger.info('Бот запущен');
startReminderScheduler(bot);

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM')); 