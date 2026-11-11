// 測試用的 "scripting" 替身：元件一律回傳 null，副作用 API 為空操作。
const component = () => null
export const Button = component, Circle = component, GeometryReader = component, HStack = component,
  Label = component, List = component, NavigationStack = component, Picker = component,
  Rectangle = component, ScrollView = component, Section = component, Spacer = component,
  TabView = component, Text = component, Toggle = component, VStack = component, ZStack = component
export const Navigation = { present: async () => undefined }
export const Script = { exit: () => undefined }
export const useEffect = () => undefined
export const useMemo = <T,>(f: () => T) => f()
export const useState = <T,>(v: T) => [v, () => undefined] as const
export const useReducer = <S,>(_r: unknown, s: S) => [s, () => undefined] as const
