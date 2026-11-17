import { LEVEL_NAMES } from "@1pe/contracts";
import { api } from "../api.ts";
import { Button, Card, Difficulty, ErrorNote, Label, Pill, useLoad } from "../components/ui.tsx";
import { go } from "../App.tsx";

const longDate = (iso: string) =>
  new Date(iso + "T12:00:00Z").toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

export function TodayPage() {
  const { data, error } = useLoad(api.today, []);
  if (error) return <ServerDown error={error} />;
  if (!data) return <div className="text-muted">Loading…</div>;

  const p = data.primary;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <div>
          <div className="text-sm text-muted">{longDate(data.date)}</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            {p
              ? data.stats.passedToday.length
                ? `${data.stats.passedToday.length} done today. Keep going?`
                : "Today's challenge."
              : "Nothing left in the challenge bank."}
          </h1>
          {data.stats.passedToday.length > 0 && (
            <p className="mt-2 text-sm text-muted">
              Passed today: {data.stats.passedToday.map((c) => c.title).join(", ")}
            </p>
          )}
        </div>

        {p ? (
          <Card className="overflow-hidden">
            <div className="border-b border-line p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone="accent">{p.challenge.type}</Pill>
                <Pill>Phase {p.challenge.phase}</Pill>
                {p.passed && <Pill tone="ok">passed</Pill>}
                <span className="ml-auto">
                  <Difficulty n={p.challenge.difficulty} />
                </span>
              </div>
              <h2 className="mt-4 text-xl font-semibold">{p.challenge.title}</h2>
              <p className="mt-2 text-muted">{p.challenge.objective}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {p.challenge.skills.map((s) => (
                  <code key={s} className="rounded bg-raised px-1.5 py-0.5 text-xs text-muted">
                    {s}
                  </code>
                ))}
              </div>
              <div className="mt-6">
                <Button variant={p.passed ? "default" : "primary"} onClick={() => go(`/challenge/${p.challenge.id}`)}>
                  {p.passed ? "Review it" : p.openAttemptId ? "Resume challenge" : "Start challenge"} →
                </Button>
              </div>
            </div>

            <div className="bg-raised/40 p-5 sm:p-6">
              <Label>Why this, today</Label>
              {p.rationale.isPlaceholder && (
                <div className="mt-3 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-sm text-accent">
                  Placeholder selector. Real, evidence-based selection is your task M1-b in{" "}
                  <code>packages/core/src/selector.js</code>.
                </div>
              )}
              <p className="mt-3 text-sm leading-relaxed">{p.rationale.summary}</p>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-faint">Gap</dt>
                  <dd className="mt-1 text-muted">{p.rationale.gap}</dd>
                </div>
                <div>
                  <dt className="text-faint">Expected outcome</dt>
                  <dd className="mt-1 text-muted">{p.rationale.expectedOutcome}</dd>
                </div>
                <div>
                  <dt className="text-faint">How it's measured</dt>
                  <dd className="mt-1 text-muted">{p.rationale.howMeasured}</dd>
                </div>
              </dl>
            </div>
          </Card>
        ) : (
          <Card className="p-6 text-muted">
            Every challenge has been passed. Add new ones under <code>content/challenges/</code> and run{" "}
            <code>pnpm validate:content</code>.
          </Card>
        )}

        {!data.stats.projectionImplemented && (
          <Card className="p-5 text-sm text-muted">
            <span className="font-medium text-ink">Skill levels read 0 everywhere, on purpose.</span> Your evidence is being
            recorded, but turning it into levels is task M1-a (<code>packages/core/src/mastery.js</code>). When those tests
            pass, every past attempt is re-interpreted automatically, because levels are computed from evidence, never stored.
          </Card>
        )}

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <Label>Recent journal</Label>
            <a href="#/journal" className="text-sm text-muted hover:text-ink">
              All entries →
            </a>
          </div>
          {data.recentJournal.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No entries yet. After each challenge, write down how you thought.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {data.recentJournal.map((j) => (
                <li key={j.id}>
                  <a href={`#/journal/${j.id}`} className="flex items-baseline justify-between gap-3 py-2.5 hover:text-accent">
                    <span className="truncate">{j.title}</span>
                    <span className="shrink-0 text-xs text-faint">{new Date(j.createdAt).toLocaleDateString()}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <aside className="space-y-6">
        <Card className="p-5">
          <Label>Where you are</Label>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <Stat value={`${data.stats.challengesPassed}/${data.stats.challengesTotal}`} label="challenges passed" />
            <Stat value={`${data.stats.practicedDaysThisWeek}/7`} label="days practised, last 7" />
          </div>
          <p className="mt-4 text-xs leading-relaxed text-faint">
            No streaks. Practising most days matters; an unbroken chain doesn't.
          </p>
        </Card>

        <Card className="p-5">
          <Label>Needs attention</Label>
          {data.weaknesses.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No failed submissions in the last 14 days.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {data.weaknesses.map((w) => (
                <li key={w.skillId} className="flex justify-between gap-2">
                  <span>{w.name}</span>
                  <span className="text-bad">{w.failures} failed</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-faint">From failed submissions, last 14 days.</p>
        </Card>

        <Card className="p-5">
          <Label>Upcoming reviews</Label>
          {data.reviews.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              {data.stats.projectionImplemented
                ? "Nothing scheduled yet."
                : "Scheduled reviews appear once your mastery projection sets nextReviewAt."}
            </p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {data.reviews.map((r) => (
                <li key={r.skillId} className="flex justify-between gap-2">
                  <code className="text-muted">{r.skillId}</code>
                  <span className="text-faint">{r.nextReviewAt && new Date(r.nextReviewAt).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5 text-xs leading-relaxed text-faint">
          Levels: {Object.entries(LEVEL_NAMES).filter(([k]) => k !== "0").map(([k, v]) => `${k} ${v}`).join(" · ")}
        </Card>
      </aside>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-0.5 text-xs text-muted">{label}</div>
    </div>
  );
}

export function ServerDown({ error }: { error: string }) {
  return (
    <Card className="mx-auto max-w-xl space-y-3 p-6">
      <h1 className="text-lg font-semibold">Can't reach the 1% Engineer server</h1>
      <ErrorNote error={error} />
      <p className="text-sm text-muted">
        Start everything from the project root with <code className="text-ink">pnpm dev</code>. The server runs on
        port 4100.
      </p>
    </Card>
  );
}
