import { describe, expect, it } from "vitest";
import { buildBaseline } from "./baseline";
import { hasUniformTax, optimize, optimizeWithWeight } from "./optimizer";
import {
  DEFAULT_FX,
  SAMPLE_PRIOR_REALIZED_GAIN,
  SAMPLE_SCENARIOS,
  SAMPLE_TARGET_CASH,
  buildSampleScenario,
  sampleHoldings,
} from "./sampleData";
import type { Holding, OptimizeInput, SellPlan } from "./types";

function makeInput(overrides: Partial<OptimizeInput> = {}): OptimizeInput {
  return {
    holdings: sampleHoldings,
    priorRealizedGain: SAMPLE_PRIOR_REALIZED_GAIN,
    targetCash: SAMPLE_TARGET_CASH,
    fxSell: DEFAULT_FX,
    portfolioWeight: 0.5,
    ...overrides,
  };
}

function qtyOf(plan: SellPlan, holdingId: string): number {
  return plan.lots.find((l) => l.holdingId === holdingId)?.sellQty ?? 0;
}

function assertValid(plan: SellPlan, input: OptimizeInput) {
  for (const lot of plan.lots) {
    const holding = input.holdings.find((h) => h.id === lot.holdingId);
    expect(holding, `알 수 없는 종목 ${lot.holdingId}`).toBeDefined();
    expect(Number.isInteger(lot.sellQty)).toBe(true);
    expect(lot.sellQty).toBeGreaterThanOrEqual(0);
    expect(lot.sellQty).toBeLessThanOrEqual(holding!.quantity);
    expect(holding!.locked).toBe(false);
  }
}

describe("제약 조건", () => {
  const input = makeInput();
  const result = optimize(input);

  it("조합은 1개 이상 3개 이하다", () => {
    expect(result.plans.length).toBeGreaterThan(0);
    expect(result.plans.length).toBeLessThanOrEqual(3);
  });

  it("모든 조합의 실수령액이 목표 금액 이상이다", () => {
    for (const plan of result.plans) {
      expect(plan.meetsTarget).toBe(true);
      expect(plan.netCash).toBeGreaterThanOrEqual(input.targetCash);
    }
  });

  it("모든 매도 수량이 정수이며 0 이상 보유 수량 이하다", () => {
    for (const plan of result.plans) assertValid(plan, input);
    assertValid(result.baseline, input);
  });

  it("실수령액은 매도 대금에서 세금을 뺀 값과 일치한다", () => {
    for (const plan of result.plans) {
      expect(plan.netCash).toBe(plan.grossProceeds - plan.tax);
      expect(plan.totalRealized).toBe(plan.realizedGain + input.priorRealizedGain);
    }
  });
});

describe("매도 제외(locked)", () => {
  const lockedInput = makeInput({
    holdings: sampleHoldings.map((h) =>
      h.ticker === "AAPL" || h.ticker === "PLTR" ? { ...h, locked: true } : h
    ),
  });

  it("locked 종목의 매도 수량은 항상 0이다", () => {
    const result = optimize(lockedInput);
    const locked = lockedInput.holdings.filter((h) => h.locked).map((h) => h.id);
    for (const plan of [...result.plans, result.baseline]) {
      for (const id of locked) expect(qtyOf(plan, id)).toBe(0);
    }
  });

  it("모든 종목이 locked면 아무것도 팔지 않는다", () => {
    const allLocked = makeInput({
      holdings: sampleHoldings.map((h) => ({ ...h, locked: true })),
    });
    const result = optimize(allLocked);
    for (const plan of result.plans) {
      expect(plan.lots).toHaveLength(0);
      expect(plan.meetsTarget).toBe(false);
    }
  });
});

describe("baseline 대비 절감", () => {
  it("이익·손실 종목이 섞인 시나리오에서 최적해의 세금이 baseline 이하다", () => {
    const input = makeInput();
    const result = optimize(input);
    expect(result.plans[0].tax).toBeLessThanOrEqual(result.baseline.tax);
    expect(result.savings).toBeGreaterThanOrEqual(0);
    expect(result.savings).toBe(result.baseline.tax - result.plans[0].tax);
  });

  it("예시 시나리오에서 실제로 세금을 줄인다", () => {
    const result = optimize(makeInput());
    expect(result.baseline.tax).toBeGreaterThan(0);
    expect(result.savings).toBeGreaterThan(0);
  });

  it("여러 무작위 시나리오에서도 baseline보다 나빠지지 않는다", () => {
    let seed = 12345;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };

    for (let trial = 0; trial < 12; trial++) {
      const holdings: Holding[] = Array.from({ length: 6 }, (_, i) => {
        const avg = 20 + rand() * 300;
        return {
          id: `h${i}`,
          ticker: `T${i}`,
          name: `종목${i}`,
          quantity: 10 + Math.floor(rand() * 200),
          avgBuyPrice: avg,
          currentPrice: avg * (0.4 + rand() * 1.6),
          locked: rand() < 0.15,
        };
      });
      const input = makeInput({
        holdings,
        priorRealizedGain: Math.round((rand() * 2 - 1) * 5_000_000),
        targetCash: Math.round(5_000_000 + rand() * 30_000_000),
      });

      const result = optimize(input);
      const baseline = buildBaseline(input);
      assertValid(result.plans[0], input);
      expect(result.plans[0].tax).toBeLessThanOrEqual(baseline.tax);
      if (baseline.meetsTarget) {
        expect(result.plans[0].meetsTarget).toBe(true);
        expect(result.plans[0].netCash).toBeGreaterThanOrEqual(input.targetCash);
      }
    }
  });
});

