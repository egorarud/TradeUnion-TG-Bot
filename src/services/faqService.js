const prisma = require('../models');

async function getAllTopics() {
  return prisma.fAQTopic.findMany({
    include: { faqs: true },
    orderBy: { title: 'asc' }
  });
}

async function getTopicByTitle(title) {
  return prisma.fAQTopic.findUnique({
    where: { title },
    include: { faqs: true }
  });
}

async function getFaqsByTopicId(topicId) {
  return prisma.fAQ.findMany({
    where: { topicId },
    orderBy: { id: 'asc' }
  });
}

async function addTopic(title) {
  return prisma.fAQTopic.create({ data: { title } });
}

async function addFaq(topicId, question, answer) {
  return prisma.fAQ.create({ data: { topicId, question, answer } });
}

module.exports = {
  getAllTopics,
  getTopicByTitle,
  getFaqsByTopicId,
  addTopic,
  addFaq
}; 