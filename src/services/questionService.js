const prisma = require('../models');

async function addQuestion({ userTgId, userName, text }) {
  return prisma.question.create({
    data: { userTgId, userName, text }
  });
}

async function getUnansweredQuestions() {
  return prisma.question.findMany({
    where: { answer: null },
    orderBy: { createdAt: 'asc' }
  });
}

async function answerQuestion(id, answer) {
  return prisma.question.update({
    where: { id },
    data: { answer, answeredAt: new Date() }
  });
}

async function getQuestionById(id) {
  return prisma.question.findUnique({ where: { id } });
}

async function getUserQuestionsCountToday(userTgId) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return prisma.question.count({
    where: {
      userTgId,
      createdAt: { gte: start, lt: end }
    }
  });
}

module.exports = { addQuestion, getUnansweredQuestions, answerQuestion, getQuestionById, getUserQuestionsCountToday };
