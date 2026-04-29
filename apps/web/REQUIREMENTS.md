# Web フロントエンド要件

## 概要

複数の画像ファイル（JPEG / PNG）をアップロードし、1ページ1枚のA4 PDFに変換するWebアプリ。

---

## 機能要件

### 画像アップロード
- JPEG / PNG のみ受け付ける（`accept="image/jpeg, image/png"`）
- 複数ファイルの同時選択に対応
- iOS Safari 対応：`display: none` の input は使わず、`opacity: 0` + `position: absolute` で隠し、ボタンの `onClick` から `inputRef.current.click()` を呼ぶ
- iOS Safari 対応：`async` ハンドラー内で `e.target.files` が消える問題を防ぐため、イベント発火直後に `Array.from(e.target.files ?? [])` でコピーする

### 画像プレビュー
- アップロード後、グリッドレイアウトでカード形式に表示
- 各カードに表示するもの
  - ドラッグハンドル（カード上部）
  - 画像プレビュー（クリックでモーダル拡大表示）
  - 左回転 / 右回転ボタン（↺ / ↻）
  - 並び順を示す番号（1 始まり）

### 並び替え
- ドラッグ＆ドロップで順序変更（`@dnd-kit/sortable` を使用）
- `PointerSensor` に `activationConstraint: { distance: 5 }` を設定しクリックとドラッグを区別する

### 回転
- 90° 単位で左右に回転
- 表示は CSS `transform: rotate()` のみ（ピクセル操作なし）
- PDF生成時のみ canvas で描画変換を適用

### モーダル表示
- 画像クリックで拡大表示
- HTML `<dialog>` API（`showModal()`）を使用
- `::backdrop` は CSS ファイル（`ImageModal.css`）でスタイリング
- 閉じる方法：背景クリック / `Escape` キー（ネイティブ `cancel` イベント）
- モーダル表示中は `document.body.style.overflow = "hidden"` でスクロールをロック
- 90° / 270° 回転画像の表示：`maxWidth` と `maxHeight` で vw / vh を入れ替えて視覚的なはみ出しを防ぐ

### PDF生成
- A4（210 × 297 mm）、余白 10 mm
- 各画像をアスペクト比を保ってページ中央に配置
- 回転は canvas の `rotate()` で適用後、`ImageBitmap.close()` でメモリを即解放
- 画像は 1 枚ずつ逐次処理（`Effect.forEach` + `concurrency: 1`）

### PDF操作
- **PDF として保存**：`Uint8Array` を state に保持（将来の Box API アップロード用）
- **ダウンロード**：`jsPDF.save()` でブラウザダウンロードを起動
- 画像の変更・回転・並び替えが行われたら保存済み PDF をリセット

---

## 非機能要件

### メモリ管理
- `File` オブジェクトを state の正規データとして保持（dataURL は state に持たない）
- 表示には `URL.createObjectURL()` を使い、不要になったら `URL.revokeObjectURL()` で解放
- PDF生成時：`createImageBitmap(file)` でデコード → canvas に描画 → `bitmap.close()` で解放

### エラーハンドリング
- `effect` ライブラリを全面採用
- Effect の実行には `Effect.runPromiseExit()` を使用し、`Exit.isSuccess / isFailure` で分岐
- Typed failure（`ImageLoadError` / `PdfError`）と予期せぬ例外（defect）を両方捕捉して UI に表示
  - failure：`Cause.failureOption()` で取り出す
  - defect：`Cause.squash()` で取り出し `Error.message` を表示
- `ImageLoadError` にはファイル名（`fileName`）を含める
- `PdfError` にはファイル名（`fileName?`）と原因（`cause?`）を含める

### セキュアコンテキスト非対応環境への対応
- `crypto.randomUUID?.()` のオプショナルチェーンで HTTP + IP アドレスアクセス時のエラーを防ぐ
- フォールバック：`Math.random().toString(36).slice(2) + Date.now().toString(36)`

---

## ディレクトリ構成

```
src/
  lib/
    image.ts       # 画像読み込みロジック（loadImageItem, loadImageItems, revokeObjectUrl）
    pdf.ts         # PDF生成ロジック（buildPdf, downloadPdf）
  components/
    ImageCard.tsx  # プレビューカード（ドラッグ・回転・モーダル起動）
    ImageModal.tsx # モーダル（Dialog API）
    ImageModal.css # ::backdrop スタイル
  App.tsx          # 状態管理・ハンドラー・レイアウト
  vite-env.d.ts    # CSS import の型宣言
```

---

## 主要な型

```ts
// lib/image.ts
type ImageItem = {
  id: string
  file: File                    // 元データへの参照
  objectUrl: string             // 表示用 Object URL
  width: number
  height: number
  rotation: 0 | 90 | 180 | 270
}

// lib/pdf.ts
// buildPdf(items: ImageItem[]): Effect<Uint8Array, PdfError>
// downloadPdf(items: ImageItem[]): Effect<void, PdfError>
```

---

## 将来の予定

- `savedPdf: Uint8Array` を Box API 経由でアップロードする機能（`apps/api` 側に実装予定）
