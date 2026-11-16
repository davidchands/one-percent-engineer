/**
 * Path safety. The extension only ever creates or observes files inside the challenges folder.
 */
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

export function expandHome(p: string): string {
  if (p === "~") return homedir();
  if (p.startsWith("~/")) return join(homedir(), p.slice(2));
  return p;
}

/** True only if `file` is strictly inside `dir` (no `..` escapes, no sibling-prefix tricks). */
export function isInside(dir: string, file: string): boolean {
  const rel = relative(resolve(dir), resolve(file));
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

/** Challenge ids become folder names, so they must be plain slugs. */
export function challengeDir(root: string, challengeId: string): string {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(challengeId)) throw new Error(`Unsafe challenge id: ${challengeId}`);
  return join(expandHome(root), challengeId);
}

/** Which challenge a file belongs to, if it's directly inside <root>/<id>/. */
export function challengeIdForFile(root: string, file: string): string | null {
  const base = resolve(expandHome(root));
  if (!isInside(base, file)) return null;
  const [id, ...rest] = relative(base, resolve(file)).split(sep);
  return id && rest.length > 0 ? id : null;
}
