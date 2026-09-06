import { buildBaseline, buildBaselineLots, fillToTarget, netCashOf } from "./baseline";
import {
  BASIC_DEDUCTION,
  calcPerShareGain,
  calcPerShareProceeds,
  calcTax,
  evaluatePlan,
  roundWon,
} from "./tax";
import type { OptimizeInput, OptimizeResult, SellPlan } from "./types";

/** drift(0~1)를 원화 단위로 환산하는 계수. cost = tax + weight × DRIFT_SCALE × drift */
export const DRIFT_SCALE_RATIO = 0.1;
/**
 * 필요 이상으로 매도한 금액에 붙이는 아주 작은 벌점.
 * 세액이 같은 해가 여러 개일 때 "덜 파는 쪽"을 고르게 하는 동점 해소 장치이며,
 * 1원의 세금 차이도 뒤집지 못할 만큼 작게 잡는다.
 */
export const EXCESS_CASH_PENALTY = 1e-9;
/** 국소탐색 시간 예산 (가중치 1개당) */
export const TIME_BUDGET_MS = 200;
/** 국소탐색 최대 이동 횟수 */
export const MAX_ITERATIONS = 5000;
export const RANDOM_RESTARTS = 3;

const PLAN_WEIGHTS: { weight: number; label: string }[] = [
  { weight: 0, label: "세금 최소" },
  { weight: 0.5, label: "균형" },
  { weight: 1, label: "비중 유지" },
];

const now = (): number =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

interface Ctx {
  input: OptimizeInput;
  n: number;
  maxQty: number[];
  sellable: number[];
  unitProceeds: number[];
  perShareGain: number[];
  beforeValue: number[];
  totalBefore: number;
  deltas: number[][];
  driftScale: number;
  weight: number;
}

function makeCtx(input: OptimizeInput, weight: number): Ctx {
  const { holdings, fxSell } = input;
  const n = holdings.length;
  const maxQty: number[] = [];
  const unitProceeds: number[] = [];
  const perShareGain: number[] = [];
  const beforeValue: number[] = [];
  const sellable: number[] = [];
  const deltas: number[][] = [];

  for (let i = 0; i < n; i++) {
    const h = holdings[i];
    const q = Math.max(0, Math.floor(h.quantity));
    const up = calcPerShareProceeds(h, fxSell);
    maxQty.push(h.locked ? 0 : q);
    unitProceeds.push(up);
    perShareGain.push(calcPerShareGain(h, fxSell));
    beforeValue.push(q * up);
    if (!h.locked && q > 0 && up > 0) sellable.push(i);
    // 이웃 생성 폭: ±1, ±5, ±10, ±(보유수량의 5%)
    const pct = Math.max(1, Math.round(q * 0.05));
    deltas.push(Array.from(new Set([1, 5, 10, pct])).sort((a, b) => a - b));
  }

  return {
    input,
    n,
    maxQty,
    sellable,
    unitProceeds,
    perShareGain,
    beforeValue,
    totalBefore: beforeValue.reduce((a, b) => a + b, 0),
    deltas,
    driftScale: Math.max(input.targetCash, 1) * DRIFT_SCALE_RATIO,
    weight,
  };
}

/** 목적함수. 제약(netCash ≥ targetCash) 위반은 큰 벌점으로 처리해 국소탐색이 스스로 복구하게 한다. */
function evalCost(ctx: Ctx, x: number[]): number {
  const { input } = ctx;
  let gross = 0;
  let gain = 0;
  for (let i = 0; i < ctx.n; i++) {
    const qty = x[i];
    if (qty <= 0) continue;
    gross += qty * ctx.unitProceeds[i];
    gain += qty * ctx.perShareGain[i];
  }

  const tax = calcTax(roundWon(gain) + input.priorRealizedGain);
  const netCash = roundWon(gross) - tax;

  let drift: number;
  const totalAfter = ctx.totalBefore - gross;
  if (ctx.totalBefore <= 0) {
    drift = 0;
  } else if (totalAfter <= 0) {
    drift = 1;
  } else {
    let sum = 0;
    for (let i = 0; i < ctx.n; i++) {
      const after = ctx.beforeValue[i] - x[i] * ctx.unitProceeds[i];
      sum += Math.abs(ctx.beforeValue[i] / ctx.totalBefore - after / totalAfter);
    }
    drift = 0.5 * sum;
  }

  let cost = tax + ctx.weight * ctx.driftScale * drift;
  const shortfall = input.targetCash - netCash;
  if (shortfall > 0) cost += 1e12 + shortfall;
  else cost += EXCESS_CASH_PENALTY * -shortfall;
  return cost;
}

