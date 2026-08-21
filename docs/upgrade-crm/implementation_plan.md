# KẾ HOẠCH TRIỂN KHAI: BỔ SUNG CÁC TÍNH NĂNG TỪ THELAB CRM VÀO ZALOCRM

> **Bối cảnh:** ZaloCRM hiện tại (checkout Community edition, `backend/src/_ee/` bị strip) đã vượt xa đặc tả TheLab CRM ở phần lõi (lead scoring đa chiều, automation sequences, RBAC, đa nguồn lead ads). Tài liệu này chỉ tập trung vào **9 khoảng trống thực sự** được xác định khi đối chiếu 2 hệ thống — chủ yếu xoay quanh **nhịp làm việc theo ca** (deadline báo cáo, night mode) và **thao tác nhanh tại chỗ** (quick note, quota badge, dialer config).
>
> **Quyết định phạm vi:** Mục "Bốc lead chủ động" (quota 0/15) được viết mới hoàn toàn trong core/module riêng, KHÔNG đụng vào cơ chế loader `_ee/` — vì bundle Extension gốc không có trong repo này, đây coi như xây tính năng mới dựa trên schema `LeadRequest`/`LeadPoolConfig`/`LeadPoolDistribution` đã có sẵn.
>
> **Không thuộc phạm vi:** Không sửa/gỡ open-core seam (`ee-registry/*`), không unlock `_ee-stubs`. Các phase dưới đây code thẳng trong `backend/src/modules/` và `frontend/src/`.

---

## Tổng quan 5 Phase

| Phase | Chủ đề | Mục TheLab tương ứng | Độ khó | Giá trị | Model khuyến nghị* | Effort khuyến nghị* |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| 1 | Ca làm việc & Báo cáo ca | #1 Deadline đếm ngược, #2 Form báo cáo + lịch sử | Trung bình | Cao | Sonnet | medium |
| 2 | Data Pool tự phục vụ (quota UI) | #3 Badge (0/15), #4 Nút bốc lead chủ động | Cao | Cao | **Sonnet (cân nhắc Opus nếu tự thấy không chắc tay)** | **high** |
| 3 | Thao tác nhanh & Quick tags | #8 Widget nhắc nhở nâng cấp, #9 Quick note tags, #10 Mẫu tin có kịch bản | Thấp | Cao | Sonnet | medium |
| 4 | Cấu hình cá nhân hoá | #5 Night Priority Mode, #6 Cấu hình tổng đài | Thấp | Trung bình | Sonnet | medium |
| 5 | Báo cáo KPI 30 ngày | #7 Biểu đồ cột lịch sử KPI | Trung bình | Trung bình | Sonnet | medium (sau khi đã chốt câu hỏi nghiệp vụ ở mục "CẦN VERIFY/HỎI LẠI THÊM") |

*Model + Effort đổi thủ công qua `/model` trước khi mở phiên code từng phase — không tự động, chỉ là gợi ý để cân đối tốc độ/chi phí vs độ chắc tay. Plan đã viết chi tiết từng bước/từng file nên Sonnet là đủ cho mọi phase — không cần Opus mặc định, chỉ nâng lên nếu Sonnet code sai/lệch nhiều trong thực tế. Phase 2 khuyến nghị effort cao hơn (không phải đổi model) vì có race condition + đụng vào quota đang chạy production (`LeadPoolConfig`).

Khuyến nghị triển khai theo thứ tự **3 → 5 → 1 → 4 → 2** (xem lý do chi tiết ở mục "THỨ TỰ THỰC HIỆN ĐỀ XUẤT" cuối tài liệu), nhưng tài liệu trình bày theo Phase 1-5 để bám sát nhóm chủ đề.

---

## PHASE 1: CA LÀM VIỆC & BÁO CÁO CA

### 1.1. Mục tiêu
Tái tạo 2 tính năng: (a) đồng hồ đếm ngược deadline nộp báo cáo ca trên Dashboard, (b) form nộp báo cáo ca/ngày gửi Leader + trang xem lịch sử.

### 1.2. Data model mới

**Quyết định phạm vi (đã chốt):** cấu hình ca **chung toàn org, 1 bộ ca duy nhất** — phương án đơn giản nhất. Không phân theo team hay theo user ở Phase 1. Nếu sau này cần ca riêng theo team/user, thêm cột `teamId`/`userId` nullable là việc migration nhỏ, không phải thiết kế lại.

Thêm 2 model vào `backend/prisma/schema.prisma` (đặt gần `CareSession`/`Department`):

