import type { InvokeRequest, Json, ResourceSnapshot } from '@zixcel/interaction'
import type { UiNode, ViewSnapshot } from './interaction'

export const draftKey = (resource: string, operation: string) => JSON.stringify([resource, operation])

/** Operation drafts are projections, never a copy of the whole resource value.
 * Only explicit declaration mappings seed an input. No guessed field aliases. */
export function createDraftState(drafts: Record<string, Record<string, Json>>) {
  const baselines = new Map<string, string>()
  const revisions = new Map<string, { contract: string; resource: string }>()
  let pending: { fingerprint: string; request: InvokeRequest } | undefined
  let scope: string | undefined
  function initial(snapshot: ViewSnapshot, item: ResourceSnapshot, operation: string) {
    const result: Record<string, Json> = Object.create(null)
    function visit(nodes: UiNode[]) {
      for (const node of nodes) {
        if (node.kind === 'input' && node.resource === item.contract.resource_id
          && node.operation === operation && node.from && node.field
          && item.value && typeof item.value === 'object' && !Array.isArray(item.value)
          && Object.hasOwn(item.value, node.from)) result[node.field] = structuredClone(item.value[node.from]!)
        if (node.children) visit(node.children)
      }
    }
    visit(snapshot.declaration.nodes)
    return result
  }
  function reset(snapshot: ViewSnapshot, item: ResourceSnapshot, operation: string) {
    const action = item.contract.operations.find(a => a.operation_id === operation)!
    const key = draftKey(item.contract.resource_id, operation)
    drafts[key] = initial(snapshot, item, operation)
    baselines.set(key, JSON.stringify(drafts[key]))
    revisions.set(key, {contract: action.contract_revision, resource: item.resource_revision})
  }
  return {
    reconcile(snapshot: ViewSnapshot) {
      if (scope !== snapshot.scope) {
        for (const key of Object.keys(drafts)) delete drafts[key]
        baselines.clear(); revisions.clear(); pending = undefined; scope = snapshot.scope
      }
      const visible = new Set<string>()
      for (const item of snapshot.resources) {
        if (!item.contract.readable || item.contract.availability.state !== 'available') continue
        for (const action of item.contract.operations) {
          const key = draftKey(item.contract.resource_id, action.operation_id)
          visible.add(key)
          if (!Object.hasOwn(drafts, key) || JSON.stringify(drafts[key]) === baselines.get(key)) reset(snapshot, item, action.operation_id)
          else for (const [field, value] of Object.entries(initial(snapshot, item, action.operation_id))) {
            if (!Object.hasOwn(drafts[key]!, field)) drafts[key]![field] = value
          }
        }
      }
      for (const key of Object.keys(drafts)) if (!visible.has(key)) {
        delete drafts[key]; baselines.delete(key); revisions.delete(key)
      }
    },
    request(item: ResourceSnapshot, operation: string, reference: () => string): InvokeRequest {
      const action = item.contract.operations.find(a => a.operation_id === operation)!
      const key = draftKey(item.contract.resource_id, operation)
      const body = {operation_id:operation,target:action.target,
        input:action.input_schema.type === 'null' ? null : drafts[key] ?? {},
        contract_revision:revisions.get(key)?.contract ?? action.contract_revision,
        expected_revision:revisions.get(key)?.resource ?? item.resource_revision}
      const fingerprint = JSON.stringify(body)
      if (!pending || pending.fingerprint !== fingerprint) pending = {fingerprint, request:{...JSON.parse(fingerprint),request_reference:reference()}}
      return pending.request
    },
    succeeded(snapshot: ViewSnapshot) {
      if (pending) {
        const item = snapshot.resources.find(r => r.contract.resource_id === pending!.request.target)
        if (item?.contract.operations.some(a => a.operation_id === pending!.request.operation_id)) reset(snapshot, item, pending.request.operation_id)
      }
      pending = undefined
    },
  }
}
