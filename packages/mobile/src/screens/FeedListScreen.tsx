import React, { useCallback, useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { type Feed } from '@antenna/shared';
import { listFeeds } from '../db';
import { LayersIcon, StarIcon, TodayIcon, ChevronIcon } from '../components/Icons';

interface FeedSection {
  title: string;
  data: Feed[];
}

interface Props {
  onSelectFeed: (feed: Feed | 'all' | 'starred' | 'today') => void;
  onRefresh: () => Promise<void>;
}

export default function FeedListScreen({ onSelectFeed, onRefresh }: Props) {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadFeeds = useCallback(() => {
    setFeeds(listFeeds());
  }, []);

  useEffect(() => {
    loadFeeds();
  }, [loadFeeds]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await onRefresh();
    loadFeeds();
    setRefreshing(false);
  }, [onRefresh, loadFeeds]);

  // Group feeds into sections by folder
  const sections: FeedSection[] = [];
  const folderMap = new Map<string, Feed[]>();
  const uncategorized: Feed[] = [];

  for (const feed of feeds) {
    if (feed.folder) {
      const list = folderMap.get(feed.folder) || [];
      list.push(feed);
      folderMap.set(feed.folder, list);
    } else {
      uncategorized.push(feed);
    }
  }

  for (const [folder, folderFeeds] of folderMap) {
    sections.push({ title: folder, data: folderFeeds });
  }
  if (uncategorized.length > 0) {
    sections.push({ title: 'Feeds', data: uncategorized });
  }

  const totalUnread = feeds.reduce((sum, f) => sum + f.unreadCount, 0);

  const smartFeedsHeader = (
    <View style={styles.smartFeeds}>
      <SmartFeedRow
        icon={<LayersIcon size={18} color="#fff" />}
        iconBg="#0a84ff"
        label="All Items"
        count={totalUnread}
        onPress={() => onSelectFeed('all')}
      />
      <SmartFeedRow
        icon={<StarIcon size={16} color="#fff" filled />}
        iconBg="#ff9f0a"
        label="Starred"
        onPress={() => onSelectFeed('starred')}
      />
      <SmartFeedRow
        icon={<TodayIcon size={18} color="#fff" />}
        iconBg="#30d158"
        label="Today"
        onPress={() => onSelectFeed('today')}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={item => String(item.id)}
        ListHeaderComponent={smartFeedsHeader}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title.toUpperCase()}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [
              styles.feedRow,
              pressed && styles.feedRowPressed,
            ]}
            onPress={() => onSelectFeed(item)}
          >
            {item.faviconUrl ? (
              <Image source={{ uri: item.faviconUrl }} style={styles.favicon} />
            ) : (
              <View style={[styles.favicon, styles.faviconPlaceholder]}>
                <Text style={styles.faviconLetter}>
                  {item.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={styles.feedName} numberOfLines={1}>
              {item.name}
            </Text>
            {item.unreadCount > 0 && (
              <View style={styles.badgeContainer}>
                <Text style={styles.badgeText}>{item.unreadCount}</Text>
              </View>
            )}
            <ChevronIcon size={18} color="#48484a" />
          </Pressable>
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#8e8e93"
          />
        }
        stickySectionHeadersEnabled={false}
        contentInsetAdjustmentBehavior="automatic"
      />
    </View>
  );
}

function SmartFeedRow({
  icon,
  iconBg,
  label,
  count,
  onPress,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  count?: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.smartFeedRow,
        pressed && styles.smartFeedRowPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[styles.smartFeedIconContainer, { backgroundColor: iconBg }]}>
        {icon}
      </View>
      <Text style={styles.smartFeedLabel}>{label}</Text>
      {count != null && count > 0 && (
        <View style={styles.badgeContainer}>
          <Text style={styles.badgeText}>{count}</Text>
        </View>
      )}
      <ChevronIcon size={18} color="#48484a" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  // Smart feeds
  smartFeeds: {
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2c2c2e',
  },
  smartFeedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    minHeight: 44,
  },
  smartFeedRowPressed: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  smartFeedIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  smartFeedLabel: {
    flex: 1,
    fontSize: 17,
    color: '#f5f5f7',
    fontWeight: '400',
  },

  // Section headers
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 28,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8e8e93',
    letterSpacing: 0.8,
  },

  // Feed rows
  feedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    minHeight: 44,
  },
  feedRowPressed: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  favicon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    marginRight: 12,
  },
  faviconPlaceholder: {
    backgroundColor: '#1c1c1e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  faviconLetter: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8e8e93',
  },
  feedName: {
    flex: 1,
    fontSize: 17,
    color: '#f5f5f7',
  },

  // Badges
  badgeContainer: {
    backgroundColor: '#1c1c1e',
    borderRadius: 10,
    minWidth: 22,
    height: 20,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    marginRight: 6,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8e8e93',
  },
});
