import {
  Button, Circle, Device, GeometryReader, HStack, Label, List, Navigation, NavigationStack, Picker,
  Rectangle, Script, ScrollView, Section, Spacer, TabView, Text, Toggle,
  VStack, ZStack, useEffect, useMemo, useReducer, useState,
} from "scripting"

/* ════════════════════════════════════════════════
 * 架構說明（Domain-Driven + Functional）
 *  Domain         ：音名、和弦、音階、節奏、指板——全部是純函式與不可變資料
 *  Application    ：reducer、播放計畫（PlayPlan）等用例，只依賴 Domain
 *  Infrastructure ：Storage、音訊合成與播放、觸覺——所有副作用集中在此
 *  UI             ：Scripting 元件，只負責把狀態畫出來
 * 通用語言：主音、音級、和弦、按法、封閉和弦、斜線和弦、琶音、刷弦
 * ════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════
 * 共用：音名、數學工具、亂數
 * ════════════════════════════════════════════════ */
declare const pitchClassBrand: unique symbol
type PitchClass = number & { readonly [pitchClassBrand]: true } // 0–11，C = 0

// 唯一的 PitchClass 建構函式：任何整數都折回 0–11
const mod12 = (n: number): PitchClass => (((n % 12) + 12) % 12) as PitchClass

const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]
const NOTE_LABELS = ["C", "C#/Db", "D", "D#/Eb", "E", "F", "F#/Gb", "G", "G#/Ab", "A", "A#/Bb", "B"]
const TONIC_LABELS = ["C", "C♯/D♭", "D", "D♯/E♭", "E", "F", "F♯/G♭", "G", "G♯/A♭", "A", "A♯/B♭", "B"]
const ALL_PCS: readonly PitchClass[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((n) => mod12(n))
const OPEN_STRINGS: readonly PitchClass[] = [4, 9, 2, 7, 11, 4].map((n) => mod12(n)) // 6→1 弦：E A D G B E
const STRING_COUNT = 6

const APP_VERSION = "0.7.0"

// 版面判斷：由視窗短邊決定（iPhone 最大約 440pt、iPad mini 全螢幕為 744pt）
const PAD_MIN_SHORT_SIDE = 600 // 視窗短邊 ≥ 600pt 採用 iPad 版面
const isPadSize = (w: number, h: number): boolean => Math.min(w, h) >= PAD_MIN_SHORT_SIDE

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n))

/* ════════════════════════════════════════════════
 * 版面：依「視窗實際尺寸」決定（由 GeometryReader 提供，分割檢視與 Stage Manager 也正確）
 * 目標：滿版。指板格子依「窗格寬度」計算，不再使用固定尺寸，也不再限制最大寬度。
 * ════════════════════════════════════════════════ */
interface Layout {
  readonly width: number
  readonly height: number
  readonly pad: boolean        // 視窗夠寬（短邊 ≥ 600pt）時採用 iPad 版面
  readonly landscape: boolean
  readonly mini: boolean       // iPad mini（短邊 ≤ 780pt）
  readonly split: boolean      // iPad 橫式：左右雙欄
  readonly leftWidth: number   // 雙欄時左欄（控制區）寬度，依螢幕寬度縮放
  readonly paneWidth: number   // 內容窗格寬度（雙欄時為右欄）
  readonly boardWidth: number  // 清單列內可給指板使用的寬度
  readonly maxHRows: number    // 橫式指板最多可顯示的格數
  readonly defaultScaleRows: number // 音階頁預設顯示格數：手機 5 格、iPad 13 格
}
const BOARD_INSET = 72         // 清單左右邊距＋列內距的保守估計
const MIN_H_CELL = 40          // 橫式指板每格最小寬度（接近 44pt 觸控範圍）

// GeometryReader 尚未回報尺寸（或為 0）時的保底值：當作一般 iPhone 直式視窗
const FALLBACK_SIZE = { width: 390, height: 844 } as const

const computeLayout = (w: number, h: number): Layout => {
  const short = Math.min(w, h)
  const pad = isPadSize(w, h)
  const landscape = w > h
  const mini = pad && short <= 780
  const split = pad && landscape
  const leftWidth = split ? clamp(Math.round(w * 0.36), 360, 480) : 0
  const paneWidth = split ? w - leftWidth : w
  const boardWidth = Math.max(240, paneWidth - BOARD_INSET)
  const maxHRows = clamp(Math.floor((boardWidth - 30) / MIN_H_CELL), pad ? 6 : 5, 13)
  return {
    width: w, height: h, pad, landscape, mini, split, leftWidth,
    paneWidth, boardWidth, maxHRows, defaultScaleRows: pad ? 13 : 5,
  }
}

// 區塊配置：明確標示放左欄或右欄（不依賴 element.key）
type Pane = "left" | "right"
interface Placed { readonly pane: Pane; readonly node: JSX.Element }
const L = (node: JSX.Element): Placed => ({ pane: "left", node })
const R = (node: JSX.Element): Placed => ({ pane: "right", node })

// 清單雙欄：橫式 iPad 左右各一個 List；其餘情況用 single 的順序合併成單一 List
function SplitList(props: {
  layout: Layout; left: JSX.Element[]; right: JSX.Element[]; single?: JSX.Element[]
}) {
  const { layout, left, right, single } = props
  if (!layout.split) return <List>{single ?? [...left, ...right]}</List>
  return (
    <HStack spacing={0}>
      <List frame={{ width: layout.leftWidth }}>{left}</List>
      <List>
        {right.length > 0 ? right : [
          <Section key="empty">
            <Text foregroundStyle="secondaryLabel">請在左側選擇內容，詳細指法會顯示在這裡。</Text>
          </Section>,
        ]}
      </List>
    </HStack>
  )
}

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i)
const noteLabel = (pc: number): string => NOTE_LABELS[mod12(pc)]

// 兩個固定的取名函式：identity 穩定，才能放進 useMemo 的依賴
const SHARP_NAMER = (pc: number): string => SHARP_NAMES[mod12(pc)]
const FLAT_NAMER = (pc: number): string => FLAT_NAMES[mod12(pc)]
const noteName = (flats: boolean) => (flats ? FLAT_NAMER : SHARP_NAMER)

// 可重現的亂數：回傳 [0,1) 的值與下一個 seed（純函式）
const nextRandom = (seed: number): [number, number] => {
  const s = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(s ^ (s >>> 15), 1 | s)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, s]
}
// Fisher–Yates 的不可變版本：每一步產生新陣列，不修改輸入
const shuffled = <T,>(items: readonly T[], seed: number): T[] => {
  const result = range(Math.max(0, items.length - 1)).reduce<{ arr: readonly T[]; s: number }>(
    (acc, k) => {
      const i = items.length - 1 - k
      const [r, ns] = nextRandom(acc.s)
      const j = Math.floor(r * (i + 1))
      const arr = acc.arr.map((x, idx) => (idx === i ? acc.arr[j] : idx === j ? acc.arr[i] : x))
      return { arr, s: ns }
    },
    { arr: items, s: seed },
  )
  return [...result.arr]
}
const pick = <T,>(xs: readonly T[], seed: number): [T, number] => {
  const [r, next] = nextRandom(seed)
  return [xs[Math.floor(r * xs.length)], next]
}
const chunk = <T,>(xs: readonly T[], n: number): T[][] =>
  range(Math.ceil(xs.length / n)).map((i) => xs.slice(i * n, i * n + n) as T[])

// 預期內的失敗以資料表達，不丟例外；例外只留給真正的程式錯誤
type Result<E, A> =
  | { readonly ok: true; readonly value: A }
  | { readonly ok: false; readonly error: E }
const ok = <A,>(value: A): Result<never, A> => ({ ok: true, value })
const err = <E,>(error: E): Result<E, never> => ({ ok: false, error })
const unwrapOr = <E, A>(r: Result<E, A>, fallback: A): A => (r.ok ? r.value : fallback)
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)
// union 的 switch 收尾：新增成員卻漏處理時，編譯期就會報錯
const assertNever = (x: never): never => {
  throw new Error("未處理的情況：" + JSON.stringify(x))
}

/* ════════════════════════════════════════════════
 * 共用：和弦基礎型別
 * ════════════════════════════════════════════════ */
type KeyMode = "major" | "minor"
// 和弦類型的唯一來源：速查、進行、練習都用同一組 key；順階和弦只會出現其中三種
const QUALITY_KEYS = ["maj", "min", "7", "maj7", "m7", "sus2", "sus4", "add9", "m7b5", "dim", "aug"] as const
type QualityKey = (typeof QUALITY_KEYS)[number]
type ChordQuality = Extract<QualityKey, "maj" | "min" | "dim">
const isQualityKey = (v: unknown): v is QualityKey =>
  typeof v === "string" && (QUALITY_KEYS as readonly string[]).includes(v)
type Fret = number | null // null = 悶音不彈
interface Key { readonly tonic: PitchClass; readonly mode: KeyMode }
interface Barre { readonly fret: number; readonly from: number; readonly to: number }

const FLAT_MAJOR_TONICS = new Set([5, 10, 3, 8, 1, 6])
const FLAT_MINOR_TONICS = new Set([2, 7, 0, 5, 10, 3])
const prefersFlats = (k: Key): boolean =>
  (k.mode === "major" ? FLAT_MAJOR_TONICS : FLAT_MINOR_TONICS).has(k.tonic)

/* ════════════════════════════════════════════════
 * 共用：指板樣式、聲音與觸覺偏好（所有頁面共用）
 * ════════════════════════════════════════════════ */
type Accidental = "auto" | "sharp" | "flat"
type Orientation = "vertical" | "horizontal"
type PlayStyle = "block" | "strum" | "arpeggio"
type BoardLabel = "finger" | "name" | "none" // 指板上顯示：手指編號／音名／不顯示

// 優先使用系統語意色（深色模式、輔助使用設定會自動適配）
const PALETTES = {
  classic: { dot: "systemBlue", bar: "systemBlue", root: "systemOrange", good: "systemGreen", bad: "systemRed", question: "systemPurple" },
  forest: { dot: "#2e7d5b", bar: "#2e7d5b", root: "systemOrange", good: "systemGreen", bad: "systemRed", question: "systemPurple" },
  mono: { dot: "#48484a", bar: "#48484a", root: "systemOrange", good: "systemGreen", bad: "systemRed", question: "systemPurple" },
} as const
type PaletteKey = keyof typeof PALETTES
type Palette = (typeof PALETTES)[PaletteKey]
const PALETTE_KEYS: readonly PaletteKey[] = ["classic", "forest", "mono"]

/* ── 設計系統：版面與無障礙基準（細節見 docs/design-system.md） ── */
const TOUCH_MIN = 44 // 可點擊目標的最小邊長（pt），HIG 規範
// 指板、節奏圖等固定尺寸圖形內的文字，字級放大到這個上限就不再放大，避免被固定格高裁切；
// 一般文字（清單、按鈕、說明）仍完整跟隨動態字級
const BOARD_TYPE_SIZE = { to: "xxxLarge" } as const

/* ── 色彩對比（WCAG 2.x）：圓點內文字的顏色由底色決定，確保達 AA 4.5:1 ── */
type Rgb = readonly [number, number, number]
const INK_DARK = "#000000"
const INK_LIGHT = "#ffffff"
// 系統顏色在淺色／深色模式下的 RGB（iOS 系統色）；自訂色（十六進位）不隨模式改變
const SYSTEM_FILLS: Record<string, { readonly light: Rgb; readonly dark: Rgb }> = {
  systemBlue: { light: [0, 122, 255], dark: [10, 132, 255] },
  systemOrange: { light: [255, 149, 0], dark: [255, 159, 10] },
  systemGreen: { light: [52, 199, 89], dark: [48, 209, 88] },
  systemRed: { light: [255, 59, 48], dark: [255, 69, 58] },
  systemPurple: { light: [175, 82, 222], dark: [191, 90, 242] },
}
const hexToRgb = (hex: string): Rgb => [
  parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16),
]
const relativeLuminance = ([r, g, b]: Rgb): number => {
  const lin = (c: number) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}
const contrastRatio = (a: Rgb, b: Rgb): number => {
  const [la, lb] = [relativeLuminance(a), relativeLuminance(b)]
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}
// 一個底色在各模式下的實際 RGB；未知的顏色名稱回傳空陣列
const fillRgbs = (fill: string): readonly Rgb[] =>
  fill.startsWith("#") ? [hexToRgb(fill)]
    : SYSTEM_FILLS[fill] ? [SYSTEM_FILLS[fill].light, SYSTEM_FILLS[fill].dark] : []
const worstContrast = (fill: string, ink: string): number =>
  Math.min(...fillRgbs(fill).map((c) => contrastRatio(c, hexToRgb(ink))))
// 選出在所有模式下對比最高的字色（黑或白）
const inkOn = (fill: string): string =>
  fillRgbs(fill).length === 0 ? INK_LIGHT
    : worstContrast(fill, INK_DARK) >= worstContrast(fill, INK_LIGHT) ? INK_DARK : INK_LIGHT

// 可選的封閉和弦指型（與 MOVABLE_SHAPES 同序）；C、G 型伸張大，預設不啟用
const BARRE_SHAPE_NAMES: readonly string[] = ["E", "A", "D", "C", "G"]
const DEFAULT_BARRE_SHAPES: readonly string[] = ["E", "A", "D"]

interface DiagramPrefs {
  showStringNumbers: boolean // 標示 1–6 弦
  boardLabel: BoardLabel     // 指板標示：手指編號／音名／不顯示
  showSideNames: boolean     // 側邊顯示音名（和弦圖旁的音名列）
  highlightRoot: boolean     // 特別標示根音
  accidental: Accidental     // 升降記號偏好
  palette: PaletteKey        // 配色
  fretRows: number           // 和弦圖顯示的格數
  orientation: Orientation   // 指板方向：直式／橫式
  soundOn: boolean           // 啟用聲音
  autoPlay: boolean          // 切換和弦／換題時自動播放
  playStyle: PlayStyle       // 和弦播放方式
  haptics: boolean           // 觸覺回饋
  barreShapes: readonly string[] // 啟用的封閉和弦指型（E／A／D／C／G）
}
const DEFAULT_PREFS: DiagramPrefs = {
  showStringNumbers: true, boardLabel: "finger", showSideNames: true, highlightRoot: true,
  accidental: "auto", palette: "mono", fretRows: 4, orientation: "horizontal",
  soundOn: true, autoPlay: true, playStyle: "strum", haptics: true,
  barreShapes: DEFAULT_BARRE_SHAPES,
}

const resolveFlats = (acc: Accidental, auto: boolean): boolean =>
  acc === "auto" ? auto : acc === "flat"

// 觸覺回饋：沒有該 API 或呼叫失敗時一律靜默略過
type HapticKind = "success" | "error" | "light"
const haptic = (prefs: DiagramPrefs, kind: HapticKind): void => {
  if (!prefs.haptics) return
  try {
    const h = (globalThis as any).HapticFeedback
    if (!h) return
    if (kind === "success") h.notificationSuccess?.()
    else if (kind === "error") h.notificationError?.()
    else h.lightImpact?.()
  } catch { /* 忽略 */ }
}

/* ════════════════════════════════════════════════
 * 共用：聲音（固定使用 Karplus-Strong 合成）
 * 寫成 WAV 暫存檔後用 AVPlayer 播放，以 LRU 快取已渲染的檔案。
 * 對外只有 synth.warm / stop / play / playEvents。
 * 副作用（檔案、播放器）集中在 synth；renderWav 是受控的不純邊界（DSP 迴圈）。
 * ════════════════════════════════════════════════ */
const OPEN_MIDI: readonly number[] = [40, 45, 50, 55, 59, 64] // c = 0 → 6 弦：E2 A2 D3 G3 B3 E4
const midiOf = (c: number, fret: number): number => OPEN_MIDI[c] + fret

const SAMPLE_RATE = 22050

// vel：力度（0–1，省略視為 1），節奏頁用來表現強弱拍
interface NoteEvent { readonly midi: number; readonly at: number; readonly dur: number; readonly vel?: number }

const strumEvents = (midis: readonly number[], gap: number, dur: number): NoteEvent[] =>
  midis.map((midi, i) => ({ midi, at: i * gap, dur }))

// 把多個音符事件混成一段 16-bit 單聲道 WAV（Karplus-Strong）
const renderWav = (events: readonly NoteEvent[]): Uint8Array => {
  const end = events.reduce((m, e) => Math.max(m, e.at + e.dur), 0)
  const total = Math.ceil(end * SAMPLE_RATE)
  const mix = new Float32Array(total)
  let noise = 12345
  const rand = () => {
    noise = (Math.imul(noise, 1664525) + 1013904223) | 0
    return (noise >>> 0) / 4294967296 * 2 - 1
  }

  events.forEach((e) => {
    const start = Math.floor(e.at * SAMPLE_RATE)
    const noteLen = Math.floor(e.dur * SAMPLE_RATE)
    const fadeLen = Math.max(1, Math.min(Math.floor(0.08 * SAMPLE_RATE), noteLen))
    const freq = 440 * Math.pow(2, (e.midi - 69) / 12)
    const n = Math.max(2, Math.round(SAMPLE_RATE / freq))
    const vel = e.vel ?? 1

    // 激發音：白噪音先低通、再去直流，避免開頭爆音
    const buf = new Float32Array(n)
    for (let k = 0; k < n; k++) buf[k] = rand()
    for (let k = n - 1; k > 0; k--) buf[k] = (buf[k] + buf[k - 1]) * 0.5
    let mean = 0
    for (let k = 0; k < n; k++) mean += buf[k]
    mean /= n
    for (let k = 0; k < n; k++) buf[k] -= mean

    for (let k = 0; k < noteLen && start + k < total; k++) {
      const idx = k % n
      const next = (buf[idx] + buf[(idx + 1) % n]) * 0.5 * 0.997
      buf[idx] = next
      const fade = k > noteLen - fadeLen ? (noteLen - k) / fadeLen : 1
      mix[start + k] += next * 0.5 * fade * vel
    }
  })

  let peak = 0
  for (let k = 0; k < total; k++) peak = Math.max(peak, Math.abs(mix[k]))
  const gain = peak > 0.85 ? 0.85 / peak : 1

  const dataLen = total * 2
  const bytes = new Uint8Array(44 + dataLen)
  const view = new DataView(bytes.buffer)
  const str = (o: number, s: string) => { for (let k = 0; k < s.length; k++) view.setUint8(o + k, s.charCodeAt(k)) }
  str(0, "RIFF"); view.setUint32(4, 36 + dataLen, true); str(8, "WAVE")
  str(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true)
  view.setUint16(22, 1, true); view.setUint32(24, SAMPLE_RATE, true)
  view.setUint32(28, SAMPLE_RATE * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true)
  str(36, "data"); view.setUint32(40, dataLen, true)
  for (let k = 0; k < total; k++) {
    const v = Math.max(-1, Math.min(1, mix[k] * gain))
    view.setInt16(44 + k * 2, Math.round(v * 32767), true)
  }
  return bytes
}

const synth = (() => {
  const SESSION = Date.now().toString(36)
  const MAX_CACHE = 24
  let counter = 0
  let ticket = 0 // 連點時只讓最後一次請求真的發聲
  let player: AVPlayer | null = null
  let playingPath: string | null = null
  const cache = new Map<string, string>() // 事件內容 → 檔案路徑（Map 保留插入順序，當 LRU 用）

  // 每次播放前都重新啟用工作階段：被來電、Siri、其他 App 打斷後才能恢復
  const prepareSession = async (): Promise<void> => {
    try {
      await SharedAudioSession.setCategory("playback", ["mixWithOthers"])
      await SharedAudioSession.setActive(true)
    } catch (e) {
      console.error("音訊工作階段設定失敗：" + String(e))
    }
  }

  const keyOf = (events: readonly NoteEvent[]): string =>
    events.map((e) =>
      `${e.midi}@${e.at.toFixed(3)}:${e.dur.toFixed(2)}${e.vel === undefined ? "" : `v${e.vel.toFixed(2)}`}`,
    ).join("|")

  const fileStillExists = async (path: string): Promise<boolean> => {
    try { return await FileManager.exists(path) } catch { return true }
  }

  const pathFor = async (events: readonly NoteEvent[]): Promise<string> => {
    const key = keyOf(events)
    const hit = cache.get(key)
    if (hit) {
      if (await fileStillExists(hit)) { cache.delete(key); cache.set(key, hit); return hit }
      cache.delete(key) // 暫存檔被系統清掉了，重新渲染
    }

    // 先讓出一次執行緒，避免渲染長進行時畫面卡住
    await new Promise<void>((r) => setTimeout(r, 0))
    const path = `${FileManager.temporaryDirectory}/pluck_${SESSION}_${counter++}.wav`
    await FileManager.writeAsBytes(path, renderWav(events))
    cache.set(key, path)

    const excess = cache.size - MAX_CACHE
    if (excess > 0) {
      const victims = [...cache.entries()].filter(([, p]) => p !== playingPath && p !== path).slice(0, excess)
      victims.forEach(([k]) => cache.delete(k))
      for (const [, p] of victims) { try { await FileManager.remove(p) } catch { /* 忽略 */ } }
    }
    return path
  }

  const halt = () => {
    if (player) {
      try { player.stop() } catch { /* 忽略 */ }
      try { player.dispose() } catch { /* 忽略 */ }
      player = null
    }
    playingPath = null
  }

  return {
    warm(): void { void prepareSession() },
    stop(): void { ticket++; halt() },
    async playEvents(events: readonly NoteEvent[]): Promise<void> {
      if (events.length === 0) return
      const mine = ++ticket
      try {
        await prepareSession()
        if (mine !== ticket) return

        const path = await pathFor(events)
        if (mine !== ticket) return
        halt()
        playingPath = path
        const p = new AVPlayer()
        let started = false
        const go = () => { if (!started && player === p) { started = true; p.play() } }
        p.onReadyToPlay = go
        p.onError = (msg: string) => { console.error("AVPlayer 錯誤：" + msg) }
        player = p
        if (!p.setSource(path)) throw new Error("setSource 失敗：" + path)
        // 保險：若 0.4 秒內沒收到 onReadyToPlay，直接嘗試播放
        setTimeout(go, 400)
      } catch (e) {
        console.error("播放失敗：" + String(e))
      }
    },
    // gap：每個音相隔秒數（0 = 同時、0.04 = 刷弦、0.3 = 琶音）
    async play(midis: number[], gap = 0, dur = 1.8): Promise<void> {
      return this.playEvents(strumEvents(midis, gap, dur))
    },
  }
})()


const STYLE_GAP: Record<PlayStyle, number> = { block: 0, strum: 0.04, arpeggio: 0.3 }

// 單音（c = 0 → 6 弦）
const playNote = (c: number, fret: number): void => { void synth.play([midiOf(c, fret)], 0, 1.6) }

// 和弦：悶音（null）自動略過，由低音弦到高音弦依序發聲
const playChord = (frets: readonly Fret[], style: PlayStyle = "strum"): void => {
  const midis = frets.flatMap((f, c) => (f === null ? [] : [midiOf(c, f)]))
  void synth.play(midis, STYLE_GAP[style], style === "arpeggio" ? 2.5 : 1.8)
}

// 整段和弦進行：每個和弦佔 beats 拍，尾音略為重疊，聽起來比較連貫
const progressionEvents = (
  chords: readonly (readonly Fret[])[], bpm: number, beats: number, style: PlayStyle,
): NoteEvent[] => {
  const span = (60 / bpm) * beats
  return chords.flatMap((frets, i) => {
    const midis = frets.flatMap((f, c) => (f === null ? [] : [midiOf(c, f)]))
    const gap = Math.min(STYLE_GAP[style], span / (midis.length + 1))
    return midis.map((midi, k): NoteEvent => ({ midi, at: i * span + k * gap, dur: span + 0.35 }))
  })
}

/* ════════════════════════════════════════════════
 * 共用：指法（自動推算橫按與手指編號）
 * ════════════════════════════════════════════════ */
interface DiagramSpec {
  readonly frets: readonly Fret[]       // 6→1 弦，null = 悶音
  readonly fingers?: readonly number[]  // 0 = 不用手指；省略則自動推算
  readonly barre?: Barre
  readonly root: PitchClass
}

/* 慣例指法覆寫：以「6→1 弦的格數」為鍵（x＝悶音），值為手指編號（0＝不用手指）。
 * 沒有列在這裡的按法，仍由 resolveFingering 自動推算。 */
const FINGER_FIX: Record<string, { fingers: number[]; barre?: Barre }> = {
  // 食指橫按 B、e 兩弦（第 1 格），中指按 G 弦
  "x,x,0,2,1,1": { fingers: [0, 0, 0, 2, 1, 1], barre: { fret: 1, from: 4, to: 5 } }, // Dm7
  "3,2,0,0,0,2": { fingers: [3, 2, 0, 0, 0, 1] },        // Gmaj7（6 弦 3、A 弦 2、1 弦 1）
  "0,2,2,0,0,0": { fingers: [0, 2, 3, 0, 0, 0] },        // Em（A 弦 2、D 弦 3）
  "0,2,0,0,0,0": { fingers: [0, 2, 0, 0, 0, 0] },        // Em7
  "x,3,2,0,0,0": { fingers: [0, 3, 2, 0, 0, 0] },        // Cmaj7（與 C 和弦同指型）
  "x,3,2,0,3,0": { fingers: [0, 3, 2, 0, 4, 0] },        // Cadd9（小指按 B 弦）
  "x,x,0,2,3,3": { fingers: [0, 0, 0, 1, 3, 4] },        // Dsus4（由 D 和弦加小指）
  "x,0,2,4,2,0": { fingers: [0, 0, 1, 4, 2, 0] },        // Aadd9（食指 D、小指 G、中指 B）
}

