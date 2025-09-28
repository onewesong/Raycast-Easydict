/*
 * @author: tisfeng
 * @createTime: 2025-01-28 10:00
 * @lastEditor: tisfeng
 * @lastEditTime: 2025-01-28 10:00
 * @fileName: wordbook.ts
 *
 * 生词本管理器
 */

import { DatabaseManager } from "./database";

export const REVIEW_INTERVALS = [
  5 * 60 * 1000, // 5 分钟
  12 * 60 * 60 * 1000, // 12 小时
  24 * 60 * 60 * 1000, // 1 天
  3 * 24 * 60 * 60 * 1000, // 3 天
  7 * 24 * 60 * 60 * 1000, // 7 天
  30 * 24 * 60 * 60 * 1000, // 30 天
] as const;

export const MAX_PROFICIENCY = REVIEW_INTERVALS.length - 1;

function getDefaultProgress(word: string): VocabularyReviewProgress {
  return {
    word,
    proficiency: 0,
    reviewCount: 0,
    successCount: 0,
    failCount: 0,
  };
}

export interface VocabularyItem {
  word: string;
  translation?: string;
  phonetic?: string;
  fromLanguage?: string;
  toLanguage?: string;
  timestamp: number;
  note?: string;
}

export interface VocabularyReviewProgress {
  word: string;
  proficiency: number;
  reviewCount: number;
  successCount: number;
  failCount: number;
  lastReviewedAt?: number;
  nextReviewAt?: number;
}

export interface VocabularyReviewItem extends VocabularyItem, VocabularyReviewProgress {}

export interface VocabularyReviewStatistics {
  total: number;
  due: number;
  mastered: number;
}

export type ReviewResult = "remember" | "hard" | "forget";

export class VocabularyManager {
  private static instance: VocabularyManager;
  private databaseManager: DatabaseManager;

  private constructor() {
    this.databaseManager = DatabaseManager.getInstance();
  }

  public static getInstance(): VocabularyManager {
    if (!VocabularyManager.instance) {
      VocabularyManager.instance = new VocabularyManager();
    }
    return VocabularyManager.instance;
  }

  /**
   * 添加单词到生词本
   */
  public async addVocabulary(item: Omit<VocabularyItem, "timestamp">): Promise<boolean> {
    // 检查是否已存在相同单词（数据库的 UNIQUE 约束会自动处理，但我们先检查以便返回更友好的错误信息）
    const exists = await this.databaseManager.isVocabularyExists(item.word);
    if (exists) {
      return false; // 单词已存在
    }

    return await this.databaseManager.addVocabulary(item);
  }

  /**
   * 获取生词本列表
   */
  public async getVocabularyList(): Promise<VocabularyItem[]> {
    return await this.databaseManager.getVocabularyList();
  }

  /**
   * 搜索生词本
   */
  public async searchVocabulary(searchText: string): Promise<VocabularyItem[]> {
    try {
      return await this.databaseManager.searchVocabulary(searchText);
    } catch (error) {
      console.error("Failed to search vocabulary:", error);
      return [];
    }
  }

  /**
   * 移除生词
   */
  public async removeVocabulary(word: string): Promise<boolean> {
    return await this.databaseManager.removeVocabulary(word);
  }

  /**
   * 检查单词是否已存在
   */
  public async isVocabularyExists(word: string): Promise<boolean> {
    return await this.databaseManager.isVocabularyExists(word);
  }

  /**
   * 获取生词本数量
   */
  public async getVocabularyCount(): Promise<number> {
    return await this.databaseManager.getVocabularyCount();
  }

  /**
   * 清空所有生词
   */
  public async clearAllVocabulary(): Promise<boolean> {
    return await this.databaseManager.clearAllVocabulary();
  }

  /**
   * 获取复习队列
   */
  public async getReviewQueue(limit = 20, onlyDue = true): Promise<VocabularyReviewItem[]> {
    return await this.databaseManager.getReviewQueue(limit, onlyDue);
  }

  /**
   * 获取复习进度
   */
  public async getReviewProgress(word: string): Promise<VocabularyReviewProgress | undefined> {
    return await this.databaseManager.getReviewProgress(word);
  }

  /**
   * 更新复习进度
   */
  public async updateReviewProgress(progress: VocabularyReviewProgress): Promise<boolean> {
    return await this.databaseManager.upsertReviewProgress(progress);
  }

  /**
   * 根据复习结果更新进度
   */
  public async applyReviewResult(word: string, result: ReviewResult): Promise<VocabularyReviewProgress | undefined> {
    const progress = (await this.databaseManager.getReviewProgress(word)) ?? getDefaultProgress(word);
    const now = Date.now();

    let { proficiency } = progress;
    if (result === "remember") {
      proficiency = Math.min(proficiency + 1, MAX_PROFICIENCY);
    } else if (result === "hard") {
      proficiency = Math.min(proficiency + 1, MAX_PROFICIENCY);
    } else {
      proficiency = Math.max(proficiency - 1, 0);
    }

    const intervalIndex = result === "forget" ? 0 : Math.min(proficiency, MAX_PROFICIENCY);
    const nextReviewAt = now + REVIEW_INTERVALS[intervalIndex];

    const updatedProgress: VocabularyReviewProgress = {
      word,
      proficiency,
      reviewCount: progress.reviewCount + 1,
      successCount: progress.successCount + (result !== "forget" ? 1 : 0),
      failCount: progress.failCount + (result === "forget" ? 1 : 0),
      lastReviewedAt: now,
      nextReviewAt,
    };

    const success = await this.updateReviewProgress(updatedProgress);
    if (success) {
      return updatedProgress;
    }
    return undefined;
  }

  /**
   * 清空复习进度
   */
  public async clearReviewProgress(word?: string): Promise<boolean> {
    return await this.databaseManager.clearReviewProgress(word);
  }

  /**
   * 获取复习统计
   */
  public async getReviewStatistics(): Promise<VocabularyReviewStatistics> {
    return await this.databaseManager.getReviewStatistics();
  }

  /**
   * 获取数据库文件路径
   */
  public getDatabasePath(): string {
    return this.databaseManager.getDatabasePath();
  }
}
