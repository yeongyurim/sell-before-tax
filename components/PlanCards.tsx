"use client";

import { formatKRW, formatPercent } from "@/lib/format";
import type { SellPlan } from "@/lib/types";

interface PlanCardsProps {
  plans: SellPlan[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

const DESCRIPTIONS: Record<string, string> = {
  "세금 최소": "세금을 가장 적게 내는 조합",
  균형: "세금과 포트폴리오 비중을 절충",
  "비중 유지": "기존 비중을 최대한 그대로 유지",
};

export default function PlanCards({ plans, selectedIndex, onSelect }: PlanCardsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {plans.map((plan, index) => {
        const selected = index === selectedIndex;
        return (
          <button
            key={plan.label}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(index)}
            className={`rounded-xl border px-5 py-4 text-left transition ${
              selected
                ? "border-accent-600 bg-white ring-2 ring-accent-100"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span
                className={`text-sm font-semibold ${
                  selected ? "text-accent-700" : "text-gray-900"
                }`}
              >
                {plan.label}
              </span>
              {!plan.meetsTarget ? (
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">
                  목표 미달
                </span>
              ) : null}
            </div>
            <p className="hint mt-0.5">{DESCRIPTIONS[plan.label] ?? ""}</p>

            <p className="tnum mt-4 text-2xl font-bold tracking-tight text-gray-900">
              {formatKRW(plan.tax)}
            </p>
            <p className="hint">예상 세금</p>

            <dl className="mt-4 space-y-1.5 border-t border-gray-100 pt-3 text-xs">
              <div className="flex justify-between">
                <dt className="text-gray-500">실수령액</dt>
                <dd className="tnum font-medium text-gray-900">{formatKRW(plan.netCash)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">매도 종목 수</dt>
                <dd className="tnum text-gray-700">{plan.lots.length}개</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">포트폴리오 유지율</dt>
                <dd className="tnum text-gray-700">
                  {formatPercent(1 - plan.portfolioDrift)}
                </dd>
              </div>
            </dl>
          </button>
        );
      })}
    </div>
  );
}
