import type { Holding, OptimizeInput, SellPlan } from "./types";

/** 연 기본공제 250만원 */
export const BASIC_DEDUCTION = 2_500_000;
/** 양도소득세 20% + 지방소득세 2% */
export const TAX_RATE = 0.22;

/** 원 단위 반올림. 부동소수 오차(예: 550000.0000000001)를 제거한다. */
export function roundWon(value: number): number {
  return Math.round(value);
}

/**
 * 종목 1주를 매도했을 때의 원화 실현손익.
 * 원화 기준 과세이므로 매수 환율과 매도 환율을 각각 적용해 환차손익까지 반영한다.
 * fxBuy 미입력 시 fxSell을 사용한다(= 환차손익 0으로 간주).
 */
export function calcPerShareGain(holding: Holding, fxSell: number): number {
  const fxBuy = holding.fxBuy ?? fxSell;
  return holding.currentPrice * fxSell - holding.avgBuyPrice * fxBuy;
}

/** 1주 매도 시 원화 매도 대금 (세전) */
export function calcPerShareProceeds(holding: Holding, fxSell: number): number {
  return holding.currentPrice * fxSell;
}

/** 연간 실현손익 합계 → 과세표준 */
export function calcTaxableBase(realizedTotal: number): number {
  return Math.max(0, realizedTotal - BASIC_DEDUCTION);
}

/**
 * 연간 실현손익 합계 → 세액.
 * 손익통산 후 기본공제를 적용하며, 순손실이어도 세액은 0이다(이월결손금 공제 없음).
 */
export function calcTax(realizedTotal: number): number {
  return roundWon(calcTaxableBase(realizedTotal) * TAX_RATE);
}

/**
 * 매도 전후 비중 벡터의 L1 거리 절반 (0~1).
 * 전량 청산이면 매도 후 비중을 정의할 수 없으므로 1로 처리한다.
 */
export function calcPortfolioDrift(
  holdings: Holding[],
  sellQty: number[],
  fxSell: number
): number {
  const beforeValues = holdings.map((h) => h.quantity * calcPerShareProceeds(h, fxSell));
  const afterValues = holdings.map(
    (h, i) => (h.quantity - sellQty[i]) * calcPerShareProceeds(h, fxSell)
  );
  const totalBefore = beforeValues.reduce((a, b) => a + b, 0);
  const totalAfter = afterValues.reduce((a, b) => a + b, 0);

  if (totalBefore <= 0) return 0;
  if (totalAfter <= 0) return 1;

  let sum = 0;
  for (let i = 0; i < holdings.length; i++) {
    sum += Math.abs(beforeValues[i] / totalBefore - afterValues[i] / totalAfter);
  }
  return 0.5 * sum;
}

/**
 * 매도 수량 벡터(holdings와 같은 순서)를 SellPlan으로 평가한다.
 * 순수 함수 — 입력을 변형하지 않는다.
 */
export function evaluatePlan(
  sellQty: number[],
  input: OptimizeInput,
  label: string
): SellPlan {
  const { holdings, fxSell, priorRealizedGain, targetCash } = input;

  let grossProceeds = 0;
  let realizedGain = 0;
  const lots: SellPlan["lots"] = [];

  for (let i = 0; i < holdings.length; i++) {
    const qty = sellQty[i];
    if (qty <= 0) continue;
    const h = holdings[i];
    grossProceeds += qty * calcPerShareProceeds(h, fxSell);
    realizedGain += qty * calcPerShareGain(h, fxSell);
    lots.push({ holdingId: h.id, sellQty: qty });
  }

  grossProceeds = roundWon(grossProceeds);
  realizedGain = roundWon(realizedGain);

  const totalRealized = realizedGain + priorRealizedGain;
  const taxableBase = roundWon(calcTaxableBase(totalRealized));
  const tax = calcTax(totalRealized);
  const netCash = grossProceeds - tax;

  return {
    label,
    lots,
    grossProceeds,
    realizedGain,
    totalRealized,
    taxableBase,
    tax,
    netCash,
    portfolioDrift: calcPortfolioDrift(holdings, sellQty, fxSell),
    meetsTarget: netCash >= targetCash,
  };
}
