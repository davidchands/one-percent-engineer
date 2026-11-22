import Fastify from "fastify";
import { readFileSync } from "node:fs";
import * as books from "./books.js";
import { checkNewBook, checkStatusChange } from "./validate.js";

const indexHtml = readFileSync(new URL("./public/index.html", import.meta.url), "utf8");

const app = Fastify();

app.get("/api/health", async () => {
  return { ok: true };
});

app.get("/api/books", async () => {
  return books.list();
});

app.post("/api/books", async (request, reply) => {
  const problem = checkNewBook(request.body);
  if (problem) {
    return reply.code(400).send({ error: problem });
  }
  return reply.code(201).send(books.add(request.body));
});

app.get("/api/books/:id", async (request, reply) => {
  const book = books.get(Number(request.params.id));
  if (!book) return reply.code(404).send({ error: "No book with that id" });
  return book;
});

app.patch("/api/books/:id", async (request, reply) => {
  const problem = checkStatusChange(request.body);
  if (problem) return reply.code(400).send({ error: problem });
  const book = books.update(Number(request.params.id), { status: request.body.status });
  if (!book) return reply.code(404).send({ error: "No book with that id" });
  return book;
});

app.delete("/api/books/:id", async (request, reply) => {
  if (!books.remove(Number(request.params.id))) return reply.code(404).send({ error: "No book with that id" });
  return reply.code(204).send();
});

app.get("/", async (request, reply) => {
  return reply.type("text/html; charset=utf-8").send(indexHtml);
});

app.setNotFoundHandler(async (request, reply) => {
  return reply.code(404).send({ error: "Not found" });
});

await app.listen({ port: Number(process.env.PORT) });
console.log(`Reading list server on port ${process.env.PORT}`);
