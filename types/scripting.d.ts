/**
 * Scripting App 的最小型別外殼（僅供開發機 tsc 型別檢查）。
 *
 * Scripting 官方未公開 npm 型別套件（型別內建於 App），所以這裡只宣告 index.tsx 實際用到的名稱：
 * - 元件 props 一律放寬為 AnyProps，因此畫面元件的 props 拼字與型別「不會」被檢查；
 * - Domain／Application／Infrastructure 的型別檢查完全有效，這是設定 tsc 的主要目的。
 * index.tsx 新增用到的 scripting 名稱時，請同步補在此處，並以官方文件為準。
 */
declare module "scripting" {
  type AnyProps = { readonly [prop: string]: any; readonly children?: any }
  type GeometryProxy = {
    readonly size: { readonly width: number; readonly height: number }
    readonly safeAreaInsets: { readonly leading: number; readonly top: number; readonly trailing: number; readonly bottom: number }
  }
  type Component = (props: AnyProps) => JSX.Element

  export const Button: Component
  export const Circle: Component
  export const GeometryReader: (props: { readonly children: (proxy: GeometryProxy) => JSX.Element }) => JSX.Element
  export const HStack: Component
  export const Label: Component
  export const List: Component
  export const NavigationStack: Component
  export const Picker: Component
  export const Rectangle: Component
  export const ScrollView: Component
  export const Section: Component
  export const Spacer: Component
  export const TabView: Component
  export const Text: Component
  export const Toggle: Component
  export const VStack: Component
  export const ZStack: Component

  export const Navigation: {
    present(options: { readonly element: JSX.Element }): Promise<void>
  }
  export const Script: { exit(): void }
  // 欄位依官方「Device」頁的 Locale and Language 一節；皆為唯讀
  export const Device: {
    readonly systemLanguageTag?: string
    readonly systemLanguageCode?: string
    readonly systemCountryCode?: string
    readonly systemScriptCode?: string
  }

  export function useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void
  export function useMemo<T>(factory: () => T, deps: readonly unknown[]): T
  export function useState<T>(initial: T | (() => T)): [T, (next: T | ((prev: T) => T)) => void]
  export function useReducer<S, A>(reducer: (state: S, action: A) => S, initial: S): [S, (action: A) => void]
}

declare const Storage: {
  get<T>(key: string, options?: { readonly shared: boolean }): T | null
  set<T>(key: string, value: T, options?: { readonly shared: boolean }): boolean
}
declare const FileManager: {
  readonly temporaryDirectory: string
  exists(path: string): Promise<boolean>
  remove(path: string): Promise<void>
  writeAsBytes(path: string, bytes: any): Promise<void>
}
declare const SharedAudioSession: {
  setCategory(category: string, options?: readonly string[]): Promise<void>
  setActive(active: boolean): Promise<void>
}
declare class AVPlayer {
  onReadyToPlay?: () => void
  onError?: (message: string) => void
  numberOfLoops: number
  setSource(path: string): boolean
  play(): void
  stop(): void
  dispose(): void
}
declare const console: { error(...args: unknown[]): void; log(...args: unknown[]): void }
declare function setTimeout(fn: () => void, ms?: number): number
declare function clearTimeout(id: number): void
declare function setInterval(fn: () => void, ms?: number): number
declare function clearInterval(id: number): void

declare namespace JSX {
  interface Element {}
  interface IntrinsicAttributes { readonly key?: string | number }
  interface IntrinsicElements { readonly [tag: string]: unknown }
  interface ElementChildrenAttribute { children: unknown }
}
