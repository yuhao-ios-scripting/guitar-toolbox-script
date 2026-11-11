# 狀態

專案：guitar-toolbox-script

筆記本：.agentflow/guitar-toolbox-script.devlog.md — 根目錄

工作目錄：/Users/yuhaochang/Documents/GitHub/guitar-toolbox-script

分支：main

目前工作：A-014 等待下一個請求。

已驗證：A-013 已推送並建立 release v0.0.3（ZIP 下載內容與本機一致；尚未在實機匯入驗證）。

下一步：等待請求。

封存紀錄：無。

---

# → 提問 / A-001

+ godev 撰寫AGENTS.md與README.md，這是一個開發iOS/iPadOS Scripting app的專案，用來開發吉他用的工具腳本，請遵循iOS/iPadOS 27設計指引，使用functional programming + domain-driven development，使用適當的台灣樂理用語以及英語

# → 回覆 / A-001

* _2026-11-12 00:20:00 +0800_

1. `godev 撰寫AGENTS.md與README.md，這是一個開發iOS/iPadOS Scripting app的專案，用來開發吉他用的工具腳本，請遵循iOS/iPadOS 27設計指引，使用functional programming + domain-driven development，使用適當的台灣樂理用語以及英語`

   已撰寫 [AGENTS.md](../AGENTS.md)（架構、FP/DDD 規則、台灣樂理術語對照、iOS/iPadOS 27 UI 指引、測試與禁止事項）與 [README.md](../README.md)（雙語專案介紹）。

## 問題（批次提出，各附建議預設值）

- None.

---

# → 提問 / A-002

+ godev 搜尋設計指引，搜尋Scripting app文件，已更新index.jsx

# → 回覆 / A-002

* _2026-11-12 00:40:00 +0800_

1. `godev 搜尋設計指引，搜尋Scripting app文件，已更新index.jsx`

   已查 Apple 設計資源更新紀錄與 Scripting 官方文件，並依 `index.jsx` 實際內容更新 [AGENTS.md](../AGENTS.md)、[README.md](../README.md)。

## 問題（批次提出，各附建議預設值）

- Q-002-1：進入點文件指定 `index.tsx`，現為 `index.jsx`（含 TypeScript 語法）。是否改名並加入型別檢查？建議預設：先維持現狀。
  - ans:
- Q-002-2：是否以 `GeometryReader` 取代 `Device.screen` 判斷版面（分割檢視／Stage Manager 較準確）？建議預設：另開任務處理。
  - ans:

---

# → 提問 / A-003

+ godev 改名並加型別檢查。好。

# → 回覆 / A-003

* _2026-11-12 00:55:00 +0800_

1. `godev 改名並加型別檢查。好。`

   `index.jsx` 已改名為 `index.tsx`，新增 `package.json`、`tsconfig.json`、`types/scripting.d.ts`，`npm run typecheck` 零錯誤。Scripting 元件 props 因型別外殼而不受檢查。文件已同步更新。已處理 Q-002-1；Q-002-2 仍待決定。

## 問題（批次提出，各附建議預設值）

- Q-003-1：是否要把 `noUncheckedIndexedAccess` 一併開啟？會讓陣列索引多出需處理的 `undefined`，預期有不少修改。建議預設：先不開。
  - ans:

---

# → 提問 / A-004

+ godev 使用GeometryReader。將版本號碼調整為0.0.1，在AGENTS.md寫明每次commit進行適當版本號碼調整。將CAGED練習改為pattern1/2/3/4/5練習。

# → 回覆 / A-004

* _2026-11-12 01:20:00 +0800_

1. `godev 使用GeometryReader。將版本號碼調整為0.0.1，在AGENTS.md寫明每次commit進行適當版本號碼調整。將CAGED練習改為pattern1/2/3/4/5練習。`

   版面改由最外層 `GeometryReader` 的視窗尺寸決定，移除螢幕尺寸輪詢。`APP_VERSION`、`package.json`、`package-lock.json` 皆為 0.0.1，AGENTS.md 新增版本號碼規則。分頁與練習改為 Pattern 1–5，舊儲存資料會自動換算。`npm run typecheck` 零錯誤，尚未在實機驗證。已處理 Q-002-2。

## 問題（批次提出，各附建議預設值）

- Q-004-1：Pattern 與 CAGED 的對應我採用 1 = E 型、2 = D 型、3 = C 型、4 = A 型、5 = G 型。是否符合你的 Pattern 定義？建議預設：維持。
  - ans:

---

# → 提問 / A-005

