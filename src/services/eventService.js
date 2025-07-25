const prisma = require('../models');

async function getUpcomingEvents() {
  return prisma.event.findMany({
    where: { date: { gte: new Date() } },
    orderBy: { date: 'asc' }
  });
}

async function getEventById(id) {
  return prisma.event.findUnique({ where: { id } });
}

async function registerUserForEvent(eventId, userId, comment) {
  const exists = await prisma.eventRegistration.findFirst({
    where: { eventId, userId }
  });
  if (exists) return null;
  return prisma.eventRegistration.create({
    data: { eventId, userId, comment }
  });
}

async function getUserUpcomingRegistrations(userId) {
  return prisma.eventRegistration.findMany({
    where: {
      userId,
      event: { date: { gte: new Date() } }
    },
    include: { event: true },
    orderBy: { event: { date: 'asc' } }
  });
}

async function cancelRegistration(regId, userId) {
  // Проверяем, что регистрация принадлежит пользователю
  const reg = await prisma.eventRegistration.findUnique({ where: { id: regId }, include: { user: true } });
  if (!reg || reg.userId !== userId) return false;
  await prisma.eventRegistration.delete({ where: { id: regId } });
  return true;
}

async function createEvent({ title, description, date, capacity }) {
  return prisma.event.create({
    data: { title, description, date, capacity }
  });
}

async function updateEvent(id, { title, description, date, capacity }) {
  return prisma.event.update({
    where: { id },
    data: { title, description, date, capacity }
  });
}

async function getEventRegistrationsWithUsers(eventId) {
  return prisma.eventRegistration.findMany({
    where: { eventId },
    include: { user: true }
  });
}

module.exports = { getUpcomingEvents, getEventById, registerUserForEvent, getUserUpcomingRegistrations, cancelRegistration, createEvent, updateEvent, getEventRegistrationsWithUsers }; 