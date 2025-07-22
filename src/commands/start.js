const { Markup } = require('telegraf');
const { getAllPrivileges } = require('../services/privilegeService');
const { addQuestion, answerQuestion, getQuestionById } = require('../services/questionService');
const { getUpcomingEvents } = require('../services/eventService');
const prisma = require('../models');
const { handleFitnessCommand, handleMyFitnessCommand } = require('./fitness');

const userStates = {};
const adminStates = {};

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
        [Markup.button.callback('Фитнес-центр', 'show_fitness')],
        [Markup.button.callback('Мероприятия', 'show_events')],
        [Markup.button.callback('Узнать о привилегиях', 'show_privileges')],
        [Markup.button.callback('Задать вопрос', 'ask_question')]
      ])
    );
  });

  bot.action('show_events', async (ctx) => {
    ctx.answerCbQuery();
    await ctx.reply('Выберите действие:',
      Markup.inlineKeyboard([
        [Markup.button.callback('Мои мероприятия', 'my_events')],
        [Markup.button.callback('Предстоящие мероприятия', 'upcoming_events')]
      ])
    );
  });

  // Кнопка 'Мои мероприятия'
  bot.action('my_events', async (ctx) => {
    ctx.answerCbQuery();
    let user = await require('../models').user.findUnique({ where: { telegramId: String(ctx.from.id) } });
    if (!user) {
      return ctx.reply('Вы ещё не записаны ни на одно мероприятие.');
    }
    const regs = await require('../services/eventService').getUserUpcomingRegistrations(user.id);
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

  // Кнопка 'Предстоящие мероприятия'
  bot.action('upcoming_events', async (ctx) => {
    ctx.answerCbQuery();
    const events = await require('../services/eventService').getUpcomingEvents();
    if (!events.length) {
      return ctx.reply('Ближайших мероприятий нет.');
    }
    await ctx.reply('Список мероприятий:');
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

  bot.action('ask_question', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply('Пожалуйста, напишите свой вопрос одним сообщением.');
    userStates[ctx.from.id] = 'waiting_for_question';
  });

  bot.on('text', async (ctx, next) => {
    // Пользователь задаёт вопрос
    if (userStates[ctx.from.id] === 'waiting_for_question') {
      const user = ctx.from;
      const question = await addQuestion({
        userTgId: String(user.id),
        userName: user.username || user.first_name || '',
        text: ctx.message.text
      });
      // Пересылаем админам с кнопкой "Ответить"
      const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',') : [];
      const msg = `Вопрос #${question.id} от @${user.username || '-'} (id: ${user.id}):\n${ctx.message.text}`;
      for (const adminId of adminIds) {
        try {
          await ctx.telegram.sendMessage(adminId, msg, Markup.inlineKeyboard([
            [Markup.button.callback('Ответить', `answer_${question.id}`)]
          ]));
        } catch (e) {}
      }
      ctx.reply('Ваш вопрос отправлен администрации. Спасибо!');
      userStates[ctx.from.id] = undefined;
    } else if (adminStates[ctx.from.id] && adminStates[ctx.from.id].questionId) {
      // Админ отвечает на вопрос
      const { questionId } = adminStates[ctx.from.id];
      const question = await getQuestionById(questionId);
      if (!question) {
        ctx.reply('Вопрос не найден.');
        adminStates[ctx.from.id] = undefined;
        return;
      }
      await answerQuestion(questionId, ctx.message.text);
      try {
        await ctx.telegram.sendMessage(question.userTgId, `Ответ администрации на ваш вопрос:\n${question.text}\n\n${ctx.message.text}`);
        ctx.reply('Ответ отправлен пользователю.');
      } catch (e) {
        ctx.reply('Не удалось отправить ответ пользователю.');
      }
      adminStates[ctx.from.id] = undefined;
    } else {
      return next();
    }
  });

  // Кнопка "Ответить" для админа
  bot.action(/answer_(\d+)/, async (ctx) => {
    ctx.answerCbQuery();
    const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',') : [];
    if (!adminIds.includes(String(ctx.from.id))) {
      return ctx.reply('Доступ запрещён.');
    }
    const questionId = Number(ctx.match[1]);
    const question = await getQuestionById(questionId);
    if (!question) {
      return ctx.reply('Вопрос не найден.');
    }
    if (question.answer) {
      return ctx.reply('На этот вопрос уже был дан ответ.');
    }
    ctx.reply(`Введите ответ на вопрос #${questionId} от @${question.userName || '-'}:\n${question.text}`);
    adminStates[ctx.from.id] = { questionId };
  });

  // Подменю фитнеса
  bot.action('show_fitness', async (ctx) => {
    ctx.answerCbQuery();
    await ctx.reply('Выберите действие:',
      Markup.inlineKeyboard([
        [Markup.button.callback('Записаться на тренировку', 'fitness_signup')],
        [Markup.button.callback('Мои записи', 'fitness_my')]
      ])
    );
  });

  // Кнопка "Записаться на тренировку"
  bot.action('fitness_signup', async (ctx) => {
    await ctx.answerCbQuery();
    await handleFitnessCommand(ctx);
  });

  // Кнопка "Мои записи"
  bot.action('fitness_my', async (ctx) => {
    await ctx.answerCbQuery();
    await handleMyFitnessCommand(ctx);
  });
};
