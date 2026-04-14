// ================= CONFIG =================
const CONFIG = {
  'facebook.com': {
    commentBox: '[role="textbox"][contenteditable="true"]'
  }
};

console.log('🚀 SocialAI FINAL REAL SUBMIT Loaded');

// ================= UTILS =================
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function waitForElement(selector, root = document, timeout = 6000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const el = root.querySelector(selector);
    if (el) return el;
    await sleep(250);
  }
  return null;
}

// ================= FIND COMMENT BUTTON =================
function findCommentButton(post) {
  return (
    post.querySelector('[aria-label*="Comment"], [aria-label*="Bình luận"]') ||
    Array.from(post.querySelectorAll('[role="button"]')).find(btn => {
      const t = (btn.innerText || '').toLowerCase();
      return t.includes('bình luận') || t.includes('comment');
    })
  );
}

// ================= INSERT COMMENT =================
async function insertComment(box, text) {
  box.focus();
  console.log('⌨️ Typing...');

  for (const char of text) {
    document.execCommand('insertText', false, char);

    box.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      data: char,
      inputType: 'insertText'
    }));

    await sleep(20 + Math.random() * 40);
  }

  console.log('✅ Done typing');
}

// ================= DETECT COMMENT APPEAR =================
async function waitForCommentAppear(text, timeout = 5000) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const found = Array.from(document.querySelectorAll('[role="article"], [role="dialog"]'))
      .some(el => el.innerText.includes(text.slice(0, 10)));

    if (found) return true;

    await sleep(300);
  }

  return false;
}

// ================= SUBMIT COMMENT =================
async function submitComment(box, text) {
  console.log('📤 Try submit...');
  box.focus();

  // ===== ENTER =====
  box.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true
  }));

  let ok = await waitForCommentAppear(text);
  if (ok) {
    console.log('✅ Submitted by Enter');
    return true;
  }

  // ===== CTRL + ENTER =====
  box.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    ctrlKey: true,
    bubbles: true
  }));

  ok = await waitForCommentAppear(text);
  if (ok) {
    console.log('✅ Submitted by Ctrl+Enter');
    return true;
  }

  // ===== CLICK BUTTON =====
  const submitBtn = Array.from(document.querySelectorAll('[role="button"]'))
    .find(btn => {
      const t = (btn.innerText || '').toLowerCase();
      return t === 'bình luận' || t === 'comment';
    });

  if (submitBtn) {
    console.log('🖱️ Click submit');
    submitBtn.click();

    ok = await waitForCommentAppear(text);
    if (ok) {
      console.log('✅ Submitted by Click');
      return true;
    }
  }

  console.warn('❌ Submit failed');
  return false;
}

// ================= CLOSE DIALOG =================
function closeCommentDialog() {
  const dialog = document.querySelector('[role="dialog"]');
  if (!dialog) return;

  let btn =
    dialog.querySelector('[aria-label="Đóng"]') ||
    dialog.querySelector('[aria-label="Close"]');

  if (!btn) {
    btn = Array.from(dialog.querySelectorAll('[role="button"]'))
      .find(b => (b.innerText || '').toLowerCase().includes('đóng'));
  }

  if (btn) {
    console.log('🖱️ Close dialog');
    btn.click();
  } else {
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true
    }));
  }
}

// ================= GET CONTENT =================
function findRelatedPostContent(box) {
  const container =
    box.closest('[role="article"]') ||
    box.closest('[role="dialog"]');

  if (!container) return "Bài viết";

  return Array.from(container.querySelectorAll('[dir="auto"]'))
    .map(el => el.innerText)
    .filter(t => t.length > 20)
    .join(' ')
    .slice(0, 1000);
}

// ================= STATE =================
let isAutoMode = false;
let timer = null;
const processed = new Set();

// ================= MAIN =================
async function processPost() {
  console.log('================ 🚀 START =================');

  const posts = Array.from(document.querySelectorAll('[role="article"]'))
    .filter(p => p.offsetHeight > 300);

  let target = null;

  for (const p of posts) {
    const id = p.innerText.slice(0, 80);

    if (!processed.has(id)) {
      processed.add(id);
      target = p;
      console.log('✅ Found post');
      break;
    }
  }

  if (!target) {
    window.scrollBy({ top: 1200, behavior: 'smooth' });
    return;
  }

  target.style.outline = '3px solid red';

  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await sleep(800);

  let box = target.querySelector('[role="textbox"]');

  if (!box) {
    const btn = findCommentButton(target);
    if (!btn) return;

    btn.style.outline = '3px solid blue';
    btn.click();

    box = await waitForElement('[role="textbox"]', document, 5000);
  }

  if (!box) return;

  box.style.outline = '3px solid green';

  // ===== CONTENT =====
  const content = findRelatedPostContent(box);

  // ===== AI =====
  const res = await chrome.runtime.sendMessage({
    type: 'GENERATE_COMMENT',
    payload: { postContent: content }
  });

  if (!res?.success) return;

  console.log('🤖 AI:', res.comment);

  // ===== INSERT =====
  await insertComment(box, res.comment);

  // ===== WAIT TEXT =====
  let tries = 0;
  while (box.innerText.length < 2 && tries < 10) {
    await sleep(200);
    tries++;
  }

  console.log('📦 Final text:', box.innerText);

  // ===== SUBMIT =====
  let success = await submitComment(box, res.comment);

  // ===== RETRY nếu fail =====
  if (!success) {
    console.log('🔁 Retry submit...');
    await sleep(1500);
    success = await submitComment(box, res.comment);
  }

  await sleep(2500);

  // ===== CLOSE =====
  closeCommentDialog();

  await sleep(800);

  // ===== NEXT =====
  window.scrollBy({
    top: target.offsetHeight + 200,
    behavior: 'smooth'
  });

  console.log('================ ✅ END =================');
}

// ================= LOOP =================
function loop() {
  if (!isAutoMode) return;

  processPost().finally(() => {
    timer = setTimeout(loop, 3000 + Math.random() * 3000);
  });
}

// ================= EVENTS =================
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'TOGGLE_AUTO_MODE') {
    isAutoMode = msg.enabled;
    console.log('🤖 Auto:', isAutoMode);

    if (isAutoMode) loop();
    else clearTimeout(timer);
  }
});

// ================= INIT =================
chrome.storage.local.get(['isAutoMode'], (res) => {
  if (res.isAutoMode) {
    isAutoMode = true;
    setTimeout(loop, 3000);
  }
});