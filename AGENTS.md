# AGENTS.md

At session start, the owner-facing host must load and follow agentflow via supported skill discovery, honoring explicit owner opt-outs. If unavailable, report it; never assume paths or install it. Delegates follow assignments without activating agentflow.

Read agentflow's `references/project-rules.md` from the resolved skill or exact host-supplied text, then `.agentflow/rules.md` if present; unavailable baseline defers shared-record writes and invariant/review acceptance. Report the gap and continue independent authorized work. Reading rules does not activate agentflow.

---

# 專案指引｜Guitar Toolbox Script

本專案是在 **Scripting app**（iOS / iPadOS）上執行的**吉他工具腳本集**：目前有和弦速查／進行／練習、音階（瀏覽、把位 1–5 找音與認音）、節奏（刷弦與指彈）；調音器、移調、五度圈等為構想。

本文件供所有 AI agent 與協作者遵循。人類導向的介紹請見 [README.md](README.md)。

> **語言慣例**：說明文字使用繁體中文（台灣）；程式識別字、commit 訊息、型別與檔名使用英文。樂理術語依下方〈術語對照〉。

---

## 1. 目標與範圍

- 目標平台：iPhone 與 iPad，**iOS / iPadOS 27**（含 Scripting app 支援的最新 API）。
- 每個工具是一支獨立、可在離線狀態使用的腳本；共用邏輯放在 domain 層。
- 不新增與吉他演奏、練習、編曲無關的功能。
- 不加入追蹤、分析或需要登入的服務，除非擁有者明確要求。

## 2. 架構：DDD + Functional Programming

依賴方向**只能由外向內**：`ui → app → domain`，`infra → domain`。`domain` 不得 import 其他層。

```
scripts/src/
├─ domain/    純函式、不可變資料、值物件、代數資料型別。無 I/O、無 Scripting API
├─ app/       use case：組合 domain 函式與 port（介面），表達「使用者想做什麼」
├─ infra/     副作用邊界：儲存、音訊、觸覺、剪貼簿、檔案；實作 app 定義的 port
└─ ui/        Scripting 的 TSX 畫面；只負責呈現與事件轉發
```

> **現況**：程式目前集中在單一檔案 `GuitarToolbox/index.tsx`（約 3,200 行，版本字串 `APP_VERSION`），以區塊註解分成 Domain / Application / Infrastructure / UI。`scripts/src/` 是**遷移目標**，尚未建立。
>
> 在拆檔之前，請在 `GuitarToolbox/index.tsx` 內遵守同樣的依賴方向；新增程式碼時按區塊歸位，不要把副作用寫進 Domain 區塊。拆檔屬於獨立工作，需先取得擁有者同意。

### 2.0 現有功能與對應區塊（`GuitarToolbox/index.tsx`）

| 分頁（TabView） | 內容 | Domain 型別／函式（節錄） |
|---|---|---|
| 和弦 | 和弦速查、和弦進行、和弦練習 | `Chord`、`ChordQuality`、`FinderVoicing`、`resolveFingering` |
| 音階 | 分段選單三頁：瀏覽（可依把位篩選）、找音、認音；共用主音、音階類型與把位（`scalePickers`） | `ScaleDef`、`SCALES`；`ScalePositionNo`、`scalePositionRange`、`Zone`、`zoneOf`、`scaleTonePositions`、`chordTonePositions` |
| 節奏 | 刷弦與指彈節奏型態、播放 | `Stroke`、`PickRole`、`RhythmPattern`、`PlayPlan`、`NoteEvent` |
| 設定（Sheet） | 指板樣式、聲音、觸覺偏好 | `DiagramPrefs`、`DEFAULT_PREFS` |

副作用皆已集中在 Infrastructure：`Storage`（偏好，key 帶版本號如 `fretboard.prefs.v2`）、`synth`（Karplus-Strong 合成 → WAV 暫存檔 → `AVPlayer`）、觸覺回饋。**新增的儲存 key 須帶版本號**，改格式時保留舊 key 的讀取遷移（見 `LEGACY_*_KEY`）。

### 2.4 工具鏈與已知限制

