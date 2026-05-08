import "dotenv/config";
import http from "http";
import app from "./app.js";
import { initWs } from "./lib/ws.js";

const port = parseInt(process.env.PORT || "3000");

const server = http.createServer(app);
initWs(server);

server.listen(port, () => {
  console.log(`✅ Server running on http://localhost:${port}`);
  console.log(`   Health: http://localhost:${port}/api/health`);
  console.log(`   WS:     ws://localhost:${port}/ws?channel=booking:ID`);
});