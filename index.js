const fs = require('fs');
const https = require('https');
const express = require('express');
const linebot = require('linebot');
const axios = require('axios');
const log4js = require('log4js');
const { config } = require('./config');
const { extractFromUrl } = require('./helpers/extract_values_helper');
const { init_db, getUser, setUser, updateUser, deleteUser, getAllUsers } = require('./helpers/db_helper');

const PORT = 3456;
const CHECK_INTERVAL = 30000; // 30 seconds
const WAIT_THRESHOLD = 3; // notify when the number is within 3

log4js.configure({
  appenders: { log: { type: "file", filename: "lineBot.log" } },
  categories: { default: { appenders: ["log"], level: "info" } },
});

const logger = log4js.getLogger("log");

init_db().catch(err => {
  logger.error('init_db error:', err);
  process.exit(1);
});

const bot = linebot({
  channelId: config.channelId,
  channelSecret: config.channelSecret,
  channelAccessToken: config.channelAccessToken,
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
    await event.reply('系統發生錯誤，請稍後再試');
  }
});

async function handleReset(userId, event) {
  await deleteUser(userId);
  await event.reply("已重置您的狀態！\n請輸入掛號診所雲端候診中心網址");
}

async function handleNewUser(userId, event) {
  await setUser(userId, null, null);
  await event.reply("歡迎使用診所候診小幫手！\n請輸入掛號診所雲端候診中心網址");
}

async function handleUrlInput(userId, event) {
  try {
    new URL(event.message.text);
    await updateUser(userId, { url: event.message.text });
    await event.reply("請輸入你的號碼");
  } catch (error) {
    await event.reply("請輸入正確的網址格式！\n輸入「重置」即可重新開始");
  }
}

async function handleNumberInput(userId, event) {
  await updateUser(userId, { number: event.message.text });
  await event.reply(`已成功記錄您的號碼 ✅\n\n我會持續監控診所目前看診進度\n當快輪到您時會立即通知您\n\n如果需要重新設定，\n請輸入「重置」即可重新開始`);
}

setInterval(async () => {
  try {
    const users = await getAllUsers();
    await Promise.all(users.map(user => checkUserStatus(user)));
  } catch (error) {
    logger.error('Interval check error:', error);
  }
}, CHECK_INTERVAL);

async function checkUserStatus(user) {
  const { user_id: userId, url, number } = user;
  if (!url || !number) {
    logger.info(`Skipping check for user ${userId}: missing url or number`);
    return;
  }

  let retries = 3;
  while (retries > 0) {
    try {
      logger.info(`Checking status for user ${userId} with URL: ${url}`);
      const { vcode, portalId } = await extractFromUrl(url, {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });

      const response = await axios.post(
        "https://wroom.vision.com.tw/WServ/VWWL_Clinics.svc/GetWaitInfo",
        `{"PortalID":"${portalId}","Vcode":"${vcode}",ReqFmt:"LIST"}`,
        { 
          headers: { "Content-Type": "text/plain" },
          timeout: 10000 // 10秒超時
        }
      );

      if (!response.data || !response.data.Infos || !response.data.Infos[0]) {
        logger.error(`Invalid response data for user ${userId}`);
        return;
      }

      if (response.data.Infos[0].RTime === "XXXX") {
        logger.info(`Non-business hours for user ${userId}`);
        await handleNonBusinessHours(userId);
        return;
      }

      const currentNo = parseInt(response.data.Infos[0].RTime);
      const userNo = parseInt(number);

      logger.info(`[Check] User ${userId} - Current No: ${currentNo} / Your No: ${userNo}`);

      if (currentNo > userNo) {
        logger.info(`User ${userId} missed their number`);
        await handleMissedNumber(userId, userNo, currentNo);
      } else if (userNo - currentNo < WAIT_THRESHOLD && currentNo !== userNo) {
        logger.info(`User ${userId} is approaching their number`);
        await handleApproachingNumber(userId, currentNo, userNo);
      } else if (currentNo === userNo) {
        logger.info(`User ${userId} is at their number`);
        await handleCurrentNumber(userId, userNo);
      }
      return;
    } catch (error) {
      retries--;
      if (retries === 0) {
        logger.error(`Error checking status for user ${userId} after 3 retries:`, error);
        if (error.message.includes('Invalid URL')) {
          await bot.push(userId, "網址格式錯誤，請重新輸入正確的網址\n或輸入「重置」重新開始");
        } else if (error.code === 'ECONNABORTED') {
          await bot.push(userId, "查詢超時，系統將繼續嘗試，請稍候");
        } else {
          await bot.push(userId, "系統暫時無法查詢，請稍後再試");
        }
      } else {
        logger.warn(`Retry ${3-retries} for user ${userId}:`, error);
        await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒後重試
      }
    }
  }
}

async function handleNonBusinessHours(userId) {
  try {
    await deleteUser(userId);
    await bot.push(userId, "目前非診所營業時間，請從頭開始重新輸入\n請輸入掛號診所雲端候診中心網址");
    logger.info(`Notified user ${userId} about non-business hours`);
  } catch (error) {
    logger.error(`Error handling non-business hours for user ${userId}:`, error);
  }
}

async function handleMissedNumber(userId, userNo, currentNo) {
  try {
    await deleteUser(userId);
    await bot.push(userId, `您的號碼 ${userNo} 已經過號了！目前叫號：${currentNo}\n系統已重置，請重新輸入掛號診所雲端候診中心網址`);
    logger.info(`Notified user ${userId} about missed number`);
  } catch (error) {
    logger.error(`Error handling missed number for user ${userId}:`, error);
  }
}

async function handleApproachingNumber(userId, currentNo, userNo) {
  try {
    const user = await getUser(userId);
    if (!user.notified) {
      await bot.push(userId, `快輪到你了！目前叫號：${currentNo}，你的號碼是：${userNo}`);
      await updateUser(userId, { notified: true });
    }
    logger.info(`Notified user ${userId} about approaching number`);
  } catch (error) {
    logger.error(`Error handling approaching number for user ${userId}:`, error);
  }
}

async function handleCurrentNumber(userId, userNo) {
  try {
    await deleteUser(userId);
    await bot.push(userId, `您的號碼 ${userNo} 已經到號了！\n系統已重置，請重新輸入掛號診所雲端候診中心網址`);
    logger.info(`Notified user ${userId} about current number`);
  } catch (error) {
    logger.error(`Error handling current number for user ${userId}:`, error);
  }
}

https.createServer({
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.crt')
}, app).listen(PORT, () => {
  console.log(`[HTTPS BOT is ready on port ${PORT}]`);
  logger.info(`[HTTPS BOT is ready on port ${PORT}]`);
});
