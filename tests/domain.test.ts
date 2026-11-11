import { describe, expect, it } from "vitest"
import type { QualityKey } from "../GuitarToolbox/index"
import {
  FINDER_QUALITIES, MAJOR_PROGS, MOVABLE_SHAPES, OPEN, OPEN_STRINGS, computeLayout, DEFAULT_HUB, diatonicChords, effectiveBass, finderViewOf, keyTitleOf, practiceDeckOf, progressionSeconds, stepIndex, isQualityKey, QUALITY_KEYS,
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
