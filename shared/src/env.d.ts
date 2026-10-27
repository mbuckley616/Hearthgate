// The shared code runs in the browser and in Node and may use neither's own APIs (CLAUDE.md
// rule 2), so it is typed against the ES library alone. structuredClone is in both runtimes.
declare function structuredClone<T>(value: T): T;