+ godev Pattern1為指板0到3格，pattern2為指板2到5格，搜尋可能的pattern正式名稱與練習方式

# → 回覆 / A-005

* _2026-11-12 01:50:00 +0800_

1. `godev Pattern1為指板0到3格，pattern2為指板2到5格，搜尋可能的pattern正式名稱與練習方式`

   已查到：沒有統一的官方名稱，常見為把位（Position）、Box、CAGED 指型。已依擁有者選擇改為「固定格數、與主音無關」，並把名稱說明與練習方式寫入 README。已處理 Q-004-1（改為固定格數，不再對應 CAGED）。

## 問題（批次提出，各附建議預設值）

- Q-005-1：Pattern 3–5 我依「每次 +2 格、寬 4 格」推算為 4–7、6–9、8–11 格。是否正確？建議預設：維持。
  - ans:

---

# → 提問 / A-006

+ godev 將pattern練習合併進音階

# → 回覆 / A-006

* _2026-11-12 02:10:00 +0800_

1. `godev 將pattern練習合併進音階`

   獨立的 Pattern 分頁已移除，音階分頁頂端新增「音階瀏覽／Pattern 練習」分段選單。分頁由四個減為三個。README、AGENTS.md 已同步。`npm run typecheck` 零錯誤，尚未在實機驗證。

## 問題（批次提出，各附建議預設值）

- None.

---

# → 提問 / A-007

+ godev pattern練習指5 patterns of C scale，如何與音階瀏覽合併

# → 回覆 / A-007

* _2026-11-12 02:30:00 +0800_

1. `godev pattern練習指5 patterns of C scale，如何與音階瀏覽合併`

   Pattern 應是「C 大調音階的五個把位」，會隨主音與音階類型平移，不是固定格數。依 CAGED 順序，C 大調的五個範圍為 0–3、2–5、4–7、7–10、9–12 格。建議把 Pattern 變成音階瀏覽的篩選（全部／1–5），練習沿用同一組主音、音階與 Pattern。尚未修改程式，等待確認。此設計取代 Q-005-1。

## 問題（批次提出，各附建議預設值）

- Q-007-1：C 大調五個範圍是否為 0–3、2–5、4–7、7–10、9–12 格？建議預設：是。
  - ans:
- Q-007-2：是否採用「音階頁新增 Pattern 篩選，練習共用同一組設定」？建議預設：是。
  - ans:
- Q-007-3：Pattern 範圍遇到超過 12 格時，是否改用低八度（例如 B♭ 的 Pattern 5 改成 0–2 格附近）？建議預設：是，並顯示在 12 格以內。
  - ans:

---

# → 提問 / A-008

+ godev 3 G 5-8，其餘正確。音階內分為瀏覽、找音與認音三個頁面，共用主音與音階類型的設定。Q-007-3預設。

# → 回覆 / A-008

* _2026-11-12 02:55:00 +0800_

1. `godev 3 G 5-8，其餘正確。音階內分為瀏覽、找音與認音三個頁面，共用主音與音階類型的設定。Q-007-3預設。`

   已實作：Pattern 為五個把位（C 大調 0–3、2–5、5–8、7–10、9–12），隨主音平移，超過第 12 格改用低八度，低於第 0 格裁掉。音階分頁分為瀏覽、找音、認音，共用主音與音階類型。瀏覽可依 Pattern 篩選，找音與認音只從所選 Pattern 的音階音出題。`npm run typecheck` 零錯誤，尚未在實機驗證。已處理 Q-007-1、Q-007-2、Q-007-3。

## 問題（批次提出，各附建議預設值）

- Q-008-1：五聲音階與藍調音階目前沿用同一組 Pattern 範圍（只是範圍內音較少）。是否需要另訂？建議預設：先沿用。
  - ans:

---

# → 提問 / A-009

+ godev 找音與認音使用音階瀏覽裡的主音與音階類型與Pattern UI。

# → 回覆 / A-009

* _2026-11-12 03:10:00 +0800_

1. `godev 找音與認音使用音階瀏覽裡的主音與音階類型與Pattern UI。`

   三個選單抽成共用的 `scalePickers`，瀏覽、找音、認音使用同一組選單與同一份狀態（主音、音階類型、Pattern）。找音與認音沒有「全部」選項；從瀏覽的「全部」切過去時自動使用 Pattern 1。Pattern 不再另外儲存。`npm run typecheck` 零錯誤，尚未在實機驗證。

## 問題（批次提出，各附建議預設值）

- None.

---

# → 提問 / A-010

