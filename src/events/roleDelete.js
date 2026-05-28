const { guardRoleDelete } = require('../utils/antinuke');

module.exports = {
  name: 'roleDelete',
  async execute(client, role) {
    await guardRoleDelete(role);
  }
};