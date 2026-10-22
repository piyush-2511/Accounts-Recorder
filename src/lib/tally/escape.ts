/** Characters XML 1.0 forbids (control chars except tab, LF, CR; and U+FFFE / U+FFFF). */
const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/** Escapes text for use inside an XML element or attribute. */
export function escapeXml(value: string): string {
  return value
    .replace(INVALID_XML, "")
    .replace(LONE_SURROGATE, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Narrations go on one line in Tally. */
export function singleLine(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
}
