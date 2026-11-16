import { LEVEL_NAMES } from "@1pe/contracts";
import { api, type SkillRow } from "../api.ts";
import { Card, Label, Pill, cx, useLoad } from "../components/ui.tsx";
import { ServerDown } from "./Today.tsx";

export function SkillsPage() {
  const { data, error } = useLoad(api.skills, []);
  if (error) return <ServerDown error={error} />;
  if (!data) return <div className="text-muted">Loading…</div>;

  const implemented = data.every((s) => s.state.implemented);
  const phases = [...new Set(data.map((s) => s.phase))].sort();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Skills</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          The knowledge map from <code>content/skills/</code>. Levels are computed from evidence every time you load this
          page. Nothing here is a stored score.
        </p>
      </div>
      {!implemented && (
        <div className="rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 text-sm text-accent">
          Every level shows 0 because <code>projectSkillState</code> is still the placeholder (task M1-a). The evidence
          counts on the right are already real.
        </div>
      )}
      {phases.map((phase) => (
        <Card key={phase}>
          <div className="border-b border-line px-5 py-3">
            <Label>Phase {phase}</Label>
          </div>
          <ul className="divide-y divide-line">
            {data
              .filter((s) => s.phase === phase)
              .map((s) => (
                <SkillItem key={s.id} s={s} />
              ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}

function SkillItem({ s }: { s: SkillRow }) {
  return (
    <li>
      <details className="group">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 hover:bg-raised/40">
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{s.name}</span>
            <code className="text-xs text-faint">{s.id}</code>
          </span>
          <LevelBar level={s.state.level} />
          <span className="w-28 text-right text-xs text-muted">
            {s.evidenceCount} evidence
            {s.failures > 0 && <span className="text-bad"> · {s.failures} ✗</span>}
          </span>
        </summary>
        <div className="space-y-4 px-5 pb-5 text-sm">
          <p className="text-muted">
            <span className="text-faint">Why it exists: </span>
            {s.why}
          </p>
          {s.prerequisites.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-faint">Requires</span>
              {s.prerequisites.map((p) => (
                <Pill key={p}>{p}</Pill>
              ))}
            </div>
          )}
          <ol className="space-y-1.5">
            {Object.entries(s.objectives)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([lvl, text]) => (
                <li key={lvl} className={cx("flex gap-3", Number(lvl) <= s.state.level ? "text-ink" : "text-muted")}>
                  <span className="w-36 shrink-0 text-xs text-faint">
                    L{lvl} {LEVEL_NAMES[Number(lvl)]}
                  </span>
                  <span>{text}</span>
                </li>
              ))}
          </ol>
          <div className="text-xs text-faint">
            Confidence {Math.round(s.state.confidence * 100)}% · career relevance {Math.round(s.careerRelevance * 100)}%
            {s.state.justifiedBy.length > 0 && ` · justified by evidence #${s.state.justifiedBy.join(", #")}`}
          </div>
        </div>
      </details>
    </li>
  );
}

function LevelBar({ level }: { level: number }) {
  return (
    <span className="flex items-center gap-2" title={LEVEL_NAMES[level]}>
      <span className="flex gap-0.5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <span key={i} className={cx("h-2 w-4 rounded-sm", i <= level ? "bg-accent" : "bg-line")} />
        ))}
      </span>
      <span className="w-32 text-xs text-muted">{LEVEL_NAMES[level]}</span>
    </span>
  );
}
