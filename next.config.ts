import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Turbopack is used by default in Next.js 16, no webpack config needed
  // pdf2json will work with require() inside the function
};

export default nextConfig;
