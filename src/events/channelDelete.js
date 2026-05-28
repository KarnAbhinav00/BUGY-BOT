const { guardChannelDelete } = require('../utils/antinuke');

module.exports = {
  name: 'channelDelete',
  async execute(client, channel) {
    await guardChannelDelete(channel);
  }
};