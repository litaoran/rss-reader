import React, { useCallback, useEffect, useState } from 'react';
import {
  NavigationContainer,
  DarkTheme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { type Article, type Feed, type SmartFeedId, DEFAULT_FEEDS } from '@antenna/shared';
import { initDb, listFeeds, addFeed, upsertArticles, updateFeedLastFetched } from './src/db';
import { fetchFeed } from './src/fetcher';
import FeedListScreen from './src/screens/FeedListScreen';
import ArticleListScreen from './src/screens/ArticleListScreen';
import ArticleScreen from './src/screens/ArticleScreen';

type RootStackParamList = {
  Feeds: undefined;
  Articles: { feed: Feed | SmartFeedId };
  Article: { articleId: number };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#000',
    card: '#1c1c1e',
    text: '#f5f5f7',
    primary: '#0a84ff',
  },
};

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function bootstrap() {
      try {
        console.log('[Antenna] initializing DB...');
        initDb();
        console.log('[Antenna] DB initialized');

        const feeds = listFeeds();
        console.log('[Antenna] existing feeds:', feeds.length);

        if (feeds.length === 0) {
          console.log('[Antenna] seeding default feeds...');
          await seedFeeds();
          console.log('[Antenna] seeding complete');
        }
        setReady(true);
      } catch (e: any) {
        console.error('[Antenna] bootstrap error:', e);
        setError(e.message || String(e));
        setReady(true); // show UI anyway so we can see the error
      }
    }
    bootstrap();
  }, []);

  const handleRefresh = useCallback(async () => {
    const feeds = listFeeds();
    for (const feed of feeds) {
      try {
        const parsed = await fetchFeed(feed.url);
        upsertArticles(feed.id, parsed.articles);
        updateFeedLastFetched(feed.id);
      } catch (e) {
        console.warn(`Failed to fetch ${feed.name}:`, e);
      }
    }
  }, []);

  if (!ready) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
          <StatusBar barStyle="light-content" />
          <Text style={{ color: '#8e8e93', fontSize: 17 }}>Loading feeds…</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      {error && (
        <View style={{ position: 'absolute', top: 60, left: 16, right: 16, zIndex: 999, backgroundColor: '#ff3b30', padding: 12, borderRadius: 8 }}>
          <Text style={{ color: '#fff', fontSize: 13 }}>{error}</Text>
        </View>
      )}
      <NavigationContainer theme={theme}>
        <Stack.Navigator
          screenOptions={{
            headerLargeTitle: true,
          }}
        >
          <Stack.Screen name="Feeds" options={{ title: 'Antenna' }}>
            {({ navigation }) => (
              <FeedListScreen
                onSelectFeed={feed => {
                  navigation.navigate('Articles', { feed });
                }}
                onRefresh={handleRefresh}
              />
            )}
          </Stack.Screen>

          <Stack.Screen
            name="Articles"
            options={({ route }) => ({
              title:
                typeof route.params.feed === 'object'
                  ? route.params.feed.name
                  : route.params.feed === 'all'
                  ? 'All Items'
                  : route.params.feed === 'starred'
                  ? 'Starred'
                  : 'Today',
            })}
          >
            {({ route, navigation }) => (
              <ArticleListScreen
                feed={route.params.feed}
                onSelectArticle={article => {
                  navigation.navigate('Article', { articleId: article.id });
                }}
                onRefresh={async () => {
                  const f = route.params.feed;
                  if (typeof f === 'object') {
                    // Refresh single feed
                    try {
                      const parsed = await fetchFeed(f.url);
                      upsertArticles(f.id, parsed.articles);
                      updateFeedLastFetched(f.id);
                    } catch (e) {
                      console.warn(`Failed to fetch ${f.name}:`, e);
                    }
                  } else {
                    // Smart feed — refresh all
                    await handleRefresh();
                  }
                }}
              />
            )}
          </Stack.Screen>

          <Stack.Screen
            name="Article"
            options={{ title: '', headerLargeTitle: false }}
          >
            {({ route }) => <ArticleScreen articleId={route.params.articleId} />}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

async function seedFeeds(): Promise<void> {
  for (const { url, name, folder } of DEFAULT_FEEDS) {
    const feed = addFeed(url, name, folder);
    try {
      const parsed = await fetchFeed(url);
      upsertArticles(feed.id, parsed.articles);
      updateFeedLastFetched(feed.id);
    } catch (e) {
      console.warn(`Seed failed for ${name}:`, e);
    }
  }
}
