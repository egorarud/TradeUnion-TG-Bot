const { Markup } = require('telegraf');
const { getAllPrivileges } = require('../services/privilegeService');
const { addQuestion, answerQuestion, getQuestionById, getUserQuestionsCountToday, deleteOldAnsweredQuestions } = require('../services/questionService');
const { getUpcomingEvents } = require('../services/eventService');
const prisma = require('../models');
const { handleFitnessCommand, handleMyFitnessCommand } = require('./fitness');
const { askGPT } = require('../services/openaiService');
const faqService = require('../services/faqService');

const userStates = {};
const adminStates = {};

const { mainMenu } = require('../menus');

const consultationMenu = Markup.keyboard([
  ['🏋️ Фитнес-центр', '📆 Мероприятия'],
  ['🎁 Преференции', '📚 Консультация по договору'],
  ['❔Вопрос администрации']
]).resize();

const cancelInlineKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('❌ Отмена', 'cancel_question')]
]);

const cancelMenu = Markup.keyboard([
  ['❌ Отмена']
]).oneTime().resize();

module.exports = (bot) => {
  bot.start(async (ctx) => {
    // Удаляем старые вопросы (старше месяца после ответа)
    await deleteOldAnsweredQuestions();
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
      if (ctx.message.text === '❌ Отмена') {
        // Обработка отмены вынесена в отдельный hears, но на всякий случай дублируем защиту
        return;
      }
      const user = ctx.from;
      const count = await getUserQuestionsCountToday(String(user.id));
      if (count >= 10) {
        await ctx.reply('Вы уже задали 10 вопросов сегодня. Попробуйте снова завтра.', mainMenu);
        userStates[ctx.from.id] = undefined;
        return;
      }
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
      await ctx.reply('Ваш вопрос отправлен администрации. Спасибо!', mainMenu);
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

  bot.hears('🏋️ Фитнес-центр', async (ctx) => {
    await handleFitnessCommand(ctx);
  });
  bot.hears('📆 Мероприятия', async (ctx) => {
    await ctx.reply('Выберите действие:',
      Markup.inlineKeyboard([
        [Markup.button.callback('Мои мероприятия', 'my_events')],
        [Markup.button.callback('Предстоящие мероприятия', 'upcoming_events')]
      ])
    );
  });
  bot.hears('🎁 Преференции', async (ctx) => {
    const privileges = await getAllPrivileges();
    if (!privileges.length) {
      await ctx.reply('Список привилегий пока пуст.', mainMenu);
      return;
    }
    let text = '*Профсоюзная программа преференций:*\n\n';
    privileges.forEach((p, i) => {
      text += `${i + 1}. *${p.title}*\n${p.details}`;
      if (p.link) text += `\n[Подробнее](${p.link})`;
      text += '\n\n';
    });
    await ctx.reply(text, { parse_mode: 'Markdown', ...mainMenu.reply_markup });
  });
  bot.hears('❔Вопрос администрации', async (ctx) => {
    await ctx.reply('Пожалуйста, напишите свой вопрос одним сообщением.', {
      reply_markup: { remove_keyboard: true }
    });
    await ctx.reply('Если передумали, нажмите "Отмена".', cancelInlineKeyboard);
    userStates[ctx.from.id] = 'waiting_for_question';
  });

  bot.action('cancel_question', async (ctx) => {
    if (userStates[ctx.from.id] === 'waiting_for_question') {
      userStates[ctx.from.id] = undefined;
      try {
        await ctx.editMessageReplyMarkup(); // убрать инлайн-кнопки
      } catch (e) {}
      await ctx.reply('Ввод вопроса отменён.', mainMenu);
    }
    ctx.answerCbQuery();
  });

  bot.hears('📚 Консультация по договору', async (ctx) => {
    const topics = await faqService.getAllTopics();
    if (!topics.length) return ctx.reply('Темы консультаций пока не добавлены.');
    const topicButtons = topics.map(topic => [Markup.button.callback(topic.title, `consult_topic_${topic.id}`)]);
    topicButtons.push([Markup.button.callback('Задать свой вопрос', 'consult_ask_custom')]);
    await ctx.reply('Выберите тему:', Markup.inlineKeyboard(topicButtons));
  });

  bot.action(/consult_topic_(\d+)/, async (ctx) => {
    const topicId = Number(ctx.match[1]);
    const faqs = await faqService.getFaqsByTopicId(topicId);
    if (!faqs.length) return ctx.reply('В этой теме пока нет FAQ.');
    await ctx.reply('Часто задаваемые вопросы:',
      Markup.inlineKeyboard([
        ...faqs.map((faq, i) => [Markup.button.callback(faq.question, `consult_faq_${faq.id}`)]),
        [Markup.button.callback('Задать свой вопрос', 'consult_ask_custom')]
      ])
    );
    ctx.answerCbQuery();
  });

  bot.action(/consult_faq_(\d+)/, async (ctx) => {
    const faqId = Number(ctx.match[1]);
    const faq = await require('../models').fAQ.findUnique({ where: { id: faqId } });
    if (!faq) return ctx.reply('Вопрос не найден.');
    await ctx.replyWithMarkdown(`*Вопрос:*
${faq.question}

*Ответ:*
${faq.answer}`);
    ctx.answerCbQuery();
  });

  bot.action('consult_ask_custom', async (ctx) => {
    ctx.answerCbQuery();
    await ctx.reply('Пожалуйста, напишите свой вопрос по коллективному договору или нормативным документам.');
    userStates[ctx.from.id] = 'waiting_for_consult_question';
  });

  bot.on('text', async (ctx, next) => {
    if (userStates[ctx.from.id] === 'waiting_for_consult_question') {
      const userQuestion = ctx.message.text;
      await ctx.reply('Ваш вопрос отправлен на обработку. Пожалуйста, подождите...');
      try {
        const answer = await askGPT(`Вопрос по коллективному договору: ${userQuestion}`);
        await ctx.replyWithMarkdown(`*Ответ:*
${answer}`);
      } catch (e) {
        await ctx.reply('Произошла ошибка при обращении к ИИ. Попробуйте позже.');
      }
      userStates[ctx.from.id] = undefined;
    } else {
      return next();
    }
  });

  // Глобальный сброс ожидания любого текстового ввода при нажатии callback-кнопки
  const waitingStates = ['waiting_for_question', 'waiting_for_consult_question'];
  bot.on('callback_query', async (ctx, next) => {
    if (waitingStates.includes(userStates[ctx.from.id])) {
      userStates[ctx.from.id] = undefined;
    }
    return next();
  });
};
