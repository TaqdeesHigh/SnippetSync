//@ts-check

'use strict';

const path = require('path');
const webpack = require('webpack');

/**@type {import('webpack').Configuration}*/
const config = {
  target: 'node',
  mode: 'none', // this leaves the source code as close as possible to the original (when packaging set this to 'production')

  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../[resource-path]'
  },
  devtool: 'source-map',
  externals: {
    vscode: 'commonjs vscode',
    'sqlite3': 'commonjs sqlite3',
    'axios': 'commonjs axios'
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      }
    ]
  },
  plugins: [
    new webpack.IgnorePlugin({
      resourceRegExp: /test\/fixtures/,
      contextRegExp: /node-gyp/
    })
  ],
  node: {
    __dirname: false
  }
};

module.exports = config;