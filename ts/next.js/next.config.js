


/**
 * @type {import('next').NextConfig}
 */
const baseConfig = {
    reactStrictMode: true,
    srcMinify: true,
    eslint: {
        ignoreDuringBuilds: true,
    },

    typescript: {
        tsconfigPath: '../../../tsconfig.json'
    },
    
    distDir: 'build',

    generateBuildId: async () => { /*REPLACE*/ throw new Error() /*REPLACE*/ }
}

// allow the monorepo's modules themselves to be transpiled.
module.exports = reqire('next-transpile-modules')(['monorepo']);