- 要發佈的腳本放在 `GuitarToolbox/`（含 `script.json` 與進入點 `index.tsx`，符合 Scripting 文件）；型別外殼、`package.json`、`tsconfig.json` 與 `.agentflow/` 留在根目錄，不會被匯入。型別檢查：`npm install` 後執行 `npm run typecheck`（TypeScript 7，`strict`）。提交前必須通過。
- Scripting 未公開 npm 型別套件，因此 `types/scripting.d.ts` 是**最小型別外殼**：畫面元件的 props 一律放寬為 `any`，**不會被檢查**；Domain／Application／Infrastructure 的型別則完全有效。`GuitarToolbox/index.tsx` 新用到 `scripting` 的名稱或全域 API 時，須同步補在此檔，並以官方文件為準，不得憑空宣告。
- 單元測試：Vitest（`npm test`），測試放在 `tests/`。`scripting` 以 `tests/scripting-stub.ts` 替身載入；`GuitarToolbox/index.tsx` 檔尾的 `export { … }` 區塊只供測試匯入，新增要測的純函式時一併加入。尚無建置腳本；新增前請先與擁有者確認工具鏈。

### 2.1 Bounded Context（限界上下文）

| Context | 中文 | 核心概念 |
|---|---|---|
| `pitch` | 音高 | `PitchClass`、`Note`、`Interval`、`Frequency`、`Cents` |
| `tuning` | 調弦 | `Tuning`、`StringSpec`、`Capo`、`TuningDeviation` |
| `harmony` | 和聲 | `Chord`、`ChordQuality`、`Scale`、`Mode`、`Key`、`DiatonicChord` |
| `fretboard` | 指板 | `Fret`、`FretPosition`、`Voicing`、`Fingering`、`Barre` |
| `rhythm` | 節奏 | `Tempo`、`TimeSignature`、`Subdivision`、`Metronome` |
| `notation` | 記譜 | `Tab`（六線譜）、`ChordChart`（和弦圖） |

各 context 內部自成一體；跨 context 只透過明確的型別與函式匯出（`index.ts`）溝通，不互相深入存取內部檔案。

### 2.2 Functional Programming 規則

1. **Domain 層只有純函式**：同樣輸入必得同樣輸出，不讀時間、不亂數、不讀寫儲存。需要時間或亂數時，由呼叫端傳入。
2. **不可變**：資料型別使用 `readonly`；更新時回傳新值，不得 mutate 參數。
3. **用型別表達領域**：
   - 以 discriminated union 表達狀態，例如 `type Accidental = 'sharp' | 'flat' | 'natural'`。
   - 以 branded type 區分易混淆的數值，例如 `Cents`、`Hz`、`FretNumber`、`Bpm`。
   - 以 smart constructor 建立值物件，建立時驗證不變條件。
4. **不丟例外表達預期失敗**：使用 `Result<E, A>`（或 `Option<A>`）。例外只用於真正的程式錯誤。
5. **組合優先於繼承**：domain 內不使用 `class`；以小函式搭配 `pipe` / `flow` 組合。
6. **副作用推到邊界**：infra 與 ui 才能有副作用；app 層以 port（函式型別）注入依賴。
7. **全面性檢查**：對 union 使用 exhaustive `switch`，並以 `assertNever` 收尾。
8. **函式小而具名**：一個函式一個意圖；名稱使用領域詞彙（見下節）。

### 2.3 DDD 規則

- **通用語言（Ubiquitous Language）**：程式、文件、UI 文案使用同一套詞彙。新增概念前先查〈術語對照〉，沒有就先補表再寫程式。
- **值物件**取代原始型別（primitive obsession）：不要到處傳 `number` 表示音高或琴格。
- **不變條件放在建構處**：例如琴格不得為負、BPM 必須在合理範圍、同一條弦同一時間只能有一個按位。
- **Domain 事件／結果以資料表達**，不以 callback 或隱含狀態。
- 禁止在 domain 引入 `scripting` 模組、`fetch`、`Date.now()`、`Math.random()`。

## 3. 術語對照（台灣樂理用語）

程式識別字用英文；UI 與文件用右欄。**不使用中國大陸用語**（例如「吉他和弦」不寫成「和絃」、「音程」不寫成「音階間距」）。