```prisma
// Cấu hình ca làm việc & deadline báo cáo — CHUNG TOÀN ORG (đơn giản nhất, Phase 1).
// Org có thể khai nhiều ca (vd "Ca ngày", "Ca đêm") nhưng KHÔNG gán theo team/user —
// mọi sale nhìn thấy toàn bộ ca đang active và hệ thống tự chọn ca "đang diễn ra" theo
// giờ hiện tại (xem resolveShiftDeadline). Đơn giản hoá: nếu 2 ca active trùng giờ, lấy
// ca có startHour gần nhất với "now" (không cần UI chọn ca thủ công ở Phase 1).
model ShiftSchedule {
  id              String   @id @default(uuid())
  orgId           String   @map("org_id")
  name            String   // "Ca ngày", "Ca đêm"
  startHour       Int      @map("start_hour")   // 0-23, giờ VN
  startMinute     Int      @default(0) @map("start_minute")
  endHour         Int      @map("end_hour")
  endMinute       Int      @default(0) @map("end_minute")
  reportDeadlineMinutesBeforeEnd Int @default(0) @map("report_deadline_minutes_before_end")
  // Cảnh báo trước N phút (JSON array, vd [30, 15])
  alertMinutesBefore Json  @default("[30,15]") @map("alert_minutes_before")
  isActive        Boolean  @default(true) @map("is_active")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  org  Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@index([orgId, isActive])
  @@map("shift_schedules")
}

// Báo cáo ca/ngày do sale nộp.
model ShiftReport {
  id           String    @id @default(uuid())
  orgId        String    @map("org_id")
  userId       String    @map("user_id")
  shiftId      String?   @map("shift_id")
  reportDate   String    @map("report_date") // "YYYY-MM-DD" theo giờ VN — khóa 1 báo cáo/ca/ngày
  // Snapshot số liệu tại thời điểm nộp (không phụ thuộc query lại về sau)
  metrics      Json      @default("{}") @map("metrics") // { newLeads, deposits, registrations, calls, ... }
  note         String?   @db.Text
  submittedAt  DateTime  @default(now()) @map("submitted_at")
  isLate       Boolean   @default(false) @map("is_late") // nộp sau deadline
  reviewedByUserId String? @map("reviewed_by_user_id")
  reviewedAt   DateTime? @map("reviewed_at")

  org  Organization  @relation(fields: [orgId], references: [id], onDelete: Cascade)
  user User          @relation("ShiftReportUser", fields: [userId], references: [id])
  shift ShiftSchedule? @relation(fields: [shiftId], references: [id], onDelete: SetNull)
  reviewedBy User?    @relation("ShiftReportReviewer", fields: [reviewedByUserId], references: [id])

  @@unique([orgId, userId, shiftId, reportDate])
  @@index([orgId, userId, reportDate(sort: Desc)])
  @@index([orgId, reportDate, isLate])
  @@map("shift_reports")
}
```

Bổ sung relation ngược trên `User` (`shiftReportsSubmitted`, `shiftReportsReviewed`) và `Organization` (`shiftSchedules`, `shiftReports`) theo đúng convention hiện có (xem `User.leadRequests` làm mẫu). Không cần relation trên `Team` vì Phase 1 không phân theo team.

**Ghi chú migration:** chạy `npx prisma migrate dev --name add_shift_schedule_and_report` sau khi review schema.

### 1.3. Backend

Tạo module mới `backend/src/modules/shift/`:

- `shift-schedule-routes.ts` — CRUD `ShiftSchedule` (admin), theo mẫu `department-routes.ts` cho auth/RBAC.
  - `GET /api/v1/shifts/schedules` — list toàn bộ ca active của org (không lọc theo team/user)
  - `POST/PATCH/DELETE /api/v1/shifts/schedules/:id`
- `shift-report-routes.ts`:
  - `GET /api/v1/shifts/current` — trả về ca "đang diễn ra" hiện tại (không phụ thuộc user gọi là ai, vì ca là cấu hình chung toàn org), kèm `deadlineAt` (ISO) và `hasSubmittedToday` (boolean, theo `userId` của người gọi) để frontend tự tính countdown, tránh phải poll liên tục.
  - `POST /api/v1/shifts/reports` — nộp báo cáo (`reportDate` mặc định hôm nay theo giờ VN, `isLate` tính server-side so với `deadlineAt`).
  - `GET /api/v1/shifts/reports?userId=&from=&to=` — lịch sử, RBAC theo `getOwnerScope` (giống `dashboard-action-hub-routes.ts:89-106`).
  - `GET /api/v1/shifts/reports/:id`
- Helper tính deadline: viết `resolveActiveShift(orgId, now)` trong `shift-schedule-service.ts` — lấy tất cả `ShiftSchedule` active của org, chọn ca mà `now` nằm trong khoảng `[start, end]` (xử lý ca qua đêm, vd 22:00-06:00, bằng cách so sánh modulo 24h); nếu không có ca nào khớp (khoảng trống giữa 2 ca), trả `null` và FE ẩn widget deadline. Dùng lại pattern giờ VN đã có ở `todayRangeVN()` (`dashboard-action-hub-routes.ts:31-39`) thay vì code lại.
- Đăng ký routes trong `app.ts` cạnh nhóm `dashboard`/`rbac`.

**Không cần cron riêng** — deadline tính on-demand khi FE gọi `/shifts/current`; cảnh báo trước giờ (30p/15p) xử lý ở FE bằng `setTimeout`/watcher so sánh với `alertMinutesBefore`, gọi `NotificationBell`/toast sẵn có (`use-toast.ts`) khi chạm mốc.

### 1.4. Frontend

- Composable mới `frontend/src/composables/use-shift-report.ts`: fetch `/shifts/current`, tính `remainingMs` bằng `setInterval` 1s (client-side, không gọi API mỗi giây), expose `formattedCountdown`, `isOverdue`, `nextAlertAt`.
- Component `frontend/src/components/dashboard/ShiftDeadlineWidget.vue`: hiển thị đồng hồ đếm ngược kiểu TheLab (`⏱ Deadline báo cáo: 15m`), bấm mở `ShiftReportFormDialog.vue`.
- `ShiftReportFormDialog.vue`: form nhập note + hiển thị metrics snapshot tự động lấy từ dashboard action-hub hiện có (`use-dashboard-action-hub.ts`) — KHÔNG bắt sale gõ tay số liệu đã có sẵn trong hệ thống, chỉ cho sửa phần diễn giải.
- Trang lịch sử: thêm tab "Báo cáo ca" vào `frontend/src/views/reports/` (theo mẫu `SalesReport.vue`/`ReportsShell.vue`), route `/reports/shift-history`.
- Gắn `ShiftDeadlineWidget` vào `DashboardView.vue` cạnh vùng header hiện có (gần `KpiCards.vue`).

