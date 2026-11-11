import { describe, expect, it } from "vitest"
import type { QualityKey } from "../GuitarToolbox/index"
import {
  FINDER_QUALITIES, MAJOR_PROGS, MOVABLE_SHAPES, OPEN, OPEN_STRINGS, assertNever, cellHeightFor, computeLayout, TOUCH_MIN, pickLang, translatorFor, formatMessage, CATALOG, readLocaleInfo, SYSTEM_FILLS, PALETTES, contrastRatio, hexToRgb, inkOn, describePosition, describeVoicing, STROKE_NAME_ZH, DEFAULT_HUB, err, ok, parseDrill, parseHub, parsePrefs, parseRhythm, prefsRepository, hubRepository, unwrapOr, DEFAULT_PREFS, DEFAULT_RHYTHM, buildDeck, finderSections, practiceSections, progressionSections, rhythmGridSections, rhythmPlaySection, rhythmProgSection, rhythmTypeSection, diatonicChords, effectiveBass, finderViewOf, keyTitleOf, practiceDeckOf, progressionSeconds, stepIndex, isQualityKey, QUALITY_KEYS,
  getSlashVoicings, getVoicings, mod12, noteName, prefersFlats, qualityDef, resolveFingering,
  resolveProgression, shuffled, voicingTitle, qualityLabel, QUALITY_TEXT, voicingsInScope,
} from "../GuitarToolbox/index"

type Frets = readonly (number | null)[]
const ROOTS = Array.from({ length: 12 }, (_, i) => i)
const pitchClasses = (frets: Frets): number[] =>
  frets.flatMap((f, i) => (f === null ? [] : [mod12(OPEN_STRINGS[i] + f)]))
const lowestPc = (frets: Frets): number => pitchClasses(frets)[0]
const chordTones = (root: number, q: QualityKey): number[] =>
  qualityDef(q).intervals.map((i) => mod12(root + i))

describe("音高", () => {
  it("mod12 對負數也回到 0–11", () => {
    expect([mod12(-1), mod12(12), mod12(25)]).toEqual([11, 0, 1])
  })
  it("同音異名：升降記號依名稱表", () => {
    expect(noteName(false)(1)).toBe("C#")
    expect(noteName(true)(1)).toBe("Db")
  })
  it("F 大調偏好降記號、G 大調偏好升記號", () => {
    expect(prefersFlats({ tonic: mod12(5), mode: "major" })).toBe(true)
    expect(prefersFlats({ tonic: mod12(7), mode: "major" })).toBe(false)
  })
})

describe("和弦組成", () => {
  const names = (root: number, q: QualityKey) => chordTones(root, q).map(noteName(false))
  it("Cmaj7 = C E G B", () => expect(names(0, "maj7")).toEqual(["C", "E", "G", "B"]))
  it("Am7♭5 = A C E♭ G", () => {
    expect(chordTones(9, "m7b5")).toEqual([9, 0, 3, 7])
  })
  it("G7 = G B D F", () => expect(names(7, "7")).toEqual(["G", "B", "D", "F"]))
  it("C 大調順階和弦：C Dm Em F G Am Bdim", () => {
    const qs = diatonicChords({ tonic: mod12(0), mode: "major" }).map((c) => `${c.root}${c.quality}`)
    expect(qs).toEqual(["0maj", "2min", "4min", "5maj", "7maj", "9min", "11dim"])
  })
})

