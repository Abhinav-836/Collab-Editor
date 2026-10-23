import { Request, Response, NextFunction } from 'express';

type HttpError = Error & { status?: number; statusCode?: number; type?: string };

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (err: HttpError, _req: Request, res: Response, _next: NextFunction) => {
  // body-parser errors (bad JSON, payload too large) carry a 4xx status
  const status = err.status || err.statusCode || 500;

  if (status >= 500) console.error('❌ Error:', err);

  if (res.headersSent) return;

  res.status(status).json({
    success: false,
    error:
      err.type === 'entity.parse.failed'
        ? 'Invalid JSON body'
        : err.type === 'entity.too.large'
          ? 'Request body too large'
          : status >= 500
            ? 'Internal server error'
            : err.message,
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
};