import { useState } from "react";
import type { ProjectCheckResult, StepAttemptView, StepView } from "@1pe/contracts";
import { api } from "../api.ts";
import { Button, Card, ErrorNote, Label, Pill, useLoad } from "../components/ui.tsx";
import { go } from "../App.tsx";
import { ServerDown } from "./Today.tsx";
import { LessonCard, List, ProblemText, Results, Section } from "./Challenge.tsx";
import { NextFromRoadmap } from "./Decision.tsx";

/** A Build by Learning step: lesson and task on the left, your project's checks on the right. */
export function StepPage({ projectId, id }: { projectId: string; id: string }) {
  const { data: s, error, setData, reload } = useLoad(() => api.step(projectId, id), [projectId, id]);
  if (error) return <ServerDown error={error} />;
  if (!s) return <div className="text-muted">Loading…</div>;

  const setAttempt = (attempt: StepAttemptView) => setData({ ...s, attempt, status: attempt.status === "passed" ? "passed" : "in_progress" });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <StepBrief s={s} />
      <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        {s.blockedBy.length > 0 ? (
          <Card className="space-y-3 p-6">
            <Label>Decide first</Label>
            <p className="text-sm text-muted">This step is built on a choice you haven't made yet.</p>
            {s.blockedBy.map((b) => (
              <Button key={b.id} variant="primary" onClick={() => go(`/build/${projectId}/decision/${b.id}`)}>
                {b.title} →
              </Button>
            ))}
          </Card>
        ) : !s.attempt || s.status === "redo" ? (
          <StartStep s={s} onStarted={setAttempt} />
        ) : s.attempt.status === "in_progress" ? (
          <Workspace s={s} attempt={s.attempt} onAttempt={setAttempt} onPassed={reload} />
        ) : (
          <Finished s={s} attempt={s.attempt} />
        )}
      </div>
    </div>
  );
}

