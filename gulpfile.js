var gulp = require("gulp");
var shell = require('gulp-shell');

// Run the default task initially and start the live reload server
gulp.task('dev', ['default'], liveReloadServer);

// reloader just pings the liveReload server and depends on the cordova prepare call
//gulp.task('prepareAndReload', ['prepare'], reloader);
gulp.task('prepareAndReload', ['prepare']);

// runs 'cordova prepare' after rebuilding the whole 'www/' folder

gulp.task('prepare', ['default'], cordovaPrepare);

gulp.task('default', []);

//var liveReload = require('gulp-livereload');

function liveReloadServer() {
  //liveReload.listen();

  gulp.watch('www/static/**', ['prepareAndReload']);
  gulp.watch('www/index.html', ['prepareAndReload']);
  gulp.watch('www/js/**', ['prepareAndReload']);
  gulp.watch('www/lib/**', ['prepareAndReload']);
  gulp.watch('www/css/**/*.css', ['prepareAndReload']);
  gulp.watch('www/img/**/*', ['prepareAndReload']);

}

function cordovaPrepare() {
  return gulp.src('')
    .pipe(shell(['cordova prepare']));
}

//function reloader() {
//  return gulp.src('')
//    .pipe(liveReload());
//}