describe("按法音高（表格化：每個根音 × 類型）", () => {
  ROOTS.forEach((root) => FINDER_QUALITIES.forEach(({ key: q }) => {
    getVoicings(root, q).forEach((v) => {
      it(`${noteName(false)(root)} ${q}「${voicingTitle(v)}」只含和弦音、最低音為根音、至多缺一音`, () => {
        const tones = chordTones(root, q)
        const pcs = pitchClasses(v.frets)
        expect(pcs.every((p) => tones.includes(p))).toBe(true)
        expect(lowestPc(v.frets)).toBe(root)
        expect(tones.filter((t) => !pcs.includes(t)).length).toBeLessThanOrEqual(1)
        expect(Math.max(...(v.frets.filter((f) => f !== null) as number[]))).toBeLessThanOrEqual(15)
      })
    })
  }))
  it("開放和弦表的每一筆都只含和弦音", () => {
    Object.entries(OPEN).forEach(([k, shape]) => {
      const [root, q] = [Number(k.split("-")[0]), k.split("-").slice(1).join("-")]
      if (!isQualityKey(q)) throw new Error(`未知的和弦類型：${k}`)
      const frets = shape.split("").map((c) => (c === "x" ? null : Number(c)))
      const tones = chordTones(root, q)
      expect(pitchClasses(frets).every((p) => tones.includes(p)), k).toBe(true)
    })
  })
  it("F 大三和弦的 E 型封閉為 1 3 3 2 1 1", () => {
    const f = getVoicings(5, "maj").find((v) => v.origin.type === "shape" && v.origin.shape === "E" && v.origin.fret === 1)
    expect(f?.frets).toEqual([1, 3, 3, 2, 1, 1])
  })
  it("指型名稱都在 MOVABLE_SHAPES 中", () => {
    const names = MOVABLE_SHAPES.map((m) => m.name)
    ROOTS.forEach((r) => FINDER_QUALITIES.forEach((q) =>
      getVoicings(r, q.key).forEach((v) => v.origin.type === "shape" && expect(names).toContain(v.origin.shape))))
  })
})

describe("指型篩選", () => {
  it("只啟用 E 型時，封閉和弦都屬於 E 型，開放和弦保留", () => {
    const vs = voicingsInScope(mod12(5), "maj", "both", ["E"])
    expect(vs.filter((v) => v.kind === "barre").every((v) => v.origin.type === "shape" && v.origin.shape === "E")).toBe(true)
    expect(voicingsInScope(mod12(0), "maj", "both", []).some((v) => v.kind === "open")).toBe(true)
  })
  it("沒啟用任何指型時沒有封閉和弦", () => {
    expect(voicingsInScope(mod12(5), "maj", "barre", [])).toEqual([])
  })
})

describe("斜線和弦", () => {
  it("C/G 的最低音為 G，且仍含根音與三音", () => {
    const vs = getSlashVoicings(mod12(0), "maj", mod12(7))
    expect(vs.length).toBeGreaterThan(0)
    vs.forEach((v) => {
      expect(lowestPc(v.frets)).toBe(7)
      const pcs = pitchClasses(v.frets)
      expect(pcs).toContain(0)
      expect(pcs).toContain(4)
    })
  })
})

describe("指法推算", () => {
  it("F 大三和弦 E 型封閉：食指橫按第 1 格 1–6 弦", () => {
    const r = resolveFingering([1, 3, 3, 2, 1, 1])
    expect(r.barre).toEqual({ fret: 1, from: 0, to: 5 })
    expect(r.fingers[0]).toBe(1)
  })
  it("手指編號在 0–4 之間，且被按的格都有手指", () => {
    ROOTS.forEach((r) => FINDER_QUALITIES.forEach((q) => getVoicings(r, q.key).forEach((v) => {
      const { fingers } = resolveFingering(v.frets)
      fingers.forEach((n) => { expect(n).toBeGreaterThanOrEqual(0); expect(n).toBeLessThanOrEqual(4) })
      v.frets.forEach((f, i) => { if (f !== null && f > 0) expect(fingers[i], voicingTitle(v)).toBeGreaterThan(0) })
    })))
  })
})

describe("和弦進行", () => {
  it("每個和弦進行在 C 大調都解得出和弦", () => {
    MAJOR_PROGS.forEach((p) => {
      const chords = resolveProgression({ tonic: mod12(0), mode: "major" }, p, "open", false, ["E", "A", "D"])
      expect(chords.length).toBe(p.steps.length)
      chords.forEach((c) => expect(c.voicing).not.toBeNull())
    })
  })
})

