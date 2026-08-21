<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Nguyễn Tiến Lộc -->
<!--
  FacebookPagesSettings — Kết nối Facebook Lead Ads (2026-08-21).
  Admin nhập Page ID + Page Access Token thủ công (lấy qua Meta Business Suite /
  Graph API Explorer) — không có OAuth flow ở bản đầu. Sau khi kết nối, admin dán
  Callback URL + Verify Token vào Meta App Dashboard → Webhooks → Page → leadgen.
-->
<template>
  <div class="fb-page">
    <header class="fb-page-head">
      <div class="ico">📘</div>
      <div>
        <h1>Facebook Lead Ads</h1>
        <p>
          Kết nối Page Facebook để tự động nhận khách hàng điền form quảng cáo (Lead Ads) vào
          CRM. Cần <b>Page Access Token</b> lấy qua Meta Business Suite hoặc Graph API Explorer.
        </p>
      </div>
    </header>

    <div v-if="loading" class="fb-page-loading">Đang tải…</div>

    <template v-else>
      <div class="card">
        <div class="card-head">
          <h3>Page đã kết nối</h3>
          <button class="btn btn-primary" @click="showAddForm = true">+ Kết nối Page mới</button>
        </div>
        <div v-if="pages.length === 0" class="empty">Chưa có Page nào được kết nối.</div>
        <div v-else class="page-list">
          <div v-for="p in pages" :key="p.pageId" class="page-row">
            <div class="page-info">
              <div class="page-name">{{ p.pageName || '(chưa đặt tên)' }}</div>
              <div class="page-id">Page ID: {{ p.pageId }}</div>
              <div class="page-meta">
                Kết nối: {{ formatDate(p.subscribedAt) }}
                <span v-if="p.lastWebhookAt"> · Lead gần nhất: {{ formatDate(p.lastWebhookAt) }}</span>
                <span v-else> · Chưa nhận lead nào</span>
              </div>
              <button class="btn btn-sm" @click="showWebhookInfo(p)">📋 Xem Callback URL / Verify Token</button>
            </div>
            <div class="page-actions">
              <label class="switch">
                <input type="checkbox" :checked="p.isActive" @change="onToggle(p, ($event.target as HTMLInputElement).checked)" />
                <span class="switch-track"><span class="switch-thumb"></span></span>
              </label>
              <button class="btn btn-sm btn-danger" @click="onDisconnect(p)">🗑 Ngắt kết nối</button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Form kết nối Page mới -->
    <div v-if="showAddForm" class="modal-bg" @click.self="showAddForm = false">
      <div class="modal">
        <h3>Kết nối Page Facebook</h3>
        <div class="frow">
          <label>Page ID *</label>
          <input v-model="form.pageId" class="finput" placeholder="vd: 123456789012345" />
        </div>
        <div class="frow">
          <label>Tên Page</label>
          <input v-model="form.pageName" class="finput" placeholder="vd: Sunshine BĐS" />
        </div>
        <div class="frow">
          <label>Page Access Token *</label>
          <input v-model="form.pageAccessToken" type="password" class="finput" placeholder="Lấy qua Graph API Explorer" />
        </div>
        <div class="modal-actions">
          <button class="btn" @click="showAddForm = false">Huỷ</button>
          <button class="btn btn-primary" :disabled="connecting || !canSubmit" @click="onConnect">
            {{ connecting ? 'Đang kết nối...' : 'Kết nối' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Webhook info modal -->
    <div v-if="webhookInfoPage" class="modal-bg" @click.self="webhookInfoPage = null">
      <div class="modal">
        <h3>Cấu hình Webhook cho Meta App Dashboard</h3>
        <p class="hint">
          Vào Meta App Dashboard → App của bạn → Webhooks → chọn object <b>Page</b> → dán 2 giá trị
          dưới đây → Subscribe field <code>leadgen</code> cho Page này.
        </p>
        <div class="frow">
          <label>Callback URL</label>
          <div class="copy-row">
            <input readonly class="finput" :value="callbackUrl" />
            <button class="btn btn-sm" @click="copyText(callbackUrl)">Copy</button>
          </div>
        </div>
        <div class="frow">
          <label>Verify Token</label>
          <div class="copy-row">
            <input readonly class="finput" :value="webhookInfoPage.webhookVerifyToken" />
            <button class="btn btn-sm" @click="copyText(webhookInfoPage.webhookVerifyToken)">Copy</button>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-primary" @click="webhookInfoPage = null">Đóng</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { api } from '@/api';
import { useToast } from '@/composables/use-toast';

interface FacebookPage {
  pageId: string;
  pageName: string | null;
  isActive: boolean;
  webhookVerifyToken: string;
  subscribedAt: string;
  lastWebhookAt: string | null;
}

const toast = useToast();
const loading = ref(true);
const pages = ref<FacebookPage[]>([]);
const showAddForm = ref(false);
const connecting = ref(false);
const webhookInfoPage = ref<FacebookPage | null>(null);
const form = ref({ pageId: '', pageName: '', pageAccessToken: '' });

const canSubmit = computed(() => !!form.value.pageId.trim() && !!form.value.pageAccessToken.trim());
const callbackUrl = computed(() => `${window.location.origin}/api/v1/webhooks/facebook`);

async function load() {
  loading.value = true;
  try {
    const { data } = await api.get<{ pages: FacebookPage[] }>('/integrations/facebook/pages');
    pages.value = data.pages ?? [];
  } catch {
    toast.error('Không tải được danh sách Page');
  } finally {
    loading.value = false;
  }
}

async function onConnect() {
  if (!canSubmit.value) return;
  connecting.value = true;
  try {
    const { data } = await api.post<{ page: FacebookPage }>('/integrations/facebook/pages', {
      pageId: form.value.pageId.trim(),
      pageName: form.value.pageName.trim() || undefined,
      pageAccessToken: form.value.pageAccessToken.trim(),
    });
    toast.success('Đã kết nối Page');
    showAddForm.value = false;
    form.value = { pageId: '', pageName: '', pageAccessToken: '' };
    await load();
    webhookInfoPage.value = data.page;
  } catch (err: unknown) {
    const e = err as { response?: { data?: { error?: string } } };
    toast.error(e.response?.data?.error || 'Không thể kết nối Page');
  } finally {
    connecting.value = false;
  }
}

async function onToggle(p: FacebookPage, isActive: boolean) {
  try {
    await api.patch(`/integrations/facebook/pages/${p.pageId}`, { isActive });
    p.isActive = isActive;
    toast.success(isActive ? 'Đã bật Page' : 'Đã tắt Page');
  } catch {
    toast.error('Không thể cập nhật trạng thái Page');
  }
}

async function onDisconnect(p: FacebookPage) {
  if (!confirm(`Ngắt kết nối Page "${p.pageName || p.pageId}"?`)) return;
  try {
    await api.delete(`/integrations/facebook/pages/${p.pageId}`);
    toast.success('Đã ngắt kết nối');
    await load();
  } catch {
    toast.error('Không thể ngắt kết nối');
  }
}

function showWebhookInfo(p: FacebookPage) {
  webhookInfoPage.value = p;
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success('Đã copy');
  } catch {
    toast.error('Không copy được');
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

onMounted(load);
</script>

<style scoped>
.fb-page { max-width: 820px; }
.fb-page-head { display: flex; gap: 14px; align-items: flex-start; margin-bottom: 18px; }
.fb-page-head .ico { width: 44px; height: 44px; border-radius: 12px; background: #e7f0fe; display: grid; place-items: center; font-size: 22px; flex: none; }
.fb-page-head h1 { font-size: 19px; font-weight: 700; margin: 0 0 4px; }
.fb-page-head p { font-size: 13px; color: #6B7785; margin: 0; line-height: 1.55; }
.fb-page-loading { padding: 28px; text-align: center; color: #97A0AC; }

.card { background: #fff; border: 1px solid #e7eaf0; border-radius: 14px; overflow: hidden; }
.card-head { padding: 14px 20px; border-bottom: 1px solid #eef1f6; display: flex; align-items: center; justify-content: space-between; }
.card-head h3 { font-size: 13px; font-weight: 700; color: #6b7488; text-transform: uppercase; letter-spacing: .05em; margin: 0; }
.empty { padding: 28px; text-align: center; color: #97a0b3; font-size: 13px; }

.page-list { padding: 6px 0; }
.page-row { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-bottom: 1px solid #f1f4f9; gap: 12px; }
.page-row:last-child { border-bottom: none; }
.page-name { font-size: 14px; font-weight: 700; color: #141a24; }
.page-id { font-size: 12px; color: #6b7488; font-family: monospace; margin-top: 2px; }
.page-meta { font-size: 12px; color: #97a0b3; margin-top: 4px; }
.page-actions { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }

.switch { position: relative; display: inline-block; width: 40px; height: 22px; flex-shrink: 0; }
.switch input { opacity: 0; width: 0; height: 0; }
.switch-track { position: absolute; inset: 0; background: #e7eaf0; border-radius: 999px; cursor: pointer; transition: background .15s; }
.switch-thumb { position: absolute; left: 2px; top: 2px; width: 18px; height: 18px; background: #fff; border-radius: 50%; transition: transform .15s; box-shadow: 0 1px 3px rgba(20,26,36,.2); }
.switch input:checked + .switch-track { background: #1786be; }
.switch input:checked + .switch-track .switch-thumb { transform: translateX(18px); }

.btn { padding: 8px 14px; font-size: 13px; font-weight: 600; border-radius: 8px; border: 1px solid #e7eaf0; background: #fff; color: #141a24; cursor: pointer; font-family: inherit; }
.btn:hover:not(:disabled) { background: #f1f4f9; }
.btn:disabled { opacity: .55; cursor: default; }
.btn-sm { padding: 6px 10px; font-size: 12px; }
.btn-primary { background: #1786be; border-color: #1786be; color: #fff; }
.btn-primary:hover:not(:disabled) { background: #0f6fa0; }
.btn-danger { color: #f04438; border-color: #f5c4c0; }
.btn-danger:hover:not(:disabled) { background: #fdeceb; }

.modal-bg { position: fixed; inset: 0; background: rgba(15,23,42,.45); display: flex; align-items: center; justify-content: center; z-index: 10000; }
.modal { background: #fff; border-radius: 12px; width: 460px; max-width: calc(100vw - 40px); padding: 20px; box-shadow: 0 20px 40px rgba(0,0,0,.2); }
.modal h3 { font-size: 15px; font-weight: 700; margin: 0 0 14px; }
.hint { font-size: 12.5px; color: #6b7488; line-height: 1.5; margin: -6px 0 14px; }
.frow { margin-bottom: 12px; }
.frow label { display: block; font-size: 12px; font-weight: 600; color: #6b7488; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 5px; }
.finput { width: 100%; padding: 9px 12px; font-size: 13px; border: 1px solid #e7eaf0; border-radius: 8px; outline: none; font-family: inherit; box-sizing: border-box; }
.finput:focus { border-color: #1786be; box-shadow: 0 0 0 3px rgba(23,134,190,.12); }
.copy-row { display: flex; gap: 8px; }
.copy-row .finput { flex: 1; font-family: monospace; font-size: 12px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
</style>
