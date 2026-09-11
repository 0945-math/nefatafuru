# ネファタフル (Hnefatafl) - ヴァイキングチェス

ヴァイキング時代の非対称戦略ボードゲームをAIと対戦できるWebアプリです。

## 🎮 遊び方

1. **陣営を選択**: 攻撃側（24駒）または防御側（12駒 + 王）
2. **難易度を選択**: 簡単 / 普通 / 難しい
3. **ゲーム開始**: ルールに従って駒を移動

### ルール

- **攻撃側の目的**: 王を四方から囲んで捕獲
- **防御側の目的**: 王を四隅のいずれかに脱出させる
- **駒の動き**: チェスのルークのように縦横に何マスでも移動
- **捕獲**: 敵駒を両側からはさむと捕獲
- **王の特別ルール**: 王座と四隅には王のみ入れる

## 🚀 GitHub Pagesへのデプロイ方法

### 手順

1. **リポジトリを作成**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```

2. **GitHubリポジトリの設定**
   - リポジトリの「Settings」→「Pages」を開く
   - 「Source」で「GitHub Actions」を選択

3. **自動デプロイ**
   - `main`ブランチにプッシュすると自動的にデプロイされます
   - デプロイ完了後、`https://YOUR_USERNAME.github.io/YOUR_REPO/` でアクセス可能

### ローカル開発

```bash
# 依存関係のインストール
npm install

# 開発サーバー起動
npm run dev

# ビルド
npm run build

# プレビュー
npm run preview
```

## 🤖 AIについて

モンテカルロ木探索（MCTS）- AlphaGo方式を実装しています。

- **UCB1式**による探索と活用のバランス
- **プレイアウト**によるシミュレーション
- **評価関数**による局面評価
- 難易度に応じて反復回数を調整（200〜3000回）

## 📱 機能

- ✅ PWA対応（ホーム画面に追加可能）
- ✅ オフライン対応
- ✅ ハプティックフィードバック
- ✅ サウンドエフェクト
- ✅ レスポンシブデザイン
- ✅ ダークテーマ

## 🛠️ 技術スタック

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Web Audio API
- Service Worker

## 📄 ライセンス

MIT License
