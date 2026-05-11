import { Octokit } from "@octokit/rest";
import { throttling } from "@octokit/plugin-throttling";
import { retry } from "@octokit/plugin-retry";

const ThrottledOctokit = Octokit.plugin(throttling, retry);

export function makeOctokit(token: string): InstanceType<typeof ThrottledOctokit> {
  return new ThrottledOctokit({
    auth: token,
    userAgent: "gestapro-dashboard/0.1",
    throttle: {
      onRateLimit: (retryAfter, options, _octokit, retryCount) => {
        console.warn(`[octokit] rate limit on ${options.method} ${options.url} — wait ${retryAfter}s (retry ${retryCount})`);
        return retryCount < 3;
      },
      onSecondaryRateLimit: (retryAfter, options) => {
        console.warn(`[octokit] secondary rate limit on ${options.method} ${options.url} — wait ${retryAfter}s`);
        return true;
      },
    },
  });
}

export type GestaproOctokit = ReturnType<typeof makeOctokit>;
