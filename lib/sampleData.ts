import type { Holding } from "./types";

export const DEFAULT_FX = 1380;
export const SAMPLE_PRIOR_REALIZED_GAIN = 1_800_000;
export const SAMPLE_TARGET_CASH = 50_000_000;

/** 이익 종목과 손실 종목이 섞여 있어 최적화 효과가 드러나는 구성 (환율 1,380원 기준) */
export const sampleHoldings: Holding[] = [
  { id: "s1", ticker: "AAPL", name: "애플", quantity: 120, avgBuyPrice: 150.0, currentPrice: 232.0, locked: false },
  { id: "s2", ticker: "MSFT", name: "마이크로소프트", quantity: 60, avgBuyPrice: 280.0, currentPrice: 425.0, locked: false },
  { id: "s3", ticker: "NVDA", name: "엔비디아", quantity: 40, avgBuyPrice: 62.0, currentPrice: 178.0, locked: false },
  { id: "s4", ticker: "TSLA", name: "테슬라", quantity: 80, avgBuyPrice: 265.0, currentPrice: 218.0, locked: false },
  { id: "s5", ticker: "GOOGL", name: "알파벳", quantity: 50, avgBuyPrice: 175.0, currentPrice: 196.0, locked: false },
  { id: "s6", ticker: "PLTR", name: "팔란티어", quantity: 200, avgBuyPrice: 41.0, currentPrice: 28.5, locked: false },
  { id: "s7", ticker: "AMD", name: "AMD", quantity: 90, avgBuyPrice: 158.0, currentPrice: 121.0, locked: false },
  { id: "s8", ticker: "SCHD", name: "슈드 ETF", quantity: 300, avgBuyPrice: 27.5, currentPrice: 29.1, locked: false },
];

/** 예시 데이터 버튼 하나가 채워 넣는 전체 시나리오 */
export interface SampleScenario {
  id: string;
  label: string;
  /** 버튼 툴팁 및 빈 화면 안내에 쓰는 한 줄 설명 */
  description: string;
  holdings: Holding[];
  priorRealizedGain: number;
  targetCash: number;
  fxSell: number;
}

/**
 * 두 시나리오는 같은 보유 종목에 목표 금액만 다르다.
 * 필요 금액이 커질수록 손실 종목만으로는 상계할 수 없어 세금과 비중 유지가 서로 부딪힌다.
 */
export const SAMPLE_SCENARIOS: SampleScenario[] = [
  {
    id: "relaxed",
    label: "여유 시나리오",
    description: "필요 금액 5,000만원 — 손실 종목으로 상계할 여유가 충분해 세 조합 모두 세금이 없습니다.",
    holdings: sampleHoldings.map((h) => ({ ...h, id: `relaxed-${h.ticker}` })),
    priorRealizedGain: SAMPLE_PRIOR_REALIZED_GAIN,
    targetCash: SAMPLE_TARGET_CASH,
    fxSell: DEFAULT_FX,
  },
  {
    id: "tight",
    label: "빡빡한 시나리오",
    description: "필요 금액 1억 2,000만원 — 상계 여유가 모자라 세금과 비중 유지가 맞바뀝니다.",
    holdings: sampleHoldings.map((h) => ({ ...h, id: `tight-${h.ticker}` })),
    priorRealizedGain: SAMPLE_PRIOR_REALIZED_GAIN,
    targetCash: 120_000_000,
    fxSell: DEFAULT_FX,
  },
];

export const buildSampleScenario = (id: string = "relaxed"): SampleScenario =>
  SAMPLE_SCENARIOS.find((s) => s.id === id) ?? SAMPLE_SCENARIOS[0];
