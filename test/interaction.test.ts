import { describe, expect, it } from 'vitest'
import { createRegistry, validateDeclaration, snapshotKey, validateSnapshot } from '../src/runtime/shared/interaction'
import type { ViewSnapshot } from '../src/runtime/shared/interaction'

const declaration = () => ({ id: 'items', revision: 'd1', title: 'Items', nodes: [
  { id: 'main', kind: 'region', children: [
    { id: 'list', kind: 'collection', resource: 'items', fields: ['name'] },
    { id: 'name', kind: 'input', resource: 'draft', operation: 'save', field: 'name', from: 'name', label: 'Name' },
    { id: 'save', kind: 'action', resource: 'draft', operation: 'save', label: 'Save' },
    { id: 'outcome', kind: 'feedback' },
  ] },
] })

describe('runtime declarations and snapshot boundaries', () => {
  it('accepts new views, fields, collections and actions using installed capabilities only', () => {
    const registry = createRegistry()
    const first = declaration()
    expect(validateDeclaration(first, registry)).toEqual([])
    const second = { ...declaration(), id: 'other', revision: 'd2' }
    second.nodes[0]!.children.push({ id: 'otherField', kind: 'input', resource: 'draft', operation: 'save', field: 'other', from: 'other', label: 'Other' })
    expect(validateDeclaration(second, registry)).toEqual([])
    expect(snapshotKey('user1', 'role1', 'items')).not.toBe(snapshotKey('user1', 'role2', 'items'))
    expect(snapshotKey('user1', 'role1', 'items')).not.toBe(snapshotKey('user2', 'role1', 'items'))
  })

  it('rejects executable declarations, duplicate IDs, broken nodes and uninstalled primitives', () => {
    const registry = createRegistry()
    for (const node of [
      { id: 'x', kind: 'input', component: 'UInput' },
      { id: 'x', kind: 'display', html: '<script>alert(1)</script>' },
      { id: 'x', kind: 'module', src: 'file:///tmp/evil.mjs' },
      { id: 'x', kind: 'input', resource: 'draft', field: 'name', onClick: 'execute()' },
      { id: 'x', kind: 'uninstalled' },
    ]) expect(validateDeclaration({ ...declaration(), nodes: [node] }, registry).length).toBeGreaterThan(0)
    const duplicate = declaration()
    duplicate.nodes.push(duplicate.nodes[0]!)
    expect(validateDeclaration(duplicate, registry)).toContain('node/id/duplicate')
  })

  it('registers a capability at build time without trusting runtime component names', () => {
    const registry = createRegistry()
    registry.register('diagram', { required: ['resource'], optional: [] })
    const doc = { ...declaration(), nodes: [{ id: 'diagram', kind: 'diagram', resource: 'items' }] }
    expect(validateDeclaration(doc, registry)).toEqual([])
    expect(() => registry.register('diagram', { required: [], optional: [] })).toThrow()
    registry.seal()
    expect(() => registry.register('late', { required: [], optional: [] })).toThrow()
  })

  it('requires exact declaration, contract and resource revisions and scoped snapshots', () => {
    const doc = declaration()
    const snapshot = { scope: 'u1/r1', cursor: 'c1', declaration_revision: 'd1', declaration: doc,
      resources: [
        { contract: { resource_id: 'items', contract_revision: 'c1', readable: true, availability: { state: 'available' },
          value_schema: { type: 'array', max_items: 10, items: { type: 'object', fields: { name: { type: 'string' } } } }, operations: [] },
          resource_revision: 'r1', value: [{ name: 'Ada' }] },
        { contract: { resource_id: 'draft', contract_revision: 'c2', readable: true, availability: { state: 'available' },
          value_schema: { type: 'object', fields: { name: { type: 'string' } } }, operations: [{ operation_id: 'save', target: 'draft',
            contract_revision: 'a1', input_schema: { type: 'object', fields: { name: { type: 'string' } } },
            availability: { state: 'available' }, expected_revision_required: true }] }, resource_revision: 'r2', value: { name: 'Ada' } },
      ] }
    expect(validateSnapshot(snapshot, 'u1/r1', createRegistry())).toEqual([])
    const specific = structuredClone(snapshot) as ViewSnapshot
    const input = specific.declaration.nodes[0]!.children![1]!
    input.field = 'replacement'
    const action = specific.resources[1]!.contract.operations[0]!
    action.input_schema = { type: 'object', fields: { replacement: { type: 'string' } } }
    expect(validateSnapshot(specific, 'u1/r1', createRegistry())).toEqual([])
    input.from = 'not-a-provider-field'
    expect(validateSnapshot(specific, 'u1/r1', createRegistry())).toContain('snapshot/input/source/missing')
    expect(validateSnapshot(snapshot, 'u2/r1', createRegistry())).toContain('snapshot/scope/mismatch')
    expect(validateSnapshot({ ...snapshot, declaration_revision: 'old' }, 'u1/r1', createRegistry())).toContain('snapshot/declaration/revision/mismatch')
    expect(validateSnapshot({ ...snapshot, resources: [] }, 'u1/r1', createRegistry())).toContain('snapshot/resource/missing')
    expect(validateSnapshot({ ...snapshot, resources: [...snapshot.resources, snapshot.resources[0]] }, 'u1/r1', createRegistry())).toContain('snapshot/resource/duplicate')
  })
})
