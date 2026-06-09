import { Request, Response, NextFunction } from 'express';
import { IApiResponse } from '../types';

export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function success<T>(res: Response, data: T, message = 'success'): void {
  const response: IApiResponse<T> = { code: 0, message, data };
  res.json(response);
}

export function fail(res: Response, message: string, code = -1, status = 400): void {
  res.status(status).json({ code, message, data: null });
}
