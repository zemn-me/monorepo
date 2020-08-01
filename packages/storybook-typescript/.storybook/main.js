module.exports = {
  stories: ['../../**/*.stories.tsx'],
  addons: [
    "@storybook/addon-actions",
    "@storybook/addon-links",
    // or this
    /* require.resolve("@storybook/preset-create-react-app"),
     {
       // fuck if i know why i need to do this
       name: require.resolve('@storybook/preset-typescript'),
       options: {
         tsLoaderOptions: {
           configFile: path.resolve(__dirname, '../tsconfig.json'),
         },
         //include: [path.resolve(__dirname, '../src')],
         //transpileManager: true,
       },
     },*/
    {
      name: "@storybook/addon-docs",
      options: {
        configureJSX: true,
      },
    },

  ]
};

