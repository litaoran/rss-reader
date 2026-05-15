import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { type Article, type Feed, type SmartFeedId } from '@antenna/shared';
import { listArticles, markArticleRead, toggleArticleStar } from '../db';
import { StarIcon, DocumentIcon } from '../components/Icons';

interface Props {
  feed: Feed | SmartFeedId;
  onSelectArticle: (article: Article) => void;
  onRefresh?: () => Promise<void>;
}

export default function ArticleListScreen({ feed, onSelectArticle, onRefresh }: Props) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const showFeedName = typeof feed === 'string'; // only for smart feeds (all/starred/today)

  const load = useCallback(() => {
    const feedId = typeof feed === 'object' ? feed.id : null;
    const opts = {
      feedId,
      unreadOnly: false,
      starredOnly: feed === 'starred',
      todayOnly: feed === 'today',
      limit: 100,
      offset: 0,
    };
    setArticles(listArticles(opts));
  }, [feed]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    await onRefresh();
    load();
    setRefreshing(false);
  }, [onRefresh, load]);

  const handlePress = useCallback((article: Article) => {
    if (!article.isRead) {
      markArticleRead(article.id);
      setArticles(prev =>
        prev.map(a => a.id === article.id ? { ...a, isRead: true } : a)
      );
    }
    onSelectArticle(article);
  }, [onSelectArticle]);

  const handleToggleStar = useCallback((article: Article) => {
    toggleArticleStar(article.id);
    setArticles(prev =>
      prev.map(a => a.id === article.id ? { ...a, isStarred: !a.isStarred } : a)
    );
  }, []);

  return (
    <View style={styles.container}>
      <FlatList
        data={articles}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [
              styles.card,
              pressed && styles.cardPressed,
            ]}
            onPress={() => handlePress(item)}
          >
            {/* Unread indicator bar */}
            {!item.isRead && <View style={styles.unreadBar} />}

            <View style={styles.cardContent}>
              {/* Top row: feed name (smart feeds only) + time */}
              <View style={styles.topRow}>
                {showFeedName && (
                  <Text style={styles.feedLabel} numberOfLines={1}>
                    {item.feedName}
                  </Text>
                )}
                <Text style={styles.timeLabel}>
                  {formatDate(item.publishedAt)}
                </Text>
              </View>

              {/* Title */}
              <Text
                style={[styles.title, item.isRead && styles.titleRead]}
                numberOfLines={2}
              >
                {item.title}
              </Text>

              {/* Summary — skip if it looks like raw URLs/metadata */}
              {item.summary && !looksLikeMetadata(item.summary) ? (
                <Text style={styles.summary} numberOfLines={2}>
                  {item.summary}
                </Text>
              ) : null}

              {/* Bottom row: meta + star */}
              <View style={styles.bottomRow}>
                <View style={styles.metaRow}>
                  {item.author ? (
                    <>
                      <Text style={styles.meta} numberOfLines={1}>
                        {item.author}
                      </Text>
                      <Text style={styles.metaDot}>·</Text>
                    </>
                  ) : null}
                  <Text style={styles.meta}>{item.readTimeMin} min</Text>
                </View>
                <Pressable
                  onPress={() => handleToggleStar(item)}
                  hitSlop={12}
                  style={styles.starButton}
                  accessibilityLabel={item.isStarred ? 'Unstar article' : 'Star article'}
                  accessibilityRole="button"
                >
                  <StarIcon
                    size={18}
                    color={item.isStarred ? '#ff9f0a' : '#48484a'}
                    filled={item.isStarred}
                  />
                </Pressable>
              </View>
            </View>
          </Pressable>
        )}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#8e8e93"
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <DocumentIcon size={48} color="#3a3a3c" />
            <Text style={styles.emptyTitle}>No articles</Text>
            <Text style={styles.emptySubtitle}>Pull to refresh to fetch new content</Text>
          </View>
        }
      />
    </View>
  );
}

/** Return true if text is mostly URLs or metadata rather than readable prose */
function looksLikeMetadata(text: string): boolean {
  if (!text || text.length < 10) return true;
  // If the text starts with "Article URL:" or is mostly URLs
  if (/^(Article URL:|Comments URL:|https?:\/\/)/i.test(text.trim())) return true;
  // If >50% of the text is URLs
  const urlFree = text.replace(/https?:\/\/\S+/g, '');
  if (urlFree.trim().length < text.length * 0.3) return true;
  return false;
}

function formatDate(ts: number): string {
  if (ts === 0) return '';
  const now = new Date();
  const diff = now.getTime() - ts;

  if (diff < 60 * 1000) return 'now';
  if (diff < 60 * 60 * 1000) {
    return `${Math.floor(diff / 60000)}m`;
  }
  if (diff < 24 * 60 * 60 * 1000) {
    return `${Math.floor(diff / 3600000)}h`;
  }
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    return `${Math.floor(diff / 86400000)}d`;
  }
  const d = new Date(ts);
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  // Card
  card: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  unreadBar: {
    width: 3,
    backgroundColor: '#0a84ff',
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  cardContent: {
    flex: 1,
    padding: 14,
  },

  // Top row
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  feedLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#0a84ff',
    flex: 1,
    marginRight: 8,
  },
  timeLabel: {
    fontSize: 13,
    color: '#636366',
  },

  // Title
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f5f5f7',
    lineHeight: 21,
    marginBottom: 4,
  },
  titleRead: {
    color: '#8e8e93',
    fontWeight: '400',
  },

  // Summary
  summary: {
    fontSize: 14,
    color: '#636366',
    lineHeight: 19,
    marginBottom: 4,
  },

  // Bottom row
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  meta: {
    fontSize: 13,
    color: '#636366',
  },
  metaDot: {
    fontSize: 13,
    color: '#48484a',
    marginHorizontal: 5,
  },
  starButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Empty state
  empty: {
    alignItems: 'center',
    paddingTop: 120,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#636366',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#48484a',
    marginTop: 6,
    textAlign: 'center',
  },
});
