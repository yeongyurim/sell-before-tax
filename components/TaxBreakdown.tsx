"use client";

import { formatKRW, formatNumber, formatPercent, formatSignedKRW } from "@/lib/format";
import { BASIC_DEDUCTION, calcPerShareGain, calcPerShareProceeds } from "@/lib/tax";
import type { Holding, SellPlan } from "@/lib/types";

interface TaxBreakdownProps {
  plan: SellPlan;
  holdings: Holding[];
  fxSell: number;
  priorRealizedGain: number;
  targetCash: number;
}

interface Row {
  key: string;
  label: string;
  value: string;
  emphasis?: boolean;
  divider?: boolean;
  muted?: boolean;
}

export default function TaxBreakdown({
  plan,
  holdings,
  fxSell,
  priorRealizedGain,
  targetCash,
}: TaxBreakdownProps) {
  const byId = new Map(holdings.map((h) => [h.id, h]));
  const lots = plan.lots
    .map((lot) => {
      const holding = byId.get(lot.holdingId);
      if (!holding) return null;
      const proceeds = lot.sellQty * calcPerShareProceeds(holding, fxSell);
      const gain = lot.sellQty * calcPerShareGain(holding, fxSell);
      return { holding, sellQty: lot.sellQty, proceeds, gain };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => b.proceeds - a.proceeds);

  const rows: Row[] = [
    { key: "gross", label: "매도 대금 합계", value: formatKRW(plan.grossProceeds) },
    {
      key: "realized",
      label: "이번 매도 실현손익",
      value: formatSignedKRW(plan.realizedGain),
    },
    {
      key: "prior",
      label: "올해 기존 실현손익",
      value: formatSignedKRW(priorRealizedGain),
      divider: true,
    },
    {
      key: "total",
      label: "연간 실현손익 합계",
      value: formatSignedKRW(plan.totalRealized),
    },
    {
      key: "deduction",
      label: "기본공제",
      value: `-${formatKRW(BASIC_DEDUCTION)}`,
      muted: true,
    },
    { key: "base", label: "과세표준", value: formatKRW(plan.taxableBase), divider: true },
    { key: "tax", label: "세금 (22%)", value: formatKRW(plan.tax) },
    {
      key: "net",
      label: "실수령액",
      value: formatKRW(plan.netCash),
      emphasis: true,
      divider: true,
    },
  ];

  const surplus = plan.netCash - targetCash;

  return (
    <div className="grid gap-8 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <h3 className="text-sm font-semibold text-gray-900">종목별 매도 수량</h3>
        <div className="-mx-4 mt-3 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-xs font-medium text-gray-500">
                <th className="border-b border-gray-200 py-2 text-left font-medium">종목</th>
                <th className="border-b border-gray-200 py-2 text-right font-medium">
                  매도 수량
                </th>
                <th className="border-b border-gray-200 py-2 text-right font-medium">
                  매도 대금
                </th>
                <th className="border-b border-gray-200 py-2 text-right font-medium">
                  실현손익
                </th>
              </tr>
            </thead>
            <tbody>
              {lots.map(({ holding, sellQty, proceeds, gain }) => (
                <tr key={holding.id}>
                  <td className="border-b border-gray-100 py-2.5">
                    <span className="font-medium text-gray-900">{holding.ticker}</span>
                    {holding.name && holding.name !== holding.ticker ? (
                      <span className="ml-2 text-xs text-gray-500">{holding.name}</span>
                    ) : null}
                  </td>
                  <td className="tnum border-b border-gray-100 py-2.5 text-right text-gray-900">
                    {formatNumber(sellQty)}주
                    <span className="ml-1 text-xs text-gray-400">
                      / {formatNumber(holding.quantity)}
                    </span>
                  </td>
                  <td className="tnum border-b border-gray-100 py-2.5 text-right text-gray-700">
                    {formatKRW(proceeds)}
                  </td>
                  <td
                    className={`tnum border-b border-gray-100 py-2.5 text-right ${
                      gain > 0 ? "text-gray-900" : "text-gray-500"
                    }`}
                  >
                    {formatSignedKRW(gain)}
                  </td>
                </tr>
              ))}
              {lots.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-sm text-gray-400">
                    매도할 종목이 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="hint mt-3">
          포트폴리오 유지율 {formatPercent(1 - plan.portfolioDrift)} · 목표 금액 대비{" "}
          {surplus >= 0 ? "여유" : "부족"} {formatKRW(Math.abs(surplus))}
        </p>
      </div>

      <div className="lg:col-span-2">
        <h3 className="text-sm font-semibold text-gray-900">세금 계산 과정</h3>
        <dl className="mt-3 rounded-lg border border-gray-200 bg-gray-50/60 px-4 py-3 text-sm">
          {rows.map((row) => (
            <div
              key={row.key}
              className={`flex items-baseline justify-between gap-4 py-2 ${
                row.divider ? "border-t border-gray-200" : ""
              }`}
            >
              <dt
                className={
                  row.emphasis
                    ? "font-semibold text-gray-900"
                    : row.muted
                      ? "text-gray-500"
                      : "text-gray-600"
                }
              >
                {row.label}
              </dt>
              <dd
                className={`tnum ${
                  row.emphasis
                    ? "text-base font-bold text-accent-700"
                    : row.muted
                      ? "text-gray-500"
                      : "font-medium text-gray-900"
                }`}
              >
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
        {plan.totalRealized <= BASIC_DEDUCTION && plan.totalRealized > 0 ? (
          <p className="hint mt-3">
            연간 실현손익이 기본공제 250만원 안에 들어와 세금이 발생하지 않습니다.
          </p>
        ) : null}
      </div>
    </div>
  );
}
