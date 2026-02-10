import { Request, Response, NextFunction } from 'express';
import { getTransportConfig } from '../config.js';

export interface AuthenticatedRequest extends Request {
  clientToken?: string;
}

export function bearerAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({
      jsonrpc: '2.0',
      error: {
        code: -32001,
        message: 'Authorization header required',
      },
      id: null,
    });
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    res.status(401).json({
      jsonrpc: '2.0',
      error: {
        code: -32001,
        message: 'Invalid authorization format. Use: Bearer <token>',
      },
      id: null,
    });
    return;
  }

  const token = parts[1];
  const transportConfig = getTransportConfig();

  if (!transportConfig.authTokens.includes(token)) {
    res.status(401).json({
      jsonrpc: '2.0',
      error: {
        code: -32001,
        message: 'Invalid token',
      },
      id: null,
    });
    return;
  }

  req.clientToken = token;
  next();
}
