// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import Page from "./page";

afterEach(cleanup);

/** 화면에 보이는 원화 금액 문자열을 숫자로 되돌린다. */
function wonToNumber(text: string): number {
  return Number(text.replace(/[^0-9-]/g, ""));
}

/** 예시 시나리오를 불러오고 결과가 나올 때까지 기다린다. */
async function loadScenario(label: string) {
  render(<Page />);
  fireEvent.click(screen.getByRole("button", { name: label }));
  await waitFor(() => screen.getByText("절감 가능액"), { timeout: 3000 });
}

/** 조합 카드에서 가장 크게 표시된 지표의 텍스트와 그 아래 설명 */
function primaryMetric(cardName: RegExp) {
  const card = screen.getByRole("button", { name: cardName });
  const paragraphs = Array.from(card.querySelectorAll("p"));
  const value = paragraphs.find((p) => p.className.includes("text-2xl"))!;
  return { value: value.textContent ?? "", caption: value.nextElementSibling?.textContent ?? "" };
}

describe("페이지", () => {
  it("처음에는 결과 대신 안내를 보여준다", () => {
    render(<Page />);
    expect(
      screen.getByText("보유 종목과 필요 금액을 입력하면 매도 조합을 계산합니다.")
    ).toBeDefined();
  });

  it("예시 시나리오 버튼이 두 개 있다", () => {
    render(<Page />);
    expect(screen.getByRole("button", { name: "여유 시나리오" })).toBeDefined();
    expect(screen.getByRole("button", { name: "빡빡한 시나리오" })).toBeDefined();
  });

  it("여유 시나리오를 채우면 절감액과 조합, 상세 내역이 나온다", async () => {
    await loadScenario("여유 시나리오");

    expect(screen.getByDisplayValue("AAPL")).toBeDefined();
    expect(screen.getByDisplayValue("PLTR")).toBeDefined();

    const summary = screen.getByText("절감 가능액").parentElement!;
    const savings = wonToNumber(summary.querySelector("p:nth-of-type(2)")!.textContent ?? "");
    expect(savings).toBe(4_770_392);

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
    await loadScenario("여유 시나리오");

    const keepWeights = screen.getByRole("button", { name: /비중 유지/ });
    fireEvent.click(keepWeights);
    await waitFor(() => expect(keepWeights.getAttribute("aria-pressed")).toBe("true"));
    expect(screen.getByText("비중 유지 조합")).toBeDefined();
  });

  it("매도 제외로 표시한 종목은 상세 내역에 나오지 않는다", async () => {
    await loadScenario("여유 시나리오");
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
    await loadScenario("여유 시나리오");

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

describe("세금이 모두 같을 때", () => {
  it("안내 문구를 띄운다", async () => {
    await loadScenario("여유 시나리오");
    expect(
      screen.getByText(
        "세 조합 모두 세금 0원입니다. 손실 종목으로 상계할 여유가 충분한 상태이므로, 이제 포트폴리오를 얼마나 지킬지로 고르시면 됩니다."
      )
    ).toBeDefined();
  });

  it("카드의 주 지표가 포트폴리오 유지율로 바뀐다", async () => {
    await loadScenario("여유 시나리오");

    for (const name of [/세금 최소/, /균형/, /비중 유지/]) {
      const { value, caption } = primaryMetric(name);
      expect(caption).toBe("포트폴리오 유지율");
      expect(value).toMatch(/%$/);
    }

    // 세금은 보조 지표로 남는다.
    const card = screen.getByRole("button", { name: /세금 최소/ });
    expect(within(card).getByText("예상 세금")).toBeDefined();
    expect(within(card).getByText("0원")).toBeDefined();
  });

  it("단순 매도 대비 유지율을 함께 보여준다", async () => {
    await loadScenario("여유 시나리오");
    const line = screen.getByText(/단순 매도 유지율/);
    expect(line.textContent).toMatch(/69\.1%/);
    expect(line.textContent).toMatch(/93\.7%/);
  });

  it("유지율 차이가 눈에 띌 만큼 벌어진다", async () => {
    await loadScenario("여유 시나리오");
    const taxMin = Number(primaryMetric(/세금 최소/).value.replace("%", ""));
    const keep = Number(primaryMetric(/비중 유지/).value.replace("%", ""));
    expect(keep - taxMin).toBeGreaterThan(10);
  });
});

describe("세금이 갈릴 때", () => {
  it("안내 문구를 띄우지 않고 주 지표를 세금으로 둔다", async () => {
    await loadScenario("빡빡한 시나리오");

    expect(screen.queryByText(/조합 모두 세금/)).toBeNull();

    const { value, caption } = primaryMetric(/세금 최소/);
    expect(caption).toBe("예상 세금");
    expect(value).toMatch(/원$/);
    expect(wonToNumber(value)).toBeGreaterThan(0);
  });

  it("세금과 유지율이 서로 맞바뀐다", async () => {
    await loadScenario("빡빡한 시나리오");

    const taxMin = wonToNumber(primaryMetric(/세금 최소/).value);
    const keep = wonToNumber(primaryMetric(/비중 유지/).value);
    expect(keep).toBeGreaterThan(taxMin);
  });
});
