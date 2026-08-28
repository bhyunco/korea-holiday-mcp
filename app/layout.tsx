import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "한국 공휴일 MCP — Claude 커스텀 커넥터",
  description:
    "Claude에 URL 하나만 붙이면 한국 공휴일·대체공휴일·영업일 계산을 정확하게 처리하는 MCP 커넥터. 설치·로그인·API 키가 필요 없습니다.",
  openGraph: {
    title: "한국 공휴일 MCP — Claude 커스텀 커넥터",
    description:
      "음력 명절, 대체공휴일, 영업일 계산까지. Claude 커넥터에 URL 하나만 등록하세요.",
    type: "website",
  },
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
