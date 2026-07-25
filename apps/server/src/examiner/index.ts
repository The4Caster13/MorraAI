import { examinerMode } from '../config/env.js';
import type { ExaminerService } from './ExaminerService.js';
import { MockExaminerService } from './MockExaminerService.js';
import { GeminiExaminerService } from './GeminiExaminerService.js';

let instance: ExaminerService | null = null;

export function getExaminerService(): ExaminerService {
  if (!instance) {
    instance =
      examinerMode() === 'gemini' ? new GeminiExaminerService() : new MockExaminerService();
  }
  return instance;
}

export function setExaminerService(service: ExaminerService): void {
  instance = service;
}

export type { ExaminerService } from './ExaminerService.js';
