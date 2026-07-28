/**
 * Node 24 executes the workspace's TypeScript source directly, while NodeNext
 * type resolution requires emitted-style `.js` specifiers. This runtime bridge
 * keeps both contracts without a generated dist directory.
 */
export * from "./artwork.ts";
