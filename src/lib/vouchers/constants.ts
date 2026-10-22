/** Voucher (bill / receipt) upload limits. 200 KB is a hard cap enforced in browser, server and bucket. */
export const MAX_VOUCHER_BYTES = 200 * 1024; // 204,800 - matches the Storage bucket limit
export const TARGET_VOUCHER_BYTES = 190 * 1024; // compression aims below this to leave headroom
export const MIN_PHOTO_BYTES = 50 * 1024; // photos below this trigger a "may be unreadable" warning
export const MAX_INPUT_BYTES = 25 * 1024 * 1024; // refuse to even try compressing something huge
export const ALLOWED_VOUCHER_MIMES = ["image/jpeg", "image/webp", "application/pdf"] as const;
export type VoucherMime = (typeof ALLOWED_VOUCHER_MIMES)[number];
export const MIME_EXTENSION: Record<VoucherMime, string> = {
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "application/pdf": "pdf",
};
