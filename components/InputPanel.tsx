"use client";

import NumberInput from "./NumberInput";
import { formatKRW } from "@/lib/format";

interface InputPanelProps {
  priorRealizedGain: number;
  targetCash: number;
  fxSell: number;
  onChange: (patch: {
    priorRealizedGain?: number;
    targetCash?: number;
    fxSell?: number;
  }) => void;
}

export default function InputPanel({
  priorRealizedGain,
  targetCash,
  fxSell,
  onChange,
}: InputPanelProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <label className="block space-y-1.5">
        <span className="label">필요 금액</span>
        <NumberInput
          value={targetCash}
          min={0}
          thousands
          suffix="원"
          ariaLabel="필요 금액"
          className="field pr-9 text-right"
          onChange={(v) => onChange({ targetCash: v })}
        />
        <span className="hint block">세금을 내고 손에 쥐어야 하는 금액입니다.</span>
      </label>

      <label className="block space-y-1.5">
        <span className="label">올해 이미 실현한 손익</span>
        <NumberInput
          value={priorRealizedGain}
          thousands
          suffix="원"
          ariaLabel="올해 이미 실현한 손익"
          className="field pr-9 text-right"
          onChange={(v) => onChange({ priorRealizedGain: v })}
        />
        <span className="hint block">
          올해&#40;결제일 기준&#41; 확정된 해외주식 손익. 손실이면 &#40;-&#41;로 입력하세요.
        </span>
      </label>

      <label className="block space-y-1.5">
        <span className="label">현재 환율</span>
        <NumberInput
          value={fxSell}
          min={0}
          thousands
          suffix="원/$"
          ariaLabel="현재 환율"
          className="field pr-14 text-right"
          onChange={(v) => onChange({ fxSell: v })}
        />
        <span className="hint block">매도 시점에 적용할 원/달러 환율입니다.</span>
      </label>

      <p className="hint sm:col-span-3">
        기본공제 연 250만원까지는 세금이 없습니다. 현재 목표 금액은{" "}
        <span className="font-medium text-gray-700">{formatKRW(targetCash)}</span>입니다.
      </p>
    </div>
  );
}
