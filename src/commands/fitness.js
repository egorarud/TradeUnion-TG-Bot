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
  const centers = await getAllFitnessCenters();
  if (!centers.length) return ctx.reply('Нет доступных фитнес-центров.');
  await ctx.reply('Выберите фитнес-центр:',
    Markup.inlineKeyboard(
      centers.map(c => [Markup.button.callback(c.name, `fitness_center_${c.id}`)])
    )
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
    let text = `Центр: ${center.name}\nТип: ${slot.type}\nДата: ${date}`;
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
    const slots = await getSlotsByCenter(centerId);
    if (!slots.length) return ctx.editMessageText('Нет доступных слотов в этом центре.');
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
        [Markup.button.callback('Отмена', 'fitness_cancel')]
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
    const reg = await registerUserForFitness(slotId, user.id);
    if (reg === null) {
      return ctx.editMessageText('Вы уже записаны в этом месяце на тренировку.');
    } else if (reg === false) {
      return ctx.editMessageText('Слот уже заполнен.');
    } else {
      return ctx.editMessageText('Вы успешно записаны на тренировку!');
    }
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
};

module.exports.handleFitnessCommand = handleFitnessCommand;
module.exports.handleMyFitnessCommand = handleMyFitnessCommand; 