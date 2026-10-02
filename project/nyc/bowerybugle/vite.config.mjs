import base from '#root/ts/remix/vite.mjs';
export default env => ({...base(env), ssr: {noExternal: true}});
