import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { randomUUID } from 'crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { bearerAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { getTransportConfig } from '../config.js';

const transports: Record<string, StreamableHTTPServerTransport> = {};

export function createHttpApp(getServer: () => McpServer): Application {
  const app = express();

  app.use(helmet({
    contentSecurityPolicy: false,
  }));
  app.use(cors({
    origin: true,
    credentials: true,
    exposedHeaders: ['Mcp-Session-Id'],
  }));
  app.use(express.json({ limit: '10mb' }));

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.post('/mcp', bearerAuth, async (req: AuthenticatedRequest, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (sessionId) {
      console.error(`Received MCP request for session: ${sessionId}`);
    }

    try {
      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports[sessionId]) {
        transport = transports[sessionId];
      } else if (!sessionId && isInitializeRequest(req.body)) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid: string) => {
            console.error(`Session initialized with ID: ${sid}`);
            transports[sid] = transport;
          },
        });

        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid && transports[sid]) {
            console.error(`Transport closed for session ${sid}, removing from transports map`);
            delete transports[sid];
          }
        };

        const server = getServer();
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
        return;
      } else {
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: No valid session ID provided',
          },
          id: null,
        });
        return;
      }

      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('Error handling MCP request:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
          },
          id: null,
        });
      }
    }
  });

  app.get('/mcp', bearerAuth, async (req: AuthenticatedRequest, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (!sessionId || !transports[sessionId]) {
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Invalid or missing session ID',
        },
        id: null,
      });
      return;
    }

    const lastEventId = req.headers['last-event-id'];
    if (lastEventId) {
      console.error(`Client reconnecting with Last-Event-ID: ${lastEventId}`);
    } else {
      console.error(`Establishing new SSE stream for session ${sessionId}`);
    }

    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
  });

  app.delete('/mcp', bearerAuth, async (req: AuthenticatedRequest, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (!sessionId || !transports[sessionId]) {
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Invalid or missing session ID',
        },
        id: null,
      });
      return;
    }

    console.error(`Received session termination request for session ${sessionId}`);

    try {
      const transport = transports[sessionId];
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error('Error handling session termination:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Error processing session termination',
          },
          id: null,
        });
      }
    }
  });

  return app;
}

export async function startHttpServer(getServer: () => McpServer): Promise<void> {
  const transportConfig = getTransportConfig();
  const app = createHttpApp(getServer);

  return new Promise((resolve) => {
    const server = app.listen(transportConfig.httpPort, () => {
      console.error(`Kriptty MCP server running on HTTP port ${transportConfig.httpPort}`);
      console.error(`Health check: http://localhost:${transportConfig.httpPort}/health`);
      console.error(`MCP endpoint: http://localhost:${transportConfig.httpPort}/mcp`);
      resolve();
    });

    process.on('SIGINT', async () => {
      console.error('Shutting down server...');
      for (const sessionId in transports) {
        try {
          console.error(`Closing transport for session ${sessionId}`);
          await transports[sessionId].close();
          delete transports[sessionId];
        } catch (error) {
          console.error(`Error closing transport for session ${sessionId}:`, error);
        }
      }
      server.close(() => {
        console.error('Server shutdown complete');
        process.exit(0);
      });
    });
  });
}
