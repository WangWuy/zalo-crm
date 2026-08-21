# HƯỚNG DẪN TRIỂN KHAI & THU THẬP DỮ LIỆU THELAB CRM (THỰC CHIẾN)
> **Mục tiêu:** Tài liệu cung cấp lộ trình kỹ thuật và phân tích nguồn dữ liệu thực tế cho TheLab CRM. Tài liệu bóc tách rõ **rào cản kiểm duyệt của các nền tảng (Meta, Zalo, Nhà mạng)** và đưa ra **phương án tối ưu, dễ làm, tiết kiệm chi phí nhất** cho đội ngũ phát triển.

---

## 1. KIẾN TRÚC TỔNG THỂ & CÁC DÒNG DỮ LIỆU (DATA FLOWS)

Hệ thống TheLab CRM vận hành dựa trên **4 luồng dữ liệu chính**:

```text
+-----------------------------------------------------------------------------------------------+
|                                    1. NGUỒN MARKETING & LEAD                                  |
|   [ Facebook Fanpage / Lead Ads ]     [ Landing Page / Form ]     [ File Excel / Data lạnh ]  |
+-----------------------------------------------------------------------------------------------+
                                      │ (Meta Webhook / REST API / Import)
                                      ▼
+───────────────────────────────────────────────────────────────────────────────────────────────+
|                                    2. THELAB CRM BACKEND                                      |
|                                                                                               |
|   ┌───────────────────────────┐      ┌───────────────────────────┐                            |
|   │    API Ingestion Service  │ ───► │  Data Pool Engine (0/15)  │                            |
|   └─────────────┬─────────────┘      └─────────────┬─────────────┘                            |
|                 │                                  │                                          |
|                 ▼                                  ▼                                          |
|   ┌───────────────────────────┐      ┌───────────────────────────┐                            |
|   │     CRM Database (DB)     │ ───► │   KPI Realtime Engine     │                            |
|   └─────────────┬─────────────┘      └───────────────────────────┘                            |
+─────────────────┼──────────────────────────────────┼──────────────────────────────────────────+
                  │                                  │
                  │ (Đồng bộ hai chiều)              │ (Cập nhật tiến độ)
                  ▼                                  ▼
+───────────────────────────────────+  +────────────────────────────────────────────────────────+
|      3. HỆ THỐNG SÀN / CORE       |  |                 4. GIAO DIỆN THELAB CRM                |
|  [ Database Sàn: UID, Nạp tiền ]  |  |  • Bảng điều khiển (Tiến độ KPI, Biểu đồ 30 ngày)      |
|  [ Event Webhook: Đăng ký/Nạp ]   |  |  • Tasks & Khách hàng (Danh sách việc cần làm)         |
+───────────────────────────────────+  |  • Chi tiết Khách hàng & Lịch sử Chat Facebook         |
                                       +────────────────────────────┬───────────────────────────+
                                                                    │ (Click tương tác)
                                                                    ▼
                                       +────────────────────────────────────────────────────────+
                                       |                 5. KÊNH TƯƠNG TÁC SALE                 |
                                       |  [ 📞 Gọi điện: tel: ]  [ 💬 Zalo ]  [ ✈️ Telegram ]   |
                                       +────────────────────────────────────────────────────────+
```

---

## 2. PHÂN TÍCH RÀO CẢN THỰC TẾ & CÁCH LẤY DỮ LIỆU TỪNG NGUỒN

---

### NGUỒN 1: Facebook / Meta (Thu thập Lead & Đồng bộ Lịch sử Chat)

#### ⚠️ Rào cản & Thực trạng thực tế:
* **Chính sách Meta khắt khe:** Muốn gọi API đọc tin nhắn khách hàng (`pages_messaging`) hoặc lấy data Lead Ads ở môi trường Production, Meta bắt buộc phải **Xác minh doanh nghiệp (Business Verification)** kèm Giấy phép kinh doanh và trải qua quy trình **App Review (Xét duyệt ứng dụng)** nghiêm ngặt.
* **Quy định 24 giờ:** Fanpage không thể tự động nhắn lại cho khách sau 24h nếu khách không chủ động tương tác.

