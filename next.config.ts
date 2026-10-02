import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module; keep it out of the server bundle.
  serverExternalPackages: ["better-sqlite3"],
  // The README tells people to use 127.0.0.1 (Clio requires it); Next blocks dev resources from it by default.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