const fretsKeyOf = (frets: readonly Fret[]): string =>
  frets.map((f) => (f === null ? "x" : String(f))).join(",")


const resolveFingering = (frets: readonly Fret[]): { fingers: number[]; barre?: Barre } => {
  const fixed = FINGER_FIX[fretsKeyOf(frets)]
  if (fixed) return { fingers: [...fixed.fingers], barre: fixed.barre }
  const fretted = frets
    .map((f, c) => ({ f, c }))
    .filter((x): x is { f: number; c: number } => x.f !== null && x.f > 0)
  const fingers = frets.map(() => 0)
  if (fretted.length === 0) return { fingers }

  const minF = Math.min(...fretted.map((x) => x.f))
  const atMin = fretted.filter((x) => x.f === minF)
  const hasOpen = frets.some((f) => f === 0)

  let barre: Barre | undefined
  if (atMin.length >= 2 && !hasOpen) {
    const from = atMin[0].c
    const to = atMin[atMin.length - 1].c
    const covered = frets.slice(from, to + 1).every((f) => f !== null && f >= minF)
    if (covered) barre = { fret: minF, from, to }
  }

  const inBar = (x: { f: number; c: number }) =>
    !!barre && x.f === barre.fret && x.c >= barre.from && x.c <= barre.to
  if (barre) for (let c = barre.from; c <= barre.to; c++) fingers[c] = 1

  const rest = fretted.filter((x) => !inBar(x))
  let next = barre ? 2 : 1
  const levels = Array.from(new Set(rest.map((x) => x.f))).sort((a, b) => a - b)
  levels.forEach((fr) => {
    const group = rest.filter((x) => x.f === fr).sort((a, b) => a.c - b.c)
    if (barre && group.length >= 3) {
      const fin = Math.min(next + 1, 4)
      group.forEach((x) => { fingers[x.c] = fin })
      next = fin + 1
    } else {
      group.forEach((x) => { fingers[x.c] = Math.min(next, 4); next += 1 })
    }
  })
  return { fingers, barre }
}

/* ════════════════════════════════════════════════
 * 共用：和弦資料庫（和弦速查、和弦練習、和弦進行共用）
 * ════════════════════════════════════════════════ */
type FinderQuality = { key: QualityKey; intervals: number[]; suffix: string }

const FINDER_QUALITIES: FinderQuality[] = [
  { key: "maj", intervals: [0, 4, 7], suffix: "" },
  { key: "min", intervals: [0, 3, 7], suffix: "m" },
  { key: "7", intervals: [0, 4, 7, 10], suffix: "7" },
  { key: "maj7", intervals: [0, 4, 7, 11], suffix: "maj7" },
  { key: "m7", intervals: [0, 3, 7, 10], suffix: "m7" },
  { key: "sus2", intervals: [0, 2, 7], suffix: "sus2" },
  { key: "sus4", intervals: [0, 5, 7], suffix: "sus4" },
  { key: "add9", intervals: [0, 4, 7, 14], suffix: "add9" },
  { key: "m7b5", intervals: [0, 3, 6, 10], suffix: "m7♭5" },

  { key: "dim", intervals: [0, 3, 6], suffix: "dim" },
  { key: "aug", intervals: [0, 4, 8], suffix: "aug" },
]
const qualityDef = (key: QualityKey): FinderQuality =>
  FINDER_QUALITIES.find((q) => q.key === key) ?? FINDER_QUALITIES[0]

// 開放和弦（6弦→1弦，x 代表不彈）
const OPEN: Record<string, string> = {
  "0-maj": "x32010", "2-maj": "xx0232", "4-maj": "022100", "7-maj": "320003", "9-maj": "x02220",
  "9-min": "x02210", "4-min": "022000", "2-min": "xx0231",
  "0-7": "x32310", "7-7": "320001", "2-7": "xx0212", "4-7": "020100", "9-7": "x02020", "11-7": "x21202",
  "0-maj7": "x32000", "5-maj7": "xx3210", "7-maj7": "320002", "9-maj7": "x02120", "2-maj7": "xx0222",
  "9-m7": "x02010", "4-m7": "020000", "2-m7": "xx0211",
  "9-sus2": "x02200", "9-sus4": "x02230", "2-sus2": "xx0230", "2-sus4": "xx0233", "4-sus4": "022200",
  "0-add9": "x32030",
  "0-sus2": "x30033", "7-sus2": "300033", "7-sus4": "330013",
  "4-add9": "022102", "7-add9": "320203", "11-m7": "x20202",
}

/* 可移動指型（CAGED 與常見變化）：以「6→1 弦相對於橫按格的格數」表示，-1＝悶音。
 * 同一類型可有多個按法（第一個為主要按法，其餘標示「變化」）。
 * rootString／rootOffset：根音所在的弦（0＝6 弦）與該弦相對橫按格的格數，用來推算橫按位置。 */
type MovableShape = {
  readonly name: string
  readonly rootString: number
  readonly rootOffset: number
  readonly forms: Partial<Record<QualityKey, readonly (readonly number[])[]>>
}
const MOVABLE_SHAPES: readonly MovableShape[] = [
  { name: "E", rootString: 0, rootOffset: 0, forms: {
    maj: [[0, 2, 2, 1, 0, 0]], min: [[0, 2, 2, 0, 0, 0]],
    "7": [[0, 2, 0, 1, 0, 0], [0, 2, 2, 1, 3, 0]],
    maj7: [[0, 2, 1, 1, 0, 0]], m7: [[0, 2, 0, 0, 0, 0], [0, 2, 2, 0, 3, 0]],
    sus4: [[0, 2, 2, 2, 0, 0]], sus2: [[0, 2, 4, 4, 0, 0]], aug: [[0, 3, 2, 1, 1, 0]],
  } },
  { name: "A", rootString: 1, rootOffset: 0, forms: {
    maj: [[-1, 0, 2, 2, 2, 0]], min: [[-1, 0, 2, 2, 1, 0]],
    "7": [[-1, 0, 2, 0, 2, 0], [-1, 0, 2, 2, 2, 3]],
    maj7: [[-1, 0, 2, 1, 2, 0]], m7: [[-1, 0, 2, 0, 1, 0], [-1, 0, 2, 2, 1, 3]],
    sus2: [[-1, 0, 2, 2, 0, 0]], sus4: [[-1, 0, 2, 2, 3, 0]], add9: [[-1, 0, 2, 4, 2, 0]],
    dim: [[-1, 0, 1, 2, 1, -1]], aug: [[-1, 0, 3, 2, 2, 1]], m7b5: [[-1, 0, 1, 0, 1, -1]],
  } },
  { name: "D", rootString: 2, rootOffset: 0, forms: {
    maj: [[-1, -1, 0, 2, 3, 2]], min: [[-1, -1, 0, 2, 3, 1]],
    "7": [[-1, -1, 0, 2, 1, 2]], maj7: [[-1, -1, 0, 2, 2, 2]], m7: [[-1, -1, 0, 2, 1, 1]],
    sus2: [[-1, -1, 0, 2, 3, 0]], sus4: [[-1, -1, 0, 2, 3, 3]],
    dim: [[-1, -1, 0, 1, 3, 1]], aug: [[-1, -1, 0, 3, 3, 2]], m7b5: [[-1, -1, 0, 1, 1, 1]],
  } },
  { name: "C", rootString: 1, rootOffset: 3, forms: {
    maj: [[-1, 3, 2, 0, 1, 0]], "7": [[-1, 3, 2, 3, 1, 0]], maj7: [[-1, 3, 2, 0, 0, 0]],
  } },
  { name: "G", rootString: 0, rootOffset: 3, forms: {
    maj: [[3, 2, 0, 0, 0, 3]], "7": [[3, 2, 0, 0, 0, 1]],
  } },
]

type VoicingKind = "open" | "barre"
// 按法的來源：開放和弦表，或可移動指型（E／A／D／C／G）移到第 fret 格；中文名稱由 UI 的 voicingTitle 產生
type VoicingOrigin =
  | { readonly type: "open" }
  | { readonly type: "shape"; readonly shape: string; readonly fret: number; readonly variant: boolean }
// rebassed：為了指定低音（斜線和弦）而換過低音
type FinderVoicing = {
  readonly origin: VoicingOrigin; readonly rebassed: boolean
  readonly kind: VoicingKind; readonly frets: Fret[] // null 不彈，0 空弦
}

const parseOpen = (s: string): Fret[] =>
  s.split("").map(c => (c === "x" ? null : parseInt(c, 10)))

function buildVoicings(root: number, q: QualityKey): FinderVoicing[] {
  const list: FinderVoicing[] = []
  const seen = new Set<string>()
  const add = (origin: VoicingOrigin, kind: VoicingKind, frets: Fret[]) => {
    const k = frets.join(",")
    if (seen.has(k)) return
    if (Math.max(...frets.filter((f): f is number => f !== null)) > 15) return
    seen.add(k)
    list.push({ origin, rebassed: false, kind, frets })
  }

  const open = OPEN[`${root}-${q}`]
  if (open) add({ type: "open" }, "open", parseOpen(open))

  MOVABLE_SHAPES.forEach((shape) => {
    const forms = shape.forms[q]
    if (!forms) return
    const f = mod12(root - OPEN_STRINGS[shape.rootString] - shape.rootOffset)
    forms.forEach((offsets, i) => {
      add({ type: "shape", shape: shape.name, fret: f, variant: i > 0 },
        f === 0 ? "open" : "barre",
        offsets.map((o) => (o < 0 ? null : o + f)))
    })
  })
  return list
}

// 指法是純資料，依（根音, 類型）快取，避免每次渲染重算
const voicingCache = new Map<string, FinderVoicing[]>()
const getVoicings = (root: number, q: QualityKey): FinderVoicing[] => {
  const k = `${root}-${q}`
  const hit = voicingCache.get(k)
  if (hit) return hit
  const v = buildVoicings(root, q)
  voicingCache.set(k, v)
  return v
}

/* 斜線和弦（分數和弦，指定低音）：C/G
 * 做法：以既有按法為基礎，把最低音換成指定的低音，
 * 並悶掉更低的弦；若剩下的音湊不出根音與三音、或手指跨度過大，就捨棄該按法。
 */
const buildSlashVoicings = (root: PitchClass, q: QualityKey, bass: PitchClass): FinderVoicing[] => {
  const def = qualityDef(q)
  const need = [def.intervals[0], def.intervals[1]].map((i) => mod12(root + i))
  const out: FinderVoicing[] = []
  const seen = new Set<string>()
  const push = (origin: VoicingOrigin, rebassed: boolean, frets: Fret[]) => {
    const k = frets.join(",")
    if (seen.has(k)) return
    seen.add(k)
    const kind: VoicingKind = frets.some((f) => f === 0) ? "open" : "barre"
    out.push({ origin, rebassed, kind, frets })
  }

  getVoicings(root, q).forEach((v) => {
    const lowest = v.frets.findIndex((f) => f !== null)
    if (lowest >= 0 && mod12(OPEN_STRINGS[lowest] + (v.frets[lowest] as number)) === bass) {
      push(v.origin, v.rebassed, v.frets)
      return
    }
    const fretted = v.frets.filter((f): f is number => f !== null && f > 0)
    const ref = fretted.length ? fretted.reduce((a, b) => a + b, 0) / fretted.length : 0

    let best: { cost: number; frets: Fret[] } | null = null
    for (let c = 0; c <= 4; c++) {
      for (let f = 0; f <= 15; f++) {
        if (mod12(OPEN_STRINGS[c] + f) !== bass) continue
        const frets: Fret[] = v.frets.map((x, i) => (i < c ? null : i === c ? f : x))
        if (frets.filter((x) => x !== null).length < 3) continue
        const upperPcs = frets.flatMap((x, i) => (i > c && x !== null ? [mod12(OPEN_STRINGS[i] + x)] : []))
        if (!need.every((pc) => upperPcs.includes(pc))) continue
        const pos = frets.filter((x): x is number => x !== null && x > 0)
        if (pos.length > 0 && Math.max(...pos) - Math.min(...pos) > 3) continue
        const muted = v.frets.slice(0, c).filter((x) => x !== null).length
        const orig = v.frets[c]
        const cost = muted * 1.5 + Math.abs(f - ref)
          + (orig === null ? 0.5 : 0) + (orig !== null && orig !== f ? 0.5 : 0)
        if (!best || cost < best.cost) best = { cost, frets }
      }
    }
    if (best) {
      const same = best.frets.join(",") === v.frets.join(",")
      push(v.origin, v.rebassed || !same, best.frets)
    }
  })
  return out
}

const slashCache = new Map<string, FinderVoicing[]>()
const getSlashVoicings = (root: PitchClass, q: QualityKey, bass: PitchClass): FinderVoicing[] => {
  const k = `${root}-${q}-${bass}`
  const hit = slashCache.get(k)
  if (hit) return hit
  const v = buildSlashVoicings(root, q, bass)
  slashCache.set(k, v)
  return v
}

/* ════════════════════════════════════════════════
 * 共用：指板元件（所有頁面都用它，支援直式／橫式）
 * 直式：左→右 = 6→1 弦，上→下 = 低→高格
 * 橫式：上→下 = 1→6 弦，左→右 = 低→高格
 * 格子尺寸由「可用寬度」推算（fitCell），純函式、無固定尺寸。
 * ════════════════════════════════════════════════ */
type StringNo = 1 | 2 | 3 | 4 | 5 | 6
const STRINGS: readonly StringNo[] = [1, 2, 3, 4, 5, 6]
const STRING_THICKNESS: Record<StringNo, number> = { 1: 1, 2: 1.5, 3: 2, 4: 2.5, 5: 3, 6: 3.5 }
const INLAY_FRETS: readonly number[] = [3, 5, 7, 9, 12, 15, 17, 19, 21]

const GUTTER = 34     // 直式：左側格數編號欄寬
const H_LABEL_W = 22  // 橫式：弦號欄寬
const H_MARK_W = 24   // 橫式：空弦／悶音欄寬
const H_NAME_W = 30   // 橫式：側邊音名欄寬

// 格子尺寸：w = 沿格數方向或弦間距的寬、h = 高、dot = 圓點直徑
interface CellDim { readonly w: number; readonly h: number; readonly dot: number }
const DEFAULT_CELL: CellDim = { w: 44, h: 44, dot: 28 }

// 格子高度：觸控範圍不小於 44pt（符合 HIG）；只有 iPad 的指板寬度會 ≥ 560
const cellHeightFor = (width?: number): number =>
  width !== undefined && width >= 560 ? TOUCH_MIN + 4 : TOUCH_MIN

const fitCell = (
  o: Orientation, width: number | undefined, rows: number, horizontalExtras: number,
): CellDim => {
  if (width === undefined || width <= 0) return DEFAULT_CELL
  const w = o === "vertical"
    ? clamp(Math.floor((width - GUTTER) / STRING_COUNT), 40, 72)
    : clamp(Math.floor((width - horizontalExtras) / rows), 36, 64)
  const h = cellHeightFor(width)
  return { w, h, dot: Math.min(34, Math.floor(Math.min(w, h) * 0.64)) }
}

type Tone = "dot" | "root" | "ghost" | "question" | "good" | "bad" | "hollow"
interface Mark { readonly c: number; readonly fret: number; readonly tone: Tone; readonly text: string }
type NutMark = "open" | "openRoot" | "mute" | null
interface NameCell { readonly text: string; readonly root: boolean }

// 橫按在這個格子的延伸方向（before = 左／上，after = 右／下）
interface BarFlags { readonly before: boolean; readonly after: boolean }
const barFlagsOf = (
  bar: Barre | undefined, c: number, fret: number, o: Orientation,
): BarFlags | null => {
  if (!bar || bar.fret !== fret || c < bar.from || c > bar.to) return null
  const lower = c > bar.from   // 有 c 較小的鄰格
  const higher = c < bar.to    // 有 c 較大的鄰格
  return o === "vertical"
    ? { before: lower, after: higher }
    : { before: higher, after: lower }
}

function BarShape(props: { o: Orientation; cell: CellDim; flags: BarFlags; pal: Palette }) {
  const { o, cell, flags, pal } = props
  const { w, h, dot } = cell
  const v = o === "vertical"
  if (flags.before && flags.after) {
    return <Rectangle fill={pal.bar}
      frame={v ? { width: w, height: dot } : { width: dot, height: h }} />
  }
  const piece = (
    <Rectangle fill={pal.bar}
      frame={v ? { width: w / 2, height: dot } : { width: dot, height: h / 2 }} />
  )
  return (
    <ZStack>
      <Circle fill={pal.bar} frame={{ width: dot, height: dot }} />
      {flags.before ? (
        v ? <HStack spacing={0}>{piece}<Spacer /></HStack>
          : <VStack spacing={0}>{piece}<Spacer /></VStack>
      ) : null}
      {flags.after ? (
        v ? <HStack spacing={0}><Spacer />{piece}</HStack>
          : <VStack spacing={0}><Spacer />{piece}</VStack>
      ) : null}
    </ZStack>
  )
}

function BoardCell(props: {
  o: Orientation
  cell: CellDim
  c: number
  mark?: Mark
  bar: BarFlags | null
  pal: Palette
  tapLabel?: string
  onTap?: () => void
}) {
  const { o, cell, c, mark, bar, pal, tapLabel, onTap } = props
  const { w, h, dot } = cell
  const v = o === "vertical"
  const thick = STRING_THICKNESS[(STRING_COUNT - c) as StringNo]
  const tone = mark?.tone
  const barOwnsDot = bar !== null && tone === "dot"
  const hasCircle = !!mark && tone !== "ghost" && tone !== "hollow" && !barOwnsDot
  const fill =
    tone === "root" ? pal.root
      : tone === "good" ? pal.good
        : tone === "bad" ? pal.bad
          : tone === "question" ? pal.question
            : pal.dot
  // 字色由底色的對比決定（inkOn），不寫死
  const textColor = tone === "ghost" || tone === "hollow" ? "secondaryLabel" : inkOn(fill)

  return (
    <ZStack frame={{ width: w, height: h }}>
      {v ? (
        <VStack spacing={0}>
          <Spacer />
          <Rectangle fill="systemGray3" frame={{ width: w, height: 1.5 }} />
        </VStack>
      ) : (
        <HStack spacing={0}>
          <Spacer />
          <Rectangle fill="systemGray3" frame={{ width: 1.5, height: h }} />
        </HStack>
      )}
      <Rectangle fill="systemGray"
        frame={v ? { width: thick, height: h } : { width: w, height: thick }} />
      {bar ? <BarShape o={o} cell={cell} flags={bar} pal={pal} /> : null}
      {hasCircle ? <Circle fill={fill} frame={{ width: dot, height: dot }} /> : null}
      {tone === "hollow" ? (
        <ZStack>
          <Circle fill="systemGray" frame={{ width: dot, height: dot }} />
          <Circle fill="systemBackground" frame={{ width: dot - 4, height: dot - 4 }} />
        </ZStack>
      ) : null}
      {mark && mark.text ? (
        <Text font="caption2" fontWeight="bold" foregroundStyle={textColor}>{mark.text}</Text>
      ) : null}
      {onTap ? (
        <Rectangle fill="systemBackground" opacity={0.01}
          accessibilityLabel={tapLabel} accessibilityAddTraits="isButton"
          frame={{ width: w, height: h }} onTapGesture={onTap} />
      ) : null}
    </ZStack>
  )
}

function NutMarkView(props: { m: NutMark; pal: Palette; w: number; h: number }) {
  const { m, pal, w, h } = props
  return (
    <ZStack frame={{ width: w, height: h }}>
      {m === "mute" ? <Text font="callout" foregroundStyle="secondaryLabel">{"×"}</Text> : null}
      {m === "open" || m === "openRoot" ? (
        <ZStack>
          <Circle fill={m === "openRoot" ? pal.root : "systemGray"} frame={{ width: 15, height: 15 }} />
          <Circle fill="systemBackground" frame={{ width: 9, height: 9 }} />
        </ZStack>
      ) : null}
    </ZStack>
  )
}

interface FretboardProps {
  readonly startFret: number
  readonly rows: number
  readonly marks: readonly Mark[]
  readonly bar?: Barre
  readonly nutMarks?: readonly NutMark[]
  readonly names?: readonly NameCell[]
  readonly prefs: DiagramPrefs
  readonly width?: number // 可用寬度：有給就依寬度撐滿，沒給就用預設 44pt
  readonly label?: string // 無障礙說明：整張圖合成一個元素；有 onTap 時改為逐格說明
  readonly onTap?: (c: number, fret: number) => void
}

function Fretboard(props: FretboardProps) {
  const { startFret, rows, marks, bar, nutMarks, names, prefs, width, onTap, label } = props
  const posName = noteName(prefs.accidental === "flat")
  const a11y = label !== undefined && !onTap
    ? { accessibilityElement: "ignore", accessibilityLabel: label }
    : {}
  const pal = PALETTES[prefs.palette]
  const o = prefs.orientation
  const fretNos = range(rows).map((i) => startFret + i)
  const hasNut = startFret <= 1
  const nutThick = hasNut ? 5 : 1.5
  const fretLabel = (f: number) => (INLAY_FRETS.includes(f) ? `${f}•` : `${f}`)

  const extras = (prefs.showStringNumbers ? H_LABEL_W : 0) + (nutMarks ? H_MARK_W : 0)
    + nutThick + (names ? H_NAME_W : 0)
  const cell = fitCell(o, width, rows, extras)
  const { w, h } = cell

  // 以 Map 查標記：每格 O(1)，13 格 × 6 弦時不再每格掃一遍陣列
  const markMap = useMemo(() => {
    const m = new Map<string, Mark>()
    marks.forEach((mk) => m.set(`${mk.c}:${mk.fret}`, mk))
    return m
  }, [marks])

  const cellOf = (c: number, f: number) => (
    <BoardCell key={f} o={o} cell={cell} c={c} pal={pal}
      mark={markMap.get(`${c}:${f}`)}
      bar={barFlagsOf(bar, c, f, o)}
      tapLabel={describePosition(c, f, posName)}
      onTap={onTap ? () => onTap(c, f) : undefined} />
  )

  if (o === "vertical") {
    const cols = range(STRING_COUNT)
    return (
      <VStack spacing={0} dynamicTypeSize={BOARD_TYPE_SIZE} {...a11y}>
        {prefs.showStringNumbers ? (
          <HStack spacing={0}>
            <Text font="caption2" foregroundStyle="secondaryLabel"
              frame={{ width: GUTTER, height: 20 }}>{"弦"}</Text>
            {cols.map((c) => (
              <Text key={c} font="caption" fontWeight="bold" foregroundStyle="secondaryLabel"
                frame={{ width: w, height: 20 }}>{String(STRING_COUNT - c)}</Text>
            ))}
          </HStack>
        ) : null}

        {nutMarks ? (
          <HStack spacing={0}>
            <Text frame={{ width: GUTTER, height: 24 }}>{""}</Text>
            {nutMarks.map((m, c) => <NutMarkView key={c} m={m} pal={pal} w={w} h={24} />)}
          </HStack>
        ) : null}

        <HStack spacing={0}>
          <Text frame={{ width: GUTTER, height: nutThick }}>{""}</Text>
          <Rectangle fill={hasNut ? "label" : "systemGray3"}
            frame={{ width: w * STRING_COUNT, height: nutThick }} />
        </HStack>

        {fretNos.map((f) => (
          <HStack key={f} spacing={0}>
            <Text font="caption2" foregroundStyle="secondaryLabel"
              frame={{ width: GUTTER, height: h }}>{fretLabel(f)}</Text>
            {cols.map((c) => <HStack key={c} spacing={0}>{cellOf(c, f)}</HStack>)}
          </HStack>
        ))}

        {names ? (
          <HStack spacing={0}>
            <Text font="caption2" foregroundStyle="secondaryLabel"
              frame={{ width: GUTTER, height: 28 }}>{"音"}</Text>
            {names.map((n, c) => (
              <Text key={c} font="caption" fontWeight="bold"
                foregroundStyle="label"
                frame={{ width: w, height: 28 }}>{n.text}</Text>
            ))}
          </HStack>
        ) : null}
      </VStack>
    )
  }

  // 橫式：第 1 弦在上、第 6 弦在下（c = 5 → 0）
  const strRows = range(STRING_COUNT).map((r) => STRING_COUNT - 1 - r)
  const leftW = (prefs.showStringNumbers ? H_LABEL_W : 0) + (nutMarks ? H_MARK_W : 0) + nutThick

  return (
    <VStack spacing={0} dynamicTypeSize={BOARD_TYPE_SIZE} {...a11y}>
      <HStack spacing={0}>
        <Text frame={{ width: leftW, height: 20 }}>{""}</Text>
        {fretNos.map((f) => (
          <Text key={f} font="caption2" foregroundStyle="secondaryLabel"
            frame={{ width: w, height: 20 }}>{fretLabel(f)}</Text>
        ))}
        {names ? (
          <Text font="caption2" foregroundStyle="secondaryLabel"
            frame={{ width: H_NAME_W, height: 20 }}>{"音"}</Text>
        ) : null}
      </HStack>
      {strRows.map((c) => (
        <HStack key={c} spacing={0}>
          {prefs.showStringNumbers ? (
            <Text font="caption" fontWeight="bold" foregroundStyle="secondaryLabel"
              frame={{ width: H_LABEL_W, height: h }}>{String(STRING_COUNT - c)}</Text>
          ) : null}
          {nutMarks ? <NutMarkView m={nutMarks[c]} pal={pal} w={H_MARK_W} h={h} /> : null}
          <Rectangle fill={hasNut ? "label" : "systemGray3"}
            frame={{ width: nutThick, height: h }} />
          {fretNos.map((f) => cellOf(c, f))}
          {names ? (
            <Text font="caption" fontWeight="bold"
              foregroundStyle="label"
              frame={{ width: H_NAME_W, height: h }}>{names[c].text}</Text>
          ) : null}
        </HStack>
      ))}
    </VStack>
  )
}