#### 💡 Giải pháp Thực chiến Tối ưu:
* **Phương án A - Tự chủ 100% bằng Page Token Admin (Không cần App Review):**
  * Tạo Meta Developer App ở chế độ **Development Mode**.
  * Dùng tài khoản Facebook cá nhân (giữ quyền Admin Fanpage) để tạo **Page Access Token vĩnh viễn (Never Expire)**.
  * Vì tài khoản sở hữu quyền Admin trực tiếp của Page, bạn có thể gọi Graph API đọc tin nhắn và nhận Webhook bình thường mà **không cần nộp hồ sơ xin duyệt App với Meta**.
* **Phương án B - Dùng ManyChat/Pancake làm "Cầu nối Webhook" (Rẻ & Ổn định):**
  * Tận dụng ManyChat (hoặc Pancake) đã được Meta cấp phép sẵn để hứng tin nhắn trên Page.
  * Khi khách để lại SĐT trong chat bot, ManyChat tự động kích hoạt 1 HTTP Request (Webhook) bắn JSON về API của CRM nội bộ.
  * *Chi phí thấp, không lo bảo trì API Facebook mỗi khi Meta đổi phiên bản Graph API.*

#### Mã nguồn Backend nhận Webhook Facebook Lead (Node.js):
```typescript
// Webhook nhận lead từ Facebook / ManyChat
app.post('/api/webhooks/facebook-lead', async (req, res) => {
  const { sender_psid, customer_name, phone_number, ad_source } = req.body;

  if (phone_number) {
    await db.leads.create({
      data: {
        phone: phone_number,
        full_name: customer_name || 'Khách Facebook',
        source: ad_source || 'Facebook/ManyChat',
        in_pool: true, // Đưa vào kho chờ nhận
        status: 'Khách Mới'
      }
    });
  }
  return res.status(200).json({ success: true });
});
```

---

### NGUỒN 2: Landing Page & Website (Vertex Insights)

#### ⚠️ Rào cản & Thực trạng:
* Đây là nguồn **dễ triển khai nhất**, 100% thuộc quyền kiểm soát của đội ngũ nội bộ, không có rào cản từ bên thứ 3.

#### 💡 Giải pháp Triển khai:
* Xây dựng API nội bộ `POST /api/v1/leads/ingest`.
* Nhúng script Javascript trên form Landing Page để tự động bắt các tham số UTM (Chiến dịch quảng cáo, nguồn `Vertex Insights`, mã Adset).

```javascript
// Script nhúng trên Form Landing Page
async function submitLead(name, phone) {
  const urlParams = new URLSearchParams(window.location.search);
  await fetch('https://crm-api.yourdomain.com/api/v1/leads/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': 'SECRET_LP_KEY' },
    body: JSON.stringify({
      full_name: name,
      phone: phone,
      source: 'LandingPage',
      campaign: urlParams.get('utm_campaign') || 'Direct',
      utm_source: urlParams.get('utm_source') || 'Vertex Insights'
    })
  });
}
```

---

### NGUỒN 3: Hệ thống Sàn / Core App (UID, Đăng ký, Nạp tiền, Ngưng GD)

#### ⚠️ Rào cản & Thực trạng:
* Không có rào cản bên ngoài vì đều là hệ thống nội bộ của công ty.

#### 💡 Giải pháp Triển khai (Tự động hóa 100% điểm KPI):
* **Cơ chế Webhook Event nội bộ:**
  * Khi người dùng tạo tài khoản sàn thành công $\rightarrow$ Backend Core bắn Event `USER_REGISTERED` sang CRM kèm `phone` và `custom_uid` $\rightarrow$ CRM tự động chuyển trạng thái khách sang **`KH Đăng Ký`**, tăng chỉ tiêu KPI cho Sale phụ trách.
  * Khi người dùng nạp tiền thành công lần đầu $\rightarrow$ Backend Core bắn Event `DEPOSIT_SUCCESS` $\rightarrow$ CRM tự động chuyển sang **`KH Đã Nạp`**, ghi nhận KPI nạp.
  * Nếu sau 30 ngày tài khoản không có phát sinh giao dịch $\rightarrow$ Core bắn Event `INACTIVE_30D` $\rightarrow$ CRM chuyển sang **`Ngưng GD`** để đưa vào danh sách cần chăm sóc lại.

