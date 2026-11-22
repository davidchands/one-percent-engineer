import Fastify from "fastify";
import * as books from "./books.js";

const app = Fastify();

app.get("/api/health", async () => {
  return { ok: true };
});

app.get("/api/books", async () => {
  return books.list();
});

app.post("/api/books", async (request, reply) => {
  return reply.code(201).send(books.add(request.body));
});

app.setNotFoundHandler(async (request, reply) => {
  return reply.code(404).send({ error: "Not found" });
});

await app.listen({ port: Number(process.env.PORT) });
console.log(`Reading list server on port ${process.env.PORT}`);