### 1.5. Rủi ro & lưu ý
- **Múi giờ:** toàn bộ tính toán ca phải dùng giờ VN (UTC+7) nhất quán với `todayRangeVN()` — không dùng `new Date()` trần.
- **RBAC:** Leader cần xem báo cáo của team mình → tái dùng `getOwnerScope` thay vì viết lại logic phân quyền.
- **1 báo cáo/ca/ngày:** ràng buộc unique `[orgId, userId, shiftId, reportDate]` chặn nộp trùng; PATCH thay vì POST nếu đã tồn tại (idempotent theo ngày).

---

## PHASE 2: DATA POOL TỰ PHỤC VỤ (QUOTA UI)

### 2.1. Mục tiêu
Tận dụng schema `LeadRequest`, `LeadPoolConfig`, `LeadPoolDistribution`, `LeadPoolBonusQuota` đã có sẵn (hiện chỉ dùng nội bộ cho cơ chế "xin lead quên/forgotten" — xem comment `source: 'forgotten' | 'customer_list' | 'external_sync'` trong schema) để xây UI "Bốc lead chủ động" kiểu TheLab: badge `(đã nhận/quota)` + nút claim.

**Quan trọng:** Đây không phải viết lại y hệt bundle EE gốc (không có quyền truy cập code đó) — mà là thiết kế lại luồng claim đơn giản hơn, phù hợp schema hiện có.

**Quyết định phạm vi (đã chốt):** dùng chung 1 hệ khái niệm quota với `LeadPoolConfig` hiện có, KHÔNG tạo bảng song song — vì cùng là "quota số lead sale được nhận/ngày", tách riêng sẽ gây 2 con số quota khác nhau trên UI (rất dễ gây nhầm lẫn cho sale: "sao badge với nút claim lệch số nhau?"). Cách làm: mở rộng enum `source` sẵn có (`'forgotten' | 'customer_list' | 'external_sync'`) thêm giá trị `'new_inbound'` — đại diện cho lead mới về pool nói chung (từ Facebook/Landing Page/Excel import, tức các nguồn ở Phase khác của tài liệu TheLab), tái dùng nguyên vẹn `maxRequestsPerDay`, `cooldownMinutes`, `excludedStatuses`, `requirePhoneInPool`, `forceNoteBeforeNext`, `noteMinLength`, `greetingTemplates` đã có. Badge `(0/15)` trên sidebar = tổng `claimed`/`maxRequestsPerDay` không phân biệt nguồn — đúng 1 con số duy nhất, khớp với `LeadRequest`/`LeadPoolDistribution` đang đếm.

**Quan trọng — 3 khái niệm "nguồn" KHÔNG được nhầm lẫn với nhau (đã đọc code xác nhận, không phải 2 như nghĩ ban đầu):**

| Tầng | Field | Model | Ý nghĩa | Giá trị thực tế | Trạng thái |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Nguồn **kênh quảng cáo cấp lead** (đã có, giữ nguyên) | `sourceMeta.source` | `CustomerListEntry` | Lead này thuộc chiến dịch Lead Ads nào — dùng để hiện badge/filter kiểu "📘 Facebook: 30 khách" như TheLab mô tả | `'fb-leadads' \| 'tiktok-leadgen' \| 'zalo-ads' \| 'google-leadform'` — render qua `frontend/src/lib/source-badge.ts` (đã có sẵn `sourceBadge()`, `SOURCE_FILTER_OPTIONS`) | **Đã đầy đủ, tái dùng nguyên trạng, KHÔNG viết badge/màu mới** |
| Nguồn **cấp Contact** (đã có, giữ nguyên) | `Contact.source` | `Contact` | Free-text gắn trực tiếp lên contact khi tạo (có thể khác giá trị với `sourceMeta.source` vì lịch sử field cũ hơn — cần verify thực tế 2 field này đồng bộ nhau chưa) | Free-text: `"FB"`, `"TT"`, `"phone_import"`, ... | **Giữ nguyên — nhưng cần kiểm chứng quan hệ với `sourceMeta.source` trước khi code UI claim, đừng giả định 2 field luôn khớp nhau** |
| Nguồn **phân phối pool** (Phase 2 mở rộng) | `LeadPoolDistribution.source` / `LeadRequest.source` | `LeadPoolDistribution`, `LeadRequest` | Lead này tới tay sale QUA CƠ CHẾ nào — dùng để tính quota/cooldown, KHÔNG liên quan tới quảng cáo nào | `'forgotten' \| 'customer_list' \| 'external_sync' \| 'new_inbound'` (mới) | Mở rộng thêm 1 giá trị |

Nói cách khác: một lead Facebook Ads (`CustomerListEntry.sourceMeta.source = 'fb-leadads'`) khi vào pool và được sale bốc, sẽ có `LeadPoolDistribution.source = 'new_inbound'` — các field này **cùng tồn tại trên các model khác nhau**, không ghi đè lên nhau. Việc gộp `'new_inbound'` chỉ đơn giản hoá tầng phân phối (không cần tách quota theo "Facebook vs Landing Page vs Excel"), **KHÔNG làm mất khả năng hiển thị/lọc theo kênh quảng cáo gốc** — UI claim vẫn đọc `sourceMeta.source`/`Contact.source` bình thường để hiện badge/tag nguồn như TheLab (`GET /api/v1/lead-pool/claim` response nên trả kèm nguyên field nguồn gốc của contact/list-entry để FE hiển thị nhãn kênh ngay khi claim thành công — **xác định chính xác nên lấy từ `CustomerListEntry` hay `Contact` bằng cách đọc `contact-routes.ts`/`list-entry-routes.ts` trước khi code**, vì pool có thể gồm cả lead không thuộc `CustomerList` nào — vd `LeadRequest.source = 'forgotten'`).

