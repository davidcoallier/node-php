#!/usr/bin/env node

var path = require("path"),
    args = process.argv.slice(1)

var arg, base;
do arg = args.shift();
    while ( arg !== __filename && 
          (base = path.basename(arg)) !== "node-php" && 
           base !== "php" && 
           base !== "php.js"
)

require("./php").run(args)
