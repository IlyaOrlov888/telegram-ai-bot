const fetch = require('node-fetch');

const processMessage = async (history, context) => {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error('NVIDIA_API_KEY не установлен в .env');
  }

  // Формируем сообщения: системное (если есть документ) + история
  let messages = [];
  if (context) {
    messages.push({ role: 'system', content: context });
  }
  messages = messages.concat(history);

  try {
    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "meta/llama-3.1-70b-instruct",
        messages: messages,
        max_tokens: 1024
      })
    });

    if (!response.ok) {
      if (response.status === 429) {
        return "❌ Превышен лимит запросов к NVIDIA NIM. Попробуйте позже.";
      }
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error("Ошибка при вызове NVIDIA NIM API:", error);
    return "❌ Произошла ошибка при обработке запроса. Попробуйте позже.";
  }
};

module.exports = { processMessage };