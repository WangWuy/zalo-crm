<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Nguyễn Tiến Lộc -->
<template>
  <div class="mobile-chat" style="height: calc(100vh - 120px);">
    <!-- Conversation list (shown when no conversation selected) -->
    <div v-if="!selectedConvId" style="height: 100%; display: flex; flex-direction: column;">
      <!-- Chọn nick Zalo — hàng avatar cuộn ngang, tương đương account switcher trên web -->
      <div v-if="zaloAccounts.length > 1" class="nick-switcher">
        <button
          class="nick-chip"
          :class="{ active: !accountFilter }"
          title="Tất cả nick"
          @click="onFilterAccount(null)"
        >
          <div class="nick-chip-avatar nick-chip-all"><v-icon size="18">mdi-account-multiple</v-icon></div>
          <span class="nick-chip-label">Tất cả</span>
        </button>
        <button
          v-for="acc in zaloAccounts"
          :key="acc.id"
          class="nick-chip"
          :class="{ active: accountFilter === acc.id }"
          :title="acc.displayName || 'Nick Zalo'"
          @click="onFilterAccount(acc.id)"
        >
          <div class="nick-chip-avatar">
            <img v-if="acc.avatarUrl" :src="acc.avatarUrl" :alt="acc.displayName || ''" />
            <span v-else>{{ (acc.displayName || '?').charAt(0).toUpperCase() }}</span>
            <span
              class="nick-chip-status"
              :class="isAccountOnline(acc) ? 'is-online' : 'is-offline'"
              :title="isAccountOnline(acc) ? 'Đã kết nối' : 'Ngắt kết nối'"
            />
          </div>
          <span class="nick-chip-label">{{ acc.displayName || 'Nick' }}</span>
        </button>
      </div>

      <ConversationList
        :conversations="conversations"
        :selected-id="selectedConvId"
        :loading="loadingConvs"
        v-model:search="searchQuery"
        style="flex: 1; min-height: 0;"
        @select="selectConversation"
        @filter-account="onFilterAccount"
      />
    </div>

    <!-- Message thread (shown when conversation selected) -->
    <div v-else style="height: 100%; display: flex; flex-direction: column;">
      <!-- Back button bar -->
      <div class="d-flex align-center pa-2" style="flex-shrink: 0;">
        <v-btn icon variant="text" size="small" @click="goBack">
          <v-icon>mdi-arrow-left</v-icon>
        </v-btn>
        <span v-if="selectedConv" class="text-body-2 font-weight-medium ml-1">
          {{ selectedConv.contact?.fullName || 'Chat' }}
        </span>
        <v-spacer />
        <!-- Chuyển nhanh sang người chat khác mà không cần back về danh sách -->
        <v-btn icon variant="text" size="small" title="Chọn hội thoại khác" @click="switcherOpen = true">
          <v-icon>mdi-account-multiple-outline</v-icon>
        </v-btn>
      </div>

      <MessageThread
        :conversation="selectedConv"
        :messages="allMessages"
        :loading="loadingMsgs"
        :has-more-messages="hasMoreMessages"
        :loading-older-messages="loadingOlderMsgs"
        :sending="sendingMsg"
        :show-contact-panel="false"
        :ai-suggestion="(null as any)"
        :ai-suggestion-loading="false"
        :ai-suggestion-error="(null as any)"
        @send="handleSend"
        @load-older="selectedConvId && loadOlderMessages(selectedConvId)"
        @refresh-thread="selectedConvId && fetchMessages(selectedConvId)"
        style="flex: 1; min-height: 0;"
      />
    </div>

    <!-- Overlay chọn nhanh người chat khác — mở đè lên trên khi đang xem 1 hội thoại -->
    <v-navigation-drawer
      v-model="switcherOpen"
      location="left"
      temporary
      width="320"
      style="max-width: 88vw;"
    >
      <div style="height: 100%; display: flex; flex-direction: column;">
        <div class="d-flex align-center pa-2" style="flex-shrink: 0; border-bottom: 1px solid rgba(0,0,0,0.08);">
          <span class="text-body-2 font-weight-medium ml-1">Chọn hội thoại</span>
          <v-spacer />
          <v-btn icon variant="text" size="small" @click="switcherOpen = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </div>
        <ConversationList
          :conversations="conversations"
          :selected-id="selectedConvId"
          :loading="loadingConvs"
          v-model:search="searchQuery"
          @select="onSwitchConversation"
          @filter-account="onFilterAccount"
          style="flex: 1; min-height: 0;"
        />
      </div>
    </v-navigation-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import ConversationList from '@/components/chat/ConversationList.vue';
