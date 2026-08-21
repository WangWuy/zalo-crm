// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * use-quick-note-tags.ts — Shared cache cho Quick Note Tag (Phase 3 TheLab).
 * Chip 1-chạm hiển thị trên NotesSection — bấm chip = append text vào note draft.
 *
 * Module-level cache: fetch 1 lần, share toàn app (mẫu use-crm-tag-defs.ts).
 */
import { ref } from 'vue';
import { api } from '@/api/index';

export interface QuickNoteTag {
  id: string;
  orgId: string;
  label: string;
  order: number;
  isActive: boolean;
}

const tags = ref<QuickNoteTag[]>([]);
let fetchedOnce = false;
let inflightPromise: Promise<void> | null = null;

async function doFetch() {
  try {
    const { data } = await api.get('/quick-note-tags');
    tags.value = (data.tags || []) as QuickNoteTag[];
    fetchedOnce = true;
  } catch (err) {
    console.warn('[use-quick-note-tags] Cannot load tags', err);
  } finally {
    inflightPromise = null;
  }
}

/** Lazy load — chỉ fetch 1 lần per session. Concurrent calls dedup qua inflightPromise. */
async function loadQuickNoteTags(): Promise<void> {
  if (fetchedOnce) return;
  if (inflightPromise) return inflightPromise;
  inflightPromise = doFetch();
  return inflightPromise;
}

export function useQuickNoteTags() {
  return { tags, loadQuickNoteTags };
}
