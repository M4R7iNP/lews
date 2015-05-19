# Lews
Little Lews compiles all your Less files and and keeps track of their @imports

## Features
* Compiles all Less files that imports the changed Less file
* Gulp-support
* Experimental

## Usage examples
Cli:
```
Usage: lews [options] sourcePath [destPath]
    --no-source-map: dont inline source maps
    --use-socket [socketPath]: listen on socket for files to compile
    --no-watch: don't watch for file changes (use this if filesystem is over NFS)
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

With Vim: (useful then working over NFS)
```bash
lews --use-socket /srv/www/testsite/lews.sock --no-watch /srv/www/testsite/css /srv/www/testsite/public/css
```
```vim
autocmd BufWritePost /srv/www/testsite/css/*.less silent !echo -ne '<afile>:p' | nc -U /srv/www/testsite/lews.sock
```
