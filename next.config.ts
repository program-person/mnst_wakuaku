import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // CSV 一括取り込み用。既定の 1MB では数千行の CSV が弾かれる
      bodySizeLimit: "5mb",
    },
  },
  async headers() {
    return [
      {
        // 個人用ツールなので検索エンジンに載せない。
        // robots.txt でクロール自体を禁じるとこの指示が読まれず URL だけ載ることがあるため、ヘッダで伝える
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
