import { createServer } from "node:http";
import * as books from "./books.js";
import { checkNewBook, checkStatusChange } from "./validate.js";

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
  const idMatch = path.match(/^\/api\/books\/(\d+)$/);
  try {
    if (req.method === "GET" && path === "/api/health") {
      sendJson(res, 200, { ok: true });
    } else if (req.method === "GET" && path === "/api/books") {
      sendJson(res, 200, books.list());
    } else if (req.method === "POST" && path === "/api/books") {
      const body = await readJson(req);
      const problem = checkNewBook(body);
      if (problem) {
        sendJson(res, 400, { error: problem });
      } else {
        sendJson(res, 201, books.add(body));
      }
    } else if (req.method === "GET" && idMatch) {
      const book = books.get(Number(idMatch[1]));
      if (book) sendJson(res, 200, book);
      else sendJson(res, 404, { error: "No book with that id" });
    } else if (req.method === "PATCH" && idMatch) {
      const body = await readJson(req);
      const problem = checkStatusChange(body);
      if (problem) {
        sendJson(res, 400, { error: problem });
      } else {
        const book = books.update(Number(idMatch[1]), { status: body.status });
        if (book) sendJson(res, 200, book);
        else sendJson(res, 404, { error: "No book with that id" });
      }
    } else if (req.method === "DELETE" && idMatch) {
      if (books.remove(Number(idMatch[1]))) {
        res.writeHead(204);
        res.end();
      } else {
        sendJson(res, 404, { error: "No book with that id" });
      }
    } else {
      sendJson(res, 404, { error: "Not found" });
    }
  } catch (err) {
    if (err instanceof SyntaxError) {
      sendJson(res, 400, { error: "The request body isn't valid JSON" });
    } else {
      console.error(err);
      sendJson(res, 500, { error: "Something went wrong" });
    }
  }
});

server.listen(process.env.PORT, () => {
  console.log(`Reading list server on port ${process.env.PORT}`);
});
