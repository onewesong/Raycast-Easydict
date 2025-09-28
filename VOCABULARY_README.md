# 🎯 Easydict 生词本功能 (SQLite 版本)

## ✨ 功能特性

Easydict 扩展现已支持 SQLite 数据库驱动的生词本功能，提供更强大的词汇管理体验。

### 🚀 主要特性

- **📊 SQLite 数据库存储**：使用 SQLite 数据库而非文本文件，性能更好，支持复杂查询
- **🔍 全文搜索**：支持按单词或翻译内容进行模糊搜索
- **📈 索引优化**：数据库索引提供快速查询性能
- **🛡️ 数据完整性**：UNIQUE 约束防止重复单词，事务确保数据一致性
- **📝 完整信息记录**：记录单词、翻译、音标、语言对、备注、时间戳等
- **🎨 现代化 UI**：在 Raycast 中提供直观的生词本管理界面

## 🎮 使用方法

### 1. 添加单词到生词本

1. 在 Raycast 中搜索 "Easydict" 或 "Search Word"
2. 输入要查询的单词（例如：`hello`）
3. 在翻译结果中点击右侧的 "Actions" 按钮（或按 `⌘ + K`）
4. 选择 "Add to Vocabulary Book" 选项
5. 系统会显示成功提示，生词已保存到数据库

### 2. 查看生词本

1. 在 Raycast 中搜索 "Vocabulary Book"
2. 选择 "Vocabulary Book" 命令
3. 浏览你保存的所有生词
4. 使用搜索框按单词或翻译内容筛选
5. 点击单词可复制内容或进行管理操作

### 3. 管理生词

在生词本界面中，你可以：

- **🔍 搜索**：输入关键词搜索生词
- **📋 复制**：复制单词或翻译内容
- **❌ 删除**：移除不需要的生词
- **🧹 清空**：清空所有生词（需确认）
- **🔄 刷新**：重新加载生词列表

## 💾 数据存储

### 数据库位置

```
~/.easydict/vocabulary.db
```

### 数据库结构

```sql
CREATE TABLE vocabulary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,    -- 主键ID
  word TEXT NOT NULL UNIQUE,               -- 单词（唯一）
  translation TEXT,                        -- 翻译
  phonetic TEXT,                           -- 音标
  from_language TEXT,                      -- 源语言
  to_language TEXT,                        -- 目标语言
  note TEXT,                              -- 备注
  created_at INTEGER NOT NULL,            -- 创建时间戳
  updated_at INTEGER NOT NULL             -- 更新时间戳
);
```

### 索引

- `idx_vocabulary_word`: 单词索引（快速查找）
- `idx_vocabulary_created_at`: 时间索引（快速排序）

## 🛠️ 技术实现

### 架构设计

```
src/vocabulary/
├── database.ts      # SQLite 数据库管理器
├── wordbook.ts      # 生词本业务逻辑
└── vocabulary-book.tsx  # 生词本 UI 界面
```

### 核心类

1. **DatabaseManager**: 数据库操作封装
   - 单例模式管理数据库连接
   - 自动创建表和索引
   - 提供 CRUD 操作接口

2. **VocabularyManager**: 生词本业务逻辑
   - 基于 DatabaseManager 提供高级 API
   - 处理数据验证和业务规则
   - 提供搜索、去重等功能

3. **VocabularyBookCommand**: Raycast UI 组件
   - 响应式搜索和列表显示
   - 集成操作面板（复制、删除等）

### 数据流程

```
用户输入 → 翻译查询 → 添加到生词本 → 存储到 SQLite → UI 显示
    ↑              ↓                    ↓
    └─ 搜索显示 ←──┘                    └─ 数据库查询
```

## 🔧 开发与维护

### 本地测试

```bash
# 安装依赖
npm install

# 构建项目
npm run build

# 启动开发模式
npm run dev

# 初始化测试数据
node init-db.js
```

### 数据库操作

```javascript
import { VocabularyManager } from "./src/vocabulary/wordbook";

const vocabularyManager = VocabularyManager.getInstance();

// 添加生词
await vocabularyManager.addVocabulary({
  word: "hello",
  translation: "你好",
  phonetic: "həˈloʊ",
  fromLanguage: "en",
  toLanguage: "zh-CHS",
  note: "基本问候",
});

// 搜索生词
const results = await vocabularyManager.searchVocabulary("hello");

// 删除生词
await vocabularyManager.removeVocabulary("hello");
```

## 🚀 未来改进

- [ ] 批量导入/导出功能
- [ ] 生词复习提醒
- [ ] 生词分类和标签
- [ ] 学习进度统计
- [ ] 云端同步支持

## 📝 更新日志

### v1.0.0

- ✅ SQLite 数据库集成
- ✅ 全文搜索功能
- ✅ 现代化 UI 界面
- ✅ 完整的数据管理功能

---

💡 **提示**: 生词本数据完全存储在本地，不涉及任何网络传输，保护你的隐私安全。
