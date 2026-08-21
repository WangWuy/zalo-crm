# TÀI LIỆU TỔNG HỢP TOÀN BỘ TÍNH NĂNG THELAB CRM
> **Nguồn trích xuất:** Phân tích giao diện thực tế (3 ảnh mẫu) kết hợp suy luận nghiệp vụ chuyên sâu và giải pháp kỹ thuật thực chiến của hệ thống Telesale / CSKH TheLab CRM.

---

## 1. TỔNG QUAN HỆ THỐNG
* **Mục tiêu:** Hệ thống CRM & Quản lý hiệu suất chuyên biệt dành cho đội ngũ Telesale / CSKH / Chăm sóc khách hàng phễu Sàn.
* **Mô hình vận hành cốt lõi:**
  * **Thu thập Lead đa nguồn:** Tiếp nhận tự động từ Facebook/ManyChat, Form Landing Page (Vertex Insights), hoặc Import file Excel vào Kho dùng chung (Data Pool).
  * **Phân bổ & Hạn mức (Quota Engine):** Cấp phát hạn mức nhận data linh hoạt cho từng Sale theo ngày/ca (*vd: hạn mức 0/15 lead*).
  * **Tương tác Đa kênh Tinh gọn (Zero-Cost / Native):** Hỗ trợ Sale thao tác nhanh qua Click-to-call (`tel:`), Chat Zalo (`zalo.me/`), Telegram (`t.me/`) và xem nhúng Lịch sử Chat Facebook.
  * **Đo lường KPI & Tiến độ Realtime:** Tự động nhảy điểm KPI nạp/đăng ký thông qua Webhook kết nối Sàn Core, đếm ngược hạn nộp báo cáo ca (*Deadline báo cáo: 15m*), và xử lý tranh chấp SĐT trùng.

---

## 2. CHI TIẾT CÁC PHÂN HỆ & MÀN HÌNH CHÍNH

### 2.1. Module Bảng điều khiển (Dashboard - Quản lý hiệu suất)
Màn hình tổng quan giúp nhân viên Sale và Quản lý theo dõi toàn bộ chỉ số công việc và tiến độ ca làm việc.

* **Thanh Header & Chỉ số ca làm việc:**
  * **Thông tin cá nhân & Đội nhóm:** Hiển thị tên nhân viên (*3 - Chloe - Sale*), số thành viên trong nhóm (*Tộp 3F • 11 thành viên* - bấm vào để xem bảng xếp hạng KPI đội).
  * **Tổng khách hàng:** Hiển thị tổng số data Sale đang quản lý (*88 khách hàng* - bấm vào để chuyển nhanh sang danh sách).
  * **Đồng hồ ca & Đếm ngược Deadline:** Đồng hồ thời gian thực và widget đếm ngược nộp báo cáo (*Deadline báo cáo: 15m* - bấm vào để mở Form nộp Báo cáo ca/ngày gửi Leader).
* **Theo dõi Tiến độ KPI trong ngày:**
  * **Thanh tiến độ tổng (% hoàn thành):** Tỷ lệ hoàn thành tổng nhiệm vụ trong ngày (vd: *24% hoàn thành*).
  * **Phân rã chỉ tiêu chi tiết:**
    * *Tìm mới:* Tiến độ tìm kiếm / khai thác khách mới (vd: 9/10 - 90%).
    * *KH nạp:* Tiến độ chuyển đổi khách nạp tiền/ký quỹ lần đầu (vd: 6/20 - 30%).
    * *KH ĐK:* Tiến độ khách hoàn tất đăng ký tài khoản sàn (vd: 4/20 - 20%).
    * *Ngưng GD:* Khách ngưng giao dịch cần tương tác lại (vd: 0/20).
    * *Hẹn gọi lại:* Số lượng cuộc gọi chăm sóc lại theo lịch hẹn (vd: 0/10).
