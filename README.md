# Lews
Little Lews compiles all your Less files and and keeps track of their @imports

##### Why you need it
You, Lenny, have these Less files with the following imports:
```
bundle.less
\_ fonts.less
|  \_ icons.less
|_ buttons.less
|  \_ helpers.less
|_ helpers.less
```

Say you edit `helpers.less`, Lews will compile `helpers.less`, `buttons.less` and `bundle.less`.
Should you edit `icons.less`, Lews will compile `icons.less`, `fonts.less` and `bundle.less`.

Pretty neat, right?

## Features
* Compiles all Less files that imports the changed Less file recursively
* Gulp-support
* Experimental socket-support - compiles filename sent through a socket. This is useful when working over NFS.

## Usage examples
Cli:
```
Usage: lews [options] sourcePath [destPath]
    --no-source-map: dont inline source maps
    --use-socket [socketPath]: listen on socket for files to compile
    --no-watch: don't watch for file changes
    --watch-interval interval: specify watch interval
    --help / --usage: this help message
```

Gulp:
```javascript
var gulp = require('gulp'),
    Lews = require('lews');

gulp.task('dev', function() {
    var lews = new Lews('css', 'public/css');
    gulp.watch(['css/**/*.less'], lews.gulpWatchCb.bind(lews));
});
```

With sockets and Vim: (useful then working over NFS)
```bash
lews --use-socket /srv/www/testsite/lews.sock --watch-interval 3000 /srv/www/testsite/css /srv/www/testsite/public/css
```
```vim
autocmd BufWritePost /srv/www/testsite/css/*.less silent !echo -ne '<afile>:p' | nc -U /srv/www/testsite/lews.sock
```
