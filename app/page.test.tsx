import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import Page from "./page";

afterEach(cleanup);

/** 화면에 보이는 원화 금액 문자열을 숫자로 되돌린다. */
function wonToNumber(text: string): number {
  return Number(text.replace(/[^0-9-]/g, ""));
}

describe("페이지", () => {
  it("처음에는 결과 대신 안내를 보여준다", () => {
    render(<Page />);
    expect(
      screen.getByText("보유 종목과 필요 금액을 입력하면 매도 조합을 계산합니다.")
    ).toBeDefined();
  });

  it("예시 데이터를 채우면 절감액과 조합, 상세 내역이 나온다", async () => {
    render(<Page />);
    fireEvent.click(screen.getByRole("button", { name: "예시 데이터 채우기" }));

    // 표가 예시 종목으로 채워진다.
    expect(screen.getByDisplayValue("AAPL")).toBeDefined();
    expect(screen.getByDisplayValue("PLTR")).toBeDefined();

    // 디바운스 후 최적화 결과가 표시된다.
    const summary = await waitFor(() => screen.getByText("절감 가능액").parentElement!, {
      timeout: 3000,
    });

    const savings = wonToNumber(summary.querySelector("p:nth-of-type(2)")!.textContent ?? "");
    expect(savings).toBeGreaterThan(0);

    // 조합 카드가 1개 이상 나오고, 첫 조합의 세금은 0원이다.
    const taxMin = screen.getByRole("button", { name: /세금 최소/ });
    expect(within(taxMin).getByText("0원")).toBeDefined();

    // 상세 내역이 계산 과정을 단계별로 보여준다.
    const steps = screen.getByText("세금 계산 과정").parentElement!;
    for (const label of [
      "매도 대금 합계",
      "이번 매도 실현손익",
      "올해 기존 실현손익",
      "연간 실현손익 합계",
      "기본공제",
      "과세표준",
      "세금 (22%)",
      "실수령액",
    ]) {
      expect(within(steps).getByText(label), label).toBeDefined();
    }
  });

  it("조합 카드를 클릭하면 상세 내역이 그 조합으로 바뀐다", async () => {
    render(<Page />);
    fireEvent.click(screen.getByRole("button", { name: "예시 데이터 채우기" }));
    await waitFor(() => screen.getByText("절감 가능액"), { timeout: 3000 });

    const keepWeights = screen.queryByRole("button", { name: /비중 유지/ });
    if (!keepWeights) return; // 조합이 하나로 합쳐진 경우는 건너뛴다.

    fireEvent.click(keepWeights);
    await waitFor(() => expect(keepWeights.getAttribute("aria-pressed")).toBe("true"));
    expect(screen.getByText("비중 유지 조합")).toBeDefined();
  });

  it("매도 제외로 표시한 종목은 상세 내역에 나오지 않는다", async () => {
    render(<Page />);
    fireEvent.click(screen.getByRole("button", { name: "예시 데이터 채우기" }));
    await waitFor(() => screen.getByText("절감 가능액"), { timeout: 3000 });

    fireEvent.click(screen.getByRole("checkbox", { name: "PLTR 매도 제외" }));

    await waitFor(
      () => {
        const table = screen.getByText("종목별 매도 수량").parentElement!;
        expect(within(table).queryByText("PLTR")).toBeNull();
      },
      { timeout: 3000 }
    );
  });

  it("필요 금액을 지우면 다시 안내로 돌아간다", async () => {
    render(<Page />);
    fireEvent.click(screen.getByRole("button", { name: "예시 데이터 채우기" }));
    await waitFor(() => screen.getByText("절감 가능액"), { timeout: 3000 });

    const targetInput = screen.getByLabelText("필요 금액");
    fireEvent.focus(targetInput);
    fireEvent.change(targetInput, { target: { value: "0" } });

    await waitFor(
      () =>
        expect(
          screen.getByText("보유 종목과 필요 금액을 입력하면 매도 조합을 계산합니다.")
        ).toBeDefined(),
      { timeout: 3000 }
    );
  });
});
