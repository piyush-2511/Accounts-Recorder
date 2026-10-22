import JSZip from "jszip";

export interface ZipFile {
  name: string;
  data: Uint8Array;
}

/** Bundles voucher files (named by Tally voucher number) into a ZIP for auditors. */
export async function buildVoucherZip(files: ZipFile[]): Promise<Uint8Array> {
  const zip = new JSZip();
  const used = new Set<string>();
  for (const f of files) {
    let name = f.name;
    let i = 2;
    while (used.has(name)) name = f.name.replace(/(\.[^.]+)?$/, `-${i++}$1`);
    used.add(name);
    zip.file(name, f.data);
  }
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
