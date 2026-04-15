// ================= CONFIG (TURBO MODE) =================
const CONFIG = {
  MIN_DELAY: 2000,
  MAX_DELAY: 5000,
  READ_MIN: 500,
  READ_MAX: 1500,
  ACTION_LIMIT: 15,
  COOLDOWN_MIN: 10000,
  COOLDOWN_MAX: 30000,
  COMMENT_PROBABILITY: 1.0
};

//console.log('⚡ SocialAI TURBO (Optimized) Loaded');

// ================= STATE =================
let isAutoMode = false;
let timer = null;
let actionCount = 0;
let isCooling = false;
let isProcessing = false;

// ================= UTILS =================
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const random = (min, max) => min + Math.random() * (max - min);

// ================= FAST SCROLL =================
async function humanScroll(target) {
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await sleep(random(400, 800));
}

// ================= FIND COMMENT BUTTON =================
function findCommentButton(post) {
  // Ưu tiên tìm trực tiếp bằng nhãn bạn cung cấp
  const specific = post.querySelector('[aria-label="Viết bình luận"], [aria-label="Write a comment"]');
  if (specific) return specific;

  const btns = post.querySelectorAll('[role="button"]');
  for (const b of btns) {
    const text = (b.innerText || '').toLowerCase();
    if (text.includes('bình luận') || text.includes('comment')) return b;
  }
  return post.querySelector('[aria-label*="Bình luận"], [aria-label*="Comment"]');
}

// ================= FAST TYPE =================
async function typeText(el, text) {
  if (!el) return;
  el.focus();

  const words = text.split(' ');
  for (let i = 0; i < words.length; i++) {
    // Gõ theo từ với tốc độ cao hơn để tạo cảm giác mượt mà
    document.execCommand('insertText', false, words[i] + (i < words.length - 1 ? ' ' : ''));

    // Kích hoạt sự kiện input
    el.dispatchEvent(new Event('input', { bubbles: true }));

    // Di chuyển con trỏ xuống cuối (giúp hiệu ứng mượt hơn)
    const sel = window.getSelection();
    if (sel.rangeCount > 0) sel.getRangeAt(0).collapse(false);

    // Nghỉ ngắn (50ms - 120ms)
    await sleep(random(50, 120));
  }

  //console.log('⌨️ Đã gõ xong nội dung (hiệu ứng gõ tay an toàn)');
}

// ================= GET CONTENT =================
function getPostContent(post) {
  let content = '';
  
  // 1. Extract main text
  const mainSelectors = [
    '[data-ad-preview="message"]',
    '[data-ad-comet-preview="message"]',
    '[data-testid="post_message"]',
    'div[dir="auto"].x1iorvi4.x1pi3ozi'
  ];

  for (const s of mainSelectors) {
    const el = post.querySelector(s);
    if (el && el.innerText.trim().length > 5) {
      content = el.innerText.trim();
      break;
    }
  }

  if (!content) {
    const allDivs = Array.from(post.querySelectorAll('div[dir="auto"]'));
    const mainText = allDivs.find(el => {
      const text = el.innerText.trim();
      if (text.length < 20) return false;
      if (el.closest('a') || el.closest('button') || el.closest('[role="complementary"]')) return false;
      const isInsideComment = el.closest('ul') || el.closest('[role="article"] [role="article"]');
      return !isInsideComment;
    });
    content = mainText ? mainText.innerText.trim() : post.innerText.slice(0, 500);
  }

  // 2. Extract image descriptions (Facebook's auto-generated ALT tags)
  const imgDescriptions = [];
  post.querySelectorAll('img').forEach(img => {
    const alt = img.getAttribute('alt');
    // Filter out generic or empty ALT tags
    if (alt && alt.length > 10 && 
        !alt.includes('No photo description') && 
        !alt.includes('May be an image of')) {
      imgDescriptions.push(alt);
    }
  });

  if (imgDescriptions.length > 0) {
    content += '\n[Bối cảnh hình ảnh: ' + imgDescriptions.join(', ') + ']';
  }

  return content.slice(0, 1200);
}

// ================= FILTER POST =================
function isValidPost(post) {
  const text = post.innerText.toLowerCase();
  if (text.includes('sponsored') || text.includes('được tài trợ')) return false;
  return post.offsetHeight > 180;
}

