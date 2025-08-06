const prisma = require('../models');
const { getUserUpcomingRegistrations } = require('./eventService');
const { getUserFitnessRegistrations } = require('./fitnessService');

async function sendReminders(bot) {
  const users = await prisma.user.findMany({
    where: { reminderEnabled: true, reminderType: { not: null }, reminderTime: { not: null } }
  });
  const now = new Date();
  for (const user of users) {
    if (user.reminderType === 'event') {
      const regs = await getUserUpcomingRegistrations(user.id);
      for (const reg of regs) {
        const eventDate = new Date(reg.event.date);
        const diffMin = Math.floor((eventDate - now) / 60000);
        if (diffMin <= user.reminderTime) {
          try {
            await bot.telegram.sendMessage(String(user.telegramId), `Напоминание: мероприятие "${reg.event.title}" начнётся ${eventDate.toLocaleString('ru-RU')}`);
          } catch (e) {
            // Ошибки отправки можно логировать при необходимости
          }
        }
      }
    }
    if (user.reminderType === 'fitness') {
      const regs = await getUserFitnessRegistrations(user.id);
      for (const reg of regs) {
        if (!reg.slot) continue;
        const slotDate = new Date(reg.slot.date);
        const diffMin = Math.floor((slotDate - now) / 60000);
        if (diffMin <= user.reminderTime) {
          try {
            await bot.telegram.sendMessage(String(user.telegramId), `Напоминание: тренировка "${reg.slot.type}" (${reg.slot.center?.name || ''}) начнётся ${slotDate.toLocaleString('ru-RU')}`);
          } catch (e) {
            // Ошибки отправки можно логировать при необходимости
          }
        }
      }
    }
  }
}

function startReminderScheduler(bot) {
  setInterval(() => {
    sendReminders(bot);
  }, 60 * 1000);
}

module.exports = { startReminderScheduler, sendReminders };