### 音高與記號

| English（識別字） | 繁體中文（台灣） |
|---|---|
| pitch / pitch class | 音高／音級（音名類別） |
| note name | 音名（C D E F G A B） |
| solfège / movable do | 唱名／首調唱名法 |
| sharp ♯ / flat ♭ / natural ♮ | 升記號／降記號／還原記號 |
| enharmonic | 同音異名（如 C♯ 與 D♭） |
| octave | 八度 |
| semitone / whole tone | 半音／全音 |
| interval | 音程 |
| minor 2nd / major 2nd | 小二度／大二度 |
| perfect 5th | 完全五度 |
| tritone | 三全音（增四度／減五度） |
| cents | 音分（cent） |
| frequency / A4 = 440 Hz | 頻率／標準音 A4 = 440 Hz |

### 調與音階

| English | 繁體中文（台灣） |
|---|---|
| key / key signature | 調／調號 |
| major / minor | 大調／小調 |
| scale / scale degree | 音階／音級（度數） |
| natural minor / harmonic minor / melodic minor | 自然小調／和聲小調／旋律小調 |
| pentatonic scale | 五聲音階 |
| blues scale | 藍調音階 |
| mode | 調式 |
| Ionian / Dorian / Phrygian | 伊奧尼安（大調音階）／多利安／弗里吉安 |
| Lydian / Mixolydian / Aeolian / Locrian | 利地安／米索利地安／伊奧利安（自然小音階）／洛克利安 |
| tonic | 主音 |
| scale degree | 音級（程式中以 `degree` 表示） |
| circle of fifths | 五度圈 |
| transpose | 移調 |
| modulate | 轉調 |
| relative / parallel key | 關係調／同名調 |

### 和弦

| English | 繁體中文（台灣） |
|---|---|
| chord | 和弦 |
| root / bass note | 根音／低音 |
| triad | 三和弦 |
| major / minor / diminished / augmented triad | 大三和弦／小三和弦／減三和弦／增三和弦 |
| seventh chord | 七和弦 |
| dominant 7th / major 7th / minor 7th | 屬七和弦／大七和弦／小七和弦 |
| half-diminished (m7♭5) | 半減七和弦 |
| sus2 / sus4 | 掛留二和弦／掛留四和弦 |
| slash chord (C/E) | 分數和弦（轉位或指定低音） |
| inversion | 轉位 |
| diatonic chord | 順階和弦 |
| Roman numeral analysis | 級數（羅馬數字）標記 |
| chord progression | 和弦進行 |
| voicing / fingering shape | 按法（和弦配置）／指型 |
| arpeggio | 琶音（分解和弦） |
| scale position (`ScalePosition`) | 把位（音階在指板上的五個區域；程式中避免與指板上的點 `Position` 混淆） |
| open chord | 開放和弦 |
| barre chord | 封閉和弦（橫按） |

### 吉他與指板

| English | 繁體中文（台灣） |
|---|---|
| string（1st–6th） | 弦（第一弦～第六弦；一弦為最細） |
| fret / fretboard | 琴格（品）／指板 |
| open string | 空弦 |
| nut / bridge | 琴枕（上弦枕）／琴橋 |
| tuning / standard tuning | 調弦／標準調弦（E A D G B E） |
| Drop D / Half-step down | Drop D 調弦／降半音調弦 |
| capo | 移調夾 |
| tuner | 調音器 |
| fingering | 指法 |
| fingerstyle / strumming / picking | 指彈／刷弦／撥弦 |
| down-stroke / up-stroke / muted stroke | 下刷／上刷／悶音切刷 |
| rhythm pattern (strum) | 刷法（節奏型態） |
| hammer-on / pull-off | 搥弦／勾弦 |
| bend / slide / vibrato | 推弦／滑音／顫音 |
| harmonic | 泛音 |
| palm mute | 悶音（手掌悶音） |

### 節奏與記譜

