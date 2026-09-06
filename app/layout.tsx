import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "실수령 — 해외주식 매도 세금 최적화",
  description:
    "필요한 현금을 마련하면서 해외주식 양도소득세를 가장 적게 내는 매도 조합을 계산합니다. 모든 계산은 브라우저에서만 이루어집니다.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