---

### NGUỒN 4: Kênh Chăm sóc Telesale, Zalo, Telegram

#### ⚠️ Rào cản thực tế với Zalo & Nhà mạng:
1. **Zalo:** Zalo **chặn hoàn toàn việc mở API cho tài khoản Zalo cá nhân**. Zalo chỉ có API cho tài khoản Zalo OA Doanh nghiệp (tính phí từ 200đ - 400đ/tin thông báo ZNS và cần giấy phép).
2. **Gọi điện:** Đăng ký tổng đài VoIP/SIP Trunk doanh nghiệp cần thủ tục pháp nhân. Nếu dùng SIM cá nhân cắm vào GSM Gateway gọi tự động quá nhiều sẽ bị nhà mạng khóa SIM theo Nghị định 91 (chống spam).

#### 💡 Giải pháp Thực chiến (Zero Cost - An toàn 100%):
* **Zalo:** Gắn Deep-link URL: `https://zalo.me/${customerPhone}`. Khi Sale click vào icon Zalo trên CRM, trình duyệt sẽ tự động gọi ứng dụng Zalo trên máy tính/điện thoại để mở khung chat trực tiếp. **Hoàn toàn miễn phí, không cần đăng ký API, không lo khóa tài khoản.**
* **Telegram:** Gắn Deep-link `https://t.me/${telegramUsername || customerPhone}` để mở app chat ngay.
* **Telesale (Gọi điện):**
  * Gắn liên kết `<a href="tel:0772120496">📞 Gọi</a>`.
  * Sale sử dụng điện thoại di động cá nhân hoặc tai nghe softphone để thực hiện cuộc gọi.
  * Sau cuộc gọi, Sale chọn nhanh lý do trong khung *Lịch sử chăm sóc* (*Đã kết bạn Zalo, Thuê bao, Hẹn tối gọi lại*) để hệ thống ghi nhận task hoàn thành.

---

## 3. CƠ CHẾ DATA POOL & TÍNH TOÁN KPI NỘI BỘ (DATABASE SCHEMA)

Toàn bộ dữ liệu sau khi thu thập sẽ được vận hành qua Database nội bộ của CRM với các bảng chính sau:

```text
┌──────────────────────────────────────────────┐
│                    USERS                     │
├──────────────────────────────────────────────┤
│ • id (UUID, PK)                              │
│ • full_name ("Chloe - Sale")                 │
│ • team_name ("Tộp 3F")                       │
│ • daily_quota (15)                           │
└───────┬──────────────────────────────┬───────┘
        │ 1 phụ trách nhiều            │ 1 có nhiều
        ▼                              ▼
┌─────────────────────────────────┐   ┌─────────────────────────────────┐
│              LEADS              │   │           KPI_RECORDS           │
├─────────────────────────────────┤   ├─────────────────────────────────┤
│ • id (UUID, PK)                 │   │ • id (UUID, PK)                 │
│ • phone (0772120496, Unique)    │   │ • sale_id (UUID, FK -> USERS)   │
│ • full_name ("L.Q Thạch")       │   │ • record_date (2026-08-13)      │
│ • custom_uid ("UID_995448174")  │   │ • target_new / achieved_new     │
│ • telegram_handle ("@username") │   │ • target_deposit / ach_deposit  │
│ • status (Mới/ĐK/Đã Nạp/Ngưng)  │   │ • target_reg / achieved_reg     │
│ • source ("Facebook / ManyChat")│   └─────────────────────────────────┘
│ • assigned_sale_id (FK -> USERS)│
│ • in_pool (Boolean: true/false) │
│ • last_contact_at (Timestamp)   │
└───────┬─────────────────────────┘
        │ 1 có nhiều
        ▼
┌─────────────────────────────────┐
│            CARE_LOGS            │
├─────────────────────────────────┤
│ • id (UUID, PK)                 │
│ • lead_id (UUID, FK -> LEADS)   │
│ • sale_id (UUID, FK -> USERS)   │
│ • channel (Call / Zalo / Tele)  │
│ • note ("Gọi ko nghe máy...")   │
│ • created_at (Timestamp)        │
└─────────────────────────────────┘
```

