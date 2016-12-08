#!/usr/bin/env node

var electron = require('electron');
var proc = require('child_process');

var child = proc.spawn(electron, process.argv.slice(2), { stdio: 'inherit' });
child.on('close', function (code) {
    process.exit(code);
});
