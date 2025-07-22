const { Markup } = require('telegraf');
const ADMIN_IDS = [1068642847]; // Замените на реальные Telegram ID админов
const { createEvent, getUpcomingEvents, getEventById, updateEvent } = require('../services/eventService');
const { getAllPrivileges, createPrivilege, updatePrivilege } = require('../services/privilegeService');
const {
  getAllFitnessCenters,
  createFitnessCenter,
  updateFitnessCenter,
  deleteFitnessCenter,
  getSlotsByCenter,
  createFitnessSlot,
  updateFitnessSlot,
  deleteFitnessSlot,
  getSlotById
} = require('../services/fitnessService');

const adminStates = {};

function isAdmin(ctx) {
  return ADMIN_IDS.includes(ctx.from.id);
}

module.exports = (bot) => {
  bot.command('admin', async (ctx) => {
    if (!isAdmin(ctx)) {
      return ctx.reply('Доступ запрещён.');
    }
    await ctx.reply('Админ-панель:',
      Markup.inlineKeyboard([
        [Markup.button.callback('Фитнес-центр', 'admin_fitness'), Markup.button.callback('Мероприятия', 'admin_events')],
        [Markup.button.callback('Преференции', 'admin_privileges'), Markup.button.callback('FAQ/Документы', 'admin_faq')],
        [Markup.button.callback('Записи .xlsx', 'admin_export'), Markup.button.callback('Вопросы пользователей', 'admin_questions')],
      ])
    );
  });

  // Пример обработчика для одной из кнопок
  bot.action('admin_fitness', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('Нет доступа');
    await ctx.editMessageText('Управление фитнес-центрами:',
      Markup.inlineKeyboard([
        [Markup.button.callback('➕ Добавить центр', 'admin_fitness_add_center')],
        [Markup.button.callback('✏️ Редактировать центр', 'admin_fitness_edit_center')],
        [Markup.button.callback('🗑️ Удалить центр', 'admin_fitness_delete_center')],
        [Markup.button.callback('⬅️ Назад', 'admin_back')],
      ])
    );
  });

  // Добавление фитнес-центра
  bot.action('admin_fitness_add_center', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('Нет доступа');
    adminStates[ctx.from.id] = { step: 'add_fitness_center_name', center: {} };
    await ctx.editMessageText('Введите название фитнес-центра:');
  });

  // Редактирование центра (выбор)
  bot.action('admin_fitness_edit_center', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('Нет доступа');
    const centers = await getAllFitnessCenters();
    if (!centers.length) return ctx.editMessageText('Нет центров для редактирования.');
    await ctx.editMessageText('Выберите центр:',
      Markup.inlineKeyboard(
        centers.map(c => [Markup.button.callback(c.name, `admin_fitness_edit_center_${c.id}`)])
      )
    );
  });

  // Выбор центра для редактирования
  bot.action(/admin_fitness_edit_center_(\d+)/, async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('Нет доступа');
    const centerId = Number(ctx.match[1]);
    const centers = await getAllFitnessCenters();
    const center = centers.find(c => c.id === centerId);
    if (!center) return ctx.editMessageText('Центр не найден.');
    adminStates[ctx.from.id] = { step: 'edit_fitness_center_name', centerId, center };
    await ctx.editMessageText(
      `Редактирование центра "${center.name}".\nВыберите действие или введите новое название (или "-" чтобы оставить прежнее):`,
      Markup.inlineKeyboard([
        [Markup.button.callback('Слоты центра', `admin_fitness_slots_${centerId}`)],
        [Markup.button.callback('⬅️ Назад', 'admin_fitness')]
      ])
    );
  });

  // Удаление центра (выбор)
  bot.action('admin_fitness_delete_center', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('Нет доступа');
    const centers = await getAllFitnessCenters();
    if (!centers.length) return ctx.editMessageText('Нет центров для удаления.');
    await ctx.editMessageText('Выберите центр для удаления:',
      Markup.inlineKeyboard(
        centers.map(c => [Markup.button.callback(c.name, `admin_fitness_delete_center_${c.id}`)])
      )
    );
  });

  // Подтверждение удаления центра
  bot.action(/admin_fitness_delete_center_(\d+)/, async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('Нет доступа');
    const centerId = Number(ctx.match[1]);
    await deleteFitnessCenter(centerId);
    await ctx.editMessageText('Центр удалён.');
  });

  // --- Управление слотами ---
  bot.action(/admin_fitness_slots_(\d+)/, async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('Нет доступа');
    const centerId = Number(ctx.match[1]);
    const slots = await getSlotsByCenter(centerId);
    await ctx.editMessageText('Слоты этого центра:',
      Markup.inlineKeyboard([
        ...slots.map(s => [Markup.button.callback(
          `${s.type} — ${new Date(s.date).toLocaleString('ru-RU')}`,
          `admin_fitness_edit_slot_${s.id}`
        )]),
        [Markup.button.callback('➕ Добавить слот', `admin_fitness_add_slot_${centerId}`)],
        [Markup.button.callback('⬅️ Назад', `admin_fitness_edit_center_${centerId}`)]
      ])
    );
  });

  // Добавление слота
  bot.action(/admin_fitness_add_slot_(\d+)/, async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('Нет доступа');
    const centerId = Number(ctx.match[1]);
    adminStates[ctx.from.id] = { step: 'add_fitness_slot_type', slot: { centerId } };
    await ctx.editMessageText('Введите тип тренировки:');
  });

  // Редактирование слота (выбор)
  bot.action(/admin_fitness_edit_slot_(\d+)/, async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('Нет доступа');
    const slotId = Number(ctx.match[1]);
    const slot = await getSlotById(slotId);
    if (!slot) return ctx.editMessageText('Слот не найден.');
    adminStates[ctx.from.id] = { step: 'edit_fitness_slot_type', slotId, slot };
    await ctx.editMessageText(`Редактирование слота.\nВведите новый тип тренировки (или "-" чтобы оставить прежний):`);
  });

  // Удаление слота (выбор)
  bot.action(/admin_fitness_delete_slot_(\d+)/, async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('Нет доступа');
    const slotId = Number(ctx.match[1]);
    await deleteFitnessSlot(slotId);
    await ctx.editMessageText('Слот удалён.');
  });

  // --- Обработка текстовых шагов для фитнес-центров и слотов ---
  bot.on('text', async (ctx, next) => {
    if (!isAdmin(ctx)) return next();
    const state = adminStates[ctx.from.id];
    if (!state) return next();
    // --- Центры ---
    if (state.step === 'add_fitness_center_name') {
      state.center.name = ctx.message.text;
      state.step = 'add_fitness_center_address';
      return ctx.reply('Введите адрес центра (или "-" если не требуется):');
    }
    if (state.step === 'add_fitness_center_address') {
      state.center.address = ctx.message.text === '-' ? null : ctx.message.text;
      await createFitnessCenter(state.center);
      adminStates[ctx.from.id] = undefined;
      return ctx.reply('Центр добавлен!');
    }
    if (state.step === 'edit_fitness_center_name') {
      if (ctx.message.text !== '-') state.center.name = ctx.message.text;
      state.step = 'edit_fitness_center_address';
      return ctx.reply('Введите новый адрес (или "-" чтобы оставить прежний):');
    }
    if (state.step === 'edit_fitness_center_address') {
      if (ctx.message.text !== '-') state.center.address = ctx.message.text;
      await updateFitnessCenter(state.centerId, state.center);
      adminStates[ctx.from.id] = undefined;
      return ctx.reply('Центр обновлён!');
    }
    // --- Слоты ---
    if (state.step === 'add_fitness_slot_type') {
      state.slot.type = ctx.message.text;
      state.step = 'add_fitness_slot_date';
      return ctx.reply('Введите дату и время (например: 2024-08-01 18:00):');
    }
    if (state.step === 'add_fitness_slot_date') {
      const date = new Date(ctx.message.text);
      if (isNaN(date)) return ctx.reply('Некорректная дата. Введите в формате: 2024-08-01 18:00');
      state.slot.date = date;
      state.step = 'add_fitness_slot_capacity';
      return ctx.reply('Введите вместимость (число):');
    }
    if (state.step === 'add_fitness_slot_capacity') {
      state.slot.capacity = Number(ctx.message.text);
      await createFitnessSlot(state.slot);
      adminStates[ctx.from.id] = undefined;
      return ctx.reply('Слот добавлен!');
    }
    if (state.step === 'edit_fitness_slot_type') {
      if (ctx.message.text !== '-') state.slot.type = ctx.message.text;
      state.step = 'edit_fitness_slot_date';
      return ctx.reply('Введите новую дату и время (или "-" чтобы оставить прежнюю):');
    }
    if (state.step === 'edit_fitness_slot_date') {
      if (ctx.message.text !== '-') {
        const date = new Date(ctx.message.text);
        if (isNaN(date)) return ctx.reply('Некорректная дата. Введите в формате: 2024-08-01 18:00');
        state.slot.date = date;
      }
      state.step = 'edit_fitness_slot_capacity';
      return ctx.reply('Введите новую вместимость (или "-" чтобы оставить прежнюю):');
    }
    if (state.step === 'edit_fitness_slot_capacity') {
      if (ctx.message.text !== '-') state.slot.capacity = Number(ctx.message.text);
      await updateFitnessSlot(state.slotId, state.slot);
      adminStates[ctx.from.id] = undefined;
      return ctx.reply('Слот обновлён!');
    }
    return next();
  });

  bot.action('admin_events', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('Нет доступа');
    await ctx.editMessageText('Управление мероприятиями:',
      Markup.inlineKeyboard([
        [Markup.button.callback('➕ Добавить', 'admin_event_add')],
        [Markup.button.callback('✏️ Редактировать', 'admin_event_edit')],
        [Markup.button.callback('⬅️ Назад', 'admin_back')],
      ])
    );
  });

  // Добавление мероприятия
  bot.action('admin_event_add', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('Нет доступа');
    adminStates[ctx.from.id] = { step: 'add_title', event: {} };
    await ctx.editMessageText('Введите название мероприятия:');
  });

  // Редактирование мероприятия (выбор)
  bot.action('admin_event_edit', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('Нет доступа');
    const events = await getUpcomingEvents();
    if (!events.length) return ctx.editMessageText('Нет мероприятий для редактирования.');
    await ctx.editMessageText('Выберите мероприятие для редактирования:',
      Markup.inlineKeyboard(
        events.map(e => [Markup.button.callback(e.title, `admin_event_edit_${e.id}`)])
      )
    );
  });

  // Выбор мероприятия для редактирования
  bot.action(/admin_event_edit_(\d+)/, async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('Нет доступа');
    const eventId = Number(ctx.match[1]);
    const event = await getEventById(eventId);
    if (!event) return ctx.editMessageText('Мероприятие не найдено.');
    adminStates[ctx.from.id] = { step: 'edit_title', eventId, event };
    await ctx.editMessageText(`Редактирование мероприятия "${event.title}".\nВведите новое название (или "-" чтобы оставить прежнее):`);
  });

  // Обработка текстовых шагов для добавления/редактирования
  bot.on('text', async (ctx, next) => {
    if (!isAdmin(ctx)) return next();
    const state = adminStates[ctx.from.id];
    if (!state) return next();
    // Добавление мероприятия
    if (state.step === 'add_title') {
      state.event.title = ctx.message.text;
      state.step = 'add_description';
      return ctx.reply('Введите описание мероприятия:');
    }
    if (state.step === 'add_description') {
      state.event.description = ctx.message.text;
      state.step = 'add_date';
      return ctx.reply('Введите дату и время (например: 2024-08-01 18:00):');
    }
    if (state.step === 'add_date') {
      const date = new Date(ctx.message.text);
      if (isNaN(date)) return ctx.reply('Некорректная дата. Введите в формате: 2024-08-01 18:00');
      state.event.date = date;
      state.step = 'add_capacity';
      return ctx.reply('Введите вместимость (число, можно пропустить через "-"):');
    }
    if (state.step === 'add_capacity') {
      const cap = ctx.message.text;
      state.event.capacity = cap === '-' ? null : Number(cap);
      await createEvent(state.event);
      adminStates[ctx.from.id] = undefined;
      return ctx.reply('Мероприятие добавлено!');
    }
    // Редактирование мероприятия
    if (state.step === 'edit_title') {
      if (ctx.message.text !== '-') state.event.title = ctx.message.text;
      state.step = 'edit_description';
      return ctx.reply('Введите новое описание (или "-" чтобы оставить прежнее):');
    }
    if (state.step === 'edit_description') {
      if (ctx.message.text !== '-') state.event.description = ctx.message.text;
      state.step = 'edit_date';
      return ctx.reply('Введите новую дату и время (или "-" чтобы оставить прежнее):');
    }
    if (state.step === 'edit_date') {
      if (ctx.message.text !== '-') {
        const date = new Date(ctx.message.text);
        if (isNaN(date)) return ctx.reply('Некорректная дата. Введите в формате: 2024-08-01 18:00');
        state.event.date = date;
      }
      state.step = 'edit_capacity';
      return ctx.reply('Введите новую вместимость (или "-" чтобы оставить прежнее):');
    }
    if (state.step === 'edit_capacity') {
      if (ctx.message.text !== '-') state.event.capacity = Number(ctx.message.text);
      await updateEvent(state.eventId, state.event);
      adminStates[ctx.from.id] = undefined;
      return ctx.reply('Мероприятие обновлено!');
    }
    return next();
  });

  bot.action('admin_privileges', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('Нет доступа');
    await ctx.editMessageText('Управление преференциями:',
      Markup.inlineKeyboard([
        [Markup.button.callback('➕ Добавить', 'admin_priv_add')],
        [Markup.button.callback('✏️ Редактировать', 'admin_priv_edit')],
        [Markup.button.callback('⬅️ Назад', 'admin_back')],
      ])
    );
  });

  // Добавление привилегии
  bot.action('admin_priv_add', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('Нет доступа');
    adminStates[ctx.from.id] = { step: 'add_priv_title', priv: {} };
    await ctx.editMessageText('Введите название привилегии:');
  });

  // Редактирование привилегии (выбор)
  bot.action('admin_priv_edit', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('Нет доступа');
    const privs = await getAllPrivileges();
    if (!privs.length) return ctx.editMessageText('Нет привилегий для редактирования.');
    await ctx.editMessageText('Выберите привилегию для редактирования:',
      Markup.inlineKeyboard(
        privs.map(p => [Markup.button.callback(p.title, `admin_priv_edit_${p.id}`)])
      )
    );
  });

  // Выбор привилегии для редактирования
  bot.action(/admin_priv_edit_(\d+)/, async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('Нет доступа');
    const privId = Number(ctx.match[1]);
    const privs = await getAllPrivileges();
    const priv = privs.find(p => p.id === privId);
    if (!priv) return ctx.editMessageText('Привилегия не найдена.');
    adminStates[ctx.from.id] = { step: 'edit_priv_title', privId, priv };
    await ctx.editMessageText(`Редактирование привилегии "${priv.title}".\nВведите новое название (или "-" чтобы оставить прежнее):`);
  });

  // Обработка текстовых шагов для добавления/редактирования привилегий
  bot.on('text', async (ctx, next) => {
    if (!isAdmin(ctx)) return next();
    const state = adminStates[ctx.from.id];
    if (!state) return next();
    // Добавление привилегии
    if (state.step === 'add_priv_title') {
      state.priv.title = ctx.message.text;
      state.step = 'add_priv_details';
      return ctx.reply('Введите детали (описание) привилегии:');
    }
    if (state.step === 'add_priv_details') {
      state.priv.details = ctx.message.text;
      state.step = 'add_priv_link';
      return ctx.reply('Введите ссылку (или "-" если не требуется):');
    }
    if (state.step === 'add_priv_link') {
      state.priv.link = ctx.message.text === '-' ? null : ctx.message.text;
      await createPrivilege(state.priv);
      adminStates[ctx.from.id] = undefined;
      return ctx.reply('Привилегия добавлена!');
    }
    // Редактирование привилегии
    if (state.step === 'edit_priv_title') {
      if (ctx.message.text !== '-') state.priv.title = ctx.message.text;
      state.step = 'edit_priv_details';
      return ctx.reply('Введите новые детали (или "-" чтобы оставить прежние):');
    }
    if (state.step === 'edit_priv_details') {
      if (ctx.message.text !== '-') state.priv.details = ctx.message.text;
      state.step = 'edit_priv_link';
      return ctx.reply('Введите новую ссылку (или "-" чтобы оставить прежнюю/очистить):');
    }
    if (state.step === 'edit_priv_link') {
      if (ctx.message.text !== '-') state.priv.link = ctx.message.text;
      await updatePrivilege(state.privId, state.priv);
      adminStates[ctx.from.id] = undefined;
      return ctx.reply('Привилегия обновлена!');
    }
    return next();
  });

  bot.action('admin_faq', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('Нет доступа');
    await ctx.editMessageText('Управление FAQ и нормативными документами');
    // Здесь будет подменю и логика управления FAQ/документами
  });

  bot.action('admin_export', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('Нет доступа');
    await ctx.editMessageText('Экспорт записей в .xlsx (фитнес, мероприятия)');
    // Здесь будет логика экспорта
  });

  bot.action('admin_questions', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('Нет доступа');
    await ctx.editMessageText('Входящие вопросы пользователей (ответить/архивировать)');
    // Здесь будет логика просмотра и ответа на вопросы
  });
}; 