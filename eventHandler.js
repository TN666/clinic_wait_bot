const axios = require('axios');
const log4js = require('log4js');
const { extractFromUrl } = require('./helpers/extract_values_helper');
const { getUser, setUser, updateUser, deleteUser } = require('./helpers/db_helper');
const { bot } = require('./helpers/bot_helper');
const { messages } = require('./helpers/messages');

const WAIT_THRESHOLD = 3; // notify when the number is within 3

const logger = log4js.getLogger("log");


async function handleReset(userId, event) {
    await deleteUser(userId);
    await event.reply(messages.reset);
  }
  
async function handleNewUser(userId, event) {
  await setUser(userId, null, null);
  await event.reply(messages.welcome);
}

async function handleUrlInput(userId, event) {
  try {
    new URL(event.message.text);
    await updateUser(userId, { url: event.message.text });
    await event.reply(messages.requestNumber); 
  } catch (error) {
    await event.reply(messages.invalidUrl);
    await handleReset(userId, event);
    logger.error(`Invalid URL provided by user ${userId}: ${event.message.text}`);
  }
}

async function handleNumberInput(userId, event) {
  if (isNaN(parseInt(event.message.text))) {
    await event.reply(messages.invalidNumber);
    await handleReset(userId, event);
    logger.error(`Invalid number provided by user ${userId}: ${event.message.text}`);
    return;
  }
  await updateUser(userId, { number: event.message.text });
  await event.reply(messages.numberSaved);
}

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
          timeout: 10000
        }
      );

      if (!response.data || !response.data.Infos || !response.data.Infos[0] || !response.data.Infos[0].RTime) {
        logger.error(`Invalid response data for user ${userId}`);
        await bot.push(userId, messages.systemError);
        await deleteUser(userId);
        await bot.push(userId, messages.reset);
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
          await bot.push(userId, messages.invalidUrl);
        } else if (error.code === 'ECONNABORTED') {
          await bot.push(userId, messages.timeout);
        } else {
          await bot.push(userId, messages.systemError);
        }
      } else {
        logger.warn(`Retry ${3-retries} for user ${userId}:`, error);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
}


async function handleNonBusinessHours(userId) {
  try {
    await deleteUser(userId);
    await bot.push(userId, messages.nonBusinessHours);
    logger.info(`Notified user ${userId} about non-business hours`);
  } catch (error) {
    logger.error(`Error handling non-business hours for user ${userId}:`, error);
  }
}


async function handleMissedNumber(userId, userNo, currentNo) {
  try {
    await deleteUser(userId);
    await bot.push(userId, messages.missedNumber(userNo, currentNo));
    logger.info(`Notified user ${userId} about missed number`);
  } catch (error) {
    logger.error(`Error handling missed number for user ${userId}:`, error);
  }
}


async function handleApproachingNumber(userId, currentNo, userNo) {
  try {
    const user = await getUser(userId);
    if (!user.notified) {
      await bot.push(userId, messages.approaching(currentNo, userNo));
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
    await bot.push(userId, messages.currentNumber(userNo));
    logger.info(`Notified user ${userId} about current number`);
  } catch (error) {
    logger.error(`Error handling current number for user ${userId}:`, error);
  }
}


module.exports = {
  handleReset,
  handleNewUser,
  handleUrlInput,
  handleNumberInput,
  checkUserStatus,
  handleNonBusinessHours,
  handleMissedNumber,
  handleApproachingNumber,
  handleCurrentNumber
};
  