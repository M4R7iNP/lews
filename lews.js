/*
 * Lews
 *
 * Compile changed less file and
 * all the files that imports it.
 * Inspired by Autoless.
 *
 * Author: Martin Pedersen
 */

var glob = require('glob'),
    async = require('async'),
    fs = require('fs'),
    path = require('path'),
    colors = require('colors'),
    less = require('less');

var Lews = function(srcPath, destPath, options) {
    if (!options)
        options = {};

    this.srcPath = path.resolve(srcPath);
    this.destPath = path.resolve(destPath);
    this.debug = !!options.debug;
    this.watchInterval = options.watchInterval || 1000;

    this.options = options || {
        aetherDebugBarError: true
    };

    this.importMap = {};
    this.lastModified = {};

    var self = this;

    console.log('Lews: Building initial import map');

    // Create initial import map
    glob(
        this.srcPath + '/**/*.less',
        {
            nodir: false
        },
        function(err, files) {
            if (err)
                console.error(err);

            async.eachLimit(
                files,
                4,
                self.findImports.bind(self),
                function(err) {
                    if (err) {
                        console.error(err);
                        process.exit(1);
                    }

                    if (self.debug)
                        console.log(self.importMap);

                    console.log('Lews: Import map is built');
                }
            );
        }
    );
};