/* 無障礙文字替代：指板與和弦圖是圖形，VoiceOver 需要用文字說出位置與音名 */
const STRING_ORDINAL_ZH: readonly string[] = ["六", "五", "四", "三", "二", "一"] // c = 0 → 第六弦
const describePosition = (c: number, fret: number, nm: (pc: number) => string): string =>
  `${fret === 0 ? "空弦" : `第 ${fret} 格`}，第${STRING_ORDINAL_ZH[c]}弦，音名 ${nm(OPEN_STRINGS[c] + fret)}`
const describeVoicing = (frets: readonly Fret[], nm: (pc: number) => string): string =>
  frets.map((f, c) => (f === null
    ? `第${STRING_ORDINAL_ZH[c]}弦悶音`
    : describePosition(c, f, nm))).join("；")

/* 由「指法」換算成指板元件需要的資料 */
interface BoardModel {
  startFret: number
  rows: number
  marks: Mark[]
  bar?: Barre
  nutMarks: NutMark[]
  names?: NameCell[]
}
const boardFromSpec = (
  spec: DiagramSpec, prefs: DiagramPrefs, nm: (pc: PitchClass) => string,
): BoardModel => {
  const auto = resolveFingering(spec.frets)
  const fingers = spec.fingers ?? auto.fingers
  const bar = spec.barre ?? (spec.fingers ? undefined : auto.barre)
  const rows = prefs.fretRows
  const showFingers = prefs.boardLabel === "finger"
  const showNames = prefs.boardLabel === "name"

  const fretted = spec.frets.filter((f): f is number => f !== null && f > 0)
  const minF = fretted.length ? Math.min(...fretted) : 1
  const maxF = fretted.length ? Math.max(...fretted) : 1
  const startFret = maxF <= rows ? 1 : minF

  const pcOf = (c: number, f: number): PitchClass => mod12(OPEN_STRINGS[c] + f)
  const isRootAt = (c: number, f: number) => prefs.highlightRoot && pcOf(c, f) === spec.root
  const inBar = (c: number, f: number) =>
    !!bar && f === bar.fret && c >= bar.from && c <= bar.to

  const marks = spec.frets.flatMap<Mark>((f, c) => {
    if (f === null || f <= 0) return []
    const name = nm(pcOf(c, f))
    const finger = fingers[c] ?? 0
    const root = isRootAt(c, f)
    const text = inBar(c, f)
      ? (showFingers
        ? (c === bar?.from || root ? String(finger || 1) : "")
        : showNames ? name : "")
      : (showFingers
        ? (finger > 0 ? String(finger) : "")
        : showNames ? name : "")
    return [{ c, fret: f, tone: root ? "root" : "dot", text }]
  })

  const nutMarks: NutMark[] = spec.frets.map((f, c) =>
    f === null ? "mute" : f === 0 ? (isRootAt(c, 0) ? "openRoot" : "open") : null)

  // 側邊音名：由獨立開關控制，與指板圓點內的標示無關
  const names = prefs.showSideNames
    ? spec.frets.map((f, c): NameCell => (
      f === null ? { text: "×", root: false } : { text: nm(pcOf(c, f)), root: isRootAt(c, f) }))
    : undefined

  return { startFret, rows, marks, bar, nutMarks, names }
}

function ChordBoard(props: {
  spec: DiagramSpec; prefs: DiagramPrefs; nm: (pc: PitchClass) => string; width?: number
}) {
  const { spec, prefs, nm, width } = props
  const fretsKey = spec.frets.join(",")
  const fingersKey = spec.fingers ? spec.fingers.join(",") : ""
  const barKey = spec.barre ? `${spec.barre.fret}:${spec.barre.from}:${spec.barre.to}` : ""
  // 只在指法或影響外觀的設定改變時才重算
  const m = useMemo(
    () => boardFromSpec(spec, prefs, nm),
    [fretsKey, fingersKey, barKey, spec.root, prefs.boardLabel, prefs.showSideNames,
      prefs.highlightRoot, prefs.fretRows, nm],
  )
  return (
    <Fretboard startFret={m.startFret} rows={m.rows} marks={m.marks} bar={m.bar}
      nutMarks={m.nutMarks} names={m.names} prefs={prefs} width={width}
      label={`和弦指法：${describeVoicing(spec.frets, noteName(prefs.accidental === "flat"))}`} />
  )
}

// 和弦播放按鈕（是否顯示由呼叫端依 soundOn 判斷）
// 純文字標題（符號寫在標題內），避免系統把「圖示＋文字」縮成只剩圖示
function ChordPlayButtons(props: { frets: readonly Fret[]; prefs: DiagramPrefs; t: Translate }) {
  const { frets, prefs, t } = props
  return (
    <HStack spacing={12}>
      <Button title={t("chord.play")} buttonStyle="bordered"
        lineLimit={1} fixedSize={true}
        action={() => playChord(frets, prefs.playStyle)} />
      <Button title={t("chord.arpeggio")} buttonStyle="bordered"
        lineLimit={1} fixedSize={true}
        action={() => playChord(frets, "arpeggio")} />
    </HStack>
  )
}

/* ════════════════════════════════════════════════
 * ① 和弦：Domain（速查、進行、練習共用）
 * ════════════════════════════════════════════════ */
type Scope = "open" | "barre" | "both"

interface Chord { readonly root: PitchClass; readonly quality: ChordQuality; readonly degree: number }

const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11]
const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10]
const MAJOR_QUALITIES: ChordQuality[] = ["maj", "min", "min", "maj", "maj", "min", "dim"]
const MINOR_QUALITIES: ChordQuality[] = ["min", "dim", "maj", "min", "min", "maj", "maj"]
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"]
const QUALITY_SUFFIX: Record<ChordQuality, string> = { maj: "", min: "m", dim: "dim" }

const ALL_DEGREES: readonly number[] = [0, 1, 2, 3, 4, 5, 6]
const ALL_QUALITIES: readonly QualityKey[] = FINDER_QUALITIES.map((q) => q.key)
const toggleIn = <T,>(xs: readonly T[], x: T): T[] =>
  xs.includes(x) ? xs.filter((v) => v !== x) : [...xs, x]

const diatonicChords = (key: Key): Chord[] => {
  const steps = key.mode === "major" ? MAJOR_STEPS : MINOR_STEPS
  const qualities = key.mode === "major" ? MAJOR_QUALITIES : MINOR_QUALITIES
  return steps.map((s, i) => ({ root: mod12(key.tonic + s), quality: qualities[i], degree: i }))
}
const chordName = (flats: boolean) => (c: Chord): string =>
  noteName(flats)(c.root) + QUALITY_SUFFIX[c.quality]
const romanNumeral = (c: Chord): string =>
  c.quality === "maj" ? ROMAN[c.degree] : ROMAN[c.degree].toLowerCase() + (c.quality === "dim" ? "°" : "")

// 練習用和弦：根音來自所選級數，類型來自所選和弦類型（和弦速查的 key）
interface PracticeChord { readonly root: PitchClass; readonly quality: QualityKey; readonly degree: number }
const practiceChordName = (flats: boolean) => (c: PracticeChord): string =>
  noteName(flats)(c.root) + qualityDef(c.quality).suffix

interface TrainerVoicing {
  readonly chord: PracticeChord
  readonly origin: VoicingOrigin
  readonly rebassed: boolean
  readonly kind: VoicingKind
  readonly frets: readonly Fret[]
}

// 和弦的所有組成音都在該調音階內，才算符合調性
const chordFitsKey = (key: Key, root: PitchClass, quality: QualityKey): boolean => {
  const steps = key.mode === "major" ? MAJOR_STEPS : MINOR_STEPS
  const scale = new Set(steps.map((s) => mod12(key.tonic + s)))
  return qualityDef(quality).intervals.every((i) => scale.has(mod12(root + i)))
}

const scopeAllows = (scope: Scope, kind: VoicingKind): boolean => scope === "both" || kind === scope
// bass：指定低音（on）；-1 或與根音相同時視為一般和弦
// 開放和弦不受指型選項影響；封閉和弦只留下設定中啟用的指型
const shapeAllows = (shapes: readonly string[], v: FinderVoicing): boolean =>
  v.kind === "open" || v.origin.type !== "shape" || shapes.includes(v.origin.shape)
const voicingsInScope = (
  root: PitchClass, quality: QualityKey, scope: Scope, shapes: readonly string[], bass: number = -1,
): FinderVoicing[] => {
  const all = bass >= 0 && bass !== root
    ? getSlashVoicings(root, quality, mod12(bass))
    : getVoicings(root, quality)
  return all.filter((v) => scopeAllows(scope, v.kind) && shapeAllows(shapes, v))
}

interface Deck { readonly voicings: TrainerVoicing[]; readonly skipped: PracticeChord[] }

// 由一組和弦與指法範圍，組出練習題庫
const deckFromChords = (
  chords: readonly PracticeChord[], scope: Scope, shapes: readonly string[],
): Deck => {
  const entries = chords.map((chord) => {
    const vs = voicingsInScope(chord.root, chord.quality, scope, shapes)
      .map((v): TrainerVoicing => ({ chord, origin: v.origin, rebassed: v.rebassed, kind: v.kind, frets: v.frets }))
    return { chord, vs }
  })
  return {
    voicings: entries.flatMap((e) => e.vs),
    skipped: entries.filter((e) => e.vs.length === 0).map((e) => e.chord),
  }
}

// 題庫來源 A：調內所選級數 × 所選類型（只留符合調性的組合）
const buildDeck = (
  key: Key, scope: Scope, shapes: readonly string[], degrees: readonly number[], qualities: readonly QualityKey[],
): Deck => {
  const chosenQualities = ALL_QUALITIES.filter((q) => qualities.includes(q))
  const chords = diatonicChords(key)
    .filter((c) => degrees.includes(c.degree))
    .flatMap((c) => chosenQualities
      .filter((q) => chordFitsKey(key, c.root, q))
      .map((q): PracticeChord => ({ root: c.root, quality: q, degree: c.degree })))
  return deckFromChords(chords, scope, shapes)
}

/* ── 文案：和弦類型與按法的名稱（UI 專用，domain 只留結構資料；名稱走字串表） ── */
const QUALITY_FORMULA: Record<QualityKey, string> = {
  maj: "1  3  5", min: "1  ♭3  5", "7": "1  3  5  ♭7", maj7: "1  3  5  7", m7: "1  ♭3  5  ♭7",
  sus2: "1  2  5", sus4: "1  4  5", add9: "1  3  5  9", m7b5: "1  ♭3  ♭5  ♭7",
  dim: "1  ♭3  ♭5", aug: "1  3  ♯5",
}
const QUALITY_MESSAGE: Readonly<Record<QualityKey, MessageKey>> = {
  maj: "quality.maj", min: "quality.min", "7": "quality.7", maj7: "quality.maj7", m7: "quality.m7",
  sus2: "quality.sus2", sus4: "quality.sus4", add9: "quality.add9", m7b5: "quality.m7b5",
  dim: "quality.dim", aug: "quality.aug",
}
const qualityLabel = (key: QualityKey, t: Translate): string => t(QUALITY_MESSAGE[key])
const qualityFormula = (key: QualityKey): string => QUALITY_FORMULA[key]

const voicingTitle = (
  v: { readonly origin: VoicingOrigin; readonly rebassed: boolean }, t: Translate,
): string => {
  const o = v.origin
  const base = o.type === "open"
    ? t("voicing.open")
    : o.fret === 0
      ? t("voicing.shape", { shape: o.shape })
      : t("voicing.shapeBarre", { shape: o.shape, fret: o.fret })
  const withVariant = o.type === "shape" && o.variant ? t("voicing.variant", { title: base }) : base
  return v.rebassed ? t("voicing.rebassed", { title: withVariant }) : withVariant
}

const describe = (v: TrainerVoicing, t: Translate): string =>
  t("practice.describe", { degree: v.chord.degree + 1, title: voicingTitle(v, t) })

/* ① 練習進度 */
interface PracticeSession { readonly seed: number; readonly index: number }
type PracticeAction =
  | { type: "go"; index: number }
  | { type: "reset"; seed: number }

const practiceReducer = (s: PracticeSession, a: PracticeAction): PracticeSession => {
  switch (a.type) {
    case "go": return { ...s, index: a.index }
    case "reset": return { seed: a.seed, index: 0 }
    default: return assertNever(a)
  }
}

/* ① 和弦進行 Domain */
interface ProgStep { readonly deg: number; readonly q?: QualityKey } // q：覆蓋和弦類型（例如藍調用屬七）
interface ProgDef { readonly key: string; readonly labelKey: MessageKey; readonly steps: readonly ProgStep[] }

const degs = (...d: number[]): ProgStep[] => d.map((deg) => ({ deg }))

const MAJOR_PROGS: readonly ProgDef[] = [
  { key: "I-V-vi-IV", labelKey: "prog.I-V-vi-IV", steps: degs(0, 4, 5, 3) },
  { key: "I-IV-V-I", labelKey: "prog.I-IV-V-I", steps: degs(0, 3, 4, 0) },
  { key: "I-vi-IV-V", labelKey: "prog.I-vi-IV-V", steps: degs(0, 5, 3, 4) },
  { key: "vi-IV-I-V", labelKey: "prog.vi-IV-I-V", steps: degs(5, 3, 0, 4) },
  { key: "ii-V-I", labelKey: "prog.ii-V-I", steps: degs(1, 4, 0) },
  {
    key: "blues12", labelKey: "prog.blues12",
    steps: [0, 0, 0, 0, 3, 3, 0, 0, 4, 3, 0, 4].map((deg) => ({ deg, q: "7" })),
  },
]
const MINOR_PROGS: readonly ProgDef[] = [
  { key: "i-VI-III-VII", labelKey: "prog.i-VI-III-VII", steps: degs(0, 5, 2, 6) },
  { key: "i-iv-v-i", labelKey: "prog.i-iv-v-i", steps: degs(0, 3, 4, 0) },
  { key: "i-iv-VII-III", labelKey: "prog.i-iv-VII-III", steps: degs(0, 3, 6, 2) },
  { key: "i-VII-VI-VII", labelKey: "prog.i-VII-VI-VII", steps: degs(0, 6, 5, 6) },
]
const progsOf = (mode: KeyMode): readonly ProgDef[] => (mode === "major" ? MAJOR_PROGS : MINOR_PROGS)

type Prefer = "open" | "barre"
interface ProgChord {
  readonly numeral: string
  readonly name: string
  readonly root: PitchClass
  readonly quality: QualityKey
  readonly degree: number
  readonly voicing: FinderVoicing | null
}

const resolveProgression = (
  key: Key, prog: ProgDef, prefer: Prefer, flats: boolean, shapes: readonly string[],
): ProgChord[] => {
  const diatonic = diatonicChords(key)
  const nm = noteName(flats)
  return prog.steps.map((st) => {
    const d = diatonic[st.deg]
    const q = st.q ?? d.quality
    const vs = getVoicings(d.root, q).filter((v) => shapeAllows(shapes, v))
    const voicing = vs.find((v) => v.kind === prefer) ?? vs[0] ?? null
    return {
      numeral: st.q ? ROMAN[d.degree] + qualityDef(q).suffix : romanNumeral(d),
      name: nm(d.root) + qualityDef(q).suffix,
      root: d.root,
      quality: q,
      degree: d.degree,
      voicing,
    }
  })
}

// 題庫來源 B：目前的和弦進行（相同和弦只算一次）
const practiceChordsOfProgression = (chords: readonly ProgChord[]): PracticeChord[] => {
  const seen = new Set<string>()
  const out: PracticeChord[] = []
  chords.forEach((c) => {
    const k = `${c.root}-${c.quality}`
    if (seen.has(k)) return
    seen.add(k)
    out.push({ root: c.root, quality: c.quality, degree: c.degree })
  })
  return out
}

const TEMPOS: readonly number[] = [60, 80, 100, 120, 140]
const MINORISH_QUALITIES: ReadonlySet<QualityKey> = new Set<QualityKey>(["min", "m7", "dim", "m7b5"])

/* ① 和弦分頁的共用設定（調性、指法範圍三個模式共用） */
type HubSection = "finder" | "progression" | "practice"
type PracticeSource = "scale" | "progression"

interface HubSettings {
  section: HubSection
  // 共用
  tonic: PitchClass
  mode: KeyMode
  scope: Scope
  // 速查
  finderRoot: PitchClass
  finderQuality: QualityKey
  finderBass: number       // on 低音；-1 = 不指定
  // 進行
  progKey: string
  bpm: number
  beats: number
  // 練習
  source: PracticeSource
  shuffle: boolean
  degrees: number[]
  qualities: QualityKey[]
}
const DEFAULT_HUB: HubSettings = {
  section: "finder",
  tonic: mod12(0), mode: "major", scope: "open",
  finderRoot: mod12(0), finderQuality: "maj", finderBass: -1,
  progKey: MAJOR_PROGS[0].key, bpm: 80, beats: 4,
  source: "scale", shuffle: true,
  degrees: [...ALL_DEGREES], qualities: ["maj", "min"],
}

/* ① Application：和弦分頁的純函式（由元件呼叫，方便單獨測試） */
// 指定低音與根音相同、或未指定時，視為一般和弦（-1）
const effectiveBass = (root: PitchClass, bass: number): number =>
  bass >= 0 && bass !== root ? bass : -1

const keyTitleOf = (key: Key, flats: boolean, t: Translate): string =>
  t(key.mode === "major" ? "key.major" : "key.minor", { note: noteName(flats)(key.tonic) })

interface FinderView {
  readonly root: PitchClass
  readonly quality: FinderQuality
  readonly bass: number
  readonly flats: boolean
  readonly title: string
}
// 和弦的標題與升降記號：小調性質的和弦偏好降記號慣例（速查與節奏頁共用）
const chordNaming = (
  root: PitchClass, qualityKey: QualityKey, bassPc: number, accidental: Accidental,
): FinderView => {
  const quality = qualityDef(qualityKey)
  const bass = effectiveBass(root, bassPc)
  const flats = resolveFlats(
    accidental,
    prefersFlats({ tonic: root, mode: MINORISH_QUALITIES.has(quality.key) ? "minor" : "major" }),
  )
  const nm = noteName(flats)
  const title = nm(root) + quality.suffix + (bass >= 0 ? `/${nm(bass)}` : "")
  return { root, quality, bass, flats, title }
}
const finderViewOf = (s: HubSettings, accidental: Accidental): FinderView =>
  chordNaming(s.finderRoot, s.finderQuality, s.finderBass, accidental)

// 在 length 個項目中前進或後退一格（環狀）
const stepIndex = (index: number, length: number, dir: 1 | -1): number =>
  length === 0 ? 0 : ((index % length) + dir + length) % length

const progressionSeconds = (chordCount: number, beats: number, bpm: number): number =>
  Math.round((chordCount * beats * 60) / bpm)

// 練習題庫：來源是目前的和弦進行，或調內所選級數 × 類型
const practiceDeckOf = (
  s: HubSettings, progChords: readonly ProgChord[], shapes: readonly string[],
): Deck =>
  s.source === "progression"
    ? deckFromChords(practiceChordsOfProgression(progChords), s.scope, shapes)
    : buildDeck({ tonic: s.tonic, mode: s.mode }, s.scope, shapes, s.degrees, s.qualities)

/* ① 共用：和弦詳情列（速查與進行共用）
 * 傳回一組可直接放進 Section 的列：說明列＋各按法。
 * only：只顯示指定的一個按法（進行頁用）。
 * bass：on 低音（-1 = 無）。
 * width：指板可用寬度（由版面計算）。
 */
function chordDetailRows(p: {
  root: PitchClass
  quality: QualityKey
  flats: boolean
  prefs: DiagramPrefs
  scope: Scope
  width?: number
  only?: FinderVoicing | null
  bass?: number
  t: Translate
}): JSX.Element[] {
  const { root, quality, flats, prefs, scope, only, width, t } = p
  const bass = effectiveBass(root, p.bass ?? -1)
  const q = qualityDef(quality)
  const nm = noteName(flats)
  const notes = q.intervals.map((i) => nm(root + i)).join("  ")
  const voicings = only ? [only] : voicingsInScope(root, quality, scope, prefs.barreShapes, bass)

  const rows: JSX.Element[] = [
    <VStack key="head" alignment="leading" spacing={4}>
      <Text font="headline">{`${qualityLabel(q.key, t)}${bass >= 0 ? `　/${nm(bass)}` : ""}　${qualityFormula(q.key)}`}</Text>
      <Text font="subheadline" foregroundStyle="secondaryLabel">
        {`${t("chord.notes", { notes })}${bass >= 0 ? `　${t("chord.bassNote", { note: nm(bass) })}` : ""}`}
      </Text>
    </VStack>,
  ]
  if (voicings.length === 0) {
    rows.push(
      <Text key="none" foregroundStyle="secondaryLabel">
        {scope === "both" ? t("chord.noVoicings") : t("chord.noVoicingsInScope")}
      </Text>,
    )
    return rows
  }
  voicings.forEach((v, i) => {
    rows.push(
      <VStack key={`v${i}`} alignment="leading" spacing={6}>
        <Text font="headline">{voicingTitle(v, t)}</Text>
        <ChordBoard spec={{ frets: v.frets, root }} prefs={prefs} nm={nm} width={width} />
        {prefs.soundOn ? <ChordPlayButtons frets={v.frets} prefs={prefs} t={t} /> : null}
      </VStack>,
    )
  })
  return rows
}

/* ① 練習卡 */
function ChordCard(props: {
  voicing: TrainerVoicing; flats: boolean; prefs: DiagramPrefs; width: number; t: Translate
  onOpenFinder: () => void
}) {
  const { voicing, flats, prefs, width, t, onOpenFinder } = props
  const spec: DiagramSpec = { frets: voicing.frets, root: voicing.chord.root }
  const hasBarre = !!resolveFingering(voicing.frets).barre
  const legend = [
    prefs.highlightRoot ? t("card.legend.root") : "",
    hasBarre ? t("card.legend.barre") : "",
  ].filter(Boolean).join("　")

  return (
    <VStack spacing={8}>
      <Text font="largeTitle" fontWeight="bold">{practiceChordName(flats)(voicing.chord)}</Text>
      <Text font="subheadline" foregroundStyle="secondaryLabel">{describe(voicing, t)}</Text>
      <ChordBoard spec={spec} prefs={prefs} nm={noteName(flats)} width={width} />
      {legend ? (
        <Text font="caption" foregroundStyle="secondaryLabel">{legend}</Text>
      ) : null}
      {prefs.soundOn ? <ChordPlayButtons frets={voicing.frets} prefs={prefs} t={t} /> : null}
      <Button title={t("card.openInFinder")} buttonStyle="borderless"
        lineLimit={1} fixedSize={true} action={onOpenFinder} />
    </VStack>
  )
}

