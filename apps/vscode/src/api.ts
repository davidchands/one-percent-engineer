/**
 * HTTP client for the local 1% Engineer server. Same actions as the web app's client.
 * No `vscode` import, so it can be tested with plain Node.
 */
import type {
  AttemptResponse,
  AttemptSummary,
  ChallengePublic,
  SubmitResponse,
  TestRunResult,
  TodayResponse,
} from "@1pe/contracts";

export class ApiError extends Error {
  constructor(
    message: string,
    /** True when the server isn't running at all, as opposed to rejecting a request. */
    public unreachable = false,
  ) {
    super(message);
  }
}

export class Api {
  constructor(private baseUrl: () => string) {}

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl().replace(/\/$/, "")}/api${path}`, {
        method,
        headers: body === undefined ? {} : { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new ApiError(`Can't reach the 1% Engineer server at ${this.baseUrl()}. Is \`pnpm dev\` running?`, true);
    }
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new ApiError(data.error ?? `${res.status} ${res.statusText}`);
    return data as T;
  }

  today = () => this.call<TodayResponse>("GET", "/today");
  challenge = (id: string) => this.call<ChallengePublic>("GET", `/challenges/${encodeURIComponent(id)}`);
  attempts = (id: string) => this.call<AttemptSummary[]>("GET", `/challenges/${encodeURIComponent(id)}/attempts`);
  startAttempt = (id: string) => this.call<AttemptResponse>("POST", `/challenges/${encodeURIComponent(id)}/attempts`);
  attempt = (id: number) => this.call<AttemptResponse>("GET", `/attempts/${id}`);
  hint = (id: number) => this.call<AttemptResponse>("POST", `/attempts/${id}/hints`);
  run = (id: number, code: string) => this.call<TestRunResult>("POST", `/attempts/${id}/run`, { code });
  submit = (id: number, body: { code: string; explanation: string; usedOutsideHelp: boolean }) =>
    this.call<SubmitResponse>("POST", `/attempts/${id}/submit`, body);
  solution = (id: number) => this.call<AttemptResponse>("POST", `/attempts/${id}/solution`, { confirm: true });
  event = (id: number, kind: "timer_start" | "timer_pause" | "first_edit") =>
    this.call<AttemptResponse>("POST", `/attempts/${id}/events`, {
      kind,
      provenance: kind === "first_edit" ? "observed" : "manual",
      payload: { client: "vscode" },
    });
}
