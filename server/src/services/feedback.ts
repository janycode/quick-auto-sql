import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import type { IFeedback, FeedbackStatus, FeedbackType, IFeedbackCreate } from '../types';

const FEEDBACK_FILE = 'feedbacks.json';

function getFilePath(): string {
  return path.join(config.dataDir, FEEDBACK_FILE);
}

function ensureDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readFeedbacks(): IFeedback[] {
  const filePath = getFilePath();
  ensureDir(filePath);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeFeedbacks(feedbacks: IFeedback[]): void {
  const filePath = getFilePath();
  ensureDir(filePath);
  fs.writeFileSync(filePath, JSON.stringify(feedbacks, null, 2), 'utf-8');
}

export function createFeedback(data: IFeedbackCreate, userId?: string, username?: string): IFeedback {
  const now = new Date().toISOString();
  const feedback: IFeedback = {
    id: uuidv4(),
    type: data.type,
    description: data.description,
    email: data.email,
    userId,
    username,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };
  const feedbacks = readFeedbacks();
  feedbacks.push(feedback);
  writeFeedbacks(feedbacks);
  return feedback;
}

export function getFeedbackList(params: {
  page?: number;
  pageSize?: number;
  status?: FeedbackStatus;
  type?: FeedbackType;
  userId?: string;
}): { items: IFeedback[]; total: number } {
  const page = params.page || 1;
  const pageSize = params.pageSize || 20;
  let feedbacks = readFeedbacks();

  if (params.status) {
    feedbacks = feedbacks.filter((f) => f.status === params.status);
  }
  if (params.type) {
    feedbacks = feedbacks.filter((f) => f.type === params.type);
  }
  if (params.userId) {
    feedbacks = feedbacks.filter((f) => f.userId === params.userId);
  }

  feedbacks.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const total = feedbacks.length;
  const start = (page - 1) * pageSize;
  const items = feedbacks.slice(start, start + pageSize);
  return { items, total };
}

export function getPendingCount(): number {
  const feedbacks = readFeedbacks();
  return feedbacks.filter((f) => f.status === 'pending').length;
}

export function getFeedbackById(id: string): IFeedback | undefined {
  const feedbacks = readFeedbacks();
  return feedbacks.find((f) => f.id === id);
}

export function updateFeedbackStatus(id: string, status: FeedbackStatus, reply?: string): IFeedback | undefined {
  const feedbacks = readFeedbacks();
  const index = feedbacks.findIndex((f) => f.id === id);
  if (index === -1) return undefined;
  feedbacks[index] = {
    ...feedbacks[index],
    status,
    reply: reply !== undefined ? reply : feedbacks[index].reply,
    updatedAt: new Date().toISOString(),
  };
  writeFeedbacks(feedbacks);
  return feedbacks[index];
}

export function deleteFeedback(id: string): boolean {
  const feedbacks = readFeedbacks();
  const index = feedbacks.findIndex((f) => f.id === id);
  if (index === -1) return false;
  feedbacks.splice(index, 1);
  writeFeedbacks(feedbacks);
  return true;
}