/* ① UI：和弦分頁（速查／進行／練習） */
interface FinderCtx {
  readonly s: HubSettings
  readonly prefs: DiagramPrefs
  readonly bw: number
  readonly finder: FinderView
  readonly patch: (p: Partial<HubSettings>) => void
  readonly t: Translate
  readonly auditionFinder: (root: PitchClass, quality: QualityKey, bass: number) => void
}
// 速查：左欄選和弦，右欄顯示各按法
const finderSections = (c: FinderCtx): Placed[] => {
  const { s, prefs, bw, t, patch, auditionFinder } = c
  const { root: finderRoot, bass: finderBass, flats: finderFlats, title: finderTitle } = c.finder
  return [
    L(
      <Section key="pick" header={<Text>{t("finder.pick")}</Text>}
        footer={<Text>{t("finder.pick.footer")}</Text>}>
        <Picker title={t("finder.root")} value={s.finderRoot} pickerStyle="menu"
          onChanged={(v: number) => {
            patch({ finderRoot: mod12(v) })
            auditionFinder(mod12(v), s.finderQuality, effectiveBass(mod12(v), s.finderBass))
          }}>
          {NOTE_LABELS.map((r, i) => <Text key={r} tag={i}>{r}</Text>)}
        </Picker>
        <Picker title={t("finder.quality")} value={s.finderQuality} pickerStyle="menu"
          onChanged={(v: string) => {
            if (!isQualityKey(v)) return
            patch({ finderQuality: v })
            auditionFinder(finderRoot, v, finderBass)
          }}>
          {FINDER_QUALITIES.map((x) => <Text key={x.key} tag={x.key}>{qualityLabel(x.key, t)}</Text>)}
        </Picker>
        <Picker title={t("finder.bass")} value={s.finderBass} pickerStyle="menu"
          onChanged={(v: number) => {
            patch({ finderBass: v })
            auditionFinder(finderRoot, s.finderQuality, effectiveBass(finderRoot, v))
          }}>
          <Text tag={-1}>{t("finder.bass.none")}</Text>
          {NOTE_LABELS.map((r, i) => <Text key={`b${r}`} tag={i}>{r}</Text>)}
        </Picker>
      </Section>,
    ),
    R(
      <Section key="detail" header={<Text>{finderTitle}</Text>}>
        {chordDetailRows({
          root: finderRoot, quality: s.finderQuality, flats: finderFlats, prefs, scope: s.scope,
          bass: finderBass, width: bw, t,
        })}
      </Section>,
    ),
  ]
}

interface ProgressionCtx {
  readonly s: HubSettings
  readonly prefs: DiagramPrefs
  readonly bw: number
  readonly keyTitle: string
  readonly keyFlats: boolean
  readonly t: Translate
  readonly progs: readonly ProgDef[]
  readonly progIdx: number
  readonly prog: ProgDef
  readonly progChords: readonly ProgChord[]
  readonly progSummary: string
  readonly seconds: number
  readonly selIdx: number
  readonly sel: ProgChord | undefined
  readonly patch: (p: Partial<HubSettings>) => void
  readonly setSelected: (i: number) => void
  readonly choose: (i: number) => void
  readonly playAll: () => void
  readonly openInFinder: (root: PitchClass, quality: QualityKey) => void
}
// 進行：左欄選進行、和弦與播放，右欄顯示所選和弦的指法
const progressionSections = (c: ProgressionCtx): Placed[] => {
  const {
    s, prefs, bw, t, keyTitle, keyFlats, progs, progIdx, prog, progChords, progSummary, seconds,
    selIdx, sel, patch, setSelected, choose, playAll, openInFinder,
  } = c
  const out: Placed[] = [
    L(
      <Section key="pick" header={<Text>{t("prog.header")}</Text>}>
        <Picker title={t("prog.picker")} value={progIdx} pickerStyle="menu"
          onChanged={(v: number) => { patch({ progKey: progs[v].key }); setSelected(0) }}>
          {progs.map((p, i) => <Text key={p.key} tag={i}>{t(p.labelKey)}</Text>)}
        </Picker>
      </Section>,
    ),
    L(
      <Section key="list" header={<Text>{`${keyTitle}・${t(prog.labelKey)}`}</Text>}
        footer={<Text>{t("prog.list.footer")}</Text>}>
        <Text font="headline">{progSummary}</Text>
        {progChords.map((c, i) => (
          <Button key={i}
            title={`${i + 1}.　${c.numeral}　${c.name}${c.voicing ? "" : t("prog.noVoicing")}`}
            systemImage={i === selIdx ? "checkmark.circle.fill" : "circle"}
            buttonStyle="borderless"
            action={() => choose(i)} />
        ))}
      </Section>,
    ),
  ]
  if (prefs.soundOn) {
    out.push(
      L(
        <Section key="play" header={<Text>{t("prog.play")}</Text>}
          footer={<Text>{t("prog.play.footer", { seconds })}</Text>}>
          <Picker title={t("prog.tempo")} value={s.bpm} pickerStyle="menu"
            onChanged={(v: number) => patch({ bpm: v })}>
            {TEMPOS.map((bpm) => <Text key={bpm} tag={bpm}>{`${bpm} BPM`}</Text>)}
          </Picker>
          <Picker title={t("prog.beatsEach")} value={s.beats} pickerStyle="segmented"
            onChanged={(v: number) => patch({ beats: v })}>
            <Text tag={2}>{t("prog.beats", { n: 2 })}</Text>
            <Text tag={4}>{t("prog.beats", { n: 4 })}</Text>
          </Picker>
          <HStack spacing={12}>
            <Button title={t("prog.playAll")} buttonStyle="borderedProminent"
              lineLimit={1} fixedSize={true}
              action={playAll} />
            <Button title={t("prog.stop")} buttonStyle="bordered"
              lineLimit={1} fixedSize={true}
              action={() => synth.stop()} />
          </HStack>
        </Section>,
      ),
    )
  }
  if (sel && sel.voicing) {
    out.push(
      R(
        <Section key="detail" header={<Text>{`${sel.numeral}　${sel.name}・${voicingTitle(sel.voicing, t)}`}</Text>}>
          {chordDetailRows({
            root: sel.root, quality: sel.quality, flats: keyFlats, prefs, scope: s.scope,
            only: sel.voicing, width: bw, t,
          })}
          <HStack>
            <Button title={t("card.openInFinder")} buttonStyle="borderless"
              lineLimit={1} fixedSize={true}
              action={() => openInFinder(sel.root, sel.quality)} />
            <Spacer />
            <Button title={t("prog.practice")} buttonStyle="borderless"
              lineLimit={1} fixedSize={true}
              action={() => patch({ section: "practice", source: "progression" })} />
          </HStack>
        </Section>,
      ),
    )
  }
  return out
}

interface PracticeCtx {
  readonly s: HubSettings
  readonly prefs: DiagramPrefs
  readonly bw: number
  readonly keyTitle: string
  readonly keyFlats: boolean
  readonly t: Translate
  readonly prog: ProgDef
  readonly chords: readonly Chord[]
  readonly hasOpen: readonly boolean[]
  readonly diatonicName: (c: Chord) => string
  readonly deck: Deck
  readonly ordered: readonly TrainerVoicing[]
  readonly current: TrainerVoicing | undefined
  readonly session: PracticeSession
  readonly skippedText: string
  readonly nothingSelected: boolean
  readonly patch: (p: Partial<HubSettings>) => void
  readonly dispatch: (a: PracticeAction) => void
  readonly step: (dir: 1 | -1) => void
  readonly openInFinder: (root: PitchClass, quality: QualityKey) => void
}
// 練習：左欄選題庫，右欄顯示練習卡
const practiceSections = (c: PracticeCtx): Placed[] => {
  const {
    s, prefs, bw, t, keyTitle, keyFlats, prog, chords, hasOpen, diatonicName, deck, ordered, current,
    session, skippedText, nothingSelected, patch, dispatch, step, openInFinder,
  } = c
  const out: Placed[] = [
    L(
      <Section key="source" header={<Text>{t("practice.source")}</Text>}
        footer={s.source === "progression"
          ? <Text>{t("practice.source.footer", { key: keyTitle, prog: t(prog.labelKey) })}</Text>
          : undefined}>
        <Picker title={t("practice.source.picker")} value={s.source} pickerStyle="segmented"
          onChanged={(v: string) => patch({ source: v as PracticeSource })}>
          <Text tag="scale">{t("practice.source.scale")}</Text>
          <Text tag="progression">{t("practice.source.progression")}</Text>
        </Picker>
      </Section>,
    ),
    R(
      <Section key="card" header={<Text>{t("practice.card", { key: keyTitle })}</Text>}>
        {current ? (
          <ChordCard voicing={current} flats={keyFlats} prefs={prefs} width={bw} t={t}
            onOpenFinder={() => openInFinder(current.chord.root, current.chord.quality)} />
        ) : (
          <Text foregroundStyle="secondaryLabel">
            {nothingSelected ? t("practice.noSelection") : t("practice.noMatch")}
          </Text>
        )}
        <HStack spacing={8}>
          <Button title={t("practice.prev")} buttonStyle="bordered"
            lineLimit={1} fixedSize={true}
            disabled={!current} action={() => step(-1)} />
          <Spacer />
          <Text font="caption" foregroundStyle="secondaryLabel" lineLimit={1} fixedSize={true}>
            {current ? `${(session.index % ordered.length) + 1} / ${ordered.length}` : "0 / 0"}
          </Text>
          <Spacer />
          <Button title={t("practice.next")} buttonStyle="borderedProminent"
            lineLimit={1} fixedSize={true}
            disabled={!current} action={() => step(1)} />
        </HStack>
        <HStack>
          <Spacer />
          <Button title={t("practice.reshuffle")} buttonStyle="borderless"
            lineLimit={1} fixedSize={true}
            disabled={!s.shuffle}
            action={() => dispatch({ type: "reset", seed: Date.now() % 2147483647 })} />
          <Spacer />
        </HStack>
        <Toggle title={t("practice.shuffle")} value={s.shuffle}
          onChanged={(v: boolean) => patch({ shuffle: v })} />
        {deck.skipped.length > 0 ? (
          <Text font="footnote" foregroundStyle="secondaryLabel">
            {t("practice.skipped", { list: skippedText })}
          </Text>
        ) : null}
      </Section>,
    ),
  ]
  if (s.source === "scale") {
    out.push(
      L(
        <Section key="degrees" header={<Text>{t("practice.degrees")}</Text>}>
          <HStack>
            <Button title={t("practice.selectAll")} buttonStyle="borderless"
              action={() => patch({ degrees: [...ALL_DEGREES] })} />
            <Spacer />
            <Button title={t("practice.deselectAll")} buttonStyle="borderless"
              action={() => patch({ degrees: [] })} />
          </HStack>
          {chords.map((c) => (
            <Toggle key={c.degree}
              title={`${romanNumeral(c)}　${diatonicName(c)}${hasOpen[c.degree] ? "" : t("practice.noOpen")}`}
              value={s.degrees.includes(c.degree)}
              onChanged={() => patch({ degrees: toggleIn(s.degrees, c.degree) })} />
          ))}
        </Section>,
      ),
      L(
        <Section key="qualities" header={<Text>{t("practice.qualities")}</Text>}
          footer={<Text>{t("practice.qualities.footer")}</Text>}>
          <HStack>
            <Button title={t("practice.selectAll")} buttonStyle="borderless"
              action={() => patch({ qualities: [...ALL_QUALITIES] })} />
            <Spacer />
            <Button title={t("practice.deselectAll")} buttonStyle="borderless"
              action={() => patch({ qualities: [] })} />
          </HStack>
          {FINDER_QUALITIES.map((q) => (
            <Toggle key={q.key} title={qualityLabel(q.key, t)}
              value={s.qualities.includes(q.key)}
              onChanged={() => patch({ qualities: toggleIn(s.qualities, q.key) })} />
          ))}
        </Section>,
      ),
    )
  }
  return out
}

function ChordHub({ prefs, layout, t }: { prefs: DiagramPrefs; layout: Layout; t: Translate }) {
  const initialHub = useMemo(() => hubRepository.load(), [])
  const [s, setS] = useState<HubSettings>(initialHub)
  const [session, dispatch] = useReducer(practiceReducer, { seed: 1, index: 0 })
  const [selected, setSelected] = useState<number>(0)
  const patch = (p: Partial<HubSettings>) => setS((v) => ({ ...v, ...p }))
  const bw = layout.boardWidth

  useEffect(() => { hubRepository.save(s) }, [s])

  /* ── 共用：調性與升降記號 ── */
  const key: Key = { tonic: s.tonic, mode: s.mode }
  const keyFlats = resolveFlats(prefs.accidental, prefersFlats(key))
  const keyTitle = keyTitleOf(key, keyFlats, t)
  const prefer: Prefer = s.scope === "barre" ? "barre" : "open"

  /* ── 進行 ── */
  const progs = progsOf(s.mode)
  const progIdx = Math.max(0, progs.findIndex((p) => p.key === s.progKey))
  const prog = progs[progIdx]
  const shapesKey = prefs.barreShapes.join(",")
  const progChords = useMemo(
    () => resolveProgression({ tonic: s.tonic, mode: s.mode }, prog, prefer, keyFlats, prefs.barreShapes),
    [s.tonic, s.mode, prog.key, prefer, keyFlats, shapesKey],
  )
  const selIdx = Math.min(selected, progChords.length - 1)
  const sel = progChords[selIdx]
  const progSummary = progChords.map((c) => c.name).join("  ›  ")
  const seconds = progressionSeconds(progChords.length, s.beats, s.bpm)

  /* ── 速查 ── */
  const finder = finderViewOf(s, prefs.accidental)
  const { root: finderRoot, bass: finderBass, flats: finderFlats, title: finderTitle } = finder

  /* ── 練習 ── */
  const chords = useMemo(() => diatonicChords({ tonic: s.tonic, mode: s.mode }), [s.tonic, s.mode])
  const hasOpen = useMemo(
    () => chords.map((c) => getVoicings(c.root, c.quality).some((v) => v.kind === "open")),
    [chords],
  )
  const degreesKey = s.degrees.join(",")
  const qualitiesKey = s.qualities.join(",")
  const deck = useMemo(
    () => practiceDeckOf(s, progChords, prefs.barreShapes),
    [s.source, progChords, s.tonic, s.mode, s.scope, shapesKey, degreesKey, qualitiesKey],
  )
  const ordered = useMemo(
    () => (s.shuffle ? shuffled(deck.voicings, session.seed) : deck.voicings),
    [deck, s.shuffle, session.seed],
  )

  useEffect(() => {
    dispatch({ type: "reset", seed: Date.now() % 2147483647 })
  }, [s.tonic, s.mode, s.scope, shapesKey, degreesKey, qualitiesKey, s.shuffle, s.source, prog.key])

  const current = ordered.length ? ordered[session.index % ordered.length] : undefined
  const practiceName = practiceChordName(keyFlats)
  const diatonicName = chordName(keyFlats)
  const nothingSelected = s.source === "scale" && (s.degrees.length === 0 || s.qualities.length === 0)
  const skippedText = deck.skipped.length <= 8
    ? deck.skipped.map(practiceName).join("、")
    : t("practice.chordCount", { n: deck.skipped.length })

  /* ── 動作 ── */
  const switchSection = (v: HubSection) => {
    synth.stop()
    patch({ section: v })
  }
  const openInFinder = (root: PitchClass, quality: QualityKey) => {
    synth.stop()
    patch({ section: "finder", finderRoot: root, finderQuality: quality, finderBass: -1 })
  }
  const auditionFinder = (root: PitchClass, quality: QualityKey, bass: number) => {
    if (!prefs.soundOn || !prefs.autoPlay) return
    const vs = voicingsInScope(root, quality, s.scope, prefs.barreShapes, bass)
    if (vs.length > 0) playChord(vs[0].frets, prefs.playStyle)
  }
  const step = (dir: 1 | -1) => {
    if (ordered.length === 0) return
    const i = stepIndex(session.index, ordered.length, dir)
    dispatch({ type: "go", index: i })
    haptic(prefs, "light")
    if (prefs.soundOn && prefs.autoPlay) playChord(ordered[i].frets, prefs.playStyle)
  }
  const playAll = () => {
    const shapes = progChords.flatMap((c) => (c.voicing ? [c.voicing.frets] : []))
    if (shapes.length === 0) return
    haptic(prefs, "light")
    void synth.playEvents(progressionEvents(shapes, s.bpm, s.beats, prefs.playStyle))
  }
  const choose = (i: number) => {
    setSelected(i)
    haptic(prefs, "light")
    const v = progChords[i].voicing
    if (prefs.soundOn && v) playChord(v.frets, prefs.playStyle)
  }

  /* ── 雙欄分配：由各區塊自己宣告左欄或右欄 ── */
  const placed: Placed[] =
    s.section === "finder"
      ? finderSections({ s, prefs, bw, t, finder, patch, auditionFinder })
      : s.section === "progression"
        ? progressionSections({
          s, prefs, bw, t, keyTitle, keyFlats, progs, progIdx, prog, progChords, progSummary, seconds,
          selIdx, sel, patch, setSelected, choose, playAll, openInFinder,
        })
        : practiceSections({
          s, prefs, bw, t, keyTitle, keyFlats, prog, chords, hasOpen, diatonicName, deck, ordered, current,
          session, skippedText, nothingSelected, patch, dispatch, step, openInFinder,
        })
  const nodesOf = (pane: Pane): JSX.Element[] =>
    placed.filter((p) => p.pane === pane).map((p) => p.node)

  const keySection = (
    <Section key="key" header={<Text>{t("hub.keyScope")}</Text>}
      footer={<Text>{t("hub.keyScope.footer")}</Text>}>
      <Picker title={t("hub.tonic")} value={s.tonic} pickerStyle="menu"
        onChanged={(v: number) => { patch({ tonic: mod12(v) }); setSelected(0) }}>
        {TONIC_LABELS.map((label, i) => <Text key={i} tag={i}>{label}</Text>)}
      </Picker>
      <Picker title={t("hub.mode")} value={s.mode} pickerStyle="segmented"
        onChanged={(v: string) => {
          const m = v as KeyMode
          patch({ mode: m, progKey: progsOf(m)[0].key })
          setSelected(0)
        }}>
        <Text tag="major">{t("mode.major")}</Text>
        <Text tag="minor">{t("mode.minor")}</Text>
      </Picker>
      <Picker title={t("hub.scope")} value={s.scope} pickerStyle="segmented"
        onChanged={(v: string) => patch({ scope: v as Scope })}>
        <Text tag="open">{t("scope.open")}</Text>
        <Text tag="barre">{t("scope.barre")}</Text>
        <Text tag="both">{t("scope.both")}</Text>
      </Picker>
    </Section>
  )

  const modePicker = (
    <Picker title={t("hub.section")} value={s.section} pickerStyle="segmented"
      onChanged={(v: string) => switchSection(v as HubSection)}>
      <Text tag="finder">{t("hub.finder")}</Text>
      <Text tag="progression">{t("hub.progression")}</Text>
      <Text tag="practice">{t("hub.practice")}</Text>
    </Picker>
  )

  return (
    <VStack spacing={0}>
      {layout.split ? null : <VStack spacing={16} padding>{modePicker}</VStack>}
      <SplitList layout={layout}
        left={[
          ...(layout.split ? [<Section key="mode">{modePicker}</Section>] : []),
          keySection,
          ...nodesOf("left"),
        ]}
        right={nodesOf("right")}
        single={[keySection, ...placed.map((p) => p.node)]} />
    </VStack>
  )
}

/* ════════════════════════════════════════════════
 * ② 把位 1–5 找音／認音：Domain
 * 把位是音階在指板上的五個區域。以 C 大調為準，依序為第 0–3、2–5、5–8、7–10、9–12 格，
 * 其他主音則整組平移；平移後超過第 12 格就改用低八度，低於第 0 格的部分裁掉。
 * 範圍只依主音決定，音階類型（大調、小調、五聲音階…）只決定範圍內有哪些音。
 * ════════════════════════════════════════════════ */
const OPEN_PC: Record<StringNo, PitchClass> = { 6: mod12(4), 5: mod12(9), 4: mod12(2), 3: mod12(7), 2: mod12(11), 1: mod12(4) }
const pitchAt = (s: StringNo, fret: number): PitchClass => mod12(OPEN_PC[s] + fret)

type ScalePositionNo = 1 | 2 | 3 | 4 | 5
const SCALE_POSITION_NOS: readonly ScalePositionNo[] = [1, 2, 3, 4, 5]
const SCALE_POSITION_START_AT_C: Record<ScalePositionNo, number> = { 1: 0, 2: 2, 3: 5, 4: 7, 5: 9 }
const SCALE_POSITION_WIDTH = 4
const MAX_POSITION_FRET = 12

interface FretRange { readonly from: number; readonly to: number }
const scalePositionRange = (no: ScalePositionNo, root: PitchClass): FretRange => {
  const start = SCALE_POSITION_START_AT_C[no] + mod12(root)
  const end = start + SCALE_POSITION_WIDTH - 1
  const shift = end > MAX_POSITION_FRET ? 12 : 0
  return { from: Math.max(0, start - shift), to: end - shift }
}
const rangeLabel = (r: FretRange): string => `第 ${r.from}–${r.to} 格`

interface Position { readonly string: StringNo; readonly fret: number }
interface Zone {
  readonly scalePosition: ScalePositionNo
  readonly keyPc: PitchClass
  readonly scale: ScaleDef
  readonly fromFret: number
  readonly toFret: number
}
const zoneOf = (scalePosition: ScalePositionNo, keyPc: PitchClass, scale: ScaleDef): Zone => {
  const r = scalePositionRange(scalePosition, keyPc)
  return { scalePosition, keyPc, scale, fromFret: r.from, toFret: r.to }
}
const zoneFrets = (z: Zone): number[] =>
  Array.from({ length: z.toFret - z.fromFret + 1 }, (_, i) => z.fromFret + i)
const zonePositions = (z: Zone): Position[] =>
  STRINGS.flatMap(s => zoneFrets(z).map(fret => ({ string: s, fret })))
const intervalAt = (z: Zone, p: Position): number => mod12(pitchAt(p.string, p.fret) - z.keyPc)
// 範圍內屬於音階的位置（出題只從這裡挑）
const scaleTonePositions = (z: Zone): Position[] =>
  zonePositions(z).filter(p => z.scale.intervals.includes(intervalAt(z, p)))
// 範圍內的和弦音（1・3・5，依音階實際有的音）
const chordTonePositions = (z: Zone): Position[] =>
  scaleTonePositions(z).filter(p => CHORD_TONE_INTERVALS.includes(intervalAt(z, p)))
const samePos = (a: Position, b: Position) => a.string === b.string && a.fret === b.fret
const playPosition = (p: Position): void => playNote(STRING_COUNT - p.string, p.fret)

type DrillMode = "findNote" | "nameNote"

interface Question {
  readonly mode: DrillMode
  readonly zone: Zone
  readonly position: Position
  readonly answer: number
  readonly choices: readonly number[]
}

const makeQuestion = (mode: DrillMode, zone: Zone, seed: number): [Question, number] => {
  const [position, next] = pick(scaleTonePositions(zone), seed)
  const pc = pitchAt(position.string, position.fret)
  return mode === "nameNote"
    ? [{ mode, zone, position, answer: pc, choices: ALL_PCS }, next]
    : [{ mode, zone, position, answer: position.fret, choices: [] }, next]
}
const pitchOf = (q: Question): PitchClass => pitchAt(q.position.string, q.position.fret)
const promptOf = (q: Question, nm: (pc: PitchClass) => string): string =>
  q.mode === "nameNote"
    ? `第 ${q.position.string} 弦第 ${q.position.fret} 格是什麼音？`
    : `請在指板上點出第 ${q.position.string} 弦的 ${nm(pitchOf(q))}`
const expectedLabel = (q: Question): string =>
  q.mode === "nameNote" ? noteLabel(q.answer) : `第 ${q.answer} 格`

/* ② Application */
interface Feedback {
  readonly correct: boolean
  readonly expected: string
  readonly picked: Position | null
}
interface Score { readonly correct: number; readonly total: number; readonly streak: number }
interface DrillSession {
  readonly keyPc: PitchClass
  readonly scaleIdx: number
  readonly scalePosition: ScalePositionNo
  readonly mode: DrillMode
  readonly seed: number
  readonly question: Question
  readonly score: Score
  readonly feedback: Feedback | null
}
type DrillAction =
  | { type: "answer"; value: number }
  | { type: "tap"; position: Position }
  | { type: "next" }
  | { type: "configure"; keyPc?: PitchClass; scaleIdx?: number; scalePosition?: ScalePositionNo; mode?: DrillMode }

const newDrillSession = (
  keyPc: PitchClass, scaleIdx: number, scalePosition: ScalePositionNo, mode: DrillMode, seed: number,
): DrillSession => {
  const [question, nextSeed] = makeQuestion(mode, zoneOf(scalePosition, keyPc, SCALES[scaleIdx]), seed)
  return {
    keyPc, scaleIdx, scalePosition, mode, seed: nextSeed, question,
    score: { correct: 0, total: 0, streak: 0 }, feedback: null,
  }
}
const scored = (s: Score, correct: boolean): Score => ({
  correct: s.correct + (correct ? 1 : 0),
  total: s.total + 1,
  streak: correct ? s.streak + 1 : 0,
})
const drillReduce = (s: DrillSession, a: DrillAction): DrillSession => {
  switch (a.type) {
    case "answer": {
      if (s.feedback || s.question.mode === "findNote") return s
      const correct = a.value === s.question.answer
      return {
        ...s,
        score: scored(s.score, correct),
        feedback: { correct, expected: expectedLabel(s.question), picked: null },
      }
    }
    case "tap": {
      if (s.feedback || s.question.mode !== "findNote") return s
      const correct = samePos(a.position, s.question.position)
      return {
        ...s,
        score: scored(s.score, correct),
        feedback: { correct, expected: expectedLabel(s.question), picked: a.position },
      }
    }
    case "next": {
      const [question, seed] = makeQuestion(s.mode, s.question.zone, s.seed)
      return { ...s, question, seed, feedback: null }
    }
    case "configure":
      return newDrillSession(
        a.keyPc ?? s.keyPc, a.scaleIdx ?? s.scaleIdx, a.scalePosition ?? s.scalePosition, a.mode ?? s.mode, s.seed,
      )
    default: return assertNever(a)
  }
}

