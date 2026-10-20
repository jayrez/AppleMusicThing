// Merged into the DeskThing CLI's server build.
// bufferutil / utf-8-validate are optional native speedups for `ws`; leave them out.
export default {
  external: ['bufferutil', 'utf-8-validate']
}
