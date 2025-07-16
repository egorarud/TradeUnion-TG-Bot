const prisma = require('../models');

async function getAllPrivileges() {
  return prisma.privilege.findMany({
    orderBy: { createdAt: 'desc' }
  });
}

module.exports = { getAllPrivileges }; 