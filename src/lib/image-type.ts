/**
 * Magic-byte sniffing for uploads (tech spec § 7): the declared MIME type is
 * never trusted. HEIC/HEIF is recognised only to answer with a clear 415; the
 * device converts it before upload (decision 011). Pure, shared by the route
 * and its tests.
 */

export type SniffedImageType = 'jpeg' | 'png' | 'webp' | 'heic' | 'unknown';

export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

const HEIC_BRANDS = ['heic', 'heix', 'mif1', 'hevc', 'heif', 'msf1', 'hevx'];

export function sniffImageType(bytes: Uint8Array): SniffedImageType {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpeg';
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'png';
  }
  const ascii = (start: number, end: number) =>
    String.fromCharCode(...bytes.subarray(start, Math.min(end, bytes.length)));
  if (bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp';
  if (bytes.length >= 12 && ascii(4, 8) === 'ftyp' && HEIC_BRANDS.includes(ascii(8, 12))) {
    return 'heic';
  }
  return 'unknown';
}
