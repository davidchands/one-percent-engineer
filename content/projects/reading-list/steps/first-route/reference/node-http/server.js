import { createServer } from "node:http";

function sendJson(res, status, value) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(value));
}

const server = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/api/health") {
    sendJson(res, 200, { ok: true });
  } else if (req.method === "GET" && req.url === "/api/books") {
    sendJson(res, 200, []);
  } else {
    sendJson(res, 404, { error: "Not found" });
  }
});

server.listen(process.env.PORT, () => {
  console.log(`Reading list server on port ${process.env.PORT}`);
});