describe("亂數與版面", () => {
  it("shuffled 同 seed 結果相同、是排列、不改輸入", () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8]
    const a = shuffled(input, 42)
    expect(a).toEqual(shuffled(input, 42))
    expect([...a].sort()).toEqual(input)
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })
  it("短邊 ≥ 600pt 且橫向時為 iPad 雙欄", () => {
    expect(computeLayout(1180, 820).split).toBe(true)
    expect(computeLayout(390, 844).pad).toBe(false)
  })
})

describe("文案（UI 層）", () => {
  it("QUALITY_KEYS 與和弦資料庫的類型一一對應", () => {
    expect(FINDER_QUALITIES.map((q) => q.key)).toEqual([...QUALITY_KEYS])
  })
  it("每個和弦類型都有名稱與公式", () => {
    FINDER_QUALITIES.forEach((q) => {
      expect(QUALITY_TEXT[q.key], q.key).toBeDefined()
      expect(qualityLabel(q.key)).not.toBe(q.key)
    })
  })
  it("按法名稱：開放、E 型、封閉、變化、換低音", () => {
    expect(voicingTitle({ origin: { type: "open" }, rebassed: false })).toBe("開放和弦")
    const shape = (fret: number, variant: boolean) =>
      ({ type: "shape", shape: "E", fret, variant }) as const
    expect(voicingTitle({ origin: shape(0, false), rebassed: false })).toBe("E 型")
    expect(voicingTitle({ origin: shape(3, true), rebassed: true })).toBe("E 型封閉（第 3 格）・變化・換低音")
  })
})

describe("和弦分頁的用例函式", () => {
  it("effectiveBass：未指定或等於根音時為 -1", () => {
    expect(effectiveBass(mod12(0), -1)).toBe(-1)
    expect(effectiveBass(mod12(0), 0)).toBe(-1)
    expect(effectiveBass(mod12(0), 7)).toBe(7)
  })
  it("keyTitleOf：調名與大小調", () => {
    expect(keyTitleOf({ tonic: mod12(5), mode: "major" }, true)).toBe("F 大調")
    expect(keyTitleOf({ tonic: mod12(9), mode: "minor" }, false)).toBe("A 自然小調")
  })
  it("finderViewOf：斜線和弦標題與降記號偏好", () => {
    const v = finderViewOf({ ...DEFAULT_HUB, finderRoot: mod12(0), finderQuality: "maj", finderBass: 7 }, "auto")
    expect(v.title).toBe("C/G")
    const m = finderViewOf({ ...DEFAULT_HUB, finderRoot: mod12(10), finderQuality: "m7", finderBass: -1 }, "auto")
    expect(m.title).toBe("Bbm7")
    const sharp = finderViewOf({ ...DEFAULT_HUB, finderRoot: mod12(10), finderQuality: "maj", finderBass: -1 }, "sharp")
    expect(sharp.title).toBe("A#")
  })
  it("stepIndex：環狀前進與後退，空清單回 0", () => {
    expect(stepIndex(0, 5, -1)).toBe(4)
    expect(stepIndex(4, 5, 1)).toBe(0)
    expect(stepIndex(7, 5, 1)).toBe(3)
    expect(stepIndex(0, 0, 1)).toBe(0)
  })
  it("progressionSeconds：4 和弦 × 4 拍 @ 80 BPM = 12 秒", () => {
    expect(progressionSeconds(4, 4, 80)).toBe(12)
  })
  it("practiceDeckOf：依調內級數與類型出題；每題都符合所選類型", () => {
    const deck = practiceDeckOf(DEFAULT_HUB, [], ["E", "A", "D"])
    expect(deck.voicings.length).toBeGreaterThan(0)
    deck.voicings.forEach((v) => expect(DEFAULT_HUB.qualities).toContain(v.chord.quality))
  })
})

