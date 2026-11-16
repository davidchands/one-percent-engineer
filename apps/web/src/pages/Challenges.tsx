import { api } from "../api.ts";
import { Card, Difficulty, Pill, useLoad } from "../components/ui.tsx";
import { ServerDown } from "./Today.tsx";

export function ChallengesPage() {
  const { data, error } = useLoad(api.challenges, []);
  if (error) return <ServerDown error={error} />;
  if (!data) return <div className="text-muted">Loading…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Challenges</h1>
        <p className="mt-1 text-sm text-muted">
          Today's page picks one for you. This list is for revisiting past work. Every challenge here passed the content
          quality gate (<code>pnpm validate:content</code>).
        </p>
      </div>
      <Card>
        <ul className="divide-y divide-line">
          {data.map((c) => (
            <li key={c.id}>
              <a href={`#/challenge/${c.id}`} className="flex flex-wrap items-center gap-3 px-5 py-4 hover:bg-raised/50">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{c.title}</span>
                  <span className="mt-1 block text-xs text-faint">{c.skills.join(" · ")}</span>
                </span>
                <Pill tone="accent">{c.type}</Pill>
                <Difficulty n={c.difficulty} />
                {c.passed ? <Pill tone="ok">passed</Pill> : <Pill>open</Pill>}
              </a>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
