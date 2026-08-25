import { Response } from 'express';

export interface SseClient {
  id: string;
  userId: string;
  role: string;
  res: Response;
  connectedAt: Date;
  ip?: string;
}

class SseService {
  private clients: Map<string, SseClient> = new Map();
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startHeartbeat();
  }

  /**
   * Registers an active client connection into the pool
   */
  public addClient(client: SseClient): void {
    this.clients.set(client.id, client);
    console.log(`🔌 [SSE] Client connected: ${client.id} (User: ${client.userId}, Role: ${client.role}). Active: ${this.clients.size}`);

    // Send initial handshake acknowledgment
    this.sendEventToClient(client, 'connected', {
      clientId: client.id,
      userId: client.userId,
      role: client.role,
      connectedAt: client.connectedAt.toISOString(),
      activeConnections: this.clients.size,
    });
  }

  /**
   * Unregisters a client when disconnected
   */
  public removeClient(clientId: string): void {
    if (this.clients.has(clientId)) {
      this.clients.delete(clientId);
      console.log(`🔌 [SSE] Client disconnected: ${clientId}. Active: ${this.clients.size}`);
    }
  }

  /**
   * Send SSE formatted packet to a single client
   */
  private sendEventToClient(client: SseClient, eventName: string, data: any): void {
    try {
      const payload = typeof data === 'string' ? data : JSON.stringify(data);
      client.res.write(`event: ${eventName}\n`);
      client.res.write(`data: ${payload}\n\n`);
      if (typeof (client.res as any).flush === 'function') {
        (client.res as any).flush();
      }
    } catch (err: any) {
      console.error(`[SSE Send Error] Client ${client.id}:`, err.message);
      this.removeClient(client.id);
    }
  }

  /**
   * Broadcast an event to a specific user (supports multiple devices/tabs)
   */
  public sendToUser(userId: string, eventName: string, data: any): number {
    let sentCount = 0;
    this.clients.forEach((client) => {
      if (client.userId === userId) {
        this.sendEventToClient(client, eventName, data);
        sentCount++;
      }
    });
    return sentCount;
  }

  /**
   * Broadcast an event to all users belonging to specific roles (e.g. 'super_admin', 'admin', 'manager')
   */
  public sendToRoles(roles: string[], eventName: string, data: any): number {
    let sentCount = 0;
    const roleSet = new Set(roles.map((r) => r.toLowerCase()));
    this.clients.forEach((client) => {
      if (roleSet.has(client.role.toLowerCase()) || client.role.toLowerCase() === 'super_admin') {
        this.sendEventToClient(client, eventName, data);
        sentCount++;
      }
    });
    return sentCount;
  }

  /**
   * Broadcast an event to ALL active connected clients
   */
  public broadcastAll(eventName: string, data: any): number {
    let sentCount = 0;
    this.clients.forEach((client) => {
      this.sendEventToClient(client, eventName, data);
      sentCount++;
    });
    return sentCount;
  }

  /**
   * Returns active connection metrics
   */
  public getMetrics() {
    const rolesCount: Record<string, number> = {};
    this.clients.forEach((client) => {
      rolesCount[client.role] = (rolesCount[client.role] || 0) + 1;
    });

    return {
      totalActiveConnections: this.clients.size,
      roles: rolesCount,
    };
  }

  /**
   * Periodic 12-second heartbeat ping to prevent timeouts and stale QUIC/HTTP3 proxies
   */
  private startHeartbeat(): void {
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(() => {
      if (this.clients.size === 0) return;
      const timestamp = new Date().toISOString();
      this.clients.forEach((client) => {
        try {
          client.res.write(`: keep-alive ${timestamp}\n\n`);
          client.res.write(`event: ping\ndata: {"time":"${timestamp}"}\n\n`);
          if (typeof (client.res as any).flush === 'function') {
            (client.res as any).flush();
          }
        } catch {
          this.removeClient(client.id);
        }
      });
    }, 12000);
  }
}

export const sseService = new SseService();
