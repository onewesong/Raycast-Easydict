/*
 * @author: tisfeng
 * @createTime: 2025-01-28 10:00
 * @lastEditor: tisfeng
 * @lastEditTime: 2025-01-28 10:00
 * @fileName: database.ts
 *
 * SQLite 数据库管理器（基于 Raycast executeSQL）
 */

import { executeSQL } from "@raycast/utils";
import { spawn } from "child_process";
import { homedir } from "os";
import { dirname, join } from "path";
import { promises as fs } from "fs";
import { VocabularyItem } from "./wordbook";

export class DatabaseManager {
  private static instance: DatabaseManager;
  private dbPath: string;
  private initialized = false;

  private constructor() {
    this.dbPath = join(homedir(), ".easydict", "vocabulary.db");
  }

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  /**
   * 确保数据库和表已初始化
   */
  public async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    try {
      await fs.mkdir(dirname(this.dbPath), { recursive: true });

      // 创建词汇表
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS vocabulary (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          word TEXT NOT NULL UNIQUE,
          translation TEXT,
          phonetic TEXT,
          from_language TEXT,
          to_language TEXT,
          note TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `;
      await this.executeWriteSQL(createTableSQL);

      // 创建索引以提高查询性能
      const createIndexSQL = `
        CREATE INDEX IF NOT EXISTS idx_vocabulary_word ON vocabulary(word);
        CREATE INDEX IF NOT EXISTS idx_vocabulary_created_at ON vocabulary(created_at);
      `;
      await this.executeWriteSQL(createIndexSQL);

      this.initialized = true;
    } catch (error) {
      // 打印错误，但不抛出，避免阻断 UI
      console.error("Failed to initialize vocabulary database:", error);
    }
  }

  /**
   * 以可写模式执行 SQL（使用系统 sqlite3 CLI）
   */
  private async executeWriteSQL(sql: string): Promise<void> {
    await fs.mkdir(dirname(this.dbPath), { recursive: true });
    await new Promise<void>((resolve, reject) => {
      const child = spawn("sqlite3", [this.dbPath, sql], { stdio: ["ignore", "pipe", "pipe"] });
      let stderr = "";
      child.stderr.on("data", (d) => (stderr += String(d)));
      child.on("error", (e) => reject(e));
      child.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(stderr || `sqlite3 exited with code ${code}`));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * 添加词汇到数据库
   */
  public async addVocabulary(item: Omit<VocabularyItem, "timestamp">): Promise<boolean> {
    try {
      await this.ensureInitialized();

      const now = Date.now();
      await this.executeWriteSQL(`
        INSERT OR REPLACE INTO vocabulary (word, translation, phonetic, from_language, to_language, note, created_at, updated_at)
        VALUES ('${item.word.replaceAll("'", "''")}', ${item.translation ? `'${item.translation.replaceAll("'", "''")}'` : "NULL"}, ${
          item.phonetic ? `'${item.phonetic.replaceAll("'", "''")}'` : "NULL"
        }, ${item.fromLanguage ? `'${item.fromLanguage.replaceAll("'", "''")}'` : "NULL"}, ${
          item.toLanguage ? `'${item.toLanguage.replaceAll("'", "''")}'` : "NULL"
        }, ${item.note ? `'${item.note.replaceAll("'", "''")}'` : "NULL"}, ${now}, ${now})
      `);

      return true;
    } catch (error) {
      console.error("Failed to add vocabulary to database:", error);
      return false;
    }
  }

  /**
   * 获取所有词汇列表
   */
  public async getVocabularyList(): Promise<VocabularyItem[]> {
    try {
      await this.ensureInitialized();
      const rows = (await executeSQL(
        this.dbPath,
        `
        SELECT word, translation, phonetic,
               from_language as fromLanguage,
               to_language as toLanguage,
               note, created_at as timestamp
        FROM vocabulary
        ORDER BY created_at DESC
      `,
      )) as VocabularyItem[] | undefined;
      return rows ?? [];
    } catch (error) {
      console.error("Failed to get vocabulary list from database:", error);
      return [];
    }
  }

  /**
   * 根据关键词搜索词汇
   */
  public async searchVocabulary(searchText: string): Promise<VocabularyItem[]> {
    try {
      await this.ensureInitialized();
      const pattern = `%${searchText}%`;
      const rows = (await executeSQL(
        this.dbPath,
        `
        SELECT word, translation, phonetic,
               from_language as fromLanguage,
               to_language as toLanguage,
               note, created_at as timestamp
        FROM vocabulary
        WHERE word LIKE '%${pattern.replaceAll("'", "''")}%' OR translation LIKE '%${pattern.replaceAll("'", "''")}%' 
        ORDER BY created_at DESC
      `,
      )) as VocabularyItem[] | undefined;
      return rows ?? [];
    } catch (error) {
      console.error("Failed to search vocabulary in database:", error);
      return [];
    }
  }

  /**
   * 移除词汇
   */
  public async removeVocabulary(word: string): Promise<boolean> {
    try {
      await this.ensureInitialized();
      await this.executeWriteSQL(`DELETE FROM vocabulary WHERE word = '${word.replaceAll("'", "''")}'`);
      return true;
    } catch (error) {
      console.error("Failed to remove vocabulary from database:", error);
      return false;
    }
  }

  /**
   * 检查词汇是否存在
   */
  public async isVocabularyExists(word: string): Promise<boolean> {
    try {
      await this.ensureInitialized();
      const rows = (await executeSQL(
        this.dbPath,
        `SELECT COUNT(*) as count FROM vocabulary WHERE word = '${word.replaceAll("'", "''")}'`,
      )) as { count: number }[] | undefined;
      const count = rows && rows.length > 0 ? Number(rows[0].count) : 0;
      return count > 0;
    } catch (error) {
      console.error("Failed to check vocabulary existence in database:", error);
      return false;
    }
  }

  /**
   * 获取词汇数量
   */
  public async getVocabularyCount(): Promise<number> {
    try {
      await this.ensureInitialized();
      const rows = (await executeSQL(this.dbPath, "SELECT COUNT(*) as count FROM vocabulary")) as
        | { count: number }[]
        | undefined;
      const count = rows && rows.length > 0 ? Number(rows[0].count) : 0;
      return count;
    } catch (error) {
      console.error("Failed to get vocabulary count from database:", error);
      return 0;
    }
  }

  /**
   * 清空所有词汇
   */
  public async clearAllVocabulary(): Promise<boolean> {
    try {
      await this.ensureInitialized();
      await this.executeWriteSQL("DELETE FROM vocabulary");
      return true;
    } catch (error) {
      console.error("Failed to clear vocabulary from database:", error);
      return false;
    }
  }

  /**
   * 获取数据库文件路径
   */
  public getDatabasePath(): string {
    return this.dbPath;
  }
}
