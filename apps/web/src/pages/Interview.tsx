import { useState } from "react";
import type { ChallengePublic, ComplexityClass } from "@1pe/contracts";
import { api, type Attempt } from "../api.ts";
import { Button, Card, ErrorNote, Label, Pill, cx, formatMs, useLoad, useTick } from "../components/ui.tsx";
import { go } from "../App.tsx";
import { ServerDown } from "./Today.tsx";

const MINUTES = [20, 30, 45];

/**
 * Interview-style problems: plan before you code, and optionally race a countdown.
 * The answer to the plan is shown only after you commit, one try per attempt.
 */
export function InterviewPanel({
  ch,
  attempt,
  onAttempt,
}: {
  ch: ChallengePublic;
  attempt: Attempt;
  onAttempt: (a: Attempt) => void;
}) {
  const options = ch.planOptions;
  const [pattern, setPattern] = useState("");
  const [time, setTime] = useState("");
  const [space, setSpace] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!options) return null;
  const open = attempt.status === "in_progress";

  const commit = async () => {
    setBusy(true);
    setError(null);
    try {
      onAttempt(
        await api.commitPlan(attempt.id, {
          pattern,
          timeComplexity: time as ComplexityClass,
          spaceComplexity: space as ComplexityClass,
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label>Interview mode · plan before you code</Label>
        <Pill tone="info">interview problem</Pill>
      </div>
      <ErrorNote error={error} />

      {attempt.plan ? (
        <PlanResult plan={attempt.plan} />
      ) : open ? (
        <>
          <p className="text-sm text-muted">
            In an interview you say the technique and the cost before you write code. Choose now. The answer is shown after you
            commit, and you only get one try per attempt.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Technique">
              <select className={selectCls} value={pattern} onChange={(e) => setPattern(e.target.value)}>
                <option value="">Choose…</option>
                {options.patterns.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Time cost">
              <ComplexitySelect value={time} onChange={setTime} options={options.complexities} />
            </Field>
            <Field label="Memory cost">
              <ComplexitySelect value={space} onChange={setSpace} options={options.complexities} />
            </Field>
          </div>
          <p className="text-xs text-faint">n is the size of the input. k is a second size, such as the number of coin values.</p>
          <Button variant="primary" onClick={commit} disabled={busy || !pattern || !time || !space}>
            {busy ? "Committing…" : "Commit my plan"}
          </Button>
        </>
      ) : (
        <p className="text-sm text-muted">No plan was committed for this attempt.</p>
      )}

      <Countdown attempt={attempt} onAttempt={onAttempt} />
    </Card>
  );
}

const selectCls = "w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-sm outline-none focus:border-faint";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-faint">{label}</span>
      {children}
    </label>
  );
}

function ComplexitySelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select className={selectCls} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Choose…</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

export function PlanResult({ plan }: { plan: NonNullable<Attempt["plan"]> }) {
  const rows = [
    { label: "Technique", yours: plan.pattern.replace("dsa.", "").replace(/-/g, " "), right: plan.patternCorrect, answer: plan.answer.patternName },
    { label: "Time cost", yours: plan.timeComplexity, right: plan.timeCorrect, answer: plan.answer.timeComplexity },
    { label: "Memory cost", yours: plan.spaceComplexity, right: plan.spaceCorrect, answer: plan.answer.spaceComplexity },
  ];
  return (
    <ul className="divide-y divide-line rounded-lg border border-line text-sm">
      {rows.map((r) => (
        <li key={r.label} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
          <span className={cx("font-mono text-xs", r.right ? "text-ok" : "text-bad")}>{r.right ? "✓" : "✗"}</span>
          <span className="w-24 text-faint">{r.label}</span>
          <span>{r.yours}</span>
          {!r.right && (
            <span className="text-muted">
              · best solution: <span className="text-ok">{r.answer}</span>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function Countdown({ attempt, onAttempt }: { attempt: Attempt; onAttempt: (a: Attempt) => void }) {
  useTick(1000);
  const [error, setError] = useState<string | null>(null);
  const t = attempt.interview;
  const open = attempt.status === "in_progress";

  if (!t) {
    if (!open) return null;
    return (
      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <span className="text-sm text-muted">Race the clock:</span>
        {MINUTES.map((m) => (
          <Button
            key={m}
            onClick={() =>
              api
                .startInterview(attempt.id, m)
                .then(onAttempt)
                .catch((e: Error) => setError(e.message))
            }
          >
            {m} min
          </Button>
        ))}
        <ErrorNote error={error} />
        <span className="w-full text-xs text-faint">It never stops you. It records whether you finished in time.</span>
      </div>
    );
  }

  const deadline = new Date(t.startedAt).getTime() + t.minutes * 60_000;
  const left = deadline - Date.now();
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4 text-sm">
      <span className="text-faint">{t.minutes} minute interview</span>
      {open ? (
        <span className={cx("font-mono text-base", left < 0 ? "text-bad" : left < 300_000 ? "text-accent" : "text-ink")}>
          {left >= 0 ? `${formatMs(left)} left` : `${formatMs(-left)} over`}
        </span>
      ) : (
        <Pill tone={t.finishedWithin ? "ok" : "bad"}>{t.finishedWithin ? "finished in time" : "ran over time"}</Pill>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The Interview page: pattern map and review queue                    */
/* ------------------------------------------------------------------ */

const pct = (n: number, d: number) => (d === 0 ? "-" : `${Math.round((n / d) * 100)}%`);
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });

export function InterviewPage() {
  const { data, error } = useLoad(() => api.interview(), []);
  if (error) return <ServerDown error={error} />;
  if (!data) return <div className="text-muted">Loading…</div>;

  const due = data.review.filter((r) => r.due);
  const upcoming = data.review.filter((r) => !r.due);
  const practised = data.patterns.filter((p) => p.problems > 0);
  const planned = data.patterns.reduce((n, p) => n + p.plans, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Interview prep</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Big-tech interviews reward spotting the technique fast and knowing what it costs. Each interview problem asks
          you to plan before you code. This page shows which techniques you name correctly, and brings solved problems
          back before you forget them.
        </p>
      </div>

      <section className="space-y-3">
        <Label>Due for review</Label>
        {due.length === 0 ? (
          <Card className="p-5 text-sm text-muted">
            {data.review.length === 0
              ? "Nothing yet. Solve an interview problem and it comes back here on a widening schedule (1, 3, 7, 14, 30 days)."
              : "Nothing is due. Your next review is " + day(upcoming[0]!.dueAt) + "."}
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {due.map((r) => (
              <Card key={r.challengeId} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="truncate font-medium">{r.title}</div>
                  <div className="text-xs text-faint">
                    solved {r.timesPassed}× · last {day(r.lastPassedAt)}
                  </div>
                </div>
                <Button variant="primary" onClick={() => go(`/challenge/${r.challengeId}`)}>
                  Re-solve
                </Button>
              </Card>
            ))}
          </div>
        )}
        {upcoming.length > 0 && due.length > 0 && (
          <p className="text-xs text-faint">
            Coming up: {upcoming.slice(0, 4).map((r) => `${r.title} (${day(r.dueAt)})`).join(", ")}
          </p>
        )}
      </section>

      <section className="space-y-3">
        <Label>Pattern map</Label>
        {data.weakestPatterns.length > 0 && (
          <Card className="space-y-1 p-4 text-sm">
            <div className="font-medium">Techniques you mis-name most</div>
            <div className="flex flex-wrap gap-2 pt-1">
              {data.weakestPatterns.slice(0, 4).map((w) => (
                <Pill key={w.skillId} tone="bad">
                  {w.name}: missed {w.missed} of {w.plans}
                </Pill>
              ))}
            </div>
          </Card>
        )}
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line text-xs text-faint">
              <tr>
                <th className="px-4 py-2.5 font-medium">Technique</th>
                <th className="px-3 py-2.5 font-medium">Solved</th>
                <th className="px-3 py-2.5 font-medium">Named it</th>
                <th className="px-3 py-2.5 font-medium">Time cost</th>
                <th className="px-3 py-2.5 font-medium">Memory cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.patterns.map((p) => (
                <tr key={p.skillId} className={p.problems === 0 ? "text-faint" : ""}>
                  <td className="px-4 py-2">{p.name}</td>
                  <td className="px-3 py-2">{p.problems === 0 ? "no problems yet" : `${p.passed} of ${p.problems}`}</td>
                  <td className="px-3 py-2">{pct(p.patternRight, p.plans)}</td>
                  <td className="px-3 py-2">{pct(p.timeRight, p.plans)}</td>
                  <td className="px-3 py-2">{pct(p.spaceRight, p.plans)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <p className="text-xs text-faint">
          {practised.length} of {data.patterns.length} techniques have problems so far. {planned} plans committed.
          Percentages are the share of your plans that were right.
        </p>
      </section>
    </div>
  );
}
