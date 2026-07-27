import { getServerEnv, isHighLevelConfigured } from "../env";
import { DemoHighLevelProvider } from "./demo-provider";
import { PrivateIntegrationHighLevelProvider } from "./private-integration-provider";
import type { HighLevelProvider } from "./provider";

export * from "./provider";
export { DemoHighLevelProvider } from "./demo-provider";
export { PrivateIntegrationHighLevelProvider } from "./private-integration-provider";

let cachedProvider: HighLevelProvider | null = null;

/** Server-only. Selects the private-integration provider once real credentials exist, demo data otherwise. */
export function getHighLevelProvider(): HighLevelProvider {
  if (cachedProvider) return cachedProvider;
  if (isHighLevelConfigured()) {
    const env = getServerEnv();
    cachedProvider = new PrivateIntegrationHighLevelProvider(
      env.HIGHLEVEL_PRIVATE_INTEGRATION_TOKEN!,
      env.HIGHLEVEL_LOCATION_ID!,
    );
  } else {
    cachedProvider = new DemoHighLevelProvider();
  }
  return cachedProvider;
}
