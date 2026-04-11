chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GENERATE_COMMENT') {
    handleGeneration(request.payload)
      .then(comment => sendResponse({ success: true, comment }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
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

  // Sanitize postContent to avoid breaking the prompt structure
  const cleanPostContent = postContent.replace(/["']/g, '').replace(/(\r\n|\n|\r)/gm, " ").trim();

  if (!postContent) {
    return { success: false, error: "SocialAI không tìm thấy nội dung bài đăng để phân tích." };
  }

  const prompt = `
    Bạn là một người dùng Facebook Việt Nam sành điệu.
    Hãy viết 1 bình luận thực tế, ngắn gọn cho bài đăng sau: "${cleanPostContent}"
    
    YÊU CẦU QUAN TRỌNG:
    1. Nhắc đến ít nhất 1 chi tiết/từ khóa/tên cụ thể xuất hiện trong bài đăng trên.
    2. Tuyệt đối không khen chung chung. Tuyệt đối không nói về "nước hoa" nếu bài đăng không nhắc tới.
    3. Trình bày dưới dạng 1 câu nói tự nhiên, súc tích.
    4. Phong cách: ${selectedVibe}.
    5. Chỉ trả về nội dung bình luận.
  `;

  console.log('📝 SocialAI [Final Prompt Sent to AI]:', prompt);

  if (provider === 'groq') {
    console.log('🤖 SocialAI: Routing to Groq...');
    return handleGroqGeneration(apiKey, prompt);
  } else {
    console.log('🤖 SocialAI: Routing to Gemini...');
    return handleGeminiGeneration(apiKey, prompt);
  }
}

async function handleGroqGeneration(apiKey, promptContent) {
  let modelName = 'llama-3.1-70b-versatile'; 
  
  try {
    const listRes = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    const listData = await listRes.json();
    if (listData.data) {
      // Find models that are NOT guarding or classification
      const chatModels = listData.data
        .filter(m => m.id.toLowerCase().includes('llama'))
        .filter(m => !m.id.toLowerCase().includes('guard'))
        .filter(m => !m.id.toLowerCase().includes('classify'));
      
      // Prioritize large models first
      chatModels.sort((a, b) => b.id.localeCompare(a.id));
      
      if (chatModels.length > 0) {
        modelName = chatModels[0].id;
      }
    }
  } catch (err) {}

  console.log(`🚀 SocialAI [Using Model]: ${modelName}`);
  
  const apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ 
      model: modelName, 
      messages: [
        { role: 'system', content: 'Bạn là người dùng Facebook Việt Nam. Chỉ trả về bình luận, không trả về số hay mã code.' },
        { role: 'user', content: promptContent }
      ], 
      temperature: 0.7,
      max_tokens: 150 
    })
  });
  
  const data = await response.json();
  console.log('📡 SocialAI [Raw Data from Groq]:', data);
  
  if (data.error) throw new Error(`Groq Error: ${data.error.message}`);
  const result = data.choices[0].message.content.trim();
  console.log('✨ SocialAI [Cleaned Result]:', result);
  return result;
}

async function handleGeminiGeneration(apiKey, prompt) {
  // Original diagnostics & retry logic for Gemini
  let availableModels = [];
  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const listData = await listRes.json();
    if (listData.models) {
      availableModels = listData.models
        .filter(m => m.supportedGenerationMethods.includes('generateContent'))
        .map(m => m.name.split('/').pop());
      
      availableModels.sort((a, b) => {
        if (a.includes('flash') && !b.includes('flash')) return -1;
        if (a.includes('3.1') && !b.includes('3.1')) return 1;
        return 0;
      });
    }
  } catch (err) {
    console.error('Failed to list models:', err);
  }

  if (availableModels.length === 0) {
    availableModels = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];
  }

  let lastError = null;
  for (const model of availableModels) {
    try {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      const data = await response.json();
      if (data.error) {
        lastError = data.error.message;
        if (lastError.toLowerCase().includes('quota') || lastError.toLowerCase().includes('not found')) continue;
        throw new Error(lastError);
      }
      if (data.candidates && data.candidates[0].content.parts[0].text) {
        return data.candidates[0].content.parts[0].text.trim();
      }
    } catch (err) {
      lastError = err.message;
      continue;
    }
  }
  throw new Error(`Gemini thất bại: ${lastError}`);
}
