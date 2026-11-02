// Accept Persian/Arabic digits and a comma or Arabic decimal mark when typing numbers.
export function parseNumber(raw) {
  const ascii = String(raw)
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[,٫]/g, ".")
    .trim();
  return ascii === "" ? NaN : Number(ascii);
}

export const formatGains = (params) =>
  Object.entries(params).map(([k, v]) => `${k} ${+v.toFixed(2)}`).join(", ");
