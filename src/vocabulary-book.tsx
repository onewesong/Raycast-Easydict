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
import { useEffect, useState } from "react";
import { VocabularyManager, VocabularyItem } from "./vocabulary/wordbook";

export default function VocabularyBookCommand() {
  const [vocabularyList, setVocabularyList] = useState<VocabularyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    loadVocabularyList();
  }, []);

  const loadVocabularyList = async () => {
    setIsLoading(true);
    try {
      const vocabularyManager = VocabularyManager.getInstance();
      const items = await vocabularyManager.getVocabularyList();
      setVocabularyList(items);
    } catch {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to load vocabulary",
        message: "Could not load vocabulary book",
      });
    } finally {
      setIsLoading(false);
    }
  };

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
        // 重新加载列表
        await loadVocabularyList();
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

  const filteredList = vocabularyList.filter(
    (item) =>
      item.word.toLowerCase().includes(searchText.toLowerCase()) ||
      (item.translation && item.translation.toLowerCase().includes(searchText.toLowerCase())),
  );

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

      {filteredList.map((item) => (
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
              <Action title="Refresh List" icon={Icon.ArrowClockwise} onAction={loadVocabularyList} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