const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

/** 결정론적 난수 (mulberry32) — 같은 입력이면 항상 같은 결과가 나오도록 고정 시드를 쓴다. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface ClimbResult {
  x: number[];
  cost: number;
}

/**
 * 국소탐색 (steepest-ascent hill climbing).
 * 이웃: (a) 한 종목 수량을 ±1/±5/±10/±5% 변경 (b) 두 종목 간 매도 금액을 유지한 수량 교환.
 */
function hillClimb(ctx: Ctx, start: number[], deadline: number): ClimbResult {
  const x = start.slice();
  for (let i = 0; i < ctx.n; i++) x[i] = clamp(Math.round(x[i]), 0, ctx.maxQty[i]);

  let cost = evalCost(ctx, x);
  const { sellable } = ctx;

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    if (now() > deadline) break;

    let bestCost = cost;
    let moveI = -1;
    let moveIValue = 0;
    let moveJ = -1;
    let moveJValue = 0;

    // (a) 단일 종목 수량 변경
    for (const i of sellable) {
      const orig = x[i];
      for (const d of ctx.deltas[i]) {
        for (const sign of [1, -1]) {
          const v = clamp(orig + sign * d, 0, ctx.maxQty[i]);
          if (v === orig) continue;
          x[i] = v;
          const c = evalCost(ctx, x);
          if (c < bestCost - 1e-9) {
            bestCost = c;
            moveI = i;
            moveIValue = v;
            moveJ = -1;
          }
        }
      }
      x[i] = orig;
    }

    // (b) 두 종목 간 교환 (매도 금액을 대략 유지)
    for (const i of sellable) {
      if (x[i] <= 0) continue;
      for (const j of sellable) {
        if (i === j || x[j] >= ctx.maxQty[j]) continue;
        const origI = x[i];
        const origJ = x[j];
        for (const d of [1, 5, 10]) {
          if (origI < d) continue;
          const moved = Math.max(
            1,
            Math.round((d * ctx.unitProceeds[i]) / ctx.unitProceeds[j])
          );
          const vi = origI - d;
          const vj = clamp(origJ + moved, 0, ctx.maxQty[j]);
          if (vj === origJ) continue;
          x[i] = vi;
          x[j] = vj;
          const c = evalCost(ctx, x);
          if (c < bestCost - 1e-9) {
            bestCost = c;
            moveI = i;
            moveIValue = vi;
            moveJ = j;
            moveJValue = vj;
          }
        }
        x[i] = origI;
        x[j] = origJ;
      }
    }

    if (moveI < 0) break; // 개선되는 이웃이 없으면 종료
    x[moveI] = moveIValue;
    if (moveJ >= 0) x[moveJ] = moveJValue;
    cost = bestCost;
  }

  return { x, cost };
}

function sellableOrder(ctx: Ctx, key: (i: number) => number): number[] {
  return ctx.sellable.slice().sort((a, b) => key(a) - key(b));
}

/** 평가손실 종목을 전량 매도 → 부족분을 주당이익 낮은 순으로 채운다. */
function greedyLossFirst(ctx: Ctx): number[] {
  const start = new Array(ctx.n).fill(0);
  for (const i of ctx.sellable) {
    if (ctx.perShareGain[i] < 0) start[i] = ctx.maxQty[i];
  }
  const order = sellableOrder(ctx, (i) => ctx.perShareGain[i]);
  return fillToTarget(ctx.input, order, { start });
}

/**
 * 실현손익 합계가 기본공제 한도에 최대한 근접하도록 채운다.
 * 우선순위는 "매도 대금 1원당 발생하는 이익"이 작은 순 — 손실 종목이 먼저 온다.
 */
function greedyDeductionFit(ctx: Ctx): number[] {
  const order = sellableOrder(
    ctx,
    (i) => ctx.perShareGain[i] / ctx.unitProceeds[i]
  );
  const room = Math.max(0, BASIC_DEDUCTION - ctx.input.priorRealizedGain);
  const capped = fillToTarget(ctx.input, order, { gainCap: room });
  if (netCashOf(capped, ctx.input) >= ctx.input.targetCash) return capped;
  // 공제 한도 안에서 목표를 못 채우면 한도를 풀고 이어서 채운다.
  return fillToTarget(ctx.input, order, { start: capped });
}

