const fs = require('fs');
const https = require('https');
const express = require('express');
const log4js = require('log4js');
const { bot } = require('./helpers/bot_helper');
const { init_db, getUser, getAllUsers } = require('./helpers/db_helper');
const { handleNewUser, handleUrlInput, handleNumberInput, handleReset, checkUserStatus } = require('./eventHandler');
const { messages } = require('./helpers/messages');

const PORT = 3456;
const CHECK_INTERVAL = 30000; // 30 seconds

log4js.configure({
  appenders: { log: { type: "file", filename: "lineBot.log" } },
  categories: { default: { appenders: ["log"], level: "info" } },
});

const logger = log4js.getLogger("log");

init_db().catch(err => {
  logger.error('init_db error:', err);
  process.exit(1);
});

const app = express();

app.post('/linewebhook', bot.parser());

bot.on('message', async (event) => {
  try {
    const userId = event.source.userId;
    const message = event.message.text.trim().toLowerCase();
    // logger.info(`Received message from ${userId}: ${message}`);

    if (message === '重置' || message === 'reset') {
      await handleReset(userId, event);
      return;
    }

    const user = await getUser(userId);

    if (!user) {
      await handleNewUser(userId, event);
    } else if (!user.url) {
      await handleUrlInput(userId, event);
    } else if (!user.number) {
      await handleNumberInput(userId, event);
    }
  } catch (error) {
    logger.error('Message handling error:', error);
    await event.reply(messages.systemError);
  }
});


setInterval(async () => {
  try {
    const users = await getAllUsers();
    await Promise.all(users.map(user => checkUserStatus(user)));
  } catch (error) {
    logger.error('Interval check error:', error);
  }
}, CHECK_INTERVAL);


https.createServer({
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.crt')
}, app).listen(PORT, () => {
  console.log(`[HTTPS BOT is ready on port ${PORT}]`);
  logger.info(`[HTTPS BOT is ready on port ${PORT}]`);
});
