import { reference, validateResource } from '@zixcel/interaction'
import type { ResourceSnapshot } from '@zixcel/interaction'

export interface UiNode {
  id: string; kind: string; label?: string; resource?: string; field?: string
  fields?: string[]; operation?: string; from?: string; children?: UiNode[]
}
export interface Declaration { id: string; revision: string; title: string; nodes: UiNode[] }
export interface ViewSnapshot {
  scope: string; cursor: string; declaration_revision: string
  declaration: Declaration; resources: ResourceSnapshot[]
}
export interface Capability { required: string[]; optional: string[] }

const core: Record<string, Capability> = {
  region: { required: ['children'], optional: ['label'] },
  group: { required: ['children'], optional: ['label'] },
  display: { required: ['resource'], optional: ['field','label'] },
  input: { required: ['resource','operation','field','label'], optional: ['from'] },
  collection: { required: ['resource','fields'], optional: ['label'] },
  action: { required: ['resource','operation','label'], optional: [] },
  feedback: { required: [], optional: ['label'] },
}

/** Called by trusted build-time Nuxt modules. Never accepts runtime renderer code. */
export function createRegistry() {
  const entries = new Map<string, Capability>()
  let sealed = false
  function register(kind: string, capability: Capability) {
    if (sealed || !reference(kind) || entries.has(kind)
      || ![...capability.required, ...capability.optional].every(reference)) throw new Error('capability/registration/invalid')
    entries.set(kind, Object.freeze({ required: Object.freeze([...capability.required]) as unknown as string[],
      optional: Object.freeze([...capability.optional]) as unknown as string[] }))
  }
  for (const [kind, capability] of Object.entries(core)) register(kind, capability)
  return { register, get: (kind: string) => entries.get(kind), seal: () => { sealed = true } }
}
export type Registry = ReturnType<typeof createRegistry>
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const keys = (v: Record<string, unknown>, allowed: string[]) => Object.keys(v).every(k => allowed.includes(k))

export function validateDeclaration(value: unknown, registry: Registry): string[] {
  const errors = new Set<string>()
  if (!object(value) || !keys(value, ['id','revision','title','nodes'])
    || !reference(value.id) || !reference(value.revision) || !reference(value.title)
    || !Array.isArray(value.nodes)) return ['declaration/invalid']
  const ids = new Set<string>()
  let count = 0
  function visit(nodes: unknown[], depth: number) {
    if (depth > 16 || nodes.length > 512) { errors.add('node/limit'); return }
    for (const node of nodes) {
      if (++count > 512) { errors.add('node/limit'); return }
      if (!object(node) || !reference(node.id) || !reference(node.kind)) { errors.add('node/invalid'); continue }
      if (ids.has(node.id)) errors.add('node/id/duplicate')
      ids.add(node.id)
      const capability = registry.get(node.kind)
      if (!capability) { errors.add('node/capability/unavailable'); continue }
      if (!keys(node, ['id','kind',...capability.required,...capability.optional])
        || !capability.required.every(k => Object.hasOwn(node, k))) { errors.add('node/fields/invalid'); continue }
      for (const [key, item] of Object.entries(node)) {
        if (key === 'children') {
          if (!Array.isArray(item)) errors.add('node/children/invalid')
          else visit(item, depth + 1)
        } else if (key === 'fields') {
          if (!Array.isArray(item) || item.length > 128 || !item.every(reference) || new Set(item).size !== item.length) errors.add('node/fields/invalid')
        } else if (!reference(item)) errors.add('node/value/invalid')
      }
    }
  }
  visit(value.nodes, 0)
  return [...errors]
}

/** An exact envelope around Zixcel resources, never a second field/value model. */
export function validateSnapshot(value: unknown, scope: string, registry: Registry): string[] {
  if (!object(value) || !keys(value, ['scope','cursor','declaration_revision','declaration','resources'])
    || !reference(value.scope) || !reference(value.cursor) || !reference(value.declaration_revision)
    || !Array.isArray(value.resources) || value.resources.length > 128) return ['snapshot/invalid']
  const errors = validateDeclaration(value.declaration, registry)
  if (value.scope !== scope) errors.push('snapshot/scope/mismatch')
  if (!object(value.declaration) || value.declaration_revision !== value.declaration.revision) errors.push('snapshot/declaration/revision/mismatch')
  const resources = new Map<string, ResourceSnapshot>()
  for (const resource of value.resources) {
    const invalid = validateResource(resource)
    if (invalid.length) { errors.push(...invalid); continue }
    const typed = resource as ResourceSnapshot
    if (resources.has(typed.contract.resource_id)) errors.push('snapshot/resource/duplicate')
    resources.set(typed.contract.resource_id, typed)
  }
  if (!errors.length || errors.every(e => e === 'snapshot/resource/duplicate')) {
    function visit(nodes: UiNode[]) {
      for (const node of nodes) {
        if (node.resource) {
          const resource = resources.get(node.resource)
          if (!resource) errors.push('snapshot/resource/missing')
          else {
            const action = resource.contract.operations.find(a => a.operation_id === node.operation)
            const schema = node.kind === 'input' ? action?.input_schema : resource.contract.value_schema
            if (node.field && (schema?.type !== 'object' || !Object.hasOwn(schema.fields, node.field))) errors.push('snapshot/field/missing')
            if (node.from && (resource.contract.value_schema.type !== 'object'
              || !Object.hasOwn(resource.contract.value_schema.fields, node.from))) errors.push('snapshot/input/source/missing')
            if (node.operation && !resource.contract.operations.some(a => a.operation_id === node.operation)) errors.push('snapshot/operation/missing')
            if (node.fields && (schema?.type !== 'array' || schema.items.type !== 'object'
              || !node.fields.every(field => schema.items.type === 'object' && Object.hasOwn(schema.items.fields, field)))) errors.push('snapshot/collection/invalid')
          }
        }
        if (node.children) visit(node.children)
      }
    }
    visit((value.declaration as unknown as Declaration).nodes)
  }
  return [...new Set(errors)]
}

export function snapshotKey(user: string, role: string, view: string): string {
  return JSON.stringify(['interaction', user, role, view])
}
