import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: "/admin/dashboard.html", destination: "/admin/dashboard" },
      { source: "/admin/users.html", destination: "/admin/users" },
      { source: "/admin/posts.html", destination: "/admin/posts" },
      { source: "/admin/content.html", destination: "/admin/content" },
      { source: "/admin/media.html", destination: "/admin/media" },
      { source: "/admin/index.html", destination: "/admin" },
    ];
  },
};

export default nextConfig;
