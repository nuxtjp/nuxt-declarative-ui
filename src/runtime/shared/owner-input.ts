// Trusted rendering projection of an owner declaration, not a schema authority.
import {validateInputDeclaration} from '@zixcel/interaction/input'
import type {InputDeclaration,InputField} from '@zixcel/interaction/input'
import type {ValueSchema} from '@zixcel/interaction'
export interface OwnerInputField {id:string;schema:ValueSchema;required:boolean;presentation:InputField}
export function ownerInputFields(value:unknown):OwnerInputField[]{
  if(validateInputDeclaration(value).length)return []
  const d=value as InputDeclaration,s=d.action.input_schema
  if(s.type!=='object')return []
  return Object.entries(s.fields).map(([id,schema])=>({id,schema,required:s.required?.includes(id)??false,presentation:d.fields[id]!}))
}
