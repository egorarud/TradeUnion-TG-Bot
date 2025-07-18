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

module.exports = { addQuestion, getUnansweredQuestions, answerQuestion, getQuestionById };
