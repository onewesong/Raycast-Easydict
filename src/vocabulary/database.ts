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
import type {
  VocabularyItem,
  VocabularyReviewItem,
  VocabularyReviewProgress,
  VocabularyReviewStatistics,
} from "./wordbook";

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

      // 创建背诵进度表
      const createProgressTableSQL = `
        CREATE TABLE IF NOT EXISTS vocabulary_progress (
          word TEXT PRIMARY KEY,
          proficiency INTEGER NOT NULL DEFAULT 0,
          review_count INTEGER NOT NULL DEFAULT 0,
          success_count INTEGER NOT NULL DEFAULT 0,
          fail_count INTEGER NOT NULL DEFAULT 0,
          last_reviewed_at INTEGER,
          next_review_at INTEGER,
          FOREIGN KEY (word) REFERENCES vocabulary(word) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_vocabulary_progress_word ON vocabulary_progress(word);
        CREATE INDEX IF NOT EXISTS idx_vocabulary_progress_next_review ON vocabulary_progress(next_review_at);
        CREATE TRIGGER IF NOT EXISTS trg_vocabulary_delete
        AFTER DELETE ON vocabulary
        FOR EACH ROW
        BEGIN
          DELETE FROM vocabulary_progress WHERE word = OLD.word;
        END;
      `;
      await this.executeWriteSQL(createProgressTableSQL);

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
      const child = spawn("sqlite3", [this.dbPath, `PRAGMA foreign_keys = ON; ${sql}`], {
        stdio: ["ignore", "pipe", "pipe"],
      });
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
   * 获取需要复习的词汇列表
   */
  public async getReviewQueue(limit = 20, onlyDue = true): Promise<VocabularyReviewItem[]> {
    try {
      await this.ensureInitialized();
      const safeLimit = Math.max(1, Math.min(Number.isFinite(limit) ? Math.floor(limit) : 20, 200));
      const now = Date.now();
      const reviewCondition = onlyDue ? `WHERE (p.next_review_at IS NULL OR p.next_review_at <= ${now})` : "";
      const sql = `
        SELECT v.word, v.translation, v.phonetic,
               v.from_language as fromLanguage,
               v.to_language as toLanguage,
               v.note,
               v.created_at as timestamp,
               COALESCE(p.proficiency, 0) as proficiency,
               COALESCE(p.review_count, 0) as reviewCount,
               COALESCE(p.success_count, 0) as successCount,
               COALESCE(p.fail_count, 0) as failCount,
               p.last_reviewed_at as lastReviewedAt,
               p.next_review_at as nextReviewAt
        FROM vocabulary v
        LEFT JOIN vocabulary_progress p ON v.word = p.word
        ${reviewCondition}
        ORDER BY COALESCE(p.next_review_at, v.created_at) ASC, v.created_at DESC
        LIMIT ${safeLimit}
      `;
      const rows = (await executeSQL(this.dbPath, sql)) as VocabularyReviewItem[] | undefined;
      return (rows ?? []).map((row) => ({
        ...row,
        proficiency: Number(row.proficiency ?? 0),
        reviewCount: Number(row.reviewCount ?? 0),
        successCount: Number(row.successCount ?? 0),
        failCount: Number(row.failCount ?? 0),
        lastReviewedAt: row.lastReviewedAt ? Number(row.lastReviewedAt) : undefined,
        nextReviewAt: row.nextReviewAt ? Number(row.nextReviewAt) : undefined,
        timestamp: Number(row.timestamp ?? 0),
      }));
    } catch (error) {
      console.error("Failed to get review queue from database:", error);
      return [];
    }
  }

  /**
   * 获取单词的复习进度
   */
  public async getReviewProgress(word: string): Promise<VocabularyReviewProgress | undefined> {
    try {
      await this.ensureInitialized();
      const escapedWord = word.replaceAll("'", "''");
      const rows = (await executeSQL(
        this.dbPath,
        `SELECT word, proficiency, review_count as reviewCount, success_count as successCount, fail_count as failCount,
                last_reviewed_at as lastReviewedAt, next_review_at as nextReviewAt
         FROM vocabulary_progress
         WHERE word = '${escapedWord}'
         LIMIT 1`,
      )) as VocabularyReviewProgress[] | undefined;
      if (!rows || rows.length === 0) {
        return undefined;
      }
      const row = rows[0];
      return {
        ...row,
        proficiency: Number(row.proficiency ?? 0),
        reviewCount: Number(row.reviewCount ?? 0),
        successCount: Number(row.successCount ?? 0),
        failCount: Number(row.failCount ?? 0),
        lastReviewedAt: row.lastReviewedAt ? Number(row.lastReviewedAt) : undefined,
        nextReviewAt: row.nextReviewAt ? Number(row.nextReviewAt) : undefined,
      };
    } catch (error) {
      console.error("Failed to get vocabulary review progress:", error);
      return undefined;
    }
  }

  /**
   * 写入复习进度
   */
  public async upsertReviewProgress(progress: VocabularyReviewProgress): Promise<boolean> {
    try {
      await this.ensureInitialized();
      const escapedWord = progress.word.replaceAll("'", "''");
      const sql = `
        INSERT INTO vocabulary_progress (word, proficiency, review_count, success_count, fail_count, last_reviewed_at, next_review_at)
        VALUES ('${escapedWord}', ${progress.proficiency}, ${progress.reviewCount}, ${progress.successCount}, ${progress.failCount}, ${
          progress.lastReviewedAt ?? "NULL"
        }, ${progress.nextReviewAt ?? "NULL"})
        ON CONFLICT(word) DO UPDATE SET
          proficiency=excluded.proficiency,
          review_count=excluded.review_count,
          success_count=excluded.success_count,
          fail_count=excluded.fail_count,
          last_reviewed_at=excluded.last_reviewed_at,
          next_review_at=excluded.next_review_at
      `;
      await this.executeWriteSQL(sql);
      return true;
    } catch (error) {
      console.error("Failed to upsert vocabulary review progress:", error);
      return false;
    }
  }

  /**
   * 清除复习进度
   */
  public async clearReviewProgress(word?: string): Promise<boolean> {
    try {
      await this.ensureInitialized();
      if (word) {
        const escapedWord = word.replaceAll("'", "''");
        await this.executeWriteSQL(`DELETE FROM vocabulary_progress WHERE word = '${escapedWord}'`);
      } else {
        await this.executeWriteSQL("DELETE FROM vocabulary_progress");
      }
      return true;
    } catch (error) {
      console.error("Failed to clear vocabulary review progress:", error);
      return false;
    }
  }

  /**
   * 获取复习统计数据
   */
  public async getReviewStatistics(): Promise<VocabularyReviewStatistics> {
    try {
      await this.ensureInitialized();
      const now = Date.now();
      const [dueRow] = ((await executeSQL(
        this.dbPath,
        `SELECT COUNT(*) as count FROM vocabulary v LEFT JOIN vocabulary_progress p ON v.word = p.word WHERE p.next_review_at IS NULL OR p.next_review_at <= ${now}`,
      )) || []) as { count: number }[];
      const [totalRow] = ((await executeSQL(this.dbPath, `SELECT COUNT(*) as count FROM vocabulary`)) || []) as {
        count: number;
      }[];
      const [masteredRow] = ((await executeSQL(
        this.dbPath,
        `SELECT COUNT(*) as count FROM vocabulary_progress WHERE proficiency >= 5`,
      )) || []) as { count: number }[];

      return {
        total: totalRow ? Number(totalRow.count ?? 0) : 0,
        due: dueRow ? Number(dueRow.count ?? 0) : 0,
        mastered: masteredRow ? Number(masteredRow.count ?? 0) : 0,
      };
    } catch (error) {
      console.error("Failed to get vocabulary review statistics:", error);
      return { total: 0, due: 0, mastered: 0 };
    }
  }

  /**
   * 获取数据库文件路径
   */
  public getDatabasePath(): string {
    return this.dbPath;
  }
}
