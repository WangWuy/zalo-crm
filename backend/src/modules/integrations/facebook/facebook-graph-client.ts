// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * facebook-graph-client.ts — Gọi Meta Graph API lấy chi tiết 1 lead từ leadgen_id
 * (2026-08-21). Webhook chỉ gửi leadgen_id, KHÔNG kèm field_data thật.
 */
import type { NormalizedLead, SourceMeta } from '../_shared/normalized-lead.schema.js';

const GRAPH_API_VERSION = 'v21.0';

interface GraphFieldDatum {
  name: string;
  values: string[];
}

interface GraphLeadResponse {
  id: string;
  created_time?: string;
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  ad_id?: string;
  form_id?: string;
  field_data?: GraphFieldDatum[];
  error?: { message: string; type: string; code: number };
}

/** Field keys thường gặp cho tên/SĐT — advertiser có thể đặt tên câu hỏi khác nhau. */
const NAME_KEYS = ['full_name', 'name', 'ho_va_ten', 'họ_và_tên', 'ten'];
const PHONE_KEYS = ['phone_number', 'phone', 'so_dien_thoai', 'số_điện_thoại', 'sdt'];

function flattenFieldData(fieldData: GraphFieldDatum[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fieldData) {
    out[f.name] = f.values.length === 1 ? f.values[0] : f.values;
  }
  return out;
}

function pickFirst(flat: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = flat[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

export class GraphApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

/** Gọi Graph API lấy field_data thật cho 1 leadgen_id, trả NormalizedLead. */
export async function fetchLeadDetail(leadgenId: string, pageAccessToken: string): Promise<NormalizedLead> {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(leadgenId)}` +
    `?fields=field_data,campaign_id,campaign_name,adset_id,ad_id,form_id,created_time` +
    `&access_token=${encodeURIComponent(pageAccessToken)}`;

  const res = await fetch(url);
  const body = (await res.json()) as GraphLeadResponse;

  if (!res.ok || body.error) {
    throw new GraphApiError(body.error?.message ?? `Graph API error (HTTP ${res.status})`, res.status);
  }

  const flat = flattenFieldData(body.field_data ?? []);
  const sourceMeta: SourceMeta = {
    externalLeadId: leadgenId,
    campaignId: body.campaign_id,
    campaignName: body.campaign_name,
    adSetId: body.adset_id,
    adId: body.ad_id,
    formId: body.form_id,
    rawFieldData: body.field_data,
    submittedAt: body.created_time ? new Date(body.created_time).getTime() : undefined,
  };

  return {
    source: 'fb-leadads',
    campaignName: body.campaign_name ?? '',
    name: pickFirst(flat, NAME_KEYS),
    phone: pickFirst(flat, PHONE_KEYS),
    customFields: flat,
    sourceMeta,
  };
}
