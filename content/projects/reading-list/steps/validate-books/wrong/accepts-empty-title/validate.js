export const STATUSES = ["want", "reading", "read"];

/** Returns a sentence describing what's wrong with a new book, or null if it's fine. */
export function checkNewBook(body) {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return 'Send a JSON object like {"title": "...", "author": "..."}';
  }
  if (typeof body.title !== "string") return "title must be a string";
  if (typeof body.author !== "string" || body.author.trim() === "") return "author must be a non-empty string";
  if (body.status !== undefined && !STATUSES.includes(body.status)) return "status must be one of: want, reading, read";
  return null;
}

/** Returns a sentence describing what's wrong with a status change, or null if it's fine. */
export function checkStatusChange(body) {
  if (typeof body !== "object" || body === null || !STATUSES.includes(body.status)) {
    return "status must be one of: want, reading, read";
  }
  return null;
}
