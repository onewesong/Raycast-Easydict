/*
 * @author: tisfeng
 * @createTime: 2025-01-28 10:00
 * @lastEditor: tisfeng
 * @lastEditTime: 2025-01-28 10:00
 * @fileName: vocabularyBook.tsx
 *
 * 生词本查看界面
 */

import { Action, ActionPanel, Icon, List, showToast, Toast } from "@raycast/api";
import { useMemo, useState } from "react";
import { VocabularyManager, VocabularyItem } from "./vocabulary/wordbook";
import { useSQL } from "@raycast/utils";
import { homedir } from "os";
import { join } from "path";

export default function VocabularyBookCommand() {
  const [searchText, setSearchText] = useState("");

  const DB_PATH = useMemo(() => join(homedir(), ".easydict", "vocabulary.db"), []);

  const baseSelect = `SELECT word, translation, phonetic,
    from_language as fromLanguage,
    to_language as toLanguage,
    note, created_at as timestamp
    FROM vocabulary`;

  const escapeLike = (s: string) => s.replaceAll("'", "''");
  const query = useMemo(() => {
    if (!searchText) return `${baseSelect} ORDER BY created_at DESC`;
    const p = escapeLike(searchText);
    return `${baseSelect} WHERE word LIKE '%${p}%' OR translation LIKE '%${p}%' ORDER BY created_at DESC`;
  }, [searchText]);

  const { data, isLoading, permissionView, revalidate } = useSQL<VocabularyItem>(DB_PATH, query, {
    permissionPriming: "用于读取/管理生词本数据库",
  });

  if (permissionView) {
    return permissionView;
  }

  const removeVocabulary = async (word: string) => {
    try {
      const vocabularyManager = VocabularyManager.getInstance();
      const success = await vocabularyManager.removeVocabulary(word);

      if (success) {
        await showToast({
          style: Toast.Style.Success,
          title: "Removed from Vocabulary Book",
          message: `"${word}" has been removed`,
        });
        await revalidate();
      } else {
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to Remove",
          message: `Failed to remove "${word}"`,
        });
      }
    } catch {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to Remove",
        message: `Failed to remove "${word}"`,
      });
    }
  };

  const filteredList = useMemo(() => (data || []) as VocabularyItem[], [data, query]);

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <List
      isLoading={isLoading}
      searchText={searchText}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search vocabulary..."
    >
      {filteredList.length === 0 && !isLoading && (
        <List.EmptyView
          title="No Vocabulary Found"
          description={searchText ? "No vocabulary matches your search" : "Your vocabulary book is empty"}
          icon={Icon.Book}
        />
      )}

      {filteredList.map((item: VocabularyItem) => (
        <List.Item
          key={`${item.word}-${item.timestamp}`}
          title={item.word}
          subtitle={item.translation}
          accessories={[{ text: item.phonetic || "" }, { text: formatTimestamp(item.timestamp) }]}
          actions={
            <ActionPanel>
              <Action.CopyToClipboard title="Copy Word" content={item.word} />
              <Action.CopyToClipboard title="Copy Translation" content={item.translation || ""} />
              <Action
                title="Remove from Vocabulary Book"
                icon={Icon.Trash}
                style={Action.Style.Destructive}
                onAction={() => removeVocabulary(item.word)}
              />
              <Action title="Refresh List" icon={Icon.ArrowClockwise} onAction={revalidate} />
              <Action
                title="Clear All Vocabulary"
                icon={Icon.Trash}
                style={Action.Style.Destructive}
                onAction={async () => {
                  const vocabularyManager = VocabularyManager.getInstance();
                  const success = await vocabularyManager.clearAllVocabulary();

                  if (success) {
                    await showToast({
                      style: Toast.Style.Success,
                      title: "Vocabulary Cleared",
                      message: "All vocabulary has been removed",
                    });
                    await revalidate();
                  } else {
                    await showToast({
                      style: Toast.Style.Failure,
                      title: "Failed to Clear",
                      message: "Failed to clear vocabulary",
                    });
                  }
                }}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
