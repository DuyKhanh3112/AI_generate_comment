// ================= CONFIG (TURBO MODE) =================
const CONFIG = {
  MIN_DELAY: 2000,    // Gấp 5 lần
  MAX_DELAY: 5000,
  READ_MIN: 500,      // Đọc cực nhanh
  READ_MAX: 1500,
  ACTION_LIMIT: 15,   // Comment nhiều hơn mới nghỉ
  COOLDOWN_MIN: 10000,
  COOLDOWN_MAX: 30000,
  COMMENT_PROBABILITY: 1.0 // 100% comment
};

console.log('⚡ SocialAI TURBO Loaded');

// ================= STATE =================
let isAutoMode = false;
let timer = null;
let actionCount = 0;
let isCooling = false;
const processed = new Set();

// ================= UTILS =================
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const random = (min, max) => min + Math.random() * (max - min);
const chance = (p) => Math.random() < p;

// ================= FAST SCROLL =================
async function humanScroll(target) {
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await sleep(random(500, 1000));
}

// ================= FIND COMMENT BUTTON =================
function findCommentButton(post) {
  const btns = post.querySelectorAll('[role="button"]');
  for (const b of btns) {
    const text = (b.innerText || '').toLowerCase();
    if (text.includes('bình luận') || text.includes('comment')) return b;
  }
  return post.querySelector('[aria-label*="Bình luận"], [aria-label*="Comment"]');
}

// ================= FAST TYPE =================
async function typeText(el, text) {
  el.focus();
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);

  for (let i = 0; i < text.length; i++) {
    document.execCommand('insertText', false, text[i]);
    await sleep(random(20, 50)); // Gõ cực nhanh
  }
}

// ================= GET CONTENT =================
function getPostContent(post) {
  const texts = post.querySelectorAll('[dir="auto"]');
  let result = '';
  texts.forEach(el => {
    if (el.innerText.length > 20) result += el.innerText + ' ';
  });
  return result.trim().slice(0, 800) || "Nội dung bài viết";
}

// ================= FILTER POST =================
function isValidPost(post) {
  const text = post.innerText.toLowerCase();
  if (text.includes('sponsored') || text.includes('được tài trợ')) return false;
  return post.offsetHeight > 200;
}

// ================= CLOSE DIALOG =================
function closeDialog() {
  const dialog = document.querySelector('[role="dialog"]');
  if (!dialog) return;
  const btn = dialog.querySelector('[aria-label="Close"], [aria-label="Đóng"]');
  if (btn) btn.click();
  else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

// ================= CORE =================
async function processPost() {
  if (isCooling || !isAutoMode) return;

  const posts = Array.from(document.querySelectorAll('[role="article"]'))
    .filter(p => p.offsetHeight > 300);

  let target = null;
  for (const p of posts) {
    const id = p.innerText.slice(0, 100);
    if (!processed.has(id) && isValidPost(p)) {
      processed.add(id);
      target = p;
      break;
    }
  }

  if (!target) {
    window.scrollBy({ top: 1200, behavior: 'smooth' });
    return;
  }

  console.log('⚡ Processing Fast...');
  await humanScroll(target);
  await sleep(random(CONFIG.READ_MIN, CONFIG.READ_MAX));

  // 🔍 Find box
  let box = target.querySelector('[role="textbox"]');
  if (!box) {
    const btn = findCommentButton(target);
    if (!btn) return;
    btn.click();
    await sleep(1000); // Chờ mở box nhanh hơn
    box = target.querySelector('[role="textbox"]') || document.querySelector('[role="dialog"] [role="textbox"]');
  }

  if (!box) return;

  // 🤖 AI
  const content = getPostContent(target);
  const res = await chrome.runtime.sendMessage({
    type: 'GENERATE_COMMENT',
    payload: { postContent: content }
  });

  if (!res?.success) return;

  // ✍️ Submit
  await typeText(box, res.comment);
  await sleep(500);

  const enterEv = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true };
  box.dispatchEvent(new KeyboardEvent('keydown', enterEv));

  await sleep(1500); // Chờ gửi nhanh hơn
  closeDialog();

  // 🧊 Cooldown
  actionCount++;
  if (actionCount >= CONFIG.ACTION_LIMIT) {
    isCooling = true;
    setTimeout(() => { actionCount = 0; isCooling = false; }, 15000);
  }
}

// ================= LOOP =================
function loop() {
  if (!isAutoMode) return;
  processPost().finally(() => {
    timer = setTimeout(loop, random(CONFIG.MIN_DELAY, CONFIG.MAX_DELAY));
  });
}

// ================= EVENTS =================
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'TOGGLE_AUTO_MODE') {
    isAutoMode = msg.enabled;
    if (isAutoMode) loop();
    else clearTimeout(timer);
  }
});
