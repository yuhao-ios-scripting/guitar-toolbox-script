# Backlog

Actionable future work, not an execution queue. Entries are proposed (inferred) or deferred (owner accepted for later); scheduling needs owner authority. Each B-NNN item records source/Ask, intended outcome, open reason and expected effort or next decision. Record proved completion in the notebook before removing the entry.

- B-001（proposed，來源 A-017）：以 branded type 取代 `PitchClass`／`Fret`／`quality: string`，合併 `ChordQuality` 與 `FINDER_QUALITIES`。待決定：是否先有測試。
- B-002（proposed，A-017）：把 `FINDER_QUALITIES.label/formula` 與 `FinderVoicing.title` 的中文文案移出 domain，改由 UI 文案表產生。
- B-003（proposed，A-017）：把 Hub／練習／節奏的 `Storage` 存取與 reducer 歸位到 Infrastructure／Application 區塊，並拆小 `ChordHub`、`RhythmStudio`。
- B-004（proposed，A-017）：引入 `Result`／`Option` 與 `assertNever`，用於偏好載入與 3 個 `switch`。
- B-005（proposed，A-017）：移除模組載入時的 `prefsRepository.load()` 與模組層 `rhythmTicket`。
