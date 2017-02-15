#!/usr/bin/node
var Lews = require('./lews'),
    path = require('path'),
    fs = require('fs');

var lewsOptions = {
    aetherDebugBarError: true,
};
var programOptions = {
    srcPath: undefined,
    dstPath: undefined,

    useSocket: false,
    watch: true
};

for (var i = 2; i < process.argv.length; i++) {
    switch (process.argv[i].replace(/^--/, '')) {
    case 'no-source-map':
        lewsOptions.noSourceMap = true;
        break;
    case 'aether-debug-bar':
        lewsOptions.aetherDebugBarError = program.argv[++i] != 'false';
        break;
    case 'debug':
        lewsOptions.debug = true;
        break;
    case 'help':
    case 'usage':
        console.log([
            'Usage: node ' + process.argv[1] + ' [options] sourcePath [destPath]',
            '    --no-source-map: dont inline source maps',
            '    --use-socket [socketPath]: listen on socket for files to compile (see README)',
            '    --no-watch: don\'t watch for file changes',
            '    --watch-interval interval: specify watch interval',
            '    --help / --usage: this help message'
        ].join('\n\r'));
        process.exit(1);
        break;
    case 'no-watch':
        programOptions.noWatch = true;
        break;
    case 'use-socket':
        try {
            programOptions.useSocket = true;
            var socketPath = path.resolve(process.argv[++i]);
            programOptions.socketPath = socketPath;

            var socketPathStats = fs.statSync(socketPath);
            if (socketPathStats.isDirectory()) {
                programOptions.socketPath = path.join(socketPath, 'lews.sock');
            }
        } catch (err) {
        }
        break;
    case 'use-stdin':
        programOptions.useStdin = true;
        break;
    case 'only-bundles':
        lewsOptions.filenameFilter = /bundle\.less$/;
        break;
    case 'watch-interval':
        lewsOptions.watchInterval = parseInt(process.argv[++i]);
        break;
    default:
        if (!programOptions.srcPath) {
            programOptions.srcPath = path.resolve(process.argv[i]);
        }
        else if (!programOptions.dstPath) {
            programOptions.dstPath = path.resolve(process.argv[i]);
        }
    }
}


if (!programOptions.srcPath) {
    console.log('Missing source path. See --usage');
    process.exit(1);
}
if (!programOptions.dstPath)
    programOptions.dstPath = programOptions.srcPath;

var lews = new Lews(programOptions.srcPath, programOptions.dstPath, lewsOptions);
lews.buildImportMap(function() {
    if (!programOptions.noWatch)
        lews.watch();
    if (programOptions.useSocket)
        lews.createSocket(programOptions.socketPath);

    if (programOptions.useStdin) {
        var stdinText = '';
        process.stdin.setEncoding('utf-8');
        process.stdin.on('data', chunk => stdinText += chunk);
        process.stdin.on('end', function() {
            lews.recompileFiles(stdinText.split('\n'));
        });
    }
});