describe("畫面區塊函式（冒煙測試：不丟例外、回傳預期數量的區塊）", () => {
  const prefs = { ...DEFAULT_PREFS, barreShapes: ["E", "A", "D"] }
  const noop = () => undefined
  const hub = { ...DEFAULT_HUB, finderBass: 7 }
  const key = { tonic: hub.tonic, mode: hub.mode }
  const progs = MAJOR_PROGS
  const prog = progs[0]
  const progChords = resolveProgression(key, prog, "open", false, prefs.barreShapes)

  it("finderSections：左右各一個區塊", () => {
    const out = finderSections({
      s: hub, prefs, bw: 320, finder: finderViewOf(hub, "auto"), patch: noop, auditionFinder: noop,
    })
    expect(out.map((p) => p.pane)).toEqual(["left", "right"])
  })
  it("progressionSections：有聲音時三個左欄＋一個右欄", () => {
    const out = progressionSections({
      s: hub, prefs, bw: 320, keyTitle: "C 大調", keyFlats: false, progs, progIdx: 0, prog, progChords,
      progSummary: "x", seconds: 12, selIdx: 0, sel: progChords[0], patch: noop, setSelected: noop,
      choose: noop, playAll: noop, openInFinder: noop,
    })
    expect(out.map((p) => p.pane)).toEqual(["left", "left", "left", "right"])
  })
  it("practiceSections：題庫來源為調內級數時有四個區塊", () => {
    const deck = buildDeck(key, "open", prefs.barreShapes, hub.degrees, hub.qualities)
    const ordered = deck.voicings
    const out = practiceSections({
      s: hub, prefs, bw: 320, keyTitle: "C 大調", keyFlats: false, prog, chords: diatonicChords(key),
      hasOpen: [true], diatonicName: () => "C", deck, ordered, current: ordered[0],
      session: { seed: 1, index: 0 }, skippedText: "", nothingSelected: false, patch: noop,
      dispatch: noop, step: noop, openInFinder: noop,
    })
    expect(out.map((p) => p.pane)).toEqual(["left", "right", "left", "left"])
  })
  it("節奏頁區塊：每個函式都能建出畫面描述", () => {
    const s = DEFAULT_RHYTHM
    expect(rhythmTypeSection({
      s, strumKey: "custom", strumTemplates: [], pickTemplates: [], patch: noop, changeBeats: noop,
    })).toBeTruthy()
    expect(rhythmPlaySection({
      s, songSeconds: 10, capped: false, selIdx: 0, nudgeBpm: noop,
      audition: async () => undefined, playSong: async () => undefined, stop: noop,
    })).toBeTruthy()
    expect(rhythmProgSection({
      s, layout: computeLayout(390, 844), keyTitle: "C 大調", prog, progs, progIdx: 0,
      chords: progChords, shownIdx: 0, patch: noop, setSelected: noop, choose: noop,
    })).toBeTruthy()
    const grid = rhythmGridSections({
      s, prefs, bw: 320, pattern: { kind: "strum", strokes: ["D", "U"] }, currentSlot: -1,
      shown: progChords[0], shownFrets: [], nm: noteName(false), gridHint: "", gridLegend: "", tapStroke: noop,
    })
    expect(grid).toHaveLength(2)
  })
})

describe("Result 與 assertNever", () => {
  it("unwrapOr：成功取值、失敗用預設", () => {
    expect(unwrapOr(ok(1), 0)).toBe(1)
    expect(unwrapOr(err("x"), 0)).toBe(0)
  })
  it("assertNever 在不可能的情況丟出例外", () => {
    expect(() => assertNever("oops" as never)).toThrow()
  })
})

