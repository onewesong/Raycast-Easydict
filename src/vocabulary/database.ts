/*
 * @author: tisfeng
 * @createTime: 2025-01-28 10:00
 * @lastEditor: tisfeng
 * @lastEditTime: 2025-01-28 10:00
 * @fileName: database.ts
 *
 * SQLite 数据库管理器
 */

import Database from "better-sqlite3";
import { homedir } from "os";
import { join } from "path";
import { VocabularyItem } from "./wordbook";

export class DatabaseManager {
  private static instance: DatabaseManager;
  private db: Database.Database | null = null;
  private dbPath: string;

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
   * 初始化数据库连接
   */
  private initDatabase(): void {
    if (this.db) return;

    this.db = new Database(this.dbPath);

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

    this.db.exec(createTableSQL);

    // 创建索引以提高查询性能
    const createIndexSQL = `
      CREATE INDEX IF NOT EXISTS idx_vocabulary_word ON vocabulary(word);
      CREATE INDEX IF NOT EXISTS idx_vocabulary_created_at ON vocabulary(created_at);
    `;

    this.db.exec(createIndexSQL);
  }

  /**
   * 添加词汇到数据库
   */
  public addVocabulary(item: Omit<VocabularyItem, "timestamp">): boolean {
    try {
      this.initDatabase();

      const now = Date.now();
      const stmt = this.db!.prepare(`
        INSERT OR REPLACE INTO vocabulary (word, translation, phonetic, from_language, to_language, note, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        item.word,
        item.translation,
        item.phonetic,
        item.fromLanguage,
        item.toLanguage,
        item.note,
        now,
        now,
      );

      return result.changes > 0;
    } catch (error) {
      console.error("Failed to add vocabulary to database:", error);
      return false;
    }
  }

  /**
   * 获取所有词汇列表
   */
  public getVocabularyList(): VocabularyItem[] {
    try {
      this.initDatabase();

      const stmt = this.db!.prepare(`
        SELECT word, translation, phonetic, from_language, to_language, note, created_at as timestamp
        FROM vocabulary
        ORDER BY created_at DESC
      `);

      const rows = stmt.all() as VocabularyItem[];
      return rows;
    } catch (error) {
      console.error("Failed to get vocabulary list from database:", error);
      return [];
    }
  }

  /**
   * 根据关键词搜索词汇
   */
  public searchVocabulary(searchText: string): VocabularyItem[] {
    try {
      this.initDatabase();

      const stmt = this.db!.prepare(`
        SELECT word, translation, phonetic, from_language, to_language, note, created_at as timestamp
        FROM vocabulary
        WHERE word LIKE ? OR translation LIKE ?
        ORDER BY created_at DESC
      `);

      const searchPattern = `%${searchText}%`;
      const rows = stmt.all(searchPattern, searchPattern) as VocabularyItem[];
      return rows;
    } catch (error) {
      console.error("Failed to search vocabulary in database:", error);
      return [];
    }
  }

  /**
   * 移除词汇
   */
  public removeVocabulary(word: string): boolean {
    try {
      this.initDatabase();

      const stmt = this.db!.prepare("DELETE FROM vocabulary WHERE word = ?");
      const result = stmt.run(word);

      return result.changes > 0;
    } catch (error) {
      console.error("Failed to remove vocabulary from database:", error);
      return false;
    }
  }

  /**
   * 检查词汇是否存在
   */
  public isVocabularyExists(word: string): boolean {
    try {
      this.initDatabase();

      const stmt = this.db!.prepare("SELECT COUNT(*) as count FROM vocabulary WHERE word = ?");
      const result = stmt.get(word) as { count: number };

      return result.count > 0;
    } catch (error) {
      console.error("Failed to check vocabulary existence in database:", error);
      return false;
    }
  }

  /**
   * 获取词汇数量
   */
  public getVocabularyCount(): number {
    try {
      this.initDatabase();

      const stmt = this.db!.prepare("SELECT COUNT(*) as count FROM vocabulary");
      const result = stmt.get() as { count: number };

      return result.count;
    } catch (error) {
      console.error("Failed to get vocabulary count from database:", error);
      return 0;
    }
  }

  /**
   * 清空所有词汇
   */
  public clearAllVocabulary(): boolean {
    try {
      this.initDatabase();

      const stmt = this.db!.prepare("DELETE FROM vocabulary");
      const result = stmt.run();

      return result.changes >= 0; // 即使没有删除任何行也算成功
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

  /**
   * 关闭数据库连接
   */
  public close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
