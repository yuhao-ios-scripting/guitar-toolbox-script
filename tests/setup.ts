// index.tsx 直接使用的全域 API（正式環境由 Scripting 提供）
const store = new Map<string, unknown>()
Object.assign(globalThis, {
  h: (type: unknown, props: unknown, ...children: unknown[]) => ({ type, props, children }), Fragment: null,
  Storage: { get: (k: string) => store.get(k) ?? null, set: (k: string, v: unknown) => { store.set(k, v) } },
})

// 音訊相關全域的替身：記錄建立的播放器，讓測試可以模擬「準備好」「開始播放」等回呼
export const fakePlayers: FakePlayer[] = []
class FakePlayer {
  onReadyToPlay?: () => void
  onError?: (message: string) => void
  onTimeControlStatusChanged?: (status: unknown) => void
  numberOfLoops = 0
  played = 0
  source = ""
  constructor() { fakePlayers.push(this) }
  setSource(path: string): boolean { this.source = path; return true }
  play(): void { this.played++ }
  stop(): void {}
  dispose(): void {}
}
Object.assign(globalThis, {
  AVPlayer: FakePlayer,
  FileManager: {
    temporaryDirectory: "/tmp",
    exists: async () => true,
    remove: async () => undefined,
    writeAsBytes: async () => undefined,
  },
  SharedAudioSession: { setCategory: async () => undefined, setActive: async () => undefined },
  __fakePlayers: fakePlayers,
})
