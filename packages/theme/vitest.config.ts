import { vitestFront } from "@clair/config/vitest.shared";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(vitestFront, defineConfig({ test: { environment: "node" } }));