import MessageThread from '@/components/chat/MessageThread.vue';
import { useChat } from '@/composables/use-chat';
import { useOfflineQueue } from '@/composables/use-offline-queue';
import { useZaloAccounts, type ZaloAccount } from '@/composables/use-zalo-accounts';

const {
  conversations, selectedConvId, selectedConv, messages,
  loadingConvs, loadingMsgs, hasMoreMessages, loadingOlderMsgs, sendingMsg, searchQuery, accountFilter,
  fetchConversations, fetchMessages, loadOlderMessages, selectConversation, sendMessage, sendMessageTo,
  initSocket, destroySocket,
} = useChat();

const { pendingMessages, enqueue, flush } = useOfflineQueue();

// Chọn nick Zalo trên mobile — tương đương account switcher cột 1 bên web
const { accounts: zaloAccounts, fetchAccounts: fetchZaloAccounts } = useZaloAccounts();

// Overlay chọn nhanh người chat khác trong lúc đang xem 1 hội thoại (mobile)
const switcherOpen = ref(false);

function onSwitchConversation(convId: string) {
  switcherOpen.value = false;
  selectConversation(convId);
}

// Badge active/inactive trên avatar nick — dựa vào liveStatus (socket realtime) rồi mới tới status (DB)
function isAccountOnline(acc: ZaloAccount) {
  return (acc.liveStatus || acc.status) === 'connected';
}

function onFilterAccount(id: string | null) {
  accountFilter.value = id;
  fetchConversations();
}

function goBack() {
  selectedConvId.value = null;
}

// Merge real messages with pending offline messages
const allMessages = computed(() => {
  const pending = pendingMessages.value
    .filter(p => p.conversationId === selectedConvId.value)
    .map(p => ({
      id: p.id,
      content: p.content,
      contentType: 'text',
      senderType: 'self',
      senderName: null,
      sentAt: p.createdAt,
      isDeleted: false,
      zaloMsgId: null,
      albumKey: null,
      albumIndex: null,
      albumTotal: null,
      _pending: true,
    }));
  return [...messages.value, ...pending];
});

async function handleSend(
  content: string,
  replyMessageId?: string | null,
  styles?: Array<{ st: string; start: number; len: number }>,
  mentions?: Array<{ uid: string; pos: number; len: number }>,
) {
  if (!selectedConvId.value) return;
  if (!navigator.onLine) {
    enqueue(selectedConvId.value, content);
    return;
  }
  await sendMessage(content, replyMessageId, styles, mentions);
}

// Flush queue when coming back online
function onOnline() {
  flush(sendMessageTo);
}

onMounted(() => {
  fetchConversations();
  fetchZaloAccounts();
  initSocket();
  window.addEventListener('online', onOnline);
});

onUnmounted(() => {
  destroySocket();
  window.removeEventListener('online', onOnline);
  clearTimeout(searchTimeout);
});

let searchTimeout: ReturnType<typeof setTimeout>;
watch(searchQuery, () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => fetchConversations(), 300);
});
</script>

<style scoped>
.nick-switcher {
  display: flex;
  gap: 10px;
  padding: 10px 12px 6px;
  overflow-x: auto;
  flex-shrink: 0;
  -webkit-overflow-scrolling: touch;
}
.nick-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  width: 60px;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
}
.nick-chip-avatar {
  position: relative;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--smax-grey-200, #e5e7eb);
  color: var(--smax-grey-700, #374151);
  font-size: 15px;
  font-weight: 600;
  overflow: hidden;
  border: 2px solid transparent;
}
.nick-chip-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.nick-chip.active .nick-chip-avatar {
  border-color: var(--smax-primary, #0068ff);
}
.nick-chip-all {
  background: var(--smax-primary, #0068ff);
  color: #fff;
}
.nick-chip-status {
  position: absolute;
  right: -1px;
  bottom: -1px;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  border: 2px solid var(--v-theme-surface, #fff);
  box-sizing: content-box;
}
.nick-chip-status.is-online {
  background: var(--smax-success, #22c55e);
}
.nick-chip-status.is-offline {
  background: var(--smax-grey-400, #9ca3af);
}
.nick-chip-label {
  font-size: 11px;
  line-height: 1.2;
  max-width: 60px;
  max-height: 2.4em;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-word;
  color: var(--smax-grey-700, #374151);
}
.nick-chip.active .nick-chip-label {
  color: var(--smax-primary, #0068ff);
  font-weight: 600;
}
</style>
