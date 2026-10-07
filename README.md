# save -a ~
Linuxコマンド学習ゲーム「save -a ~」（save all of Tilde）

> save -a ~ ― save all of Tilde

ターミナルの中の村で、本物のLinuxコマンド（`ls` `cd` `cat` …）を使って物語を進める謎解きゲーム。

## 遊ぶ

https://rayoguma.github.io/Moribito/

ブラウザで開くだけで遊べます（セーブは遊んでいるブラウザに保存されます）。

## 開発

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # 第0章の通しプレイなどのテスト
npm run build    # 公開用のファイルを dist/ に作る
npm run script   # シナリオ（scenario/*.yaml）から台本 docs/chapters/*_script.md を書き出す
```

`main` に push すると、GitHub Actions がテスト → ビルド → GitHub Pages への公開を自動で行います。

## 資料

- [設計書](docs/design.md) — 画面・セーブ・公開などの方針
- [ストーリー](docs/story.md) — 全10章の骨組み
- [第0章の設計](docs/chapters/ch0.md) と [台本](docs/chapters/ch0_script.md)

## クレジット

- 制作: RayOguma
- 音楽: [もみじばミュージック](https://music.storyinvention.com/)
  - 水平線を見据えて／仲間１／仲間２／水上のダンス／アラブの砂漠／よろずや道中／妖精の森のワルツ／不気味な塔／時の風／湖上の社／レクイエム／悠久の空へ／復活の祈り２／エンディング・テーマ
- 効果音: [OtoLogic](https://otologic.jp)（[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)）
  - Church Bell03-11 (Far-Low-Mid)／Clock-Second Hand02-3 (Dry-Loop)

※音楽は「もみじばミュージック」のフリーBGMを使用しています。`public/bgm/` の音楽・効果音の著作権は、それぞれの制作者にあります。このリポジトリから取り出して、ほかの用途に使うことはできません。使いたい場合は、各サイトの利用規約にしたがって、元のサイトから入手してください。
