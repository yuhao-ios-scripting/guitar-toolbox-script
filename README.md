# Guitar Toolbox Script 🎸

在 iPhone 與 iPad 的 [Scripting](https://apps.apple.com/app/scripting/id1528415107) app 上執行的**吉他工具腳本集**。

A collection of guitar utility scripts for the Scripting app on iOS / iPadOS.

目前整個 app 位於單一檔案 [`GuitarToolbox/index.tsx`](GuitarToolbox/index.tsx)，使用 TabView 分成三個分頁。

## 功能｜Features

| 分頁 | English | 說明 |
|---|---|---|
| 和弦 | Chords | 和弦速查（開放與封閉和弦按法、斜線和弦）、和弦進行、和弦練習 |
| 音階 | Scales | 以分段選單切換三個頁面，共用主音、音階類型與把位選單：**瀏覽**（大調、自然小音階、五聲音階、藍調音階與各調式在指板上的位置，可依把位 1–5 篩選）、**找音**與**認音**（只在所選把位內出題，見下方〈把位練習〉） |
| 節奏 | Rhythm | 刷弦與指彈的節奏型態編輯與播放，附節拍與播放游標 |
| 設定 | Settings | 指板方向與樣式、音名顯示（自動／升記號／降記號）、播放方式（齊奏／刷弦／琶音）、觸覺回饋 |

另有內建音訊合成（Karplus-Strong 撥弦模型），可聆聽按法與節奏，不需外部音源。

## 規劃中｜Ideas

調音器輔助（音分偏差）、移調與移調夾換算、五度圈、六線譜輸出。以上皆為構想，尚未排程。

## 把位練習｜Position Practice

**把位**是音階在指板上的五個區域，依 CAGED 順序由低到高排列（英文常稱 position）。以 C 大調為準：

| 把位 | CAGED 型 | 指板範圍 |
|---|---|---|
| 1 | C 型 | 第 0–3 格 |
| 2 | A 型 | 第 2–5 格 |
| 3 | G 型 | 第 5–8 格 |
| 4 | E 型 | 第 7–10 格 |
| 5 | D 型 | 第 9–12 格 |

- 其他主音整組平移（例如 G 大調的把位 1 是第 7–10 格）。平移後超過第 12 格就改用低八度；低於第 0 格的部分裁掉，所以少數主音的某些把位會比 4 格短。
- 範圍只依主音決定，音階類型（大調、小調、五聲音階、各調式…）只決定範圍內有哪些音。
- 在「音階」分頁中，「瀏覽」可選擇把位（或「全部」），「找音」與「認音」使用同一組主音、音階類型與把位選單，並只從所選把位的音階音出題（這兩頁必須選定某個把位，從「全部」切過去時自動使用把位 1）。三個頁面的設定完全共用。

**名稱說明**：本專案稱「把位」。教材中另有「Box」、「Pattern」與 CAGED 指型等說法，各家對「第 1 個」的定義也不同，本專案以上表為準。

**練習方式**（綜合公開教材的常見做法）：

1. 先選一個把位，只在這個範圍內練習，不要急著換位置。
2. 從根音開始，上行到範圍內最高音，再下行回到最低音，最後回到根音。
3. 初學先限制在 2–3 條弦，熟練後再擴大到六條弦。
4. 先在「瀏覽」看清楚音級與根音位置，再用「找音」建立指板位置感，最後用「認音」練習看到位置說出音名。
5. 熟悉單一把位後，練習相鄰把位重疊的格數，作為換位置的銜接點。
6. 逐一更換主音（以五度圈順序為佳），同一個把位內音名會隨之改變。

## 設計原則｜Principles

- **iOS / iPadOS 27 原生外觀**：遵循 Apple Human Interface Guidelines 與 Liquid Glass 設計語言，使用系統元件、語意色彩、動態字級與完整無障礙支援。iPad 支援分割檢視與多視窗。
- **Functional Programming**：領域邏輯皆為純函式，資料不可變，預期內的失敗以 `Result` 表達。
- **Domain-Driven Design**：以通用語言（ubiquitous language）建模音高、調弦、和聲、指板、節奏與記譜。
- **台灣樂理用語**：介面與文件採用台灣慣用譯名（如：大三和弦、移調夾、五聲音階、六線譜）。完整對照見 [AGENTS.md](AGENTS.md#3-術語對照台灣樂理用語)。
- **離線優先**：核心功能不需網路，也不蒐集個人資料。

## 架構｜Architecture

`GuitarToolbox/index.tsx` 內以區塊註解分層：

```
Domain          音名、和弦、音階、節奏、指板——純函式與不可變資料
Application     reducer、播放計畫（PlayPlan）等用例，只依賴 Domain
Infrastructure  Storage、音訊合成與播放、觸覺——所有副作用集中在此
UI              Scripting 元件，只負責把狀態畫出來
```

依賴方向：`ui → app → domain`、`infra → domain`。Domain 不使用 Scripting API。

長期目標是拆成 `scripts/src/{domain,app,infra,ui}`，細節與規則請見 [AGENTS.md](AGENTS.md)。

## 安裝｜Install

在已安裝 [**Scripting**](https://scriptingapp.github.io/) app 的 iPhone 或 iPad 上，用 Safari 開啟下方連結，依畫面指示開啟 Scripting 並確認匯入：

[匯入吉他工具箱](https://scripting.fun/import_scripts?urls=%5B%22https%3A%2F%2Fgithub.com%2Fyuhao-ios-scripting%2Fguitar-toolbox-script%2Ftree%2Fmain%2FGuitarToolbox%22%5D)

連結內容是本專案 `GuitarToolbox/` 資料夾的 GitHub 網址（`https://github.com/yuhao-ios-scripting/guitar-toolbox-script/tree/main/GuitarToolbox`）。若瀏覽器沒有自動開啟 Scripting，請點頁面上的「Try Again」；也可以在 `scripting.fun/import_scripts` 貼上網址自行產生連結。

> 連結需要本專案已推送到 GitHub 的 `main` 分支才有效。

**更新**：在 Scripting app 的腳本設定把來源設為同一個 GitHub 網址，並可設定自動檢查更新的間隔（最短 30 分鐘）。每次發佈前須遞增 `GuitarToolbox/script.json` 的 `version`。

## 專案結構｜Layout

```
GuitarToolbox/   要匯入 Scripting app 的腳本：script.json（名稱、版本、圖示）與 index.tsx
types/           開發用的 Scripting 最小型別外殼（不會被匯入）
.agentflow/      開發紀錄
```

只有 `GuitarToolbox/` 會被匯入；型別檢查等開發檔案留在專案根目錄。

## 開發｜Development

- 使用 TypeScript（`strict`）與 TSX。安裝相依套件後以 `npm install && npm run typecheck` 進行型別檢查；Scripting 型別以 `types/scripting.d.ts` 的最小外殼代替，畫面元件 props 不受檢查。
- Domain 層需有單元測試，涵蓋音程、和弦組成、移調、調音偏差等樂理案例。
- UI 在實機驗證：iPhone 與 iPad、淺色與深色、最大字級、VoiceOver。
- 提交前請確認型別檢查與測試通過，且術語與對照表一致。

AI 協作者與貢獻者請先閱讀 [AGENTS.md](AGENTS.md)。開發紀錄由 [agentflow](.agentflow/) 管理。

## 術語速查｜Glossary (excerpt)

| 中文（台灣） | English |
|---|---|
| 和弦 | chord |
| 大三和弦／小三和弦 | major / minor triad |
| 屬七和弦 | dominant 7th chord |
| 音階／調式 | scale / mode |
| 五聲音階 | pentatonic scale |
| 移調／轉調 | transpose / modulate |
| 移調夾 | capo |
| 封閉和弦（橫按） | barre chord |
| 琴格／指板 | fret / fretboard |
| 六線譜 | tablature (TAB) |
| 音分 | cent |
| 節拍器 | metronome |

## 授權｜License

尚未指定。請在公開散布前由擁有者補上授權條款。
