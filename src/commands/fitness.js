const { Markup } = require('telegraf');
const prisma = require('../models');
const {
  getAllFitnessCenters,
  getSlotsByCenter,
  getSlotById,
  getUserFitnessRegistrations,
  registerUserForFitness,
  cancelFitnessRegistration
} = require('../services/fitnessService');

const userFitnessStates = {};

async function handleFitnessCommand(ctx) {
  await ctx.reply('Выберите действие:',
    Markup.inlineKeyboard([
      [Markup.button.callback('Мои записи', 'fitness_my_records')],
      [Markup.button.callback('Записаться на тренировку', 'fitness_start_registration')]
    ])
  );
}

async function handleMyFitnessCommand(ctx) {
  let user = await prisma.user.findUnique({ where: { telegramId: String(ctx.from.id) } });
  if (!user) return ctx.reply('У вас нет записей на фитнес.');
  const regs = await getUserFitnessRegistrations(user.id);
  if (!regs.length) return ctx.reply('У вас нет записей на фитнес.');
  await ctx.reply('Ваши записи на фитнес:');
  for (const reg of regs) {
    const slot = reg.slot;
    const center = slot.center;
    const date = new Date(slot.date).toLocaleString('ru-RU');
    let text = `*Центр:* ${center.name}\n*Тип:* ${slot.type}\n*Дата:* ${date}`;
    await ctx.replyWithMarkdown(text,
      Markup.inlineKeyboard([
        [Markup.button.callback('Отменить запись', `fitness_reg_cancel_${reg.id}`)]
      ])
    );
  }
}

