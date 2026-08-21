// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
import { api } from '@/api';

export async function getUserPreference<T>(key: string, fallback: T): Promise<T> {
  const { data } = await api.get<{ key: string; value: T | null }>(`/me/preferences/${key}`);
  return data.value ?? fallback;
}

export async function setUserPreference<T>(key: string, value: T): Promise<T> {
  const { data } = await api.put<{ key: string; value: T }>(`/me/preferences/${key}`, { value });
  return data.value;
}
