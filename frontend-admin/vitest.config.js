import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: [
      "src/utils/publicLeadSubmission.test.js",
      "src/components/PublicLeadCaptureBridge.test.jsx",
    ],
    fileParallelism: false,
    sequence: { concurrent: false },
    isolate: true,
    clearMocks: true,
    restoreMocks: true,
    env: {},
  },
});