function StepBrief({ s }: { s: StepView }) {
  return (
    <div className="space-y-6">
      <div>
        <a href={`#/build/${s.projectId}`} className="text-sm text-muted hover:text-ink">
          ← Roadmap
        </a>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{s.title}</h1>
        <p className="mt-2 text-muted">{s.objective}</p>
      </div>

      {s.lesson && <LessonCard lesson={s.lesson} startOpen={s.status !== "passed"} />}

      <Card className="space-y-6 p-5 text-sm sm:p-6">
        <Section title="The task">
          <ProblemText text={s.task} />
        </Section>
        <Section title="Requirements">
          <List items={s.requirements} />
        </Section>
      </Card>

      {s.notes.map((n) => (
        <Card key={n.optionName} className="space-y-4 border-info/30 p-5 text-sm sm:p-6">
          <div>
            <Label>With {n.optionName}</Label>
            <p className="mt-0.5 text-xs text-faint">Because you chose it for "{n.decisionTitle}"</p>
          </div>
          <ProblemText text={n.notes} />
          {n.example && (
            <Section title="Example, on a different problem">
              <pre className="overflow-x-auto rounded-lg border border-line bg-raised/50 p-3 text-xs leading-relaxed">{n.example.code.trim()}</pre>
              <ProblemText text={n.example.explanation} />
            </Section>
          )}
        </Card>
      ))}

      <details className="rounded-xl border border-line bg-surface">
        <summary className="cursor-pointer p-5 text-sm sm:px-6">
          <span className="font-medium">The checks</span>
          <span className="ml-2 text-muted">exactly what "done" means. They test what your app does, not how you wrote it.</span>
        </summary>
        <pre className="overflow-x-auto border-t border-line p-5 text-xs leading-relaxed sm:px-6">{s.acceptanceTests.trim()}</pre>
      </details>

      {s.commonMistakes.length > 0 && (
        <details className="rounded-xl border border-line bg-surface">
          <summary className="cursor-pointer p-5 text-sm font-medium sm:px-6">Common mistakes</summary>
          <ul className="list-disc space-y-1.5 border-t border-line p-5 pl-10 text-sm text-muted sm:px-6 sm:pl-11">
            {s.commonMistakes.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function StartStep({ s, onStarted }: { s: StepView; onStarted: (a: StepAttemptView) => void }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <Card className="space-y-4 p-6">
      <Label>{s.status === "redo" ? "Redo this step" : "Before you start"}</Label>
      {s.status === "redo" && (
        <p className="text-sm text-muted">You passed this step with a different choice. Your project needs to do the same thing with your new one.</p>
      )}
      <div>
        <p className="text-sm">Write the code in your project folder:</p>
        <code className="mt-2 block break-all rounded-lg bg-raised px-3 py-2 text-xs">{s.folder}</code>
      </div>
      {s.startsApp && (
        <p className="text-sm leading-relaxed text-muted">
          <span className="text-ink">Run checks</span> starts your app with the <code>start</code> script in your
          package.json, on a port it gives you in <code>process.env.PORT</code>, then tests it and stops it.
        </p>
      )}
      <ErrorNote error={error} />
      <Button variant="primary" onClick={() => api.startStep(s.projectId, s.id).then(onStarted).catch((e: Error) => setError(e.message))}>
        Start step
      </Button>
    </Card>
  );
}

function Workspace({ s, attempt, onAttempt, onPassed }: { s: StepView; attempt: StepAttemptView; onAttempt: (a: StepAttemptView) => void; onPassed: () => void }) {
  const [check, setCheck] = useState<ProjectCheckResult | null>(attempt.lastCheck);
  const [busy, setBusy] = useState<"run" | "submit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState("");
  const [outsideHelp, setOutsideHelp] = useState(false);
  const allPass = check !== null && check.failed === 0 && check.passed > 0;

  const run = () => {
    setBusy("run");
    setError(null);
    api
      .runChecks(attempt.id)
      .then((r) => (setCheck(r), onAttempt({ ...attempt, checkRuns: attempt.checkRuns + 1, lastCheck: r })))
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(null));
  };

  const submit = () => {
    setBusy("submit");
    setError(null);
    api
      .submitStep(attempt.id, { explanation, usedOutsideHelp: outsideHelp })
      .then((r) => {
        setCheck(r.results);
        if (r.allPassed) onPassed();
        else onAttempt(r.attempt);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(null));
  };

  return (
    <>
      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Label>Your project</Label>
          <span className="text-xs text-faint">· {attempt.checkRuns} {attempt.checkRuns === 1 ? "check run" : "check runs"}</span>
        </div>
        <code className="block break-all rounded-lg bg-raised px-3 py-2 text-xs">{s.folder}</code>
        <ErrorNote error={error} />
        <Button variant="primary" onClick={run} disabled={busy !== null}>
          {busy === "run" ? "Starting your app and checking…" : "Run checks"}
        </Button>
      </Card>

      {check && <CheckResults r={check} />}

      <Hints attempt={attempt} onAttempt={onAttempt} />

      <Card className="space-y-3 p-5">
        <Label>Submit</Label>
        <p className="text-sm text-muted">{s.explanationCheckpoint}</p>
        <textarea
          className="min-h-28 w-full rounded-lg border border-line bg-surface p-3 text-sm leading-relaxed outline-none focus:border-faint"
          placeholder="In your own words…"
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
        />
        <label className="flex items-start gap-2 text-sm text-muted">
          <input type="checkbox" className="mt-1" checked={outsideHelp} onChange={(e) => setOutsideHelp(e.target.checked)} />
          I had help from outside 1% Engineer (a person, an AI, a tutorial that solved it). Honest answers keep your record true.
        </label>
        <Button onClick={submit} variant={allPass ? "primary" : "default"} disabled={busy !== null || explanation.trim().length < 40}>
          {busy === "submit" ? "Checking and submitting…" : "Submit step"}
        </Button>
        {explanation.trim().length < 40 && <p className="text-xs text-faint">A few sentences, at least 40 characters.</p>}
      </Card>

      <Reference attempt={attempt} onAttempt={onAttempt} />
    </>
  );
}

const STARTUP_TEXT: Record<string, string> = {
  no_start_script: "Your app has no start script yet.",
  exited: "Your app stopped before it answered. Its own output below usually says why.",
  timeout: "Your app didn't answer in time.",
};

function CheckResults({ r }: { r: ProjectCheckResult }) {
  return (
    <div className="space-y-3">
      {STARTUP_TEXT[r.startup] && (
        <div className="rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">{STARTUP_TEXT[r.startup]}</div>
      )}
      <Results run={r} />
      {r.appOutput && (
        <details className="rounded-xl border border-line bg-surface" open={r.startup === "exited"}>
          <summary className="cursor-pointer px-5 py-3 text-sm">What your app printed</summary>
          <pre className="overflow-x-auto whitespace-pre-wrap border-t border-line p-4 text-xs text-muted">{r.appOutput}</pre>
        </details>
      )}
    </div>
  );
}

function Hints({ attempt, onAttempt }: { attempt: StepAttemptView; onAttempt: (a: StepAttemptView) => void }) {
  const [error, setError] = useState<string | null>(null);
  const left = attempt.hintCount - attempt.hints.length;
  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-center gap-2">
        <Label>Hints</Label>
        <span className="text-xs text-faint">
          {attempt.hints.length} of {attempt.hintCount} used · they start gentle and get more specific
        </span>
      </div>
      {attempt.hints.length > 0 && (
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed">
          {attempt.hints.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ol>
      )}
      <ErrorNote error={error} />
      {left > 0 && (
        <Button onClick={() => api.stepHint(attempt.id).then(onAttempt).catch((e: Error) => setError(e.message))}>
          {attempt.hints.length ? "Next hint" : "Show a hint"}
        </Button>
      )}
    </Card>
  );
}

function Reference({ attempt, onAttempt }: { attempt: StepAttemptView; onAttempt: (a: StepAttemptView) => void }) {
  const [confirming, setConfirming] = useState(false);
  if (attempt.reference) {
    return (
      <Card className="space-y-3 p-5">
        <div className="flex items-center gap-2">
          <Label>Reference solution</Label>
          <Pill tone="bad">viewed</Pill>
        </div>
        {attempt.reference.map((f) => (
          <div key={f.path}>
            <div className="mb-1 font-mono text-xs text-faint">{f.path}</div>
            <pre className="overflow-x-auto rounded-lg border border-line bg-raised/50 p-3 text-xs leading-relaxed">{f.content.trim()}</pre>
          </div>
        ))}
      </Card>
    );
  }
  return (
    <div className="text-sm">
      {!confirming ? (
        <button className="text-faint underline-offset-4 hover:text-muted hover:underline" onClick={() => setConfirming(true)}>
          Stuck after every hint? See the reference solution
        </button>
      ) : (
        <Card className="space-y-3 p-5">
          <p className="text-muted">
            Seeing it is recorded: this step will count as <span className="text-ink">solution viewed</span>, which is exposure,
            not ability. You can still finish it.
          </p>
          <div className="flex gap-2">
            <Button variant="danger" onClick={() => api.stepReference(attempt.id).then(onAttempt)}>
              Show it
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Keep trying
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

const INDEPENDENCE_TEXT: Record<string, string> = {
  independent: "Built without hints. Strong evidence you can do this on your own.",
  hinted: "Built with gentle hints. Good evidence of applying it with a little help.",
  assisted: "Built with specific help. It counts as 'applies with help'.",
  solution_viewed: "Passed after seeing the reference. That's exposure, not ability yet. The next step will give you another go.",
};

function Finished({ s, attempt }: { s: StepView; attempt: StepAttemptView }) {
  return (
    <>
      <Card className="space-y-3 p-6">
        <div className="flex items-center gap-2">
          <Pill tone="ok">passed</Pill>
          {attempt.independence && <Pill>{attempt.independence.replace("_", " ")}</Pill>}
        </div>
        <h2 className="text-lg font-semibold">{s.title}</h2>
        <p className="text-sm text-muted">{attempt.independence && INDEPENDENCE_TEXT[attempt.independence]}</p>
        <div className="flex flex-wrap gap-2 pt-2">
          <NextFromRoadmap projectId={s.projectId} />
          <Button onClick={() => go(`/build/${s.projectId}`)}>Back to the roadmap</Button>
        </div>
      </Card>
      {attempt.lastSubmission && (
        <>
          <CheckResults r={attempt.lastSubmission.results} />
          <Card className="p-5">
            <Label>Your explanation</Label>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">{attempt.lastSubmission.explanation}</p>
          </Card>
        </>
      )}
    </>
  );
}
