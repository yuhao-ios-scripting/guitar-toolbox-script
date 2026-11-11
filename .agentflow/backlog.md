# Backlog

Actionable future work, not an execution queue. Entries are proposed (inferred) or deferred (owner accepted for later); scheduling needs owner authority. Each B-NNN item records source/Ask, intended outcome, open reason and expected effort or next decision. Record proved completion in the notebook before removing the entry.

- B-001（proposed，A-017；A-019 已完成 `QualityKey` 與 `PitchClass`）：剩下 `Fret` 的 branded type。待決定：改動面大，是否值得。
- B-006（proposed，A-023；A-024 已查語系 API）：英文（`en`）在地化與字串集中管理。可行做法：自建字串表（`zh-TW`、`en`），語言取自 `Device.systemLanguageCode`／`systemLanguageTag`；`script.json` 無在地化欄位。待決定：是否做、預設語言規則、繁體系統的 `Device` 實際回傳值（需實機確認）。範圍大（數百個內嵌字串與樂理用語對照），建議分頁逐步遷移。
- B-007（proposed，A-023）：橫式指板單格寬度下限 36 pt，窄螢幕略小於 44 pt；可評估改為可捲動或減少顯示格數。
- B-008（proposed，A-023）：實機驗證 VoiceOver 與最大字級，並依結果調整 `describe*` 文字與 `BOARD_TYPE_SIZE`（擁有者操作）。

