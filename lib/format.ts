const krwFormatter = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });

/** 1234567 → "1,234,567원" */
export function formatKRW(value: number): string {
  return `${krwFormatter.format(Math.round(value))}원`;
}

/** 부호를 항상 붙인다. 손익 표시용. 1234567 → "+1,234,567원" */
export function formatSignedKRW(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded > 0 ? "+" : rounded < 0 ? "-" : "";
  return `${sign}${krwFormatter.format(Math.abs(rounded))}원`;
}

/** 단위 없는 천 단위 구분 숫자 */
export function formatNumber(value: number, fractionDigits = 0): string {
  return new Intl.NumberFormat("ko-KR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

/** 232 → "$232.00" */
export function formatUSD(value: number): string {
  return `$${formatNumber(value, 2)}`;
}

/** 0.937 → "93.7%" */
export function formatPercent(ratio: number, fractionDigits = 1): string {
  return `${formatNumber(ratio * 100, fractionDigits)}%`;
}

/** 0.0842 → "+8.4%" (수익률 표시용) */
export function formatSignedPercent(ratio: number, fractionDigits = 1): string {
  const sign = ratio > 0 ? "+" : "";
  return `${sign}${formatNumber(ratio * 100, fractionDigits)}%`;
}

/**
 * 사용자가 입력한 문자열에서 숫자를 뽑는다.
 * 쉼표·공백·원·달러 기호를 허용하고, 숫자가 아니면 null을 돌려준다.
 */
export function parseNumeric(raw: string): number | null {
  const cleaned = raw.replace(/[,\s₩원$]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === "." || cleaned === "-.") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}
