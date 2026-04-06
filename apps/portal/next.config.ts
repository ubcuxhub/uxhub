import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@uxhub/ui"],
  reactCompiler: true,
};

export default nextConfig;
