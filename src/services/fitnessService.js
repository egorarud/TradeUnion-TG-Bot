const prisma = require('../models');

async function getAllFitnessCenters() {
  return prisma.fitnessCenter.findMany({
    orderBy: { name: 'asc' }
  });
}

async function getSlotsByCenter(centerId) {
  return prisma.fitnessSlot.findMany({
    where: { centerId, date: { gte: new Date() } },
    orderBy: { date: 'asc' },
    include: { registrations: true }
  });
}

async function getSlotById(id) {
  return prisma.fitnessSlot.findUnique({ where: { id } });
}

async function getUserFitnessRegistrations(userId) {
  return prisma.fitnessRegistration.findMany({
    where: { userId },
    include: { slot: { include: { center: true } } },
    orderBy: { createdAt: 'desc' }
  });
}

async function userHasRegistrationThisMonth(userId) {
  const start = new Date();
  start.setDate(1);
  start.setHours(0,0,0,0);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  return prisma.fitnessRegistration.findFirst({
    where: {
      userId,
      slot: { date: { gte: start, lt: end } }
    }
  });
}

async function registerUserForFitness(slotId, userId) {
  // Проверка: уже есть запись на этот слот
  const existing = await prisma.fitnessRegistration.findFirst({
    where: { userId, slotId }
  });
  if (existing) return null;

  // Получаем id центра, в который уже записан пользователь в этом месяце
  const userCenterId = await getUserFitnessCenterThisMonth(userId);
  const slot = await prisma.fitnessSlot.findUnique({
    where: { id: slotId },
    include: { registrations: true }
  });
  if (!slot) return null;
  if (slot.registrations.length >= slot.capacity) return false;
  if (userCenterId && slot.centerId !== userCenterId) return 'wrong_center';

  return prisma.fitnessRegistration.create({
    data: { slotId, userId }
  });
}

async function cancelFitnessRegistration(regId, userId) {
  const reg = await prisma.fitnessRegistration.findUnique({ where: { id: regId } });
  if (!reg || reg.userId !== userId) return false;
  await prisma.fitnessRegistration.delete({ where: { id: regId } });
  return true;
}

async function createFitnessCenter({ name, address }) {
  return prisma.fitnessCenter.create({ data: { name, address } });
}

async function updateFitnessCenter(id, { name, address }) {
  return prisma.fitnessCenter.update({ where: { id }, data: { name, address } });
}

async function deleteFitnessCenter(id) {
  return prisma.fitnessCenter.delete({ where: { id } });
}

async function createFitnessSlot({ centerId, date, type, capacity }) {
  return prisma.fitnessSlot.create({ data: { centerId, date, type, capacity } });
}

async function updateFitnessSlot(id, { date, type, capacity }) {
  return prisma.fitnessSlot.update({ where: { id }, data: { date, type, capacity } });
}

async function deleteFitnessSlot(id) {
  return prisma.fitnessSlot.delete({ where: { id } });
}

async function getAllFitnessRegistrationsWithDetails() {
  return prisma.fitnessRegistration.findMany({
    include: {
      user: true,
      slot: {
        include: {
          center: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
}

async function getUserFitnessCenterThisMonth(userId) {
  const start = new Date();
  start.setDate(1);
  start.setHours(0,0,0,0);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  const reg = await prisma.fitnessRegistration.findFirst({
    where: {
      userId,
      slot: { date: { gte: start, lt: end } }
    },
    include: { slot: true },
    orderBy: { createdAt: 'asc' }
  });
  return reg ? reg.slot.centerId : null;
}

module.exports = {
  getAllFitnessCenters,
  getSlotsByCenter,
  getSlotById,
  getUserFitnessRegistrations,
  registerUserForFitness,
  cancelFitnessRegistration,
  createFitnessCenter,
  updateFitnessCenter,
  deleteFitnessCenter,
  createFitnessSlot,
  updateFitnessSlot,
  deleteFitnessSlot,
  getAllFitnessRegistrationsWithDetails,
  getUserFitnessCenterThisMonth,
}; 