// ================= CLOSE DIALOG =================
function closeDialog() {
  const dialog = document.querySelector('[role="dialog"]');
  if (!dialog) return;
  const btn = dialog.querySelector('[aria-label="Close"], [aria-label="Đóng"], [aria-label*="đóng" i]');
  if (btn) btn.click();
  else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

// ================= CORE =================
async function processPost() {
  if (isCooling || !isAutoMode || isProcessing) return;
  isProcessing = true;

  try {
    //console.log('--- 🔍 Quét bài viết mới ---');
    const posts = Array.from(document.querySelectorAll('[role="article"], [aria-posinset], div.x1yztbdb.x1n2onr6.xh8yej3'))
      .filter(p => !p.dataset.aiProcessed && isValidPost(p));

    if (posts.length === 0) {
      window.scrollBy({ top: 800, behavior: 'smooth' });
      return;
    }

    const target = posts[0];
    target.dataset.aiProcessed = 'true';
    await humanScroll(target);
    await sleep(random(CONFIG.READ_MIN, CONFIG.READ_MAX));

    // 🔍 Tìm ô nhập với cơ chế Quét nhanh
    let box = target.querySelector('[role="textbox"]');
    if (!box) {
      const btn = findCommentButton(target);
      if (btn) {
        btn.click();
        for (let i = 0; i < 5; i++) {
          await sleep(800);
          box = target.querySelector('[role="textbox"]') || document.querySelector('[role="dialog"] [role="textbox"]');
          if (box) break;
        }
      }
    }

    if (!box) return;

    // 🤖 AI
    const contentSource = document.querySelector('[role="dialog"]') || target;
    const postContent = getPostContent(contentSource);

    //console.log('%c📄 NỘI DUNG BÀI VIẾT TRÍCH XUẤT:', 'background: #222; color: #bada55; font-size: 12px; padding: 4px;', postContent);

    const res = await chrome.runtime.sendMessage({
      type: 'GENERATE_COMMENT',
      payload: { postContent: postContent }
    });

    if (!res?.success) {
      console.error('❌ Lỗi tạo bình luận:', res?.error);
      return;
    }

    //console.log('%c🤖 AI COMMENT:', 'background: #222; color: #00ff00; font-size: 14px; font-weight: bold; padding: 4px;', res.comment);

    // ✍️ Submit
    await typeText(box, res.comment);
    await sleep(500);
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));

    // Đợi xác nhận gửi thành công mới đóng
    let sent = false;
    for (let i = 0; i < 5; i++) {
      await sleep(1000);
      if ((box.textContent || '').trim().length < 2 || !document.contains(box)) {
        sent = true;
        break;
      }
    }

    if (sent) {
      await sleep(2000);
      closeDialog();
    }

  } catch (e) {
    console.error(e);
  } finally {
    isProcessing = false;
    actionCount++;
    if (actionCount >= CONFIG.ACTION_LIMIT) {
      isCooling = true;
      setTimeout(() => { actionCount = 0; isCooling = false; }, 20000);
    }
  }
}

// ================= LOOP =================
function loop() {
  if (!isAutoMode) return;
  processPost().finally(() => {
    if (isAutoMode) timer = setTimeout(loop, random(CONFIG.MIN_DELAY, CONFIG.MAX_DELAY));
  });
}

// ================= MAGIC BUTTON INJECTION =================
function injectMagicButtons() {
  const textboxes = document.querySelectorAll('[role="textbox"]');

  textboxes.forEach(box => {
    // Skip if already has button or is not a comment box (Facebook has many textboxes)
    if (box.dataset.socialAiInjected) return;

    // Detect if it's likely a comment box
    const isCommentBox = box.closest('form') || box.closest('[role="presentation"]') || box.getAttribute('aria-label')?.toLowerCase().includes('bình luận');
    if (!isCommentBox) return;

    box.dataset.socialAiInjected = 'true';

    // Find a stable parent to append our button
    const container = box.parentElement;
    if (!container) return;

    // Ensure container has relative positioning for our absolute button
    if (getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }

    const btn = document.createElement('button');
    btn.className = 'social-ai-magic-btn';
    btn.innerHTML = '✨';
    btn.title = 'Tự động tạo bình luận bằng AI';

    btn.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (btn.classList.contains('loading')) return;

      btn.classList.add('loading');
      btn.innerHTML = '⏳';

      try {
        const post = box.closest('[role="article"], [aria-posinset], div.x1yztbdb.x1n2onr6.xh8yej3') || document.querySelector('[role="dialog"]');
        const postContent = getPostContent(post || document.body);

        const res = await chrome.runtime.sendMessage({
          type: 'GENERATE_COMMENT',
          payload: { postContent }
        });

        if (res?.success) {
          await typeText(box, res.comment);
        } else {
          console.error('SocialAI: Error', res?.error);
        }
      } catch (err) {
        console.error('SocialAI: Click handler failed', err);
      } finally {
        btn.classList.remove('loading');
        btn.innerHTML = '✨';
      }
    };

    container.appendChild(btn);
  });
}

// ================= INITIALIZE & OBSERVE =================
const observer = new MutationObserver(() => {
  injectMagicButtons();
});

observer.observe(document.body, { childList: true, subtree: true });
injectMagicButtons();

// ================= EVENTS =================
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'TOGGLE_AUTO_MODE') {
    const was = isAutoMode;
    isAutoMode = msg.enabled;
    if (isAutoMode && !was) {
      isProcessing = false;
      loop();
    } else if (!isAutoMode) {
      clearTimeout(timer);
    }
  }
});
