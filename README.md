# 🤖 SocialAI - Automated Batch Commenter

![SocialAI Banner](https://img.shields.io/badge/AI-Powered-8b5cf6?style=for-the-badge&logo=ai)
![Version](https://img.shields.io/badge/Version-1.0.0-06b6d4?style=for-the-badge)
![Manifest](https://img.shields.io/badge/Manifest-V3-f8fafc?style=for-the-badge)

**SocialAI** là một Browser Extension mạnh mẽ được thiết kế để tự động hóa hoàn toàn quy trình tương tác trên Facebook. Thay vì phải làm thủ công từng bài viết, SocialAI sử dụng Trí tuệ nhân tạo để quét bảng tin, phân tích nội dung và tự động để lại bình luận thông minh, giúp bạn duy trì sự hiện diện trực tuyến một cách hiệu quả nhất.

---

## ✨ Tính năng nổi bật

- **🤖 Chế độ tự động hoàn toàn (Full Auto Mode):** Tự động cuộn, tìm kiếm bài viết mới và thực hiện tương tác mà không cần sự can thiệp của người dùng.
- **✨ Nút Magic (Manual Action):** Tạo bình luận tức thì cho từng bài viết cụ thể bằng cách nhấn vào biểu tượng AI ngay tại ô nhập liệu.
- **🧠 Phân tích ngữ cảnh toàn diện:** AI không chỉ đọc văn bản mà còn phân tích **nội dung hình ảnh** (thông qua ALT tags) để đưa ra bình luận chính xác và tự nhiên nhất.
- **⚡ Đa dạng AI Provider:** Hỗ trợ cả **Google Gemini API** và **Groq API (Llama 3)** cho tốc độ phản hồi cực nhanh.
- **🎨 Tùy chỉnh phong cách (Vibe Control):**
  - 😊 **Friendly:** Thân thiện, hòa đồng.
  - 💼 **Professional:** Chuyên nghiệp, lịch sự.
  - ⚡ **Witty:** Hài hước, sắc sảo.
  - ❤️ **Supportive:** Đồng cảm, ủng hộ.
- **🛡️ Cơ chế chống Spam (Cooldown System):** Tự động nghỉ ngơi sau một lượng hành động nhất định để bảo vệ tài khoản của bạn.
- **💎 Giao diện Premium:** Thiết kế mang phong cách Modern Glassmorphism với hiệu ứng Neon bắt mắt.

---

## 🛠️ Hướng dẫn cài đặt

1. **Tải mã nguồn:** Tải hoặc clone thư mục dự án này về máy tính của bạn.
2. **Mở Chrome Extensions:** Truy cập `chrome://extensions/` trên trình duyệt Chrome.
3. **Kích hoạt Developer Mode:** Bật công tắc ở góc trên bên phải màn hình.
4. **Load Unpacked:** 
   - Nhấn vào nút **"Load unpacked"** (Tải tiện ích đã giải nén).
   - Chọn đường dẫn đến thư mục chứa dự án này (`AI_generate_comment`).
5. **Ghim Extension:** Nhấn vào biểu tượng mảnh ghép trên thanh công cụ và ghim **SocialAI** để dễ dàng truy cập.

---

## 🔑 Cấu hình API Key

Để SocialAI có thể hoạt động, bạn cần cấu hình ít nhất một API Key:

- **Google Gemini:** Lấy key tại [Google AI Studio](https://aistudio.google.com/).
- **Groq Cloud:** Lấy key tại [Groq Console](https://console.groq.com/).

Mở popup SocialAI, chọn Provider, dán Key và nhấn **Save**.

---

### 🚀 Cách sử dụng
#### Cách 1: Chế độ Tự động (Auto Mode)
1. Truy cập **Facebook.com**.
2. Mở popup **SocialAI** từ thanh công cụ trình duyệt.
3. Nhấp vào nút **"Bật Chế Độ Tự Động"**. SocialAI sẽ tự động cuộn và tương tác.

#### Cách 2: Chế độ Thủ công (Magic Button)
1. Tại ô nhập bình luận của bất kỳ bài viết nào, bạn sẽ thấy biểu tượng **✨**.
2. Nhấn vào biểu tượng **✨** để SocialAI phân tích bài viết và tự động gõ nội dung bình luận gợi ý vào ô nhập.
3. Bạn có thể chỉnh sửa lại nội dung hoặc nhấn Enter để đăng ngay.

---

## 🛠️ Công nghệ sử dụng

- **Frontend:** Vanilla JavaScript, HTML5, CSS3.
- **AI Engine:** Google Gemini Pro, Llama 3 (via Groq).
- **Automation:** DOM Observer & Simulated Human Interactions.
- **Communication:** Manifest V3 Background Service Workers.

---

## 👨‍💻 Phát triển bởi

**Duy Khánh**  
📧 Liên hệ: [vdkhanh3112@gmail.com](mailto:vdkhanh3112@gmail.com)

---

*Crafted with ❤️ for visual disruptors.*