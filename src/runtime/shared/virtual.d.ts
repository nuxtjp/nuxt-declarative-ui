declare module '#build/interaction-capabilities.mjs' {
  export const capabilities: Record<string, {renderer: import('vue').Component; required: string[]; optional: string[]}>
}
