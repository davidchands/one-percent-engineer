import { useState } from "react";
import type { DecisionOption, DecisionView } from "@1pe/contracts";
import { api } from "../api.ts";
import { Button, Card, ErrorNote, Label, Pill, cx, useLoad } from "../components/ui.tsx";
import { go } from "../App.tsx";
import { ServerDown } from "./Today.tsx";
import { ProblemText } from "./Challenge.tsx";

const WEIGHTS = ["Doesn't matter", "A little", "Matters", "A lot"];

/**
 * A decision card. It teaches the options; it never picks one. Nothing is pre-selected, there is
 * no "recommended" badge, and you have to say why you chose what you chose.
 */
export function DecisionPage({ projectId, id }: { projectId: string; id: string }) {
  const { data: v, error, setData } = useLoad(() => api.decision(projectId, id), [projectId, id]);
  const [changing, setChanging] = useState(false);
  if (error) return <ServerDown error={error} />;
  if (!v) return <div className="text-muted">Loading…</div>;

  const d = v.decision;
  const chosen = v.chosen ? d.options.find((o) => o.id === v.chosen!.optionId) : null;
  const deciding = !v.chosen || changing;

  return (
    <div className="space-y-6">
      <div className="max-w-3xl">
        <a href={`#/build/${projectId}`} className="text-sm text-muted hover:text-ink">
          ← Roadmap
        </a>
        <div className="mt-3">
          <Label>Decision {v.number}</Label>
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{d.title}</h1>
        <div className="mt-3 text-muted">
          <ProblemText text={d.problem} />
        </div>
      </div>

      {chosen && v.chosen && !changing && (
        <Card className="space-y-3 border-ok/40 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="ok">your decision</Pill>
            <span className="text-lg font-semibold">{chosen.name}</span>
            <span className="text-xs text-faint">{v.chosen.decidedAt.slice(0, 10)}</span>
          </div>
          <p className="text-sm leading-relaxed text-muted">"{v.chosen.reason}"</p>
          {v.recordPath && (
            <p className="text-xs text-faint">
              Saved in your project as <code className="text-muted">{v.recordPath}</code>
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <NextFromRoadmap projectId={projectId} />
            <Button onClick={() => setChanging(true)}>Change my mind</Button>
          </div>
        </Card>
      )}

      {deciding ? (
        <DecideForm view={v} changing={changing} onDecided={(nv) => (setData(nv), setChanging(false))} onCancel={() => setChanging(false)} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {d.options.map((o) => (
            <OptionCard key={o.id} option={o} view={v} selected={o.id === v.chosen?.optionId} />
          ))}
        </div>
      )}

      {v.history.length > 1 && (
        <Card className="p-5">
          <Label>History</Label>
          <ul className="mt-2 space-y-1.5 text-sm text-muted">
            {v.history.map((h, i) => (
              <li key={i}>
                <span className="text-faint">{h.decidedAt.slice(0, 10)}</span> ·{" "}
                <span className="text-ink">{d.options.find((o) => o.id === h.optionId)?.name}</span>: {h.reason}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function DecideForm({
  view: v,
  changing,
  onDecided,
  onCancel,
}: {
  view: DecisionView;
  changing: boolean;
  onDecided: (v: DecisionView) => void;
  onCancel: () => void;
}) {
  const d = v.decision;
  const [weights, setWeights] = useState<Record<string, number>>(v.chosen?.weights ?? {});
  const [picked, setPicked] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const anyWeight = Object.values(weights).some((w) => w > 0);
  const passedAffected = v.affectedSteps.filter((s) => s.passed);

  const submit = () => {
    if (!picked) return;
    setBusy(true);
    setError(null);
    api
      .decide(v.projectId, d.id, { optionId: picked, reason, weights })
      .then(onDecided)
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  };

  return (
    <div className="space-y-6">
      <Card className="p-5 sm:p-6">
        <Label>1 · What matters to you?</Label>
        <p className="mt-1 text-sm text-muted">There's no right answer. Set these honestly and each option shows how well it fits you.</p>
        <ul className="mt-4 space-y-3">
          {d.criteria.map((c) => (
            <li key={c.id} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div>
                <div className="text-sm font-medium">{c.label}</div>
                <div className="text-xs text-faint">{c.description}</div>
              </div>
              <div className="flex overflow-hidden rounded-lg border border-line text-xs">
                {WEIGHTS.map((label, w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setWeights({ ...weights, [c.id]: w })}
                    className={cx(
                      "flex-1 px-2.5 py-1.5 transition sm:flex-none",
                      w > 0 && "border-l border-line",
                      (weights[c.id] ?? -1) === w ? "bg-raised text-ink" : "text-muted hover:text-ink",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <div>
        <Label>2 · Compare the options</Label>
        <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {d.options.map((o) => (
            <OptionCard
              key={o.id}
              option={o}
              view={v}
              weights={anyWeight ? weights : undefined}
              selected={picked === o.id}
              onPick={() => setPicked(o.id)}
            />
          ))}
        </div>
      </div>

      <Card className="space-y-4 p-5 sm:p-6">
        <Label>3 · Decide, and say why</Label>
        {changing && (
          <div className="rounded-lg border border-bad/40 bg-bad/[0.06] p-3 text-sm leading-relaxed">
            <span className="font-medium text-bad">Cost of changing: </span>
            <span className="text-muted">{d.costOfChangingLater}</span>
            {passedAffected.length > 0 && (
              <span className="text-muted"> You'd redo: {passedAffected.map((s) => s.title).join(", ")}.</span>
            )}
          </div>
        )}
        <p className="text-sm text-muted">
          {picked ? (
            <>
              You picked <span className="font-medium text-ink">{d.options.find((o) => o.id === picked)?.name}</span>. In a
              sentence or two: why this one, for you, now?
            </>
          ) : (
            "Pick an option above first."
          )}
        </p>
        <textarea
          className="min-h-24 w-full rounded-lg border border-line bg-surface p-3 text-sm leading-relaxed outline-none focus:border-faint"
          placeholder="I chose it because…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={!picked}
        />
        <ErrorNote error={error} />
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={submit} disabled={!picked || reason.trim().length < 30 || busy}>
            {busy ? "Saving…" : "Make this decision"}
          </Button>
          {changing && <Button onClick={onCancel}>Keep my current choice</Button>}
          {picked && reason.trim().length < 30 && <span className="self-center text-xs text-faint">A little more: at least a sentence.</span>}
        </div>
        <p className="text-xs leading-relaxed text-faint">
          Your decision and reason are saved in your project as a decision record (<code>docs/decisions/</code>). You can
          change your mind later; the history is kept.
        </p>
      </Card>
    </div>
  );
}

function OptionCard({
  option: o,
  view,
  weights,
  selected,
  onPick,
}: {
  option: DecisionOption;
  view: DecisionView;
  weights?: Record<string, number>;
  selected: boolean;
  onPick?: () => void;
}) {
  const ready = view.readiness[o.id];
  let fit: number | null = null;
  if (weights) {
    const max = view.decision.criteria.reduce((n, c) => n + (weights[c.id] ?? 0) * 5, 0);
    const got = view.decision.criteria.reduce((n, c) => n + (weights[c.id] ?? 0) * (o.fit[c.id] ?? 0), 0);
    fit = max ? Math.round((got / max) * 100) : null;
  }

  return (
    <Card className={cx("flex flex-col gap-4 p-5 transition", selected && "border-accent/60 bg-accent/[0.03]")}>
      <div>
        <h3 className="text-base font-semibold">{o.name}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted">{o.summary}</p>
      </div>

      {fit !== null && (
        <div title="How well this option fits what you said matters. A guide, not a verdict.">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-faint">Fit with what matters to you</span>
            <span className="font-mono tabular-nums">{fit}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-info" style={{ width: `${fit}%` }} />
          </div>
        </div>
      )}

      <div className="space-y-1.5 text-sm">
        {o.strengths.map((s) => (
          <div key={s} className="flex gap-2">
            <span className="text-ok">+</span>
            <span>{s}</span>
          </div>
        ))}
        {o.costs.map((s) => (
          <div key={s} className="flex gap-2">
            <span className="text-bad">−</span>
            <span className="text-muted">{s}</span>
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        <Label>New ideas you'd learn ({o.newIdeas.length})</Label>
        <div className="flex flex-wrap gap-1.5">
          {o.newIdeas.map((i) => (
            <span key={i} className="rounded-full bg-raised px-2 py-0.5 text-xs text-muted">
              {i}
            </span>
          ))}
        </div>
        {ready && (ready.practised.length > 0 || ready.notYet.length > 0) && (
          <p className="text-xs leading-relaxed text-faint">
            {ready.practised.length > 0 && <>You've practised {ready.practised.join(", ")}. </>}
            {ready.notYet.length > 0 && <>Not yet: {ready.notYet.join(", ")}.</>}
          </p>
        )}
      </div>

      <div className="text-sm">
        <Label>When professionals choose it</Label>
        <p className="mt-1 leading-relaxed text-muted">{o.whenProsChooseIt}</p>
      </div>

      {onPick && (
        <Button className="mt-auto" variant={selected ? "primary" : "default"} onClick={onPick}>
          {selected ? "Picked" : "Pick this one"}
        </Button>
      )}
    </Card>
  );
}

/** Goes to whatever comes next on the roadmap. */
export function NextFromRoadmap({ projectId }: { projectId: string }) {
  const { data } = useLoad(() => api.project(projectId), [projectId]);
  const next = data?.next;
  if (!next) return null;
  const item = data.milestones.flatMap((m) => m.items).find((i) => i.kind === next.kind && "id" in i && i.id === next.id);
  return (
    <Button variant="primary" onClick={() => go(`/build/${projectId}/${next.kind}/${next.id}`)}>
      Next: {item && "title" in item ? item.title : next.id} →
    </Button>
  );
}
