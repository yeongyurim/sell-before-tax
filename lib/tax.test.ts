import { describe, expect, it } from "vitest";
import {
  BASIC_DEDUCTION,
  TAX_RATE,
  calcPerShareGain,
  calcPortfolioDrift,
  calcTax,
  calcTaxableBase,
  evaluatePlan,
} from "./tax";
import type { Holding, OptimizeInput } from "./types";

/** 주당이익이 정확히 `gain`원이 되는 더미 종목 (fxSell = 1 기준) */
function holdingWithGain(id: string, gain: number, quantity = 1): Holding {
  return {
    id,
    ticker: id.toUpperCase(),
    name: id,
    quantity,
    avgBuyPrice: 1_000_000,
    currentPrice: 1_000_000 + gain,
    locked: false,
  };
}

function inputWith(prior: number, holdings: Holding[]): OptimizeInput {
  return {
    holdings,
    priorRealizedGain: prior,
    targetCash: 0,
    fxSell: 1,
    portfolioWeight: 0,
  };
}

describe("세액 계산", () => {
  const cases: {
    no: number;
    prior: number;
    gain: number;
    expected: number;
    note: string;
  }[] = [
    { no: 1, prior: 0, gain: 2_000_000, expected: 0, note: "공제 한도 이내" },
    { no: 2, prior: 0, gain: 2_500_000, expected: 0, note: "공제 한도 경계" },
    { no: 3, prior: 0, gain: 5_000_000, expected: 550_000, note: "(500만-250만)×22%" },
    { no: 4, prior: 1_800_000, gain: 1_200_000, expected: 110_000, note: "기존 실현손익 합산" },
    { no: 5, prior: 0, gain: -3_000_000, expected: 0, note: "순손실 시 세금 0" },
    { no: 6, prior: 5_000_000, gain: -3_000_000, expected: 0, note: "손익통산으로 과세표준 0" },
    { no: 7, prior: -1_000_000, gain: 5_000_000, expected: 330_000, note: "음수 기존손익 통산" },
  ];

  for (const c of cases) {
    it(`#${c.no} ${c.note}: prior ${c.prior} + 매도 ${c.gain} → 세금 ${c.expected}`, () => {
      expect(calcTax(c.prior + c.gain)).toBe(c.expected);
    });

    it(`#${c.no} evaluatePlan 경유해도 동일하다`, () => {
      const input = inputWith(c.prior, [holdingWithGain("a", c.gain)]);
      const plan = evaluatePlan([1], input, "테스트");
      expect(plan.realizedGain).toBe(c.gain);
      expect(plan.totalRealized).toBe(c.prior + c.gain);
      expect(plan.tax).toBe(c.expected);
    });
  }
});

describe("과세표준", () => {
  it("기본공제 250만원을 뺀 금액이다", () => {
    expect(calcTaxableBase(5_000_000)).toBe(5_000_000 - BASIC_DEDUCTION);
  });

  it("공제 이하면 0이며 음수가 되지 않는다", () => {
    expect(calcTaxableBase(1_000_000)).toBe(0);
    expect(calcTaxableBase(-9_000_000)).toBe(0);
  });

  it("세율은 22%다", () => {
    expect(TAX_RATE).toBe(0.22);
    expect(calcTax(BASIC_DEDUCTION + 1_000_000)).toBe(220_000);
  });
});

describe("주당 실현손익과 환율", () => {
  const holding: Holding = {
    id: "h",
    ticker: "AAPL",
    name: "애플",
    quantity: 10,
    avgBuyPrice: 100,
    currentPrice: 150,
    locked: false,
  };

  it("단일 환율이면 환차손익이 반영되지 않는다", () => {
    expect(calcPerShareGain(holding, 1_400)).toBe((150 - 100) * 1_400);
  });

  it("fxBuy를 입력하면 환차익이 과세 대상에 포함된다", () => {
    const withFxBuy = { ...holding, fxBuy: 1_100 };
    expect(calcPerShareGain(withFxBuy, 1_400)).toBe(150 * 1_400 - 100 * 1_100);
  });

  it("외화 기준 손실이어도 환차익이 크면 원화 실현이익이 날 수 있다", () => {
    const loser: Holding = { ...holding, avgBuyPrice: 150, currentPrice: 140, fxBuy: 1_000 };
    expect(calcPerShareGain(loser, 1_400)).toBeGreaterThan(0);
  });
});

describe("포트폴리오 이탈도", () => {
  const holdings: Holding[] = [
    { id: "a", ticker: "A", name: "A", quantity: 10, avgBuyPrice: 50, currentPrice: 100, locked: false },
    { id: "b", ticker: "B", name: "B", quantity: 10, avgBuyPrice: 50, currentPrice: 100, locked: false },
  ];

  it("비중대로 매도하면 drift는 0이다", () => {
    expect(calcPortfolioDrift(holdings, [5, 5], 1)).toBeCloseTo(0);
  });

  it("한 종목만 전량 매도하면 drift가 커진다", () => {
    expect(calcPortfolioDrift(holdings, [10, 0], 1)).toBeCloseTo(0.5);
  });

  it("전량 청산이면 1로 처리한다", () => {
    expect(calcPortfolioDrift(holdings, [10, 10], 1)).toBe(1);
  });
});

describe("evaluatePlan", () => {
  it("실수령액은 매도 대금에서 세금을 뺀 금액이다", () => {
    const input = inputWith(0, [holdingWithGain("a", 5_000_000, 2)]);
    const plan = evaluatePlan([2], { ...input, targetCash: 1_000 }, "테스트");
    expect(plan.realizedGain).toBe(10_000_000);
    expect(plan.tax).toBe(calcTax(10_000_000));
    expect(plan.netCash).toBe(plan.grossProceeds - plan.tax);
    expect(plan.meetsTarget).toBe(true);
  });

  it("매도 수량이 0인 종목은 lots에 담지 않는다", () => {
    const input = inputWith(0, [holdingWithGain("a", 100), holdingWithGain("b", 100)]);
    const plan = evaluatePlan([0, 1], input, "테스트");
    expect(plan.lots).toHaveLength(1);
    expect(plan.lots[0].holdingId).toBe("b");
  });

  it("아무것도 팔지 않으면 세금은 기존 실현손익만으로 계산된다", () => {
    const input = inputWith(5_000_000, [holdingWithGain("a", 100)]);
    const plan = evaluatePlan([0], input, "테스트");
    expect(plan.grossProceeds).toBe(0);
    expect(plan.tax).toBe(550_000);
  });
});
