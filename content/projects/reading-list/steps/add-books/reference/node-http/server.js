import { createServer } from "node:http";
import * as books from "./books.js";

function sendJson(res, status, value) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(value));
}

async function readJson(req) {
  let text = "";
  for await (const chunk of req) text += chunk;
  return JSON.parse(text);
}

const server = createServer(async (req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  if (req.method === "GET" && path === "/api/health") {
    sendJson(res, 200, { ok: true });
  } else if (req.method === "GET" && path === "/api/books") {
    sendJson(res, 200, books.list());
  } else if (req.method === "POST" && path === "/api/books") {
    const body = await readJson(req);
    sendJson(res, 201, books.add(body));
  } else {
    sendJson(res, 404, { error: "Not found" });
  }
});

server.listen(process.env.PORT, () => {
  console.log(`Reading list server on port ${process.env.PORT}`);
});
