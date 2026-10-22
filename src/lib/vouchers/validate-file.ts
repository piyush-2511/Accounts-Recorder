import { ALLOWED_VOUCHER_MIMES, MAX_VOUCHER_BYTES, MIN_PHOTO_BYTES, type VoucherMime } from "./constants";

/** Detect the real file type from magic bytes. Never trust the client-supplied MIME type. */
export function detectMime(bytes: Uint8Array): VoucherMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) {
    return "application/pdf"; // %PDF-
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export type VoucherCheck =
  | { ok: true; mime: VoucherMime; size: number; warning?: string }
  | { ok: false; error: string };

/** Validates a voucher given its size and leading bytes. Used on the server for every upload. */
export function validateVoucher(size: number, head: Uint8Array): VoucherCheck {
  if (size <= 0) return { ok: false, error: "The voucher file is empty." };
  if (size > MAX_VOUCHER_BYTES) {
    return { ok: false, error: `The voucher is ${Math.ceil(size / 1024)} KB. The maximum is 200 KB.` };
  }
  const mime = detectMime(head);
  if (!mime || !ALLOWED_VOUCHER_MIMES.includes(mime)) {
    return { ok: false, error: "Only JPEG, WebP or PDF vouchers are allowed." };
  }
  if (mime !== "application/pdf" && size < MIN_PHOTO_BYTES) {
    return { ok: true, mime, size, warning: "This photo is very small and may be unreadable." };
  }
  return { ok: true, mime, size };
}
