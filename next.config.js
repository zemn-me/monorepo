
const base_config = {
    generateBuildId: () => require('next-build-id')({
        dir: __dirname,
        describe: true
    }),
};

module.exports = require('./linear2/features/mdx/next-plugin').plugin(base_config);