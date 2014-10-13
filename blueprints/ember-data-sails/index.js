var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var SAILS_JS_DEP_PATH = path.resolve(
  path.join(
    __dirname, '..', '..',
    'node_modules', 'sails-generate-frontend',
    'templates', 'assets', 'js', 'dependencies', 'sails.io.js'
  )
);

module.exports = {
  description:         'Initializer and dependencies for ember-data-sails',
  normalizeEntityName: function () {
  },
  afterInstall:        function () {
    var vendorJs = path.join(process.cwd(), 'vendor', 'js');
    mkdirp.sync(vendorJs);
    fs.writeFileSync(path.join(vendorJs, 'sails.io.js'), fs.readFileSync(SAILS_JS_DEP_PATH));
    console.info('');
    console.info('don\'t forget to import `sails.io.js` if you are using sockets by adding this line to `Brocfile.js`:');
    console.info('');
    console.info('    app.import(\'vendor/js/sails.io.js\');');
    console.info('');
  }
};