### 2.2. Backend

**Bắt buộc trước khi code:** đọc toàn bộ usages hiện tại bằng `grep -rn "LeadPoolConfig\|LeadRequest\|LeadPoolDistribution" backend/src` — vì quota giờ dùng chung, mọi thay đổi ở service tính quota ảnh hưởng cả luồng forgotten-lead đang chạy production. Không được sửa hành vi cũ, chỉ mở rộng.

Module mới `backend/src/modules/lead-pool-claim/` (route/UI cho luồng claim chủ động — nhưng SERVICE tính quota nên đặt cạnh/tái dùng code forgotten-lead hiện có nếu tìm thấy, để tránh 2 nơi tính `claimed` khác công thức nhau):

- Migration nhỏ: thêm `'new_inbound'` vào danh sách giá trị hợp lệ của `LeadRequest.source` / `LeadPoolDistribution.source` (đây là cột `String` tự do, không phải enum DB — chỉ cần cập nhật validation ở code, không cần migration schema).
- `claim-quota-service.ts`:
  - `getTodayQuotaStatus(orgId, userId)` → `{ claimed: number, max: number, bonusApplied: number }`. Đếm **toàn bộ** `LeadPoolDistribution` theo `assignedToUserId` + `distributedAt` trong ngày VN (không lọc theo `source`, vì quota dùng chung), cộng `LeadPoolConfig.maxRequestsPerDay` + `SUM(LeadPoolBonusQuota.bonusCount WHERE dateKey=today)`.
  - `claimNextLead(orgId, userId)` → transaction: kiểm tra quota còn (dùng chung hàm ở trên), `SELECT ... FOR UPDATE SKIP LOCKED` 1 contact đủ điều kiện pool nguồn `'new_inbound'` (theo `excludedStatuses`, `requirePhoneInPool`, `sourceListIds`), gán `assignedUserId`, ghi `LeadPoolDistribution` với `source='new_inbound'` (round = increment dùng chung counter với các source khác), ghi `ActivityLog`.
- `claim-quota-routes.ts`:
  - `GET /api/v1/lead-pool/quota` — trả về status cho badge realtime.
  - `POST /api/v1/lead-pool/claim` — bốc 1 lead nguồn `new_inbound`, trả lỗi rõ ràng khi hết quota/pool rỗng.

### 2.3. Frontend

**Sửa nhầm lẫn về layout:** ZaloCRM dùng **top nav ngang** (`DefaultLayout.vue` → `smax-topnav`, 7 tab + dropdown "Báo cáo"/"Cài đặt"), KHÔNG có sidebar dọc toàn cục kiểu TheLab CRM. "Sidebar" duy nhất tồn tại là **sidebar cục bộ của riêng trang Chat** (`ConversationFilterSidebar.vue`, cột 1 bên trái danh sách hội thoại) — đây chính xác là nơi bản gốc EE gắn `LeadFloatingButton` (xem `ConversationFilterSidebar.vue:33,422`, comment "Nhận khách" icon hộp quà pulse, collapsed = chỉ icon 44×44). Plan Phase 2 sẽ bám theo đúng vị trí này thay vì bịa ra sidebar mới.

- Composable `use-lead-pool-claim.ts`: poll nhẹ (hoặc lắng socket event mới `lead_pool:claimed` phát qua `zalo-socket.ts`/`bridge-bus.ts` để cập nhật badge realtime cho các sale khác khi pool đổi).
- Component mới `frontend/src/components/lead-pool/LeadPoolClaimButton.vue` (viết mới, KHÔNG sửa file trong `_ee-stubs/`) — API props tương thích `inline` giống stub cũ, để có thể gắn vào đúng 2 vị trí đã có sẵn trong `ConversationFilterSidebar.vue` (dòng 33 — expanded, dòng 422 — collapsed) bằng cách đổi import từ `@ee/lead-pool/components/LeadFloatingButton.vue` sang component mới. Đây là nơi DUY NHẤT cần nút claim — không cần thêm nút nổi (floating) toàn cục.
- Badge `(0/15)` gắn ngay trên icon "hộp quà" đó (compact, dạng số nhỏ góc icon khi collapsed — giống cách `NotificationBell.vue` hiện hiện số chưa đọc), và dạng đầy đủ "Đã nhận 3/15" trong card khi expanded. KHÔNG thêm mục nav mới lên top nav (top nav 7 tab đã đầy, không có khái niệm tab "Dữ liệu" như TheLab) — pool chỉ có ý nghĩa trong ngữ cảnh đang thao tác Chat.
- **Hiển thị theo kênh quảng cáo gốc (KHÔNG phải `LeadPoolDistribution.source`):** thẻ lead sau khi claim hiện badge nguồn ("📘 Facebook", "🎵 TikTok"...) — tái dùng nguyên `sourceBadge()` từ `frontend/src/lib/source-badge.ts` (đã dùng cho `ListsView.vue`/`ListDetailView.vue`), KHÔNG viết badge/màu mới. Backend route `GET /api/v1/lead-pool/claim` cần trả kèm field nguồn đúng theo bảng đối chiếu ở mục 2.1 để FE map qua `sourceBadge()` được ngay. Dải thẻ đếm theo nguồn kiểu TheLab ("Facebook: 30", "TikTok: 12") phù hợp hơn ở trang riêng `LeadPoolView.vue` (nếu Phase 2 mở rộng thêm màn xem toàn bộ pool) chứ không nhồi vào sidebar Chat vốn đã chật.

