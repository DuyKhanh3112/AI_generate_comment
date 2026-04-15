chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GENERATE_COMMENT') {
    handleGeneration(request.payload)
      .then((comment) => sendResponse({ success: true, comment }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

async function handleGeneration({ postContent, vibe }) {
  const settings = await chrome.storage.local.get(['geminiApiKey', 'defaultVibe', 'provider']);
  const apiKey = settings.geminiApiKey;
  const selectedVibe = vibe || settings.defaultVibe || 'friendly';
  const provider = settings.provider || 'gemini';

  if (!apiKey) {
    throw new Error('API Key is missing. Please set it in the extension popup.');
  }

  if (!postContent || !postContent.trim()) {
    throw new Error('SocialAI could not detect the post content for analysis.');
  }

  const cleanPostContent = postContent
    .replace(/["']/g, '')
    .replace(/(\r\n|\n|\r)/gm, ' ')
    .trim();

  const prompt = `
    Bạn là một người dùng Facebook bình thường, lịch sự. Hãy đọc bài viết này: "${cleanPostContent}"

    Nhiệm vụ: Viết 1 câu bình luận NGẮN GỌN (dưới 12 từ) thể hiện sự quan tâm hoặc đồng tình.
    
    Quy tắc bắt buộc:
    1. TỰ NHIÊN: Viết như một người bạn bình luận, không dùng ngôn từ quá trang trọng hay máy móc.
    2. KHÔNG CÂU HỎI: Chỉ đưa ra nhận xét hoặc lời khen nhẹ nhàng. Tuyệt đối không có dấu hỏi.
    3. TRỰC TIẾP: Đi thẳng vào nội dung chính của bài viết. Tránh các từ cảm thán thừa thãi như "Ôi", "Wao", "Tuyệt vời quá".
    4. NGÔN NGỮ ĐỜI THƯỜNG: Dùng từ ngữ giản dị, gần gũi (ví dụ: "chuẩn luôn", "xịn quá", "đúng thật", "hay nè").
    5. CẤU TRÚC: Chỉ trả về 1 dòng nội dung duy nhất. Phong cách: ${selectedVibe}.
  `;

  console.log('SocialAI [Final Prompt Sent to AI]:', prompt);

  if (provider === 'groq') {
    console.log('SocialAI: Routing to Groq...');
    return handleGroqGeneration(apiKey, prompt);
  }

  console.log('SocialAI: Routing to Gemini...');
  return handleGeminiGeneration(apiKey, prompt);
}

async function handleGroqGeneration(apiKey, promptContent) {
  let modelName = 'llama-3.1-70b-versatile';

  try {
    const listResponse = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    const listData = await listResponse.json();
    if (listData.data) {
      const chatModels = listData.data
        .filter((model) => model.id.toLowerCase().includes('llama'))
        .filter((model) => !model.id.toLowerCase().includes('guard'))
        .filter((model) => !model.id.toLowerCase().includes('classify'));

      chatModels.sort((left, right) => right.id.localeCompare(left.id));
      if (chatModels.length > 0) {
        modelName = chatModels[0].id;
      }
    }
  } catch (error) {
    console.warn('SocialAI: Failed to list Groq models.', error);
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        { role: 'system', content: 'Bạn là người dùng Facebook Việt Nam. Chỉ trả về bình luận ngắn.' },
        { role: 'user', content: promptContent }
      ],
      temperature: 0.7,
      max_tokens: 150
    })
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(`Groq Error: ${data.error.message}`);
  }

  const result = data?.choices?.[0]?.message?.content?.trim();
  if (!result) {
    throw new Error('Groq returned an empty response.');
  }

  return result;
}

async function handleGeminiGeneration(apiKey, prompt) {
  let availableModels = [];
  try {
    const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const listData = await listResponse.json();
    if (listData.models) {
      availableModels = listData.models
        .filter((model) => model.supportedGenerationMethods.includes('generateContent'))
        .map((model) => model.name.split('/').pop());

      availableModels.sort((left, right) => {
        if (left.includes('flash') && !right.includes('flash')) return -1;
        if (left.includes('2.5') && !right.includes('2.5')) return -1;
        return 0;
      });
    }
  } catch (error) {
    console.warn('SocialAI: Failed to list Gemini models.', error);
  }

  if (availableModels.length === 0) {
    availableModels = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
  }

  let lastError = null;
  for (const model of availableModels) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      const data = await response.json();
      if (data.error) {
        lastError = data.error.message;
        if (lastError.toLowerCase().includes('quota') || lastError.toLowerCase().includes('not found')) {
          continue;
        }
        throw new Error(lastError);
      }

      const result = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (result) {
        return result;
      }
    } catch (error) {
      lastError = error.message;
    }
  }

  throw new Error(`Gemini failed: ${lastError}`);
}
