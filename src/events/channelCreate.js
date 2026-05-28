const { guardChannelCreate } = require('../utils/antinuke');

module.exports = {
  name: 'channelCreate',
  async execute(client, channel) {
    await guardChannelCreate(channel);
  }
};