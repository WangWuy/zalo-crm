# CẨM NANG CHI TIẾT CÁCH LẤY DỮ LIỆU & TÍCH HỢP TỪNG NGUỒN (THELAB CRM)
> **Mục tiêu:** Tài liệu cung cấp hướng dẫn kỹ thuật chi tiết từng bước (Step-by-Step Playbook) kèm mã nguồn mẫu, JSON payload, cURL API và câu lệnh SQL để xây dựng và lấy dữ liệu cho từng tính năng của TheLab CRM.

---

## MỤC LỤC
1. [Nguồn 1: Thu thập Lead & Lịch sử Chat từ Facebook / ManyChat](#1-nguồn-1-thu-thập-lead--lịch-sử-chat-từ-facebook--manychat)
2. [Nguồn 2: Thu thập Lead từ Landing Page / Website (Vertex Insights)](#2-nguồn-2-thu-thập-lead-từ-landing-page--website-vertex-insights)
3. [Nguồn 3: Xử lý Import File Excel / Data Lạnh vào Data Pool](#3-nguồn-3-xử-lý-import-file-excel--data-lạnh-vào-data-pool)
4. [Nguồn 4: Kết nối Hệ thống Sàn / Core App (UID, Đăng ký, Nạp tiền, Ngưng GD)](#4-nguồn-4-kết-nối-hệ-thống-sàn--core-app-uid-đăng-ký-nạp-tiền-ngưng-gd)
5. [Nguồn 5: Xây dựng Kênh Chăm sóc Telesale, Zalo, Telegram](#5-nguồn-5-xây-dựng-kênh-chăm-sóc-telesale-zalo-telegram)
6. [Nguồn 6: Xây dựng Logic Data Pool (0/15) & Đếm ngược Deadline Báo cáo](#6-nguồn-6-xây-dựng-logic-data-pool-015--đếm-ngược-deadline-báo-cáo)

---

## 1. NGUỒN 1: THU THẬP LEAD & LỊCH SỬ CHAT TỪ FACEBOOK / MANYCHAT

### Hướng 1A: Dùng ManyChat làm cổng Webhook trung gian (Khuyên dùng - Nhanh nhất)
* **Bước 1:** Trong Flow Chatbot của ManyChat, sau khi khách hàng nhập Số điện thoại $\rightarrow$ Thêm 1 action **External Request**.
* **Bước 2:** Cấu hình External Request:
  * **HTTP Method:** `POST`
  * **Request URL:** `https://crm-api.yourdomain.com/api/webhooks/manychat-lead`
  * **Headers:** `Content-Type: application/json`, `X-Secret-Token: MY_MANYCHAT_SECRET`
  * **Request Body:**
    ```json
    {
      "subscriber_id": "{{user_id}}",
      "full_name": "{{first_name}} {{last_name}}",
      "phone": "{{phone_number}}",
      "page_id": "{{page_id}}",
      "ad_id": "{{ad_id}}",
      "ad_name": "{{ad_name}}"
    }
    ```
* **Bước 3:** Backend CRM xử lý lưu Lead vào CSDL:
  ```typescript
  // Node.js Express endpoint
  app.post('/api/webhooks/manychat-lead', async (req, res) => {
    const { subscriber_id, full_name, phone, ad_name } = req.body;
    
    // Chuẩn hóa SĐT về định dạng 10 số
    const cleanPhone = phone.replace(/[^0-9]/g, '').replace(/^84/, '0');
    
    await db.leads.create({
      data: {
        phone: cleanPhone,
        full_name: full_name || 'Khách Facebook',
        facebook_psid: subscriber_id,
        source: 'Facebook/ManyChat',
        source_detail: ad_name || 'Vertex Insights',
        in_pool: true,
        status: 'Khách Mới'
      }
    });
    return res.status(200).json({ status: 'success' });
  });
  ```

---

### Hướng 1B: Tự kết nối Meta Graph API & Webhooks trực tiếp (Zero Cost)
* **Bước 1 (Lấy Page Access Token vĩnh viễn):**
  1. Truy cập `developers.facebook.com/tools/explorer/`.
  2. Chọn App của bạn $\rightarrow$ Chọn Fanpage $\rightarrow$ Chọn các quyền: `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata`, `pages_messaging`.
  3. Lấy `Short-lived Token` $\rightarrow$ Đổi sang `Long-lived Page Token` (Không bao giờ hết hạn).
* **Bước 2 (Đăng ký Webhook nhận tin nhắn):**
  * Tại Meta Developer Dashboard $\rightarrow$ Webhooks $\rightarrow$ Page $\rightarrow$ Đăng ký URL: `https://crm-api.yourdomain.com/api/webhooks/facebook`.
* **Bước 3 (Đồng bộ Lịch sử Chat Facebook lên CRM):**
  * Khi Sale mở hồ sơ khách hàng, Backend CRM gọi cURL lấy danh sách tin nhắn:
  ```bash
  curl -X GET "https://graph.facebook.com/v19.0/{CONVERSATION_ID}/messages?fields=id,message,from,created_time&access_token={PAGE_ACCESS_TOKEN}"
  ```
  * Trả mảng tin nhắn về Frontend CRM để render vào khung *"Lịch sử chat Facebook"*.

---

## 2. NGUỒN 2: THU THẬP LEAD TỪ LANDING PAGE / WEBSITE (VERTEX INSIGHTS)

* **Bước 1 (Tạo Form trên Landing Page):** HTML Form với các input `name`, `phone`, `telegram`.
* **Bước 2 (Gắn Script bắt UTM Parameters tự động):**
  ```javascript
  // Script nhúng trên Landing Page
  document.getElementById("leadForm").addEventListener("submit", async function(e) {
    e.preventDefault();
    
    const urlParams = new URLSearchParams(window.location.search);
    const payload = {
      full_name: document.getElementById("txtName").value,
      phone: document.getElementById("txtPhone").value,
      telegram: document.getElementById("txtTele") ? document.getElementById("txtTele").value : null,
      source: "LandingPage",
      utm_source: urlParams.get("utm_source") || "Vertex Insights",
      utm_campaign: urlParams.get("utm_campaign") || "Direct",
      adset_id: urlParams.get("adset_id") || null,
      submitted_at: new Date().toISOString()
    };

    try {
      const response = await fetch("https://crm-api.yourdomain.com/api/v1/leads/ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": "SECRET_LANDING_PAGE_KEY_123"
        },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        alert("Đăng ký thành công! Chuyên viên sẽ liên hệ trong 5 phút.");
      }
    } catch (err) {
      console.error("Lỗi gửi form:", err);
    }
  });
  ```

---

## 3. NGUỒN 3: XỬ LÝ IMPORT FILE EXCEL / DATA LẠNH VÀO DATA POOL

* **Bước 1 (Chuẩn bị file Excel):** File gồm các cột: `Họ và tên`, `Số điện thoại`, `Nguồn data`, `Ghi chú`.
* **Bước 2 (Mã nguồn Backend xử lý File Upload - Node.js + thư viện `xlsx`):**
  ```typescript
  import * as XLSX from 'xlsx';

  export async function processExcelImport(fileBuffer: Buffer) {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const rows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    const results = { imported: 0, duplicates: 0 };

    for (const row of rows) {
      const rawPhone = String(row['Số điện thoại'] || row['phone'] || '');
      const cleanPhone = rawPhone.replace(/[^0-9]/g, '').replace(/^84/, '0');

      if (!cleanPhone || cleanPhone.length < 9) continue;

      // Kiểm tra trùng SĐT
      const existing = await db.leads.findUnique({ where: { phone: cleanPhone } });
      if (existing) {
        results.duplicates++;
        continue;
      }

      await db.leads.create({
        data: {
          phone: cleanPhone,
          full_name: row['Họ và tên'] || row['name'] || 'Khách vãng lai',
          source: row['Nguồn data'] || 'Import_Excel',
          in_pool: true,
          status: 'Khách Mới'
        }
      });
      results.imported++;
    }

    return results;
  }
  ```

---

## 4. NGUỒN 4: KẾT NỐI HỆ THỐNG SÀN / CORE APP (UID, ĐĂNG KÝ, NẠP TIỀN, NGƯNG GD)

*Để các chỉ số KPI trên Dashboard (`KH ĐK`, `KH nạp`, `Ngưng GD`) tự động cập nhật theo thời gian thực mà không cần Sale nhập thủ công:*

### Sự kiện 1: Khách tạo tài khoản trên Sàn $\rightarrow$ Cập nhật `KH Đăng Ký`
* **Trigger:** Khi hàm đăng ký tài khoản trên Backend Sàn thành công.
* **Payload Sàn bắn sang CRM:**
  ```bash
  POST https://crm-api.internal/api/core-events/user-registered
  Content-Type: application/json
  X-Internal-Secret: CORE_SYSTEM_SECRET_KEY
  ```
  ```json
  {
    "phone": "0772120496",
    "custom_uid": "UID_995448174",
    "registered_at": "2026-08-13T10:00:00Z"
  }
  ```
* **Logic xử lý tại CRM:**
  ```sql
  UPDATE leads 
  SET custom_uid = 'UID_995448174', status = 'KH ĐK', updated_at = NOW() 
  WHERE phone = '0772120496';

  -- Tăng chỉ tiêu KPI Đăng ký cho Sale phụ trách lead này
  UPDATE kpi_records 
  SET achieved_register = achieved_register + 1 
  WHERE sale_id = (SELECT assigned_sale_id FROM leads WHERE phone = '0772120496')
    AND record_date = CURRENT_DATE;
  ```

---

### Sự kiện 2: Khách nạp tiền lần đầu thành công $\rightarrow$ Cập nhật `KH Đã Nạp`
* **Trigger:** Khi Payment Gateway/Hệ thống nạp tiền ghi nhận giao dịch thành công.
* **Payload Sàn bắn sang CRM:**
  ```bash
  POST https://crm-api.internal/api/core-events/deposit-success
  ```
  ```json
  {
    "custom_uid": "UID_995448174",
    "amount": 5000000,
    "is_first_deposit": true,
    "deposited_at": "2026-08-13T15:30:00Z"
  }
  ```
* **Logic xử lý tại CRM:** Chuyển trạng thái sang **`KH Đã Nạp`**, tự động cộng +1 vào mục KPI *KH nạp* của Sale trên Dashboard.

---

## 5. NGUỒN 5: XÂY DỰNG KÊNH CHĂM SÓC TELESALE, ZALO, TELEGRAM

### A. Nút Gọi điện (Click-to-Call Native):
* **Frontend React/HTML:**
  ```jsx
  <a href={`tel:${customer.phone}`} className="btn-action-call">
    📞 Gọi ({customer.phone})
  </a>
  ```
* Bấm vào sẽ mở ứng dụng gọi điện mặc định trên thiết bị của Sale mà không tốn phí dịch vụ tổng đài.

### B. Nút Chat Zalo & Telegram (Deep-Link):
* **Zalo:** `<a href={`https://zalo.me/${customer.phone}`} target="_blank">💬 Zalo</a>`
* **Telegram:** `<a href={`https://t.me/${customer.telegram_handle || customer.phone}`} target="_blank">✈️ Telegram</a>`

### C. Ghi nhận Lịch sử chăm sóc (Care Log):
* Khi Sale bấm nút *"Xác nhận ghi chú"*, Frontend gửi:
  ```json
  POST /api/leads/123/care-logs
  {
    "channel": "Call",
    "note": "Khách hẹn tối gọi lại",
    "next_follow_up": "2026-08-13T19:00:00Z"
  }
  ```
* Backend lưu vào bảng `CARE_LOGS` và tự động hiển thị vào danh sách *"Hoạt động gần đây"* trên Dashboard.

---

## 6. NGUỒN 6: XÂY DỰNG LOGIC DATA POOL (0/15) & ĐẾM NGƯỢC DEADLINE BÁO CÁO

### A. Logic Bốc/Nhận Khách từ Data Pool (`daily_quota = 15`):
```sql
-- 1. Kiểm tra xem Sale hôm nay đã bốc bao nhiêu khách
SELECT COUNT(*) AS claimed_today 
FROM leads 
WHERE assigned_sale_id = :sale_id 
  AND DATE(claimed_at) = CURRENT_DATE;

-- 2. Nếu claimed_today < 15, gán 1 lead mới nhất trong Pool cho Sale
UPDATE leads 
SET assigned_sale_id = :sale_id, 
    in_pool = false, 
    claimed_at = NOW()
WHERE id = (
    SELECT id FROM leads 
    WHERE in_pool = true 
    ORDER BY created_at DESC 
    LIMIT 1 
    FOR UPDATE SKIP LOCKED
);
```

### B. Logic Đếm ngược Deadline Nộp Báo Cáo (`Deadline báo cáo: 1h 19m`):
```javascript
// Tính toán đồng hồ đếm ngược nộp báo cáo ca
function calculateShiftDeadline(shiftEndHour = 17, shiftEndMinute = 0) {
  const now = new Date();
  const deadline = new Date();
  deadline.setHours(shiftEndHour, shiftEndMinute, 0, 0);

  const diffMs = deadline - now;
  if (diffMs <= 0) return "Đã hết hạn nộp báo cáo";

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}
```
