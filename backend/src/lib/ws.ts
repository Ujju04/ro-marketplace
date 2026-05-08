import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";

const channels = new Map<string, Set<WebSocket>>();

export function initWs(server: Server): void {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (socket, req) => {
    const url = new URL(req.url || "/", "http://localhost");
    const channel = url.searchParams.get("channel") || "";

    if (!channel) { socket.close(1008, "channel param required"); return; }

    if (!channels.has(channel)) channels.set(channel, new Set());
    channels.get(channel)!.add(socket);

    socket.on("close", () => {
      channels.get(channel)?.delete(socket);
      if (channels.get(channel)?.size === 0) channels.delete(channel);
    });

    socket.on("error", () => socket.terminate());

    const ping = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) socket.ping();
    }, 25_000);
    socket.on("close", () => clearInterval(ping));
  });

  console.log("🔌 WebSocket server ready on /ws");
}

export function broadcast(channel: string, type: string, payload: any): void {
  const sockets = channels.get(channel);
  if (!sockets || sockets.size === 0) return;
  const msg = JSON.stringify({ type, payload });
  for (const socket of sockets) {
    if (socket.readyState === WebSocket.OPEN) socket.send(msg);
  }
}