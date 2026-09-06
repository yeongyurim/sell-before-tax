import { calcPerShareGain, calcPerShareProceeds, calcTax, evaluatePlan, roundWon } from "./tax";
import type { OptimizeInput, SellPlan } from "./types";

/**
 * 매도 수량 벡터의 실수령액 (drift·lots 계산을 생략한 경량 버전).
 * 각 x_i에 대해 단조증가한다: 1주 추가 매도의 순증가분 = 매도대금 - 한계세율 × 주당이익이고,
 * 주당이익 ≤ 매도대금이므로 최소 0.78 × 매도대금 만큼 늘어난다. 따라서 이분탐색이 성립한다.
 */
export function netCashOf(sellQty: number[], input: OptimizeInput): number {
  const { holdings, fxSell, priorRealizedGain } = input;
  let gross = 0;
  let gain = 0;
  for (let i = 0; i < holdings.length; i++) {
    const qty = sellQty[i];
    if (qty <= 0) continue;
    gross += qty * calcPerShareProceeds(holdings[i], fxSell);
    gain += qty * calcPerShareGain(holdings[i], fxSell);
  }
  return roundWon(gross) - calcTax(roundWon(gain) + priorRealizedGain);
}

export interface FillOptions {
  /** 이번 매도로 발생시킬 실현이익의 상한 (기본공제 한도 맞추기용). 손실 종목에는 적용하지 않는다. */
  gainCap?: number;
  /** 이미 매도가 확정된 수량 벡터에서 이어서 채운다. */
  start?: number[];
}

/**
 * 주어진 우선순위(order: holdings 인덱스 배열)대로 목표 실수령액을 채울 때까지 매도한다.
 * 각 종목마다 목표를 만족하는 최소 수량을 이분탐색으로 찾아 과매도를 피한다.
 * 목표에 도달하지 못하면 가능한 만큼 전부 매도한 결과를 돌려준다.
 */
export function fillToTarget(
  input: OptimizeInput,
  order: number[],
  options: FillOptions = {}
): number[] {
  const { holdings, fxSell, targetCash } = input;
  const sellQty: number[] = options.start
    ? options.start.slice()
    : new Array(holdings.length).fill(0);

  if (netCashOf(sellQty, input) >= targetCash) return sellQty;

  let gainBudget = options.gainCap;
  if (gainBudget !== undefined) {
    // 이미 매도가 확정된 물량이 소진한 이익을 예산에서 뺀다.
    for (let i = 0; i < holdings.length; i++) {
      const g = calcPerShareGain(holdings[i], fxSell);
      if (g > 0) gainBudget -= sellQty[i] * g;
    }
  }

  for (const i of order) {
    const h = holdings[i];
    if (h.locked) continue;

    let capacity = h.quantity - sellQty[i];
    if (capacity <= 0) continue;

    const perShareGain = calcPerShareGain(h, fxSell);
    if (gainBudget !== undefined && perShareGain > 0) {
      capacity = Math.min(capacity, Math.max(0, Math.floor(gainBudget / perShareGain)));
      if (capacity <= 0) continue;
    }

    const base = sellQty[i];

    // 전량(capacity)으로도 목표에 못 미치면 전량 매도하고 다음 종목으로 넘어간다.
    sellQty[i] = base + capacity;
    if (netCashOf(sellQty, input) < targetCash) {
      if (gainBudget !== undefined && perShareGain > 0) gainBudget -= capacity * perShareGain;
      continue;
    }

    // 목표를 만족하는 최소 수량을 이분탐색으로 찾는다.
    let lo = 1;
    let hi = capacity;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      sellQty[i] = base + mid;
      if (netCashOf(sellQty, input) >= targetCash) hi = mid;
      else lo = mid + 1;
    }
    sellQty[i] = base + lo;
    return sellQty;
  }

  return sellQty;
}

function returnRate(h: { currentPrice: number; avgBuyPrice: number }): number {
  if (h.avgBuyPrice <= 0) return Number.POSITIVE_INFINITY;
  return h.currentPrice / h.avgBuyPrice - 1;
}

/**
 * 비교 기준: 수익률(현재가/평균단가 - 1) 높은 순으로 목표 금액을 채울 때까지 매도.
 * 대부분의 투자자가 실제로 하는 방식이며, 절감액 비교의 기준이 된다.
 */
export function buildBaselineLots(input: OptimizeInput): number[] {
  const { holdings } = input;
  const order = holdings
    .map((_, i) => i)
    .filter((i) => !holdings[i].locked && holdings[i].quantity > 0)
    .sort((a, b) => returnRate(holdings[b]) - returnRate(holdings[a]));

  return fillToTarget(input, order);
}

export function buildBaseline(input: OptimizeInput): SellPlan {
  return evaluatePlan(buildBaselineLots(input), input, "단순 매도");
}
