document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKey');
  const saveKeyBtn = document.getElementById('saveKey');
  const vibeBtns = document.querySelectorAll('.vibe-btn');
  const providerSelect = document.getElementById('provider');
  const keyLabel = document.getElementById('keyLabel');
  const helpLink = document.getElementById('helpLink');
  const toggleAutoBtn = document.getElementById('toggleAuto');
  const statusText = document.getElementById('statusText');

  const providerInfo = {
    gemini: {
      label: 'Gemini API Key',
      help: 'Get one at <a href="https://aistudio.google.com/" target="_blank">Google AI Studio</a>'
    },
    groq: {
      label: 'Groq API Key',
      help: 'Get one at <a href="https://console.groq.com/keys" target="_blank">Groq Console</a>'
    }
  };

  // Load existing settings
  chrome.storage.local.get(['geminiApiKey', 'defaultVibe', 'provider', 'isAutoMode'], (result) => {
    console.log('📦 Loading settings:', result);
    if (result.geminiApiKey) {
      apiKeyInput.value = result.geminiApiKey;
    }
    if (result.defaultVibe) {
      updateActiveVibe(result.defaultVibe);
    }
    if (result.provider) {
      providerSelect.value = result.provider;
      updateProviderUI(result.provider);
    }
    if (result.isAutoMode) {
      updateAutoUI(true);
    }
  });

  providerSelect.addEventListener('change', () => {
    const p = providerSelect.value;
    updateProviderUI(p);
    chrome.storage.local.set({ provider: p });
  });

  function updateProviderUI(p) {
    keyLabel.textContent = providerInfo[p].label;
    helpLink.innerHTML = providerInfo[p].help;
  }

  // Save API Key
  saveKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (key) {
      console.log('💾 Saving API Key...');
      chrome.storage.local.set({ geminiApiKey: key }, () => {
        console.log('✅ API Key saved successfully!');
        saveKeyBtn.textContent = 'Saved!';
        saveKeyBtn.style.background = '#10b981';
        setTimeout(() => {
          saveKeyBtn.textContent = 'Save';
          saveKeyBtn.style.background = '';
        }, 2000);
      });
    } else {
      console.warn('⚠️ No API Key entered!');
    }
  });

  // Handle Vibe Selection
  vibeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const vibe = btn.dataset.vibe;
      chrome.storage.local.set({ defaultVibe: vibe }, () => {
        updateActiveVibe(vibe);
      });
    });
  });

  function updateActiveVibe(vibe) {
    vibeBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.vibe === vibe);
    });
  }

  // Auto Mode Toggle
  toggleAutoBtn.addEventListener('click', () => {
    chrome.storage.local.get(['isAutoMode'], (result) => {
      const newState = !result.isAutoMode;
      chrome.storage.local.set({ isAutoMode: newState }, () => {
        updateAutoUI(newState);
        
        // Notify active tab's content script
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_AUTO_MODE', enabled: newState });
          }
        });
      });
    });
  });

  function updateAutoUI(enabled) {
    if (enabled) {
      toggleAutoBtn.classList.add('running');
      toggleAutoBtn.querySelector('.text').textContent = 'Dừng Chế Độ Tự Động';
      toggleAutoBtn.querySelector('.icon').textContent = '🛑';
      statusText.textContent = 'Auto Bot is Active...';
    } else {
      toggleAutoBtn.classList.remove('running');
      toggleAutoBtn.querySelector('.text').textContent = 'Bật Chế Độ Tự Động';
      toggleAutoBtn.querySelector('.icon').textContent = '🤖';
      statusText.textContent = 'AI Engine Ready';
    }
  }

  // Modal support logic
  const modal = document.getElementById('supportModal');
  const openBtn = document.getElementById('openSupport');
  const closeBtn = document.querySelector('.close-modal');

  openBtn.addEventListener('click', () => {
    modal.style.display = 'block';
  });

  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });
});