### 2.4. Rủi ro & lưu ý
- **Race condition:** bắt buộc dùng `FOR UPDATE SKIP LOCKED` hoặc tương đương Prisma transaction (`$transaction` với raw SQL nếu Prisma client API không hỗ trợ trực tiếp) — nhiều sale bấm claim cùng lúc không được nhận trùng 1 lead. Tài liệu TheLab đã có sẵn mẫu SQL đúng hướng này (`thelab_crm_data_extraction_guide.md` mục 6A).
- **Quota dùng chung là con dao 2 lưỡi:** vì `'new_inbound'` cộng chung quota với `'forgotten'`/`'customer_list'`, một sale bốc nhiều lead mới sẽ tiêu hết quota xin-lại-lead-quên trong ngày (và ngược lại). Đây là hành vi CHỦ ĐÍCH theo quyết định "1 con số duy nhất" — nếu về sau nghiệp vụ muốn quota riêng cho từng nhóm nguồn, cần bàn lại (không tự ý tách khi code Phase 2).
- Đây là phase rủi ro/công sức cao nhất — khuyến nghị làm sau khi Phase 1 và 3 đã ổn định để có thêm hiểu biết về codebase.

---

## PHASE 3: THAO TÁC NHANH & QUICK TAGS

### 3.1. Mục tiêu
3 cải tiến UI nhỏ, giá trị cao, rủi ro thấp — nên làm trước.

### 3.2. Quick Note Tags (1 chạm)

- Thêm field `quickTags: Json @default("[])` vào `CrmTagGroup` hoặc đơn giản hơn: thêm bảng nhỏ mới:

```prisma
model QuickNoteTag {
  id        String   @id @default(uuid())
  orgId     String   @map("org_id")
  label     String   // "Thuê bao", "Không bắt máy", "Đang bận", "Hẹn tối"
  order     Int      @default(0)
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")

  org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@index([orgId, isActive, order])
  @@map("quick_note_tags")
}
```

- Backend: CRUD đơn giản trong `backend/src/modules/tags/` (cạnh `tag-routes.ts`), seed default 6-8 tag phổ biến theo mẫu TheLab khi tạo org mới (xem `rbac/seed-default-groups.ts` làm mẫu cách seed theo org).
- Frontend: trong `NotesSection.vue`/`NoteRow.vue`, thêm hàng chip nhỏ phía trên textarea ghi chú — bấm chip = append text vào note, không cần gõ. Composable `use-quick-note-tags.ts` theo mẫu `use-crm-tag-defs.ts`.

### 3.3. Widget "Nhắc nhở hôm nay" nâng cấp

- Sửa `DashboardView.vue:190-231` (nhóm hiện tại: Quá hạn/Hôm nay/Ngày mai/Sinh nhật) — thêm nhóm phụ theo trạng thái khách (Mới/Đã nạp/Đăng ký) TRÊN CÙNG dữ liệu đã fetch, không cần API mới nếu response đã có `contact.status`.
- Thêm cụm nút thao tác nhanh (Copy SĐT / `tel:` / Zalo `zalo.me/` / Telegram `t.me/`) ngay trong từng dòng — tái dùng markup/handlers đã có ở `LeadDetailPanel.vue:19` (`<a class="ldp-phone-btn call" :href="tel:...">`, thẻ `<a>` thật) và `FriendsView.vue` hàm `onCall()` (dòng ~439, **KHÔNG phải thẻ `<a href>`** mà là `window.location.href = 'tel:${f.contact.phone}'` — 2 nơi cùng ý nghĩa deep-link `tel:` nhưng khác cơ chế implement, cần viết `QuickContactActions.vue` hỗ trợ CẢ 2 kiểu gọi (anchor href và programmatic navigation) khi factor ra component dùng chung, không giả định 1 kiểu duy nhất).

### 3.4. Mẫu tin nhắn theo kịch bản

- KHÔNG cần model mới — `MessageTemplate.category` đã là free-text, `contentRich` đã hỗ trợ styles. Chỉ cần:
  1. Seed thêm `category` chuẩn hoá: `"greeting"`, `"deposit_link"`, `"follow_up"` khi tạo org mới (giống cách `rbac/seed-default-groups.ts` seed RBAC).
  2. Thêm renderer placeholder `{ten_kh}`, `{ac}`, `{anh_chi}` vào `template-renderer.ts` (`backend/src/shared/templating/`) nếu chưa hỗ trợ — kiểm tra file này trước, khả năng cao logic tương tự đã tồn tại vì `LeadPoolConfig.greetingTemplates` đã dùng đúng các placeholder này (`schema.prisma:3376-3383`), nghĩa là engine render có thể đã có sẵn ở đâu đó trong `_ee` (không truy cập được) — nên **viết bản đơn giản hoá trong core** dựa theo tên field đã biết, không cần đoán logic gốc.
  3. Frontend: filter theo `category` trong `quick-template-popup.vue` để sale chọn nhanh đúng nhóm kịch bản.

### 3.5. Lưu ý
- Toàn bộ Phase 3 tái sử dụng component/pattern có sẵn — ưu tiên grep trước khi viết mới (`grep -rn "zalo.me\|t.me/" frontend/src` để tìm chỗ đã có deep-link, tránh trùng lặp).

---

## PHASE 4: CẤU HÌNH CÁ NHÂN HOÁ

### 4.1. Night Priority Mode

