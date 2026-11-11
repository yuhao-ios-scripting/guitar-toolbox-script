# 設計系統｜Guitar Toolbox Script

本文件把 [AGENTS.md 第 4 章](../AGENTS.md#4-uiios--ipados-27-設計指引)的設計指引落實成可檢查的規則。程式中的對應常數與函式都在 `GuitarToolbox/index.tsx`，並由 `tests/domain.test.ts` 的「設計系統」測試守住。

> 原則：**系統元件優先，不自繪仿製**。只有指板、和弦圖、節奏圖這類必須精準呈現的領域圖形才自繪，並遵守下列規則。

## 1. 設計代幣（Design tokens）

| 代幣 | 值 | 位置 | 用途 |
|---|---|---|---|
| `TOUCH_MIN` | 44 pt | `index.tsx` | 可點擊目標最小邊長；指板格高 `cellHeightFor` 以它為下限 |
| `BOARD_TYPE_SIZE` | 上限 `xxxLarge` | `index.tsx` | 固定格高圖形內的文字字級上限（見 §4） |
| `INK_DARK` / `INK_LIGHT` | `#000000` / `#ffffff` | `index.tsx` | 圓點內文字的兩種字色，只能經 `inkOn` 選用 |
| `PALETTES` | 經典藍橘／森林綠／單色深灰 | `index.tsx` | 指板配色；系統色名稱優先，自訂色僅限圖形 |
| `Layout` | `computeLayout(w, h)` | `index.tsx` | 以視窗實際尺寸換算版面（分割檢視、Stage Manager 皆適用） |

文字一律使用語意字級（`headline`、`subheadline`、`footnote`、`caption`、`caption2`、`title2`），不寫字級數字；色彩一律使用語意色（`label`、`secondaryLabel`、`systemBackground`、`systemGray*`、`tint`），自訂十六進位色只出現在 `PALETTES` 的圖形用色。

## 2. 色彩與對比

目標：文字對比符合 WCAG AA（一般文字 4.5:1），且不單靠顏色傳達資訊。

- 圓點內文字的顏色**不寫死**，由 `inkOn(底色)` 在淺色與深色模式下取對比較高者（`contrastRatio`、`SYSTEM_FILLS`）。
- 實測對比（白字／黑字）：

| 底色 | 白字 | 黑字 | 採用 |
|---|---|---|---|
| systemBlue | 4.02 / 3.65 | 5.23 / 5.76 | 黑 |
| systemOrange | 2.20 / 2.06 | 9.55 / 10.22 | 黑 |
| systemGreen | 2.22 / 2.02 | 9.46 / 10.39 | 黑 |
| systemRed | 3.55 / 3.41 | 5.92 / 6.16 | 黑 |
| systemPurple | 4.13 / 3.52 | 5.08 / 5.96 | 黑 |
| `#2e7d5b`（森林綠） | 5.00 | 4.20 | 白 |
| `#48484a`（單色深灰） | 9.12 | 2.30 | 白 |

（兩個數字分別是淺色／深色模式；自訂色不隨模式改變。）
- 根音以橘色圓點加空弦標記表示，**側邊音名文字不再用橘色**（橘字對淺色背景僅 2.2:1），一律 `label`。
- 對錯回饋同時有顏色與文字（見認音練習的回饋列），不單靠紅綠。

## 3. 觸控目標與版面

- 可點擊元件至少 44 × 44 pt。指板格高 ≥ 44（iPad 寬度 ≥ 560 時 48）；刷法格 56 pt；按鈕使用系統 `Button`。
- 版面：以 `GeometryReader` 取得視窗尺寸 → `computeLayout`。短邊 ≥ 600 pt 採 iPad 版面，橫向 iPad 左右雙欄（`SplitList`）。**不用** `Device.screen` 判斷版面。
- 分頁：`TabView` 3 個分頁（和弦、音階、節奏），設定以 Sheet 呈現；工具列與分頁列交給系統繪製，不疊加玻璃效果。

## 4. 動態字級（Dynamic Type）

- 清單、按鈕、說明文字使用語意字級，隨系統字級完整縮放。
- 指板、節奏圖的格高與欄寬固定，若標籤跟著放大到最大字級會被裁切；因此這些圖形容器設 `dynamicTypeSize={BOARD_TYPE_SIZE}`（上限 `xxxLarge`），圖形的完整資訊改由 §5 的文字替代提供。
- 禁止在一般文字上固定高度；固定高度只用於圖形內標籤。

## 5. 無障礙

文件依據：Scripting「Accessibility」頁（`accessibilityLabel`、`accessibilityHint`、`accessibilityElement`、`accessibilityAddTraits`）與「dynamicTypeSize」頁。

| 元件 | 做法 |
|---|---|
| 和弦圖（`ChordBoard`） | 整張圖合成一個元素（`accessibilityElement="ignore"`），說明為「和弦指法：」加逐弦敘述（`describeVoicing`，經字串表翻譯），例如「第 3 格，第五弦，音名 C」「第六弦悶音」／ "fret 3, string 5, note C"、"string 6 muted" |
| 可點擊的指板格（找音／認音） | 每格透明點擊層有 `accessibilityLabel`（`describePosition`）與 `isButton` 特性 |
| 刷法格（`StrumCell`） | 標籤「第 n 格，下刷」，提示「輕點切換刷法」，`isButton` |
| 指彈圖（`PickGrid`） | 整張圖一個元素，說明含格數與目前和弦指法 |
| 一般按鈕、Picker、Toggle | 使用系統元件與明確的 `title`，由系統提供說明 |

文字替代的格式固定為「（空弦｜第 n 格），第X弦，音名 Y」，弦以中文數字（第六弦～第一弦）。

## 6. 動態與觸覺

- 本 app 沒有自訂動畫，不需要處理「減少動態效果」；日後若加動畫，使用文件記載的 `animation` 屬性與系統預設曲線。**文件未記載讀取「減少動態效果」設定的 API**，因此新增動畫前須先實機驗證。
- 觸覺回饋只用於換題成功／失敗、播放起點等關鍵時機，可在設定關閉（`haptic()` 集中處理）。

## 7. 文案

- 預設繁體中文（`zh-TW`），樂理用語依 AGENTS.md 第 3 章對照表。
- 領域層不放文案：和弦類型名稱走 `QUALITY_MESSAGE`、按法名稱在 `voicingTitle`，兩者都用字串鍵；刷法名稱 `STROKE_MESSAGE`、刷法與指彈模板的名稱與說明（`labelKey`／`hintKey`）也用字串鍵。
- **字串表（已建立骨架）**：`MESSAGES_ZH_TW`（鍵的唯一來源）與 `MESSAGES_EN`（型別 `Messages`，缺鍵無法編譯）；以 `t("key", { 參數 })` 取用，範本中的 `{name}` 為佔位符。語言由 `pickLang(readLocaleInfo())` 決定：**繁體中文（含沒有地區的 `zh`、`zh-Hant`、`zh_TW`、`zh-HK`）用 `zh-TW`，簡體中文與其他語言用 `en`**。
- **新增文案的做法**：先在 `MESSAGES_ZH_TW` 加鍵，再補 `MESSAGES_EN`（兩邊佔位符須相同，測試會檢查），畫面用 `t(...)`；`t` 目前由 `App` 傳給需要的元件（Scripting 文件只記載 `useContext` 而未記載建立 context 的 API，所以以 props 傳遞）。
- **遷移進度**：所有使用者可見的文案都已走字串表並有英文：分頁標題、工具列、設定頁、和弦、音階與節奏分頁，以及無障礙說明。仍是中文的只有開發者看的 `console.error` 與例外訊息（不屬於介面文案）。和弦類型、按法名稱、調名、進行名稱都由字串鍵加參數組成（`qualityLabel`、`voicingTitle`、`keyTitleOf`、進行的 `labelKey`），純函式需要 `t` 時以參數傳入。英文用語見 AGENTS.md「英文 UI 用語」。
- **語系 API（依 Scripting 官方文件）**：可用 `Device.systemLanguageCode`（如 `"zh"`）、`Device.systemLanguageTag`（如 `"en-US"`）、`Device.systemCountryCode`、`Device.preferredLanguages`（如 `["en-US", "zh-Hans-CN"]`）、`Device.systemLocale`（底線格式 `"en_US"`）；日期用 `DateFormatter`。**文件未記載**：`Locale` 類別、`Intl`、`NumberFormatter`、`script.json` 的在地化欄位，也沒有任何「介面文字自動跟隨系統語言」的機制，因此字串表必須自己實作。文件的範例只有簡體 `zh-Hans-CN`，實機（繁體中文系統）回報：`systemLanguageTag` 為 `"zh_TW"`（底線）、`systemLanguageCode` 為 `"zh"`，`preferredLanguages` 為 `undefined`，因此判斷不依賴 `preferredLanguages`，並同時接受底線與連字號。

## 8. 檢查清單（新增或修改畫面時）

1. 使用系統元件與語意字級／語意色？沒有新的十六進位色（除 `PALETTES`）？
2. 可點擊目標 ≥ `TOUCH_MIN`？
3. 圓點內文字用 `inkOn`？新的底色已加入 `SYSTEM_FILLS` 或使用十六進位色？
4. 自繪圖形有文字替代（`describe*`）？可點擊的透明層有 `accessibilityLabel`？
5. 固定格高的圖形加了 `BOARD_TYPE_SIZE`？
6. 在實機檢查：iPhone 與 iPad、淺色與深色、最大字級、VoiceOver。
7. `npm run typecheck` 與 `npm test` 通過。

## 9. 已知差距

| 項目 | 狀態 |
|---|---|
| 橫式指板單格寬度下限 36 pt（受可用寬度限制） | 高度仍 ≥ 44；窄螢幕上寬度略小於 44 |
| 英文在地化 | 全部介面文案完成；需在實機以英文系統檢查版面是否被長字串擠壞 |
| VoiceOver、最大字級的實機驗證 | 需擁有者在實機確認 |
| 音階頁、認音練習以外的圖形（刷法格以外）逐項敘述 | 目前以整張圖或逐格說明為主 |