+ godev 將pattern修正為把位練習

# → 回覆 / A-010

* _2026-11-12 03:40:00 +0800_

1. `godev 將pattern修正為把位練習`

   介面、程式識別字、README、AGENTS.md 中的 Pattern 全部改稱「把位」（程式用 `ScalePosition*`，避免與指板上的點 `Position` 混淆）。節奏的 `RhythmPattern` 是不同概念，未更動。版本升為 0.0.2（文案調整）。`npm run typecheck` 零錯誤，尚未在實機驗證。

## 問題（批次提出，各附建議預設值）

- None.

---

# → 提問 / A-011

+ godev 研究如何發佈Scripting腳本

# → 回覆 / A-011

* _2026-11-12 04:10:00 +0800_

1. `godev 研究如何發佈Scripting腳本`

   官方文件沒有商店或審核式的發佈流程。可行做法是：在 GitHub 公開專案，並提供 `scripting.fun` 或 `scripting://import_scripts` 匯入連結；專案根目錄必須有 `script.json` 與 `index.tsx`。本專案目前缺少 `script.json`。尚未修改程式。

## 問題（批次提出，各附建議預設值）

- Q-011-1：是否採用 GitHub 匯入連結方式發佈？建議預設：是。
  - ans:
- Q-011-2：`script.json` 完整欄位文件未載明。是否由你從 Scripting app 匯出一份現有腳本的 `script.json` 給我參考？建議預設：是，避免自行猜測欄位。
  - ans:
- Q-011-3：是否把 app 檔案移入子資料夾（如 `GuitarToolbox/`），讓匯入時不帶入 `.agentflow/`、`types/` 等開發檔案？建議預設：是。
  - ans:

---

# → 提問 / A-012

+ godev 採用建議，app 移入子資料夾並新增 script.json

# → 回覆 / A-012

* _2026-11-12 04:40:00 +0800_

1. `godev 採用建議，app 移入子資料夾並新增 script.json`

   app 已移入 `GuitarToolbox/`，新增 `script.json`（欄位參考擁有者的 taiwan-music-festival 專案）。README 新增匯入連結與專案結構，AGENTS.md 新增發佈章節，版本號碼改為四處同步，版本升為 0.0.3。`npm run typecheck` 零錯誤。已處理 Q-011-1、Q-011-2、Q-011-3。匯入連結需推送到 GitHub 後才有效，尚未推送。

## 問題（批次提出，各附建議預設值）

- Q-012-1：`script.json` 的圖示（`guitars`）與色彩（`#B45309`）是我暫定的。是否調整？建議預設：維持。
  - ans:

---

# → 提問 / A-013

+ godev github push

+ godev 下載失敗 github requests are limited. Try again after 01:35:49

+ godev 打包 ZIP 並建立 release

# → 回覆 / A-013

* _2026-11-12 01:15:00 +0800_

1. `godev github push`

   已推送 `main`（`f2ad134..e345a4a`）。

2. `godev 下載失敗 github requests are limited. Try again after 01:35:49`

   原因是未登入的 GitHub API 每小時請求上限，與專案無關。建議等限制解除、換網路，或改用 ZIP。

3. `godev 打包 ZIP 並建立 release`

   已建立 release `v0.0.3`（目標 commit `e345a4a`），資產 `GuitarToolbox.zip`（`script.json` 與 `index.tsx` 在根層）。下載網址 `https://github.com/yuhao-ios-scripting/guitar-toolbox-script/releases/latest/download/GuitarToolbox.zip` 已驗證內容與本機一致。README 匯入連結與 AGENTS.md 發佈步驟已改為 ZIP；這兩份文件的修改尚未 commit。

## 問題（批次提出，各附建議預設值）

- None.

---

# → 提問 / A-014

+ godev 提供更多封閉和弦的按法

# → 回覆 / A-014

* _2026-11-12 +0800_

1. `godev 提供更多封閉和弦的按法`

   和弦速查的封閉和弦原本只有 E 型與 A 型。現在改為資料驅動的 `MOVABLE_SHAPES`，新增：
   - D 型（4 弦根音，小範圍封閉）：大三、小三、屬七、大七、小七、sus2、sus4、減三、增三、半減七。
   - C 型：大三、屬七、大七。G 型：大三、屬七。
   - E 型補 sus2、增三和弦，與屬七、小七的第二種按法（標示「變化」）。
   - A 型補屬七、小七的第二種按法（第 1 弦按第 3 格）。

   斜線和弦、和弦練習與和弦進行共用同一份按法，因此一併受惠。已用暫存腳本對 456 組（指型 × 根音）驗算：所有音都屬於該和弦、最低音為根音、至多缺一個和弦音，零個錯誤。`npm run typecheck` 零錯誤。版本升為 0.1.0（四處同步）。未在實機檢視指板顯示；C 型、G 型在高把位伸張較大，請實機確認。尚未推送。

