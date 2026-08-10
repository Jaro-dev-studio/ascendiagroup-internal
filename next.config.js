/**
 * @type {import('next').NextConfig}
 */
module.exports = {
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
  },
  reactStrictMode: false,
  /*webpack: (config) => {
    Object.defineProperty(config, "devtool", {
      get() {
        return "source-map";
      },
      set() {},
    });
    // config.devtool = "source-map";
    return config;
  },*/
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};
