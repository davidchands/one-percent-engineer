import Fastify from "fastify";
import * as books from "./books.js";
import { checkNewBook } from "./validate.js";

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

app.setNotFoundHandler(async (request, reply) => {
  return reply.code(404).send({ error: "Not found" });
});

await app.listen({ port: Number(process.env.PORT) });
console.log(`Reading list server on port ${process.env.PORT}`);
