/*
 * @author: tisfeng
 * @createTime: 2025-01-28 10:00
 * @lastEditor: tisfeng
 * @lastEditTime: 2025-01-28 10:00
 * @fileName: wordbook.ts
 *
 * 生词本管理器
 */

import { readFile, writeFile, access, mkdir } from "fs/promises";
import { homedir } from "os";
import { join } from "path";

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
  private wordbookPath: string;
  private wordbookDir: string;

  private constructor() {
    this.wordbookDir = join(homedir(), ".easydict");
    this.wordbookPath = join(this.wordbookDir, "word.txt");
  }

  public static getInstance(): VocabularyManager {
    if (!VocabularyManager.instance) {
      VocabularyManager.instance = new VocabularyManager();
    }
    return VocabularyManager.instance;
  }

  /**
   * 初始化生词本文件
   */
  private async initWordbookFile(): Promise<void> {
    try {
      try {
        await access(this.wordbookDir);
      } catch {
        await mkdir(this.wordbookDir, { recursive: true });
      }

      try {
        await access(this.wordbookPath);
      } catch {
        await writeFile(this.wordbookPath, "", "utf8");
      }
    } catch (error) {
      console.error("Failed to initialize wordbook file:", error);
    }
  }

  /**
   * 添加单词到生词本
   */
  public async addVocabulary(item: Omit<VocabularyItem, "timestamp">): Promise<boolean> {
    try {
      await this.initWordbookFile();

      // 检查是否已存在相同单词
      const existingItems = await this.getVocabularyList();
      const exists = existingItems.some((v) => v.word.toLowerCase() === item.word.toLowerCase());

      if (exists) {
        return false; // 单词已存在
      }

      const vocabularyItem: VocabularyItem = {
        ...item,
        timestamp: Date.now(),
      };

      const content = JSON.stringify(vocabularyItem) + "\n";

      await writeFile(this.wordbookPath, content, { flag: "a" });
      return true;
    } catch (error) {
      console.error("Failed to add vocabulary:", error);
      return false;
    }
  }

  /**
   * 获取生词本列表
   */
  public async getVocabularyList(): Promise<VocabularyItem[]> {
    try {
      await this.initWordbookFile();

      const content = await readFile(this.wordbookPath, "utf8");
      if (!content.trim()) {
        return [];
      }

      const lines = content.trim().split("\n");
      const items: VocabularyItem[] = [];

      for (const line of lines) {
        try {
          const item = JSON.parse(line) as VocabularyItem;
          items.push(item);
        } catch {
          console.warn("Failed to parse vocabulary line:", line);
        }
      }

      // 按时间倒序排列（最新的在前）
      return items.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error("Failed to get vocabulary list:", error);
      return [];
    }
  }

  /**
   * 移除生词
   */
  public async removeVocabulary(word: string): Promise<boolean> {
    try {
      const items = await this.getVocabularyList();
      const filteredItems = items.filter((item) => item.word.toLowerCase() !== word.toLowerCase());

      const content = filteredItems.map((item) => JSON.stringify(item)).join("\n") + "\n";

      await writeFile(this.wordbookPath, content, "utf8");
      return true;
    } catch (error) {
      console.error("Failed to remove vocabulary:", error);
      return false;
    }
  }

  /**
   * 检查单词是否已存在
   */
  public async isVocabularyExists(word: string): Promise<boolean> {
    const items = await this.getVocabularyList();
    return items.some((item) => item.word.toLowerCase() === word.toLowerCase());
  }

  /**
   * 获取生词本文件路径
   */
  public getWordbookPath(): string {
    return this.wordbookPath;
  }
}
