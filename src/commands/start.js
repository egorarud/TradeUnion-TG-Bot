const { Markup } = require('telegraf');
const { getAllPrivileges } = require('../services/privilegeService');
const { addQuestion, answerQuestion, getQuestionById } = require('../services/questionService');

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
        [Markup.button.callback('Узнать о привилегиях', 'show_privileges')],
        [Markup.button.callback('Задать вопрос', 'ask_question')]
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
};
