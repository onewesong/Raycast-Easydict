import { Action, ActionPanel, Detail, Icon, showToast, Toast } from "@raycast/api";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReviewResult,
  VocabularyManager,
  VocabularyReviewItem,
  VocabularyReviewStatistics,
  MAX_PROFICIENCY,
} from "./vocabulary/wordbook";

interface ReviewState {
  queue: VocabularyReviewItem[];
  stats?: VocabularyReviewStatistics;
  index: number;
  showAnswer: boolean;
  isLoading: boolean;
  isProcessing: boolean;
}

const PROFICIENCY_LABELS = ["未掌握", "初识", "巩固中", "熟练", "掌握", "精通"];

export default function VocabularyReviewCommand() {
  const vocabularyManager = useMemo(() => VocabularyManager.getInstance(), []);
  const [state, setState] = useState<ReviewState>({
    queue: [],
    index: 0,
    showAnswer: false,
    isLoading: true,
    isProcessing: false,
  });

  const currentItem = state.queue[state.index];

  const loadQueue = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      const [queue, stats] = await Promise.all([
        vocabularyManager.getReviewQueue(50, true),
        vocabularyManager.getReviewStatistics(),
      ]);
      setState((prev) => ({
        ...prev,
        queue,
        stats,
        index: 0,
        showAnswer: false,
        isLoading: false,
        isProcessing: false,
      }));
    } catch (error) {
      console.error("Failed to load vocabulary review queue:", error);
      await showToast({ style: Toast.Style.Failure, title: "加载失败", message: "无法获取复习队列" });
      setState((prev) => ({ ...prev, isLoading: false, isProcessing: false }));
    }
  }, [vocabularyManager]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const handleReveal = () => {
    setState((prev) => ({ ...prev, showAnswer: !prev.showAnswer }));
  };

  const handleSkip = () => {
    if (state.isProcessing) return;
    if (state.queue.length <= 1) {
      setState((prev) => ({ ...prev, showAnswer: false }));
      return;
    }
    setState((prev) => ({
      ...prev,
      index: (prev.index + 1) % prev.queue.length,
      showAnswer: false,
    }));
  };

  const handleReview = async (result: ReviewResult) => {
    if (!currentItem || state.isProcessing) return;
    setState((prev) => ({ ...prev, isProcessing: true }));
    try {
      const updated = await vocabularyManager.applyReviewResult(currentItem.word, result);
      if (!updated) {
        await showToast({ style: Toast.Style.Failure, title: "更新失败", message: "无法保存复习结果" });
      } else {
        const successText =
          result === "remember" ? "已标记为记住" : result === "hard" ? "已标记为较难" : "已标记为忘记";
        await showToast({ style: Toast.Style.Success, title: successText });
      }
    } catch (error) {
      console.error("Failed to apply review result:", error);
      await showToast({ style: Toast.Style.Failure, title: "复习失败", message: "请稍后重试" });
    } finally {
      await loadQueue();
    }
  };

  const handleRefresh = async () => {
    await loadQueue();
    await showToast({ style: Toast.Style.Success, title: "已刷新队列" });
  };

  const markdown = getMarkdown(currentItem, state.showAnswer);
  const metadata = getMetadata(state.stats, currentItem);

  return (
    <Detail
      markdown={markdown}
      isLoading={state.isLoading}
      metadata={metadata}
      actions={
        <ActionPanel>
          {currentItem ? (
            <>
              <Action
                title={state.showAnswer ? "隐藏释义" : "显示释义"}
                icon={state.showAnswer ? Icon.EyeDisabled : Icon.Eye}
                onAction={handleReveal}
              />
              <ActionPanel.Section title="复习结果">
                <Action title="记住" icon={Icon.Checkmark} onAction={() => void handleReview("remember")} />
                <Action title="较难" icon={Icon.Hourglass} onAction={() => void handleReview("hard")} />
                <Action
                  title="忘记了"
                  icon={Icon.XmarkCircle}
                  style={Action.Style.Destructive}
                  onAction={() => void handleReview("forget")}
                />
              </ActionPanel.Section>
              <ActionPanel.Section>
                <Action title="跳过本词" icon={Icon.ArrowRight} onAction={handleSkip} />
              </ActionPanel.Section>
            </>
          ) : (
            <Action title="无法操作" icon={Icon.Hourglass} onAction={() => undefined} />
          )}
          <ActionPanel.Section>
            <Action title="刷新队列" icon={Icon.ArrowClockwise} onAction={() => void handleRefresh()} />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}

function getMarkdown(item: VocabularyReviewItem | undefined, showAnswer: boolean): string {
  if (!item) {
    return "## 🎉 暂无需要复习的生词\n\n尝试稍后再来，或先通过查词命令添加更多生词。";
  }

  const lines: string[] = [`# ${item.word}`];
  if (item.phonetic) {
    lines.push(`/${item.phonetic}/`);
  }

  if (showAnswer) {
    const translation = item.translation?.trim() ?? "暂无释义";
    lines.push("\n**释义**\n");
    lines.push(translation);

    if (item.note) {
      lines.push("\n**备注**\n");
      lines.push(`> ${item.note}`);
    }
  } else {
    lines.push("\n_选择“显示释义”或按快捷键查看答案_\n");
  }

  return lines.join("\n\n");
}

function getMetadata(stats: VocabularyReviewStatistics | undefined, item: VocabularyReviewItem | undefined) {
  if (!stats && !item) {
    return undefined;
  }

  const proficiencyLabel = item ? (PROFICIENCY_LABELS[item.proficiency] ?? `Lv.${item.proficiency}`) : undefined;

  return (
    <Detail.Metadata>
      {stats && (
        <>
          <Detail.Metadata.Label title="待复习" text={`${stats.due}`} />
          <Detail.Metadata.Label title="总生词" text={`${stats.total}`} />
          <Detail.Metadata.Label title="已掌握" text={`${stats.mastered}`} />
        </>
      )}
      {item && (
        <>
          <Detail.Metadata.Separator />
          <Detail.Metadata.Label
            title="熟练度"
            text={`${item.proficiency}/${MAX_PROFICIENCY} ${proficiencyLabel ?? ""}`}
          />
          <Detail.Metadata.Label title="复习次数" text={`${item.reviewCount}`} />
          <Detail.Metadata.Label title="成功次数" text={`${item.successCount}`} />
          <Detail.Metadata.Label title="遗忘次数" text={`${item.failCount}`} />
          <Detail.Metadata.Label title="上次复习" text={formatDate(item.lastReviewedAt)} />
          <Detail.Metadata.Label title="下次复习" text={formatDate(item.nextReviewAt)} />
        </>
      )}
    </Detail.Metadata>
  );
}

function formatDate(timestamp?: number) {
  if (!timestamp) {
    return "--";
  }
  return new Date(timestamp).toLocaleString();
}
