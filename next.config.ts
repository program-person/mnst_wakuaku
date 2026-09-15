import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // CSV 一括取り込み用。既定の 1MB では数千行の CSV が弾かれる
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
