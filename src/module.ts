import { addComponentsDir, addImports, addTemplate, createResolver, defineNuxtModule } from '@nuxt/kit'
import type { Nuxt, NuxtModule } from '@nuxt/schema'
import { isAbsolute } from 'node:path'

export interface InteractionCapability { kind: string; renderer: string; required: string[]; optional: string[] }
const capabilities = new WeakMap<Nuxt, Map<string, InteractionCapability>>()
/** Build-time extension only. Runtime declarations never contain module paths. */
export function registerInteractionCapability(nuxt: Nuxt, capability: InteractionCapability) {
  const entries = capabilities.get(nuxt) ?? new Map<string, InteractionCapability>()
  if (!/^[a-z][a-z_]{0,63}$/u.test(capability.kind) || !isAbsolute(capability.renderer)
    || entries.has(capability.kind) || entries.size >= 32) throw new Error('interaction/capability/invalid')
  entries.set(capability.kind, capability); capabilities.set(nuxt, entries)
}

export interface ModuleOptions { componentPrefix: string }

const declarativeUiModule: NuxtModule<ModuleOptions> = defineNuxtModule<ModuleOptions>({
  meta: { name: '@nuxtjp/declarative-ui', configKey: 'nuxtJpDeclarativeUi',
    compatibility: { nuxt: '^4.5.0' } },
  defaults: { componentPrefix: 'NuxtJp' },
  setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)
    nuxt.hook('modules:done', () => {
      const entries = [...(capabilities.get(nuxt)?.values() ?? [])].sort((a,b) => a.kind.localeCompare(b.kind))
      addTemplate({ filename: 'interaction-capabilities.mjs', getContents: () =>
        entries.map((entry,index) => `import renderer${index} from ${JSON.stringify(entry.renderer)}`).join('\n')
        + '\nexport const capabilities = {' + entries.map((entry,index) =>
          `${JSON.stringify(entry.kind)}: { renderer: renderer${index}, required: ${JSON.stringify(entry.required)}, optional: ${JSON.stringify(entry.optional)} }`).join(',') + '}\n',
      })
    })
    addComponentsDir({ path: resolver.resolve('./runtime/app/components'),
      prefix: options.componentPrefix, pathPrefix: false })
    addImports(['createRegistry', 'validateDeclaration', 'validateSnapshot'].map(name =>
      ({ name, from: resolver.resolve('./runtime/shared/interaction') })))
  }
})

export default declarativeUiModule
