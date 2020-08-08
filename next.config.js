const withMDX = require('next-mdx-enhanced');


const domain = new URL(process.env.NODE_ENV == "production"?
    "https://zemn.me": "http://localhost:3000");

module.exports = withMDX({
    remarkPlugins: [
        require('remark-validate-links'),
        require('remark-sub-super'),
        [require('remark-textr'), { plugins: [
            require('typographic-base')
        ] }]
    ]
})({
    generateBuildId: () => require('next-build-id')({
        dir: __dirname,
        describe: true
    }),
    env: {
        origin: domain.origin,
        protocol: domain.protocol
    }
})