/* ② 認音練習的儲存格式：只記住最佳連對（主音、音階類型與把位由音階分頁共用；讀寫在「本機儲存」區塊） */
interface DrillSaved { best: number }
const DEFAULT_DRILL: DrillSaved = { best: 0 }
// 本頁的畫面預設：找音、認音都不顯示音名與和弦音圓點，讓使用者先靠自己判斷
const DEFAULT_DRILL_UI = { showNames: false, showTonesFind: false, showTonesName: false } as const

/* ② UI：把題目狀態換算成指板上的標記 */
const drillMarks = (
  q: Question, fb: Feedback | null, showNames: boolean,
  nm: (pc: PitchClass) => string, highlightRoot: boolean,
  showTones: boolean,
): Mark[] => {
  const toneSet = new Set(chordTonePositions(q.zone).map((t) => `${t.string}:${t.fret}`))
  const reveal = showNames || fb !== null

  return zonePositions(q.zone).flatMap<Mark>((p) => {
    const c = STRING_COUNT - p.string
    const pc = pitchAt(p.string, p.fret)
    const name = nm(pc)
    const isAnswer = samePos(p, q.position)
    const isTone = showTones && toneSet.has(`${p.string}:${p.fret}`)
    const toneKind: Tone = highlightRoot && pc === q.zone.keyPc ? "root" : "dot"
    const base = { c, fret: p.fret }

    if (q.mode === "findNote") {
      if (fb && isAnswer) return [{ ...base, tone: "good", text: `✓${name}` }]
      if (fb && fb.picked && samePos(fb.picked, p)) return [{ ...base, tone: "bad", text: `✗${name}` }]
      // 開啟「顯示和弦音圓點」時，和弦音為實心圓；其餘一律為空心圓
      if (isTone) return [{ ...base, tone: toneKind, text: reveal ? name : "" }]
      return [{ ...base, tone: "hollow", text: reveal ? name : "" }]
    }

    if (isAnswer) {
      return fb
        ? [{ ...base, tone: "good", text: name }]
        : [{ ...base, tone: "question", text: "?" }]
    }
    if (reveal) return [{ ...base, tone: isTone ? toneKind : "ghost", text: name }]
    if (isTone) return [{ ...base, tone: toneKind, text: "" }]
    return []
  })
}

const scaleUsesFlats = (prefs: DiagramPrefs, root: PitchClass, scale: ScaleDef): boolean => {
  const minorish = scale.intervals.includes(3) && !scale.intervals.includes(4)
  return resolveFlats(prefs.accidental, prefersFlats({ tonic: root, mode: minorish ? "minor" : "major" }))
}

interface DrillProps {
  readonly prefs: DiagramPrefs
  readonly layout: Layout
  readonly mode: DrillMode          // 找音或認音，由音階分頁的頁面決定
  readonly root: PitchClass         // 與音階瀏覽共用
  readonly scaleIdx: number         // 與音階瀏覽共用
  readonly scalePosition: ScalePositionNo       // 與音階瀏覽共用
  readonly onRoot: (v: number) => void
  readonly onScale: (v: number) => void
  readonly onScalePosition: (v: ScalePositionFilter) => void
}

function FretboardDrill({ prefs, layout, mode, root, scaleIdx, scalePosition, onRoot, onScale, onScalePosition }: DrillProps) {
  const [session, setSession] = useState<DrillSession>(() =>
    newDrillSession(root, scaleIdx, scalePosition, mode, Date.now() | 0))
  const initialDrill = useMemo(() => drillRepository.load(), [])
  const [best, setBest] = useState<number>(initialDrill.best)
  const [showNames, setShowNames] = useState<boolean>(DEFAULT_DRILL_UI.showNames)
  const [showTonesFind, setShowTonesFind] = useState<boolean>(DEFAULT_DRILL_UI.showTonesFind)
  const [showTonesName, setShowTonesName] = useState<boolean>(DEFAULT_DRILL_UI.showTonesName)

  useEffect(() => {
    drillRepository.save({ best })
  }, [best])

  // 主音、音階類型、把位（與音階瀏覽共用）或頁面（找音／認音）改變時，重新出題
  useEffect(() => {
    setSession((s) => (s.keyPc === root && s.scaleIdx === scaleIdx && s.scalePosition === scalePosition && s.mode === mode)
      ? s
      : newDrillSession(root, scaleIdx, scalePosition, mode, s.seed))
  }, [root, scaleIdx, scalePosition, mode])

  const dispatch = (a: DrillAction) => {
    const next = drillReduce(session, a)
    if (next === session) return
    setSession(next)

    if (next.feedback && !session.feedback) {
      haptic(prefs, next.feedback.correct ? "success" : "error")
      if (next.score.streak > best) setBest(next.score.streak)
    }

    if (!prefs.soundOn) return
    if (a.type === "tap") {
      // 找音題：點到的格子發聲
      playPosition(a.position)
    } else if (a.type === "answer") {
      // 認音題：作答後播放題目的音
      playPosition(session.question.position)
    } else if (
      prefs.autoPlay && (a.type === "next" || a.type === "configure") &&
      next.question.mode === "nameNote"
    ) {
      // 認音題：換題時自動播放題目的音
      playPosition(next.question.position)
    }
  }
  const { question: q, feedback, score } = session
  const scale = SCALES[scaleIdx]

  const showTones = q.mode === "findNote" ? showTonesFind : showTonesName
  const setShowTones = q.mode === "findNote" ? setShowTonesFind : setShowTonesName

  const nm = noteName(scaleUsesFlats(prefs, root, scale))
  const tappable = q.mode === "findNote" && feedback === null

  const marks = useMemo(
    () => drillMarks(q, feedback, showNames, nm, prefs.highlightRoot, showTones),
    [q, feedback, showNames, nm, prefs.highlightRoot, showTones],
  )

  const accuracy = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0

  // 本頁用 ScrollView + 較小邊距，指板可比清單頁再寬一些
  const boardWidth = Math.max(240, layout.paneWidth - 48)
  const choiceCols = layout.paneWidth >= 600 ? 6 : 4

  // 控制區上半：主音、音階類型、把位（與音階瀏覽相同的選單，設定共用）
  const controlsTop = (
    <VStack spacing={16}>
      {scalePickers({ root, scaleIdx, scalePosition, allowAll: false, onRoot, onScale, onScalePosition })}
    </VStack>
  )

  // 題目區：說明、指板、題目、選項、回饋
  const quiz = (
    <VStack spacing={16}>
      <Text font="subheadline" foregroundStyle="secondaryLabel">
        {`${nm(root)} ${scale.label}・把位 ${session.scalePosition}・第 ${q.zone.fromFret}–${q.zone.toFret} 格${showTones ? "　圓點＝和弦音（1・3・5）" : ""}`}
      </Text>

      <Fretboard
        startFret={q.zone.fromFret}
        rows={q.zone.toFret - q.zone.fromFret + 1}
        marks={marks}
        prefs={prefs}
        width={boardWidth}
        onTap={tappable
          ? (c, fret) => dispatch({ type: "tap", position: { string: (STRING_COUNT - c) as StringNo, fret } })
          : undefined} />

      <Text font="title3">{promptOf(q, nm)}</Text>

      {q.mode === "nameNote" && prefs.soundOn ? (
        <Button title="♪ 重播題目音" buttonStyle="bordered"
          lineLimit={1} fixedSize={true}
          action={() => playPosition(q.position)} />
      ) : null}

      {chunk(q.choices, choiceCols).map((row, i) => (
        <HStack key={i} spacing={8}>
          {row.map(v => (
            <Button key={v} title={noteLabel(v)} buttonStyle="bordered"
              action={() => dispatch({ type: "answer", value: v })} />
          ))}
        </HStack>
      ))}

      {feedback && (
        <VStack spacing={12}>
          <Text font="headline" foregroundStyle={feedback.correct ? "systemGreen" : "systemRed"}>
            {feedback.correct ? "答對了！" : `答錯了，正確答案是 ${feedback.expected}`}
          </Text>
          <Button title="下一題" buttonStyle="borderedProminent"
            action={() => dispatch({ type: "next" })} />
        </VStack>
      )}
    </VStack>
  )

  // 控制區下半：得分、連對、兩個顯示開關
  const controlsBottom = (
    <VStack spacing={16}>
      <VStack spacing={4}>
        <Text font="footnote" foregroundStyle="secondaryLabel">
          {`得分 ${score.correct} / ${score.total}（${accuracy}%）`}
        </Text>
        <Text font="footnote" foregroundStyle="secondaryLabel">
          {`連對 ${score.streak}・最佳連對 ${best}`}
        </Text>
        {score.total > 0 ? (
          <Button title="重設分數" buttonStyle="borderless"
            action={() => dispatch({ type: "configure" })} />
        ) : null}
      </VStack>

      <Toggle title="顯示和弦音圓點" value={showTones}
        onChanged={(v: boolean) => setShowTones(v)} />
      <Toggle title="顯示音名" value={showNames}
        onChanged={(v: boolean) => setShowNames(v)} />
    </VStack>
  )

  // iPad 橫式：左欄控制、右欄題目；其餘維持原本由上到下的順序
  return layout.split ? (
    <HStack alignment="top" spacing={24} padding>
      <ScrollView frame={{ width: layout.leftWidth - 40 }}>
        <VStack spacing={16}>{controlsTop}{controlsBottom}</VStack>
      </ScrollView>
      <ScrollView>{quiz}</ScrollView>
    </HStack>
  ) : (
    <ScrollView>
      <VStack spacing={16} padding>{controlsTop}{quiz}{controlsBottom}</VStack>
    </ScrollView>
  )
}

/* ════════════════════════════════════════════════
 * ③ 音階：Domain
 * ════════════════════════════════════════════════ */
interface ScaleDef {
  readonly key: string
  readonly label: string
  readonly intervals: readonly number[] // 與主音的半音距離
  readonly degrees: readonly string[]   // 對應的音級標示
}

const SCALES: readonly ScaleDef[] = [
  { key: "major", label: "大調音階（Ionian）", intervals: [0, 2, 4, 5, 7, 9, 11], degrees: ["1", "2", "3", "4", "5", "6", "7"] },
  { key: "minor", label: "自然小音階（Aeolian）", intervals: [0, 2, 3, 5, 7, 8, 10], degrees: ["1", "2", "♭3", "4", "5", "♭6", "♭7"] },
  { key: "majPent", label: "大調五聲音階", intervals: [0, 2, 4, 7, 9], degrees: ["1", "2", "3", "5", "6"] },
  { key: "minPent", label: "小調五聲音階", intervals: [0, 3, 5, 7, 10], degrees: ["1", "♭3", "4", "5", "♭7"] },
  { key: "blues", label: "藍調音階", intervals: [0, 3, 5, 6, 7, 10], degrees: ["1", "♭3", "4", "♭5", "5", "♭7"] },
  { key: "dorian", label: "多利安（Dorian）", intervals: [0, 2, 3, 5, 7, 9, 10], degrees: ["1", "2", "♭3", "4", "5", "6", "♭7"] },
  { key: "mixolydian", label: "米索利地安（Mixolydian）", intervals: [0, 2, 4, 5, 7, 9, 10], degrees: ["1", "2", "3", "4", "5", "6", "♭7"] },
  { key: "lydian", label: "利地安（Lydian）", intervals: [0, 2, 4, 6, 7, 9, 11], degrees: ["1", "2", "3", "♯4", "5", "6", "7"] },
  { key: "phrygian", label: "弗里吉安（Phrygian）", intervals: [0, 1, 3, 5, 7, 8, 10], degrees: ["1", "♭2", "♭3", "4", "5", "♭6", "♭7"] },
  { key: "harmonicMinor", label: "和聲小音階", intervals: [0, 2, 3, 5, 7, 8, 11], degrees: ["1", "2", "♭3", "4", "5", "♭6", "7"] },
]

const CHORD_TONE_INTERVALS: readonly number[] = [0, 3, 4, 7] // 根音、三音、五音

type LabelMode = "name" | "degree" | "none"
type ScalePlayMode = "up" | "down" | "chord"

// 音階頁的初始狀態：C 大調音階，標示音級，不強調和弦音（預設格數由版面決定）
const DEFAULT_SCALE = {
  root: 0 as PitchClass,
  scaleKey: "major",
  startFret: 0,
  label: "degree" as LabelMode,
  emphasize: false,
}
const defaultScaleIndex = (): number =>
  Math.max(0, SCALES.findIndex((s) => s.key === DEFAULT_SCALE.scaleKey))

// 音階試聽：以 C3（MIDI 48）為基準，往上加主音的半音數
const playScale = (root: PitchClass, scale: ScaleDef, mode: ScalePlayMode): void => {
  const base = 48 + mod12(root)
  if (mode === "chord") {
    const tones = scale.intervals.filter((i) => CHORD_TONE_INTERVALS.includes(i))
    void synth.play([...tones, 12].map((i) => base + i), 0.35, 1.2)
    return
  }
  const up = [...scale.intervals, 12].map((i) => base + i)
  void synth.play(mode === "up" ? up : [...up].reverse(), 0.28, 0.9)
}

const scaleMarks = (
  root: PitchClass, scale: ScaleDef, startFret: number, rows: number,
  nm: (pc: PitchClass) => string, label: LabelMode,
  emphasize: boolean, highlightRoot: boolean,
): Mark[] =>
  STRINGS.flatMap((s) =>
    range(rows).flatMap<Mark>((i) => {
      const fret = startFret + i
      const pc = pitchAt(s, fret)
      const idx = scale.intervals.indexOf(mod12(pc - root))
      if (idx < 0) return []
      const interval = scale.intervals[idx]
      const isRoot = interval === 0
      const isChordTone = CHORD_TONE_INTERVALS.includes(interval)
      const dim = emphasize && !isChordTone
      const tone: Tone = isRoot && highlightRoot ? "root" : dim ? "ghost" : "dot"
      const raw = label === "name" ? nm(pc) : label === "degree" ? scale.degrees[idx] : ""
      const text = raw === "" && tone === "ghost" ? "○" : raw
      return [{ c: STRING_COUNT - s, fret, tone, text }]
    }),
  )

/* ③ UI */
interface ScaleExplorerProps {
  readonly prefs: DiagramPrefs
  readonly layout: Layout
  readonly root: PitchClass         // 與找音、認音共用
  readonly scaleIdx: number         // 與找音、認音共用
  readonly scalePosition: ScalePositionFilter   // 與找音、認音共用
  readonly onRoot: (v: number) => void
  readonly onScale: (v: number) => void
  readonly onScalePosition: (v: ScalePositionFilter) => void
}

// scalePosition = 0 代表「全部」：依起始格與顯示格數顯示；1–5 則固定顯示該把位的格數範圍
type ScalePositionFilter = 0 | ScalePositionNo

// 主音、音階類型、把位三個選單：音階瀏覽與找音、認音共用同一組 UI 與設定
// allowAll：是否提供「全部」（找音、認音一定要選定某個把位）
function scalePickers(p: {
  root: PitchClass; scaleIdx: number; scalePosition: ScalePositionFilter; allowAll: boolean
  onRoot: (v: number) => void; onScale: (v: number) => void; onScalePosition: (v: ScalePositionFilter) => void
}): JSX.Element[] {
  return [
    <Picker key="root" title="主音" value={p.root} pickerStyle="menu"
      onChanged={(v: number) => p.onRoot(v)}>
      {TONIC_LABELS.map((t, i) => <Text key={i} tag={i}>{t}</Text>)}
    </Picker>,
    <Picker key="scale" title="音階類型" value={p.scaleIdx} pickerStyle="menu"
      onChanged={(v: number) => p.onScale(v)}>
      {SCALES.map((sc, i) => <Text key={sc.key} tag={i}>{sc.label}</Text>)}
    </Picker>,
    <Picker key="scalePosition" title="把位" value={p.scalePosition} pickerStyle="menu"
      onChanged={(v: number) => p.onScalePosition(v as ScalePositionFilter)}>
      {p.allowAll ? <Text tag={0}>全部（自訂範圍）</Text> : null}
      {SCALE_POSITION_NOS.map((n) => (
        <Text key={n} tag={n}>{`把位 ${n}（${rangeLabel(scalePositionRange(n, p.root))}）`}</Text>
      ))}
    </Picker>,
  ]
}

function ScaleExplorer({ prefs, layout, root, scaleIdx, scalePosition, onRoot, onScale, onScalePosition }: ScaleExplorerProps) {
  const [customStart, setStartFret] = useState<number>(DEFAULT_SCALE.startFret)
  const [customRows, setRows] = useState<number>(layout.defaultScaleRows)
  const pr = scalePosition === 0 ? null : scalePositionRange(scalePosition, root)
  const startFret = pr ? pr.from : customStart
  const rows = pr ? pr.to - pr.from + 1 : customRows
  const [label, setLabel] = useState<LabelMode>(DEFAULT_SCALE.label)
  const [emphasize, setEmphasize] = useState<boolean>(DEFAULT_SCALE.emphasize)

  const scale = SCALES[scaleIdx]
  const minorish = scale.intervals.includes(3) && !scale.intervals.includes(4)
  const flats = resolveFlats(
    prefs.accidental,
    prefersFlats({ tonic: root, mode: minorish ? "minor" : "major" }),
  )
  const nm = noteName(flats)

  // 換主音或音階類型時，依設定自動試聽（上行）
  const audition = (r: number, idx: number) => {
    if (prefs.soundOn && prefs.autoPlay) playScale(mod12(r), SCALES[idx], "up")
  }

  // 橫式指板超出可用寬度時自動改用直式（上限由版面依窗格寬度計算）
  const boardPrefs: DiagramPrefs = useMemo(
    () => ({ ...prefs, orientation: rows > layout.maxHRows ? "vertical" : prefs.orientation }),
    [prefs, rows, layout.maxHRows],
  )

  const marks = useMemo(
    () => scaleMarks(root, scale, startFret, rows, nm, label, emphasize, prefs.highlightRoot),
    [root, scaleIdx, startFret, rows, nm, label, emphasize, prefs.highlightRoot],
  )

  const notes = scale.intervals.map((i) => nm(root + i)).join("  ")
  const degrees = scale.degrees.join("  ")
  const lastFret = startFret + rows - 1
  const legend = [
    prefs.highlightRoot ? "橘色＝根音" : "",
    emphasize ? "實心＝1・3・5，空心＝其他音階音" : "圓點＝音階音",
  ].filter(Boolean).join("　")

  return (
    <SplitList layout={layout}
      left={[
        <Section key="scale" header={<Text>音階</Text>}>
          {scalePickers({
            root, scaleIdx, scalePosition, allowAll: true,
            onRoot: (v) => { onRoot(v); audition(v, scaleIdx) },
            onScale: (v) => { onScale(v); audition(root, v) },
            onScalePosition,
          })}
        </Section>,

        <Section key="comp" header={<Text>音階組成</Text>}>
          <VStack alignment="leading" spacing={4}>
            <Text font="headline">{`組成音：${notes}`}</Text>
            <Text font="subheadline" foregroundStyle="secondaryLabel">{`音級：${degrees}`}</Text>
          </VStack>
          {prefs.soundOn ? (
            <HStack spacing={8}>
              <Button title="↗ 上行" buttonStyle="bordered"
                lineLimit={1} fixedSize={true}
                action={() => playScale(root, scale, "up")} />
              <Button title="↘ 下行" buttonStyle="bordered"
                lineLimit={1} fixedSize={true}
                action={() => playScale(root, scale, "down")} />
              <Button title="♪ 和弦音" buttonStyle="bordered"
                lineLimit={1} fixedSize={true}
                action={() => playScale(root, scale, "chord")} />
            </HStack>
          ) : null}
        </Section>,

        <Section key="opts" header={<Text>標示與範圍</Text>}
          footer={<Text>{`橫式指板顯示格數超過 ${layout.maxHRows} 格時會自動改用直式（上限依目前螢幕與方向自動計算）。輕點指板上任一格即可聽到該音。`}</Text>}>
          <Picker title="標示" value={label} pickerStyle="segmented"
            onChanged={(v: string) => setLabel(v as LabelMode)}>
            <Text tag="degree">音級</Text>
            <Text tag="name">音名</Text>
            <Text tag="none">無</Text>
          </Picker>
          <Toggle title="強調和弦音（1・3・5）" value={emphasize}
            onChanged={(v: boolean) => setEmphasize(v)} />
          {pr ? null : (
            <Picker title="起始格" value={customStart} pickerStyle="menu"
              onChanged={(v: number) => setStartFret(v)}>
              {range(13).map((n) => (
                <Text key={n} tag={n}>{n === 0 ? "0（含空弦）" : `第 ${n} 格`}</Text>
              ))}
            </Picker>
          )}
          {pr ? null : (
            <Picker title="顯示格數" value={customRows} pickerStyle="segmented"
              onChanged={(v: number) => setRows(v)}>
              <Text tag={5}>5 格</Text>
              <Text tag={7}>7 格</Text>
              <Text tag={13}>13 格</Text>
            </Picker>
          )}
        </Section>,
      ]}
      right={[
        <Section key="board" header={<Text>{`${nm(root)} ${scale.label}${scalePosition === 0 ? "" : `・把位 ${scalePosition}`}・第 ${startFret}–${lastFret} 格`}</Text>}>
          <HStack>
            <Spacer />
            <Fretboard startFret={startFret} rows={rows} marks={marks} prefs={boardPrefs}
              width={layout.boardWidth}
              onTap={prefs.soundOn ? (c, fret) => playNote(c, fret) : undefined} />
            <Spacer />
          </HStack>
          {legend ? (
            <Text font="caption" foregroundStyle="secondaryLabel">{legend}</Text>
          ) : null}
        </Section>,
      ]} />
  )
}

/* ════════════════════════════════════════════════
 * ③ 音階分頁：音階瀏覽與把位練習合併在同一個分頁，用分段選單切換
 * ════════════════════════════════════════════════ */
type ScaleTabPage = "browse" | "findNote" | "nameNote"

function ScaleTab({ prefs, layout }: { prefs: DiagramPrefs; layout: Layout }) {
  const [page, setPage] = useState<ScaleTabPage>("browse")
  // 三個頁面共用主音、音階類型與 把位
  const [root, setRoot] = useState<PitchClass>(DEFAULT_SCALE.root)
  const [scaleIdx, setScaleIdx] = useState<number>(defaultScaleIndex)
  const [scalePosition, setScalePosition] = useState<ScalePositionFilter>(0)
  // 找音、認音一定要選定某個把位；從「全部」切換過去時先用 把位 1
  const change = (p: ScaleTabPage) => {
    synth.stop()
    if (p !== "browse" && scalePosition === 0) setScalePosition(1)
    setPage(p)
  }
  return (
    <VStack spacing={0}>
      <Picker title="頁面" value={page} pickerStyle="segmented" padding
        onChanged={(v: string) => change(v as ScaleTabPage)}>
        <Text tag="browse">瀏覽</Text>
        <Text tag="findNote">找音</Text>
        <Text tag="nameNote">認音</Text>
      </Picker>
      {page === "browse"
        ? <ScaleExplorer prefs={prefs} layout={layout}
            root={root} scaleIdx={scaleIdx} scalePosition={scalePosition}
            onRoot={(v: number) => setRoot(mod12(v))} onScale={setScaleIdx} onScalePosition={setScalePosition} />
        : <FretboardDrill prefs={prefs} layout={layout} mode={page}
            root={root} scaleIdx={scaleIdx} scalePosition={scalePosition === 0 ? 1 : scalePosition}
            onRoot={(v: number) => setRoot(mod12(v))} onScale={setScaleIdx} onScalePosition={setScalePosition} />}
    </VStack>
  )
}

/* ════════════════════════════════════════════════
 * ④ 節奏：Domain
 * 設計原則：
 *  - 值物件：Stroke（刷法）、PickRole（指彈角色）、RhythmPattern（節奏型態）
 *  - 模板：純資料，以字串簡寫宣告，再由 parse 函式轉成值物件
 *  - 所有「型態 × 和弦 → 音符事件」的運算都是純函式，不碰 UI 與音訊
 *  - 時間軸（PlayPlan → NoteEvent[] / Playhead）同樣由純函式推導
 * ════════════════════════════════════════════════ */
type Stroke = "D" | "U" | "X" | "-"            // 下刷／上刷／悶音切刷／休止符
type PickRole = "B" | "A" | "1" | "2" | "3"    // 低音／交替低音／1 弦／2 弦／3 弦
type RhythmKind = "strum" | "pick"

type RhythmPattern =
  | { readonly kind: "strum"; readonly strokes: readonly Stroke[] }
  | { readonly kind: "pick"; readonly slots: readonly (readonly PickRole[])[] }

// 每個格子 = 一個八分音符：4/4 有 8 格、3/4 有 6 格
const slotCount = (p: RhythmPattern): number =>
  p.kind === "strum" ? p.strokes.length : p.slots.length

