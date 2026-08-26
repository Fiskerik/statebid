export const DEFAULT_STATE_BORDER = '#ff9a3d';
export const DEFAULT_STATE_FILL = '#ffe1c2';

export function isHexColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value);
}

export function normalizeHexColor(value: string | null | undefined) {
  const candidate = value?.trim() ?? '';
  return isHexColor(candidate) ? candidate.toLowerCase() : DEFAULT_STATE_BORDER;
}

/** Mix a chosen border color toward white for a readable state fill. */
export function lighterColor(value: string | null | undefined, amount = 0.72) {
  const hex = normalizeHexColor(value);
  const channels = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset + 1, offset + 3), 16));
  return `#${channels.map((channel) => Math.round(channel + (255 - channel) * amount).toString(16).padStart(2, '0')).join('')}`;
}
