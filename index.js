require('dotenv').config();
const { bot, start } = require('./bot');

start();

bot.on('error', (error) => {
  console.error('Telegram Bot Error:', error);
});