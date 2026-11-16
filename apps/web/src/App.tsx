import { useEffect, useState } from "react";
import { cx } from "./components/ui.tsx";
import { TodayPage } from "./pages/Today.tsx";
import { ChallengePage } from "./pages/Challenge.tsx";
import { ChallengesPage } from "./pages/Challenges.tsx";
import { SkillsPage } from "./pages/Skills.tsx";
import { JournalPage } from "./pages/Journal.tsx";

/** Tiny hash router: #/path?query. Enough for a local tool; no dependency to learn yet. */
function useHashRoute() {
  const read = () => {
    const raw = window.location.hash.replace(/^#/, "") || "/";
    const [path, query = ""] = raw.split("?");
    return { path: path || "/", query: new URLSearchParams(query) };
  };
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => {
      setRoute(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

export const go = (to: string) => {
  window.location.hash = to;
};

const NAV = [
  { to: "/", label: "Today" },
  { to: "/challenges", label: "Challenges" },
  { to: "/skills", label: "Skills" },
  { to: "/journal", label: "Journal" },
];

export function App() {
  const { path, query } = useHashRoute();
  const seg = path.split("/").filter(Boolean);

  let page;
  if (seg[0] === "challenge" && seg[1]) page = <ChallengePage id={seg[1]} />;
  else if (seg[0] === "challenges") page = <ChallengesPage />;
  else if (seg[0] === "skills") page = <SkillsPage />;
  else if (seg[0] === "journal") page = <JournalPage entryId={seg[1]} attemptId={query.get("attempt")} title={query.get("title")} />;
  else page = <TodayPage />;

  const active = (to: string) => (to === "/" ? seg.length === 0 : path.startsWith(to) || (to === "/challenges" && seg[0] === "challenge"));

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-10 border-b border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
          <a href="#/" className="flex items-baseline gap-1.5 font-semibold tracking-tight">
            <span className="text-accent">1%</span>
            <span>Engineer</span>
          </a>
          <nav className="flex gap-0.5 overflow-x-auto text-sm sm:gap-1">
            {NAV.map((n) => (
              <a
                key={n.to}
                href={`#${n.to}`}
                className={cx(
                  "rounded-md px-2.5 py-1.5 transition",
                  active(n.to) ? "bg-raised text-ink" : "text-muted hover:text-ink",
                )}
              >
                {n.label}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{page}</main>
    </div>
  );
}
