const { config } = require('../config');
const linebot = require('linebot');


const bot = linebot({
    channelId: config.channelId,
    channelSecret: config.channelSecret,
    channelAccessToken: config.channelAccessToken,
  });


module.exports = {bot};