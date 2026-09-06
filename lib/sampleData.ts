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

/** 예시 데이터 버튼이 채워 넣는 전체 시나리오 */
export function buildSampleScenario() {
  return {
    holdings: sampleHoldings.map((h) => ({ ...h, id: `sample-${h.ticker}` })),
    priorRealizedGain: SAMPLE_PRIOR_REALIZED_GAIN,
    targetCash: SAMPLE_TARGET_CASH,
    fxSell: DEFAULT_FX,
  };
}
