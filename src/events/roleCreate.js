const { guardRoleCreate } = require('../utils/antinuke');

module.exports = {
  name: 'roleCreate',
  async execute(client, role) {
    await guardRoleCreate(role);
  }
};