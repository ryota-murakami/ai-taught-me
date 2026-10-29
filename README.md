# AIに教えてもらった

AIとの会話を、そのままの見た目で残しておくブログ。

**Live:** https://ryota-murakami.github.io/ai-taught-me/

チャット画面（OpenClaw Control UI のダークテーマ）そっくりの「会話スナップショット」として、AI とのやりとりを残しています。
ユーザー側のメッセージは音声入力のことが多く、誤変換も含めて原文のまま載せています。

## 仕組み

- 素の HTML + CSS + JavaScript だけ。フレームワーク・ビルド・npm 依存はありません。
- 記事は `posts/<slug>.md`。ブラウザがそれを読み込み、`assets/md.js` の小さな Markdown レンダラーでチャット風に描画します（HTML は常にエスケープされます）。
- 一覧・カレンダー・タグ検索は `posts/index.json` を元にクライアント側で絞り込みます。
- `.nojekyll` があるので、GitHub Pages は `.md` を変換せずにそのまま配信します。

```
index.html          一覧（記事カード / カレンダー / タグ検索）
post.html           記事ページ（post.html?slug=<slug>）
assets/md.js        Markdown レンダラー・記事パーサー・コピーボタン
assets/app.js       一覧ページのロジック
assets/post.js      記事ページのロジック
assets/style.css    スタイル
posts/index.json    記事一覧のメタデータ
posts/<slug>.md     記事本文（会話）
```

## 記事の追加方法

### 1. `posts/<slug>.md` を置く

先頭にフロントマター、その後にメッセージを `<!-- message ... -->` コメントで区切って並べます。
本文は Markdown（見出し・太字・箇条書き・番号付きリスト・表・コードブロック・インラインコード・リンク・引用）。
段落内の改行はそのまま改行として表示されます。

```markdown
---
title: 記事タイトル
slug: 2026-11-01-some-topic
date: 2026-11-01
tags: [タグ1, タグ2]
summary: 一覧に出る一行説明
---

<!-- message role=user author="Ryota Murakami" time="2026-11-01T09:00:00+09:00" -->
ユーザーの発言（音声入力ならそのまま）

<!-- message role=assistant author="どらちゃん" time="2026-11-01T09:01:00+09:00" -->
AI の返答。**Markdown** が使えます。
```

- `role` は `user` か `assistant`。
- `time` は ISO 8601。表示は書かれた時刻（`HH:MM`）をそのまま使います。
- ファイル名は `slug` と同じにしてください（`posts/2026-11-01-some-topic.md`）。

### 2. `posts/index.json` にエントリを足す

```json
{
  "slug": "2026-11-01-some-topic",
  "title": "記事タイトル",
  "date": "2026-11-01",
  "tags": ["タグ1", "タグ2"],
  "summary": "一覧に出る一行説明",
  "messageCount": 2,
  "ai": "どらちゃん（Claude Opus 5.5 via OpenClaw）",
  "note": "（任意）記事の冒頭に出る注記"
}
```

並び順は `date` の新しい順に自動で並びます。`main` に push すれば GitHub Pages に反映されます。

## ローカルで見る

```sh
python3 -m http.server 8000
# → http://localhost:8000/
```

（`file://` で直接開くと `fetch` が使えないので、簡易サーバー経由で開いてください。）

## メモ

- カレンダーは「今月」を表示するシンプルなモックです。会話がある日が色付きになり、クリックするとその日の記事に絞り込みます。‹ › で月を移動できます。
- 絞り込み条件は URL（`?tag=数学&date=2026-10-30&q=証明`）に反映されるので、そのまま共有できます。