* **Biểu đồ phân tích:**
  * **Biểu đồ tròn (Pie Chart) Khách hàng:** Trực quan hóa tỷ trọng phân bổ trạng thái (Khách mới 44, KH đã nạp 7, KH đăng ký 20, Hẹn gọi lại 17, Ngưng GD 0).
  * **Biểu đồ cột Lịch sử KPI 30 ngày:** Theo dõi lịch sử hoàn thành KPI 30 ngày gần nhất (Đạt KPI / Chưa đạt / Không có dữ liệu), thống kê Trung bình task/ngày (vd: 60), số ngày đạt KPI (vd: 11 ngày), tỷ lệ xu hướng tăng/giảm (vd: -19%).
* **Các Widget tác vụ nhanh:**
  * **Nhắc nhở hôm nay:** Danh sách khách hàng đến hạn cần liên hệ trong ngày, phân loại theo nhóm (*Đã nạp, Đăng ký, Mới*), kèm nút thao tác nhanh (Copy SĐT, Gọi điện, Telegram, Zalo).
  * **Kế hoạch tương tác hôm nay:** Danh sách checklist tương tác kèm checkbox đánh dấu hoàn thành (vd: *0/10 khách đã liên hệ*).
  * **Hoạt động gần đây:** Feed nhật ký tương tác gần nhất theo dòng thời gian (ghi nhận thời gian, trạng thái KH, trích đoạn ghi chú chăm sóc).

---

### 2.2. Module Tasks & Khách hàng (Việc cần làm & Quản lý danh sách)
Màn hình trung tâm để nhân viên Sale xử lý công việc hàng ngày, lọc và chăm sóc danh sách khách hàng.

* **Thanh công cụ đầu trang (Header Actions):**
  * **Bộ chọn ngày (`📅 13/08/2026`):** Xem lại việc cần làm của các ngày trước hoặc lên kế hoạch tương tác cho ngày tiếp theo.
  * **Nút `+ Thêm KH nhanh`:** Modal popup thêm nhanh 1 khách hàng vãng lai/tự khai thác (Tên, SĐT, Nguồn, Trạng thái ban đầu).
  * **Chỉ số Tiến độ KPI ngày:** Hiển thị tỷ lệ và số lượng task đã đạt trên tổng mục tiêu (vd: *23.8% - 19/80*).
* **Thanh thẻ phân loại nguồn & Trạng thái Task:**
  * **Thẻ Nguồn Lead Facebook:** Đếm số lượng khách đổ về từ *Facebook/ManyChat* (vd: 30 khách).
  * **Các thẻ Trạng thái (Phân tách Trực tiếp vs Chăm sóc):** *Khách Mới*, *Khách Đã Nạp*, *Khách Đăng Ký*, *Khách Ngưng GD*, *Khách Hẹn Gọi Lại* (thể hiện rõ số khách tự nhận trực tiếp và số khách chăm sóc định kỳ).
* **Bộ lọc & Danh sách Khách hàng:**
  * **Tab phân loại:** Tất cả (88), Khách Mới (44), Khách Đã Nạp (7), Khách Đăng Ký (20), Khách Ngưng GD (0), Hẹn Gọi Lại (17), Khách từ Facebook (30).
  * **Công cụ lọc nâng cao:** *Chọn khoảng ngày*, Sắp xếp theo *Liên hệ gần nhất*, Ô tìm kiếm đa năng (*SĐT, tên, UID khách hàng*).
  * **Thao tác nhanh trên từng dòng khách hàng:**
    * 📋 Checkbox hoàn thành tương tác nhanh.
    * 📄 Copy nhanh số điện thoại (1 click).
    * 📞 Gọi điện trực tiếp (`tel:` Click-to-call).
    * ✈️ / 💬 Mở chat nhanh qua Telegram / Zalo (Deep-link native).
    * 📝 Xem / Thêm ghi chú nhanh (Quick note popover).
    * 👥 Chuyển khách vào Pool hoặc 🗑️ Xóa khách.
  * **Phân trang:** Chuyển trang linh hoạt kèm hiển thị tổng số bản ghi (*Hiển thị 1-20 trong tổng 88 khách hàng*).