const STROKE_CYCLE: readonly Stroke[] = ["D", "U", "X", "-"]
const isStroke = (c: string): c is Stroke => c === "D" || c === "U" || c === "X" || c === "-"
const isPickRole = (c: string): c is PickRole =>
  c === "B" || c === "A" || c === "1" || c === "2" || c === "3"
const cycleStroke = (s: Stroke): Stroke =>
  STROKE_CYCLE[(STROKE_CYCLE.indexOf(s) + 1) % STROKE_CYCLE.length]

const parseStrum = (pattern: string): Stroke[] =>
  pattern.split("").filter((c) => c !== " ").map((c) => (isStroke(c) ? c : "-"))
// 指彈簡寫：以空白分格，「+」表示同時撥，「-」表示休止符（例：B+1 3 2 -）
const parsePick = (pattern: string): PickRole[][] =>
  pattern.split(" ").filter((t) => t.length > 0)
    .map((t) => (t === "-" ? [] : t.split("+").filter(isPickRole)))

interface StrumTemplate { readonly key: string; readonly label: string; readonly beats: number; readonly pattern: string; readonly hint: string }
interface PickTemplate { readonly key: string; readonly label: string; readonly beats: number; readonly pattern: string; readonly hint: string }

const STRUM_TEMPLATES: readonly StrumTemplate[] = [
  { key: "down4", label: "四分全下", beats: 4, pattern: "D-D-D-D-", hint: "每拍只刷一下，最適合剛開始練換和弦。" },
  { key: "eighthDown", label: "八分全下", beats: 4, pattern: "DDDDDDDD", hint: "每個八分音符都往下刷，力道穩定，適合快歌。" },
  { key: "alt", label: "下上交替", beats: 4, pattern: "DUDUDUDU", hint: "手臂持續擺動、下上不間斷，是所有刷法的基礎。" },
  { key: "folk", label: "民謠經典", beats: 4, pattern: "D-DU-UDU", hint: "「下、下上、上下上」，最常見的民謠刷法。" },
  { key: "pop", label: "流行輕快", beats: 4, pattern: "D-DUDUDU", hint: "前半拍下刷、後半拍上刷，輕快有推進感。" },
  { key: "ballad", label: "慢情歌", beats: 4, pattern: "D--U-UDU", hint: "留白多、強弱分明，適合慢歌與抒情曲。" },
  { key: "rock", label: "搖滾紮實", beats: 4, pattern: "D-DUD-DU", hint: "第 3 拍再加重下刷，節奏更紮實。" },
  { key: "funk", label: "切音放克", beats: 4, pattern: "DXUXDXUX", hint: "×＝右手照常刷、左手放鬆壓住弦，刷出沒有音高的悶音，製造打擊感。" },
  { key: "reggae", label: "雷鬼反拍", beats: 4, pattern: "-U-U-U-U", hint: "只刷反拍（&），重音落在後半拍。" },
  { key: "waltz", label: "華爾茲基本", beats: 3, pattern: "D-D-D-", hint: "每拍一下，強弱弱的三拍子。" },
  { key: "waltzFolk", label: "華爾茲民謠", beats: 3, pattern: "D-DUDU", hint: "第 1 拍下刷，第 2、3 拍加入上刷，更有搖擺感。" },
]

const PICK_TEMPLATES: readonly PickTemplate[] = [
  { key: "arp8", label: "經典琶音", beats: 4, pattern: "B 3 2 1 2 3 2 1", hint: "p-i-m-a-m-i-m-a：由低到高再折返，最基礎的分解和弦。" },
  { key: "travis", label: "交替低音（Travis）", beats: 4, pattern: "B 3 A 2 B 3 A 1", hint: "拇指在兩條低音弦間交替，手指在反拍撥高音，是民謠、鄉村的招牌。" },
  { key: "folkSwing", label: "民謠搖擺", beats: 4, pattern: "B 3 2 3 A 3 2 3", hint: "低音在第 1、3 拍，中間以 3、2 弦來回，穩定好上手。" },
  { key: "pinch", label: "夾撥", beats: 4, pattern: "B+1 - 2+3 - A+1 - 2+3 -", hint: "低音與 1 弦同時撥（夾撥），再以兩指同時撥 2、3 弦。" },
  { key: "ballad", label: "抒情分解", beats: 4, pattern: "B - 3 2 1 2 3 -", hint: "留一拍空隙，聽起來比較鬆、比較柔。" },
  { key: "arp3", label: "三拍琶音", beats: 3, pattern: "B 3 2 1 2 3", hint: "p-i-m-a-m-i，適合三拍子的慢歌。" },
  { key: "waltzPick", label: "華爾茲低音＋和弦", beats: 3, pattern: "B - 3+2+1 - 3+2+1 -", hint: "拇指彈低音，接著兩次高音弦同時撥。" },
]

const firstStrum = (beats: number): StrumTemplate =>
  STRUM_TEMPLATES.find((t) => t.beats === beats) ?? STRUM_TEMPLATES[0]
const firstPick = (beats: number): PickTemplate =>
  PICK_TEMPLATES.find((t) => t.beats === beats) ?? PICK_TEMPLATES[0]
const pickTemplateOf = (key: string): PickTemplate =>
  PICK_TEMPLATES.find((t) => t.key === key) ?? PICK_TEMPLATES[0]

const beatLabel = (slot: number): string => (slot % 2 === 0 ? String(slot / 2 + 1) : "&")

/* ── 指彈右手指法表示法：pima（拇指 p、食指 i、中指 m、無名指 a）
 *    或 T123（拇指 T、食指 1、中指 2、無名指 3） ── */
type FingerNotation = "pima" | "t123"
const FINGER_NOTATIONS: readonly FingerNotation[] = ["pima", "t123"]
const isFingerNotation = (v: unknown): v is FingerNotation =>
  typeof v === "string" && (FINGER_NOTATIONS as readonly string[]).includes(v)

const FINGER_OF: Record<FingerNotation, Record<PickRole, string>> = {
  pima: { B: "p", A: "p", "3": "i", "2": "m", "1": "a" },
  t123: { B: "T", A: "T", "3": "1", "2": "2", "1": "3" },
}

// 模板說明文字裡出現的指序（p-i-m-a…），依表示法換成對應寫法
const hintForNotation = (hint: string, n: FingerNotation): string =>
  n === "pima"
    ? hint
    : hint
      .replace("p-i-m-a-m-i-m-a", "T-1-2-3-2-1-2-3")
      .replace("p-i-m-a-m-i", "T-1-2-3-2-1")

const notationLegend = (n: FingerNotation): string =>
  n === "pima"
    ? "橘色＝低音（拇指 p）、其餘＝高音弦（i 食指＝3 弦、m 中指＝2 弦、a 無名指＝1 弦）。"
    : "橘色＝低音（拇指 T）、其餘＝高音弦（1 食指＝3 弦、2 中指＝2 弦、3 無名指＝1 弦）。"

/* ── 刷弦：型態 × 和弦 → 音符事件 ── */
const strokeVelocity = (s: Stroke, slot: number): number => {
  switch (s) {
    case "D": return slot === 0 ? 1 : slot % 2 === 0 ? 0.85 : 0.75
    case "U": return 0.55
    case "X": return 0.8
    case "-": return 0
    default: return assertNever(s)
  }
}

const soundingStrings = (frets: readonly Fret[]): number[] =>
  frets.flatMap((f, c) => (f === null ? [] : [c]))

// 音長不超過「該和弦結束時間 + 尾音」，換和弦時前一個和弦就不會糊在一起
const clampDur = (want: number, until: number, at: number, tail: number): number =>
  Math.max(0.06, Math.min(want, until - at + tail))

const strumSlotEvents = (
  frets: readonly Fret[], stroke: Stroke, slot: number, at: number, slotSec: number, until: number,
): NoteEvent[] => {
  if (stroke === "-") return []
  const strings = soundingStrings(frets)
  const vel = strokeVelocity(stroke, slot)
  if (stroke === "X") {
    return strings.map((c, k): NoteEvent => ({ midi: midiOf(c, frets[c] as number), at: at + k * 0.004, dur: 0.07, vel }))
  }
  // 下刷：低音弦 → 高音弦；上刷：只刷高音側的 4 條弦，由高音弦往低音弦
  const order = stroke === "D" ? strings : strings.slice(-4).reverse()
  const gap = stroke === "D" ? 0.012 : 0.009
  const ring = Math.min(1.6, slotSec * 3)
  return order.map((c, k): NoteEvent => ({
    midi: midiOf(c, frets[c] as number), at: at + k * gap, dur: clampDur(ring, until, at, 0.12), vel,
  }))
}

/* ── 指彈：角色 → 實際的弦（c = 0 → 6 弦） ──
 * B：這個和弦最低的發聲弦
 * A：交替低音，優先取低音弦往上隔一條（3 弦以內），否則取相鄰的弦
 * 1／2／3：高音弦；若該弦被悶掉就略過
 */
const pickString = (frets: readonly Fret[], role: PickRole): number | null => {
  const strings = soundingStrings(frets)
  if (strings.length === 0) return null
  const bass = strings[0]
  if (role === "B") return bass
  if (role === "A") {
    if (bass + 2 <= 3 && frets[bass + 2] != null) return bass + 2
    return frets[bass + 1] != null ? bass + 1 : bass
  }
  const c = STRING_COUNT - Number(role)
  return frets[c] != null ? c : null
}

const pickSlotEvents = (
  frets: readonly Fret[], roles: readonly PickRole[], at: number, until: number,
): NoteEvent[] => {
  const picked = roles.flatMap((role) => {
    const c = pickString(frets, role)
    return c === null ? [] : [{ c, role }]
  })
  const seen = new Set<number>()
  return picked
    .filter(({ c }) => (seen.has(c) ? false : (seen.add(c), true)))
    .map(({ c, role }): NoteEvent => ({
      midi: midiOf(c, frets[c] as number), at, dur: clampDur(2, until, at, 0.3),
      vel: role === "B" || role === "A" ? 1 : 0.8,
    }))
}

const patternSlotEvents = (
  p: RhythmPattern, frets: readonly Fret[], k: number, at: number, slotSec: number, until: number,
): NoteEvent[] =>
  p.kind === "strum"
    ? strumSlotEvents(frets, p.strokes[k], k, at, slotSec, until)
    : pickSlotEvents(frets, p.slots[k], at, until)

/* ── 時間軸：播放計畫 → 音符事件／播放游標 ── */
interface PlayPlan {
  readonly chords: readonly (readonly Fret[])[] // 沒有指法的和弦以空陣列表示（無聲）
  readonly pattern: RhythmPattern
  readonly bpm: number
  readonly barsPerChord: number
  readonly repeats: number
}
const MAX_PLAY_SECONDS = 90 // 限制整段長度，避免渲染過久或檔案過大

const slotSeconds = (bpm: number): number => 30 / bpm // 八分音符
const planBarSeconds = (p: PlayPlan): number => slotCount(p.pattern) * slotSeconds(p.bpm)
const planPassSeconds = (p: PlayPlan): number => p.chords.length * p.barsPerChord * planBarSeconds(p)
const effectiveRepeats = (p: PlayPlan): number =>
  Math.max(1, Math.min(p.repeats, Math.floor(MAX_PLAY_SECONDS / Math.max(planPassSeconds(p), 1))))
const runSeconds = (p: PlayPlan): number => effectiveRepeats(p) * planPassSeconds(p)

const planEvents = (p: PlayPlan): NoteEvent[] => {
  const bar = planBarSeconds(p)
  const slot = slotSeconds(p.bpm)
  const slots = slotCount(p.pattern)
  return range(effectiveRepeats(p)).flatMap((r) =>
    p.chords.flatMap((frets, i) => {
      const spanStart = (r * p.chords.length + i) * p.barsPerChord * bar
      const spanEnd = spanStart + p.barsPerChord * bar
      return range(p.barsPerChord).flatMap((b) =>
        range(slots).flatMap((k) =>
          patternSlotEvents(p.pattern, frets, k, spanStart + b * bar + k * slot, slot, spanEnd)))
    }),
  )
}

interface Playhead { readonly chord: number; readonly slot: number }
const playheadAt = (p: PlayPlan, elapsed: number): Playhead | null => {
  if (elapsed < 0) return null
  const idx = Math.floor(elapsed / slotSeconds(p.bpm))
  const slots = slotCount(p.pattern)
  const total = effectiveRepeats(p) * p.chords.length * p.barsPerChord * slots
  if (idx >= total) return null
  return { chord: Math.floor(idx / (p.barsPerChord * slots)) % p.chords.length, slot: idx % slots }
}

/* ── 指彈圖：把角色換算成「第幾格 × 第幾弦」的指法（pima 或 T123） ── */
interface PickCell { readonly finger: string; readonly bass: boolean }
const pickCells = (
  frets: readonly Fret[], slots: readonly (readonly PickRole[])[], notation: FingerNotation,
): Map<string, PickCell> => {
  const cells = new Map<string, PickCell>()
  const names = FINGER_OF[notation]
  slots.forEach((roles, i) => roles.forEach((r) => {
    const c = pickString(frets, r)
    if (c !== null) cells.set(`${i}:${c}`, { finger: names[r], bass: r === "B" || r === "A" })
  }))
  return cells
}

/* ④ Infrastructure：節奏頁設定 */
const BPM_MIN = 40
const BPM_MAX = 200
const clampBpm = (n: number): number => Math.max(BPM_MIN, Math.min(BPM_MAX, Math.round(n)))
const REPEAT_OPTIONS: readonly number[] = [1, 2, 4]

interface RhythmSettings {
  kind: RhythmKind
  beats: number          // 3 或 4
  strumPattern: string   // 目前的刷法（可被使用者編輯）
  pickKey: string
  notation: FingerNotation // 指彈圖的指法表示法：pima 或 T123
  bpm: number
  chordRoot: PitchClass    // 伴奏用的和弦（與和弦速查相同的選法）
  chordQuality: QualityKey
  chordBass: number        // on 低音；-1 = 不指定
  scope: Scope             // 指法範圍：開放／封閉／全部
  voicingIdx: number       // 在該範圍的按法清單中選用第幾個
  bars: number             // 播放幾小節
  repeats: number          // 重複幾遍
}
const DEFAULT_RHYTHM: RhythmSettings = {
  kind: "strum", beats: 4,
  strumPattern: firstStrum(4).pattern, pickKey: firstPick(4).key,
  notation: "pima",
  bpm: 80, chordRoot: mod12(0), chordQuality: "maj", chordBass: -1,
  scope: "open", voicingIdx: 0, bars: 1, repeats: 2,
}

const validStrum = (p: unknown, beats: number): p is string =>
  typeof p === "string" && p.length === beats * 2 && p.split("").every(isStroke)


/* ④ UI：節奏圖元件
 * 每格寬度依可用寬度推算（純函式），8 格在手機約 36–40pt，在 iPad 可放大到 64pt。 */
const SLOT_MIN = 30
const SLOT_MAX = 64
const slotWidthFor = (available: number, count: number, lead: number): number =>
  clamp(Math.floor((available - lead) / Math.max(1, count)), SLOT_MIN, SLOT_MAX)

const STROKE_GLYPH: Record<Stroke, string> = { D: "↓", U: "↑", X: "×", "-": "·" }
const STROKE_NAME_ZH: Record<Stroke, string> = { D: "下刷", U: "上刷", X: "悶音切刷", "-": "休止" }

function BeatHeader(props: { count: number; lead: number; slotW: number }) {
  const { count, lead, slotW } = props
  return (
    <HStack spacing={0}>
      {lead > 0 ? <Text frame={{ width: lead, height: 18 }}>{""}</Text> : null}
      {range(count).map((i) => (
        <Text key={i} font="caption" foregroundStyle={i % 2 === 0 ? "label" : "secondaryLabel"}
          frame={{ width: slotW, height: 18 }}>{beatLabel(i)}</Text>
      ))}
    </HStack>
  )
}

function StrumCell(props: {
  stroke: Stroke; index: number; active: boolean; pal: Palette; slotW: number; onTap: () => void
}) {
  const { stroke, index, active, pal, slotW, onTap } = props
  const rest = stroke === "-"
  return (
    <ZStack frame={{ width: slotW, height: 56 }}>
      <Rectangle fill={rest ? "systemGray6" : "systemGray5"}
        frame={{ width: slotW - 4, height: 52 }} />
      {active ? <Rectangle fill={pal.root} opacity={0.45}
        frame={{ width: slotW - 4, height: 52 }} /> : null}
      <Text font="title2" fontWeight="bold"
        foregroundStyle={rest ? "secondaryLabel" : "label"}>{STROKE_GLYPH[stroke]}</Text>
      <Rectangle fill="systemBackground" opacity={0.01}
        accessibilityLabel={`第 ${index + 1} 格，${STROKE_NAME_ZH[stroke]}`}
        accessibilityHint="輕點切換刷法" accessibilityAddTraits="isButton"
        frame={{ width: slotW, height: 56 }} onTapGesture={onTap} />
    </ZStack>
  )
}

function StrumGrid(props: {
  strokes: readonly Stroke[]; current: number; prefs: DiagramPrefs; width: number; onTap: (i: number) => void
}) {
  const { strokes, current, prefs, width, onTap } = props
  const pal = PALETTES[prefs.palette]
  const slotW = slotWidthFor(width, strokes.length, 0)
  return (
    <VStack spacing={4} dynamicTypeSize={BOARD_TYPE_SIZE}>
      <BeatHeader count={strokes.length} lead={0} slotW={slotW} />
      <HStack spacing={0}>
        {strokes.map((s, i) => (
          <StrumCell key={i} stroke={s} index={i} active={i === current} pal={pal} slotW={slotW}
            onTap={() => onTap(i)} />
        ))}
      </HStack>
    </VStack>
  )
}

function PickGrid(props: {
  slots: readonly (readonly PickRole[])[]
  frets: readonly Fret[]
  current: number
  notation: FingerNotation
  prefs: DiagramPrefs
  width: number
}) {
  const { slots, frets, current, notation, prefs, width } = props
  const pal = PALETTES[prefs.palette]
  const LABEL_W = 22
  const ROW_H = width >= 560 ? 32 : 28 // 只有 iPad 的指板寬度會 ≥ 560
  const slotW = slotWidthFor(width, slots.length, LABEL_W)
  const dot = Math.min(28, Math.floor(Math.min(slotW, ROW_H) * 0.86))
  const fretsKey = frets.join(",")
  const cells = useMemo(() => pickCells(frets, slots, notation), [fretsKey, slots, notation])
  const rows = range(STRING_COUNT).map((r) => STRING_COUNT - 1 - r) // 1 弦在上

  return (
    <VStack spacing={0} dynamicTypeSize={BOARD_TYPE_SIZE}
      accessibilityElement="ignore"
      accessibilityLabel={`指彈圖，共 ${slots.length} 格；目前和弦指法：${describeVoicing(frets, noteName(prefs.accidental === "flat"))}`}>
      <BeatHeader count={slots.length} lead={LABEL_W} slotW={slotW} />
      {rows.map((c) => (
        <HStack key={c} spacing={0}>
          <Text font="caption" fontWeight="bold" foregroundStyle="secondaryLabel"
            frame={{ width: LABEL_W, height: ROW_H }}>{String(STRING_COUNT - c)}</Text>
          {slots.map((_, i) => {
            const cell = cells.get(`${i}:${c}`)
            return (
              <ZStack key={i} frame={{ width: slotW, height: ROW_H }}>
                {i === current ? <Rectangle fill={pal.root} opacity={0.25}
                  frame={{ width: slotW, height: ROW_H }} /> : null}
                <Rectangle fill="systemGray"
                  frame={{ width: slotW, height: STRING_THICKNESS[(STRING_COUNT - c) as StringNo] }} />
                {cell ? (
                  <ZStack>
                    <Circle fill={cell.bass ? pal.root : pal.dot} frame={{ width: dot, height: dot }} />
                    <Text font="caption2" fontWeight="bold"
                      foregroundStyle={inkOn(cell.bass ? pal.root : pal.dot)}>{cell.finger}</Text>
                  </ZStack>
                ) : null}
              </ZStack>
            )
          })}
        </HStack>
      ))}
    </VStack>
  )
}

interface RhythmTypeCtx {
  readonly s: RhythmSettings
  readonly strumKey: string
  readonly strumTemplates: readonly StrumTemplate[]
  readonly pickTemplates: readonly PickTemplate[]
  readonly patch: (p: Partial<RhythmSettings>) => void
  readonly changeBeats: (beats: number) => void
}
// 節奏型態：類型、拍號、模板與指法標示
const rhythmTypeSection = (c: RhythmTypeCtx): JSX.Element => {
  const { s, strumKey, strumTemplates, pickTemplates, patch, changeBeats } = c
  return (
    <Section key="type" header={<Text>節奏型態</Text>}>
      <Picker title="類型" value={s.kind} pickerStyle="segmented"
        onChanged={(v: string) => patch({ kind: v as RhythmKind })}>
        <Text tag="strum">刷弦</Text>
        <Text tag="pick">指彈</Text>
      </Picker>
      <Picker title="拍號" value={s.beats} pickerStyle="segmented"
        onChanged={(v: number) => changeBeats(v)}>
        <Text tag={4}>4/4</Text>
        <Text tag={3}>3/4</Text>
      </Picker>
      {s.kind === "strum" ? (
        <Picker title="模板" value={strumKey} pickerStyle="menu"
          onChanged={(v: string) => {
            const t = strumTemplates.find((x) => x.key === v)
            if (t) patch({ strumPattern: t.pattern })
          }}>
          {strumTemplates.map((t) => <Text key={t.key} tag={t.key}>{t.label}</Text>)}
          {strumKey === "custom" ? <Text tag="custom">自訂</Text> : null}
        </Picker>
      ) : (
        <Picker title="模板" value={s.pickKey} pickerStyle="menu"
          onChanged={(v: string) => patch({ pickKey: v })}>
          {pickTemplates.map((t) => <Text key={t.key} tag={t.key}>{t.label}</Text>)}
        </Picker>
      )}
      {s.kind === "pick" ? (
        <Picker title="指法標示" value={s.notation} pickerStyle="segmented"
          onChanged={(v: string) => { if (isFingerNotation(v)) patch({ notation: v }) }}>
          <Text tag="pima">p i m a</Text>
          <Text tag="t123">T 1 2 3</Text>
        </Picker>
      ) : null}
    </Section>
  )
}

interface RhythmPlayCtx {
  readonly s: RhythmSettings
  readonly playSeconds: number
  readonly capped: boolean
  readonly canPlay: boolean
  readonly nudgeBpm: (delta: number) => void
  readonly patch: (p: Partial<RhythmSettings>) => void
  readonly play: () => Promise<void>
  readonly stop: () => void
}
// 播放：速度微調、小節數與重複、播放與停止
const rhythmPlaySection = (c: RhythmPlayCtx): JSX.Element => {
  const { s, playSeconds, capped, canPlay, nudgeBpm, patch, play, stop } = c
  return (
    <Section key="play" header={<Text>播放</Text>}
      footer={<Text>{`約 ${playSeconds} 秒${capped ? "（重複次數已自動縮減，避免過長）" : ""}。以下方選用的和弦與指法伴奏。調整速度會停止目前的播放。`}</Text>}>
      <HStack>
        <Text>速度</Text>
        <Spacer />
        <Text font="headline">{`${s.bpm} BPM`}</Text>
      </HStack>
      <HStack spacing={8}>
        <Button title="-10" buttonStyle="bordered"
          lineLimit={1} fixedSize={true}
          disabled={s.bpm <= BPM_MIN} action={() => nudgeBpm(-10)} />
        <Button title="-1" buttonStyle="bordered"
          lineLimit={1} fixedSize={true}
          disabled={s.bpm <= BPM_MIN} action={() => nudgeBpm(-1)} />
        <Spacer />
        <Button title="+1" buttonStyle="bordered"
          lineLimit={1} fixedSize={true}
          disabled={s.bpm >= BPM_MAX} action={() => nudgeBpm(1)} />
        <Button title="+10" buttonStyle="bordered"
          lineLimit={1} fixedSize={true}
          disabled={s.bpm >= BPM_MAX} action={() => nudgeBpm(10)} />
      </HStack>
      <Picker title="小節數" value={s.bars} pickerStyle="segmented"
        onChanged={(v: number) => patch({ bars: v })}>
        <Text tag={1}>1 小節</Text>
        <Text tag={2}>2 小節</Text>
      </Picker>
      <Picker title="重複" value={s.repeats} pickerStyle="segmented"
        onChanged={(v: number) => patch({ repeats: v })}>
        {REPEAT_OPTIONS.map((n) => <Text key={n} tag={n}>{`${n} 遍`}</Text>)}
      </Picker>
      <HStack spacing={8}>
        <Button title="▶ 播放" buttonStyle="borderedProminent"
          lineLimit={1} fixedSize={true}
          disabled={!canPlay} action={() => { void play() }} />
        <Button title="■ 停止" buttonStyle="bordered"
          lineLimit={1} fixedSize={true}
          action={stop} />
      </HStack>
    </Section>
  )
}