## 問題（批次提出，各附建議預設值）

- None.

---

# → 提問 / A-015

+ godev 搜尋並驗證新增的封閉和弦按法

# → 回覆 / A-015

* _2026-11-12 +0800_

1. `godev 搜尋並驗證新增的封閉和弦按法`

   網路搜尋只能部分佐證，樂理驗算才是主要依據：
   - 已佐證：CAGED 五種可移動指型（C A G E D）、D 型不需橫按、E／A 型的屬七與 sus2 變化（JustinGuitar、Wikipedia「Bar chord」）。
   - 未找到來源：D 型第 4～1 弦的完整指型表（屬七以外各類型）、C 型／G 型的屬七與大七移動版、E 型 `0,2,2,1,3,0`、`0,2,2,0,3,0` 與增三和弦的具體圖表。
   - 以音高計算驗證（前一輪的 456 組）：所有音屬於和弦、最低音為根音，結果與來源無矛盾。
   - 結論：音高正確；常用度（特別是 C 型、G 型與 D 型的 sus2／減三／增三／半減七）未獲外部來源確認，需實機試按。

## 問題（批次提出，各附建議預設值）

- Q-015-1：是否把未獲來源佐證的按法（D 型 sus2／減三／增三／半減七、C 型、G 型）標為「進階」或移除？建議預設：維持現狀，待你實機試按後再決定。
  - ans:

---

# → 提問 / A-016

+ godev 設定裡提供要開啟哪些封閉和弦指型的選項

# → 回覆 / A-016

* _2026-11-12 +0800_

1. `godev 設定裡提供要開啟哪些封閉和弦指型的選項`

   設定頁新增「封閉和弦指型」區段，E／A／D／C／G 五個開關。每個封閉按法現在帶有所屬指型，和弦速查、斜線和弦、和弦進行、和弦練習（含節奏頁的進行）都只列出已啟用的指型；開放和弦不受影響。預設啟用 E、A、D，C 型與 G 型伸張大，預設關閉。偏好新增欄位 `barreShapes`，舊版儲存資料缺欄位時自動補預設值，key 不變。`npm run typecheck` 零錯誤；尚未實機檢視。版本升為 0.2.0（四處同步）。已處理 Q-015-1：用開關讓你自行取捨，按法本身維持不變。尚未推送。

## 問題（批次提出，各附建議預設值）

- None.

---

# → 提問 / A-017

+ godev 依據functional programming與domain-driven development的原則檢視原始碼

# → 回覆 / A-017

* _2026-11-12 +0800_

1. `godev 依據functional programming與domain-driven development的原則檢視原始碼`

   唯讀檢視 `GuitarToolbox/index.tsx`（3,308 行），未改程式。

   符合：無 `class`；`any` 只有 1 處（`globalThis.HapticFeedback`）；`throw` 只在音訊 infra；亂數與時間由呼叫端傳 seed（`nextRandom`、`shuffled` 為純函式）；偏好、Hub、練習、節奏的儲存都用 try/catch 並保留舊 key 遷移；`readonly` 使用 167 次；reducer 與 `computeLayout`、`resolveFingering`、`buildVoicings` 等為純函式。

   待改善（嚴重度由高到低，皆已列入 backlog B-001～B-006）：
   1. 領域值是原始型別：`PitchClass`、`Fret` 只是 `number` 別名，`quality` 用 `string`（7 處），且 `ChordQuality`（3 種）與 `FINDER_QUALITIES`（11 種）是兩套並存的概念。
   2. 領域資料夾帶呈現：`FINDER_QUALITIES.label`、`formula`、`FinderVoicing.title` 是中文 UI 字串，違反「文案集中管理」與 domain 純度。
   3. 區塊歸位不清：Hub／練習／節奏的 `Storage` 讀寫與 reducer、domain 型別、UI 混在同一大區塊；`ChordHub`（380 行）、`RhythmStudio`（300 行）同時做狀態、用例與畫面。
   4. 無 `Result`／`Option`、無 `assertNever`：3 個 `switch` 皆未做全面性檢查；偏好載入以臨時型別轉換處理。
   5. 模組層可變狀態：`voicingCache`、`slashCache`、`rhythmTicket` 與模組載入時執行的 `prefsRepository.load()`。快取為純函式備忘錄尚可，其餘屬副作用。
   6. 領域搜尋演算法用命令式迴圈與 `let best`（`buildSlashVoicings`、`resolveFingering`），可讀性與可測性較差。
   另：Domain 單元測試尚未建立（AGENTS.md 第 6 章要求）。

