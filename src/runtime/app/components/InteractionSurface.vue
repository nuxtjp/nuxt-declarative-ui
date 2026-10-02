<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref, watch } from 'vue'
import { useAsyncData, useRequestFetch } from 'nuxt/app'
import { createHttpTransport } from '@crowsi/interaction-transport/client'
import { validateOutcome } from '@zixcel/interaction'
import type { InvokeRequest, Outcome } from '@zixcel/interaction'
import { snapshotKey, validateSnapshot } from '../../shared/interaction'
import { installedRegistry } from '../../shared/installed'
import type { ViewSnapshot } from '../../shared/interaction'
import InteractionView from './InteractionView.vue'

const props = defineProps<{ scope: string; view: string; endpoint: string }>()
const registry = installedRegistry()
const transport = createHttpTransport({ endpoint: props.endpoint })
const requestFetch = useRequestFetch()
const feedback = ref<Outcome<unknown> | null>(null)
const busy = ref(false)
const key = computed(() => snapshotKey(props.scope, '', props.view))
const unavailable = (reason: string): Outcome<ViewSnapshot> => ({status:'Unavailable',reason,issues:[]})
function transportFailure(error: unknown) {
  const code = (error as {code?:unknown})?.code
  return unavailable(typeof code === 'string' && /^transport\/[a-z/]+$/u.test(code) ? code : 'transport/unavailable')
}
function checkedRead(raw: unknown, scope: string): Outcome<ViewSnapshot> {
  if (!validateOutcome(raw)) return unavailable('interaction/outcome/invalid')
  if (raw.status !== 'Success') return raw
  const issues = validateSnapshot(raw.value, scope, registry)
  return issues.length ? {status:'Unavailable',reason:'interaction/snapshot/invalid',issues:issues.map(reason => ({path:'',reason}))}
    : {status:'Success',value:raw.value as ViewSnapshot}
}
const { data, refresh } = await useAsyncData(key, async () => {
  const scope = props.scope, request = {method:'read',params:{view:props.view}}
  try {
    const result = typeof window === 'undefined'
      ? await requestFetch<unknown>(props.endpoint, {method:'POST',body:request})
      : await transport.request(request)
    return checkedRead(result, scope)
  } catch (error) { return transportFailure(error) }
}, {deep:false})
const snapshot = computed(() => data.value?.status === 'Success' ? data.value.value : undefined)
const readFailure = computed(() => data.value?.status !== 'Success' ? data.value : undefined)

let subscription: ReturnType<typeof transport.watch> | undefined
let operation: AbortController | undefined
let disposed = false, transition = Promise.resolve()
function reconcileSubscription() {
  transition = transition.then(async () => {
    await subscription?.stop(); subscription = undefined
    if (disposed || busy.value || document.hidden) return
    const scope = props.scope, view = props.view
    let reading = false
    subscription = transport.watch(() => {
      reading = !snapshot.value
      return reading ? {method:'read',params:{view}} : {method:'subscribe',params:{view,after:snapshot.value!.cursor}}
    }, async raw => {
      if (disposed || props.scope !== scope || props.view !== view) return
      if (reading) { data.value = checkedRead(raw, scope); return }
      if (!validateOutcome(raw)) { data.value = unavailable('interaction/outcome/invalid'); return }
      if (raw.status !== 'Success') { data.value = raw; return }
      const change = raw.value as {kind?:string;cursor?:string;after?:string}
      if ((change.kind !== 'changes' && change.kind !== 'reset') || typeof change.cursor !== 'string') {
        data.value = unavailable('interaction/change/invalid'); return
      }
      if (change.kind === 'reset' || change.cursor !== snapshot.value?.cursor) await refresh({dedupe:'defer'})
    }, failure => { if (!disposed && scope === props.scope && view === props.view) data.value = transportFailure(failure) },
    {active:() => !disposed && !document.hidden && !busy.value && scope === props.scope && view === props.view})
  }).catch(failure => { if (!disposed) data.value = transportFailure(failure) })
}
async function invoke(request: InvokeRequest) {
  if (busy.value || disposed) return
  busy.value = true
  await subscription?.stop(); subscription = undefined
  const current = new AbortController(), scope = props.scope, view = props.view
  operation = current
  try {
    const result = await transport.request({method:'invoke',params:request}, {signal:current.signal})
    if (disposed || scope !== props.scope || view !== props.view) return
    feedback.value = validateOutcome(result) ? result : unavailable('interaction/outcome/invalid')
    if (feedback.value.status === 'Success') await refresh({dedupe:'defer'})
  } catch (failure) {
    if (!disposed && scope === props.scope && view === props.view) feedback.value = transportFailure(failure)
  } finally { operation = undefined; busy.value = false; if (!disposed) reconcileSubscription() }
}
onMounted(() => { document.addEventListener('visibilitychange', reconcileSubscription); reconcileSubscription() })
watch(key, () => {
  operation?.abort(); feedback.value = null
  if (typeof document !== 'undefined') reconcileSubscription()
})
onScopeDispose(() => {
  disposed = true; operation?.abort()
  if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', reconcileSubscription)
  void subscription?.stop()
})
</script>

<template>
  <div v-if="readFailure" role="alert" :data-outcome="readFailure.status" class="interaction-read-failure">
    <UAlert color="error" :title="readFailure.status" :description="readFailure.reason" />
    <ul v-if="readFailure.issues.length"><li v-for="issue in readFailure.issues" :key="`${issue.path}:${issue.reason}`">{{ issue.path }} {{ issue.reason }}</li></ul>
  </div>
  <InteractionView v-else-if="snapshot" :snapshot="snapshot" :feedback="feedback" :busy="busy" @invoke="invoke" />
  <UProgress v-else aria-label="Loading" />
</template>
