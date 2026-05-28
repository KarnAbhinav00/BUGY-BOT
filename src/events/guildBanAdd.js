const { guardBanAdd } = require('../utils/antinuke');

module.exports = {
  name: 'guildBanAdd',
  async execute(client, ban) {
    await guardBanAdd(ban);
  }
};