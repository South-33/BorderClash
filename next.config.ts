import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // This site exports only a few pages. Avoid starting a worker per CPU core.
  experimental: { cpus: 2 },
};

export default nextConfig;