- Dùng `AppSetting` (key-value có sẵn, KHÔNG cần model mới): `settingKey = "night_priority_mode:{userId}"`, `valuePlain = "on"/"off"`.
- Backend: `PATCH /api/v1/users/me/night-priority` toggle, đọc trong `claim-quota-service.ts` (Phase 2) để ưu tiên user có `night_priority_mode=on` khi ngoài giờ hành chính (so `Date` hiện tại với `ShiftSchedule` ca đêm từ Phase 1 — 2 phase này liên kết tự nhiên, nên làm Night Mode SAU Phase 1+2).
- Frontend: KHÔNG có sidebar toàn cục trong layout (ZaloCRM dùng top nav ngang — xem ghi chú layout ở mục 2.3) nên đặt nút gạt trong `PersonalAccountPage.vue` (Cài đặt cá nhân), cùng khu vực với 4.2 bên dưới. Nếu muốn nổi bật hơn (vì Night Mode cần bật/tắt nhanh theo ca, không phải setting "set rồi quên"), có thể thêm 1 icon-btn nhỏ trên top nav (`smax-topnav`, cạnh `NotificationBell`) — nhưng đây là bổ sung UI, cần xác nhận với người dùng trước vì top nav hiện đã khá đầy (7 tab + 2 dropdown + search + 2 icon-btn).

### 4.2. Cấu hình tổng đài / phương thức gọi

- Cũng dùng `AppSetting`: `settingKey = "dialer_preference:{userId}"`, value là JSON `{"method": "tel" | "zoiper" | "custom", "customUriScheme": "..."}`.
- Backend: route nhỏ đọc/ghi qua `user-preference-routes.ts` đã có sẵn cơ chế tương tự (`UserPreference` model) — **ưu tiên dùng `UserPreference` thay vì `AppSetting`** vì đây là setting theo user, không theo org; đọc `auth/user-preference-routes.ts` trước khi code để bám đúng convention.
- Frontend: thêm field trong `PersonalAccountPage.vue`, và sửa các nơi hardcode `<a href="tel:...">` (`LeadDetailPanel.vue:19`, `FriendsView.vue:439`) để đọc preference — nếu method='zoiper' dùng URI scheme khác (`zoiper://...`) thay vì `tel:`. Factor thành composable `use-dialer.ts` trả về hàm `buildCallHref(phone)` dùng chung mọi nơi.

---

## PHASE 5: BÁO CÁO KPI 30 NGÀY

### 5.1. Mục tiêu
Biểu đồ cột lịch sử KPI 30 ngày (Đạt/Chưa đạt/Không có dữ liệu) + thống kê tổng hợp, như TheLab.

### 5.2. Định nghĩa "đạt KPI/ngày" (đã chốt — phương án đơn giản nhất)

Hệ thống hiện tại **không có khái niệm target/quota ngày** ở bất kỳ đâu (đã grep xác nhận: không có field `target`/`quota`/`goal` nào mang nghĩa "chỉ tiêu" trong schema, khác `kpi_records` giả định trong tài liệu TheLab). Đây là khái niệm phải tạo mới — đề xuất phương án nhẹ nhất, không cần UI cấu hình phức tạp ở bản đầu:

- Thêm 1 field `dailyTaskTarget Int @default(10) @map("daily_task_target")` vào `Organization` (KHÔNG phải per-user/per-team — admin set 1 số chung cho cả org, giống cách `LeadPoolConfig.maxRequestsPerDay` đang set chung). Đây là "số task/ngày" tổng quát (tương ứng khái niệm "Trung bình task/ngày" mà TheLab hiển thị), không tách nhỏ theo từng chỉ tiêu con (tìm mới/nạp/đăng ký) — tránh phải thiết kế lại cả hệ target đa chiều chỉ để tô màu 1 biểu đồ.
- **[ĐÃ VERIFY — SỬA LẠI]** "Task hoàn thành trong ngày" KHÔNG THỂ đếm bằng `ActivityLog.category = 'status_care'` như bản nháp đầu — đã đọc `backend/src/modules/activity/action-types.ts:16` và xác nhận `status_care` chỉ map đúng 1 action (`status_change` — đổi trạng thái chăm sóc khách), không mang nghĩa "hoàn thành task" nói chung. Không có category nào tên "task completed" trong hệ thống hiện tại; category gần nghĩa nhất là `interaction` (gồm `call_logged`, `meeting_logged`...). **Trước khi code Phase 5, phải đọc toàn bộ danh sách category trong `action-types.ts` và quyết định 1 trong 2 hướng:** (a) định nghĩa "task" = tổng nhiều category cộng lại (`interaction` + `status_care` + ghi chú...) — cần liệt kê chính xác danh sách category nào tính là "task" theo góc nhìn nghiệp vụ, không tự suy diễn; (b) đợi Phase 1 xong rồi dùng `ShiftReport.metrics` (số liệu snapshot tự khai báo, rõ ràng hơn nhưng lại phụ thuộc Phase 1 như đánh giá ban đầu). **Đây là điểm cần hỏi lại người dùng trước khi code**, không phải quyết định kỹ thuật đơn thuần.
- Quy tắc tô màu cột: `count >= dailyTaskTarget` → xanh (Đạt KPI); `count > 0 && count < dailyTaskTarget` → đỏ/vàng (Chưa đạt); `count == 0` (và ngày đó user chưa từng login/không có activity) → xám (Không có dữ liệu).
- **Vì đây là số do hệ thống tự đặt (default 10), không phải số nghiệp vụ thật** — cần cho admin sửa được qua 1 ô input đơn giản trong `OrgSettings.vue` (đã tồn tại), không cần màn hình cấu hình riêng.

### 5.3. Backend

- Thêm migration nhỏ: field `dailyTaskTarget` trên `Organization`.
- Endpoint mới trong `report-analytics-routes.ts` (đã tồn tại, xem file này trước): `GET /api/v1/reports/kpi-history?userId=&days=30` — group `ActivityLog` theo ngày VN trong N ngày gần nhất, so đếm với `org.dailyTaskTarget`, trả về mảng `{ date, count, achieved: boolean }` + số liệu tổng hợp (trung bình/ngày, số ngày đạt, % xu hướng so với kỳ trước = so sánh trung bình 15 ngày đầu vs 15 ngày sau trong cửa sổ 30 ngày).