---

### 2.3. Module Chi tiết khách hàng & Lịch sử tương tác
Hồ sơ 360 độ của một khách hàng cụ thể khi sale bấm vào chăm sóc.

* **Header khách hàng & Badges cảnh báo:**
  * Tên khách hàng, SĐT, Tag trạng thái hiện tại.
  * Huy hiệu cảnh báo: *Ngày không liên lạc (vd: 2 ngày)*, *Ngày tạo (vd: 11/08)*.
* **Form thông tin chi tiết:**
  * *Số điện thoại:* Kèm cụm nút thao tác Copy, Gọi điện, Telegram, Zalo.
  * *Tên khách hàng:* Chỉnh sửa họ tên.
  * *UID khách hàng:* Lưu mã ID tài khoản người chơi/khách hàng trên hệ thống Sàn Core.
  * *Telegram Username:* Lưu trữ handle `@username` hoặc SĐT Telegram của khách.
  * *Trạng thái:* Dropdown chuyển đổi phễu (Khách mới, Đăng ký, Đã nạp, Ngưng GD, Hẹn gọi lại,...).
  * *Cụm nút hành động Form:*
    * **Lưu thay đổi:** Cập nhật thông tin khách hàng.
    * **Đưa vào Pool:** Trả khách về kho dữ liệu chung nếu không khai thác được để Sale khác bốc lại.
    * **Xoá:** Xóa hoặc lưu trữ khách hàng.
* **Khung Thông tin nhanh & Nguồn gốc Lead:**
  * Hiển thị Ngày liên hệ cuối, Ngày tạo tài khoản.
  * **Nguồn Facebook / Ads:** Hiển thị nguồn chiến dịch Ads / Fanpage (vd: *Vertex Insights*) kèm đường dẫn đối soát.
* **Khung Lịch sử chăm sóc (Care History & Notes):**
  * Bộ chọn kênh tương tác: *Gọi điện*, *Telegram*, *Zalo*.
  * Khung nhập nội dung ghi chú cuộc gọi / tin nhắn kèm nút *Xác nhận ghi chú*.
  * Timeline nhật ký chăm sóc: Lưu toàn bộ lịch sử các lần tương tác theo thời gian thực (ngày giờ, nội dung ghi chú, trạng thái).
* **Khung Lịch sử chat Facebook (ManyChat / Messenger Integration):**
  * Tích hợp nhúng hội thoại chat Facebook trực tiếp từ Edge Function / Webhook Graph API.
  * Nút *Tải lại* để đồng bộ tin nhắn mới nhất mà không cần mở tab Facebook riêng.

---

## 3. CHI TIẾT CÁC PHÂN HỆ TỪ THANH SIDEBAR

### 3.1. Tab `Lịch sử` (Nhật ký hoạt động & Đối soát)
* **Nhật ký cuộc gọi & Chăm sóc tổng thể (Audit Logs):** Bảng tổng hợp toàn bộ các cuộc gọi, tin nhắn Telegram/Zalo của Sale theo thời gian, lọc theo ngày/loại tương tác.
* **Lịch sử biến động trạng thái (Status Transition History):** Theo dõi hành trình khách hàng chuyển đổi từ lúc tiếp nhận đến khi đăng ký tài khoản, nạp tiền hoặc ngưng giao dịch.
* **Lịch sử nộp báo cáo ca & KPI quá khứ:** Xem lại các bản báo cáo ca đã nộp trước deadline và đối soát tỷ lệ đạt KPI các tháng trước.