## 問題（批次提出，各附建議預設值）

- Q-017-1：要先做哪一項？建議預設：先建立測試工具鏈與音高／和弦／指型的表格化測試（讓後續重構有保護網），再做 1 與 2。
  - ans:

---

# → 提問 / A-018

+ godev 採用建議，先建立測試工具鏈

# → 回覆 / A-018

* _2026-11-12 +0800_

1. `godev 採用建議，先建立測試工具鏈`

   已建立 Vitest 5.1.0（`npm test`）：`vitest.config.ts` 將 `scripting` 指到 `tests/scripting-stub.ts`，`tests/setup.ts` 提供 `Storage` 等全域替身；`GuitarToolbox/index.tsx` 檔尾新增僅供測試的 `export { … }`（未拆檔，Scripting 執行時忽略）。`tests/domain.test.ts` 共 484 個表格化案例：音高與同音異名、Cmaj7／G7／Am7♭5 組成、C 大調順階和弦、12 根音 × 11 類型的每個按法（只含和弦音、最低音為根音、至多缺一音、最高格 ≤ 15）、開放和弦表、F 大三和弦 E 型 `1 3 3 2 1 1`、指型篩選、斜線和弦最低音、指法推算、和弦進行、`shuffled` 純度、`computeLayout`。全部通過，`npm run typecheck`（現含 tests）零錯誤。測試未發現資料錯誤。AGENTS.md 2.4 與 README 已更新；版本升為 0.2.1（內部變更，四處同步）。尚未推送，也未做 property-based 與移調夾測試（領域尚無對應函式）。

## 問題（批次提出，各附建議預設值）

- Q-018-1：是否接著做 B-001／B-002（branded type 與文案移出 domain）？建議預設：是，先做 B-002，再做 B-001。
  - ans:

---

# → 提問 / A-019

+ godev 採用建議，先做 B-002 再做 B-001

# → 回覆 / A-019

* _2026-11-12 +0800_

1. `godev 採用建議，先做 B-002 再做 B-001`

   B-002（0.2.2，commit `refactor: 和弦類型與按法的中文文案移出 domain`）：`FINDER_QUALITIES` 只剩 `key`、`intervals`、`suffix`；中文名稱與公式移到 UI 的 `QUALITY_TEXT`。`FinderVoicing.title` 改為結構化的 `origin`（開放／指型＋格數＋是否變化）與 `rebassed`，中文標題由 UI 的 `voicingTitle` 產生；`TrainerVoicing` 同步改用 `origin`。

   B-001（0.2.3）：新增唯一來源 `QUALITY_KEYS` 與聯集型別 `QualityKey`，`ChordQuality` 改為其子集，全程式 `quality: string` 都換成 `QualityKey`，`isQualityKey` 作為型別守衛（讀取舊設定時使用）；`PitchClass` 改為 branded type，只能由 `mod12` 建立，編譯器因此抓出約 50 處未驗證的 `number` 並已逐一修正。`noteName` 與 `noteLabel` 維持接受 `number`（內部折回 0–11）。`Fret`（`number | null`）尚未 brand：陣列字面值遍布各處，改動面大、收益低，保留在 backlog B-001。

   `npm run typecheck` 零錯誤，`npm test` 487 個案例通過（新增文案與型別對應測試）。尚未推送，未實機檢視。

## 問題（批次提出，各附建議預設值）

- Q-019-1：下一步做哪一項？建議預設：B-003（Storage 與 reducer 歸位、拆小 `ChordHub`／`RhythmStudio`），之後 B-004、B-005。
  - ans:

---

# → 提問 / A-020

+ godev 採用建議，先做 B-003

# → 回覆 / A-020

* _2026-11-12 +0800_

