import { expect, it } from 'vitest'
import type { Json } from '@zixcel/interaction'
import type { ViewSnapshot } from '../src/runtime/shared/interaction'
import { createDraftState, draftKey } from '../src/runtime/shared/drafts'

it('isolates action input, preserves exact dirty preconditions and retry identity, then clears on scope change', () => {
  const drafts: Record<string, Record<string, Json>> = Object.create(null)
  const editor = createDraftState(drafts)
  const snapshot: ViewSnapshot = {scope:'one',cursor:'c1',declaration_revision:'d1',
    declaration:{id:'example',revision:'d1',title:'Example',nodes:[
      {id:'input',kind:'input',resource:'item',operation:'rename',field:'replacement',from:'name',label:'Rename'},
      {id:'flag',kind:'input',resource:'item',operation:'toggle',field:'flag',from:'enabled',label:'Toggle'},
    ]},resources:[{contract:{resource_id:'item',contract_revision:'c1',readable:true,availability:{state:'available'},
      value_schema:{type:'object',fields:{name:{type:'string'},enabled:{type:'boolean'},private:{type:'string'}}},
      operations:[{operation_id:'rename',target:'item',contract_revision:'a1',expected_revision_required:true,availability:{state:'available'},
        input_schema:{type:'object',fields:{replacement:{type:'string'}}}},
      {operation_id:'toggle',target:'item',contract_revision:'t1',expected_revision_required:true,availability:{state:'available'},
        input_schema:{type:'object',fields:{flag:{type:'boolean'}}}}]},
      resource_revision:'r1',value:{name:'Ada',enabled:false,private:'never submitted'}}]}
  editor.reconcile(snapshot)
  const key = draftKey('item','rename')
  expect(drafts[key]).toEqual({replacement:'Ada'})
  expect(drafts[draftKey('item','toggle')]).toEqual({flag:false})
  drafts[key]!.replacement = 'Grace'
  const request = editor.request(snapshot.resources[0]!, 'rename', () => 'first')
  expect(request.input).toEqual({replacement:'Grace'})
  expect(editor.request(snapshot.resources[0]!, 'rename', () => 'should-not-be-used')).toEqual(request)
  const changed = structuredClone(snapshot)
  changed.resources[0]!.resource_revision = 'r2'
  changed.resources[0]!.contract.operations[0]!.contract_revision = 'a2'
  editor.reconcile(changed)
  const stale = editor.request(changed.resources[0]!, 'rename', () => 'new')
  expect(stale).toEqual(request)
  const freshToggle = editor.request(changed.resources[0]!, 'toggle', () => 'toggle')
  expect(freshToggle.expected_revision).toBe('r2')
  expect(freshToggle.input).toEqual({flag:false})
  const other = structuredClone(changed)
  other.scope = 'two'
  other.resources[0]!.value = {name:'Lin',enabled:true,private:'other'}
  editor.reconcile(other)
  expect(drafts[key]).toEqual({replacement:'Lin'})
  expect(editor.request(other.resources[0]!, 'rename', () => 'other').request_reference).toBe('other')
})
