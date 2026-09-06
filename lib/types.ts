/** 사용자가 보유한 해외주식 1종목 */
export interface Holding {
  id: string;
  ticker: string; // 예: "AAPL"
  name: string; // 예: "애플"
  quantity: number; // 보유 수량 (정수, > 0)
  avgBuyPrice: number; // 평균 매입단가 (외화, USD)
  currentPrice: number; // 현재가 (외화, USD)
  fxBuy?: number; // 매수 시점 환율 (미입력 시 fxSell 사용)
  locked: boolean; // true면 매도 대상에서 제외
}

/** 최적화 입력 */
export interface OptimizeInput {
  holdings: Holding[];
  priorRealizedGain: number; // 올해 이미 실현한 손익 (원화, 음수 가능)
  targetCash: number; // 필요 현금 (원화, 세후 기준)
  fxSell: number; // 매도 시점 환율 (원/USD)
  portfolioWeight: number; // 0~1. 클수록 포트폴리오 비중 유지를 중시
}

/** 매도 조합 1개 */
export interface SellPlan {
  label: string; // "세금 최소" | "균형" | "비중 유지"
  lots: { holdingId: string; sellQty: number }[];
  grossProceeds: number; // 매도 대금 합계 (원화, 세전)
  realizedGain: number; // 이번 매도로 발생한 실현손익
  totalRealized: number; // priorRealizedGain 포함 연간 실현손익
  taxableBase: number;
  tax: number;
  netCash: number; // grossProceeds - tax  (실수령액)
  portfolioDrift: number; // 0~1, 낮을수록 기존 비중 유지
  meetsTarget: boolean;
}

export interface OptimizeResult {
  plans: SellPlan[]; // 최대 3개
  baseline: SellPlan; // 비교 기준: 수익률 높은 순 단순 매도
  savings: number; // baseline.tax - plans[0].tax
}
