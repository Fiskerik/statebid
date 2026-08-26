import { describe, expect, it } from 'vitest';
import { sanitizeImage } from '@/lib/images';
import { formatWholeDollarCents, serializeCents } from '@/lib/money';
import { STATE_BY_CODE, US_STATES } from '@/lib/states';

describe('money wire format', () => {
  it('serializes 64-bit cents as decimal strings without Number conversion', () => {
    expect(serializeCents(9_007_199_254_740_993n)).toBe('9007199254740993');
    expect(formatWholeDollarCents('12345678900')).toBe('$123,456,789');
    expect(() => serializeCents(-1n)).toThrow();
  });
});

describe('state data', () => {
  it('contains exactly 50 unique states and excludes DC', () => {
    expect(US_STATES).toHaveLength(50);
    expect(new Set(US_STATES.map((state) => state.code)).size).toBe(50);
    expect(STATE_BY_CODE.has('DC' as never)).toBe(false);
    expect(STATE_BY_CODE.has('AK')).toBe(true);
    expect(STATE_BY_CODE.has('HI')).toBe(true);
  });
});

describe('logo validation', () => {
  it('accepts a static PNG and strips text metadata', () => {
    const png = buildPng(['IHDR', 'tEXt', 'IEND']);
    const clean = sanitizeImage(png);
    expect(clean.contentType).toBe('image/png');
    expect(clean.width).toBe(1);
    expect(new TextDecoder().decode(clean.bytes)).not.toContain('tEXt');
  });

  it('rejects SVG bytes and animated PNG', () => {
    expect(() => sanitizeImage(new TextEncoder().encode('<svg></svg>'))).toThrow('PNG, JPEG, or WebP');
    expect(() => sanitizeImage(buildPng(['IHDR', 'acTL', 'IEND']))).toThrow('Animated');
  });
});

function buildPng(types: string[]) {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  const chunks = types.flatMap((type) => {
    const data = type === 'IHDR' ? [0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0] : type === 'tEXt' ? [97, 0, 98] : type === 'acTL' ? [0, 0, 0, 1, 0, 0, 0, 0] : [];
    const length = [0, 0, 0, data.length];
    return [...length, ...new TextEncoder().encode(type), ...data, 0, 0, 0, 0];
  });
  return new Uint8Array([...signature, ...chunks]);
}