| English | 繁體中文（台灣） |
|---|---|
| tempo / BPM | 速度／每分鐘拍數（BPM） |
| time signature | 拍號 |
| beat / measure (bar) | 拍／小節 |
| subdivision | 拍子細分 |
| metronome | 節拍器 |
| tablature (TAB) | 六線譜（TAB 譜） |
| staff notation | 五線譜 |
| chord chart / chord diagram | 和弦譜／和弦圖 |

> **一致性**：程式與 UI 既有用語（主音、音級、按法、橫按／封閉和弦、斜線和弦、琶音、刷弦、指彈、悶音）為準。「斜線和弦」與「分數和弦」、「橫按」與「封閉和弦」目前並用，新增文案請固定採用：**斜線和弦**、**封閉和弦（橫按）**。「掃弦」在吉他另指 sweep picking，描述刷奏時請用「刷弦」。
>
> 新增術語時，補在對應表格並保持兩欄一致。不確定台灣慣用說法時，以教育部《音樂名詞》與台灣常用吉他教材為準，並在 PR / 筆記本中註明來源。

## 4. UI：iOS / iPadOS 27 設計指引

遵循 Apple Human Interface Guidelines 於 iOS / iPadOS 27 的最新版本，並沿用 Liquid Glass 設計語言。**以系統元件為先，不自繪仿製。**

> **設計系統**：本章指引落實成的代幣、對比表、無障礙規則與檢查清單見 [docs/design-system.md](docs/design-system.md)；新增或修改畫面前先讀它，並保持兩者一致。

- **系統元件優先**：使用 Scripting 提供的 SwiftUI 對應元件（`NavigationStack`、`List`、`Form`、`TabView`、`Picker`、`Toggle`、`Button`、`Sheet` 等），不手刻導覽列、分頁列或彈出視窗。
- **語意色彩與材質**：使用系統語意色（如 `label`、`secondaryLabel`、`systemBackground`、`tint`），自動支援淺色／深色模式。不寫死十六進位色碼，除非是指板、和弦圖等必須精準呈現的領域圖形，且仍須通過對比檢查。
- **動態字級（Dynamic Type）**：文字使用語意字級（`title`、`headline`、`body`、`caption`），版面在最大字級下不得截斷或重疊。
- **無障礙**：
  - 所有可互動元件有 `accessibilityLabel`；圖形化指板與和弦圖提供文字替代（例如「第三琴格，第五弦，音名 C」）。
  - 不單靠顏色傳達資訊；對比符合 WCAG AA。
  - 支援 VoiceOver、減少動態效果（Reduce Motion）與增強對比。
- **點擊目標**至少 44 × 44 pt。
- **iPad 版面**：使用自適應版面（`NavigationSplitView`、大小類別 size class），支援分割檢視（Split View）、Stage Manager 與多視窗，直向與橫向皆可用。指板類畫面在橫向應善用寬度。
- **觸覺回饋**：調弦到位、節拍重拍等關鍵時機使用系統觸覺，不濫用。
- **動態與轉場**：使用系統預設動畫；尊重「減少動態效果」。
- **文案**：預設繁體中文（`zh-TW`），並提供英文（`en`）在地化；字串集中管理，不內嵌於畫面邏輯。
- **本機優先**：核心功能不依賴網路；偏好設定存本機，離線可用。
- **隱私**：麥克風（調音器）等權限只在使用時請求，並說明用途。

### 4.1 iOS / iPadOS 27 重點（依 Apple 設計資源「What's new」）

以下僅列 Apple 官方頁面明確記載的更新（2026-06 至 2026-11），細節請閱讀對應 HIG 頁面：

- **Liquid Glass**：App 圖示與 Color、Buttons、Toolbars、Tab bars 的 Liquid Glass 指引已更新。工具列與分頁列交給系統繪製，**不要自行疊加玻璃效果**。
- **Tab bars**：術語與圖例已更新；`TabView` 保持 3–5 個分頁，各以 SF Symbols 圖示加簡短標籤。
- **Search**：「搜尋作為分頁」（search as a tab）的指引已更新；若新增搜尋（如和弦速查），優先採用系統搜尋樣式。
- **Sidebars**：側邊欄圖示顏色與可調式（adaptable）側邊欄樣式指引已更新；iPad 以 `NavigationSplitView` 為準。
- **Scroll views**：捲動邊緣效果（scroll edge effects）指引已更新；不要遮蓋或自繪邊緣漸層。
- **Menus**：選單項目圖示指引已更新。
- **Layout / Branding**：Layout 指引更新；品牌色須克制使用，系統元件維持系統色。
- **Pointing devices / Gestures**：iPadOS 指標裝置與觸控手勢指引已更新；iPad 外接鍵盤與觸控板應可操作主要功能。
- **SF Symbols 27** 提供 7,000 個以上符號、九種字重、三種比例。
- 另有 iOS / iPadOS 27 的 Figma 與 Sketch 設計套件可參考。

