import request from '@/utils/request'

export type FeedbackType = 'bug' | 'suggestion' | 'security' | 'other'
export type FeedbackStatus = 'pending' | 'processing' | 'resolved' | 'rejected'

export interface IFeedback {
  id: string
  type: FeedbackType
  description: string
  email?: string
  userId?: string
  username?: string
  status: FeedbackStatus
  reply?: string
  createdAt: string
  updatedAt: string
}

export interface IFeedbackCreate {
  type: FeedbackType
  description: string
  email?: string
}

export interface IFeedbackListResult {
  items: IFeedback[]
  total: number
}

export function submitFeedback(data: IFeedbackCreate) {
  return request.post('/feedback', data)
}

export function getFeedbackPendingCount() {
  return request.get('/feedback/pending-count')
}

export function getFeedbackList(params: {
  page?: number
  pageSize?: number
  status?: FeedbackStatus
  type?: FeedbackType
}) {
  return request.get('/feedback', { params })
}

export function updateFeedbackStatus(id: string, status: FeedbackStatus, reply?: string) {
  return request.put(`/feedback/${id}/status`, { status, reply })
}

export function deleteFeedback(id: string) {
  return request.delete(`/feedback/${id}`)
}
