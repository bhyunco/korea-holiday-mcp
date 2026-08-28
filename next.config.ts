import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // MCP 엔드포인트는 매 요청마다 계산하므로 캐시하지 않는다.
  experimental: {},
};

export default nextConfig;
