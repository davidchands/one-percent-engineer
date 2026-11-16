import { useEffect, useState } from "react";
import type { JournalEntry, JournalFields } from "@1pe/contracts";
import { api } from "../api.ts";
import { Button, Card, ErrorNote, Label, Pill, useLoad } from "../components/ui.tsx";
import { go } from "../App.tsx";
import { ServerDown } from "./Today.tsx";

/** The reflection questions, in the order you'd think through a challenge. */
const FIELDS: { key: keyof JournalFields; q: string; hint?: string }[] = [
  { key: "problem", q: "What problem was I solving?" },
  { key: "interpretation", q: "How did I interpret the requirements?", hint: "What did you assume? What was ambiguous?" },
  { key: "initialIdea", q: "What did I initially think the solution would be?" },
  { key: "alternatives", q: "What alternatives did I consider?" },
  { key: "choiceAndWhy", q: "Why did I choose my approach?" },
  { key: "errors", q: "What errors occurred?" },
  { key: "debugging", q: "How did I debug them?", hint: "How you reproduced, isolated and verified." },
  { key: "learned", q: "What did I learn?" },
  { key: "differently", q: "What would I do differently?" },
  { key: "stillUnclear", q: "What do I still not understand?", hint: "Be honest. This drives what you study next." },
  { key: "beginnerExplanation", q: "How would I explain this to a beginner?" },
];

const emptyFields = (): JournalFields =>
  Object.fromEntries(FIELDS.map((f) => [f.key, ""])) as unknown as JournalFields;

export function JournalPage({ entryId, attemptId, title }: { entryId?: string; attemptId: string | null; title: string | null }) {
  if (entryId === "new") return <Editor attemptId={attemptId ? Number(attemptId) : null} initialTitle={title ?? ""} />;
  if (entryId) return <Editor id={Number(entryId)} />;
  return <JournalList />;
}

function JournalList() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 200);
    return () => clearTimeout(t);
  }, [q]);
  const { data, error } = useLoad(() => api.journal(debounced), [debounced]);
  if (error && !data) return <ServerDown error={error} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Engineering journal</h1>
          <p className="mt-1 text-sm text-muted">A record of how you thought, not just what you built.</p>
        </div>
        <Button variant="primary" onClick={() => go("/journal/new")}>
          New entry
        </Button>
      </div>
      <input
        className="w-full rounded-lg border border-line bg-surface px-4 py-2.5 text-sm outline-none placeholder:text-faint focus:border-faint"
        placeholder="Search everything you've written. Try “rounding” or “invariant”."
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {!data ? (
        <div className="text-muted">Loading…</div>
      ) : data.length === 0 ? (
        <Card className="p-6 text-sm text-muted">{debounced ? "No entries match." : "No entries yet."}</Card>
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {data.map((e) => (
              <li key={e.id}>
                <a href={`#/journal/${e.id}`} className="block px-5 py-4 hover:bg-raised/50">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{e.title}</span>
                    <span className="shrink-0 text-xs text-faint">{new Date(e.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{preview(e)}</p>
                  {e.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {e.tags.map((t) => (
                        <Pill key={t}>{t}</Pill>
                      ))}
                    </div>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

const preview = (e: JournalEntry) => e.fields.learned || e.fields.problem || e.fields.choiceAndWhy || "No summary yet.";

function Editor({ id, attemptId = null, initialTitle = "" }: { id?: number; attemptId?: number | null; initialTitle?: string }) {
  const [title, setTitle] = useState(initialTitle);
  const [fields, setFields] = useState<JournalFields>(emptyFields);
  const [tags, setTags] = useState("");
  const [linkedAttempt, setLinkedAttempt] = useState<number | null>(attemptId);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api
      .journalEntry(id)
      .then((e) => {
        setTitle(e.title);
        setFields({ ...emptyFields(), ...e.fields });
        setTags(e.tags.join(", "));
        setLinkedAttempt(e.attemptId);
      })
      .catch((e: Error) => setError(e.message));
  }, [id]);

  const save = async () => {
    setError(null);
    const body = {
      title: title.trim(),
      attemptId: linkedAttempt,
      fields,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    };
    try {
      const entry = id ? await api.updateJournal(id, body) : await api.createJournal(body);
      setSaved(new Date().toLocaleTimeString());
      if (!id) go(`/journal/${entry.id}`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <a href="#/journal" className="text-sm text-muted hover:text-ink">
        ← Journal
      </a>
      <input
        className="w-full bg-transparent text-2xl font-semibold tracking-tight outline-none placeholder:text-faint"
        placeholder="Title: what was this about?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      {linkedAttempt && (
        <div className="text-sm text-muted">
          Linked to attempt #{linkedAttempt}. Its time and hint metrics belong with this reflection.
        </div>
      )}
      <Card className="divide-y divide-line">
        {FIELDS.map((f) => (
          <label key={f.key} className="block space-y-2 p-5">
            <span className="block text-sm font-medium">{f.q}</span>
            {f.hint && <span className="block text-xs text-faint">{f.hint}</span>}
            <textarea
              className="min-h-20 w-full resize-y rounded-lg border border-line bg-raised/40 p-3 text-sm leading-relaxed outline-none focus:border-faint"
              value={fields[f.key]}
              onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })}
            />
          </label>
        ))}
        <label className="block space-y-2 p-5">
          <Label>Tags (comma separated)</Label>
          <input
            className="w-full rounded-lg border border-line bg-raised/40 px-3 py-2 text-sm outline-none focus:border-faint"
            placeholder="floating-point, invariants, debugging"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
        </label>
      </Card>
      <ErrorNote error={error} />
      <div className="flex items-center gap-3">
        <Button variant="primary" onClick={save} disabled={!title.trim()}>
          Save entry
        </Button>
        {saved && <span className="text-sm text-muted">Saved at {saved}</span>}
      </div>
    </div>
  );
}
