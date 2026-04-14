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
  // 1. Nhắm vào các vùng chứa tin nhắn chính
  const mainSelectors = [
    '[data-ad-preview="message"]',
    '[data-ad-comet-preview="message"]',
    '[data-testid="post_message"]',
    '[role="presentation"] [dir="auto"]'
  ];

  for (const s of mainSelectors) {
    const el = post.querySelector(s);
    if (el && el.innerText.trim().length > 10) return el.innerText.trim().slice(0, 1000);
  }

  // 2. Fallback: Gom tất cả các đoạn text dir="auto" và mô tả ảnh
  const fragments = [];
  post.querySelectorAll('div[dir="auto"], span[dir="auto"]').forEach(el => {
    if (el.closest('a') || el.closest('button')) return;
    const text = el.innerText.trim();
    if (text.length > 20) fragments.push(text);
  });

  // Lấy thêm mô tả ảnh nếu có
  post.querySelectorAll('img').forEach(img => {
    const alt = img.getAttribute('alt');
    if (alt && alt.length > 20 && !alt.includes('No photo description available')) {
      fragments.push(`[Mô tả ảnh: ${alt}]`);
    }
  });

  return [...new Set(fragments)].join('\n').slice(0, 1000);
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
  console.log('--- 🔍 Bắt đầu quét bài viết mới ---');

  // Tìm tất cả các thẻ có vẻ giống bài viết
  const candidates = document.querySelectorAll('[role="article"], [aria-posinset], [data-pagelet*="FeedUnit"], [data-testid="fbfeed_story"], div.x1yztbdb.x1n2onr6.xh8yej3');

  // Lọc ra các bài viết thực sự (chiều cao > 100px để tránh các nút/nhãn nhỏ)
  const posts = Array.from(candidates).filter(p => {
    let h = p.offsetHeight || p.clientHeight;
    if (h === 0 && p.firstElementChild) h = p.firstElementChild.offsetHeight;

    // Thêm điều kiện: bỏ qua các bài viết ẩn quá xa trên cùng (Facebook giữ nguyên thẻ rỗng)
    const rect = p.getBoundingClientRect();
    const isTooFarUp = rect.bottom < -1000;

    return h > 100 && (p.innerText || "").length > 20 && !isTooFarUp;
  });

  if (posts.length === 0) {
    console.log('⚠️ Đang chờ DOM Facebook nạp thêm bài viết...');
  }

  let target = null;
  for (const p of posts) {
    // Đã bỏ kiểm tra nội dung bài viết.
    // Chỉ kiểm tra xem bộ DOM này đã từng được chạm vào bởi Extension này chưa.
    if (!p.dataset.aiProcessed && isValidPost(p)) {
      p.dataset.aiProcessed = 'true'; // Đánh dấu thẻ HTML này
      target = p;
      break;
    }
  }

  if (!target) {
    console.log('⏩ Quét thấy bài nhưng toàn bài cũ hoặc chưa tải xong. Cuộn nhẹ xuống...');
    window.scrollBy({ top: 900, behavior: 'smooth' });
    return;
  }

  console.log('🎯 Đã nhắm mục tiêu một bài viết.');
  await humanScroll(target);
  await sleep(random(CONFIG.READ_MIN, CONFIG.READ_MAX));

  // 🔍 Find box
  console.log('🖱️ Đang tìm ô nhập bình luận...');
  let box = target.querySelector('[role="textbox"]');
  if (!box) {
    const btn = findCommentButton(target);
    if (!btn) {
      console.log('⚠️ Không tìm thấy nút bình luận cho bài này.');
      return;
    }
    btn.click();
    await sleep(1500); // Chờ hộp thoại mở
    box = target.querySelector('[role="textbox"]') || document.querySelector('[role="dialog"] [role="textbox"]');
  }

  if (!box) {
    console.log('⚠️ Đã nhấn nút nhưng ô bình luận không xuất hiện.');
    return;
  }

  // 🤖 AI
  console.log('📄 Đang trích xuất nội dung bài viết...');
  const contentSource = document.querySelector('[role="dialog"]') || target;
  let content = getPostContent(contentSource);

  if (!content) {
    console.log('⚠️ Nội dung trích xuất quá ngắn hoặc trống, lấy toàn bộ văn bản bù trừ...');
    content = target.innerText.slice(0, 800);
  }

  console.log('>>> [RAW LOG] BÀI VIẾT:\n' + content);
  console.log('%c📝 NỘI DUNG BÀI VIẾT ĐÃ TRÍCH XUẤT:', 'color: #ff9900; font-size: 14px; font-weight: bold;', content);

  console.log('🤖 Đang yêu cầu AI tạo bình luận...');
  const res = await chrome.runtime.sendMessage({
    type: 'GENERATE_COMMENT',
    payload: { postContent: content }
  });

  if (!res?.success) {
    console.error('❌ Lỗi tạo bình luận:', res?.error);
    return;
  }

  console.log('>>> [RAW LOG] COMMENT:\n' + res.comment);
  console.log('%c✅ NỘI DUNG BÌNH LUẬN (AI XUẤT RA):', 'color: #00ff00; font-size: 14px; font-weight: bold;', res.comment);


  // ✍️ Submit
  console.log('⌨️ Đang gõ bình luận...');
  await typeText(box, res.comment);
  await sleep(500);

  console.log('📤 Đang nhấn Enter...');
  const enterEv = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true };
  box.dispatchEvent(new KeyboardEvent('keydown', enterEv));

  await sleep(1500); // Chờ gửi nhanh hơn
  closeDialog();

  // 🧊 Cooldown
  actionCount++;
  console.log(`✔️ Hoàn thành bài viết thứ ${actionCount}/${CONFIG.ACTION_LIMIT}`);
  if (actionCount >= CONFIG.ACTION_LIMIT) {
    isCooling = true;
    console.log('⏱️ Đạt giới hạn, đang nghỉ ngơi...');
    setTimeout(() => { actionCount = 0; isCooling = false; console.log('🔄 Đã nghỉ ngơi xong, tiếp tục!'); }, 15000);
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
