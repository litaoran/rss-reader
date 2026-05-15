import React, { useCallback, useEffect, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import WebView from 'react-native-webview';
import { type ArticleWithContent } from '@antenna/shared';
import { getArticle, toggleArticleStar } from '../db';
import { StarIcon, ExternalLinkIcon } from '../components/Icons';

interface Props {
  articleId: number;
}

function buildHtml(content: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    background: #000;
    color: #e5e5e7;
    font-family: -apple-system, system-ui, sans-serif;
    font-size: 17px;
    line-height: 1.7;
    padding: 0 20px 60px;
    -webkit-text-size-adjust: 100%;
    overflow-x: hidden;
  }
  h1, h2, h3, h4, h5, h6 {
    color: #f5f5f7;
    margin: 28px 0 12px;
    line-height: 1.3;
    font-weight: 600;
  }
  h1 { font-size: 24px; }
  h2 { font-size: 20px; }
  h3 { font-size: 18px; }
  p { margin: 0 0 16px; }
  a {
    color: #0a84ff;
    text-decoration: none;
  }
  a:active { opacity: 0.7; }
  img {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    margin: 16px 0;
    display: block;
  }
  pre, code {
    font-family: 'SF Mono', Menlo, monospace;
    font-size: 14px;
  }
  pre {
    background: #1c1c1e;
    padding: 16px;
    border-radius: 10px;
    overflow-x: auto;
    margin: 16px 0;
    line-height: 1.5;
  }
  code {
    background: #1c1c1e;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 15px;
  }
  pre code {
    background: none;
    padding: 0;
    border-radius: 0;
    font-size: 14px;
  }
  blockquote {
    border-left: 3px solid #2c2c2e;
    padding-left: 16px;
    margin: 16px 0;
    color: #8e8e93;
    font-style: italic;
  }
  ul, ol { padding-left: 24px; margin: 12px 0; }
  li { margin: 6px 0; }
  hr {
    border: none;
    border-top: 1px solid #2c2c2e;
    margin: 24px 0;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
    font-size: 15px;
  }
  th, td {
    border: 1px solid #2c2c2e;
    padding: 10px;
    text-align: left;
  }
  th {
    background: #1c1c1e;
    color: #f5f5f7;
    font-weight: 600;
  }
  figure { margin: 16px 0; }
  figcaption {
    font-size: 14px;
    color: #636366;
    text-align: center;
    margin-top: 8px;
  }
  /* Hide RSS cruft */
  .feedflare, .mf-viral { display: none !important; }
</style>
</head>
<body>${content}</body>
</html>`;
}

export default function ArticleScreen({ articleId }: Props) {
  const [article, setArticle] = useState<ArticleWithContent | null>(null);
  const [webViewHeight, setWebViewHeight] = useState(400);
  const { width: screenWidth } = useWindowDimensions();

  useEffect(() => {
    const a = getArticle(articleId);
    setArticle(a);
  }, [articleId]);

  const onWebViewMessage = useCallback((event: any) => {
    const height = Number(event.nativeEvent.data);
    if (height > 0) setWebViewHeight(height);
  }, []);

  const heightScript = `
    (function() {
      function postHeight() {
        const h = document.documentElement.scrollHeight;
        window.ReactNativeWebView.postMessage(String(h));
      }
      // Initial
      postHeight();
      // After images load
      document.querySelectorAll('img').forEach(img => {
        img.addEventListener('load', postHeight);
        img.addEventListener('error', postHeight);
      });
      // Fallback
      setTimeout(postHeight, 500);
      setTimeout(postHeight, 1500);
    })();
    true;
  `;

  if (!article) {
    return (
      <View style={styles.container}>
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>!</Text>
          <Text style={styles.emptyText}>Article not found</Text>
        </View>
      </View>
    );
  }

  const handleStar = () => {
    toggleArticleStar(article.id);
    setArticle(prev => prev ? { ...prev, isStarred: !prev.isStarred } : prev);
  };

  const handleOpenInBrowser = () => {
    Linking.openURL(article.url);
  };

  const hasHtmlContent = article.content && /<[a-z][\s\S]*>/i.test(article.content);
  const htmlSource = hasHtmlContent
    ? { html: buildHtml(article.content) }
    : null;

  return (
    <ScrollView
      style={styles.container}
      contentInsetAdjustmentBehavior="automatic"
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.feedName}>{article.feedName}</Text>
        <Text style={styles.title}>{article.title}</Text>

        <View style={styles.metaRow}>
          {article.author ? (
            <Text style={styles.metaText}>{article.author}</Text>
          ) : null}
          {article.author && article.publishedAt > 0 && (
            <Text style={styles.metaDot}>·</Text>
          )}
          {article.publishedAt > 0 && (
            <Text style={styles.metaText}>
              {new Date(article.publishedAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          )}
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.metaText}>{article.readTimeMin} min read</Text>
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          <Pressable
            onPress={handleStar}
            style={({ pressed }) => [
              styles.actionButton,
              article.isStarred && styles.actionButtonActive,
              pressed && styles.actionButtonPressed,
            ]}
            accessibilityLabel={article.isStarred ? 'Unstar article' : 'Star article'}
            accessibilityRole="button"
          >
            <StarIcon
              size={16}
              color={article.isStarred ? '#ff9f0a' : '#8e8e93'}
              filled={article.isStarred}
            />
            <Text style={[
              styles.actionText,
              article.isStarred && styles.actionTextActive,
            ]}>
              {article.isStarred ? 'Starred' : 'Star'}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleOpenInBrowser}
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.actionButtonPressed,
            ]}
            accessibilityLabel="Open in Safari"
            accessibilityRole="button"
          >
            <ExternalLinkIcon size={16} color="#0a84ff" />
            <Text style={[styles.actionText, { color: '#0a84ff' }]}>
              Safari
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Article body */}
      {htmlSource ? (
        <WebView
          source={htmlSource}
          style={[styles.webView, { height: webViewHeight, width: screenWidth }]}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
          injectedJavaScript={heightScript}
          onMessage={onWebViewMessage}
          onShouldStartLoadWithRequest={(request) => {
            if (request.url !== 'about:blank' && request.navigationType === 'click') {
              Linking.openURL(request.url);
              return false;
            }
            return true;
          }}
          originWhitelist={['*']}
        />
      ) : (
        <View style={styles.content}>
          <Text style={styles.contentText} selectable>
            {article.summary || stripHtml(article.content)}
          </Text>
        </View>
      )}

      {/* Bottom spacer */}
      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  // Header
  header: {
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2c2c2e',
  },
  feedName: {
    fontSize: 14,
    color: '#0a84ff',
    fontWeight: '600',
    marginBottom: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#f5f5f7',
    lineHeight: 32,
    letterSpacing: -0.3,
  },

  // Meta
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 14,
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: '#636366',
  },
  metaDot: {
    fontSize: 13,
    color: '#48484a',
    marginHorizontal: 2,
  },

  // Actions
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#1c1c1e',
    borderRadius: 20,
    minHeight: 36,
  },
  actionButtonActive: {
    backgroundColor: 'rgba(255,159,10,0.12)',
  },
  actionButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8e8e93',
  },
  actionTextActive: {
    color: '#ff9f0a',
  },

  // Content
  webView: {
    backgroundColor: '#000',
  },
  content: {
    padding: 20,
  },
  contentText: {
    fontSize: 17,
    lineHeight: 28,
    color: '#e5e5e7',
    letterSpacing: 0.1,
  },

  // Empty
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 120,
  },
  emptyIcon: {
    fontSize: 36,
    color: '#3a3a3c',
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 17,
    color: '#636366',
    marginTop: 12,
  },
});