var importRegex = /@import[^'";]*['"]([^'";]+)['"];/;
var importRegexGlobal = new RegExp(importRegex.source, 'g');

// Maybe use less.parse here?
Lews.prototype.findImports = function(filename, cb) {
    var self = this;
    var relativeFilename = path.relative(self.srcPath, filename);
    fs.readFile(filename, {encoding: 'utf8'}, function(err, data) {
        if(err)
            return cb(err);

        var importMatch = data.match(importRegexGlobal);
        if(!importMatch)
            return cb();

        for(var i = 0; i < importMatch.length; i++) {
            var importFilename = importMatch[i].match(importRegex)[1];
            var importFilepath = path.relative(self.srcPath, path.resolve(path.dirname(filename), importFilename));
            self.importMap[importFilepath] = self.importMap[importFilepath] || [];
            self.importMap[importFilepath].push(relativeFilename);
        }

        cb();
    });
};

Lews.prototype.watch = function() {
    var self = this;
    /*
    require('watch').createMonitor(this.srcPath, {ignoreDotFiles: true}, function(monitor) {
        console.log('Monitoring files');
        monitor.on('changed', function(filename) {
            var relativeFilename = path.relative(self.srcPath, filename);
            console.log('File changed', relativeFilename);

            self.recompileFile(relativeFilename);
        });
    });
   */
    this.chokidarWatcher =
    require('chokidar')
    .watch(this.srcPath, {
        ignored: /[\/\\]\./,
        usePolling: true,
        interval: self.watchInterval || 1000,
        persistent: true
    })
    .on('ready', function() {
        console.log('Monitoring files');
    })
    .on('change', function(filename) {
        if (self.debug)
            console.log('Got chokidar change:', filename);

        var relativeFilename = path.relative(self.srcPath, filename);
        console.log('File changed', relativeFilename);
        if (self.lastModified[relativeFilename] &&
            Date.now() - self.lastModified[relativeFilename] < (self.watchInterval + 200))
                return console.log(('Not recompiling ' + relativeFilename).yellow);

        self.recompileFile(relativeFilename);
    });
};

Lews.prototype.recompileFile = function(relativeFilename, callback) {
    if (!callback)
        callback = function() { console.log('Done with', relativeFilename); };

    var self = this;

    var files = [];
    if(this.importMap[relativeFilename])
        files = files.concat(this.importMap[relativeFilename]);

    // Add files that imports added files recursively
    for (var i = 0; i < files.length; i++)
        if (this.importMap[files[i]])
            for (var j = 0, file = this.importMap[files[i]][j]; j < this.importMap[files[i]].length; file = this.importMap[files[i]][++j])
                if (file && files.indexOf(file) === -1)
                    files.push(file);

    // Add current file if its less
    if (relativeFilename.match(/\.less/))
        files.unshift(relativeFilename);

    if(!files.length)
        return callback();

    async.eachLimit(
        files,
        2,
        function(lessFilename, cb) {
            var inFile = path.join(self.srcPath, lessFilename),
                outFile = path.join(self.destPath, lessFilename.replace(/\.less$/, '.css'));

            if (self.debug)
                console.log('Began to recompile', inFile);

            fs.readFile(inFile, 'utf8', function(err, data) {
                if (err)
                    return cb(err);

                var inFileDir = path.dirname(inFile);

                var lessOptions = {
                    compress: true,
                    rootFileInfo: {
                        filename: path.basename(inFile),
                        rootpath: self.srcPath,
                        currentDirectory: inFileDir,
                        entryPath: inFileDir,
                        rootFilename: path.basename(relativeFilename),
                    },
                    paths: [path.dirname(inFile)],
                    plugins: self.options.lessPlugins,
                    sourceMap: {
                        sourceMapFileInline: !self.options.noSourceMap
                    }
                };

                less.render(data, lessOptions, function(err, result) {
                    console.log((lessFilename)[err ? 'red' : 'green']);
                    if (err) {
                        console.error('Error'.red, err.filename + ':', err.message);
                        if (self.options.aetherDebugBarError) {
                            self.lastModified[lessFilename] = Date.now();
                            fs.writeFile(outFile, generateAetherDebugBarError(err), cb);
                        }
                        else
                            cb(err);
                        return;
                    }

                    // Update imports
                    result.imports.forEach(function(importFilename) {
                        var relativeImportFilename =
                            path.relative(
                                self.srcPath,
                                path.resolve(path.dirname(inFile), importFilename)
                            );

                        if (!self.importMap[relativeImportFilename])
                            self.importMap[relativeImportFilename] = [lessFilename];
                        else if(self.importMap[relativeImportFilename].indexOf(lessFilename) === -1)
                            self.importMap[relativeImportFilename].push(lessFilename);
                    });

                    fs.writeFile(outFile, result.css, function(err) {
                        self.lastModified[lessFilename] = Date.now();
                        if (err && err.code == 'ENOENT') // Directory does not exist
                            require('mkdirp')(path.dirname(outFile),  fs.writeFile.bind(this, outFile, result.css, cb));
                        else
                            cb(err);
                    });
                });
            });
        },
        function(err) {
            if (err)
                console.error(err);

            callback();
        }
    );
};

Lews.prototype.gulpWatchCb = function(event) {
    if (event.type == 'deleted')
        return;

    var relativeFilename = path.relative(this.srcPath, event.path);
    console.log('File changed', relativeFilename);
    this.recompileFile(relativeFilename);
};

Lews.prototype.createSocket = function(socketPath) {
    if (!socketPath)
        socketPath = path.join(__dirname, 'lews.sock');

    var self = this;
    var net = require('net');
    var server = net.createServer(function(conn) {
        conn.setEncoding('utf8');
        var body = '';
        conn.on('data', function(data) {
            body += data;
        });
        conn.on('end', function() {
            console.log(body);
            var relativePath = path.relative(self.srcPath, body);
            if (relativePath.substr(0, 3) != '../')
                process.nextTick(self.recompileFile.bind(self, relativePath));
        });
    });

    server.listen(socketPath, function() {
        console.log('Listening on socket', socketPath);
    });

    var unlinkFn = fs.unlinkSync.bind(fs, socketPath);
    process
    .on('exit', unlinkFn)
    .on('SIGINT', process.exit);
};

function generateAetherDebugBarError(err) {
    return [
        '#aetherDebugBar { right: 0 !important; display: block !important; }',
        '#aetherDebugBar div:before { content: "Error in ' +
            path.basename(err.filename) + ':' + err.line +
            '"; display: "block"; background: red; }'
    ].join('\n');
}

module.exports = Lews;
