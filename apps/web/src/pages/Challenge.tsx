import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { ChallengePublic, Lesson, TestRunResult } from "@1pe/contracts";
import { api, type Attempt, type SubmitResult } from "../api.ts";
import { Button, Card, Difficulty, ErrorNote, Label, Pill, Provenance, cx, formatMs, useLoad, useTick } from "../components/ui.tsx";
import { go } from "../App.tsx";
import { ServerDown } from "./Today.tsx";

const draftKey = (attemptId: number) => `1pe:draft:${attemptId}`;
const readDraft = (id: number) => {
  try {
    return localStorage.getItem(draftKey(id));
  } catch {
    return null;
  }
};
const writeDraft = (id: number, code: string) => {
  try {
    localStorage.setItem(draftKey(id), code);
  } catch {
    /* storage unavailable: the draft just isn't persisted */
  }
};

export function ChallengePage({ id }: { id: string }) {
  const challenge = useLoad(() => api.challenge(id), [id]);
  const history = useLoad(() => api.attempts(id), [id]);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load the open attempt if there is one; otherwise the latest attempt for review.
  useEffect(() => {
    if (!history.data) return;
    const open = history.data.find((a) => a.status === "in_progress") ?? history.data[0];
    if (open) api.attempt(open.id).then(setAttempt).catch((e: Error) => setError(e.message));
    else setAttempt(null);
  }, [history.data]);

  if (challenge.error) return <ServerDown error={challenge.error} />;
  const ch = challenge.data;
  if (!ch) return <div className="text-muted">Loading…</div>;

  const start = () =>
    api
      .startAttempt(id)
      .then((a) => {
        setAttempt(a);
        history.reload();
      })
      .catch((e: Error) => setError(e.message));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <Brief ch={ch} attempt={attempt} onAttempt={setAttempt} />
      <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <ErrorNote error={error} />
        {!attempt ? (
          <Card className="space-y-4 p-6">
            <Label>Before you start</Label>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted">
              {ch.beforeCoding.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            <p className="text-sm text-muted">
              Starting records the time. Use the thinking timer while you plan, so you can see later how long you
              reasoned before writing code.
            </p>
            <Button variant="primary" onClick={start}>
              Start attempt
            </Button>
          </Card>
        ) : attempt.status === "in_progress" ? (
          <Workspace key={attempt.id} ch={ch} attempt={attempt} onAttempt={setAttempt} onDone={() => history.reload()} />
        ) : (
          <Finished ch={ch} attempt={attempt} onRetry={start} />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * The lesson comes first: problem → why the concept exists → how it works → example → your prediction.
 * The prediction's answer stays hidden until you've committed to a guess.
 */
function LessonCard({ lesson, startOpen }: { lesson: Lesson; startOpen: boolean }) {
  const [guess, setGuess] = useState("");
  const [revealed, setRevealed] = useState(false);
  return (
    <details open={startOpen} className="group rounded-xl border border-accent/30 bg-accent/[0.03]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 sm:px-6">
        <span>
          <Label>Lesson · read first</Label>
          <span className="mt-1 block text-lg font-semibold">{lesson.concept}</span>
        </span>
        <span className="text-sm text-muted group-open:hidden">Show</span>
      </summary>
      <div className="space-y-6 px-5 pb-6 text-sm leading-relaxed sm:px-6">
        <Section title="The real-world problem">
          <ProblemText text={lesson.realWorldProblem} />
        </Section>
        <Section title="Why this concept exists">
          <ProblemText text={lesson.whyItExists} />
        </Section>
        <Section title="How it works">
          <ProblemText text={lesson.howItWorks} />
        </Section>
        <Section title="Worked example">
          <pre className="overflow-x-auto rounded-lg border border-line bg-raised/50 p-3 text-xs leading-relaxed">{lesson.example.code.trim()}</pre>
          <ProblemText text={lesson.example.explanation} />
        </Section>
        <Section title="Predict before you run">
          <pre className="overflow-x-auto rounded-lg border border-line bg-raised/50 p-3 text-xs leading-relaxed">{lesson.predict.code.trim()}</pre>
          <p className="font-medium">{lesson.predict.question}</p>
          {!revealed ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 font-mono text-sm outline-none focus:border-faint"
                placeholder="Your prediction"
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
              />
              <Button onClick={() => setRevealed(true)} disabled={!guess.trim()}>
                Check
              </Button>
            </div>
          ) : (
            <div className="space-y-2 rounded-lg border border-line bg-raised/50 p-3">
              <div>
                <span className="text-faint">You said </span>
                <code>{guess}</code>
                <span className="text-faint"> · answer </span>
                <code className="text-ok">{lesson.predict.answer}</code>
              </div>
              <ProblemText text={lesson.predict.why} />
            </div>
          )}
        </Section>
        <Section title="Common mistake">
          <ProblemText text={lesson.commonMistake} />
        </Section>
      </div>
    </details>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{title}</Label>
      {children}
    </div>
  );
}

/**
 * Renders problem text from YAML: blank lines separate paragraphs, wrapped lines are joined,
 * and indented lines (signatures, shapes) are shown as code.
 */
function ProblemText({ text }: { text: string }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {text
        .trim()
        .split(/\n\s*\n/)
        .flatMap((para, i) => {
          // Group consecutive lines into prose runs and indented (code) runs.
          const runs: { code: boolean; lines: string[] }[] = [];
          for (const line of para.split("\n")) {
            const code = /^\s{2,}/.test(line);
            const last = runs[runs.length - 1];
            if (last && last.code === code) last.lines.push(line);
            else runs.push({ code, lines: [line] });
          }
          return runs.map((r, j) =>
            r.code ? (
              <pre key={`${i}-${j}`} className="overflow-x-auto rounded-lg border border-line bg-raised/50 p-3 text-xs leading-relaxed">
                {r.lines.map((l) => l.replace(/^\s{2}/, "")).join("\n")}
              </pre>
            ) : (
              <p key={`${i}-${j}`}>
                {r.lines
                  .map((l) => l.trim())
                  .join(" ")
                  .split(/`([^`]+)`/)
                  .map((part, k) =>
                    k % 2 ? (
                      <code key={k} className="rounded bg-raised px-1 py-0.5 text-[0.85em]">
                        {part}
                      </code>
                    ) : (
                      part
                    ),
                  )}
              </p>
            ),
          );
        })}
    </div>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">
      {items.map((i) => (
        <li key={i}>{i}</li>
      ))}
    </ol>
  );
}

function Brief({ ch, attempt, onAttempt }: { ch: ChallengePublic; attempt: Attempt | null; onAttempt: (a: Attempt) => void }) {
  const [error, setError] = useState<string | null>(null);
  const open = attempt?.status === "in_progress";
  const hintsLeft = attempt ? attempt.hintCount - attempt.hints.length : ch.hintCount;

  const askHint = () =>
    attempt &&
    api
      .hint(attempt.id)
      .then(onAttempt)
      .catch((e: Error) => setError(e.message));

  return (
    <div className="space-y-6">
      <div>
        <a href="#/challenges" className="text-sm text-muted hover:text-ink">
          ← Challenges
        </a>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Pill tone="accent">{ch.type}</Pill>
          <Difficulty n={ch.difficulty} />
          {ch.skills.map((s) => (
            <code key={s} className="rounded bg-raised px-1.5 py-0.5 text-xs text-muted">
              {s}
            </code>
          ))}
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{ch.title}</h1>
        <p className="mt-2 text-muted">{ch.objective}</p>
      </div>

      {ch.lesson && <LessonCard lesson={ch.lesson} startOpen={!attempt || attempt.status === "in_progress"} />}

      <Card className="space-y-6 p-5 sm:p-6">
        <Section title="Problem">
          <ProblemText text={ch.problem} />
        </Section>
        <Section title="Requirements">
          <List items={ch.requirements} />
        </Section>
        <Section title="Constraints">
          <List items={ch.constraints} />
        </Section>
        <Section title="Examples">
          <div className="space-y-2">
            {ch.examples.map((e, i) => (
              <div key={i} className="rounded-lg border border-line bg-raised/50 p-3 font-mono text-xs leading-relaxed">
                <div>
                  <span className="text-faint">in </span>
                  {e.input}
                </div>
                <div>
                  <span className="text-faint">out </span>
                  <span className="text-ok">{e.output}</span>
                </div>
                {e.note && <div className="mt-1 font-sans text-muted">{e.note}</div>}
              </div>
            ))}
          </div>
        </Section>
        <Section title="Edge cases to investigate">
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted">
            {ch.edgeCasesToConsider.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Section>
      </Card>

      <Card className="space-y-4 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <Label>
            Hints · {attempt?.hints.length ?? 0} of {ch.hintCount} used
          </Label>
          {open && (
            <Button onClick={askHint} disabled={hintsLeft === 0}>
              {hintsLeft === 0 ? "No hints left" : "Reveal next hint"}
            </Button>
          )}
        </div>
        <p className="text-xs leading-relaxed text-faint">
          Hints start as questions and get more concrete. Hint 4 onwards gives implementation detail, so the attempt
          counts as assisted rather than hinted. Try reasoning for a while first.
        </p>
        <ErrorNote error={error} />
        {attempt?.hints.map((h, i) => (
          <div key={i} className="rounded-lg border border-line bg-raised/50 p-3 text-sm leading-relaxed">
            <span className="mr-2 font-mono text-xs text-accent">#{i + 1}</span>
            {h}
          </div>
        ))}
      </Card>

      <details className="group rounded-xl border border-line bg-surface p-5">
        <summary className="cursor-pointer text-sm text-muted group-open:text-ink">
          Common mistakes · read after your first attempt
        </summary>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted">
          {ch.commonMistakes.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </details>

      <details className="group rounded-xl border border-line bg-surface p-5">
        <summary className="cursor-pointer text-sm text-muted group-open:text-ink">Visible tests (public.test.js)</summary>
        <pre className="mt-3 overflow-x-auto text-xs leading-relaxed text-muted">{ch.publicTests}</pre>
      </details>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Workspace({
  ch,
  attempt,
  onAttempt,
  onDone,
}: {
  ch: ChallengePublic;
  attempt: Attempt;
  onAttempt: (a: Attempt) => void;
  onDone: () => void;
}) {
  const [code, setCode] = useState(() => readDraft(attempt.id) ?? attempt.lastSubmission?.code ?? ch.starterCode);
  const [run, setRun] = useState<TestRunResult | null>(attempt.lastSubmission?.results ?? null);
  const [busy, setBusy] = useState<null | "run" | "submit">(null);
  const [error, setError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState(attempt.lastSubmission?.explanation ?? "");
  const [outsideHelp, setOutsideHelp] = useState(false);
  const [submitted, setSubmitted] = useState<SubmitResult | null>(null);
  const editedRef = useRef(attempt.metrics.find((m) => m.key === "timeToFirstEdit")?.valueMs != null);

  const onChange = (next: string) => {
    setCode(next);
    writeDraft(attempt.id, next);
    if (!editedRef.current) {
      editedRef.current = true;
      api.event(attempt.id, "first_edit").then(onAttempt).catch(() => {});
    }
  };

  // Tab inserts two spaces instead of leaving the editor.
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const el = e.currentTarget;
    const { selectionStart: s, selectionEnd: end } = el;
    const next = code.slice(0, s) + "  " + code.slice(end);
    onChange(next);
    requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2));
  };

  const runTests = async () => {
    setBusy("run");
    setError(null);
    try {
      setRun(await api.run(attempt.id, code));
      onAttempt(await api.attempt(attempt.id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const submit = async () => {
    setBusy("submit");
    setError(null);
    try {
      const r = await api.submit(attempt.id, { code, explanation, usedOutsideHelp: outsideHelp });
      setRun(r.results);
      setSubmitted(r);
      onAttempt(r.attempt);
      if (r.allPassed) onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const viewSolution = async () => {
    const ok = window.confirm(
      "Viewing the reference solution marks this attempt as 'solution viewed'. Passing it afterwards counts as exposure, not ability.\n\nShow the solution?",
    );
    if (!ok) return;
    try {
      onAttempt(await api.solution(attempt.id));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <>
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <span className="font-mono text-xs text-muted">solution.js</span>
          <span className="text-xs text-faint">draft saved in this browser</span>
        </div>
        <textarea
          className="code block h-[420px] w-full resize-y bg-surface p-4 text-[13px] leading-relaxed text-ink outline-none"
          spellCheck={false}
          value={code}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label="Code editor"
        />
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
          <Button onClick={runTests} disabled={busy !== null}>
            {busy === "run" ? "Running…" : "Run visible tests"}
          </Button>
          <span className="text-xs text-faint">Iterate here. Submitting also runs the hidden tests.</span>
        </div>
      </Card>

      <ErrorNote error={error} />
      {run && <Results run={run} />}
      {submitted && !submitted.allPassed && (
        <div className="rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
          Not all tests pass yet. The attempt stays open. Look at which cases failed, form a hypothesis, then change one
          thing.
        </div>
      )}

      <Card className="space-y-3 p-5">
        <Label>Explanation checkpoint</Label>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{ch.explanationCheckpoint.trim()}</p>
        <textarea
          className="h-32 w-full resize-y rounded-lg border border-line bg-raised/50 p-3 text-sm leading-relaxed outline-none focus:border-faint"
          placeholder="In your own words. Code without reasoning isn't evidence of understanding."
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
        />
        <label className="flex items-start gap-2 text-sm text-muted">
          <input
            type="checkbox"
            className="mt-1 accent-[var(--color-accent)]"
            checked={outsideHelp}
            onChange={(e) => setOutsideHelp(e.target.checked)}
          />
          <span>
            I used help from outside 1% Engineer (AI, search results, another person). 1% Engineer can't see this, so it
            only knows if you say so.
          </span>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={submit} disabled={busy !== null || explanation.trim().length < 40}>
            {busy === "submit" ? "Submitting…" : "Submit for evaluation"}
          </Button>
          {explanation.trim().length < 40 && (
            <span className="text-xs text-faint">Write at least a few sentences ({explanation.trim().length}/40).</span>
          )}
        </div>
      </Card>

      <Metrics attempt={attempt} onAttempt={onAttempt} />

      <Card className="p-5">
        {attempt.solution ? (
          <>
            <Label>Reference solution (viewed)</Label>
            <pre className="mt-3 overflow-x-auto text-xs leading-relaxed text-muted">{attempt.solution}</pre>
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">Truly stuck after the hints? You can see the solution, honestly recorded.</p>
            <Button variant="danger" onClick={viewSolution}>
              Show solution
            </Button>
          </div>
        )}
      </Card>
    </>
  );
}

function Results({ run }: { run: TestRunResult }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <Label>Test results</Label>
        <Pill tone={run.failed === 0 ? "ok" : "bad"}>
          {run.passed} passed · {run.failed} failed
        </Pill>
        {run.timedOut && <Pill tone="bad">timed out</Pill>}
      </div>
      <ul className="mt-3 space-y-1.5">
        {run.cases.map((c, i) => (
          <li key={i} className="text-sm">
            <div className="flex items-start gap-2">
              <span className={cx("mt-0.5 font-mono text-xs", c.passed ? "text-ok" : "text-bad")}>{c.passed ? "✓" : "✗"}</span>
              <span className={c.passed ? "text-muted" : ""}>{c.name}</span>
              {c.hidden && <span className="ml-auto shrink-0 text-xs text-faint">hidden</span>}
            </div>
            {c.message && (
              <pre className="ml-5 mt-1 overflow-x-auto whitespace-pre-wrap rounded bg-raised/60 p-2 text-xs text-muted">
                {c.message}
              </pre>
            )}
          </li>
        ))}
      </ul>
      {run.stderr && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-faint">stderr</summary>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-muted">{run.stderr}</pre>
        </details>
      )}
    </Card>
  );
}

function Metrics({ attempt, onAttempt }: { attempt: Attempt; onAttempt?: (a: Attempt) => void }) {
  useTick(1000);
  const thinking = attempt.metrics.find((m) => m.key === "thinking");
  const running = Boolean(thinking?.runningSince);
  const open = attempt.status === "in_progress";

  const live = (m: Attempt["metrics"][number]) => {
    if (m.key === "thinking" && m.runningSince) {
      // Server sends completed intervals; add the one still running.
      return formatMs((m.valueMs ?? 0) + (Date.now() - new Date(m.runningSince).getTime()));
    }
    if (m.key === "elapsed" && open) return formatMs(Date.now() - new Date(attempt.startedAt).getTime());
    return m.count !== undefined ? String(m.count) : formatMs(m.valueMs);
  };

  const toggle = () =>
    onAttempt && api.event(attempt.id, running ? "timer_pause" : "timer_start").then(onAttempt).catch(() => {});

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <Label>Process metrics</Label>
        {open && onAttempt && (
          <Button onClick={toggle} variant={running ? "primary" : "default"}>
            {running ? "Pause thinking timer" : "Start thinking timer"}
          </Button>
        )}
      </div>
      <ul className="mt-3 divide-y divide-line">
        {attempt.metrics.map((m) => (
          <li key={m.key} className="flex items-center gap-3 py-2.5 text-sm" title={m.caveat}>
            <span className="flex-1">
              {m.label}
              <span className="block text-xs text-faint">{m.caveat}</span>
            </span>
            <span className="font-mono tabular-nums">{live(m)}</span>
            <Provenance p={m.provenance} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function Finished({ ch, attempt, onRetry }: { ch: ChallengePublic; attempt: Attempt; onRetry: () => void }) {
  const independenceText: Record<string, string> = {
    independent: "Solved independently. This is strong evidence.",
    hinted: "Solved with conceptual hints. Good evidence of applying with help.",
    assisted: "Solved with implementation-level help. It counts as 'applies with help'.",
    solution_viewed: "Passed after viewing the solution. Recorded as exposure, not ability. Try a similar problem in a few days.",
  };
  return (
    <>
      <Card className="space-y-3 p-6">
        <div className="flex items-center gap-2">
          <Pill tone="ok">passed</Pill>
          {attempt.independence && <Pill>{attempt.independence.replace("_", " ")}</Pill>}
        </div>
        <h2 className="text-lg font-semibold">{ch.title}</h2>
        <p className="text-sm text-muted">{attempt.independence && independenceText[attempt.independence]}</p>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            variant="primary"
            onClick={() => go(`/journal/new?attempt=${attempt.id}&title=${encodeURIComponent(ch.title)}`)}
          >
            Write journal entry
          </Button>
          <Button onClick={onRetry}>New attempt</Button>
        </div>
      </Card>
      {attempt.lastSubmission && (
        <>
          <Results run={attempt.lastSubmission.results} />
          <Card className="p-5">
            <Label>Your explanation</Label>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">{attempt.lastSubmission.explanation}</p>
            <p className="mt-3 text-xs text-faint">
              AI evaluation of explanations against the rubric arrives in M5. For now, compare it with the rubric yourself.
            </p>
            <ul className="mt-3 space-y-1.5 text-sm">
              {ch.rubric.map((r) => (
                <li key={r.criterion}>
                  <span className="font-medium">{r.criterion}:</span> <span className="text-muted">{r.description}</span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
      <Metrics attempt={attempt} />
    </>
  );
}
