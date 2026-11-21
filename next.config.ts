import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // Keep the repository-owned AGENTS.md stable. Next's generated agent rules
  // are framework guidance, not BorderClash project instructions.
  agentRules: false,
  // This site exports only a few pages. Avoid starting a worker per CPU core.
  experimental: { cpus: 2 },
};

export default nextConfig;
