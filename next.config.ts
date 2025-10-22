import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone', // Enable standalone output for Docker deployment
  serverExternalPackages: ["@mastra/*"],
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb', // Increase from default 1mb to handle larger PDFs
    },
  },
};

export default nextConfig;
