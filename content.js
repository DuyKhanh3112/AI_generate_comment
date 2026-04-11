// Selectors for different platforms - refined for better detection
const CONFIG = {
  'facebook.com': {
    commentBox: 'div[role="textbox"][contenteditable="true"]',
    postContent: 'div[data-ad-preview="message"], div[data-testid="post_message"], .x11i5rnm.xat24cr.x1mh8g0r.x1vvkbs.xtl86bm'
  },
  'linkedin.com': {
    commentBox: '.ql-editor[contenteditable="true"]',
    postContent: '.feed-shared-update-v2__description-wrapper, .feed-shared-text, .update-components-text'
  },
  'x.com': {
    commentBox: 'div[role="textbox"][contenteditable="true"]',
    postContent: 'div[data-testid="tweetText"]'
  }
};

console.log('🚀 SocialAI Content Script Loaded');

function getPlatform() {
  const host = window.location.hostname;
  if (host.includes('facebook')) return 'facebook.com';
  if (host.includes('linkedin')) return 'linkedin.com';
  if (host.includes('x.com') || host.includes('twitter')) return 'x.com';
  return null;
}

function injectMagicButton() {
  const platformKey = getPlatform();
  if (!platformKey) return;

  const boxes = document.querySelectorAll(CONFIG[platformKey].commentBox);

  boxes.forEach(box => {
    // Safety check for search boxes or other non-comment areas
    const ariaLabel = (box.getAttribute('aria-label') || '').toLowerCase();
    if (ariaLabel.includes('search') || ariaLabel.includes('tìm kiếm')) return;

    if (box.dataset.socialAiInjected) return;
    box.dataset.socialAiInjected = 'true';

    const btn = document.createElement('button');
    btn.className = 'social-ai-magic-btn';
    btn.innerHTML = '✨';
    btn.title = 'SocialAI - Tạo bình luận';

    // Position finding
    let target = box;
    // Walk up to find a container that isn't too tight
    let depth = 0;
    while (target && target.parentElement && target.offsetHeight < 30 && depth < 3) {
      target = target.parentElement;
      depth++;
    }

    if (target && target.parentElement) {
      const parent = target.parentElement;
      if (window.getComputedStyle(parent).position === 'static') {
        parent.style.position = 'relative';
      }
      parent.appendChild(btn);
    }

    btn.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (!chrome.runtime?.id) return;

      btn.classList.add('loading');

      try {
        const postContent = findRelatedPostContent(box, platformKey);
        console.log('📝 SocialAI [Post Content]:', postContent);

        const response = await chrome.runtime.sendMessage({
          type: 'GENERATE_COMMENT',
          payload: { postContent }
        });

        if (response && response.success) {
          console.log('✨ SocialAI [AI Response]:', response);
          insertComment(box, response.comment);
        } else {
          console.error('❌ SocialAI [Error]:', response.error);
        }
      } catch (err) {
        console.error('💥 SocialAI [Crash]:', err.message);
      } finally {
        btn.classList.remove('loading');
      }
    };
  });
}

function findRelatedPostContent(box, platform) {
  let container = null;
  const boxRect = box.getBoundingClientRect();
  
  // 1. Direct Ancestry (The most accurate for Dialogs/Articles)
  container = box.closest('div[role="article"]') || box.closest('[role="dialog"]') || box.closest('.x1y1aw1k');

  // 2. Proximity Search (For Feed where box is outside or sibling-based)
  if (!container || container.innerText.length < 100) {
    const fbSelectors = ['div[role="article"]', '.x1y1aw1k', '.x1dw8y2y', '.x1n2onr6'];
    const candidates = Array.from(document.querySelectorAll(fbSelectors.join(',')));
    let minDistance = Infinity;

    candidates.forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.height < 200) return;

      // Check for horizontal overlap (must be in the same column)
      const hasOverlap = (r.left < boxRect.right && r.right > boxRect.left);
      if (!hasOverlap) return;

      // Vertical distance from article bottom to box top
      const dist = Math.abs(boxRect.top - r.bottom);
      
      // If it's above the box or very close
      if (r.top < boxRect.bottom && dist < 1500) {
        if (dist < minDistance) {
          minDistance = dist;
          container = el;
        }
      }
    });
  }

  if (container) {
    // Visual Pulse
    container.style.boxShadow = '0 0 15px 5px #00ff88'; 
    setTimeout(() => container.style.boxShadow = '', 1000);

    // Try finding specific message area
    const msgEl = container.querySelector('[data-ad-comet-preview="message"], [data-ad-preview="message"], .x1iorvi4');
    if (msgEl && msgEl.innerText.trim().length > 20) return msgEl.innerText.trim();

    const clone = container.cloneNode(true);
    const garbage = clone.querySelectorAll('form, button, input, [role="button"], script, style, .x1uvtmcs');
    garbage.forEach(el => el.remove());

    const contentLines = clone.innerText.split('\n')
      .map(t => t.trim())
      .filter(t => t.length > 25)
      .filter(t => !/^(Thích|Bình luận|Chia sẻ|Like|Comment|Share|Gửi|Phản hồi|Viết|Video|Sửa)/i.test(t));

    return contentLines.join(' ') || "Nội dung bài viết đang thảo luận";
  }
  
  return "Nội dung bài viết trên mạng xã hội";
}

function insertComment(box, text) {
  box.focus();

  // 1. Clear any existing draft to avoid prefixing
  if (box.innerText.length < 5) box.innerHTML = "";

  // 2. The most stable way for Lexical/React: execCommand ALONE
  // then a generic input event for state sync
  try {
    const success = document.execCommand('insertText', false, text);

    if (success) {
      // Just notify the framework that something changed, don't pass 'data' to avoid double-rendering
      box.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      // Manual backup
      box.textContent = text;
      box.dispatchEvent(new Event('change', { bubbles: true }));
    }
  } catch (err) {
    box.textContent = text;
  }
}

// Observe DOM for dynamic loading
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.addedNodes.length) {
      injectMagicButton();
    }
  }
});

observer.observe(document.body, { childList: true, subtree: true });
// Initial run
setTimeout(injectMagicButton, 2000);