interface RhythmGridCtx {
  readonly s: RhythmSettings
  readonly prefs: DiagramPrefs
  readonly bw: number
  readonly pattern: RhythmPattern
  readonly currentSlot: number
  readonly frets: readonly Fret[]
  readonly gridHint: string
  readonly gridLegend: string
  readonly tapStroke: (i: number) => void
}
// 節奏圖（刷法或指彈）
const rhythmGridSection = (c: RhythmGridCtx): JSX.Element => {
  const { s, prefs, bw, pattern, currentSlot, frets, gridHint, gridLegend, tapStroke } = c
  return (
    <Section key="grid" header={<Text>{`${s.kind === "strum" ? "刷法" : "指法"}・${s.beats}/4 拍・每格 = 八分音符`}</Text>}
      footer={<Text>{gridLegend}</Text>}>
      <HStack>
        <Spacer />
        {s.kind === "strum" && pattern.kind === "strum" ? (
          <StrumGrid strokes={pattern.strokes} current={currentSlot} prefs={prefs}
            width={bw} onTap={tapStroke} />
        ) : null}
        {s.kind === "pick" && pattern.kind === "pick" ? (
          <PickGrid slots={pattern.slots} frets={frets} current={currentSlot}
            notation={s.notation} prefs={prefs} width={bw} />
        ) : null}
        <Spacer />
      </HStack>
      <Text font="subheadline" foregroundStyle="secondaryLabel">{gridHint}</Text>
    </Section>
  )
}

interface RhythmChordCtx {
  readonly s: RhythmSettings
  readonly prefs: DiagramPrefs
  readonly bw: number
  readonly t: Translate
  readonly naming: FinderView
  readonly voicings: readonly FinderVoicing[]
  readonly chosenIdx: number
  readonly changeChord: (p: Partial<RhythmSettings>) => void
  readonly chooseVoicing: (i: number) => void
}
// 頁面最底：選擇和弦（與和弦速查相同）與指法圖；打勾的指法就是伴奏使用的指法
const rhythmChordSections = (c: RhythmChordCtx): JSX.Element[] => {
  const { s, prefs, bw, t, naming, voicings, chosenIdx, changeChord, chooseVoicing } = c
  return [
    <Section key="pick" header={<Text>{t("finder.pick")}</Text>}
      footer={<Text>{t("finder.pick.footer")}</Text>}>
      <Picker title={t("finder.root")} value={s.chordRoot} pickerStyle="menu"
        onChanged={(v: number) => changeChord({ chordRoot: mod12(v) })}>
        {NOTE_LABELS.map((r, i) => <Text key={r} tag={i}>{r}</Text>)}
      </Picker>
      <Picker title={t("finder.quality")} value={s.chordQuality} pickerStyle="menu"
        onChanged={(v: string) => { if (isQualityKey(v)) changeChord({ chordQuality: v }) }}>
        {FINDER_QUALITIES.map((x) => <Text key={x.key} tag={x.key}>{qualityLabel(x.key, t)}</Text>)}
      </Picker>
      <Picker title={t("finder.bass")} value={s.chordBass} pickerStyle="menu"
        onChanged={(v: number) => changeChord({ chordBass: v })}>
        <Text tag={-1}>{t("finder.bass.none")}</Text>
        {NOTE_LABELS.map((r, i) => <Text key={`b${r}`} tag={i}>{r}</Text>)}
      </Picker>
      <Picker title={t("hub.scope")} value={s.scope} pickerStyle="segmented"
        onChanged={(v: string) => changeChord({ scope: v as Scope })}>
        <Text tag="open">{t("scope.open")}</Text>
        <Text tag="barre">{t("scope.barre")}</Text>
        <Text tag="both">{t("scope.both")}</Text>
      </Picker>
    </Section>,

    <Section key="voicings" header={<Text>{naming.title}</Text>}
      footer={<Text>{t("rhythm.voicings.footer")}</Text>}>
      {voicings.length === 0 ? (
        <Text foregroundStyle="secondaryLabel">
          {s.scope === "both" ? t("chord.noVoicings") : t("chord.noVoicingsInScope")}
        </Text>
      ) : voicings.map((v, i) => (
        <VStack key={`v${i}`} alignment="leading" spacing={6}>
          <Button title={voicingTitle(v, t)} buttonStyle="borderless"
            systemImage={i === chosenIdx ? "checkmark.circle.fill" : "circle"}
            action={() => chooseVoicing(i)} />
          <ChordBoard spec={{ frets: v.frets, root: s.chordRoot }} prefs={prefs}
            nm={noteName(naming.flats)} width={bw} />
        </VStack>
      ))}
    </Section>,
  ]
}

/* ④ UI：節奏分頁 */
interface Run { readonly startedAt: number; readonly plan: PlayPlan }