/** 모든 종목을 현재 비중대로 균등 비율 매도 (drift 최소) */
function greedyProRata(ctx: Ctx): number[] {
  const vectorAt = (f: number): number[] => {
    const x = new Array(ctx.n).fill(0);
    for (const i of ctx.sellable) {
      x[i] = clamp(Math.round(f * ctx.maxQty[i]), 0, ctx.maxQty[i]);
    }
    return x;
  };

  const full = vectorAt(1);
  if (netCashOf(full, ctx.input) < ctx.input.targetCash) return full;

  let lo = 0;
  let hi = 1;
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    if (netCashOf(vectorAt(mid), ctx.input) >= ctx.input.targetCash) hi = mid;
    else lo = mid;
  }
  // hi는 항상 목표를 만족한다. 반올림 때문에 미달하는 경우를 대비해 한 번 더 채운다.
  const x = vectorAt(hi);
  if (netCashOf(x, ctx.input) >= ctx.input.targetCash) return x;
  return fillToTarget(ctx.input, sellableOrder(ctx, (i) => ctx.perShareGain[i]), {
    start: x,
  });
}

/** 현재 해 주변을 흔든 뒤 제약을 복구한다 (랜덤 재시작용) */
function perturb(ctx: Ctx, x: number[], rng: () => number): number[] {
  const next = x.slice();
  for (const i of ctx.sellable) {
    if (rng() > 0.5) continue;
    const span = Math.max(1, Math.round(ctx.maxQty[i] * 0.3));
    next[i] = clamp(next[i] + Math.round((rng() * 2 - 1) * span), 0, ctx.maxQty[i]);
  }
  const order = sellableOrder(ctx, (i) => ctx.perShareGain[i] / ctx.unitProceeds[i]);
  return fillToTarget(ctx.input, order, { start: next });
}

/** 가중치 1개에 대한 최적화. 초기해 4종 → 국소탐색 → 랜덤 재시작 3회. */
export function optimizeWithWeight(
  input: OptimizeInput,
  weight: number,
  label: string
): SellPlan {
  const ctx = makeCtx(input, weight);
  const deadline = now() + TIME_BUDGET_MS;

  const seeds = [
    greedyLossFirst(ctx),
    greedyDeductionFit(ctx),
    greedyProRata(ctx),
    // 단순 매도도 초기해에 넣어, 최적해가 baseline보다 나빠지지 않도록 보장한다.
    buildBaselineLots(input),
  ];

  let best: ClimbResult | null = null;
  for (const seed of seeds) {
    const result = hillClimb(ctx, seed, deadline);
    if (!best || result.cost < best.cost) best = result;
  }

  const rng = mulberry32(0x5eed);
  for (let k = 0; k < RANDOM_RESTARTS && now() < deadline; k++) {
    const result = hillClimb(ctx, perturb(ctx, best!.x, rng), deadline);
    if (result.cost < best!.cost) best = result;
  }

  return evaluatePlan(best!.x, input, label);
}

const signatureOf = (plan: SellPlan): string =>
  plan.lots
    .map((l) => `${l.holdingId}:${l.sellQty}`)
    .sort()
    .join("|");

/**
 * portfolioWeight를 0 / 0.5 / 1로 각각 돌려 매도 조합 3종을 만든다.
 * (input.portfolioWeight는 이 함수에서 사용하지 않는다 — 단일 가중치 실행은 optimizeWithWeight)
 * 완전히 같은 조합은 하나로 합쳐 최대 3개를 돌려준다.
 */
export function optimize(input: OptimizeInput): OptimizeResult {
  const baseline = buildBaseline(input);
  const plans: SellPlan[] = [];
  const seen = new Set<string>();

  for (const { weight, label } of PLAN_WEIGHTS) {
    const plan = optimizeWithWeight(input, weight, label);
    const signature = signatureOf(plan);
    if (seen.has(signature)) continue;
    seen.add(signature);
    plans.push(plan);
  }

  return {
    plans,
    baseline,
    savings: plans.length > 0 ? baseline.tax - plans[0].tax : 0,
  };
}