describe("設定的解析", () => {
  it("沒有資料或格式不對時為失敗，由呼叫端用預設值", () => {
    ;[null, undefined, 3, "x", []].forEach((raw) => {
      expect(parsePrefs(raw).ok).toBe(false)
      expect(parseRhythm(raw).ok).toBe(false)
    })
    expect(parseHub(null, null).ok).toBe(false)
    expect(parseDrill(null, []).ok).toBe(false)
  })
  it("偏好：預設值經解析後不變", () => {
    expect(unwrapOr(parsePrefs({ ...DEFAULT_PREFS }), null)).toEqual(DEFAULT_PREFS)
  })
  it("偏好：舊版兩個開關推算 boardLabel 與側邊音名", () => {
    const legacy = (flags: object) => {
      const { boardLabel: _b, showSideNames: _s, ...rest } = DEFAULT_PREFS
      return unwrapOr(parsePrefs({ ...rest, ...flags }), DEFAULT_PREFS)
    }
    expect(legacy({ showFingers: false, showNoteNames: false })).toMatchObject({ boardLabel: "none", showSideNames: false })
    expect(legacy({ showFingers: false, showNoteNames: true })).toMatchObject({ boardLabel: "name", showSideNames: true })
    expect(legacy({ showFingers: true })).toMatchObject({ boardLabel: "finger" })
  })
  it("偏好：barreShapes 缺少時用預設，含未知名稱時過濾", () => {
    const { barreShapes: _drop, ...rest } = DEFAULT_PREFS
    expect(unwrapOr(parsePrefs(rest), DEFAULT_PREFS).barreShapes).toEqual(["E", "A", "D"])
    expect(unwrapOr(parsePrefs({ ...DEFAULT_PREFS, barreShapes: ["G", "X", "E"] }), DEFAULT_PREFS).barreShapes)
      .toEqual(["E", "G"])
  })
  it("和弦設定：非法值被修正，舊版資料可沿用", () => {
    const bad = unwrapOr(parseHub({ finderQuality: "zzz", finderBass: 99, tonic: 14, scope: "x", degrees: [0, 9] }, null), DEFAULT_HUB)
    expect(bad).toMatchObject({ finderQuality: "maj", finderBass: -1, tonic: 2, scope: "open", degrees: [0] })
    expect(parseHub(null, { tonic: 7 }).ok).toBe(true)
  })
  it("練習紀錄：沿用舊 key 的最佳連對", () => {
    expect(unwrapOr(parseDrill(null, [null, { best: 12 }]), { best: 0 })).toEqual({ best: 12 })
    expect(unwrapOr(parseDrill({ best: "x" }, []), { best: -1 })).toEqual({ best: 0 })
  })
  it("節奏設定：不合法的值回到預設，bpm 被限制在範圍內", () => {
    const r = unwrapOr(parseRhythm({ beats: 7, bpm: 9999, strumPattern: "??", pickKey: "nope", repeats: 99 }), DEFAULT_RHYTHM)
    expect(r.beats).toBe(4)
    expect(r.bpm).toBeLessThan(9999)
    expect(r.strumPattern).toHaveLength(8)
    expect(r.repeats).toBe(DEFAULT_RHYTHM.repeats)
  })
  it("儲存庫：讀不到資料時回傳預設，存了之後讀得回來", () => {
    expect(prefsRepository.load()).toEqual(DEFAULT_PREFS)
    prefsRepository.save({ ...DEFAULT_PREFS, haptics: false })
    expect(prefsRepository.load().haptics).toBe(false)
    hubRepository.save({ ...DEFAULT_HUB, bpm: 120 })
    expect(hubRepository.load().bpm).toBe(120)
  })
})

describe("設計系統：色彩對比（WCAG AA）", () => {
  const AA = 4.5
  const fills = (f: string) => (f.startsWith("#") ? [hexToRgb(f)] : [SYSTEM_FILLS[f].light, SYSTEM_FILLS[f].dark])
  Object.entries(PALETTES).forEach(([name, pal]) => {
    ;(["dot", "root", "good", "bad", "question"] as const).forEach((tone) => {
      it(`${name} 配色「${tone}」底色上的 inkOn 字色在淺色與深色模式都 ≥ 4.5:1`, () => {
        const ink = hexToRgb(inkOn(pal[tone]))
        fills(pal[tone]).forEach((rgb) => expect(contrastRatio(rgb, ink)).toBeGreaterThanOrEqual(AA))
      })
    })
  })
  it("contrastRatio：黑白為 21:1，相同顏色為 1:1", () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5)
    expect(contrastRatio([10, 20, 30], [10, 20, 30])).toBeCloseTo(1, 5)
  })
  it("藍、紅、紫底用黑字（白字對比不足 4.5:1）", () => {
    expect(inkOn("systemBlue")).toBe("#000000")
    expect(inkOn("systemRed")).toBe("#000000")
    expect(inkOn("systemPurple")).toBe("#000000")
    expect(inkOn("#48484a")).toBe("#ffffff")
  })
})

