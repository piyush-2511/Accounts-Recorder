import { MAX_INPUT_BYTES, MAX_VOUCHER_BYTES, MIN_PHOTO_BYTES, TARGET_VOUCHER_BYTES } from "./constants";

export type Encode = (maxDim: number, quality: number) => Promise<Blob>;

export interface CompressOptions {
  startDim?: number;
  minDim?: number;
  maxBytes?: number;
  qualities?: number[];
  shrink?: number;
}

export interface CompressResult {
  blob: Blob;
  dim: number;
  quality: number;
  attempts: number;
}

export class VoucherTooLargeError extends Error {
  constructor() {
    super("Could not reduce this image to under 200 KB. Try a closer, less detailed photo.");
    this.name = "VoucherTooLargeError";
  }
}

/**
 * Encode with decreasing quality, then decreasing dimensions, until the result fits.
 * Quality runs 0.8 -> 0.4 at each size; the long side starts at 1600 px and shrinks 15% per round.
 * The encoder is injected so the search logic is testable without a browser.
 */
export async function compressToBudget(encode: Encode, options: CompressOptions = {}): Promise<CompressResult> {
  const {
    startDim = 1600,
    minDim = 600,
    maxBytes = TARGET_VOUCHER_BYTES,
    qualities = [0.8, 0.7, 0.6, 0.5, 0.4],
    shrink = 0.85,
  } = options;

  let dim = startDim;
  let attempts = 0;
  while (dim >= minDim) {
    for (const quality of qualities) {
      attempts++;
      const blob = await encode(dim, quality);
      if (blob.size <= maxBytes) return { blob, dim, quality, attempts };
    }
    dim = Math.floor(dim * shrink);
  }
  throw new VoucherTooLargeError();
}

export interface PreparedVoucher {
  file: File;
  /** True when a photo ended up below 50 KB: the recorder must confirm it is still readable. */
  belowMinimum: boolean;
}

/**
 * Browser entry point: turns a picked photo or PDF into a file that fits the 200 KB budget.
 * Throws an Error with a user-readable message when it cannot.
 */
export async function prepareVoucherFile(input: File): Promise<PreparedVoucher> {
  if (input.size > MAX_INPUT_BYTES) throw new Error("That file is too large. Please choose a photo under 25 MB.");

  if (input.type === "application/pdf") {
    if (input.size > MAX_VOUCHER_BYTES) {
      throw new Error("This PDF is over 200 KB. Please take a photo of the voucher instead.");
    }
    return { file: input, belowMinimum: false };
  }
  if (!input.type.startsWith("image/")) throw new Error("Please choose a photo (JPEG, PNG, WebP) or a PDF.");

  const bitmap = await createImageBitmap(input, { imageOrientation: "from-image" });
  try {
    // Already small enough and a supported format: keep the original bytes untouched.
    const fits = input.size <= TARGET_VOUCHER_BYTES;
    if (fits && (input.type === "image/jpeg" || input.type === "image/webp") && Math.max(bitmap.width, bitmap.height) <= 1600) {
      return { file: input, belowMinimum: input.size < MIN_PHOTO_BYTES };
    }

    const encode: Encode = (maxDim, quality) => {
      const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return Promise.reject(new Error("Your browser cannot process images."));
      ctx.fillStyle = "#ffffff"; // flatten transparency (PNG) onto white
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(bitmap, 0, 0, width, height);
      return new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Image encoding failed."))), "image/jpeg", quality),
      );
    };

    const { blob } = await compressToBudget(encode);
    const name = input.name.replace(/\.[^.]+$/, "") || "voucher";
    const file = new File([blob], `${name}.jpg`, { type: "image/jpeg" });
    return { file, belowMinimum: file.size < MIN_PHOTO_BYTES };
  } finally {
    bitmap.close();
  }
}
