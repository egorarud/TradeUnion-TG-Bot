require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const logger = require('./utils/logger');
const prisma = require('./models');
const adminPanel = require('./admin');
const fitnessCommands = require('./commands/fitness');
const { mainMenu } = require('./menus');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Обработка любого первого сообщения пользователя
// В приветствии и при регистрации используем только mainMenu
bot.on('message', async (ctx, next) => {
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

bot.launch().then(() => logger.info('Бот запущен'));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM')); 