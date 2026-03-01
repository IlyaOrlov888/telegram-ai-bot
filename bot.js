const TelegramBot = require('node-telegram-bot-api');
const { processMessage } = require('./ai');
const fetch = require('node-fetch');

const token = process.env.TELEGRAM_TOKEN;
if (!token) {
  throw new Error('TELEGRAM_TOKEN не установлен в .env');
}

const bot = new TelegramBot(token, { polling: true });

// In-memory storage
const userStates = new Map();
const userHistory = new Map();
const userDocs = new Map();

// Command handlers
bot.onText(/\/start/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    userStates.set(chatId, { state: 'idle' });
    
    await bot.sendMessage(chatId, 
      '🤖 Добро пожаловать в AI-бот!\n\n' +
      'Отправляйте сообщения, и я обработаю их через NVIDIA NIM.\n\n' +
      'Доступные команды:\n' +
      '/help - список всех команд\n' +
      '/clear - очистить историю диалога\n' +
      '/cleardoc - удалить загруженный документ\n' +
      '/status - показать текущий статус'
    );
  } catch (error) {
    console.error("Ошибка в /start:", error);
    await bot.sendMessage(msg.chat.id, "Произошла ошибка. Попробуйте позже.");
  }
});

bot.onText(/\/help/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    const helpMessage = "Доступные команды:\n" +
      "/start - приветственное сообщение\n" +
      "/help - список команд\n" +
      "/clear - очистить историю диалога\n" +
      "/cleardoc - удалить загруженный документ\n" +
      "/status - показать текущий статус";
    await bot.sendMessage(chatId, helpMessage);
  } catch (error) {
    console.error("Ошибка в /help:", error);
    await bot.sendMessage(msg.chat.id, "Произошла ошибка. Попробуйте позже.");
  }
});

bot.onText(/\/clear/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    userHistory.set(chatId, []);
    await bot.sendMessage(chatId, "История диалога очищена.");
  } catch (error) {
    console.error("Ошибка в /clear:", error);
    await bot.sendMessage(msg.chat.id, "Произошла ошибка. Попробуйте позже.");
  }
});

bot.onText(/\/cleardoc/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    userDocs.delete(chatId);
    await bot.sendMessage(chatId, "Загруженный документ удалён.");
  } catch (error) {
    console.error("Ошибка в /cleardoc:", error);
    await bot.sendMessage(msg.chat.id, "Произошла ошибка. Попробуйте позже.");
  }
});

bot.onText(/\/status/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    const docLoaded = userDocs.has(chatId);
    const historyCount = userHistory.get(chatId)?.length || 0;
    await bot.sendMessage(chatId, `Статус:\n- Документ загружен: ${docLoaded ? 'Да' : 'Нет'}\n- Длина истории: ${historyCount}`);
  } catch (error) {
    console.error("Ошибка в /status:", error);
    await bot.sendMessage(msg.chat.id, "Произошла ошибка. Попробуйте позже.");
  }
});

// Document handler
bot.on('document', async (msg) => {
  try {
    const chatId = msg.chat.id;
    const file = await bot.getFile(msg.document.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

    const isPDF = msg.document.mime_type === 'application/pdf';
    const isTXT = msg.document.mime_type === 'text/plain';

    if (isPDF || isTXT) {
      let content = '';
      if (isPDF) {
        const pdfBuffer = await fetch(fileUrl).then(res => res.buffer());
        const pdfText = await require('pdf-parse')(pdfBuffer);
        content = pdfText.text;
      } else if (isTXT) {
        content = await fetch(fileUrl).then(res => res.text());
      }

      userDocs.set(chatId, content);
      await bot.sendMessage(chatId, "Документ загружен и сохранён для контекста.");
    }
  } catch (error) {
    console.error("Ошибка обработки документа:", error);
    await bot.sendMessage(msg.chat.id, "Ошибка при загрузке документа.");
  }
});

// Message handler
bot.on('message', async (msg) => {
  try {
    if (!msg.text || msg.text.startsWith('/') || !msg.text.trim()) return;

    const chatId = msg.chat.id;

    // Initialize history if not exists
    if (!userHistory.has(chatId)) {
      userHistory.set(chatId, []);
    }
    const history = userHistory.get(chatId);

    // Add user message to history
    history.push({ role: 'user', content: msg.text });
    if (history.length > 10) {
      history.shift();
    }

    // Get document context if available
    const context = userDocs.get(chatId) || null;

    // Show typing indicator
    await bot.sendChatAction(chatId, 'typing');

    // Process message with history and context
    const response = await processMessage(history, context);

    // Add assistant response to history
    history.push({ role: 'assistant', content: response });
    if (history.length > 10) {
      history.shift();
    }

    await bot.sendMessage(chatId, response);
  } catch (error) {
    console.error("Ошибка обработки сообщения:", error);
    await bot.sendMessage(msg.chat.id, "Произошла ошибка. Попробуйте позже.");
  }
});

bot.on('error', (error) => {
  console.error('Telegram Bot Error:', error);
});

module.exports = {
  start: () => {
    console.log('Telegram bot запущен...');
    return bot;
  },
  bot,
};