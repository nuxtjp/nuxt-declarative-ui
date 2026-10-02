<script setup lang="ts">
import { computed, inject } from 'vue'
import type { UiNode } from '../../shared/interaction'
import { surfaceContext } from '../../shared/surface'
import { installedRenderer } from '../../shared/installed'
import { draftKey } from '../../shared/drafts'

const props = defineProps<{ node: UiNode }>()
const context = inject(surfaceContext)
if (!context) throw new Error('surface/context/missing')
const resource = computed(() => context.resource(props.node.resource))
const field = computed(() => props.node.resource && props.node.operation && props.node.field ? context.field(props.node.resource, props.node.operation, props.node.field) : undefined)
const action = computed(() => resource.value?.contract.operations.find(a => a.operation_id === props.node.operation))
const available = computed(() => resource.value?.contract.readable && resource.value.contract.availability.state === 'available')
const issue = computed(() => {
  const result = context.feedback.value
  return result && result.status !== 'Success' ? result.issues.find(i => i.path === `/${props.node.field}`)?.reason : undefined
})
const key = computed(() => draftKey(props.node.resource ?? '', props.node.operation ?? ''))
const model = computed({get:() => context.drafts[key.value]?.[props.node.field ?? ''],
  set:(value) => { const draft = context.drafts[key.value]; if (draft && props.node.field) draft[props.node.field] = value ?? null }})
const display = computed(() => {
  const value = resource.value?.value
  return props.node.field && value && typeof value === 'object' && !Array.isArray(value) ? value[props.node.field] : value
})
const rows = computed(() => Array.isArray(resource.value?.value) ? resource.value.value as Record<string, unknown>[] : [])
const columns = computed(() => (props.node.fields ?? []).map(field => ({accessorKey:field,header:field})))
</script>

<template>
  <div :data-node="node.id" :data-resource-revision="resource?.resource_revision" class="interaction-node">
    <template v-if="node.kind === 'region' || node.kind === 'group'">
      <h2 v-if="node.label">{{ node.label }}</h2>
      <InteractionNode v-for="child in node.children" :key="child.id" :node="child" />
    </template>
    <UAlert v-else-if="node.resource && !available" color="warning" :title="node.label ?? node.resource"
      :description="resource?.contract.availability.state === 'available' ? 'Read access unavailable' : resource?.contract.availability.reason" />
    <template v-else-if="node.kind === 'display'">
      <span v-if="node.label">{{ node.label }}: </span><span>{{ typeof display === 'object' ? JSON.stringify(display) : String(display ?? '') }}</span>
    </template>
    <UFormField v-else-if="node.kind === 'input'" :label="node.label" :name="node.field" :error="issue">
      <USwitch v-if="field?.type === 'boolean'" v-model="model" :disabled="context.busy.value" />
      <USelect v-else-if="field?.type === 'string' && field.choices?.length" v-model="model" :items="field.choices" :disabled="context.busy.value" />
      <UInputNumber v-else-if="field?.type === 'integer' || field?.type === 'number'" v-model="model" :min="field.minimum" :max="field.maximum" :disabled="context.busy.value" />
      <UInput v-else-if="field?.type === 'string'" v-model="model" :maxlength="field.max_length" :disabled="context.busy.value" />
      <UAlert v-else color="warning" title="Input capability unavailable" />
    </UFormField>
    <UTable v-else-if="node.kind === 'collection'" :data="rows" :columns="columns" />
    <UButton v-else-if="node.kind === 'action'" :loading="context.busy.value" :disabled="action?.availability.state !== 'available'"
      @click="context.invoke(node.resource!, node.operation!)">{{ node.label }}</UButton>
    <template v-else-if="node.kind === 'feedback' && context.feedback.value">
      <UAlert :color="context.feedback.value.status === 'Success' ? 'success' : 'error'" :title="context.feedback.value.status"
        :description="context.feedback.value.status === 'Success' ? undefined : context.feedback.value.reason" role="status" />
    </template>
    <component v-else-if="installedRenderer(node.kind)" :is="installedRenderer(node.kind)" :node="node" :resource="resource" />
  </div>
</template>

<style scoped>
.interaction-node { min-width: 0; display: flex; flex-direction: column; gap: .75rem; }
</style>
