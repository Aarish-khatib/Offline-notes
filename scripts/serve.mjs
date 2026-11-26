import { readFile } from "node:fs/promises";
import { createServer } from "node:http";

const routes = new Map([
  ["/", ["index.html", "text/html"]],
  ["/index.html", ["index.html", "text/html"]],
  ["/styles.css", ["styles.css", "text/css"]],
  ["/sw.js", ["sw.js", "text/javascript"]],
  ["/src/app.js", ["src/app.js", "text/javascript"]],
  ["/src/model.js", ["src/model.js", "text/javascript"]],
  ["/src/store.js", ["src/store.js", "text/javascript"]],
]);
const port = process.env.PORT === undefined ? 4173 : Number(process.env.PORT);

createServer(async (request, response) => {
  const path = request.url?.split("?")[0];
  const route = routes.get(path);
  if (!route || !["GET", "HEAD"].includes(request.method)) {
    response.writeHead(404).end("Not found");
    return;
  }
  const [file, type] = route;
  try {
    const content = await readFile(new URL(`../${file}`, import.meta.url));
    response.writeHead(200, { "Content-Type": `${type}; charset=utf-8`, "Cache-Control": "no-cache" });
    response.end(request.method === "HEAD" ? undefined : content);
  } catch {
    response.writeHead(500).end("Could not load this file");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Offline Notes is running at http://127.0.0.1:${port}`);
});