1. `godev 採用建議，先做 B-003`

   完成一部分（0.2.4，行為不變）：
   - 四個儲存庫（偏好、和弦、認音練習、節奏）及其 key 集中到單一區塊「Infrastructure：本機儲存」；各設定的型別與預設值留在領域區塊，儲存格式與舊 key 遷移不變。
   - 從 `ChordHub`、`RhythmStudio` 抽出純函式並納入測試：`effectiveBass`、`keyTitleOf`、`finderViewOf`、`stepIndex`、`progressionSeconds`、`practiceDeckOf`；節奏頁的播放游標計時抽成 `usePlaybackClock`。
   - `npm run typecheck` 零錯誤，`npm test` 493 個案例通過；尚未實機檢視，尚未推送。

   未完成：`ChordHub`（364 行）與 `RhythmStudio`（267 行）的 JSX 區塊（速查、進行、練習；左右欄區塊）仍在同一個元件內。這些區塊共用大量區域變數，沒有 UI 測試保護下拆成元件，風險高於收益，且屬畫面層；建議在你實機驗證本次變更後，再決定是否拆分。reducer（`practiceReducer`、認音練習）本來就是純函式，已在各自功能區塊內，未移動。

## 問題（批次提出，各附建議預設值）

- Q-020-1：是否現在把 `ChordHub` 與 `RhythmStudio` 的 JSX 區塊拆成獨立元件？建議預設：先不拆，等實機驗證 0.2.x 後再做。
  - ans:

---

# → 提問 / A-021

+ godev 正常，繼續拆

# → 回覆 / A-021

* _2026-11-12 +0800_

1. `godev 正常，繼續拆`

   已拆分（0.2.5，行為不變）：
   - `ChordHub` 的速查、進行、練習三個畫面區塊成為頂層函式 `finderSections`、`progressionSections`、`practiceSections`，各用明確的 context 介面（`FinderCtx`、`ProgressionCtx`、`PracticeCtx`）接收資料與動作；元件由 364 行降到 160 行。
   - `RhythmStudio` 的畫面區塊成為 `rhythmTypeSection`、`rhythmPlaySection`、`rhythmProgSection`、`rhythmGridSections`；元件由 267 行降到 130 行。
   - 區塊內容原樣搬移，只改成由 context 解構取值。
   - 新增 4 個冒煙測試（以可檢視的 `h` 替身呼叫每個區塊函式，確認不丟例外、左右欄配置正確）。`npm run typecheck` 零錯誤，`npm test` 497 個案例通過。畫面元件 props 在型別外殼中放寬為 `any`，不受型別檢查，請實機再看一次三個和弦模式與節奏頁。尚未推送。

   B-003 完成，已從 backlog 移除。

## 問題（批次提出，各附建議預設值）

- Q-021-1：下一步做 B-004（`Result`／`Option` 與 `assertNever`）與 B-005（移除模組載入時副作用與模組層 `rhythmTicket`）？建議預設：先 B-004，再 B-005。
  - ans:

---

# → 提問 / A-022

+ godev 採用建議，先 B-004 再 B-005

# → 回覆 / A-022

* _2026-11-12 +0800_

1. `godev 採用建議，先 B-004 再 B-005`

   B-004：新增 `Result<E, A>`（`ok`、`err`、`unwrapOr`）、`isRecord` 與 `assertNever`。偏好、和弦、練習、節奏四種設定的驗證從儲存庫抽成純函式 `parsePrefs`、`parseHub`、`parseDrill`、`parseRhythm`（輸入 `unknown`，回傳 `Result`；舊版資料遷移邏輯不變，且改為不 mutate）；儲存庫只剩讀寫與 `unwrapOr` 回退預設值。3 個 `switch`（`practiceReducer`、認音練習 reducer、`strokeVelocity`）都加上 `default: assertNever`。未新增 `Option`：目前沒有需要它的地方，避免無用程式碼。

   B-005：移除模組載入時的四個 `load()`，改為元件內 `useMemo` 讀取初始值；模組層 `rhythmTicket` 改為節奏頁元件內的可變容器（Scripting 沒有 `useRef`，以 `useMemo` 保存）。`synth` 單例（播放器與快取）仍是模組層狀態，它本身就是 Infrastructure 的副作用邊界，未動。

   `npm run typecheck` 零錯誤，`npm test` 507 個案例通過（新增解析與儲存庫測試）。版本升為 0.2.6，尚未推送。請實機確認：關閉再開啟 app 後各頁設定仍會還原（偏好、和弦、節奏、認音最佳連對），以及節奏頁切換分頁時播放會停止。

   B-004、B-005 完成，已從 backlog 移除；backlog 只剩 B-001（`Fret` branded type）。

## 問題（批次提出，各附建議預設值）

- Q-022-1：要處理 B-001 的 `Fret` branded type 嗎？建議預設：不做，改動面大而收益低，維持 backlog。
  - ans:

---

