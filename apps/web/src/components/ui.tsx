import { useEffect, useState, type ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx("rounded-xl border border-line bg-surface", className)}>{children}</section>;
}

export function Label({ children }: { children: ReactNode }) {
  return <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{children}</div>;
}

export function Button({
  children,
  onClick,
  variant = "default",
  disabled,
  type = "button",
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "default" | "ghost" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const styles = {
    primary: "bg-accent text-black hover:brightness-110 font-semibold",
    default: "border border-line bg-raised text-ink hover:border-faint",
    ghost: "text-muted hover:text-ink",
    danger: "border border-bad/40 text-bad hover:bg-bad/10",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-40",
        styles,
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Pill({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "ok" | "bad" | "accent" | "info" }) {
  const t = {
    muted: "border-line text-muted",
    ok: "border-ok/40 text-ok",
    bad: "border-bad/40 text-bad",
    accent: "border-accent/40 text-accent",
    info: "border-info/40 text-info",
  }[tone];
  return <span className={cx("inline-flex items-center rounded-full border px-2 py-0.5 text-xs", t)}>{children}</span>;
}

/** Shows where a number came from. Every metric in 1% Engineer carries one. */
export function Provenance({ p }: { p: "observed" | "manual" | "inferred" }) {
  const tone = p === "observed" ? "info" : p === "manual" ? "accent" : "muted";
  const title = {
    observed: "Directly recorded by the system",
    manual: "Entered or controlled by you",
    inferred: "Estimated from other signals. Treat with caution.",
  }[p];
  return (
    <span title={title}>
      <Pill tone={tone}>{p}</Pill>
    </span>
  );
}

export function Difficulty({ n }: { n: number }) {
  return (
    <span className="inline-flex gap-0.5" title={`Difficulty ${n}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={cx("h-1.5 w-3 rounded-full", i <= n ? "bg-accent" : "bg-line")} />
      ))}
    </span>
  );
}

export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return <div className="rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">{error}</div>;
}

export function formatMs(ms: number | null | undefined) {
  if (ms === null || ms === undefined) return "n/a";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${sec.toString().padStart(2, "0")}s`;
  return `${sec}s`;
}

/** Re-renders every `ms` so running timers tick. */
export function useTick(ms = 1000) {
  const [, set] = useState(0);
  useEffect(() => {
    const t = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}

/** Loads data with loading/error state. `deps` re-trigger the load. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let live = true;
    setError(null);
    fn()
      .then((d) => live && setData(d))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);
  return { data, setData, error, reload: () => setVersion((v) => v + 1) };
}
