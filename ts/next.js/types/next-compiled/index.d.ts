// Shim the pieces of Next's bundled dependencies that lack upstream typings.

declare namespace webpack {
  type LoaderDefinitionFunction<T = any> = (...args: any[]) => any;
  type RuleSetUseItem = any;
  interface Configuration {
    buildHttp?: unknown;
    experiments?: {
      buildHttp?: unknown;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  }
  interface Compiler {}
  interface Compilation {
    assets?: Record<string, unknown>;
    [key: string]: unknown;
  }
  interface EntryObject {}
  interface WebpackPluginInstance {}
  interface Module {}
  interface Stats {}
  type DefinePlugin = any;
  const DefinePlugin: DefinePlugin;
}

declare module "next/dist/compiled/webpack/webpack" {
  const webpackExport: typeof webpack;
  export { webpackExport as webpack };
  export default webpackExport;

  export type LoaderDefinitionFunction<T = any> = webpack.LoaderDefinitionFunction<T>;
  export type RuleSetUseItem = webpack.RuleSetUseItem;
  export type Configuration = webpack.Configuration;
  export type Compiler = webpack.Compiler;
  export type Compilation = webpack.Compilation;
  export type EntryObject = webpack.EntryObject;
  export type WebpackPluginInstance = webpack.WebpackPluginInstance;
  export type Module = webpack.Module;
  export type Stats = webpack.Stats;
  export const DefinePlugin: typeof webpack.DefinePlugin;
}

declare module "VAR_MODULE_GLOBAL_ERROR" {
  const value: unknown;
  export default value;
}

declare module "react-server-dom-webpack/server.edge" {
  export const renderToReadableStream: (...args: unknown[]) => unknown;
  export const decodeReply: (...args: unknown[]) => unknown;
  export const decodeAction: (...args: unknown[]) => unknown;
  export const decodeFormState: (...args: unknown[]) => unknown;
}

declare module "next/dist/compiled/superstruct" {
  export type Struct<T = unknown, _S = unknown> = unknown;
  export type Infer<T> = T extends Struct<infer V, any> ? V : unknown;
  export type Describe<T = unknown> = Struct<T>;
}

// Augment webpack config with Next-only knobs used in the repo.
declare module "webpack" {
  namespace webpack {
    interface Configuration {
      buildHttp?: unknown;
      experiments?: unknown;
      [key: string]: unknown;
    }
  }
}
