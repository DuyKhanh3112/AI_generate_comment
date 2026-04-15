// ================= CONFIG (TURBO MODE) =================
const CONFIG = {
  MIN_DELAY: 4000,    // Chậm lại x2
  MAX_DELAY: 8000,
  READ_MIN: 1500,     // Đọc kỹ hơn
  READ_MAX: 3000,
  ACTION_LIMIT: 20,
  COOLDOWN_MIN: 15000,
  COOLDOWN_MAX: 40000,
  COMMENT_PROBABILITY: 1.0
};

console.log('⚡ SocialAI TURBO Loaded');

// ================= STATE =================
let isAutoMode = false;
let timer = null;
let actionCount = 0;
let isCooling = false;
let isProcessing = false; // Flag mới để chống chạy trùng
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
  // 1. Tìm bằng từ khóa văn bản trực tiếp
  const btns = Array.from(post.querySelectorAll('[role="button"], div[role="button"]'));
  for (const b of btns) {
    const text = (b.innerText || '').toLowerCase();
    if (text === 'bình luận' || text === 'comment' || text.includes('viết bình luận')) return b;
  }

  // 2. Tìm bằng nhãn aria (kể cả nhãn con)
  const ariaComment = post.querySelector('[aria-label*="Bình luận"], [aria-label*="Comment"], [aria-label*="Write a comment"]');
  if (ariaComment) return ariaComment;

  // 3. Chiến thuật SVG (Dò tìm icon hình hội thoại)
  const svgs = post.querySelectorAll('svg');
  for (const svg of svgs) {
    const p = svg.closest('[role="button"]');
    if (p) {
      // Facebook thường dùng thẻ <use> hoặc path phức tạp, ta kiểm tra các thẻ lân cận
      const containerText = (p.parentElement?.innerText || '').toLowerCase();
      if (containerText.includes('bình luận') || containerText.includes('comment')) return p;
    }
  }

  // 4. Fallback cuối cùng: Nút thứ 2 trong nhóm các nút tương tác chính
  // Like là nút 1, Comment là nút 2, Share là nút 3
  const actionGroup = post.querySelectorAll('[role="button"]');
  if (actionGroup.length >= 2) {
    // Thường nút bình luận nằm ở vị trí thứ 2 hoặc gần đó
    // Ta kiểm tra xem nó có phải là nút "Thích" không, nếu không phải thì khả năng cao là Comment
    for (let i = 0; i < Math.min(actionGroup.length, 3); i++) {
      const t = actionGroup[i].innerText.toLowerCase();
      if (t.includes('bình luận') || t.includes('comment')) return actionGroup[i];
    }
    // Nếu không tìm thấy chữ, lấy đại nút thứ 2 (thường là icon comment)
    return actionGroup[1];
  }

  return null;
}

