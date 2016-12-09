#!/usr/bin/env node

var electron = require('electron'),
    proc = require('child_process');

var args = [`${__dirname}/index.js`];
if (process.argv.length > 2) args = args.concat(process.argv.slice(2));

var child = proc.spawn(electron, args, { stdio: 'inherit' });
child.on('close', function (code) {
    process.exit(code);
});
