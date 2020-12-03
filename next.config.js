
const base_config = {
    generateBuildId: () => require('next-build-id')({
        dir: __dirname,
        describe: true
    }),
  webpack: (config, { isServer }) => {
    // Fixes npm packages that depend on `fs` module
    if (!isServer) {
      config.node = {
        fs: 'empty'
      }
    }

    return config
  }
};

module.exports = base_config //require('./linear2/features/mdx/next-plugin').plugin(base_config);