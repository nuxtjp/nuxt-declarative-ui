<script setup lang="ts">
import { computed, provide, reactive, toRef, watch } from 'vue'
import type { Json, InvokeRequest, Outcome } from '@zixcel/interaction'
import type { ViewSnapshot } from '../../shared/interaction'
import { validateSnapshot } from '../../shared/interaction'
import { installedRegistry } from '../../shared/installed'
import { surfaceContext } from '../../shared/surface'
import InteractionNode from './InteractionNode.vue'
import { createDraftState } from '../../shared/drafts'

const props = defineProps<{ snapshot: ViewSnapshot; busy?: boolean; feedback?: Outcome<unknown> | null }>()
const emit = defineEmits<{ invoke: [request: InvokeRequest] }>()
const drafts = reactive<Record<string, Record<string, Json>>>(Object.create(null))
const editor = createDraftState(drafts)
const registry = installedRegistry()
const errors = computed(() => validateSnapshot(props.snapshot, props.snapshot.scope, registry))
watch(() => props.busy, (busy, before) => {
  if (before && !busy && props.feedback?.status === 'Success') editor.succeeded(props.snapshot)
})
watch(() => props.snapshot, snapshot => {
  if (!errors.value.length) editor.reconcile(snapshot)
}, { immediate: true })
const resource = (id?: string) => props.snapshot.resources.find(item => item.contract.resource_id === id)
provide(surfaceContext, {
  snapshot: toRef(props, 'snapshot'), drafts, busy: computed(() => props.busy ?? false), feedback: computed(() => props.feedback ?? null), resource,
  field(id, operation, name) { const s = resource(id)?.contract.operations.find(a => a.operation_id === operation)?.input_schema; return s?.type === 'object' ? s.fields[name] : undefined },
  invoke(id, operation) {
    const item = resource(id), action = item?.contract.operations.find(a => a.operation_id === operation)
    if (!item || !action || props.busy || action.availability.state !== 'available') return
    emit('invoke', editor.request(item, operation, () => crypto.randomUUID()))
  },
})
</script>

<template>
  <section class="interaction-view" :aria-busy="busy" :data-declaration-revision="snapshot.declaration_revision" :data-cursor="snapshot.cursor">
    <UAlert v-if="errors.length" color="error" title="Declaration unavailable" :description="errors.join(', ')" role="alert" />
    <template v-else>
      <h1>{{ snapshot.declaration.title }}</h1>
      <InteractionNode v-for="node in snapshot.declaration.nodes" :key="node.id" :node="node" />
    </template>
  </section>
</template>

<style scoped>
.interaction-view { min-width: 0; display: flex; flex-direction: column; gap: 1rem; padding: 1rem; overflow: auto; }
</style>
