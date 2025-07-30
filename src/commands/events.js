const { Markup } = require('telegraf');
const { getUpcomingEvents, getEventById, registerUserForEvent, getUserUpcomingRegistrations, cancelRegistration } = require('../services/eventService');
const prisma = require('../models');

const userEventStates = {};

module.exports = (bot) => {
  // Команда /events
  bot.command('events', async (ctx) => {
    const events = await getUpcomingEvents();
    if (!events.length) {
      return ctx.reply('Ближайших мероприятий нет.');
    }
    for (const event of events) {
      const date = new Date(event.date).toLocaleString('ru-RU');
      await ctx.replyWithMarkdown(
        `*${event.title}*\n${event.description}\n\nДата: ${date}`,
        Markup.inlineKeyboard([
          [Markup.button.callback('Записаться', `register_event_${event.id}`)]
        ])
      );
    }
  });

  // Кнопка "Записаться"
  bot.action(/register_event_(\d+)/, async (ctx) => {
    ctx.answerCbQuery();
    const eventId = Number(ctx.match[1]);
    const event = await getEventById(eventId);
    if (!event) return ctx.reply('Мероприятие не найдено.');
    // Получаем пользователя
    let user = await prisma.user.findUnique({ where: { telegramId: String(ctx.from.id) } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          telegramId: String(ctx.from.id),
          fullName: ctx.from.first_name || '',
          phone: '',
        }
      });
    }
    userEventStates[ctx.from.id] = { eventId };
    ctx.reply('Введите комментарий к записи (например, вопрос или пожелание).', Markup.inlineKeyboard([[Markup.button.callback('Пропустить', 'user_skip')]]));
  });

  // Обработка комментария к записи
  bot.on('text', async (ctx, next) => {
    if (userEventStates[ctx.from.id] && userEventStates[ctx.from.id].eventId) {
      const { eventId } = userEventStates[ctx.from.id];
      let user = await prisma.user.findUnique({ where: { telegramId: String(ctx.from.id) } });
      if (!user) return ctx.reply('Ошибка пользователя.');
      const comment = ctx.message.text === '-' ? null : ctx.message.text;
      const reg = await registerUserForEvent(eventId, user.id, comment);
      if (!reg) {
        ctx.reply('Вы уже зарегистрированы на это мероприятие.');
      } else {
        ctx.reply('Вы успешно записаны на мероприятие!');
      }
      userEventStates[ctx.from.id] = undefined;
    } else {
      return next();
    }
  });

  // Команда /my_events
  bot.command('my_events', async (ctx) => {
    let user = await prisma.user.findUnique({ where: { telegramId: String(ctx.from.id) } });
    if (!user) {
      return ctx.reply('Вы ещё не записаны ни на одно мероприятие.');
    }
    const regs = await getUserUpcomingRegistrations(user.id);
    if (!regs.length) {
      return ctx.reply('У вас нет записей на будущие мероприятия.');
    }
    await ctx.reply('Ваши записи на мероприятия:');
    for (const reg of regs) {
      const event = reg.event;
      const date = new Date(event.date).toLocaleString('ru-RU');
      let text = `*${event.title}*\n${event.description}\nДата: ${date}`;
      if (reg.comment) text += `\nКомментарий: ${reg.comment}`;
      await ctx.replyWithMarkdown(text,
        Markup.inlineKeyboard([
          [Markup.button.callback('Отменить запись', `cancel_reg_${reg.id}`)]
        ])
      );
    }
  });

  // Кнопка отмены записи
  bot.action(/cancel_reg_(\d+)/, async (ctx) => {
    ctx.answerCbQuery();
    let user = await prisma.user.findUnique({ where: { telegramId: String(ctx.from.id) } });
    if (!user) return ctx.reply('Ошибка пользователя.');
    const regId = Number(ctx.match[1]);
    const ok = await cancelRegistration(regId, user.id);
    if (ok) {
      ctx.reply('Ваша запись отменена.');
    } else {
      ctx.reply('Не удалось отменить запись (возможно, она уже отменена или не принадлежит вам).');
    }
  });

  bot.action('user_skip', async (ctx) => {
    ctx.message = { text: '-' };
    if (userEventStates[ctx.from.id] && userEventStates[ctx.from.id].eventId) {
      const { eventId } = userEventStates[ctx.from.id];
      let user = await prisma.user.findUnique({ where: { telegramId: String(ctx.from.id) } });
      if (!user) return ctx.reply('Ошибка пользователя.');
      const comment = null;
      const reg = await registerUserForEvent(eventId, user.id, comment);
      if (!reg) {
        ctx.reply('Вы уже зарегистрированы на это мероприятие.');
      } else {
        ctx.reply('Вы успешно записаны на мероприятие!');
      }
      userEventStates[ctx.from.id] = undefined;
    }
  });
}; 