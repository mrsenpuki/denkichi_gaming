# Alley Messenger

Three.js と WebGL で動く、手描き調の路地をWASDで歩き回る三人称ゲームです。

## 操作

- `WASD` / `Arrow keys`: 移動
- `Shift`: 走る
- `Space`: ジャンプ
- `E`: 車に乗る / 降りる
- `G`: 操作中の主人公/車の前方に安全の門を生成
- ドラッグ: カメラ回転
- `Esc`: 一時停止

車で安全の門を破壊するとスコアが増えます。連続で破壊するとコンボ倍率が上がり、一定時間破壊しないと `x1` に戻ります。

手紙を拾って、光っている `DELIVER` マーカーへ行くと配達成功です。配達するとスコアと配達数が増え、次の目的地が選ばれます。
画面左の `Objective` 表示と頭上の黄色い矢印が、次に向かう手紙または配達地点を示します。

## 起動

ローカルサーバーで開きます。

```powershell
node server.js
```

ブラウザで `http://127.0.0.1:8022` を開きます。

## GitHub Pages で公開

このプロジェクトは静的サイトとして公開できます。

1. GitHubで新しいリポジトリを作成します。
2. このフォルダをリポジトリにpushします。
3. GitHubのリポジトリ画面で `Settings` → `Pages` を開きます。
4. `Build and deployment` の `Source` を `GitHub Actions` にします。
5. `Actions` タブで `Deploy GitHub Pages` が成功すると、PagesのURLでゲームを開けます。

公開に必要な主なファイルは `index.html`, `styles.css`, `src/`, `vendor/`, `assets/`, `.nojekyll`, `.github/workflows/deploy-pages.yml` です。スクショ、zip、一時フォルダは `.gitignore` で除外しています。

## 構成

- `index.html`: 画面構造
- `styles.css`: レイアウトと見た目
- `src/main.js`: Three.js のゲームロジック
- `vendor/three.module.js`: Three.js 本体
- `server.js`: ES module 用のローカルサーバー
- `assets/kenney/car/sedan.glb`: Kenney Car Kit の車モデル
- `assets/kenney/car/`: Kenney Car Kit の車両・箱・デブリ
- `assets/kenney/city/`: Kenney City Kit の建物・日よけ・パラソル
