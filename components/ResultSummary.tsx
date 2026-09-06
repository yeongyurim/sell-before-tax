"use client";

import { formatKRW } from "@/lib/format";
import type { SellPlan } from "@/lib/types";

interface ResultSummaryProps {
  baseline: SellPlan;
  best: SellPlan;
  savings: number;
}

export default function ResultSummary({ baseline, best, savings }: ResultSummaryProps) {
  const hasSavings = savings > 0;

  return (
    <div className="rounded-xl border border-accent-200 bg-accent-50 px-6 py-7 sm:px-8">
      <p className="text-sm font-medium text-accent-700">절감 가능액</p>
      <p className="tnum mt-1 text-4xl font-bold tracking-tight text-accent-700 sm:text-5xl">
        {formatKRW(savings)}
      </p>
      <p className="tnum mt-3 text-sm text-gray-600">
        단순 매도 <span className="font-medium text-gray-900">{formatKRW(baseline.tax)}</span>
        <span className="mx-1.5 text-gray-400">→</span>
        최적 <span className="font-medium text-gray-900">{formatKRW(best.tax)}</span>
      </p>
      <p className="hint mt-3 max-w-xl">
        {hasSavings
          ? "수익률 높은 종목부터 파는 방식과 비교한 금액입니다. 같은 현금을 마련하면서 손실 종목을 함께 팔아 실현손익을 기본공제 한도에 맞췄습니다."
          : "이 조건에서는 단순 매도로도 세금이 최소입니다. 실현손익이 이미 기본공제 한도 안에 들어와 있습니다."}
      </p>
    </div>
  );
}