### 5.4. Frontend

- Component mới `frontend/src/components/dashboard/KpiHistoryChart.vue` theo mẫu `MessageVolumeChart.vue`/`AppointmentChart.vue` (đều đã là biểu đồ cột theo ngày — tái dùng thư viện chart đang dùng, không thêm dependency mới).
- Card thống kê phụ (trung bình task/ngày, số ngày đạt, % xu hướng) tính client-side từ response, giống cách `KpiCards.vue` hiện đang tổng hợp số liệu.
- Ô input `dailyTaskTarget` thêm vào `OrgSettings.vue` (chỉ admin/owner sửa).

### 5.5. Lưu ý
- **[SỬA LẠI SAU VERIFY]** Phụ thuộc Phase 1 hay không **chưa chốt được** — phụ thuộc vào việc chọn hướng (a) hay (b) ở mục 5.2. Nếu chọn (a) (đếm qua tổ hợp `ActivityLog.category`) thì độc lập Phase 1 nhưng cần xác nhận nghiệp vụ trước; nếu chọn (b) (`ShiftReport.metrics`) thì bắt buộc làm sau Phase 1. Không giả định "độc lập" như bản nháp trước — bản đó dựa trên category `status_care` bị hiểu sai nghĩa.
- Con số `dailyTaskTarget = 10` là giá trị mặc định kỹ thuật, không phải số nghiệp vụ đã được xác nhận — cần treo cảnh báo nhẹ trên UI admin (vd tooltip "Điều chỉnh theo thực tế đội nhóm") để tránh admin hiểu nhầm đây là chỉ tiêu chính thức từ nơi khác.

---

## THỨ TỰ THỰC HIỆN ĐỀ XUẤT

1. **Phase 3** (Quick tags, widget nhắc nhở, mẫu tin) — thấp rủi ro, tái dùng nhiều, thấy giá trị ngay.
2. **Phase 5** (KPI 30 ngày) — **[CẦN CHỐT LẠI]** phụ thuộc Phase 1 hay không tùy thuộc câu trả lời cho câu hỏi nghiệp vụ mới ở mục 5.2 (định nghĩa "task hoàn thành" — bản nháp trước dùng category `status_care` đã bị verify là SAI nghĩa). Tạm xếp sau Phase 3, trước Phase 1, nhưng có thể phải dời sau Phase 1 nếu chọn hướng dùng `ShiftReport.metrics`.
3. **Phase 1** (Ca làm việc & báo cáo ca) — model mới độc lập, không đụng luồng nghiệp vụ hiện có, cấu hình chung toàn org nên đơn giản.
4. **Phase 4** (Night mode, dialer config) — nhỏ, nhưng Night Mode nên làm sau Phase 1 vì cần `ShiftSchedule`.
5. **Phase 2** (Data Pool claim UI) — rủi ro cao nhất (race condition, quota dùng chung với luồng forgotten-lead hiện có), cần review kỹ trước khi bắt đầu, làm sau cùng.

## TIẾN ĐỘ TRIỂN KHAI

- **Phase 1 (Ca làm việc & Báo cáo ca): ĐÃ CODE XONG (2026-08-21).** Schema `ShiftSchedule`/`ShiftReport` (migration `20260821040857_add_shift_schedule_and_report`), module `backend/src/modules/shift/` (schedule-service, schedule-routes, report-routes, đăng ký trong `app.ts` prefix `/api/v1/shifts/*`), frontend `use-shift-report.ts` + `ShiftDeadlineWidget.vue` (gắn `DashboardView.vue`) + `ShiftReportFormDialog.vue` + `ShiftHistoryReport.vue` (tab "Báo cáo ca" trong `/reports/shift-history`). Typecheck backend+frontend sạch, server boot thử OK.
- **Phase 5 (Báo cáo KPI 30 ngày): ĐÃ CODE XONG (2026-08-21).** Làm trước Phase 3/1/4/2 theo thứ tự thực tế vì được yêu cầu ngay sau Phase 3 — xem quyết định nghiệp vụ bên dưới. Schema `Organization.dailyTaskTarget` (migration `20260821041841_add_daily_task_target`), endpoint `GET /api/v1/reports/kpi-history` (trong `report-analytics-routes.ts`), `PUT /api/v1/organization` mở rộng nhận `dailyTaskTarget`. Frontend `KpiHistoryChart.vue` (gắn vào `ShiftHistoryReport.vue`, không tạo trang riêng) + ô input `dailyTaskTarget` trong `OrgSettings.vue`.
- **Phase 4 (Cấu hình cá nhân hoá): ĐÃ CODE XONG (2026-08-21).** Đã xác nhận với người dùng: Night Mode toggle CHỈ đặt trong Cài đặt cá nhân, không thêm icon-btn top nav. Không cần route backend mới — dùng `UserPreference` có sẵn (`user-preference-routes.ts`). Frontend: `use-user-preference.ts` (wrapper GET/PUT preferences), `use-dialer.ts` (buildCallHref/triggerCall đọc pref `dialer.method`), card "Cài đặt cá nhân" mới trong `PersonalAccountPage.vue` (toggle Night Priority Mode lưu key `night-mode.enabled`, chọn phương thức gọi mặc định/tuỳ chỉnh). Đã sửa 2 nơi hardcode `tel:` sang dùng `useDialer()`: `LeadDetailPanel.vue` (2 chỗ) và `FriendsView.vue` (`onCall()`). Frontend typecheck (`vue-tsc -b`) sạch. Chưa code logic đọc `night-mode.enabled` để ưu tiên claim lead — việc đó thuộc Phase 2.
- **Phase 2 (Data Pool tự phục vụ): ĐÃ CODE XONG (2026-08-21).** Quyết định nghiệp vụ chốt trong phiên code: (a) badge nguồn khi claim dùng `Contact.source` (KHÔNG dùng `sourceMeta.source` như bản nháp gốc — field đó không tồn tại trên `CustomerListEntry`); (b) khớp `excludedStatuses` dùng `Status.name` qua `Contact.statusId` (KHÔNG dùng `Contact.status` legacy). Đã phát hiện + fix `LeadPoolDistribution` thiếu trong `ORG_SCOPED_MODELS` (`backend/src/shared/tenant/org-scoped-models.ts`) — tenant-guard trước đó bỏ qua hoàn toàn model này. Backend: module `backend/src/modules/lead-pool-claim/` (`claim-quota-service.ts` — `getTodayQuotaStatus`, `claimNextLead` dùng `SELECT ... FOR UPDATE SKIP LOCKED` theo mẫu `webhook-log.service.ts:pickPending()`, tái dùng thứ tự FIFO có sẵn `pooled_count ASC, last_pooled_at ASC NULLS FIRST`; `claim-quota-routes.ts` — `GET/POST /api/v1/lead-pool/{quota,claim}`), đăng ký trong `app.ts`. Emit socket `lead_pool:claimed` qua `io.to('org:${orgId}')` (không bare `io.emit`). Frontend: `use-lead-pool-claim.ts` (quota + claim + lắng socket), `LeadPoolClaimButton.vue` (thay `@ee/lead-pool/components/LeadFloatingButton.vue` trong `ConversationFilterSidebar.vue`, giữ đúng class contract `.lfb-*` cho CSS `:deep()` có sẵn hoạt động ở chế độ collapsed). Typecheck backend + frontend sạch (không phát sinh lỗi mới). Chưa test tay race-condition/quota thật với DB — xem mục Verification trong plan chi tiết.

