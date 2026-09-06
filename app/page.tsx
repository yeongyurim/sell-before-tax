"use client";

import { useEffect, useMemo, useState } from "react";
import ComparisonChart from "@/components/ComparisonChart";
import CsvPasteBox from "@/components/CsvPasteBox";
import HoldingsTable from "@/components/HoldingsTable";
import InputPanel from "@/components/InputPanel";
import PlanCards from "@/components/PlanCards";
import ResultSummary from "@/components/ResultSummary";
import TaxBreakdown from "@/components/TaxBreakdown";
import { formatKRW } from "@/lib/format";
import { optimize } from "@/lib/optimizer";
import { DEFAULT_FX, buildSampleScenario } from "@/lib/sampleData";
import type { Holding, OptimizeInput, OptimizeResult } from "@/lib/types";

/** 입력이 멎은 뒤에만 최적화를 돌려 타이핑이 끊기지 않게 한다. */
function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const emptyRow = (): Holding => ({
  id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  ticker: "",
  name: "",
  quantity: 0,
  avgBuyPrice: 0,
  currentPrice: 0,
  locked: false,
});

export default function Page() {
  const [holdings, setHoldings] = useState<Holding[]>([emptyRow()]);
  const [priorRealizedGain, setPriorRealizedGain] = useState(0);
  const [targetCash, setTargetCash] = useState(0);
  const [fxSell, setFxSell] = useState(DEFAULT_FX);
  const [showFxBuy, setShowFxBuy] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // 계산에 쓸 수 있는 행만 추린다 (빈 행은 무시).
  const validHoldings = useMemo(
    () => holdings.filter((h) => h.quantity > 0 && h.currentPrice > 0),
    [holdings]
  );

  const input: OptimizeInput = useMemo(
    () => ({
      holdings: validHoldings,
      priorRealizedGain,
      targetCash,
      fxSell,
      portfolioWeight: 0.5,
    }),
    [validHoldings, priorRealizedGain, targetCash, fxSell]
  );

  const debouncedInput = useDebounced(input, 250);
  const ready = debouncedInput.holdings.length > 0 && debouncedInput.targetCash > 0;
  const calculating = ready && debouncedInput !== input;

  const result: OptimizeResult | null = useMemo(
    () => (ready ? optimize(debouncedInput) : null),
    [debouncedInput, ready]
  );

  // 조합 개수가 줄어들면 선택을 되돌린다.
  useEffect(() => {
    if (result && selectedIndex >= result.plans.length) setSelectedIndex(0);
  }, [result, selectedIndex]);

  const selectedPlan = result?.plans[selectedIndex] ?? result?.plans[0] ?? null;
  const usesSingleFx = validHoldings.every((h) => h.fxBuy === undefined);
  const infeasible = result != null && !result.plans.some((p) => p.meetsTarget);

  const loadSample = () => {
    const sample = buildSampleScenario();
    setHoldings(sample.holdings);
    setPriorRealizedGain(sample.priorRealizedGain);
    setTargetCash(sample.targetCash);
    setFxSell(sample.fxSell);
    setShowFxBuy(false);
    setSelectedIndex(0);
  };

  const reset = () => {
    setHoldings([emptyRow()]);
    setPriorRealizedGain(0);
    setTargetCash(0);
    setFxSell(DEFAULT_FX);
    setSelectedIndex(0);
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-6">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900">실수령</h1>
            <p className="hint mt-0.5">
              필요한 현금을 마련하면서 해외주식 양도소득세를 가장 적게 내는 매도 조합
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={reset}>
              초기화
            </button>
            <button type="button" className="btn-primary" onClick={loadSample}>
              예시 데이터 채우기
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-12 px-4 py-8 sm:px-6 sm:py-10">
        {/* 섹션 A — 입력 */}
        <section className="space-y-5">
          <div className="flex items-baseline gap-3">
            <h2 className="section-title">보유 종목</h2>
            <span className="hint">해외 상장 주식·ETF만 해당합니다.</span>
          </div>

          <HoldingsTable
            holdings={holdings}
            fxSell={fxSell}
            showFxBuy={showFxBuy}
            onChange={setHoldings}
            onToggleFxBuy={setShowFxBuy}
          />

          <CsvPasteBox
            onParsed={(parsed) => {
              setHoldings(parsed);
              setSelectedIndex(0);
            }}
          />

          <div className="border-t border-gray-200 pt-6">
            <InputPanel
              priorRealizedGain={priorRealizedGain}
              targetCash={targetCash}
              fxSell={fxSell}
              onChange={(patch) => {
                if (patch.priorRealizedGain !== undefined)
                  setPriorRealizedGain(patch.priorRealizedGain);
                if (patch.targetCash !== undefined) setTargetCash(patch.targetCash);
                if (patch.fxSell !== undefined) setFxSell(patch.fxSell);
              }}
            />
          </div>

          {usesSingleFx && validHoldings.length > 0 ? (
            <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs leading-relaxed text-gray-600">
              매수 시점 환율을 입력하지 않으면 환차손익이 반영되지 않아 실제 세액과 차이가 날 수
              있습니다.
            </p>
          ) : null}
        </section>

        {/* 섹션 B — 결과 */}
        <section className="space-y-5">
          <div className="flex items-baseline gap-3">
            <h2 className="section-title">매도 조합</h2>
            {calculating ? <span className="hint">계산 중…</span> : null}
          </div>

          {!ready || !result || !selectedPlan ? (
            <div className="rounded-xl border border-dashed border-gray-300 px-6 py-14 text-center">
              <p className="text-sm text-gray-500">
                보유 종목과 필요 금액을 입력하면 매도 조합을 계산합니다.
              </p>
              <button type="button" className="btn-primary mt-4" onClick={loadSample}>
                예시 데이터로 먼저 보기
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {infeasible ? (
                <p className="rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                  매도 가능한 종목을 모두 팔아도 필요 금액 {formatKRW(targetCash)}에 미치지
                  못합니다. 최대로 마련할 수 있는 금액은{" "}
                  <span className="font-medium">{formatKRW(selectedPlan.netCash)}</span>입니다.
                </p>
              ) : (
                <ResultSummary
                  baseline={result.baseline}
                  best={result.plans[0]}
                  savings={result.savings}
                />
              )}

              <PlanCards
                plans={result.plans}
                selectedIndex={Math.min(selectedIndex, result.plans.length - 1)}
                onSelect={setSelectedIndex}
              />

              <div className="rounded-xl border border-gray-200 px-5 py-5">
                <h3 className="text-sm font-semibold text-gray-900">세금 비교</h3>
                <p className="hint mt-0.5">단순 매도와 각 조합의 예상 세금</p>
                <div className="mt-4">
                  <ComparisonChart
                    baseline={result.baseline}
                    plans={result.plans}
                    selectedIndex={Math.min(selectedIndex, result.plans.length - 1)}
                  />
                </div>
              </div>
            </div>
          )}
        </section>

        {/* 섹션 C — 상세 내역 */}
        {result && selectedPlan ? (
          <section className="space-y-5">
            <div className="flex items-baseline gap-3">
              <h2 className="section-title">상세 내역</h2>
              <span className="hint">{selectedPlan.label} 조합</span>
            </div>
            <TaxBreakdown
              plan={selectedPlan}
              holdings={validHoldings}
              fxSell={fxSell}
              priorRealizedGain={priorRealizedGain}
              targetCash={targetCash}
            />
          </section>
        ) : null}

        {/* 한계 고지 */}
        <section className="space-y-3 border-t border-gray-200 pt-8">
          <h2 className="text-sm font-semibold text-gray-900">계산에 반영하지 않은 것</h2>
          <ul className="hint list-inside list-disc space-y-1">
            <li>대주주 요건 &#40;지분율·시가총액 기준&#41;</li>
            <li>해외 배당소득 및 금융소득종합과세</li>
            <li>매매 수수료·제비용 &#40;필요경비&#41;</li>
            <li>국내주식·국내상장 ETF &#40;과세 체계가 다릅니다&#41;</li>
            <li>과세 기간은 결제일 기준이므로, 연말 매도는 결제일이 다음 해로 넘어갈 수 있습니다</li>
          </ul>
        </section>
      </main>

      <footer className="border-t border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <p className="text-xs leading-relaxed text-gray-500">
            본 서비스는 세무 상담이 아닌 계산 보조 도구입니다. 확정된 세법에 따른 시뮬레이션
            결과이며, 대주주 요건·해외 배당소득·매매 수수료 등 개별 사정에 따라 실제 세액과 차이가
            있을 수 있습니다. 특정 종목의 투자 가치를 판단하거나 매수를 추천하지 않습니다.
            입력하신 보유 종목 정보는 서버로 전송되지 않으며 브라우저에서만 처리됩니다.
          </p>
        </div>
      </footer>
    </div>
  );
}
