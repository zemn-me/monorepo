const domain = new URL(process.env.NODE_ENV == "production"?
    "https://zemn.me": "http://localhost:3000");

const base_config = {
    generateBuildId: () => require('next-build-id')({
        dir: __dirname,
        describe: true
    }),
    env: {
        origin: domain.origin,
        protocol: domain.protocol
    }
};


let config = base_config;
config = require('next-mdx-enhanced')({
    remarkPlugins: [
        require('remark-validate-links'),
        require('remark-sub-super'),
        [require('remark-textr'), { plugins: [
            require('typographic-base')
        ] }]
    ]
})(config);

config = require('next-images')(config);
config = require('next-videos')(config);

module.exports = config;