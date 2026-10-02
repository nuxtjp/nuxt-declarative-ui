import type { InjectionKey, Ref } from 'vue'
import type { InvokeRequest, Json, Outcome, ResourceSnapshot, ValueSchema } from '@zixcel/interaction'
import type { ViewSnapshot } from './interaction'

export interface SurfaceContext {
  snapshot: Ref<ViewSnapshot>
  drafts: Record<string, Record<string, Json>>
  busy: Ref<boolean>
  feedback: Ref<Outcome<unknown> | null>
  resource(id?: string): ResourceSnapshot | undefined
  field(resource: string, operation: string, field: string): ValueSchema | undefined
  invoke(resource: string, operation: string): void
}
export const surfaceContext: InjectionKey<SurfaceContext> = Symbol('declarative-surface')
export type { InvokeRequest }
