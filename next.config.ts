import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  output: "standalone",
  experimental: { typedEnv: false },
};

export default nextConfig;
