/* jshint node: true */

module.exports = function (environment) {
  var ENV = {
    modulePrefix: 'dummy',
    environment:  environment,
    rootURL:      '/',
    locationType: 'auto',
    EmberENV:     {
      FEATURES:          {
        // Here you can enable experimental features on an ember canary build
        // e.g. 'with-controller': true
      },
      EXTEND_PROTOTYPES: {
      	Date: false
      }
    },

    contentSecurityPolicy: {
      'script-src':  "'self' 'unsafe-eval' 'unsafe-inline' http://localhost:1337 ws://localhost:1337",
      'connect-src': "'self' http://localhost:1337 ws://localhost:1337"
    },

    APP: {
      // Here you can pass flags/options to your application instance
      // when it is created
      SAILS_LOG_LEVEL: 'debug',
      emberDataSails:  {
        host: '//localhost:1337'/*,
         scriptPath: '/js/dependencies/sails.io.js'*/
      }
    }
  };

  if (environment === 'development') {
    // ENV.APP.LOG_RESOLVER = true;
    // ENV.APP.LOG_ACTIVE_GENERATION = true;
    // ENV.APP.LOG_TRANSITIONS = true;
    // ENV.APP.LOG_TRANSITIONS_INTERNAL = true;
    // ENV.APP.LOG_VIEW_LOOKUPS = true;
  }

  if (environment === 'test') {
    // Testem prefers this...
    ENV.locationType = 'none';

    // keep test console output quieter
    ENV.APP.LOG_ACTIVE_GENERATION = false;
    ENV.APP.LOG_VIEW_LOOKUPS = false;

    ENV.APP.rootElement = '#ember-testing';
  }

  if (environment === 'production') {

  }

  return ENV;
};
