import { describe, expect, it } from "vitest";
import { buildVoucherZip } from "../zip";
import { compressToBudget, VoucherTooLargeError } from "../compress-image";
import { MAX_VOUCHER_BYTES } from "../constants";
import { detectMime, validateVoucher } from "../validate-file";
import JSZip from "jszip";

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const pdf = new TextEncoder().encode("%PDF-1.7 rest");
const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);

describe("validateVoucher", () => {
  it("accepts JPEG, WebP and PDF within 200 KB", () => {
    expect(validateVoucher(120_000, jpeg)).toMatchObject({ ok: true, mime: "image/jpeg" });
    expect(validateVoucher(120_000, webp)).toMatchObject({ ok: true, mime: "image/webp" });
    expect(validateVoucher(150_000, pdf)).toMatchObject({ ok: true, mime: "application/pdf" });
  });
  it("accepts exactly 200 KB and rejects one byte more", () => {
    expect(validateVoucher(MAX_VOUCHER_BYTES, jpeg).ok).toBe(true);
    const r = validateVoucher(MAX_VOUCHER_BYTES + 1, jpeg);
    expect(r.ok).toBe(false);
  });
  it("warns for photos under 50 KB but not for small PDFs", () => {
    expect(validateVoucher(20_000, jpeg)).toMatchObject({ ok: true, warning: expect.any(String) });
    expect(validateVoucher(20_000, pdf)).not.toHaveProperty("warning");
  });
  it("rejects empty files and files whose bytes are not an allowed type (even if named .jpg)", () => {
    expect(validateVoucher(0, jpeg).ok).toBe(false);
    expect(validateVoucher(1000, new TextEncoder().encode("<script>alert(1)</script>")).ok).toBe(false);
    expect(detectMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull(); // PNG is converted client-side, never stored
  });
});

describe("compressToBudget", () => {
  it("returns on the first attempt when it already fits", async () => {
    const r = await compressToBudget(async () => new Blob([new Uint8Array(100_000)]));
    expect(r).toMatchObject({ dim: 1600, quality: 0.8, attempts: 1 });
  });

  it("lowers quality first, then shrinks dimensions, until under 190 KB", async () => {
    const calls: [number, number][] = [];
    // size grows with dimension^2 and quality
    const encode = async (dim: number, q: number) => {
      calls.push([dim, q]);
      return new Blob([new Uint8Array(Math.round(dim * dim * q * 0.3))]);
    };
    const r = await compressToBudget(encode);
    expect(r.blob.size).toBeLessThanOrEqual(190 * 1024);
    // qualities are exhausted at 1600 before the dimension is reduced
    expect(calls.slice(0, 5).map((c) => c[0])).toEqual([1600, 1600, 1600, 1600, 1600]);
    expect(calls.slice(0, 5).map((c) => c[1])).toEqual([0.8, 0.7, 0.6, 0.5, 0.4]);
    expect(calls[5]?.[0]).toBe(1360);
  });

  it("final result is always within the hard 200 KB cap", async () => {
    const r = await compressToBudget(async (dim, q) => new Blob([new Uint8Array(Math.round(dim * dim * q * 0.2))]));
    expect(r.blob.size).toBeLessThanOrEqual(MAX_VOUCHER_BYTES);
  });

  it("gives up with a clear error when nothing fits", async () => {
    await expect(compressToBudget(async () => new Blob([new Uint8Array(500_000)]))).rejects.toBeInstanceOf(VoucherTooLargeError);
  });
});

describe("buildVoucherZip", () => {
  it("bundles files and de-duplicates names", async () => {
    const bytes = await buildVoucherZip([
      { name: "1.jpg", data: jpeg },
      { name: "1.jpg", data: jpeg },
      { name: "2.pdf", data: pdf },
    ]);
    const zip = await JSZip.loadAsync(bytes);
    expect(Object.keys(zip.files).sort()).toEqual(["1-2.jpg", "1.jpg", "2.pdf"]);
  });
});