### 4.2 Scripting app 對應 API（依官方文件）

文件入口：<https://scriptingapp.github.io/>，頁面路徑格式為 `/guide/<Section>/<Page>`。

- **進入點與呈現**：`GuitarToolbox/index.tsx`；以 `Navigation.present({ element })` 呈現，關閉後必須呼叫 `Script.exit()` 避免記憶體洩漏（現有程式已照做）。
- **匯入**：所有元件與 API 皆從 `"scripting"` 匯入；支援 `useState`、`useEffect`、`useReducer`、`useCallback`、`useMemo`、`useContext`。
- **導覽**：`NavigationStack`、`TabView`、`NavigationSplitView`（iPad 雙欄／三欄）。
- **裝置與版面**：`Device`（`isiPad`、`isiPhone`、`screen`、`colorScheme`、`orientation`、`isLandscape`）、`GeometryReader`、`EnvironmentValuesReader`。文件**未提及** `useWindowSize`，請勿假設存在。
- **儲存與檔案**：`Storage`、`FileManager`、`Path`。
- **音訊與觸覺**：`AVPlayer`、`Audio Engine`、`HapticFeedback`。
- **其他**：`Dialog`、`Notification`、`Pasteboard`、`ShareSheet`、`Toolbars`、`Search`、`Menu`。

> **版面尺寸**：最外層以 `GeometryReader` 取得視窗實際尺寸，交給 `computeLayout`（純函式）換算成 `Layout`；因此分割檢視與 Stage Manager 會依視窗而非螢幕切換版面。**不要**再用 `Device.screen` 判斷版面。`GeometryReader` 尚未回報尺寸時使用 `FALLBACK_SIZE`。
>
> **使用原則**：實作前先查官方文件頁面；文件未載明的 API 一律視為不可用，並先在實機驗證。若 HIG 與 Scripting 實際可用元件有差異，以 Scripting 實際可用者為準，並記錄於筆記本。

### 4.3 參考資料

- Apple 設計資源更新紀錄：<https://developer.apple.com/design/whats-new/>
- Apple Human Interface Guidelines：<https://developer.apple.com/design/human-interface-guidelines/>（頁面需瀏覽器渲染，自動抓取只會得到標題）
- Scripting 文件：<https://scriptingapp.github.io/>；文件索引：<https://scriptingapp.github.io/llms.txt>

## 5. 程式碼風格

- 語言：TypeScript（`strict` 開啟）＋ TSX；`npm run typecheck` 必須零錯誤。
- 檔名：`kebab-case.ts`；型別與元件：`PascalCase`；函式與變數：`camelCase`；常數：`SCREAMING_SNAKE_CASE`。
- 一個檔案一個主要概念；domain 檔案不超過約 200 行，超過就拆分。
- 匯出明確的公開 API（各 context 的 `index.ts`）；不使用預設匯出於 domain。
- 避免 `any`；必要時用 `unknown` 搭配型別守衛。
- 註解寫「為什麼」，不重複「做什麼」。樂理上的不明顯規則（如同音異名的選擇）須加註解。
- 生成檔案（bundle 產物）檔頭標示 `GENERATED`，**不得手動編輯**，請改來源。

## 6. 測試與驗證

- **Domain 層必須有單元測試**，以表格化案例涵蓋樂理正確性，例如：
  - 音程計算：C → G 為完全五度。
  - 和弦組成：Cmaj7 = C E G B。
  - 同音異名：升降記號的選擇符合所在調。
  - 移調夾：移調夾第 3 格後，G 型指法實際發出 B♭ 和弦。
  - 調音：A4 = 440 Hz，偏差以音分表示且四捨五入規則明確。
