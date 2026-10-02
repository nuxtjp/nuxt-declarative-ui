import {expect,it} from 'vitest'
import {ownerInputFields} from '../src/runtime/shared/owner-input'
const declaration=()=>({action:{operation_id:'replace',target:'target',contract_revision:'exact',
  input_schema:{type:'object',fields:{opaque:{type:'string',max_length:40,choices:['r1','r2']}},required:['opaque']},
  availability:{state:'available'},expected_revision_required:true},
  fields:{opaque:{label:'Select',sensitive:false,choices:[{value:'r1',label:'Same'},{value:'r2',label:'Same'}]}}})

it('render plan comes only from exact owner schema and opaque field refs',()=>{
  const d=declaration(),fields=ownerInputFields(d)
  expect(fields).toHaveLength(1)
  expect(fields[0]?.id).toBe('opaque')
  expect(fields[0]?.presentation.choices?.map(c=>c.value)).toEqual(['r1','r2'])
  d.fields.opaque.label='Renamed'
  expect(ownerInputFields(d)[0]?.id).toBe('opaque')
})
it('unsupported declarations cannot fall back to recursive JSON or injected renderers',()=>{
  expect(ownerInputFields({...declaration(),component:'Remote'})).toEqual([])
  expect(ownerInputFields({})).toEqual([])
  const d=declaration()
  d.fields.opaque.choices[0]!.value='forged'
  expect(ownerInputFields(d)).toEqual([])
})