module.exports = (bot) => {
  // Команда /fitness
  bot.command('fitness', handleFitnessCommand);

  // Команда /my_fitness
  bot.command('my_fitness', handleMyFitnessCommand);

  // Выбор центра
  bot.action(/fitness_center_(\d+)/, async (ctx) => {
    const centerId = Number(ctx.match[1]);
    let slots = await getSlotsByCenter(centerId);

    // Получаем пользователя
    let user = await prisma.user.findUnique({ where: { telegramId: String(ctx.from.id) } });
    let userRegistrations = [];
    if (user) {
      userRegistrations = await getUserFitnessRegistrations(user.id);
    }
    const registeredSlotIds = new Set(userRegistrations.map(reg => reg.slot.id));

    // Показываем только индивидуальные тренировки, если есть места и пользователь не записан
    slots = slots.filter(
      s => s.type === 'Индивидуальная' &&
           s.registrations.length < s.capacity &&
           !registeredSlotIds.has(s.id)
    );

    if (!slots.length) return ctx.editMessageText('Нет доступных индивидуальных слотов в этом центре.');
    await ctx.editMessageText('Выберите дату и тип тренировки:',
      Markup.inlineKeyboard(
        slots.map(s => [Markup.button.callback(
          `${s.type} — ${new Date(s.date).toLocaleString('ru-RU')}`,
          `fitness_slot_${s.id}`
        )])
      )
    );
  });

  // Выбор слота
  bot.action(/fitness_slot_(\d+)/, async (ctx) => {
    const slotId = Number(ctx.match[1]);
    const slot = await getSlotById(slotId);
    if (!slot) return ctx.editMessageText('Слот не найден.');
    userFitnessStates[ctx.from.id] = { slotId };
    await ctx.editMessageText(
      `Подтвердите запись на тренировку "${slot.type}" в ${new Date(slot.date).toLocaleString('ru-RU')}?`,
      Markup.inlineKeyboard([
        [Markup.button.callback('Записаться', `fitness_confirm_${slotId}`)],
      ])
    );
  });

  // Подтверждение записи
  bot.action(/fitness_confirm_(\d+)/, async (ctx) => {
    const slotId = Number(ctx.match[1]);
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
    // Если не хватает ФИО или телефона, запрашиваем их
    if (!user.fullName || user.fullName.trim() === '' || !user.phone || user.phone.trim() === '') {
      userFitnessStates[ctx.from.id] = {
        slotId,
        step: !user.fullName || user.fullName.trim() === '' ? 'ask_fullName' : 'ask_phone',
        tempUser: user
      };
      if (!user.fullName || user.fullName.trim() === '') {
        return ctx.reply('Пожалуйста, введите ваше ФИО:');
      } else {
        return ctx.reply('Пожалуйста, введите ваш номер телефона:');
      }
    }
    const reg = await registerUserForFitness(slotId, user.id);
    if (reg === 'wrong_center') {
      return ctx.editMessageText('В этом месяце вы можете записываться только в тот фитнес-центр, в который уже записались первым.');
    } else if (reg === null) {
      return ctx.editMessageText('Вы уже записаны в этом месяце на тренировку.');
    } else if (reg === false) {
      return ctx.editMessageText('Слот уже заполнен.');
    } else {
      return ctx.editMessageText('Вы успешно записаны на тренировку!');
    }
  });

  // Обработка ввода ФИО и телефона при регистрации
  bot.on('text', async (ctx, next) => {
    const state = userFitnessStates[ctx.from.id];
    if (!state || (!state.step)) return next();
    let user = state.tempUser || await prisma.user.findUnique({ where: { telegramId: String(ctx.from.id) } });
    if (state.step === 'ask_fullName') {
      const fullName = ctx.message.text.trim();
      if (!fullName) return ctx.reply('Пожалуйста, введите корректное ФИО:');
      await prisma.user.update({ where: { id: user.id }, data: { fullName } });
      state.step = 'ask_phone';
      state.tempUser.fullName = fullName;
      return ctx.reply('Пожалуйста, введите ваш номер телефона:');
    }
    if (state.step === 'ask_phone') {
      let phone = ctx.message.text.trim();
      // Очистка номера: убираем пробелы, дефисы, скобки
      phone = phone.replace(/[\s\-()]/g, '');
      // Проверка: должен начинаться с +7, 7, 8 или + (международный)
      let valid = false;
      if (/^(\+7|7|8)\d{10}$/.test(phone)) {
        valid = true;
      } else if (/^\+\d{10,15}$/.test(phone)) {
        valid = true;
      }
      if (!valid) {
        return ctx.reply('Пожалуйста, введите корректный номер телефона. Пример: +79991234567 или 89991234567.');
      }
      await prisma.user.update({ where: { id: user.id }, data: { phone } });
      // После получения всех данных — регистрируем на слот
      const reg = await registerUserForFitness(state.slotId, user.id);
      userFitnessStates[ctx.from.id] = undefined;
      if (reg === null) {
        return ctx.reply('Вы уже записаны в этом месяце на тренировку.');
      } else if (reg === false) {
        return ctx.reply('Слот уже заполнен.');
      } else {
        return ctx.reply('Вы успешно записаны на тренировку!');
      }
    }
    return next();
  });

  // Отмена выбора
  bot.action('fitness_cancel', async (ctx) => {
    userFitnessStates[ctx.from.id] = undefined;
    await ctx.editMessageText('Запись отменена.');
  });

  // Отмена записи
  bot.action(/fitness_reg_cancel_(\d+)/, async (ctx) => {
    let user = await prisma.user.findUnique({ where: { telegramId: String(ctx.from.id) } });
    if (!user) return ctx.reply('Ошибка пользователя.');
    const regId = Number(ctx.match[1]);
    const ok = await cancelFitnessRegistration(regId, user.id);
    if (ok) {
      ctx.reply('Ваша запись отменена.');
    } else {
      ctx.reply('Не удалось отменить запись (возможно, она уже отменена или не принадлежит вам).');
    }
  });

  // Главное меню фитнеса
  bot.action('fitness_my_records', async (ctx) => {
    await handleMyFitnessCommand(ctx);
  });

  bot.action('fitness_start_registration', async (ctx) => {
    const centers = await getAllFitnessCenters();
    if (!centers.length) return ctx.editMessageText('Нет доступных фитнес-центров.');
    await ctx.editMessageText('Выберите фитнес-центр:',
      Markup.inlineKeyboard(
        centers.map(c => [Markup.button.callback(c.name, `fitness_center_${c.id}`)])
      )
    );
  });
};

module.exports.handleFitnessCommand = handleFitnessCommand;
module.exports.handleMyFitnessCommand = handleMyFitnessCommand; 