## QUYẾT ĐỊNH NGHIỆP VỤ ĐÃ CHỐT (2026-08-21)

- **Định nghĩa "đạt KPI/ngày" (Phase 5) — ĐÃ CHỐT VÀ CODE:** nguồn đếm "task hoàn thành/ngày" = **`ShiftReport.metrics.newLeads + ShiftReport.metrics.sent`**, cộng dồn nếu 1 user nộp nhiều báo cáo ca trong cùng 1 ngày (`reportDateVN`). So với `Organization.dailyTaskTarget` (default 10, admin sửa trong `OrgSettings.vue`) để tô Đạt/Chưa đạt/Không có dữ liệu (xám = ngày không có `ShiftReport` nào). Hệ quả quan trọng: **Phase 5 phụ thuộc cứng vào Phase 1** (không còn phương án "độc lập qua ActivityLog.category" như bản nháp đầu) — vì `ShiftReport` chỉ tồn tại khi sale nộp báo cáo ca, số liệu KPI lịch sử sẽ trống cho tới khi Phase 1 đi vào dùng thực tế.
- **Phạm vi cấu hình ca (Phase 1) — ĐÃ CHỐT VÀ CODE:** chung toàn org — phương án đơn giản nhất, không phân theo team/user. Xem chi tiết mục 1.2.
- **Phạm vi quota claim (Phase 2) — ĐÃ CHỐT, CHƯA CODE:** dùng CHUNG 1 quota với `LeadPoolConfig` hiện có (không tách bảng song song) — mở rộng `source` thêm giá trị `'new_inbound'`, badge `(0/15)` là tổng không phân biệt nguồn. Xem chi tiết mục 2.1.

## CẦN VERIFY/HỎI LẠI THÊM (phát hiện sau lượt rà soát toàn plan 2026-08-21)

Toàn bộ plan đã được 1 agent đọc code thật để verify từng khẳng định cụ thể (tên file, field, vị trí UI) — không chỉ suy luận từ tên biến. Các mục dưới là những gì cần xử lý tiếp:

- [ ] **Phase 5 — nguồn đếm "task hoàn thành":** category `ActivityLog.category = 'status_care'` KHÔNG mang nghĩa "task hoàn thành" (chỉ map action đổi trạng thái chăm sóc — xác nhận tại `backend/src/modules/activity/action-types.ts:16`). Cần đọc toàn bộ danh sách category trong file đó, xác nhận với nghiệp vụ category nào (hoặc tổ hợp category nào) hợp lý để tính "1 task", rồi mới code Phase 5. Xem chi tiết mục 5.2.
- [x] **Phase 3 — `FriendsView.vue` cách gọi điện:** đã sửa mục 3.3 — `FriendsView.vue` gọi `tel:` qua `window.location.href` (hàm `onCall()`), không phải thẻ `<a href>` như `LeadDetailPanel.vue`. `QuickContactActions.vue` cần hỗ trợ cả 2 kiểu.
- [ ] **Phase 2 — nguồn field hiển thị badge kênh:** field `sourceMeta.source` (`CustomerListEntry`) tồn tại đúng tên, nhưng danh sách giá trị cụ thể (`'fb-leadads' | 'tiktok-leadgen' | ...`) chỉ thấy rõ trong `frontend/src/lib/source-badge.ts`, KHÔNG có comment liệt kê ngay tại field trong `schema.prisma`. Khi code, đọc `source-badge.ts` làm nguồn sự thật cho danh sách giá trị hợp lệ, không suy diễn từ schema.

Các mục còn lại trong plan (Phase 1 RBAC/routes, Phase 2 race-condition pattern, Phase 3 template placeholder, Phase 4 UserPreference, layout top-nav vs sidebar Chat) đã được verify khớp với code thật tại các vị trí trích dẫn trong từng mục — không cần double-check lại trừ khi code thực tế đã đổi kể từ ngày rà soát.