describe("포트폴리오 가중치", () => {
  it("가중치가 높을수록 비중 이탈이 작다", () => {
    const input = makeInput();
    const taxFirst = optimizeWithWeight(input, 0, "세금 최소");
    const keepWeights = optimizeWithWeight(input, 1, "비중 유지");
    expect(keepWeights.portfolioDrift).toBeLessThanOrEqual(taxFirst.portfolioDrift + 1e-9);
    expect(keepWeights.tax).toBeGreaterThanOrEqual(taxFirst.tax);
  });

  it("drift는 0과 1 사이다", () => {
    for (const plan of optimize(makeInput()).plans) {
      expect(plan.portfolioDrift).toBeGreaterThanOrEqual(0);
      expect(plan.portfolioDrift).toBeLessThanOrEqual(1);
    }
  });
});

describe("목표 금액이 과한 경우", () => {
  it("전량 매도로도 부족하면 meetsTarget이 false다", () => {
    const input = makeInput({ targetCash: 10_000_000_000 });
    const result = optimize(input);
    for (const plan of result.plans) {
      expect(plan.meetsTarget).toBe(false);
      assertValid(plan, input);
    }
  });

  it("목표 금액이 0이면 아무것도 팔지 않는다", () => {
    const result = optimize(makeInput({ targetCash: 0 }));
    expect(result.plans[0].grossProceeds).toBe(0);
  });
});

describe("성능", () => {
  it("30종목 포트폴리오도 2초 안에 끝난다", () => {
    const holdings: Holding[] = Array.from({ length: 30 }, (_, i) => ({
      id: `p${i}`,
      ticker: `P${i}`,
      name: `종목${i}`,
      quantity: 50 + i * 3,
      avgBuyPrice: 100,
      currentPrice: i % 3 === 0 ? 60 : 100 + i * 4,
      locked: false,
    }));
    const started = Date.now();
    const result = optimize(makeInput({ holdings, targetCash: 80_000_000 }));
    expect(Date.now() - started).toBeLessThan(2000);
    expect(result.plans[0].meetsTarget).toBe(true);
  });
});

describe("예시 시나리오", () => {
  const run = (id: string) => {
    const scenario = buildSampleScenario(id);
    return optimize({
      holdings: scenario.holdings,
      priorRealizedGain: scenario.priorRealizedGain,
      targetCash: scenario.targetCash,
      fxSell: scenario.fxSell,
      portfolioWeight: 0.5,
    });
  };

  it("두 시나리오는 같은 보유 종목에 목표 금액만 다르다", () => {
    const [relaxed, tight] = SAMPLE_SCENARIOS;
    expect(SAMPLE_SCENARIOS).toHaveLength(2);
    expect(tight.targetCash).toBeGreaterThan(relaxed.targetCash);
    expect(relaxed.holdings.map((h) => h.ticker)).toEqual(tight.holdings.map((h) => h.ticker));
    // 기획서 수치가 나오는 데이터라 손대지 않는다.
    expect(relaxed.targetCash).toBe(SAMPLE_TARGET_CASH);
    expect(relaxed.priorRealizedGain).toBe(SAMPLE_PRIOR_REALIZED_GAIN);
  });

  it("여유 시나리오는 세 조합의 세금이 모두 0원으로 같다", () => {
    const result = run("relaxed");
    expect(hasUniformTax(result.plans)).toBe(true);
    for (const plan of result.plans) expect(plan.tax).toBe(0);
    // 기획서에 실린 절감액
    expect(result.savings).toBe(4_770_392);
  });

  it("빡빡한 시나리오는 조합마다 세금이 갈려 트레이드오프가 드러난다", () => {
    const result = run("tight");
    expect(hasUniformTax(result.plans)).toBe(false);
    expect(result.plans.length).toBeGreaterThanOrEqual(2);

    // 세금이 오르는 만큼 포트폴리오는 더 지켜진다.
    const taxMin = result.plans[0];
    const keepWeights = result.plans[result.plans.length - 1];
    expect(keepWeights.tax).toBeGreaterThan(taxMin.tax);
    expect(keepWeights.portfolioDrift).toBeLessThan(taxMin.portfolioDrift);
    expect(result.savings).toBeGreaterThan(0);
  });
});

describe("hasUniformTax", () => {
  const plan = (tax: number): SellPlan => ({
    label: "테스트",
    lots: [],
    grossProceeds: 0,
    realizedGain: 0,
    totalRealized: 0,
    taxableBase: 0,
    tax,
    netCash: 0,
    portfolioDrift: 0,
    meetsTarget: true,
  });

  it("세금이 모두 같으면 참이다", () => {
    expect(hasUniformTax([plan(0), plan(0), plan(0)])).toBe(true);
    expect(hasUniformTax([plan(500), plan(500)])).toBe(true);
  });

  it("하나라도 다르면 거짓이다", () => {
    expect(hasUniformTax([plan(0), plan(0), plan(1)])).toBe(false);
  });

  it("조합이 하나뿐이면 비교할 대상이 없으므로 거짓이다", () => {
    expect(hasUniformTax([plan(0)])).toBe(false);
    expect(hasUniformTax([])).toBe(false);
  });
});
