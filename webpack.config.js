// webpack.config.js
const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
  entry: "./src/main.tsx",

  // ⚡ Cache Busting Output Rules
  output: {
    path: path.resolve(__dirname, "dist"),
    // Using [contenthash] forces a brand new filename if your source files changed,
    // which completely bypasses standard browser caching mechanics.
    filename: "js/[name].[contenthash:8].js",
    chunkFilename: "js/[name].[contenthash:8].chunk.js",
    clean: true, // Auto-purges old bundle files out of your dist folder on every compilation
  },

  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
  },

  module: {
    rules: [
      // SWC Compiler Pipe
      {
        test: /\.(ts|tsx)$/,
        exclude: /node_modules/,
        use: {
          loader: "swc-loader",
          options: {
            jsc: {
              parser: {
                syntax: "typescript",
                tsx: true,
              },
              transform: {
                react: {
                  runtime: "automatic",
                },
              },
            },
          },
        },
      },
      // CSS & Tailwind PostCSS Pipe
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader", "postcss-loader"],
      },
    ],
  },

  plugins: [
    new HtmlWebpackPlugin({
      template: "./public/index.html",
      inject: "body",
    }),
  ],

  // 🛑 Strict No-Cache Development Server Configurations
  devServer: {
    static: {
      directory: path.join(__dirname, "public"),
    },
    compress: true,
    port: 3000,
    hot: true,
    open: true,
    historyApiFallback: true,
    // Inject custom dev server headers to tell the browser never to store resources locally
    headers: {
      "Cache-Control":
        "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
    client: {
      overlay: {
        errors: true,
        warnings: false,
      },
    },
  },
};
