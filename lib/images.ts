const MAX_BYTES = 2 * 1024 * 1024;
const MAX_DIMENSION = 2048;
const MAX_PIXELS = 4_194_304;

export type SanitizedImage = {
  bytes: Uint8Array;
  contentType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/x-icon';
  extension: 'png' | 'jpg' | 'webp' | 'ico';
  width: number;
  height: number;
};

export function sanitizeImage(
  input: ArrayBuffer | Uint8Array,
  options: { allowIco?: boolean } = {},
): SanitizedImage {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (!bytes.length || bytes.length > MAX_BYTES) throw new Error('Logo files must be smaller than 2 MB.');

  if (isPng(bytes)) return sanitizePng(bytes);
  if (isJpeg(bytes)) return sanitizeJpeg(bytes);
  if (isWebp(bytes)) return sanitizeWebp(bytes);
  if (options.allowIco && isIco(bytes)) return validateIco(bytes);
  throw new Error('Use a PNG, JPEG, or WebP logo.');
}

function validateDimensions(width: number, height: number) {
  if (!width || !height || width > MAX_DIMENSION || height > MAX_DIMENSION || width * height > MAX_PIXELS) {
    throw new Error('Logo dimensions must be at most 2048 × 2048 pixels.');
  }
}

function isPng(bytes: Uint8Array) {
  return bytes.length > 24 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
}

function sanitizePng(bytes: Uint8Array): SanitizedImage {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  validateDimensions(width, height);
  const keepAncillary = new Set(['tRNS', 'sRGB', 'gAMA', 'cHRM']);
  const chunks: Uint8Array[] = [bytes.slice(0, 8)];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset);
    const end = offset + 12 + length;
    if (end > bytes.length) throw new Error('The PNG file is malformed.');
    const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
    if (type === 'acTL') throw new Error('Animated logos are not supported.');
    if (type[0] === type[0].toUpperCase() || keepAncillary.has(type)) chunks.push(bytes.slice(offset, end));
    offset = end;
    if (type === 'IEND') break;
  }
  return { bytes: concat(chunks), contentType: 'image/png', extension: 'png', width, height };
}

function isJpeg(bytes: Uint8Array) {
  return bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8;
}

function sanitizeJpeg(bytes: Uint8Array): SanitizedImage {
  const chunks: Uint8Array[] = [bytes.slice(0, 2)];
  let offset = 2;
  let width = 0;
  let height = 0;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) throw new Error('The JPEG file is malformed.');
    const marker = bytes[offset + 1];
    if (marker === 0xda) {
      chunks.push(bytes.slice(offset));
      break;
    }
    if (marker === 0xd9) break;
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (length < 2 || offset + length + 2 > bytes.length) throw new Error('The JPEG file is malformed.');
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      height = (bytes[offset + 5] << 8) | bytes[offset + 6];
      width = (bytes[offset + 7] << 8) | bytes[offset + 8];
    }
    if (![0xe1, 0xed, 0xfe].includes(marker)) chunks.push(bytes.slice(offset, offset + length + 2));
    offset += length + 2;
  }
  validateDimensions(width, height);
  return { bytes: concat(chunks), contentType: 'image/jpeg', extension: 'jpg', width, height };
}

function isWebp(bytes: Uint8Array) {
  return bytes.length > 20 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP';
}

function sanitizeWebp(bytes: Uint8Array): SanitizedImage {
  const chunks: Uint8Array[] = [];
  let offset = 12;
  let width = 0;
  let height = 0;
  while (offset + 8 <= bytes.length) {
    const type = ascii(bytes, offset, offset + 4);
    const size = readUint32Le(bytes, offset + 4);
    const padded = size + (size % 2);
    const end = offset + 8 + padded;
    if (end > bytes.length) throw new Error('The WebP file is malformed.');
    const dataOffset = offset + 8;
    if (type === 'ANIM' || type === 'ANMF') throw new Error('Animated logos are not supported.');
    if (type === 'VP8X' && size >= 10) {
      width = 1 + bytes[dataOffset + 4] + (bytes[dataOffset + 5] << 8) + (bytes[dataOffset + 6] << 16);
      height = 1 + bytes[dataOffset + 7] + (bytes[dataOffset + 8] << 8) + (bytes[dataOffset + 9] << 16);
      const clean = bytes.slice(offset, end);
      clean[8] &= ~(0x20 | 0x08 | 0x04);
      chunks.push(clean);
    } else if (type === 'VP8 ' && size >= 10) {
      width = (bytes[dataOffset + 6] | (bytes[dataOffset + 7] << 8)) & 0x3fff;
      height = (bytes[dataOffset + 8] | (bytes[dataOffset + 9] << 8)) & 0x3fff;
      chunks.push(bytes.slice(offset, end));
    } else if (type === 'VP8L' && size >= 5) {
      const b1 = bytes[dataOffset + 1];
      const b2 = bytes[dataOffset + 2];
      const b3 = bytes[dataOffset + 3];
      const b4 = bytes[dataOffset + 4];
      width = 1 + (((b2 & 0x3f) << 8) | b1);
      height = 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6));
      chunks.push(bytes.slice(offset, end));
    } else if (!['EXIF', 'XMP ', 'ICCP'].includes(type)) {
      chunks.push(bytes.slice(offset, end));
    }
    offset = end;
  }
  validateDimensions(width, height);
  const body = concat(chunks);
  const output = new Uint8Array(12 + body.length);
  output.set(new TextEncoder().encode('RIFF'), 0);
  writeUint32Le(output, 4, output.length - 8);
  output.set(new TextEncoder().encode('WEBP'), 8);
  output.set(body, 12);
  return { bytes: output, contentType: 'image/webp', extension: 'webp', width, height };
}

function isIco(bytes: Uint8Array) {
  return bytes.length > 22 && bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 && bytes[3] === 0;
}

function validateIco(bytes: Uint8Array): SanitizedImage {
  const width = bytes[6] || 256;
  const height = bytes[7] || 256;
  validateDimensions(width, height);
  return { bytes, contentType: 'image/x-icon', extension: 'ico', width, height };
}

function concat(chunks: Uint8Array[]) {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function ascii(bytes: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...bytes.slice(start, end));
}

function readUint32Le(bytes: Uint8Array, offset: number) {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function writeUint32Le(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
}
