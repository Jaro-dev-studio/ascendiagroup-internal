import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "dev.jaro.studio",
  appName: "Jaro.dev Studio",
  webDir: "out",
  server: {
    // Load the hosted web app instead of local static files
    // Change this to your production URL when deploying
    url: "https://studio.jaro.dev",
    cleartext: false,
  },
  ios: {
    contentInset: "automatic",
    scheme: "Jaro.dev Studio",
    backgroundColor: "#fafafa",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#fafafa",
      showSpinner: false,
    },
  },
};

export default config;