# → 提問 / A-023

+ godev 檢視介面設計，遵循設計指引建立設計系統

# → 回覆 / A-023

* _2026-11-12 +0800_

1. `godev 檢視介面設計，遵循設計指引建立設計系統`

   檢視結果（對照 AGENTS.md 第 4 章）：
   - 已符合：系統元件（`TabView`、`List`、`Picker`、`Toggle`、`Button`、Sheet）、語意字級與語意色、觸覺集中處理且可關閉、`computeLayout` 以視窗尺寸決定 iPad 雙欄、指板格高 ≥ 44 pt、無自訂動畫。
   - 缺口：`accessibilityLabel` 為 0 處；白字在藍／紅／紫底對比僅 3.4–4.1:1（AA 要求 4.5:1）；橘色側邊音名對淺色背景僅 2.2:1；固定格高圖形在最大字級會裁切；英文在地化未做；橫式指板格寬下限 36 pt。

   已處理（0.3.0）：
   - 新增設計代幣與對比工具：`TOUCH_MIN`、`BOARD_TYPE_SIZE`、`contrastRatio`、`inkOn`，圓點字色由底色計算（藍／紅／紫／橘／綠底改黑字，森林綠與單色深灰用白字），測試守住所有配色在淺色與深色模式皆 ≥ 4.5:1。
   - 側邊音名不再用橘色（根音仍以橘色圓點與空弦標記呈現）。
   - 無障礙：和弦圖與指彈圖合成單一元素並提供逐弦文字說明（`describeVoicing`／`describePosition`，如「第 3 格，第五弦，音名 C」）；可點擊的指板格與刷法格有標籤與按鈕特性；圖形容器字級上限 `xxxLarge`。依 Scripting 官方「Accessibility」與「dynamicTypeSize」文件，未用文件未載明的 API。
   - 新增 `docs/design-system.md`（代幣、對比表、元件無障礙規則、檢查清單、已知差距），AGENTS.md 與 README 已連結。
   - `npm run typecheck` 零錯誤，`npm test` 528 個案例通過。畫面元件 props 不受型別檢查，請實機確認外觀；尚未推送。

   文件未載明「減少動態效果」的讀取 API，已寫入設計系統：目前無動畫，日後加動畫前須先實機驗證。

## 問題（批次提出，各附建議預設值）

- Q-023-1：圓點內文字改黑字（藍、紅、紫底）會改變現有外觀，是否接受？建議預設：接受，因為這是達到 AA 對比的最小改動；若不喜歡，可改為調整底色深度。
  - ans:
- Q-023-2：是否接著做 B-006（英文在地化）？建議預設：先查 Scripting 是否提供語系 API，再決定字串表結構。
  - ans:

---

# → 提問 / A-024

+ godev 採用建議，接受並先查語系 API

# → 回覆 / A-024

* _2026-11-12 +0800_

1. `godev 採用建議，接受並先查語系 API`

   藍、紅、紫底改黑字已包含在 0.3.0，視為接受。

   語系 API 查詢結果（依 Scripting 官方文件，未改程式）：
   - 有記載：`Device.systemLanguageCode`（如 `"en"`）、`Device.systemLanguageTag`（如 `"en-US"`）、`Device.systemCountryCode`、`Device.systemScriptCode`、`Device.preferredLanguages`（如 `["en-US", "zh-Hans-CN"]`）、`Device.systemLocale`（底線格式 `"en_US"`）；`DateFormatter`（可指定 `locale`）；`Translation`（文字翻譯，不是介面在地化）。
   - 未記載：`Locale` 類別、`Intl`、`NumberFormatter`、`script.json` 的在地化欄位、介面文字自動跟隨系統語言的機制。
   - 結論：app 必須自建字串表，並以 `Device.systemLanguageCode` 或 `systemLanguageTag` 選語言。文件範例只有簡體（`zh-Hans-CN`），繁體系統的實際回傳值未載明，須在實機確認後才能定規則。
   - 已更新 `docs/design-system.md` §7 與 backlog B-006；因 app 行為不變，版本維持 0.3.0。

## 問題（批次提出，各附建議預設值）

- Q-024-1：是否開始做英文在地化？範圍大（數百個內嵌字串），建議分頁逐步遷移，每步可獨立驗證。建議預設：先做字串表骨架與語言判斷（含單元測試），再遷移「設定」頁，確認方式可行後逐頁推進。
  - ans:
