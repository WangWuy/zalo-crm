#!/usr/bin/env bash
#
# check-migrations.sh — Rà các migration CHƯA áp dụng vào DB trước khi chạy
# `prisma migrate deploy`, cảnh báo nếu thấy lệnh SQL có nguy cơ mất/hỏng dữ liệu.
#
# Không tự sửa gì cả — chỉ đọc và báo cáo. Thoát mã khác 0 nếu thấy lệnh nguy hiểm,
# để script deploy có thể dừng lại chờ người xác nhận.
#
# Dùng:
#   ./scripts/check-migrations.sh              # dùng DB container mặc định (zalo-crm-db)
#   DB=my-db-container ./scripts/check-migrations.sh
set -euo pipefail
cd "$(dirname "$0")/.."

DB="${DB:-zalo-crm-db}"
DBUSER="${DBUSER:-crmuser}"
DBNAME="${DBNAME:-zalocrm}"
MIGRATIONS_DIR="backend/prisma/migrations"

c_blue=$'\033[1;36m'; c_grn=$'\033[1;32m'; c_yel=$'\033[1;33m'; c_red=$'\033[1;31m'; c_off=$'\033[0m'
log()  { echo "${c_blue}▶${c_off} $*"; }
ok()   { echo "${c_grn}✓${c_off} $*"; }
warn() { echo "${c_yel}⚠${c_off}  $*"; }
err()  { echo "${c_red}✗ $*${c_off}" >&2; }

[ -d "$MIGRATIONS_DIR" ] || { err "Không thấy $MIGRATIONS_DIR — chạy ở thư mục gốc repo."; exit 1; }

# ── Lấy danh sách migration đã áp dụng vào DB ─────────────────────────────────
APPLIED=""
if docker inspect "$DB" >/dev/null 2>&1; then
  APPLIED="$(docker exec "$DB" psql -U "$DBUSER" -d "$DBNAME" -tAc \
    "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL" 2>/dev/null || true)"
fi

if [ -z "$APPLIED" ]; then
  warn "Không đọc được bảng _prisma_migrations (DB chưa chạy, hoặc là bản CÀI MỚI) — coi TẤT CẢ migration là 'sắp áp dụng'."
fi

# ── Tìm migration chưa áp dụng ─────────────────────────────────────────────────
PENDING=()
for dir in "$MIGRATIONS_DIR"/*/; do
  name="$(basename "$dir")"
  [ -f "$dir/migration.sql" ] || continue
  if [ -n "$APPLIED" ] && grep -qxF "$name" <<< "$APPLIED"; then
    continue
  fi
  PENDING+=("$dir/migration.sql")
done

if [ "${#PENDING[@]}" -eq 0 ]; then
  ok "Không có migration nào đang chờ áp dụng — DB đã khớp schema mới nhất."
  exit 0
fi

log "Migration đang chờ áp dụng (${#PENDING[@]}):"
for f in "${PENDING[@]}"; do echo "  - $(basename "$(dirname "$f")")"; done
echo ""

# ── Quét nội dung tìm lệnh nguy hiểm ───────────────────────────────────────────
# Nhóm rủi ro:
#   DROP COLUMN / DROP TABLE          → mất dữ liệu vĩnh viễn
#   ALTER COLUMN ... TYPE             → có thể lỗi/convert sai nếu data không khớp kiểu mới
#   ADD COLUMN ... NOT NULL (no DEFAULT) → lỗi ngay nếu bảng đã có rows
FOUND_DANGER=0

for f in "${PENDING[@]}"; do
  mig="$(basename "$(dirname "$f")")"

  drops="$(grep -inE 'DROP[[:space:]]+(COLUMN|TABLE)' "$f" || true)"
  if [ -n "$drops" ]; then
    err "[$mig] DROP phát hiện — dữ liệu trong cột/bảng này sẽ MẤT VĨNH VIỄN:"
    echo "$drops" | sed 's/^/    /'
    FOUND_DANGER=1
  fi

  retypes="$(grep -inE 'ALTER[[:space:]]+(COLUMN|TABLE).*TYPE' "$f" || true)"
  if [ -n "$retypes" ]; then
    warn "[$mig] Đổi kiểu cột — kiểm tra data hiện có có convert được sang kiểu mới không:"
    echo "$retypes" | sed 's/^/    /'
    FOUND_DANGER=1
  fi

  # ADD COLUMN có NOT NULL nhưng KHÔNG có DEFAULT trên cùng dòng → sẽ lỗi nếu bảng có data.
  notnull_no_default="$(grep -inE 'ADD[[:space:]]+COLUMN' "$f" | grep -iE 'NOT NULL' | grep -viE 'DEFAULT' || true)"
  if [ -n "$notnull_no_default" ]; then
    err "[$mig] ADD COLUMN ... NOT NULL không có DEFAULT — sẽ FAIL nếu bảng đã có dòng dữ liệu:"
    echo "$notnull_no_default" | sed 's/^/    /'
    FOUND_DANGER=1
  fi
done

echo ""
if [ "$FOUND_DANGER" = 1 ]; then
  err "Có migration RỦI RO — đọc kỹ nội dung ở trên trước khi chạy 'prisma migrate deploy'."
  err "Khuyến nghị: backup DB (./scripts/zalocrm-deploy.sh backup) trước khi tiếp tục."
  exit 1
else
  ok "Không thấy lệnh nguy hiểm rõ ràng trong các migration đang chờ. Vẫn nên backup trước khi deploy."
  exit 0
fi
