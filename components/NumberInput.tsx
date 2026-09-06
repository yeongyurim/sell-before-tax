"use client";

import { useEffect, useState } from "react";
import { formatNumber, parseNumeric } from "@/lib/format";

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  /** 천 단위 쉼표를 넣어 보여준다 (원화 금액용) */
  thousands?: boolean;
  /** 표시 소수 자릿수 (단가용) */
  fractionDigits?: number;
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
  min?: number;
  suffix?: string;
}

/**
 * 편집 중에는 사용자가 친 문자열을 그대로 두고, 포커스를 벗어날 때 정돈해서 보여준다.
 * (숫자 input의 지우기·소수점 입력 불편을 피하기 위해 text로 다룬다)
 */
export default function NumberInput({
  value,
  onChange,
  thousands = false,
  fractionDigits = 0,
  className = "",
  placeholder,
  ariaLabel,
  min,
  suffix,
}: NumberInputProps) {
  const display = (v: number) =>
    thousands ? formatNumber(v, 0) : fractionDigits > 0 ? String(v) : String(v);

  const [draft, setDraft] = useState<string>(() => display(value));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(display(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editing, thousands]);

  const commit = (raw: string) => {
    const parsed = parseNumeric(raw);
    if (parsed === null) return;
    onChange(min !== undefined ? Math.max(min, parsed) : parsed);
  };

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        placeholder={placeholder}
        className={`tnum ${className}`}
        value={draft}
        onFocus={() => {
          setEditing(true);
          setDraft(value === 0 ? "" : String(value));
        }}
        onChange={(e) => {
          setDraft(e.target.value);
          commit(e.target.value);
        }}
        onBlur={(e) => {
          const parsed = parseNumeric(e.target.value);
          const next = parsed === null ? 0 : min !== undefined ? Math.max(min, parsed) : parsed;
          onChange(next);
          setEditing(false);
          setDraft(display(next));
        }}
      />
      {suffix ? (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
          {suffix}
        </span>
      ) : null}
    </div>
  );
}
