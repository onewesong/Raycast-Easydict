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

export interface VocabularyItem {
  word: string;
  translation?: string;
  phonetic?: string;
  fromLanguage?: string;
  toLanguage?: string;
  timestamp: number;
  note?: string;
}

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
   * 获取数据库文件路径
   */
  public getDatabasePath(): string {
    return this.databaseManager.getDatabasePath();
  }
}