describe("設計系統：無障礙文字與觸控目標", () => {
  const nm = noteName(false)
  it("describePosition：第 3 格、第五弦為 C", () => {
    expect(describePosition(1, 3, nm)).toBe("第 3 格，第五弦，音名 C")
    expect(describePosition(0, 0, nm)).toBe("空弦，第六弦，音名 E")
  })
  it("describeVoicing：C 大三和弦逐弦說明並含悶音", () => {
    const text = describeVoicing([null, 3, 2, 0, 1, 0], nm)
    expect(text.split("；")).toHaveLength(6)
    expect(text).toContain("第六弦悶音")
    expect(text).toContain("第 3 格，第五弦，音名 C")
  })
  it("刷法名稱涵蓋四種筆劃", () => {
    expect(Object.keys(STROKE_NAME_ZH).sort()).toEqual(["-", "D", "U", "X"])
  })
  it("觸控目標最小 44pt，指板格高在各寬度都不低於它", () => {
    expect(TOUCH_MIN).toBe(44)
    ;[undefined, 240, 390, 560, 800].forEach((w) => expect(cellHeightFor(w)).toBeGreaterThanOrEqual(TOUCH_MIN))
  })
})

describe("在地化：語言判斷與字串表", () => {
  const cases: [string, Parameters<typeof pickLang>[0], string][] = [
    ["實機繁體：tag zh_TW、code zh", { tag: "zh_TW", code: "zh" }, "zh-TW"],
    ["BCP 47 繁體", { tag: "zh-Hant-TW" }, "zh-TW"],
    ["香港", { tag: "zh-HK" }, "zh-TW"],
    ["只有 zh（無地區）視為繁體", { tag: "zh", code: "zh" }, "zh-TW"],
    ["簡體：zh-Hans-CN", { tag: "zh-Hans-CN" }, "en"],
    ["簡體：zh_CN", { tag: "zh_CN", code: "zh" }, "en"],
    ["新加坡", { tag: "zh-SG" }, "en"],
    ["以 script 欄位判斷簡體", { code: "zh", script: "Hans" }, "en"],
    ["英文", { tag: "en-US", code: "en" }, "en"],
    ["日文", { tag: "ja_JP", code: "ja" }, "en"],
    ["沒有任何資訊", {}, "en"],
  ]
  cases.forEach(([name, info, expected]) => it(`pickLang：${name} → ${expected}`, () => {
    expect(pickLang(info)).toBe(expected)
  }))

  it("兩種語言的鍵一致、內容非空、佔位符相同", () => {
    const zh = CATALOG["zh-TW"] as Record<string, string>
    const en = CATALOG.en as Record<string, string>
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort())
    const holders = (x: string) => (x.match(/\{\w+\}/g) ?? []).sort().join()
    Object.keys(zh).forEach((k) => {
      expect(zh[k].trim(), k).not.toBe("")
      expect(en[k].trim(), k).not.toBe("")
      expect(holders(en[k]), k).toBe(holders(zh[k]))
    })
  })
  it("formatMessage：取代佔位符，缺參數時保留", () => {
    expect(formatMessage("第 {n} 格 {name}", { n: 3, name: "C" })).toBe("第 3 格 C")
    expect(formatMessage("第 {n} 格", {})).toBe("第 {n} 格")
    expect(formatMessage("沒有佔位符")).toBe("沒有佔位符")
  })
  it("translatorFor：依語言取字串", () => {
    expect(translatorFor("zh-TW")("tab.chords")).toBe("和弦")
    expect(translatorFor("en")("tab.chords")).toBe("Chords")
  })
  it("readLocaleInfo 讀取 Device（測試替身為繁體）並判為 zh-TW", () => {
    expect(pickLang(readLocaleInfo())).toBe("zh-TW")
  })
})