- 對可逆運算使用 property-based 測試（例如移調後再反向移調應回到原值）。
- infra / ui 以手動驗證為主：在實機或模擬器的 Scripting app 檢查 iPhone 與 iPad、淺色與深色、最大字級、VoiceOver。
- 提交前確認：`npm run typecheck` 通過、測試通過、無新增 `any`、術語與對照表一致。

## 7. 工作流程（agentflow）

- 本專案以 agentflow 管理開發紀錄：設定在 `.agentflow/ag.json`，筆記本為 `.agentflow/guitar-toolbox-script.devlog.md`。
- 開始工作前先讀筆記本最新的 Ask 與 STATUS；不要手動覆寫他人的所有權標記（`*.owner`）。
- 範圍外的想法放入 `.agentflow/backlog.md`，不要直接實作。
- 已接受的長期保證放入 `.agentflow/sys-invariants.md`，異動須在回覆中明列。

## 8. 版本號碼與 commit

版本採語意化版本 `MAJOR.MINOR.PATCH`，目前為 `0.0.x` 開發階段。**每次 commit 都要檢查並視需要調整版本號碼**：

| 變更內容 | 調整 |
|---|---|
| 修正錯誤、調整文案、重構、不影響使用者的內部變更 | `PATCH` +1 |
| 新增或移除使用者可見的功能、儲存格式變更 | `MINOR` +1，`PATCH` 歸零 |
| 第一個穩定版本 | 擁有者決定後升為 `1.0.0` |
| 只改文件、設定或開發紀錄，且 app 行為完全不變 | 可不調整，並在 commit 訊息註明 |

版本號碼須**同步**更新四處：`GuitarToolbox/index.tsx` 的 `APP_VERSION`（設定頁顯示）、`GuitarToolbox/script.json` 的 `version`（Scripting 更新依此判斷）、`package.json` 的 `version`、`package-lock.json` 的 `version`（根項目兩處）。commit 訊息標題建議附上新版本，例如 `feat: 把位練習 (0.1.0)`。

## 9. 發佈

- 發佈方式為 GitHub release 的 ZIP 加匯入連結，做法見 [README.md](README.md#安裝install)。官方文件沒有商店或審核流程。
- 不要用 GitHub 資料夾網址當匯入來源：未登入的 GitHub API 每小時有上限，使用者會看到「github requests are limited」。
- 發佈新版的步驟（推送與建立 release 皆需擁有者同意）：
  1. 依第 8 章調整版本號碼並 commit、推送。
  2. 在 `GuitarToolbox/` 內打包：`zip -X -r GuitarToolbox.zip script.json index.tsx`（`script.json` 與 `index.tsx` 放在 ZIP 根層，不含 `.DS_Store`）。
  3. `gh release create v<版本> GuitarToolbox.zip --target <commit>`；資產檔名固定為 `GuitarToolbox.zip`，README 的 `releases/latest/download/GuitarToolbox.zip` 才會永遠指向最新版。
  4. 下載該網址，確認內容與本機 ZIP 一致。
- 被匯入的資料夾必須含 `script.json` 與 `index.tsx`。`script.json` 欄位（`name`、`description`、`version`、`icon`、`color`）參考擁有者另一個已可匯入的專案；文件未載明完整格式，**不要自行新增未確認的欄位**。`remoteResource` 的雜湊由 app 維護，不要手寫。
- 發佈前須在實機確認：匯入成功、啟動正常；若使用者開啟「每個腳本單獨授權」，`FileManager` 暫存檔與音訊播放是否需要 `fileSystem` 權限（官方文件未載明）。
- 推送、建立 release 或變更遠端設定需擁有者同意。

## 10. 禁止事項

- 不在 domain 層寫副作用或引入 Scripting API。
- 不使用中國大陸慣用樂理譯名；不混用同一概念的多種譯名。
- 不手動編輯 `GENERATED` 檔案。
- 不提交密鑰、個資或未授權的第三方素材（樂譜、音源）。
- 未經擁有者同意，不 force push、不改寫歷史。
