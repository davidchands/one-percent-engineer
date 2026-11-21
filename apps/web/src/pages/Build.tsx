import { useState } from "react";
import type { ProjectView, RoadmapItem, StepStatus } from "@1pe/contracts";
import { api } from "../api.ts";
import { Button, Card, ErrorNote, Label, Pill, cx, useLoad } from "../components/ui.tsx";
import { go } from "../App.tsx";
import { ServerDown } from "./Today.tsx";
import { ProblemText } from "./Challenge.tsx";

/** Build by Learning: every project you can build, and how far you are. */
export function BuildPage() {
  const { data, error } = useLoad(api.projects, []);
  if (error) return <ServerDown error={error} />;
  if (!data) return <div className="text-muted">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Build by Learning</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Build a real app, one step at a time, learning each idea when you need it. When the project needs a technology
          choice, you're shown the options and their trade-offs, and <span className="text-ink">you decide</span>. Your
          reasons are saved in your project, the way professional teams record theirs.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {data.map((p) => {
          const total = p.progress.steps + p.progress.decisions;
          const done = p.progress.stepsPassed + p.progress.decisionsMade;
          return (
            <a key={p.id} href={`#/build/${p.id}`} className="block">
              <Card className="h-full space-y-3 p-5 transition hover:border-faint">
                <div className="flex items-center gap-2">
                  <h2 className="flex-1 text-lg font-semibold">{p.title}</h2>
                  {p.started ? <Pill tone="accent">in progress</Pill> : <Pill>not started</Pill>}
                </div>
                <p className="line-clamp-3 text-sm leading-relaxed text-muted">{p.brief}</p>
                <div className="flex items-center gap-3 pt-1 text-xs text-faint">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
                  </div>
                  <span>
                    {p.progress.decisionsMade}/{p.progress.decisions} decisions · {p.progress.stepsPassed}/{p.progress.steps} steps
                  </span>
                </div>
              </Card>
            </a>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const STATUS: Record<StepStatus, { label: string; tone: "muted" | "ok" | "bad" | "accent" | "info" }> = {
  blocked: { label: "decide first", tone: "muted" },
  ready: { label: "ready", tone: "info" },
  in_progress: { label: "in progress", tone: "accent" },
  passed: { label: "passed", tone: "ok" },
  redo: { label: "redo: you changed a decision", tone: "bad" },
};

const itemHref = (projectId: string, item: RoadmapItem) =>
  item.kind === "checkpoint" ? null : `#/build/${projectId}/${item.kind}/${item.id}`;

/** The roadmap: milestones, each a list of decisions, steps and checkpoints. */
export function ProjectPage({ id }: { id: string }) {
  const { data: p, error, setData } = useLoad(() => api.project(id), [id]);
  if (error) return <ServerDown error={error} />;
  if (!p) return <div className="text-muted">Loading…</div>;

  const nextTitle = p.next
    ? p.milestones.flatMap((m) => m.items).find((i) => i.kind === p.next!.kind && "id" in i && i.id === p.next!.id)
    : null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        <div>
          <a href="#/build" className="text-sm text-muted hover:text-ink">
            ← Build
          </a>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{p.title}</h1>
          <div className="mt-3 max-w-2xl text-muted">
            <ProblemText text={p.brief} />
          </div>
        </div>

        <ol className="space-y-5">
          {p.milestones.map((m, mi) => (
            <li key={m.id}>
              <Card className="p-5 sm:p-6">
                <Label>Milestone {mi + 1}</Label>
                <h2 className="mt-1 text-lg font-semibold">{m.title}</h2>
                <p className="mt-1 text-sm text-muted">{m.goal}</p>
                <ul className="mt-4 space-y-2">
                  {m.items.map((item, i) => (
                    <RoadmapRow key={i} projectId={p.id} item={item} started={p.started} isNext={item.kind !== "checkpoint" && p.next?.id === item.id} />
                  ))}
                </ul>
              </Card>
            </li>
          ))}
        </ol>
      </div>

      <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        {p.started ? (
          <Card className="space-y-4 p-5">
            <div>
              <Label>Your project folder</Label>
              <code className="mt-2 block break-all rounded-lg bg-raised px-3 py-2 text-xs">{p.folder}</code>
              <p className="mt-2 text-xs leading-relaxed text-faint">
                Open this folder in VS Code and write your code there. The checks run against it exactly as it is.
              </p>
            </div>
            {p.next && nextTitle && "title" in nextTitle ? (
              <Button variant="primary" className="w-full" onClick={() => go(`/build/${p.id}/${p.next!.kind}/${p.next!.id}`)}>
                {p.next.kind === "decision" ? "Decide: " : "Next: "}
                {nextTitle.title} →
              </Button>
            ) : (
              <p className="text-sm text-ok">Everything here is done. More milestones are on the way.</p>
            )}
          </Card>
        ) : (
          <StartCard project={p} onStarted={setData} />
        )}
        <Card className="p-5">
          <Label>What you'll build</Label>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
            {p.whatYouBuild.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function RoadmapRow({ projectId, item, started, isNext }: { projectId: string; item: RoadmapItem; started: boolean; isNext: boolean }) {
  if (item.kind === "checkpoint") {
    return (
      <li className="rounded-lg border border-dashed border-line px-4 py-3 text-sm">
        <span className="mr-2 text-xs font-semibold uppercase tracking-wider text-faint">Checkpoint</span>
        <span className="text-muted">{item.prompt}</span>
      </li>
    );
  }
  const href = started ? itemHref(projectId, item) : null;
  const body = (
    <span
      className={cx(
        "flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 text-sm transition",
        isNext ? "border-accent/50 bg-accent/[0.04]" : "border-line",
        href && "hover:border-faint",
      )}
    >
      <span className="w-16 shrink-0 text-xs font-semibold uppercase tracking-wider text-faint">{item.kind === "decision" ? "Decide" : "Build"}</span>
      <span className="min-w-0 flex-1 font-medium">{item.title}</span>
      {item.kind === "decision" ? (
        item.chosen ? <Pill tone="ok">{item.chosen.name}</Pill> : <Pill tone={isNext ? "accent" : "muted"}>to decide</Pill>
      ) : (
        <Pill tone={STATUS[item.status].tone}>{STATUS[item.status].label}</Pill>
      )}
    </span>
  );
  return <li>{href ? <a href={href}>{body}</a> : body}</li>;
}

function StartCard({ project, onStarted }: { project: ProjectView; onStarted: (p: ProjectView) => void }) {
  const [folder, setFolder] = useState(project.suggestedFolder);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const notYet = project.prerequisites.filter((p) => !p.practised);

  const start = () => {
    setBusy(true);
    api
      .startProject(project.id, folder.trim() === project.suggestedFolder ? undefined : folder.trim())
      .then(onStarted)
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  };

  return (
    <Card className="space-y-4 p-5">
      <Label>Start this project</Label>
      {notYet.length > 0 && (
        <div className="rounded-lg border border-accent/30 bg-accent/[0.05] p-3 text-sm leading-relaxed">
          <span className="font-medium text-accent">Heads-up.</span>{" "}
          <span className="text-muted">
            This project uses ideas you haven't practised in a challenge yet: {notYet.map((n) => n.name).join(", ")}. You can
            start anyway, but expect to lean on the lessons and hints.
          </span>
        </div>
      )}
      <label className="block space-y-1.5">
        <span className="text-sm">Where should your project live?</span>
        <input
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-xs outline-none focus:border-faint"
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
        />
      </label>
      <p className="text-xs leading-relaxed text-faint">
        This creates the folder with a README describing the project. All the code in it is yours to write.
      </p>
      <ErrorNote error={error} />
      <Button variant="primary" className="w-full" onClick={start} disabled={busy || !folder.trim()}>
        {busy ? "Starting…" : "Start project"}
      </Button>
    </Card>
  );
}
