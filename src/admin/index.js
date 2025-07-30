const { Markup } = require('telegraf');
const ADMIN_IDS = [1068642847]; // Замените на реальные Telegram ID админов
const { createEvent, getUpcomingEvents, getEventById, updateEvent, getEventRegistrationsWithUsers } = require('../services/eventService');
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
  getSlotById,
  getAllFitnessRegistrationsWithDetails
} = require('../services/fitnessService');
const { getAllTopics, addTopic, addFaq } = require('../services/faqService');
const ExcelJS = require('exceljs');

const adminStates = {};

function isAdmin(ctx) {
  return ADMIN_IDS.includes(ctx.from.id);
}

// --- Вынесенная функция для обработки шагов админки ---
async function handleAdminStep(ctx, text) {
  const state = adminStates[ctx.from.id];
  if (!state) return false;
  // --- Центры ---
  if (state.center) {
    if (state.step === 'add_fitness_center_name') {
      state.center.name = text;
      state.step = 'add_fitness_center_address';
      await ctx.reply('Введите адрес центра (или "-" если не требуется):');
      return true;
    }
    if (state.step === 'add_fitness_center_address') {
      state.center.address = text === '-' ? null : text;
      await createFitnessCenter(state.center);
      adminStates[ctx.from.id] = undefined;
      await ctx.reply('Центр добавлен!');
      return true;
    }
    if (state.step === 'edit_fitness_center_name') {
      if (text !== '-') state.center.name = text;
      state.step = 'edit_fitness_center_address';
      await ctx.reply('Введите новый адрес:', Markup.inlineKeyboard([[Markup.button.callback('Пропустить', 'admin_skip')]]));
      return true;
    }
    if (state.step === 'edit_fitness_center_address') {
      if (text !== '-') state.center.address = text;
      await updateFitnessCenter(state.centerId, state.center);
      adminStates[ctx.from.id] = undefined;
      await ctx.reply('Центр обновлён!');
      return true;
    }
  }
  // --- Слоты ---
  if (state.slot) {
    if (state.step === 'add_fitness_slot_date') {
      const date = new Date(text);
      if (isNaN(date)) {
        await ctx.reply('Некорректная дата. Введите в формате: 2024-08-01 18:00');
        return true;
      }
      state.slot.date = date;
      state.step = 'add_fitness_slot_capacity';
      await ctx.reply('Введите вместимость (число):');
      return true;
    }
    if (state.step === 'add_fitness_slot_capacity') {
      state.slot.capacity = Number(text);
      state.slot.type = 'Индивидуальная';
      await createFitnessSlot(state.slot);
      adminStates[ctx.from.id] = undefined;
      await ctx.reply('Слот добавлен!');
      return true;
    }
    if (state.step === 'edit_fitness_slot_date') {
      if (text !== '-') {
        const date = new Date(text);
        if (isNaN(date)) {
          await ctx.reply('Некорректная дата. Введите в формате: 2024-08-01 18:00');
          return true;
        }
        state.slot.date = date;
      }
      state.step = 'edit_fitness_slot_capacity';
      await ctx.reply('Введите новую вместимость:', Markup.inlineKeyboard([[Markup.button.callback('Пропустить', 'admin_skip')]]));
      return true;
    }
    if (state.step === 'edit_fitness_slot_capacity') {
      if (text !== '-') state.slot.capacity = Number(text);
      state.slot.type = 'Индивидуальная';
      await updateFitnessSlot(state.slotId, state.slot);
      adminStates[ctx.from.id] = undefined;
      await ctx.reply('Слот обновлён!');
      return true;
    }
  }
  // --- Мероприятия ---
  if (state.event) {
    if (state.step === 'add_title') {
      state.event.title = text;
      state.step = 'add_description';
      await ctx.reply('Введите описание мероприятия:');
      return true;
    }
    if (state.step === 'add_description') {
      state.event.description = text;
      state.step = 'add_date';
      await ctx.reply('Введите дату и время (например: 2024-08-01 18:00):');
      return true;
    }
    if (state.step === 'add_date') {
      const date = new Date(text);
      if (isNaN(date)) {
        await ctx.reply('Некорректная дата. Введите в формате: 2024-08-01 18:00');
        return true;
      }
      state.event.date = date;
      state.step = 'add_capacity';
      await ctx.reply('Введите вместимость (число, можно пропустить через "-")');
      return true;
    }
    if (state.step === 'add_capacity') {
      const cap = text;
      state.event.capacity = cap === '-' ? null : Number(cap);
      await createEvent(state.event);
      adminStates[ctx.from.id] = undefined;
      await ctx.reply('Мероприятие добавлено!');
      return true;
    }
    if (state.step === 'edit_title') {
      if (text !== '-') state.event.title = text;
      state.step = 'edit_description';
      await ctx.reply('Введите новое описание:', Markup.inlineKeyboard([[Markup.button.callback('Пропустить', 'admin_skip')]]));
      return true;
    }
    if (state.step === 'edit_description') {
      if (text !== '-') state.event.description = text;
      state.step = 'edit_date';
      await ctx.reply('Введите новую дату и время:', Markup.inlineKeyboard([[Markup.button.callback('Пропустить', 'admin_skip')]]));
      return true;
    }
    if (state.step === 'edit_date') {
      if (text !== '-') {
        const date = new Date(text);
        if (isNaN(date)) {
          await ctx.reply('Некорректная дата. Введите в формате: 2024-08-01 18:00');
          return true;
        }
        state.event.date = date;
      }
      state.step = 'edit_capacity';
      await ctx.reply('Введите новую вместимость:', Markup.inlineKeyboard([[Markup.button.callback('Пропустить', 'admin_skip')]]));
      return true;
    }
    if (state.step === 'edit_capacity') {
      if (text !== '-') state.event.capacity = Number(text);
      await updateEvent(state.eventId, state.event);
      // Уведомление пользователей
      const regs = await getEventRegistrationsWithUsers(state.eventId);
      for (const reg of regs) {
        if (reg.user && reg.user.telegramId) {
          try {
            await ctx.telegram.sendMessage(
              reg.user.telegramId,
              `Внимание! Мероприятие "${state.event.title}" было обновлено администратором. Проверьте детали мероприятия.`
            );
          } catch (e) { /* ignore errors for users who blocked bot */ }
        }
      }
      adminStates[ctx.from.id] = undefined;
      await ctx.reply('Мероприятие обновлено!');
      return true;
    }
  }
  // --- Привилегии ---
  if (state.priv) {
    if (state.step === 'add_priv_title') {
      state.priv.title = text;
      state.step = 'add_priv_details';
      await ctx.reply('Введите детали (описание) привилегии:');
      return true;
    }
    if (state.step === 'add_priv_details') {
      state.priv.details = text;
      state.step = 'add_priv_link';
      await ctx.reply('Введите ссылку (или "-" если не требуется):');
      return true;
    }
    if (state.step === 'add_priv_link') {
      state.priv.link = text === '-' ? null : text;
      await createPrivilege(state.priv);
      adminStates[ctx.from.id] = undefined;
      await ctx.reply('Привилегия добавлена!');
      return true;
    }
    if (state.step === 'edit_priv_title') {
      if (text !== '-') state.priv.title = text;
      state.step = 'edit_priv_details';
      await ctx.reply('Введите новые детали:', Markup.inlineKeyboard([[Markup.button.callback('Пропустить', 'admin_skip')]]));
      return true;
    }
    if (state.step === 'edit_priv_details') {
      if (text !== '-') state.priv.details = text;
      state.step = 'edit_priv_link';
      await ctx.reply('Введите новую ссылку:', Markup.inlineKeyboard([[Markup.button.callback('Пропустить', 'admin_skip')]]));
      return true;
    }
    if (state.step === 'edit_priv_link') {
      if (text !== '-') state.priv.link = text;
      await updatePrivilege(state.privId, state.priv);
      adminStates[ctx.from.id] = undefined;
      await ctx.reply('Привилегия обновлена!');
      return true;
    }
  }
  // --- FAQ: добавление темы ---
  if (state.faqTopic) {
    if (state.step === 'add_faq_topic_title') {
      const title = text.trim();
      if (!title) {
        await ctx.reply('Название темы не может быть пустым. Введите ещё раз:');
        return true;
      }
      await addTopic(title);
      adminStates[ctx.from.id] = undefined;
      await ctx.reply('Тема добавлена!');
      return true;
    }
  }
  // --- FAQ: добавление вопроса ---
  if (state.faqAdd) {
    if (state.step === 'add_faq_select_topic') {
      // text = id темы
      const topicId = Number(text);
      if (isNaN(topicId)) {
        await ctx.reply('Некорректный выбор. Введите номер темы:');
        return true;
      }
      state.faqAdd.topicId = topicId;
      state.step = 'add_faq_question';
      await ctx.reply('Введите текст вопроса:');
      return true;
    }
    if (state.step === 'add_faq_question') {
      state.faqAdd.question = text;
      state.step = 'add_faq_answer';
      await ctx.reply('Введите ответ на вопрос:');
      return true;
    }
    if (state.step === 'add_faq_answer') {
      state.faqAdd.answer = text;
      await addFaq(state.faqAdd.topicId, state.faqAdd.question, state.faqAdd.answer);
      adminStates[ctx.from.id] = undefined;
      await ctx.reply('FAQ добавлен!');
      return true;
    }
  }
  return false;
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
      `Редактирование центра "${center.name}".\nВыберите действие или введите новое название:`,
      Markup.inlineKeyboard([
        [Markup.button.callback('Пропустить', 'admin_skip')],
        [Markup.button.callback('Слоты центра', `admin_fitness_slots_${centerId}`)]
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
        [Markup.button.callback('➕ Добавить слот', `admin_fitness_add_slot_${centerId}`)]
      ])
    );
  });

  // Добавление слота
  bot.action(/admin_fitness_add_slot_(\d+)/, async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('Нет доступа');
    const centerId = Number(ctx.match[1]);
    adminStates[ctx.from.id] = { step: 'add_fitness_slot_date', slot: { centerId, type: 'Индивидуальная' } };
    await ctx.editMessageText('Введите дату и время (например: 2024-08-01 18:00):');
  });

  // Редактирование слота (выбор)
  bot.action(/admin_fitness_edit_slot_(\d+)/, async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('Нет доступа');
    const slotId = Number(ctx.match[1]);
    const slot = await getSlotById(slotId);
    if (!slot) return ctx.editMessageText('Слот не найден.');
    adminStates[ctx.from.id] = { step: 'edit_fitness_slot_date', slotId, slot: { ...slot, type: 'Индивидуальная' } };
    await ctx.editMessageText('Редактирование слота.\nВведите новую дату и время:', Markup.inlineKeyboard([[Markup.button.callback('Пропустить', 'admin_skip')]]));
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
    const handled = await handleAdminStep(ctx, ctx.message.text);
    if (!handled) return next();
  });

  bot.action('admin_events', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('Нет доступа');
    await ctx.editMessageText('Управление мероприятиями:',
      Markup.inlineKeyboard([
        [Markup.button.callback('➕ Добавить', 'admin_event_add')],
        [Markup.button.callback('✏️ Редактировать', 'admin_event_edit')],
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
    await ctx.editMessageText(`Редактирование мероприятия "${event.title}".\nВведите новое название:`, Markup.inlineKeyboard([[Markup.button.callback('Пропустить', 'admin_skip')]]));
  });

  bot.action('admin_privileges', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('Нет доступа');
    await ctx.editMessageText('Управление преференциями:',
      Markup.inlineKeyboard([
        [Markup.button.callback('➕ Добавить', 'admin_priv_add')],
        [Markup.button.callback('✏️ Редактировать', 'admin_priv_edit')],
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
    await ctx.editMessageText(`Редактирование привилегии "${priv.title}".\nВведите новое название:`, Markup.inlineKeyboard([[Markup.button.callback('Пропустить', 'admin_skip')]]));
  });

  bot.action('admin_faq', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('Нет доступа');
    await ctx.editMessageText('Управление FAQ и нормативными документами',
      Markup.inlineKeyboard([
        [Markup.button.callback('➕ Добавить тему', 'admin_faq_add_topic')],
        [Markup.button.callback('➕ Добавить FAQ', 'admin_faq_add_faq')],
        // В будущем: [Markup.button.callback('✏️ Редактировать', 'admin_faq_edit')],
        [Markup.button.callback('⬅️ Назад', 'admin_back')]
      ])
    );
  });

  // Добавление темы FAQ
  bot.action('admin_faq_add_topic', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('Нет доступа');
    adminStates[ctx.from.id] = { step: 'add_faq_topic_title', faqTopic: {} };
    await ctx.editMessageText('Введите название новой темы FAQ:');
  });

  // Добавление FAQ (вопроса)
  bot.action('admin_faq_add_faq', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('Нет доступа');
    const topics = await getAllTopics();
    if (!topics.length) {
      return ctx.editMessageText('Сначала добавьте хотя бы одну тему FAQ!');
    }
    let msg = 'Выберите тему для FAQ (введите номер):\n';
    topics.forEach((t, i) => {
      msg += `${i + 1}. ${t.title}\n`;
    });
    adminStates[ctx.from.id] = { step: 'add_faq_select_topic', faqAdd: {} };
    // Сохраняем соответствие номера и id темы
    adminStates[ctx.from.id].faqAdd.topicMap = topics.map(t => t.id);
    await ctx.editMessageText(msg);
  });

  // Обработка выбора темы для FAQ по номеру
  bot.on('text', async (ctx, next) => {
    const state = adminStates[ctx.from.id];
    if (state && state.step === 'add_faq_select_topic' && state.faqAdd) {
      // Ожидаем номер темы
      const num = Number(ctx.message.text);
      const topicId = state.faqAdd.topicMap && state.faqAdd.topicMap[num - 1];
      if (!topicId) {
        await ctx.reply('Некорректный номер. Введите номер из списка:');
        return;
      }
      state.faqAdd.topicId = topicId;
      state.step = 'add_faq_question';
      await ctx.reply('Введите текст вопроса:');
      return;
    }
    // handleAdminStep для остальных шагов
    if (await handleAdminStep(ctx, ctx.message.text)) return;
    return next();
  });

  bot.action('admin_export', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('Нет доступа');
    await ctx.editMessageText('Экспорт записей в .xlsx (фитнес, мероприятия)');
    // Экспорт фитнес-записей
    const regs = await getAllFitnessRegistrationsWithDetails();
    if (!regs.length) return ctx.reply('Нет записей для экспорта.');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Фитнес записи');
    sheet.columns = [
      { header: 'ФИО', key: 'fullName', width: 25 },
      { header: 'Телефон', key: 'phone', width: 15 },
      { header: 'Дата/время', key: 'date', width: 20 },
      { header: 'Тип тренировки', key: 'type', width: 20 },
      { header: 'Дата регистрации', key: 'createdAt', width: 20 },
      { header: 'Фитнес центр', key: 'center', width: 25 },
    ];
    for (const reg of regs) {
      sheet.addRow({
        fullName: reg.user?.fullName || '',
        phone: reg.user?.phone || '',
        date: reg.slot ? new Date(reg.slot.date).toLocaleString('ru-RU') : '',
        type: reg.slot?.type || '',
        createdAt: new Date(reg.createdAt).toLocaleString('ru-RU'),
        center: reg.slot?.center?.name || '',
      });
    }
    const buffer = await workbook.xlsx.writeBuffer();
    await ctx.replyWithDocument({ source: Buffer.from(buffer), filename: 'fitness_registrations.xlsx' });
  });

  bot.action('admin_questions', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('Нет доступа');
    await ctx.editMessageText('Входящие вопросы пользователей (ответить/архивировать)');
    // Здесь будет логика просмотра и ответа на вопросы
  });

  bot.action('admin_skip', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('Нет доступа');
    const state = adminStates[ctx.from.id];
    if (!state) return ctx.answerCbQuery('Нет активного действия для пропуска');
    await handleAdminStep(ctx, '-');
    await ctx.answerCbQuery('Пропущено');
  });
};