/// <reference types="nativewind/types" />

declare module '*.html' {
  const asset: number;
  export default asset;
}

declare module '*.json' {
  const value: unknown;
  export default value;
}
