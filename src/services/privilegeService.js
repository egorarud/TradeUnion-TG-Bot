const prisma = require('../models');

async function getAllPrivileges() {
  return prisma.privilege.findMany({
    orderBy: { createdAt: 'desc' }
  });
}

async function createPrivilege({ title, details, link }) {
  return prisma.privilege.create({
    data: { title, details, link }
  });
}

async function updatePrivilege(id, { title, details, link }) {
  return prisma.privilege.update({
    where: { id },
    data: { title, details, link }
  });
}

module.exports = { getAllPrivileges, createPrivilege, updatePrivilege }; 