- Q-024-2：語言規則——系統語言是繁體中文（`zh-Hant` 或 `zh-TW`）用繁體，其餘一律英文？簡體中文系統是否也用繁體？建議預設：僅繁體中文系統用 `zh-TW`，其餘（含簡體）用英文；規則可日後調整。
  - ans:
- Q-024-3：能否請你在實機的 Scripting 以 `console.log(Device.systemLanguageTag, Device.systemLanguageCode, Device.preferredLanguages)` 執行一次，回報繁體系統的實際值？建議預設：是，這是規則能否正確判斷的前提。
  - ans:

---

# → 提問 / A-025

+ godev 採用建議，先做字串表骨架。01:41:38 zh_TW zh undefined

# → 回覆 / A-025

* _2026-11-12 +0800_

1. `godev 採用建議，先做字串表骨架。01:41:38 zh_TW zh undefined`

   你的實機輸出解讀為：`systemLanguageTag = "zh_TW"`（底線格式）、`systemLanguageCode = "zh"`、`preferredLanguages = undefined`（此環境不提供）。因此語言判斷只用 tag／code／country／script，且同時接受底線與連字號。

   已完成（0.4.0）：
   - 字串表骨架：`MESSAGES_ZH_TW` 為鍵的來源，`MESSAGES_EN` 型別為 `Messages`（缺鍵無法編譯）；`translatorFor(lang)` 回傳 `t(key, params)`，`formatMessage` 處理 `{name}` 佔位符。
   - 語言規則（採用建議預設）：繁體中文（含無地區的 `zh`）用 `zh-TW`；簡體中文（Hans、CN、SG）與其他語言用英文。純函式 `pickLang`，系統資訊由 infra 的 `readLocaleInfo` 讀取（失敗則視為英文）。
   - 已接上六個字串：三個分頁標題與設定頁的標題、還原、完成；`PrefsSheet` 以 `t` prop 取用。`types/scripting.d.ts` 補上官方文件載明的 `Device` 欄位。
   - `npm run typecheck` 零錯誤，`npm test` 543 個案例通過（含實機值、簡繁、各語言與鍵一致性）。`docs/design-system.md` §7 與 backlog B-006 已更新。繁體中文系統的畫面應與先前完全相同；請在實機確認，並可把系統語言改為英文確認這六個字串變成英文。尚未推送。

## 問題（批次提出，各附建議預設值）

- Q-025-1：下一步遷移「設定」頁其餘文案（約 40 個字串）並補英文？樂理與吉他術語的英文對照（例如封閉和弦＝barre chord、把位＝scale position）需要先補進 AGENTS.md 術語表。建議預設：是，先補術語表英文欄，再遷移設定頁。
  - ans:

---

# → 提問 / A-026

+ godev 按照建議

# → 回覆 / A-026

* _2026-11-12 +0800_

1. `godev 按照建議`

   已完成（0.5.0）：
   - AGENTS.md 新增「英文 UI 用語」表（和弦＝Chords、封閉和弦＝Barre chord、指型＝Shape、把位＝Scale position 等）。
   - 設定頁全部文案與工具列（聲音開啟／關閉、設定）遷移到字串表，約 45 個字串，附英文；配色名稱改由 `PALETTE_MESSAGE` 取字串，`PALETTES` 只留顏色。
   - 順手修正用語一致性：設定頁與播放說明中的「掃弦」改為「刷弦」（AGENTS.md 規定描述刷奏用「刷弦」；「掃弦」是 sweep picking）。這是繁體畫面上唯一可見的文字變化。
   - 新增測試：原始碼中每個 `t("鍵")` 都存在於字串表、字串表沒有殘留未使用的設定鍵、各語言鍵與佔位符一致。`npm run typecheck` 零錯誤，`npm test` 546 個案例通過。尚未推送。
   - 請實機確認：繁體系統的設定頁與以前相同（僅「掃弦」→「刷弦」）；系統語言改為英文後，設定頁與工具列全為英文且版面沒有被長字串擠壞（特別是「Chord Diagram Frets」「Show Note Names at Side」這類較長的標題）。

   尚未遷移：和弦、音階、節奏三個分頁與無障礙說明，見 backlog B-006。

## 問題（批次提出，各附建議預設值）

- Q-026-1：下一步遷移「和弦」分頁？需先補和弦類型、按法名稱的英文（如 Major triad (maj)、Dominant 7th (7)、Barre (fret 3)），並讓 `QUALITY_TEXT`、`voicingTitle` 改成輸出字串鍵。建議預設：是，先補英文用語表，再遷移和弦分頁。
  - ans:

---

# → 提問 / A-027

