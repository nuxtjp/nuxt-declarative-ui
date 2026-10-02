import { capabilities } from '#build/interaction-capabilities.mjs'
import { createRegistry } from './interaction'
export function installedRegistry() {
  const registry = createRegistry()
  for (const [kind, value] of Object.entries(capabilities)) registry.register(kind, value)
  registry.seal(); return registry
}
export function installedRenderer(kind: string) { return capabilities[kind]?.renderer }
