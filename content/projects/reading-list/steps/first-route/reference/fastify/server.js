import Fastify from "fastify";

const app = Fastify();

app.get("/api/health", async () => {
  return { ok: true };
});

app.get("/api/books", async () => {
  return [];
});

await app.listen({ port: Number(process.env.PORT) });
console.log(`Reading list server on port ${process.env.PORT}`);
