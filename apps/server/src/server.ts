/**
 * HTTP layer. Deliberately thin: parse input with Zod → call a service → return JSON.
 * Binds to 127.0.0.1 only: this is a personal, local system.
 */
import Fastify, { type FastifyReply } from "fastify";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { z, ZodError } from "zod";
import { NewEvent, NewJournalEntry, RunRequest, SubmitRequest } from "@1pe/contracts";
import { openDb } from "./db.ts";
import { loadContent } from "./content.ts";
import * as svc from "./services.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const PORT = Number(process.env.PORT ?? 4100);
const DB_PATH = process.env.DB_PATH ?? resolve(ROOT, "data/1pe.sqlite");

export function buildApp(ctx: svc.Ctx) {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "warn" } });

  app.setErrorHandler((err, _req, reply: FastifyReply) => {
    if (err instanceof svc.ServiceError) return reply.status(err.status).send({ error: err.message });
    if (err instanceof ZodError) {
      return reply.status(400).send({ error: err.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ") });
    }
    app.log.error(err);
    return reply.status(500).send({ error: "Internal error. Check the server log." });
  });

  const idParam = z.object({ id: z.coerce.number().int().positive() });

  app.get("/api/health", async () => ({ ok: true }));
  app.get("/api/today", async () => svc.today(ctx));
  app.get("/api/skills", async () => svc.listSkills(ctx));
  app.get("/api/challenges", async () => svc.listChallenges(ctx));
  app.get("/api/challenges/:id", async (req) => svc.getChallengePublic(ctx, (req.params as { id: string }).id));
  app.get("/api/challenges/:id/attempts", async (req) => svc.listAttempts(ctx, (req.params as { id: string }).id));
  app.post("/api/challenges/:id/attempts",async (req) => svc.startAttempt(ctx, (req.params as { id: string }).id));

  app.get("/api/attempts/:id", async (req) => svc.getAttempt(ctx, idParam.parse(req.params).id));
  app.post("/api/attempts/:id/events", async (req) =>
    svc.recordEvent(ctx, idParam.parse(req.params).id, NewEvent.parse(req.body)),
  );
  app.post("/api/attempts/:id/hints", async (req) => svc.requestHint(ctx, idParam.parse(req.params).id));
  app.post("/api/attempts/:id/run", async (req) =>
    svc.runPublicTests(ctx, idParam.parse(req.params).id, RunRequest.parse(req.body).code),
  );
  app.post("/api/attempts/:id/submit", async (req) =>
    svc.submit(ctx, idParam.parse(req.params).id, SubmitRequest.parse(req.body)),
  );
  app.post("/api/attempts/:id/solution", async (req) =>
    svc.revealSolution(ctx, idParam.parse(req.params).id, z.object({ confirm: z.boolean() }).parse(req.body).confirm),
  );

  app.get("/api/journal", async (req) => svc.listJournal(ctx, String((req.query as { q?: string }).q ?? "")));
  app.get("/api/journal/:id", async (req) => svc.getJournal(ctx, idParam.parse(req.params).id));
  app.post("/api/journal", async (req) => svc.createJournal(ctx, NewJournalEntry.parse(req.body)));
  app.put("/api/journal/:id", async (req) =>
    svc.updateJournal(ctx, idParam.parse(req.params).id, NewJournalEntry.parse(req.body)),
  );

  return app;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const content = loadContent();
  const db = openDb(DB_PATH);
  const app = buildApp({ db, content });
  await app.listen({ host: "127.0.0.1", port: PORT });
  console.log(
    `1% Engineer server on http://127.0.0.1:${PORT}  ·  ${content.skills.size} skills, ${content.challenges.size} challenges  ·  db ${DB_PATH}`,
  );
}