### 3.2. Tab `Dữ liệu (0/15)` (Kho Lead chung & Quota nhận Data)
*Badge `(0/15)` thể hiện hạn mức nhận data của sale trong ngày (đã nhận 0 trên tối đa 15 lead).*
* **Kho Lead dùng chung (Public Lead Pool):** Danh sách data khách hàng chưa được gán hoặc data do các sale khác bấm *"Đưa vào Pool"* trả về.
* **Cơ chế Nhận/Bốc Lead (Claim Lead):** Sale chủ động bấm nhận data vào danh sách việc cần làm cho đến khi chạm hạn mức ngày (15/15).
* **Import File Excel/CSV:** Nhập danh sách data mới từ file Excel (tự động chuẩn hóa SĐT và lọc trùng).
* **Bộ lọc chất lượng data:** Lọc theo nguồn (Facebook Ads, ManyChat, Landing Page, Vertex Insights), tuổi data (mới về, chưa chăm sóc trong 24h/48h).

### 3.3. Tab `Yêu cầu SĐT trùng` (Xử lý xung đột Lead)
* **Cảnh báo trùng số điện thoại (Duplicate Conflict Detection):** Tự động phát hiện khi lead mới nhập về đã tồn tại trên hệ thống hoặc đang do Sale khác phụ trách.
* **Gửi yêu cầu khiếu nại / Xin chuyển quyền chăm sóc:** Sale gửi yêu cầu lên Leader hoặc Sale đang giữ để xin quyền chăm sóc kèm bằng chứng tương tác gần nhất.
* **Danh sách yêu cầu Gửi đi / Nhận về:** Theo dõi trạng thái duyệt (*Chờ duyệt, Đã duyệt, Từ chối*) từ Leader và các đồng nghiệp trong đội (*Tộp 3F*).
* **Lịch sử giải quyết tranh chấp:** Ghi nhận minh bạch lịch sử phân xử để tránh chồng chéo KPI và hoa hồng.

---

## 4. CÀI ĐẶT & CÁC CƠ CHẾ PHỤ TRỢ

### 4.1. Mục `⚙️ Cài đặt` (Settings)
* **Cấu hình Tổng đài & Cuộc gọi:** Thiết lập phương thức gọi mặc định (Click-to-call `tel:` mở app điện thoại bàn / Zoiper / SIM cá nhân).
* **Cấu hình Nhận Lead tự động & Ca trực:** Thiết lập tự động nhận lead từ ManyChat khi còn hạn mức, bật/tắt trạng thái sẵn sàng nhận data.
* **Cài đặt Thông báo & Nhắc lịch:** Cảnh báo trước giờ hết hạn Deadline báo cáo ca (30p, 15p), chuông nhắc lịch hẹn gọi lại cho khách, chuông báo khi có lead nóng mới đổ về.
* **Mẫu tin nhắn & Tag ghi chú nhanh (Templates):** Soạn sẵn các kịch bản chào khách, kịch bản gửi link nạp tiền trên Zalo/Telegram; cài đặt danh sách tag ghi chú 1 chạm (*Thuê bao, Không bắt máy, Đang bận, Hẹn tối,...*).
* **Hồ sơ cá nhân & Giao diện:** Cập nhật thông tin nhân viên, đổi mật khẩu, chuyển đổi giao diện Dark Mode / Light Mode, tùy chỉnh số lượng dòng hiển thị trên bảng.

### 4.2. Các tiện ích phụ trợ trên Sidebar
* **`🌙 Bật ưu tiên đêm` (Night Priority Mode):** Nút gạt chuyển đổi chế độ trực đêm, ưu tiên bắn thông báo và phân bổ lead nóng phát sinh ngoài giờ hành chính cho sale trực ca.
* **`🔔 Thông báo` (Notification Drawer):** Trung tâm nhận tin thông báo realtime (Lead mới, nhắc hẹn gọi, kết quả duyệt trùng SĐT).
* **`👤 Thông tin tài khoản & 🚪 Đăng xuất`:** Xem nhanh thông tin vai trò (*Nhân viên Sale*) và đăng xuất an toàn khỏi hệ thống.
