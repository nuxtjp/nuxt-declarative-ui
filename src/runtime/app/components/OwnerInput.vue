<script setup lang="ts">
// Renderer only. Drafts and exact interaction lifecycle belong to its caller.
import {computed,nextTick,ref,useTemplateRef,watch} from 'vue'
import type {InputDeclaration} from '@zixcel/interaction/input'
import {validateInputDeclaration,validateInputValues} from '@zixcel/interaction/input'
import type {Json} from '@zixcel/interaction'
import {ownerInputFields} from '../../shared/owner-input'
const props=defineProps<{declaration:InputDeclaration;values:Record<string,Json>;binding:string;busy?:boolean;submitLabel?:string}>()
const emit=defineEmits<{change:[values:Record<string,Json>];submit:[values:Record<string,Json>];invalid:[reason:string]}>()
const fields=computed(()=>ownerInputFields(props.declaration))
const invalid=computed(()=>validateInputDeclaration(props.declaration).length>0)
const issue=ref('')
const validation=useTemplateRef<HTMLElement>('validation')
watch(()=>props.binding,()=>{issue.value=''}, {flush:'sync'})
function change(id:string,value:unknown){
  if(props.busy||invalid.value)return
  const values={...props.values}
  if(value===undefined||value===null)delete values[id]
  else values[id]=value as Json
  emit('change',values)
}
async function submit(){
  if(props.busy)return
  const errors=validateInputValues(props.declaration,props.values)
  issue.value=errors[0]??''
  if(issue.value){emit('invalid',issue.value);await nextTick();validation.value?.focus()}
  else emit('submit',{...props.values})
}
</script>

<template>
  <UAlert v-if="invalid" color="warning" title="Input unavailable" description="input/declaration/invalid" />
  <form v-else :key="binding" class="owner-input" @submit.prevent="submit">
    <UFormField v-for="field in fields" :key="field.id" :label="field.presentation.label" :name="field.id" :required="field.required">
      <USelect v-if="field.presentation.choices" :model-value="values[field.id] as string | undefined"
        :items="field.presentation.choices" value-key="value" label-key="label" :disabled="busy" class="w-full"
        @update:model-value="change(field.id,$event)" />
      <USelect v-else-if="field.schema.type==='boolean'" :model-value="values[field.id]===true?'true':values[field.id]===false?'false':undefined"
        :items="[{label:'Yes',value:'true'},{label:'No',value:'false'}]" value-key="value" label-key="label" :disabled="busy" class="w-full"
        @update:model-value="change(field.id,$event===undefined?undefined:$event==='true')" />
      <UInputNumber v-else-if="field.schema.type==='number'||field.schema.type==='integer'" :model-value="values[field.id] as number | undefined"
        :min="field.schema.minimum" :max="field.schema.maximum" :disabled="busy" class="w-full" @update:model-value="change(field.id,$event)" />
      <UInput v-else-if="field.schema.type==='string'" :model-value="values[field.id] as string | undefined" :type="field.presentation.sensitive?'password':'text'"
        :maxlength="field.schema.max_length" :autocomplete="field.presentation.sensitive?'off':undefined" :disabled="busy" class="w-full" @update:model-value="change(field.id,$event)" />
    </UFormField>
    <div v-if="issue" ref="validation" tabindex="-1" role="alert"><UAlert color="error" :title="issue" /></div>
    <UButton type="submit" :loading="busy" :disabled="busy||declaration.action.availability.state!=='available'">{{ submitLabel??'Submit' }}</UButton>
  </form>
</template>

<style scoped>
.owner-input{display:grid;gap:1rem;min-width:0;padding:1rem;overflow-wrap:anywhere}
</style>
