import { addons } from "storybook/manager-api";
import { version } from "../../../packages/ui/package.json";
import { preferredTheme } from "./clair-theme.ts";

addons.setConfig({
  theme: { ...preferredTheme(), brandTitle: `CLAIR — Design system ${version}` },
});
