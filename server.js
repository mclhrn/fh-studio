/**
 * Module dependencies.
 */

var express     = require('express'),
    fhc         = require('fh-fhc'),
    util        = require('util'),
    fs          = require('fs'),
    dust        = require('./node_modules/express-dust/lib/dust'),
    controllers = require('./controllers');

var server = module.exports = express.createServer();

// Load FHC
fhc.fhc.load({}, function (err) {
    if (err) {
        throw new Error(err);
    }
    // Set cluster - //TODO: Targetting apps.feedhenry throws an error at the moment! odd!
    /*fhc.target(['https://apps.feedhenry.com'],
     function(err, data) {
     //success
     if (err){
     throw new Error(err);
     } 
     }
     );*/
});


// Configuration

server.configure(function () {

    server.set('views', __dirname + '/client/studio/views/dust');
    //server.set('view engine', 'dust');

    server.set('env',"local"); // Should this listen for --debug flag?

    server.use(express.bodyParser());
    server.use(express.cookieParser());
    
    server.use(express.methodOverride());
    
    var less = require('less');
    // Patch LESS require to allow relative and absolute both to work. Fix as per: https://github.com/senchalabs/connect/pull/174#issuecomment-1165151
    var origRender = less.render;
    less.render = function(str, options, fn) {
      if (typeof(options) === 'function') {
        fn = options;
        options = { paths: [__dirname + '/client/css'] };
      }
      return origRender.call(this, str, options, fn);
    };

    server.use(express.compiler({ src: __dirname + '/client', enable: ['less'] }));
    server.use(express.static(__dirname + '/client'));
});

server.configure('development', function () {
    server.use(express.errorHandler({ dumpExceptions:true, showStack:true }));
    server.use(express.session({ secret:"keyboard cat"}));
    server.use(server.router);
});

server.configure('local', function () { // For now a clone of development, but we do a server.get('env') in places
  server.use(express.errorHandler({ dumpExceptions:true, showStack:true }));
  server.use(express.session({ secret:"keyboard cat"}));
  server.use(server.router);
});


server.configure('production', function () {
    server.use(express.errorHandler());
    var RedisStore  = require('connect-redis')(express);
    server.use(express.session({ secret:"keyboard cat", store:new RedisStore }));
    server.use(server.router);
});


/*
 * FIXME: Ace editor is looking for worker-javascript.js in all the wrong places. Override it's core, so it knows where to find this file
 * rather than having to do this crazy route
 */
server.get('*/worker-javascript.js', function(req, res){
  var workerJS = fs.readFileSync('client/js/lib/ace/worker-javascript.js', 'utf8'); // TODO: Make async so we can err handle
  res.send(workerJS);
});


var checkAuth = controllers.userController.checkAuth; // auth checking function
//index

// Setup dust
var dustHelpers = require('./client/studio/views/helpers');
dust.makeBase(dustHelpers.helpers);
dust.setViewDir('client/studio/views/dust');


server.get("/", checkAuth, controllers.appController.indexAction);
server.get('/home.:resType?', checkAuth, controllers.appController.indexAction);
//user actions
server.get('/register.:resType?', controllers.userController.signupAction);
server.get('/login.:resType?', controllers.userController.loginAction);
server.post('/login',controllers.userController.loginAction);
server.get('/logout', controllers.userController.logoutAction);

/*
 * Apps Actions
 */
server.get('/apps.:resType?', checkAuth, controllers.appController.indexAction);

/*
 * App Actions
 */

// app:dashboard
server.get('/app/:id.:resType?', checkAuth, controllers.app.dashboardController.indexAction);
server.get('/app/:id/dashboard.:resType?', checkAuth, controllers.app.dashboardController.indexAction);

// app:debug, preview, build, prefs
server.get('/app/:id/debug.:resType?', checkAuth, controllers.app.debugController.indexAction);
server.get('/app/:id/preview.:resType?', checkAuth, controllers.app.previewController.indexAction);
server.get('/app/:id/build.:resType?', checkAuth, controllers.app.buildController.indexAction);
server.get('/app/:id/prefs.:resType?', checkAuth, controllers.app.prefsController.indexAction);

// app:editor
server.get('/app/:id/editor.:resType?', checkAuth, controllers.app.editorController.indexAction, controllers.app.editorController.blankEditor);
server.get('/app/:id/editor/:fileId.:resType?', checkAuth, controllers.app.editorController.indexAction, controllers.app.editorController.editorWithFile);
server.post('/app/:id/:operation/:resourceID?.:resType?', checkAuth, controllers.app.operationController.indexAction);
server.get("/editor/gist",controllers.app.editorController.gistAction);
server.get("/editor/gist/:gistid",controllers.app.editorController.gist);

server.listen(3000);

console.log("Express server listening on port %d in %s mode", 3000, server.settings.env);
