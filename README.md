# 실수령

필요한 현금 금액을 입력하면, **해외주식 양도소득세를 가장 적게 내면서 그 금액을 마련하는 매도 조합**을 계산하는 단일 페이지 웹서비스.

## 실행

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # Vitest (45 케이스)
npm run build   # 정적 빌드
```

첫 화면에서 **예시 데이터 채우기**를 누르면 바로 결과를 볼 수 있습니다.

## 계산이 서버로 가지 않습니다

보유 종목·매입단가는 민감 금융정보이므로 **모든 세금 계산과 최적화는 브라우저에서만** 실행됩니다.
API 라우트·데이터베이스·외부 시세 연동·로그인이 전혀 없으며, 빌드 결과는 정적 페이지 하나입니다.

## 도메인 규칙

| 항목 | 값 |
|---|---|
| 과세 대상 | 해외 상장 주식·ETF 양도차익 |
| 과세 기간 | 1/1 ~ 12/31 (결제일 기준) |
| 기본공제 | 연 250만원 |
| 세율 | 양도소득세 20% + 지방소득세 2% = 22% |
| 손익통산 | 같은 과세기간 내 해외주식 간 이익·손실 합산 |
| 이월결손금 | 공제 없음 |

```
realizedTotal = priorRealizedGain + Σ (x_i × perShareGain_i)
taxableBase   = max(0, realizedTotal - 2_500_000)
tax           = taxableBase × 0.22
```

원화 기준 과세이므로 환차익도 과세 대상입니다.

```
perShareGain_i = (currentPrice_i × fxSell) - (avgBuyPrice_i × fxBuy_i)
```

기본값은 `fxBuy = fxSell = 현재 환율`(단일 환율)이며, 표에서 **매수 시점 환율 직접 입력**을 켜면
종목별 매수 환율을 넣어 환차손익까지 반영할 수 있습니다.

## 왜 단순 정렬로는 안 되는가

기본공제 250만원 때문에 세금 함수가 구간 선형입니다. 실현손익이 250만원 이하면 한계세율이 0이고,
넘는 순간 22%가 됩니다. 따라서 "수익률 낮은 순"이나 "손실 종목 우선" 같은 단일 기준 그리디는
최적해를 놓칩니다. 이익 종목과 손실 종목을 **함께** 조합해 실현손익 합계를 공제 한도 근처에
착지시키는 것이 핵심입니다.

예시 데이터 기준 — 단순 매도는 세금 4,770,392원, 최적 조합은 0원입니다.

## 알고리즘

**1단계 · 초기해 4종** (`lib/optimizer.ts`)

| 이름 | 전략 |
|---|---|
| `greedyLossFirst` | 평가손실 종목 전량 매도 → 부족분을 주당이익 낮은 순으로 |
| `greedyDeductionFit` | 실현손익 합계를 남은 공제 한도에 맞춤 (매도대금 1원당 이익이 작은 순) |
| `greedyProRata` | 현재 비중대로 균등 비율 매도 (drift 최소) |
| `baseline` | 단순 매도. 최적해가 baseline보다 나빠지지 않도록 초기해에 포함 |

**2단계 · 국소탐색** — steepest-ascent hill climbing. 이웃은 (a) 한 종목 수량 ±1/±5/±10/±5%
(b) 두 종목 간 매도 금액을 유지한 수량 교환. 시간 예산 200ms 또는 최대 5,000회 이동, 랜덤 재시작 3회.
난수는 고정 시드라 같은 입력이면 항상 같은 결과가 나옵니다.

**3단계 · 결과 선별** — `portfolioWeight`를 0 / 0.5 / 1로 각각 돌려 "세금 최소 / 균형 / 비중 유지"
세 조합을 만듭니다. 완전히 같은 조합은 하나로 합칩니다.

목적함수:

```
cost = tax + portfolioWeight × DRIFT_SCALE × portfolioDrift + ε × (초과 매도 금액)
```

`DRIFT_SCALE = targetCash × 0.1`. 마지막 항은 세액이 같은 해가 여럿일 때 "덜 파는 쪽"을 고르게 하는
동점 해소 장치이며, 1원의 세금 차이도 뒤집지 못할 만큼 작습니다(`1e-9`).

`portfolioDrift`는 매도 전후 비중 벡터의 L1 거리 절반이고, 전량 청산이면 1입니다.

## 구조

```
app/
  layout.tsx  page.tsx  globals.css  page.test.tsx
components/
  HoldingsTable  CsvPasteBox  InputPanel  NumberInput
  ResultSummary  PlanCards  TaxBreakdown  ComparisonChart
lib/
  types.ts  tax.ts  optimizer.ts  baseline.ts
  sampleData.ts  format.ts
  tax.test.ts  optimizer.test.ts
```

`lib/tax.ts`는 전부 순수 함수입니다.

## 테스트

```
lib/tax.test.ts        세액 계산 7개 필수 케이스 + 환율·drift·evaluatePlan
lib/optimizer.test.ts  제약(실수령액 ≥ 목표, locked=0, 정수·범위), baseline 대비 절감, 성능
app/page.test.tsx      예시 데이터 → 절감액 → 조합 선택 → 매도 제외 반영까지 화면 동작
```

## 배포

Vercel에 그대로 올라갑니다. 빌드 명령 `npm run build`, 프레임워크 프리셋 Next.js,
환경 변수 없음.

```bash
npx vercel        # 미리보기
npx vercel --prod # 프로덕션
```

## MVP에서 제외한 것

대주주 요건, 해외 배당소득 및 금융소득종합과세, 매매 수수료·제비용, 국내주식·국내상장 ETF.
화면 하단에도 같은 내용을 고지합니다.

---

본 서비스는 세무 상담이 아닌 계산 보조 도구입니다.
