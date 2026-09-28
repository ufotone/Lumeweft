# Lumeweft キャラクターファイル仕様 / Character Files

## 日本語

Lumeweft CANVASでは、MiniMax H3で同じ役者を繰り返し利用するための、持ち運び可能な`.char`キャラクターファイルを作成・再利用できます。このコンテナはOmniChar / Inline Studioの`INLINECHAR`形式バージョン1と互換です。

### CANVASフロー

`.char`作成と動画生成は、キャラ固定LoRAのように同じ役者を複数ショットで再利用できるよう、2つの独立フローに分かれています。

CANVASで **H3 Character Builder (.char)** を開きます。顔画像を最低1枚指定し、必要に応じて2枚目の顔、全身、衣装の参照画像を追加します。「Locked Character Description」には、すべてのショットで維持したい顔立ち、髪型、体格、衣装、色、特徴を記述します。

**Create .char Actor** を実行すると、`.char`ファイルがプロジェクトの`assets/characters`へ保存され、`Assets / CANVAS / Characters`にも登録されます。

作成されるファイルには、先頭メンバーとして`manifest.json`、`refs/`以下に元のPNG参照画像、各画像の役割情報（`face`、`body`、`cloth`）、`text/description.md`に固定説明が保存されます。元画像と説明文がキャラクターの正本です。初期版では、モデル固有のペイロードや同一人物判定用のスコアリングキャッシュは保存しません。

OmniCharで作成した既存の`.char`は、CANVASの **Character File** ノードから読み込めます。Lumeweftはファイル署名と形式バージョンを検証し、同じ元画像と固定説明を使用します。

### 軽量H3への置き換え

役者動画ノードは、Lumeweftに既存の`minimax-h3-ref2va-Q4_0.gguf`、Q4テキストエンコーダー、対応するRef2VA PDD 8-step LoRA、Euler/simpleサンプリング、任意のSageAttentionを再利用します。24GB級GPUを対象にしたOmniCharのnative FP8モデル＋32Bエンコーダー構成とは別系統です。

実行時には最大9枚の参照画像を使用します。顔の同一性を最優先し、次に全身と衣装が含まれるよう自動で選択します。選択した画像はH3の番号付き画像としてアップロードされ、各画像の役割、キャラクター名、固定説明、同一人物を維持するための制約がショットプロンプトの前に自動挿入されます。参照動画は不要です。

Q4版でも現時点の分類は最低VRAM 16GB／推奨24GBです。実際の生成品質とピークVRAMは、利用するGPU環境での確認が必要です。

### 使い方

1. CANVASの新規フローから **H3 Character Builder (.char)** を選びます。
2. **Face Reference 1** に正面寄りの顔画像を設定します。
3. 必要に応じて、2枚目の顔、全身、衣装画像を設定します。
4. **Locked Character Description** に固定したい特徴を書きます。
5. **Create .char Actor** を実行し、キャラクターファイルを作成します。
6. 別の新規フローとして **H3 Fixed Characte (.char) movie** を開きます。
7. **Character File (.char)** で作成済みの`.char`を選びます。
8. **Shot Prompt** にそのショット固有の動作、場所、カメラ、音声を記述します。
9. **H3 Fixed Characte (.char) movie** を実行します。同じ`.char`を別のMovieフローや別ショットでも繰り返し選択できます。

Movieフローには最初から **Character File (.char)** ノードがあり、プロジェクトへ保存済みの`.char`を選択できます。空のCANVASなどで再利用する場合は、ノードパレットから **Character File** を追加して動画ノードの **Fixed Character** 入力へ接続します。外部のOmniChar `.char`は **Import OmniChar .char** から読み込めます。

### 現在の範囲と制限

- `.char`の作成と再利用は、まずCANVASに実装されています。
- Directorのキャスト機能は、将来同じキャラクター素材と代表顔画像を参照できます。ファイル形式を変更する必要はありません。
- YuNetによる顔検出、SFaceの同一人物重心、DINOv2による全身・衣装スコアリング、生成結果からの参照収集、学習済みアダプターはまだ含まれません。
- 参照画像を増やしても、学習済みLoRAのように完全な固定を保証するものではありません。ショット構成、遮蔽、極端な角度によって同一性が低下する場合があります。

---

## English

Lumeweft CANVAS can create and reuse portable `.char` actors for MiniMax H3. The container is compatible with OmniChar / Inline Studio `INLINECHAR` format version 1.

## CANVAS flow

Character creation and movie generation are separate flows so one actor can be reused across shots like a character-locking LoRA. Open **H3 Character Builder (.char)**, assign at least one face image, and optionally add a second face, a body reference and a clothing reference. The locked description should record details that must survive every shot. Running **Create .char Actor** saves the file under the project `assets/characters` directory and registers it in `Assets / CANVAS / Characters`.

Open **H3 Fixed Characte (.char) movie** to generate. Select the saved actor in **Character File (.char)**, enter the shot-specific action, location, camera and audio in **Shot Prompt**, then run the movie node. The same `.char` can be selected again in additional flows and shots.

The generated file stores `manifest.json` first, original PNG references under `refs/`, role metadata (`face`, `body`, `cloth`) and `text/description.md`. Original references and text are the source of truth. Model-specific payloads and identity-scoring caches are intentionally omitted in this first Lumeweft implementation.

Existing OmniChar `.char` files can be loaded with a **Character File** CANVAS node. Lumeweft validates the signature and reads the same original references and description.

## Lightweight H3 adaptation

The actor video node reuses Lumeweft's `minimax-h3-ref2va-Q4_0.gguf` path, Q4 text encoder, matched Ref2VA PDD 8-step LoRA, Euler/simple sampling and optional SageAttention. It is intentionally separate from OmniChar's native FP8 model and 32B encoder recipe that targets a 24 GB-class GPU.

At execution, Lumeweft selects up to nine references with face identity first, then body and clothing coverage. It uploads them as numbered H3 pictures and prepends role-specific identity constraints plus the locked character description to the shot prompt. No reference video is required.

The Q4 path is still categorized as a 16 GB minimum / 24 GB recommended local workflow. GPU generation quality and actual peak VRAM remain to be verified on the user's machine.

## Current boundary

- `.char` creation and reuse are implemented in CANVAS first.
- Director cast integration can later point at the same character asset type and representative face image without changing the file format.
- YuNet face detection, SFace identity centroids, DINOv2 body/clothing scoring, harvesting and trained adapters are not included yet.
- Reference conditioning improves consistency but does not guarantee the same degree of locking as a trained LoRA. Occlusion, extreme angles and shot composition can still reduce identity consistency.