// 播放游標的時鐘：約每 60 毫秒回報一次時間，播完自動呼叫 onDone
// Scripting 沒有 setInterval，改用遞迴 setTimeout
function usePlaybackClock(run: Run | null, onTick: (t: number) => void, onDone: () => void): void {
  useEffect(() => {
    if (!run) return undefined
    let alive = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const tick = () => {
      if (!alive) return
      const t = Date.now()
      onTick(t)
      if ((t - run.startedAt) / 1000 > runSeconds(run.plan) + 0.3) {
        onDone()
        return
      }
      timer = setTimeout(tick, 60)
    }
    timer = setTimeout(tick, 60)
    return () => {
      alive = false
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [run])
}


// 節奏頁的按法清單與目前選用的按法（純函式）
const rhythmVoicingsOf = (s: RhythmSettings, shapes: readonly string[]): FinderVoicing[] =>
  voicingsInScope(s.chordRoot, s.chordQuality, s.scope, shapes, s.chordBass)
const chosenIndexOf = (count: number, idx: number): number =>
  count === 0 ? -1 : Math.min(Math.max(idx, 0), count - 1)

function RhythmStudio({ prefs, active, layout, t }: { prefs: DiagramPrefs; active: boolean; layout: Layout; t: Translate }) {
  // 播放請求的序號：停止或重新播放時作廢尚在渲染中的舊請求（Scripting 沒有 useRef，用 useMemo 保存可變容器）
  const ticket = useMemo(() => ({ current: 0 }), [])
  const initialRhythm = useMemo(() => rhythmRepository.load(), [])
  const [s, setS] = useState<RhythmSettings>(initialRhythm)
  const [run, setRun] = useState<Run | null>(null)
  const [now, setNow] = useState<number>(0)
  const patch = (p: Partial<RhythmSettings>) => setS((v) => ({ ...v, ...p }))
  const bw = layout.boardWidth

  useEffect(() => { rhythmRepository.save(s) }, [s])

  // 離開這個分頁、或改了任何會影響聲音的設定時，停止播放
  // （指法表示法 notation 只影響畫面，不會中斷播放）
  useEffect(() => { if (!active) { ticket.current++; setRun(null) } }, [active])
  useEffect(() => {
    ticket.current++
    synth.stop()
    setRun(null)
  }, [s.kind, s.beats, s.strumPattern, s.pickKey, s.bpm, s.chordRoot, s.chordQuality, s.chordBass,
    s.scope, s.voicingIdx, s.bars, s.repeats])

  usePlaybackClock(run, setNow, () => setRun(null))

  /* ── 和弦與指法 ── */
  const shapesKey = prefs.barreShapes.join(",")
  const naming = chordNaming(s.chordRoot, s.chordQuality, s.chordBass, prefs.accidental)
  const voicings = useMemo(
    () => rhythmVoicingsOf(s, prefs.barreShapes),
    [s.chordRoot, s.chordQuality, s.chordBass, s.scope, shapesKey],
  )
  const chosenIdx = chosenIndexOf(voicings.length, s.voicingIdx)
  const chosen = chosenIdx >= 0 ? voicings[chosenIdx] : undefined
  const frets: readonly Fret[] = chosen ? chosen.frets : []

  /* ── 節奏型態 ── */
  const strumTemplates = STRUM_TEMPLATES.filter((t) => t.beats === s.beats)
  const pickTemplates = PICK_TEMPLATES.filter((t) => t.beats === s.beats)
  const strumTpl = STRUM_TEMPLATES.find((t) => t.beats === s.beats && t.pattern === s.strumPattern)
  const strumKey = strumTpl ? strumTpl.key : "custom"
  const pickTpl = pickTemplateOf(s.pickKey)

  const pattern = useMemo<RhythmPattern>(
    () => s.kind === "strum"
      ? { kind: "strum", strokes: parseStrum(s.strumPattern) }
      : { kind: "pick", slots: parsePick(pickTpl.pattern) },
    [s.kind, s.strumPattern, pickTpl.pattern],
  )

  /* ── 播放計畫與游標 ── */
  const plan: PlayPlan = {
    chords: chosen ? [frets] : [], pattern, bpm: s.bpm, barsPerChord: s.bars, repeats: s.repeats,
  }
  const playSeconds = Math.round(runSeconds(plan))
  const capped = effectiveRepeats(plan) < s.repeats

  const head = run ? playheadAt(run.plan, (now - run.startedAt) / 1000) : null
  const currentSlot = head ? head.slot : -1

  /* ── 動作 ── */
  const play = async () => {
    if (!prefs.soundOn || !chosen) return
    haptic(prefs, "light")
    const mine = ++ticket.current
    setRun(null)
    await synth.playEvents(planEvents(plan))
    if (mine !== ticket.current) return
    const t = Date.now() + 120 // 音訊從準備好到真正出聲約有一點延遲
    setNow(t)
    setRun({ startedAt: t, plan })
  }
  const stop = () => { ticket.current++; synth.stop(); setRun(null) }

  // 換和弦或指法範圍時回到第一個按法，並依設定試聽
  const changeChord = (p: Partial<RhythmSettings>) => {
    patch({ ...p, voicingIdx: 0 })
    if (prefs.soundOn && prefs.autoPlay) {
      const first = rhythmVoicingsOf({ ...s, ...p, voicingIdx: 0 }, prefs.barreShapes)[0]
      if (first) playChord(first.frets, prefs.playStyle)
    }
  }
  const chooseVoicing = (i: number) => {
    patch({ voicingIdx: i })
    haptic(prefs, "light")
    if (prefs.soundOn && prefs.autoPlay && voicings[i]) playChord(voicings[i].frets, prefs.playStyle)
  }
  const tapStroke = (i: number) => {
    const strokes = parseStrum(s.strumPattern)
    const next = strokes.map((x, k) => (k === i ? cycleStroke(x) : x))
    haptic(prefs, "light")
    patch({ strumPattern: next.join("") })
    if (prefs.soundOn && next[i] !== "-") {
      void synth.playEvents(strumSlotEvents(frets, next[i], i, 0, slotSeconds(s.bpm), 1))
    }
  }
  const changeBeats = (beats: number) =>
    patch({ beats, strumPattern: firstStrum(beats).pattern, pickKey: firstPick(beats).key })
  const nudgeBpm = (delta: number) => {
    haptic(prefs, "light")
    patch({ bpm: clampBpm(s.bpm + delta) })
  }

  const gridHint = s.kind === "strum"
    ? (strumTpl ? strumTpl.hint : "自訂節奏：輕點一下格子，依 ↓ → ↑ → × → · 循環切換。")
    : hintForNotation(pickTpl.hint, s.notation)
  const gridLegend = s.kind === "strum"
    ? "↓ 下刷　↑ 上刷　× 悶音切刷　· 休止符。輕點格子可直接修改。"
    : notationLegend(s.notation)

  // 左欄：節奏型態、播放；右欄：節奏圖，最底是選擇和弦與指法圖
  const leftSections: JSX.Element[] = [
    rhythmTypeSection({ s, strumKey, strumTemplates, pickTemplates, patch, changeBeats }),
  ]
  if (prefs.soundOn) {
    leftSections.push(
      rhythmPlaySection({ s, playSeconds, capped, canPlay: !!chosen, nudgeBpm, patch, play, stop }),
    )
  }

  const rightSections: JSX.Element[] = [
    rhythmGridSection({ s, prefs, bw, pattern, currentSlot, frets, gridHint, gridLegend, tapStroke }),
    ...rhythmChordSections({ s, prefs, bw, t, naming, voicings, chosenIdx, changeChord, chooseVoicing }),
  ]

  return <SplitList layout={layout} left={leftSections} right={rightSections} />
}

/* ════════════════════════════════════════════════
 * 在地化：字串表與語言判斷（zh-TW、en）
 * 文案以「鍵」引用，兩種語言的鍵必須完全一致（en 少一個鍵就無法編譯）。
 * 目前只遷移了分頁標題與設定頁的三個字串；其餘文案仍內嵌於畫面，見 backlog B-006。
 * ════════════════════════════════════════════════ */
type Lang = "zh-TW" | "en"

// 系統語言資訊。Scripting 在繁體中文系統回傳 systemLanguageTag = "zh_TW"（底線）、code = "zh"
interface LocaleInfo {
  readonly tag?: string
  readonly code?: string
  readonly country?: string
  readonly script?: string
}
// 規則：只有繁體中文（含沒有地區的 "zh"）用 zh-TW；簡體中文（Hans、CN、SG）與其他語言一律用英文
const SIMPLIFIED_COUNTRIES: readonly string[] = ["CN", "SG"]
const pickLang = (info: LocaleInfo): Lang => {
  const parts = (info.tag ?? "").replace(/_/g, "-").split("-").filter((x) => x.length > 0)
  const code = (info.code ?? parts[0] ?? "").toLowerCase()
  if (code !== "zh") return "en"
  const subtags = parts.slice(1)
  const script = info.script ?? subtags.find((x) => x.length === 4)
  const country = (info.country ?? subtags.find((x) => x.length === 2) ?? "").toUpperCase()
  return script === "Hans" || SIMPLIFIED_COUNTRIES.includes(country) ? "en" : "zh-TW"
}

const MESSAGES_ZH_TW = {
  "tab.chords": "和弦",
  "tab.scales": "音階",
  "tab.rhythm": "節奏",
  "settings.title": "設定",
  "settings.reset": "還原預設",
  "settings.done": "完成",
  "toolbar.soundOn": "聲音開啟",
  "toolbar.soundOff": "聲音關閉",
  "toolbar.settings": "設定",
  "settings.preview": "預覽（F 大三和弦・封閉）",
  "settings.appearance": "標示與外觀",
  "settings.appearance.footer": "「指板標示」決定圓點內顯示手指編號或音名；「側邊顯示音名」則控制指板旁的音名列，兩者可分開設定。手指編號在速查頁是依指型自動推算的建議指法，實際按法可依手型調整。",
  "settings.boardLabel": "指板標示",
  "settings.boardLabel.finger": "手指",
  "settings.boardLabel.name": "音名",
  "settings.boardLabel.none": "不顯示",
  "settings.sideNames": "側邊顯示音名",
  "settings.stringNumbers": "標示弦號（1–6 弦）",
  "settings.highlightRoot": "特別標示根音",
  "settings.orientation": "指板方向",
  "settings.orientation.vertical": "直式",
  "settings.orientation.horizontal": "橫式",
  "settings.palette": "配色",
  "palette.classic": "經典藍橘",
  "palette.forest": "森林綠",
  "palette.mono": "單色深灰",
  "settings.accidental": "升降記號",
  "settings.accidental.auto": "自動",
  "settings.accidental.sharp": "升記號 ♯",
  "settings.accidental.flat": "降記號 ♭",
  "settings.fretRows": "和弦圖格數",
  "settings.fretRows.option": "{n} 格",
  "settings.shapes": "封閉和弦指型",
  "settings.shapes.footer": "決定和弦速查、和弦進行與和弦練習會列出哪些可移動指型（以開放和弦為名，如 E 型即 E 和弦的形狀）。開放和弦不受影響。D 型只按上方四條弦；C 型、G 型在高把位伸張較大，預設關閉。",
  "settings.shapes.item": "{name} 型",
  "settings.sound": "聲音與觸覺",
  "settings.sound.footer": "開啟「自動播放」後，在和弦分頁按上一個／下一個、速查換和弦、認音題換題、音階換主音或類型、節奏頁點選和弦時會自動發聲。節奏頁的刷法與指彈有自己的節奏設定，不受「和弦播放方式」影響。若沒聽到聲音，請確認裝置未開啟靜音模式，且音量已調高。",
  "settings.soundOn": "啟用聲音",
  "settings.autoPlay": "自動播放",
  "settings.playStyle": "和弦播放方式",
  "settings.playStyle.block": "同時",
  "settings.playStyle.strum": "刷弦",
  "settings.playStyle.arpeggio": "琶音",
  "settings.haptics": "觸覺回饋",
  "settings.audition": "試聽 F 大三和弦",
  "settings.about": "關於",
  "settings.version": "版號",
  "quality.maj": "大三和弦 (maj)",
  "quality.min": "小三和弦 (m)",
  "quality.7": "屬七和弦 (7)",
  "quality.maj7": "大七和弦 (maj7)",
  "quality.m7": "小七和弦 (m7)",
  "quality.sus2": "掛留二和弦 (sus2)",
  "quality.sus4": "掛留四和弦 (sus4)",
  "quality.add9": "加九和弦 (add9)",
  "quality.m7b5": "半減七和弦 (m7♭5)",
  "quality.dim": "減三和弦 (dim)",
  "quality.aug": "增三和弦 (aug)",
  "voicing.open": "開放和弦",
  "voicing.shape": "{shape} 型",
  "voicing.shapeBarre": "{shape} 型封閉（第 {fret} 格）",
  "voicing.variant": "{title}・變化",
  "voicing.rebassed": "{title}・換低音",
  "key.major": "{note} 大調",
  "key.minor": "{note} 自然小調",
  "practice.describe": "第 {degree} 級　{title}",
  "prog.I-V-vi-IV": "I–V–vi–IV（流行）",
  "prog.I-IV-V-I": "I–IV–V–I（基本終止）",
  "prog.I-vi-IV-V": "I–vi–IV–V（五〇年代）",
  "prog.vi-IV-I-V": "vi–IV–I–V",
  "prog.ii-V-I": "ii–V–I（爵士基礎）",
  "prog.blues12": "十二小節藍調（I7・IV7・V7）",
  "prog.i-VI-III-VII": "i–VI–III–VII",
  "prog.i-iv-v-i": "i–iv–v–i",
  "prog.i-iv-VII-III": "i–iv–VII–III",
  "prog.i-VII-VI-VII": "i–VII–VI–VII",
  "chord.notes": "組成音：{notes}",
  "chord.bassNote": "指定低音：{note}",
  "chord.noVoicings": "這個和弦目前沒有收錄常用按法",
  "chord.noVoicingsInScope": "這個指法範圍內沒有收錄按法，改選「全部」可查看其他按法",
  "scope.open": "開放",
  "scope.barre": "封閉",
  "scope.both": "全部",
  "chord.play": "▶ 播放",
  "chord.arpeggio": "♪ 逐音",
  "card.legend.root": "醒目顏色＝根音",
  "card.legend.barre": "橫條＝食指橫按",
  "card.openInFinder": "在速查中開啟",
  "finder.pick": "選擇和弦",
  "finder.pick.footer": "「指定低音」可查詢斜線和弦（分數和弦），例如根音 C、指定低音 G 就是 C/G；低音若為和弦內音，即是轉位和弦。",
  "finder.root": "根音",
  "finder.quality": "類型",
  "finder.bass": "指定低音",
  "finder.bass.none": "無（原位）",
  "prog.header": "和弦進行",
  "prog.picker": "進行",
  "prog.list.footer": "點選和弦可查看指法並試聽；整段播放會依速度與拍數連續彈奏。",
  "prog.noVoicing": "（無指法）",
  "prog.play": "播放",
  "prog.play.footer": "約 {seconds} 秒。播放方式（同時／刷弦／琶音）可在設定中調整。",
  "prog.tempo": "速度",
  "prog.beatsEach": "每個和弦",
  "prog.beats": "{n} 拍",
  "prog.playAll": "▶ 播放整段進行",
  "prog.stop": "■ 停止",
  "prog.practice": "以此進行練習",
  "practice.source": "題庫來源",
  "practice.source.footer": "目前題庫：{key}・{prog} 裡出現的和弦。可在「進行」分頁更換。",
  "practice.source.picker": "來源",
  "practice.source.scale": "調內級數",
  "practice.source.progression": "目前進行",
  "practice.card": "練習卡（{key}）",
  "practice.noSelection": "請至少選擇一個級數與一種和弦類型。",
  "practice.noMatch": "所選的和弦在這個指法範圍內沒有符合的指法，請調整選項。",
  "practice.prev": "‹ 上一個",
  "practice.next": "下一個 ›",
  "practice.reshuffle": "重新排序",
  "practice.shuffle": "隨機順序",
  "practice.skipped": "此範圍略過：{list}（沒有收錄的指法）",
  "practice.chordCount": "{n} 個和弦",
  "practice.degrees": "練習級數（可複選）",
  "practice.selectAll": "全選",
  "practice.deselectAll": "全部取消",
  "practice.noOpen": "（沒有常見開放和弦）",
  "practice.qualities": "練習和弦類型（可複選）",
  "practice.qualities.footer": "只會練習符合調性的和弦：以所選級數的音為根音，且組成音都必須在該調音階內。",
  "hub.keyScope": "調性與指法",
  "hub.keyScope.footer": "主音、調式與指法範圍由三個模式共用，切換模式不必重選。速查的根音與低音另外在速查內選擇。",
  "hub.tonic": "主音",
  "hub.mode": "調式",
  "mode.major": "大調",
  "mode.minor": "自然小調",
  "hub.scope": "指法",
  "hub.section": "模式",
  "hub.finder": "速查",
  "hub.progression": "進行",
  "hub.practice": "練習",
  "rhythm.voicings.footer": "點選指法即可選用；播放與指彈圖都使用打勾的指法。",
} as const
type MessageKey = keyof typeof MESSAGES_ZH_TW
type Messages = Readonly<Record<MessageKey, string>>
const MESSAGES_EN: Messages = {
  "tab.chords": "Chords",
  "tab.scales": "Scales",
  "tab.rhythm": "Rhythm",
  "settings.title": "Settings",
  "settings.reset": "Reset to Defaults",
  "settings.done": "Done",
  "toolbar.soundOn": "Sound On",
  "toolbar.soundOff": "Sound Off",
  "toolbar.settings": "Settings",
  "settings.preview": "Preview (F major, barre chord)",
  "settings.appearance": "Labels & Appearance",
  "settings.appearance.footer": "“Board Labels” sets whether the dots show finger numbers or note names; “Show Note Names at Side” controls the note-name column beside the fretboard. They can be set independently. Finger numbers on the Chords tab are suggested fingerings worked out from the shape; adjust them to fit your hand.",
  "settings.boardLabel": "Board Labels",
  "settings.boardLabel.finger": "Finger",
  "settings.boardLabel.name": "Note",
  "settings.boardLabel.none": "None",
  "settings.sideNames": "Show Note Names at Side",
  "settings.stringNumbers": "Show String Numbers (1–6)",
  "settings.highlightRoot": "Highlight Root Notes",
  "settings.orientation": "Fretboard Orientation",
  "settings.orientation.vertical": "Vertical",
  "settings.orientation.horizontal": "Horizontal",
  "settings.palette": "Color Theme",
  "palette.classic": "Classic Blue & Orange",
  "palette.forest": "Forest Green",
  "palette.mono": "Mono Gray",
  "settings.accidental": "Accidentals",
  "settings.accidental.auto": "Auto",
  "settings.accidental.sharp": "Sharps ♯",
  "settings.accidental.flat": "Flats ♭",
  "settings.fretRows": "Chord Diagram Frets",
  "settings.fretRows.option": "{n} frets",
  "settings.shapes": "Barre Chord Shapes",
  "settings.shapes.footer": "Chooses which movable shapes appear in Chord Finder, Progressions and Practice. Shapes are named after the open chord they come from; for example, the E shape is the shape of an open E chord. Open chords are not affected. The D shape uses only the top four strings; the C and G shapes need a wide stretch high on the neck, so they are off by default.",
  "settings.shapes.item": "{name} Shape",
  "settings.sound": "Sound & Haptics",
  "settings.sound.footer": "With “Auto-Play” on, chords play automatically when you step through chords, change chords in the Finder, change a question in the ear trainer, change the key or scale type, or tap a chord on the Rhythm tab. Strumming and fingerstyle patterns on the Rhythm tab have their own settings and ignore “Chord Playback”. If you hear nothing, check that the device is not in silent mode and the volume is up.",
  "settings.soundOn": "Sound",
  "settings.autoPlay": "Auto-Play",
  "settings.playStyle": "Chord Playback",
  "settings.playStyle.block": "Together",
  "settings.playStyle.strum": "Strum",
  "settings.playStyle.arpeggio": "Arpeggio",
  "settings.haptics": "Haptic Feedback",
  "settings.audition": "Play F Major Chord",
  "settings.about": "About",
  "settings.version": "Version",
  "quality.maj": "Major triad (maj)",
  "quality.min": "Minor triad (m)",
  "quality.7": "Dominant 7th (7)",
  "quality.maj7": "Major 7th (maj7)",
  "quality.m7": "Minor 7th (m7)",
  "quality.sus2": "Suspended 2nd (sus2)",
  "quality.sus4": "Suspended 4th (sus4)",
  "quality.add9": "Add 9 (add9)",
  "quality.m7b5": "Half-diminished (m7♭5)",
  "quality.dim": "Diminished triad (dim)",
  "quality.aug": "Augmented triad (aug)",
  "voicing.open": "Open chord",
  "voicing.shape": "{shape} shape",
  "voicing.shapeBarre": "{shape} shape barre (fret {fret})",
  "voicing.variant": "{title} (variant)",
  "voicing.rebassed": "{title} (re-bassed)",
  "key.major": "{note} major",
  "key.minor": "{note} natural minor",
  "practice.describe": "Degree {degree}: {title}",
  "prog.I-V-vi-IV": "I–V–vi–IV (pop)",
  "prog.I-IV-V-I": "I–IV–V–I (basic cadence)",
  "prog.I-vi-IV-V": "I–vi–IV–V (’50s)",
  "prog.vi-IV-I-V": "vi–IV–I–V",
  "prog.ii-V-I": "ii–V–I (jazz basics)",
  "prog.blues12": "12-bar blues (I7, IV7, V7)",
  "prog.i-VI-III-VII": "i–VI–III–VII",
  "prog.i-iv-v-i": "i–iv–v–i",
  "prog.i-iv-VII-III": "i–iv–VII–III",
  "prog.i-VII-VI-VII": "i–VII–VI–VII",
  "chord.notes": "Notes: {notes}",
  "chord.bassNote": "Bass note: {note}",
  "chord.noVoicings": "No common voicings are included for this chord yet.",
  "chord.noVoicingsInScope": "No voicings in this range. Choose “All” to see other voicings.",
  "scope.open": "Open",
  "scope.barre": "Barre",
  "scope.both": "All",
  "chord.play": "▶ Play",
  "chord.arpeggio": "♪ Note by Note",
  "card.legend.root": "Highlighted color = root note",
  "card.legend.barre": "Bar = index-finger barre",
  "card.openInFinder": "Open in Chord Finder",
  "finder.pick": "Choose Chord",
  "finder.pick.footer": "“Bass Note” looks up slash chords: root C with bass G gives C/G. If the bass is a chord tone, the chord is an inversion.",
  "finder.root": "Root",
  "finder.quality": "Type",
  "finder.bass": "Bass Note",
  "finder.bass.none": "None (root position)",
  "prog.header": "Chord Progression",
  "prog.picker": "Progression",
  "prog.list.footer": "Tap a chord to see its voicing and hear it. Play Progression plays the whole sequence at the chosen tempo and beats.",
  "prog.noVoicing": " (no voicing)",
  "prog.play": "Playback",
  "prog.play.footer": "About {seconds} seconds. You can change the playback style (together / strum / arpeggio) in Settings.",
  "prog.tempo": "Tempo",
  "prog.beatsEach": "Per Chord",
  "prog.beats": "{n} beats",
  "prog.playAll": "▶ Play Progression",
  "prog.stop": "■ Stop",
  "prog.practice": "Practice This Progression",
  "practice.source": "Question Source",
  "practice.source.footer": "Current deck: chords in {key} · {prog}. Change it in Progression mode.",
  "practice.source.picker": "Source",
  "practice.source.scale": "Scale Degrees",
  "practice.source.progression": "Current Progression",
  "practice.card": "Flashcard ({key})",
  "practice.noSelection": "Choose at least one degree and one chord type.",
  "practice.noMatch": "The selected chords have no voicings in this range. Adjust your options.",
  "practice.prev": "‹ Previous",
  "practice.next": "Next ›",
  "practice.reshuffle": "Reshuffle",
  "practice.shuffle": "Random Order",
  "practice.skipped": "Skipped in this range: {list} (no voicings included)",
  "practice.chordCount": "{n} chords",
  "practice.degrees": "Degrees to Practice (multiple)",
  "practice.selectAll": "Select All",
  "practice.deselectAll": "Deselect All",
  "practice.noOpen": " (no common open chord)",
  "practice.qualities": "Chord Types to Practice (multiple)",
  "practice.qualities.footer": "Only chords that fit the key are practiced: the root is the selected degree and every chord tone must be in the key’s scale.",
  "hub.keyScope": "Key & Voicings",
  "hub.keyScope.footer": "Tonic, mode and voicing range are shared by all three views, so you don’t need to re-select them when switching. The Finder’s root and bass are chosen within the Finder.",
  "hub.tonic": "Tonic",
  "hub.mode": "Mode",
  "mode.major": "Major",
  "mode.minor": "Natural Minor",
  "hub.scope": "Voicings",
  "hub.section": "View",
  "hub.finder": "Finder",
  "hub.progression": "Progression",
  "hub.practice": "Practice",
  "rhythm.voicings.footer": "Tap a voicing to use it. Playback and the fingerstyle chart use the checked voicing.",
}
const CATALOG: Readonly<Record<Lang, Messages>> = { "zh-TW": MESSAGES_ZH_TW, en: MESSAGES_EN }

// 範本中的 {name} 以參數取代；缺參數時保留原樣，方便在畫面上發現遺漏
type MessageParams = Readonly<Record<string, string | number>>
const formatMessage = (template: string, params?: MessageParams): string =>
  template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    params !== undefined && name in params ? String(params[name]) : whole)
type Translate = (key: MessageKey, params?: MessageParams) => string
const translatorFor = (lang: Lang): Translate => (key, params) => formatMessage(CATALOG[lang][key], params)

// 配色名稱的字串鍵（PALETTES 只存顏色，名稱屬於文案）
const PALETTE_MESSAGE: Readonly<Record<PaletteKey, MessageKey>> = {
  classic: "palette.classic", forest: "palette.forest", mono: "palette.mono",
}

/* ════════════════════════════════════════════════
 * Application：設定的解析（純函式）
 * 輸入是儲存層讀到的任意值；回傳驗證並補齊預設值的設定，或說明失敗原因。
 * ════════════════════════════════════════════════ */
const parsePrefs = (raw: unknown): Result<string, DiagramPrefs> => {
  if (!isRecord(raw)) return err("沒有已儲存的偏好")
  const saved = raw as Partial<DiagramPrefs> & { showFingers?: boolean; showNoteNames?: boolean }
  const base: DiagramPrefs = { ...DEFAULT_PREFS, ...saved }
  // 舊版設定轉換：沒有 boardLabel 時，依舊的兩個開關推算
  const legacyLabel: BoardLabel = saved.showFingers === false
    ? (saved.showNoteNames === false ? "none" : "name")
    : "finger"
  return ok({
    ...base,
    boardLabel: saved.boardLabel === undefined ? legacyLabel : base.boardLabel,
    // 舊版設定轉換：沒有 showSideNames 時，沿用舊的「顯示音名」
    showSideNames: saved.showSideNames === undefined ? saved.showNoteNames !== false : base.showSideNames,
    // 舊版沒有 barreShapes；格式不符時回到預設
    barreShapes: Array.isArray(base.barreShapes)
      ? BARRE_SHAPE_NAMES.filter((n) => base.barreShapes.includes(n))
      : DEFAULT_BARRE_SHAPES,
  })
}

// legacy：舊版「和弦練習」的設定，沒有新版資料時沿用
const parseHub = (raw: unknown, legacy: unknown): Result<string, HubSettings> => {
  const src = isRecord(raw) ? raw : isRecord(legacy) ? legacy : undefined
  if (!src) return err("沒有已儲存的和弦設定")
  const m = { ...DEFAULT_HUB, ...src } as HubSettings
  const sections: HubSection[] = ["finder", "progression", "practice"]
  return ok({
    ...m,
    section: sections.includes(m.section) ? m.section : "finder",
    tonic: mod12(typeof m.tonic === "number" ? m.tonic : 0),
    mode: m.mode === "minor" ? "minor" : "major",
    scope: m.scope === "open" || m.scope === "barre" || m.scope === "both" ? m.scope : "open",
    finderRoot: mod12(typeof m.finderRoot === "number" ? m.finderRoot : 0),
    finderQuality: isQualityKey(m.finderQuality) ? m.finderQuality : "maj",
    finderBass: typeof m.finderBass === "number" && m.finderBass >= 0 && m.finderBass <= 11
      ? Math.floor(m.finderBass) : -1,
    source: m.source === "progression" ? "progression" : "scale",
    degrees: Array.isArray(m.degrees) ? m.degrees.filter((d) => d >= 0 && d <= 6) : [...ALL_DEGREES],
    qualities: Array.isArray(m.qualities) ? m.qualities.filter(isQualityKey) : ["maj", "min"],
  })
}

// legacy：舊版 key 的內容，只沿用最佳連對
const parseDrill = (raw: unknown, legacy: readonly unknown[]): Result<string, DrillSaved> => {
  if (isRecord(raw)) return ok({ best: typeof raw.best === "number" ? raw.best : 0 })
  const old = legacy.find((x) => isRecord(x) && typeof x.best === "number") as { best: number } | undefined
  return old ? ok({ best: old.best }) : err("沒有已儲存的練習紀錄")
}

// legacy：v1 的節奏設定（伴奏是和弦進行）；只沿用節奏型態、速度、小節數與重複
const parseRhythm = (raw: unknown, legacy?: unknown): Result<string, RhythmSettings> => {
  const src = isRecord(raw) ? raw : isRecord(legacy) ? legacy : undefined
  if (!src) return err("沒有已儲存的節奏設定")
  const m = { ...DEFAULT_RHYTHM, ...src } as RhythmSettings
  const beats = m.beats === 3 ? 3 : 4
  return ok({
    kind: m.kind === "pick" ? "pick" : "strum",
    beats,
    strumPattern: validStrum(m.strumPattern, beats) ? m.strumPattern : firstStrum(beats).pattern,
    pickKey: PICK_TEMPLATES.some((t) => t.key === m.pickKey && t.beats === beats)
      ? m.pickKey : firstPick(beats).key,
    notation: isFingerNotation(m.notation) ? m.notation : "pima",
    bpm: typeof m.bpm === "number" ? clampBpm(m.bpm) : DEFAULT_RHYTHM.bpm,
    chordRoot: mod12(typeof m.chordRoot === "number" ? m.chordRoot : 0),
    chordQuality: isQualityKey(m.chordQuality) ? m.chordQuality : "maj",
    chordBass: typeof m.chordBass === "number" && m.chordBass >= 0 && m.chordBass <= 11
      ? Math.floor(m.chordBass) : -1,
    scope: m.scope === "open" || m.scope === "barre" || m.scope === "both" ? m.scope : "open",
    voicingIdx: typeof m.voicingIdx === "number" && m.voicingIdx >= 0 ? Math.floor(m.voicingIdx) : 0,
    bars: m.bars === 2 ? 2 : 1,
    repeats: REPEAT_OPTIONS.includes(m.repeats) ? m.repeats : DEFAULT_RHYTHM.repeats,
  })
}

/* ════════════════════════════════════════════════
 * Infrastructure：本機儲存（偏好、和弦、練習、節奏）
 * 所有 Storage 讀寫集中在這裡：讀取時驗證並補預設值、保留舊 key 的遷移；
 * 儲存失敗一律不影響使用。各設定的型別與預設值留在對應的領域區塊。
 * ════════════════════════════════════════════════ */

// 系統語言：讀取失敗或欄位不存在時回傳空資訊（pickLang 會選英文）
const readLocaleInfo = (): LocaleInfo => {
  try {
    return {
      tag: Device.systemLanguageTag, code: Device.systemLanguageCode,
      country: Device.systemCountryCode, script: Device.systemScriptCode,
    }
  } catch { return {} }
}

// 讀取失敗（例如 Storage 拋例外）視同沒有資料
const readStored = (key: string): unknown => {
  try { return Storage.get(key) } catch { return undefined }
}
const writeStored = (key: string, value: unknown): void => {
  try { Storage.set(key, value) } catch { /* 儲存失敗不影響使用 */ }
}

// 偏好
const PREFS_KEY = "fretboard.prefs.v2"
const prefsRepository = {
  load: (): DiagramPrefs => unwrapOr(parsePrefs(readStored(PREFS_KEY)), DEFAULT_PREFS),
  save: (p: DiagramPrefs): void => writeStored(PREFS_KEY, p),
}

// 和弦分頁（含舊版「和弦練習」設定的遷移）
const HUB_KEY = "chord-hub.settings.v2"
const LEGACY_TRAINER_KEY = "chord-trainer.settings.v1" // 舊版「和弦練習」的設定，第一次啟動時沿用
const hubRepository = {
  load: (): HubSettings => {
    const saved = readStored(HUB_KEY)
    const legacy = isRecord(saved) ? undefined : readStored(LEGACY_TRAINER_KEY)
    return unwrapOr(parseHub(saved, legacy), DEFAULT_HUB)
  },
  save: (h: HubSettings): void => writeStored(HUB_KEY, h),
}

// 音階分頁：認音練習的最佳連對
const DRILL_KEY = "fretboard.drill.v4"
const LEGACY_DRILL_KEYS: readonly string[] = ["fretboard.drill.v3", "fretboard.drill.v2", "fretboard.drill.v1"] // 只沿用最佳連對
const drillRepository = {
  load: (): DrillSaved => unwrapOr(
    parseDrill(readStored(DRILL_KEY), LEGACY_DRILL_KEYS.map(readStored)),
    DEFAULT_DRILL,
  ),
  save: (d: DrillSaved): void => writeStored(DRILL_KEY, d),
}

// 節奏分頁
const RHYTHM_KEY = "rhythm.settings.v2"
const LEGACY_RHYTHM_KEY = "rhythm.settings.v1" // 舊版以和弦進行伴奏；沿用節奏型態與速度
const rhythmRepository = {
  load: (): RhythmSettings => {
    const saved = readStored(RHYTHM_KEY)
    const legacy = isRecord(saved) ? undefined : readStored(LEGACY_RHYTHM_KEY)
    return unwrapOr(parseRhythm(saved, legacy), DEFAULT_RHYTHM)
  },
  save: (r: RhythmSettings): void => writeStored(RHYTHM_KEY, r),
}


/* ════════════════════════════════════════════════
 * 設定
 * ════════════════════════════════════════════════ */
const PREVIEW_SPEC: DiagramSpec = {
  frets: [1, 3, 3, 2, 1, 1],
  fingers: [1, 3, 4, 2, 1, 1],
  barre: { fret: 1, from: 0, to: 5 },
  root: mod12(5),
}

// iPad：直接以完整高度顯示，不需拉出；手機維持半高／全高
const settingsDetents = (pad: boolean): ("medium" | "large")[] =>
  pad ? ["large"] : ["medium", "large"]

// 設定面板的預覽寬度：iPad 的表單視窗約 540pt 寬，手機則接近螢幕寬
const sheetBoardWidth = (layout: Layout): number =>
  Math.max(240, Math.min(layout.width, layout.pad ? 540 : layout.width) - BOARD_INSET)

function PrefsSheet(props: {
  t: Translate
  prefs: DiagramPrefs
  pad: boolean
  previewWidth: number
  onChange: (p: Partial<DiagramPrefs>) => void
  onReset: () => void
  onClose: () => void
}) {
  const { t, prefs, pad, previewWidth, onChange, onReset, onClose } = props
  const nm = noteName(resolveFlats(prefs.accidental, prefersFlats({ tonic: mod12(5), mode: "major" })))

  return (
    <NavigationStack>
      <List
        navigationTitle={t("settings.title")}
        navigationBarTitleDisplayMode="inline"
        presentationDetents={settingsDetents(pad)}
        presentationDragIndicator={pad ? "hidden" : "visible"}
        toolbar={{
          topBarLeading: <Button title={t("settings.reset")} action={onReset} />,
          confirmationAction: <Button title={t("settings.done")} action={onClose} />,
        }}>
        <Section header={<Text>{t("settings.preview")}</Text>}>
          <HStack>
            <Spacer />
            <ChordBoard spec={PREVIEW_SPEC} prefs={prefs} nm={nm} width={previewWidth} />
            <Spacer />
          </HStack>
        </Section>

        <Section
          header={<Text>{t("settings.appearance")}</Text>}
          footer={<Text>{t("settings.appearance.footer")}</Text>}>
          <Picker title={t("settings.boardLabel")} value={prefs.boardLabel} pickerStyle="segmented"
            onChanged={(v: string) => onChange({ boardLabel: v as BoardLabel })}>
            <Text tag="finger">{t("settings.boardLabel.finger")}</Text>
            <Text tag="name">{t("settings.boardLabel.name")}</Text>
            <Text tag="none">{t("settings.boardLabel.none")}</Text>
          </Picker>
          <Toggle title={t("settings.sideNames")} value={prefs.showSideNames}
            onChanged={(v: boolean) => onChange({ showSideNames: v })} />
          <Toggle title={t("settings.stringNumbers")} value={prefs.showStringNumbers}
            onChanged={(v: boolean) => onChange({ showStringNumbers: v })} />
          <Toggle title={t("settings.highlightRoot")} value={prefs.highlightRoot}
            onChanged={(v: boolean) => onChange({ highlightRoot: v })} />
          <Picker title={t("settings.orientation")} value={prefs.orientation} pickerStyle="segmented"
            onChanged={(v: string) => onChange({ orientation: v as Orientation })}>
            <Text tag="vertical">{t("settings.orientation.vertical")}</Text>
            <Text tag="horizontal">{t("settings.orientation.horizontal")}</Text>
          </Picker>
          <Picker title={t("settings.palette")} value={prefs.palette} pickerStyle="menu"
            onChanged={(v: string) => onChange({ palette: v as PaletteKey })}>
            {PALETTE_KEYS.map((k) => <Text key={k} tag={k}>{t(PALETTE_MESSAGE[k])}</Text>)}
          </Picker>
          <Picker title={t("settings.accidental")} value={prefs.accidental} pickerStyle="segmented"
            onChanged={(v: string) => onChange({ accidental: v as Accidental })}>
            <Text tag="auto">{t("settings.accidental.auto")}</Text>
            <Text tag="sharp">{t("settings.accidental.sharp")}</Text>
            <Text tag="flat">{t("settings.accidental.flat")}</Text>
          </Picker>
          <Picker title={t("settings.fretRows")} value={prefs.fretRows} pickerStyle="segmented"
            onChanged={(v: number) => onChange({ fretRows: v })}>
            {[4, 5, 6].map((n) => <Text key={n} tag={n}>{t("settings.fretRows.option", { n })}</Text>)}
          </Picker>
        </Section>

        <Section
          header={<Text>{t("settings.shapes")}</Text>}
          footer={<Text>{t("settings.shapes.footer")}</Text>}>
          {BARRE_SHAPE_NAMES.map((n) => (
            <Toggle key={n} title={t("settings.shapes.item", { name: n })} value={prefs.barreShapes.includes(n)}
              onChanged={(v: boolean) => onChange({
                barreShapes: BARRE_SHAPE_NAMES.filter((x) => (x === n ? v : prefs.barreShapes.includes(x))),
              })} />
          ))}
        </Section>

        <Section
          header={<Text>{t("settings.sound")}</Text>}
          footer={<Text>{t("settings.sound.footer")}</Text>}>
          <Toggle title={t("settings.soundOn")} value={prefs.soundOn}
            onChanged={(v: boolean) => onChange({ soundOn: v })} />
          <Toggle title={t("settings.autoPlay")} value={prefs.autoPlay}
            onChanged={(v: boolean) => onChange({ autoPlay: v })} />
          <Picker title={t("settings.playStyle")} value={prefs.playStyle} pickerStyle="segmented"
            onChanged={(v: string) => onChange({ playStyle: v as PlayStyle })}>
            <Text tag="block">{t("settings.playStyle.block")}</Text>
            <Text tag="strum">{t("settings.playStyle.strum")}</Text>
            <Text tag="arpeggio">{t("settings.playStyle.arpeggio")}</Text>
          </Picker>
          <Toggle title={t("settings.haptics")} value={prefs.haptics}
            onChanged={(v: boolean) => onChange({ haptics: v })} />
          <Button title={t("settings.audition")} systemImage="play.fill"
            action={() => playChord(PREVIEW_SPEC.frets, prefs.playStyle)} />
        </Section>

        <Section header={<Text>{t("settings.about")}</Text>}>
          <HStack>
            <Text>{t("settings.version")}</Text>
            <Spacer />
            <Text foregroundStyle="secondaryLabel">{APP_VERSION}</Text>
          </HStack>
        </Section>
      </List>
    </NavigationStack>
  )
}

/* ════════════════════════════════════════════════
 * 主畫面：原生 TabView（新系統會自動呈現浮動玻璃分頁列）
 * 滿版：不再限制內容寬度。iPad 橫式由各頁自行分成雙欄；
 * iPad mini 直式（744pt）整個寬度都交給清單與指板。
 * ════════════════════════════════════════════════ */
function App({ width, height }: { width: number; height: number }) {
  const valid = width > 0 && height > 0
  const layout = useMemo(
    () => computeLayout(valid ? width : FALLBACK_SIZE.width, valid ? height : FALLBACK_SIZE.height),
    [valid, width, height],
  )
  const [tab, setTab] = useState<number>(0)
  const initialPrefs = useMemo(() => prefsRepository.load(), [])
  const [prefs, setPrefs] = useState<DiagramPrefs>(initialPrefs)
  const [showSettings, setShowSettings] = useState(false)
  const t = useMemo(() => translatorFor(pickLang(readLocaleInfo())), [])

  useEffect(() => { prefsRepository.save(prefs) }, [prefs])
  // 預先設定音訊工作階段，第一次播放才不會延遲
  useEffect(() => { synth.warm() }, [])
  // 關閉聲音時立刻停止正在播放的音
  useEffect(() => { if (!prefs.soundOn) synth.stop() }, [prefs.soundOn])

  const screen = (title: string, icon: string, tag: number, content: JSX.Element) => (
    <NavigationStack tabItem={<Label title={title} systemImage={icon} />} tag={tag}>
      <VStack
        navigationTitle={title}
        navigationBarTitleDisplayMode="inline"
        toolbar={{
          topBarLeading: (
            <Button
              title={prefs.soundOn ? t("toolbar.soundOn") : t("toolbar.soundOff")}
              systemImage={prefs.soundOn ? "speaker.wave.2.fill" : "speaker.slash.fill"}
              action={() => {
                haptic(prefs, "light")
                setPrefs((s) => ({ ...s, soundOn: !s.soundOn }))
              }} />
          ),
          topBarTrailing: (
            <Button title={t("toolbar.settings")} systemImage="gearshape"
              action={() => setShowSettings(true)} />
          ),
        }}>
        {content}
      </VStack>
    </NavigationStack>
  )


  return (
    <TabView
      tabIndex={tab}
      onTabIndexChanged={(i: number) => { synth.stop(); setTab(i) }}
      sheet={{
        isPresented: showSettings,
        onChanged: setShowSettings,
        content: (
          <PrefsSheet
            t={t}
            prefs={prefs}
            pad={layout.pad}
            previewWidth={sheetBoardWidth(layout)}
            onChange={(p) => setPrefs((s) => ({ ...s, ...p }))}
            onReset={() => setPrefs(DEFAULT_PREFS)}
            onClose={() => setShowSettings(false)} />
        ),
      }}>
      {screen(t("tab.chords"), "music.note.list", 0, <ChordHub prefs={prefs} layout={layout} t={t} />)}
      {screen(t("tab.scales"), "music.quarternote.3", 1, <ScaleTab prefs={prefs} layout={layout} />)}
      {screen(t("tab.rhythm"), "metronome", 2, <RhythmStudio prefs={prefs} active={tab === 2} layout={layout} t={t} />)}
    </TabView>
  )
}

async function run() {
  await Navigation.present({
    element: (
      <GeometryReader>
        {(proxy) => <App width={proxy.size.width} height={proxy.size.height} />}
      </GeometryReader>
    ),
  })
  Script.exit()
}
run()

// 僅供單元測試匯入的純領域函式（Scripting 執行時忽略匯出）。
export type { QualityKey, Lang, MessageKey }
export {
  mod12, noteName, prefersFlats, isQualityKey, QUALITY_KEYS, shuffled, nextRandom, computeLayout,
  OPEN_STRINGS, FINDER_QUALITIES, qualityDef, MOVABLE_SHAPES, OPEN,
  getVoicings, getSlashVoicings, voicingsInScope, voicingTitle, qualityLabel, QUALITY_FORMULA, QUALITY_MESSAGE, resolveFingering,
  diatonicChords, resolveProgression, MAJOR_PROGS,
  finderSections, progressionSections, practiceSections, rhythmTypeSection, rhythmPlaySection,
  rhythmGridSection, rhythmChordSections, rhythmVoicingsOf, chosenIndexOf, chordNaming, DEFAULT_PREFS, DEFAULT_RHYTHM, buildDeck, practiceChordsOfProgression,
  parsePrefs, parseHub, parseDrill, parseRhythm, assertNever, unwrapOr, ok, err, prefsRepository, hubRepository,
  TOUCH_MIN, SYSTEM_FILLS, PALETTES, contrastRatio, hexToRgb, inkOn, describePosition, describeVoicing, STROKE_NAME_ZH,
  cellHeightFor,
  pickLang, translatorFor, formatMessage, CATALOG, readLocaleInfo, PALETTE_MESSAGE,
  effectiveBass, keyTitleOf, finderViewOf, stepIndex, progressionSeconds, practiceDeckOf, DEFAULT_HUB,
}