// ================= FAST TYPE =================
async function typeText(el, text) {
  if (!el) return;
  el.focus();

  // 1. Chiến thuật xóa sạch ô nhập trước khi gõ
  document.execCommand('selectAll', false, null);
  document.execCommand('delete', false, null);
  await sleep(100);

  // 2. Thử gõ từng ký tự bằng insertText (giả lập người dùng)
  let success = false;
  try {
    for (let i = 0; i < text.length; i++) {
      success = document.execCommand('insertText', false, text[i]);
      if (!success) break;
      await sleep(random(30, 70));
    }
  } catch (e) {
    success = false;
  }

  // 3. Nếu gõ từng chữ thất bại, thử dán cả đoạn văn bản
  if (!success || el.innerText.length < 2) {
    console.log('🔄 Đang thử chiến thuật gõ dự phòng...');
    el.innerText = text;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // 4. Kích hoạt thêm sự kiện phím cho Facebook nhận diện
  el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
  el.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
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

  // Kiểm tra xem đây có phải là dialog chứa bài viết không
  const btn = dialog.querySelector('[aria-label="Close"], [aria-label="Đóng"], [aria-label*="đóng" i], [aria-label*="close" i]');
  if (btn) {
    btn.click();
  } else {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  }
}

// ================= CORE =================
async function processPost() {
  if (isCooling || !isAutoMode || isProcessing) return;
  isProcessing = true; // Bắt đầu xử lý khóa

  try {
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

      console.log('👆 Đang nhấn nút bình luận...');
      btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(800);

      // Tạo hiệu ứng nháy nhẹ để biết đang click vào đâu
      btn.style.outline = '2px solid #ff9900';
      btn.click();

      // Giả lập click bằng MouseEvent nếu click thường không ăn
      btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

      setTimeout(() => { btn.style.outline = ''; }, 1000);

      // Đợi và thử tìm ô nhập liệu nhiều lần (vì Facebook load động)
      for (let i = 0; i < 8; i++) { // Tăng lên 8 lần
        console.log(`⏱️ Đang đợi ô nhập liệu (Lần ${i + 1}/8)...`);
        await sleep(1000);

        box = target.querySelector('[role="textbox"], [contenteditable="true"], [aria-label*="bình luận" i], [aria-label*="comment" i], textarea');
        if (!box) {
          box = document.querySelector('[role="dialog"] [role="textbox"], [role="dialog"] [contenteditable="true"], [role="dialog"] [aria-label*="comment" i]');
        }

        if (box) break;

        // Nếu đã quá 4 lần mà chưa thấy, thử nhấn lại nút lần nữa (đề phòng click hụt)
        if (i === 3) {
          console.log('🔄 Có vẻ click hụt, đang nhấn lại lần 2...');
          btn.click();
        }
      }
    }

    if (box) {
      console.log('✨ Đã tìm thấy ô nhập liệu. Đang kích hoạt...');
      box.scrollIntoView({ behavior: 'smooth', block: 'center' });
      box.style.outline = '2px solid #00ff00';
      await sleep(500);
      box.click(); // Kích hoạt ô nhập
      box.focus();

      // Đợi ngắn hơn nhưng kiểm tra kỹ hơn
      await sleep(1000);
      setTimeout(() => { box.style.outline = ''; }, 1000);
    }

    if (!box) {
      console.log('⚠️ Đã nhấn nút nhưng hệ thống Facebook không mở ô bình luận.');
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
    await sleep(1500);
    console.log('⌨️ Bắt đầu gõ bình luận...');
    await typeText(box, res.comment);

    await sleep(1000);
    console.log('📤 Đang gửi bình luận...');

    // 1. Giả lập phím Enter đầy đủ (Down -> Press -> Up)
    const enterDown = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true });
    const enterUp = new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true });
    box.dispatchEvent(enterDown);
    box.dispatchEvent(enterUp);

    // 2. Tìm và nhấn nút "Gửi/Đăng" vật lý (Cực kỳ quan trọng)
    await sleep(1500);

    // Tìm trong phạm vi bài viết hoặc dialog
    const searchScope = document.querySelector('[role="dialog"]') || target;
    let sendBtn = searchScope.querySelector('[aria-label*="Đăng" i], [aria-label*="Post" i], [aria-label*="Gửi" i], [aria-label*="Bình luận" i], [aria-label*="Comment" i]');

    if (!sendBtn) {
      // Fallback: Tìm nút có text phù hợp
      const btns = Array.from(searchScope.querySelectorAll('[role="button"], div[role="button"]'));
      sendBtn = btns.find(b => {
        const t = (b.innerText || '').toLowerCase();
        return t === 'đăng' || t === 'post' || t === 'gửi' || t === 'bình luận' || t === 'comment';
      });
    }

    if (sendBtn) {
      console.log('🖱️ Đã tìm thấy nút Gửi/Đăng, đang nhấn...');
      sendBtn.click();
      // Giả lập thêm click chuỗi cho chắc
      sendBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      sendBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    } else {
      console.log('⚠️ Không thấy nút Gửi, hy vọng Enter đã hoạt động.');
    }

    // 3. Đợi và kiểm tra xem đã gửi chưa
    for (let i = 4; i > 0; i--) {
      const currentText = (box.innerText || '').trim();
      if (currentText === '') {
        console.log('✅ Xác nhận: Ô nhập đã trống, khả năng cao đã gửi thành công.');
        break;
      }
      console.log(`⏳ Đang đợi FB xử lý (${i}s)... Văn bản còn lại: ${currentText.length} kí tự`);
      await sleep(1000);
    }

    // Chỉ đóng dialog nếu ô nhập đã trống (tránh mất comment nếu FB bị lag)
    const finalCheck = (box.innerText || '').trim();
    if (finalCheck === '' || !document.contains(box)) {
      console.log('⏳ Gửi xong! Đang chờ vài giây để xem kết quả...');
      await sleep(3000); // Đợi 3 giây theo yêu cầu
      console.log('🚪 Đóng hộp thoại và tiếp tục...');
      closeDialog();
    } else {
      console.log('⚠️ Ô nhập vẫn còn nội dung, không đóng dialog để không bị mất bài.');
    }

  } catch (error) {
    console.error('❌ Lỗi trong quá trình xử lý bài viết:', error);
  } finally {
    // Luôn giải phóng trạng thái cho dù thành công hay lỗi
    isProcessing = false;

    // 🧊 Cooldown & Cooldown logic (Chỉ tăng đếm nếu thành công một phần nào đó - hoặc cứ tăng để tránh spam)
    actionCount++;
    console.log(`✔️ Hoàn thành chu kỳ bài viết thứ ${actionCount}/${CONFIG.ACTION_LIMIT}`);
    if (actionCount >= CONFIG.ACTION_LIMIT) {
      isCooling = true;
      console.log('⏱️ Đạt giới hạn, đang nghỉ ngơi...');
      setTimeout(() => {
        actionCount = 0;
        isCooling = false;
        console.log('🔄 Đã nghỉ ngơi xong, tiếp tục!');
      }, 30000); // Nghỉ 30s cho chắc
    }
  }
}

// ================= LOOP =================
function loop() {
  if (!isAutoMode) {
    isProcessing = false;
    return;
  }
  processPost().finally(() => {
    if (isAutoMode) {
      timer = setTimeout(loop, random(CONFIG.MIN_DELAY, CONFIG.MAX_DELAY));
    }
  });
}

// ================= EVENTS =================
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'TOGGLE_AUTO_MODE') {
    const previouslyEnabled = isAutoMode;
    isAutoMode = msg.enabled;

    if (isAutoMode) {
      if (!previouslyEnabled) {
        console.log('🚀 Khởi động Auto Mode...');
        clearTimeout(timer);
        loop();
      } else {
        console.log('ℹ️ Auto Mode đã đang chạy, bỏ qua lệnh kích hoạt trùng.');
      }
    } else {
      console.log('🛑 Dừng Auto Mode.');
      clearTimeout(timer);
    }
  }
});
