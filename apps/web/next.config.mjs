/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // @obsidian/* workspace packages ship TypeScript source; let Next transpile them.
  transpilePackages: ["@obsidian/core", "@obsidian/db"],
  serverExternalPackages: ["@node-rs/argon2", "postgres"],
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    // The workspace packages and our lib use NodeNext-style ".js" specifiers
    // that actually point at ".ts" source. Teach webpack to resolve them.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
