/// <reference types="nativewind/types" />

// TypeScript 6 requires an explicit declaration for the app's global CSS
// side-effect import. Metro still owns loading the stylesheet at runtime.
declare module "*.css";
