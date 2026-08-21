
const _e_text_chunks = [
  '8J+boCBUxrAgduG6pW4sIGN1c3RvbSB0aMOq',
  'bSB0w61uaCBuxINuZywgdHJp4buDbiBraGFp',
  'IFphbG9DUk0gY2hvIGRvYW5oIG5naGnhu4dw',
  'IGxpw6puIGjhu4cgV2Vic2l0ZTogem9pdmll',
  'dC5jb20=',
];

const _e_href_chunks = [
  'aHR0cHM6Ly96b2l2aWV0LmNvbQ==',
];

// Lightweight integrity tag — first byte sum mod 256, computed at build time.
// If the decoded text is tampered, the runtime sum will diverge and the
// banner falls back to an unambiguous "LICENSE VIOLATION" warning instead
// of silently failing. This is by design.
const _expected_text_checksum = 227;
const _expected_href_checksum = 66;

function _decode(chunks: string[]): string {
  // Concatenate chunks BEFORE decoding — base64 requires the full string be a
  // multiple of 4 characters. Decoding chunks individually would fail when a
  // chunk is split mid-quartet. Then convert the binary string back to UTF-8
  // via TextDecoder so non-ASCII (Vietnamese diacritics, emoji) survive.
  const bin = atob(chunks.join(''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}

function _checksum(s: string): number {
  let sum = 0;
  for (let i = 0; i < s.length; i++) sum = (sum + s.charCodeAt(i)) % 256;
  return sum;
}
import { ref } from 'vue';
import { api } from '@/api/index';

export function useAttribution(): { enabled: { value: boolean }; text: string; href: string } {
  const text = _decode(_e_text_chunks);
  const href = _decode(_e_href_chunks);

  const enabled = ref(true);

  if (_checksum(text) !== _expected_text_checksum || _checksum(href) !== _expected_href_checksum) {
    return {
      enabled,
      text: '⚠ LICENSE VIOLATION DETECTED — see NOTICE file. Contact: zoiviet.com',
      href: 'https://zoiviet.com',
    };
  }

  api.get('/branding')
    .then((res) => {
      if (res.data && res.data.hideAttribution === true) {
        enabled.value = false;
      }
    })
    .catch(() => {
      // Network error or missing endpoint → keep banner visible (fail closed).
    });

  return { enabled, text, href };
}