### Quy tắc Vận hành Nghiệp vụ:
1. **Hạn mức Data `(0/15)`:** Mỗi ngày Sale có quyền bấm "Nhận data" tối đa 15 lead từ kho `in_pool = true`. Khi nhận, hệ thống gán `assigned_sale_id` = ID của Sale đó.
2. **Cơ chế "Đưa vào Pool":** Khi khách không tiềm năng hoặc chăm sóc không thành công, Sale bấm "Đưa vào Pool" để trả data về kho chung, nhường quyền bốc cho Sale khác.
3. **Cơ chế Xử lý SĐT Trùng:** Nếu lead mới nhập trùng SĐT đã có trên hệ thống, CRM ghi nhận yêu cầu vào danh sách chờ Leader duyệt chuyển quyền hoặc từ chối.

---

## 4. MA TRẬN ĐÁNH GIÁ MỨC ĐỘ PHỨC TẠP & LỜI KHUYÊN TRIỂN KHAI

| Phân hệ chức năng | Mức độ phức tạp | Rào cản lớn nhất | Phương án khuyên dùng |
| :--- | :---: | :--- | :--- |
| **Giao diện & Logic CRM** | **Thấp** | Không có (Tự code 100%) | Dùng Next.js / React + PostgreSQL / Supabase. |
| **Kết nối Sàn / Core App** | **Thấp** | Không có (Hệ thống nội bộ) | Dùng Webhook hoặc REST API nội bộ giữa 2 backend. |
| **Zalo & Telegram** | **Thấp** | Zalo cấm API cá nhân | Dùng Deep-link `zalo.me/` và `t.me/` (0đ, an toàn). |
| **Landing Page Lead** | **Thấp** | Không có | Tự viết API `POST /leads/ingest` bắt UTM. |
| **Lead & Chat Facebook** | **Trung bình** | Xét duyệt App Meta / BM | Dùng Page Token Admin (Dev Mode) hoặc ManyChat làm cầu nối Webhook. |
| **Tổng đài Telesale** | **Trung bình** | Hồ sơ viễn thông / Khóa SIM | Dùng Click-to-call `tel:` để Sale dùng điện thoại riêng gọi trực tiếp. |

---

## 5. LỘ TRÌNH TRIỂN KHAI THEO 4 GIAI ĐOẠN TINH GỌN

```text
Giai đoạn 1 (Tuần 1-2): DỰNG CORE CRM & UI CHĂM SÓC
├── Khởi tạo CSDL: Bảng Leads, Users, Care Logs, KPI Records
├── Dựng UI Dashboard, Danh sách Tasks & Khách hàng, Chi tiết Khách hàng
└── Gắn Deep-link tương tác: tel:, zalo.me, t.me và tính năng Import Excel

Giai đoạn 2 (Tuần 3): TỰ ĐỘNG HÓA THU THẬP LEAD
├── Viết API nhận Lead từ Landing Page (Vertex Insights)
└── Cấu hình Webhook nhận Lead từ Facebook / ManyChat tự động đổ về Data Pool

Giai đoạn 3 (Tuần 4): TÍCH HỢP SÀN CORE & TÍNH KPI REALTIME
├── Kết nối Webhook nội bộ từ Core Sàn (Sự kiện Đăng ký, Nạp tiền, UID)
├── Tự động nhảy trạng thái KH ĐK -> KH Đã Nạp và cập nhật tiến độ KPI ngày
└── Hoàn thiện đếm ngược Deadline báo cáo ca và bảng xếp hạng đội nhóm

Giai đoạn 4: TỐI ƯU & QUẢN TRỊ NÂNG CAO
├── Hoàn thiện quy trình duyệt khiếu nại SĐT trùng giữa các Sale
└── Bổ sung cơ chế tự động thu hồi Lead về Pool nếu quá 48h không liên hệ
```
