import { default as cssModulePlugin } from 'esbuild-css-modules-plugin';

export default {
    plugins: [
        cssModulePlugin()
    ],
    color: true
}