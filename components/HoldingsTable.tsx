"use client";

import NumberInput from "./NumberInput";
import { formatSignedKRW, formatSignedPercent } from "@/lib/format";
import { calcPerShareGain } from "@/lib/tax";
import type { Holding } from "@/lib/types";

interface HoldingsTableProps {
  holdings: Holding[];
  fxSell: number;
  showFxBuy: boolean;
  onChange: (holdings: Holding[]) => void;
  onToggleFxBuy: (show: boolean) => void;
}

export default function HoldingsTable({
  holdings,
  fxSell,
  showFxBuy,
  onChange,
  onToggleFxBuy,
}: HoldingsTableProps) {
  const update = (id: string, patch: Partial<Holding>) =>
    onChange(holdings.map((h) => (h.id === id ? { ...h, ...patch } : h)));

  const remove = (id: string) => onChange(holdings.filter((h) => h.id !== id));

  const addRow = () =>
    onChange([
      ...holdings,
      {
        id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        ticker: "",
        name: "",
        quantity: 0,
        avgBuyPrice: 0,
        currentPrice: 0,
        locked: false,
      },
    ]);

  return (
    <div>
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[720px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left text-xs font-medium text-gray-500">
              <th className="border-b border-gray-200 px-2 pb-2 font-medium">티커</th>
              <th className="border-b border-gray-200 px-2 pb-2 font-medium">종목명</th>
              <th className="border-b border-gray-200 px-2 pb-2 text-right font-medium">수량</th>
              <th className="border-b border-gray-200 px-2 pb-2 text-right font-medium">
                평균단가&#40;$&#41;
              </th>
              <th className="border-b border-gray-200 px-2 pb-2 text-right font-medium">
                현재가&#40;$&#41;
              </th>
              {showFxBuy ? (
                <th className="border-b border-gray-200 px-2 pb-2 text-right font-medium">
                  매수환율
                </th>
              ) : null}
              <th className="border-b border-gray-200 px-2 pb-2 text-right font-medium">
                평가손익
              </th>
              <th className="border-b border-gray-200 px-2 pb-2 text-center font-medium">
                매도 제외
              </th>
              <th className="w-8 border-b border-gray-200 px-2 pb-2" />
            </tr>
          </thead>
          <tbody>
            {holdings.map((holding) => {
              const perShareGain = calcPerShareGain(holding, fxSell);
              const totalGain = perShareGain * holding.quantity;
              const returnRate =
                holding.avgBuyPrice > 0
                  ? holding.currentPrice / holding.avgBuyPrice - 1
                  : 0;
              const positive = totalGain > 0;

              return (
                <tr
                  key={holding.id}
                  className={holding.locked ? "bg-gray-50/70 text-gray-400" : ""}
                >
                  <td className="border-b border-gray-100 px-1 py-1">
                    <input
                      className="cell-input font-medium uppercase"
                      value={holding.ticker}
                      aria-label="티커"
                      placeholder="AAPL"
                      onChange={(e) =>
                        update(holding.id, { ticker: e.target.value.toUpperCase() })
                      }
                    />
                  </td>
                  <td className="border-b border-gray-100 px-1 py-1">
                    <input
                      className="cell-input"
                      value={holding.name}
                      aria-label="종목명"
                      placeholder="애플"
                      onChange={(e) => update(holding.id, { name: e.target.value })}
                    />
                  </td>
                  <td className="border-b border-gray-100 px-1 py-1">
                    <NumberInput
                      value={holding.quantity}
                      min={0}
                      thousands
                      ariaLabel="수량"
                      className="cell-input text-right"
                      onChange={(v) =>
                        update(holding.id, { quantity: Math.max(0, Math.floor(v)) })
                      }
                    />
                  </td>
                  <td className="border-b border-gray-100 px-1 py-1">
                    <NumberInput
                      value={holding.avgBuyPrice}
                      min={0}
                      fractionDigits={2}
                      ariaLabel="평균단가"
                      className="cell-input text-right"
                      onChange={(v) => update(holding.id, { avgBuyPrice: v })}
                    />
                  </td>
                  <td className="border-b border-gray-100 px-1 py-1">
                    <NumberInput
                      value={holding.currentPrice}
                      min={0}
                      fractionDigits={2}
                      ariaLabel="현재가"
                      className="cell-input text-right"
                      onChange={(v) => update(holding.id, { currentPrice: v })}
                    />
                  </td>
                  {showFxBuy ? (
                    <td className="border-b border-gray-100 px-1 py-1">
                      <NumberInput
                        value={holding.fxBuy ?? 0}
                        min={0}
                        thousands
                        ariaLabel="매수 시점 환율"
                        placeholder={String(fxSell)}
                        className="cell-input text-right"
                        onChange={(v) =>
                          update(holding.id, { fxBuy: v > 0 ? v : undefined })
                        }
                      />
                    </td>
                  ) : null}
                  <td className="tnum border-b border-gray-100 px-2 py-1 text-right">
                    <div
                      className={
                        holding.locked
                          ? "text-gray-400"
                          : positive
                            ? "font-medium text-gray-900"
                            : "text-gray-500"
                      }
                    >
                      {formatSignedKRW(totalGain)}
                    </div>
                    <div className="text-xs text-gray-400">
                      {formatSignedPercent(returnRate)}
                    </div>
                  </td>
                  <td className="border-b border-gray-100 px-2 py-1 text-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 cursor-pointer rounded border-gray-300 accent-accent-600"
                      checked={holding.locked}
                      aria-label={`${holding.ticker || "종목"} 매도 제외`}
                      onChange={(e) => update(holding.id, { locked: e.target.checked })}
                    />
                  </td>
                  <td className="border-b border-gray-100 px-1 py-1 text-center">
                    <button
                      type="button"
                      aria-label={`${holding.ticker || "종목"} 삭제`}
                      className="rounded p-1 text-gray-300 transition hover:bg-gray-100 hover:text-gray-600"
                      onClick={() => remove(holding.id)}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                        <path
                          d="M3 3l8 8M11 3l-8 8"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </td>
                </tr>
              );
            })}
            {holdings.length === 0 ? (
              <tr>
                <td colSpan={showFxBuy ? 9 : 8} className="px-2 py-8 text-center text-sm text-gray-400">
                  보유 종목을 추가하거나 예시 데이터를 채워 넣어 보세요.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <button type="button" className="btn-ghost" onClick={addRow}>
          + 행 추가
        </button>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            className="h-4 w-4 cursor-pointer rounded border-gray-300 accent-accent-600"
            checked={showFxBuy}
            onChange={(e) => onToggleFxBuy(e.target.checked)}
          />
          매수 시점 환율 직접 입력
        </label>
      </div>
    </div>
  );
}
