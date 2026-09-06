"use client";

import { useState } from "react";
import type { Holding } from "@/lib/types";

interface CsvPasteBoxProps {
  onParsed: (holdings: Holding[]) => void;
}

interface ParseOutcome {
  holdings: Holding[];
  skipped: number;
}

/** 숫자 셀에서 쉼표·통화기호·따옴표를 걷어낸다. */
function toNumber(raw: string): number | null {
  const cleaned = raw.replace(/["'\s,$₩원주]/g, "");
  if (cleaned === "") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/**
 * `티커,수량,평균단가,현재가` 형식을 파싱한다.
 * 엑셀에서 복사한 탭 구분도 받아들이고, 헤더 행과 빈 줄은 건너뛴다.
 * 5번째 열이 있으면 종목명으로 쓴다.
 */
export function parseCsv(text: string): ParseOutcome {
  const holdings: Holding[] = [];
  let skipped = 0;

  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") continue;

    const cells = trimmed.split(/[\t,;]/).map((c) => c.trim());
    if (cells.length < 4) {
      skipped++;
      continue;
    }

    const [ticker, qtyCell, avgCell, curCell, nameCell] = cells;
    const quantity = toNumber(qtyCell);
    const avgBuyPrice = toNumber(avgCell);
    const currentPrice = toNumber(curCell);

    // 헤더 행처럼 숫자가 아닌 줄은 조용히 건너뛴다.
    if (quantity === null || avgBuyPrice === null || currentPrice === null) {
      skipped++;
      continue;
    }
    if (ticker === "" || quantity <= 0) {
      skipped++;
      continue;
    }

    holdings.push({
      id: `csv-${ticker.toUpperCase()}-${holdings.length}`,
      ticker: ticker.toUpperCase(),
      name: nameCell?.trim() || ticker.toUpperCase(),
      quantity: Math.floor(quantity),
      avgBuyPrice,
      currentPrice,
      locked: false,
    });
  }

  return { holdings, skipped };
}

export default function CsvPasteBox({ onParsed }: CsvPasteBoxProps) {
  const [text, setText] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const apply = () => {
    const { holdings, skipped } = parseCsv(text);
    if (holdings.length === 0) {
      setMessage("읽을 수 있는 행이 없습니다. 형식을 확인해 주세요.");
      return;
    }
    onParsed(holdings);
    setMessage(
      `${holdings.length}개 종목을 불러왔습니다.${skipped > 0 ? ` (건너뛴 행 ${skipped}개)` : ""}`
    );
  };

  return (
    <details className="rounded-lg border border-gray-200 bg-gray-50/60">
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-gray-700 marker:text-gray-400">
        CSV 붙여넣기
      </summary>
      <div className="space-y-3 border-t border-gray-200 px-4 py-3">
        <p className="hint">
          한 줄에 한 종목씩 <code className="rounded bg-white px-1 py-0.5 text-gray-700">티커,수량,평균단가,현재가</code>{" "}
          형식으로 붙여넣으세요. 엑셀에서 복사한 탭 구분도 인식하며, 기존 표는 대체됩니다.
        </p>
        <textarea
          className="field h-28 resize-y font-mono text-xs"
          placeholder={"AAPL,120,150.00,232.00\nTSLA,80,265.00,218.00"}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setMessage(null);
          }}
        />
        <div className="flex items-center gap-3">
          <button type="button" className="btn-primary" onClick={apply} disabled={text.trim() === ""}>
            표에 채우기
          </button>
          {message ? <span className="hint">{message}</span> : null}
        </div>
      </div>
    </details>
  );
}
