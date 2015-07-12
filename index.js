/* jshint node: true */
'use strict';

module.exports = {
  name: 'ember-data-sails',

  contentFor: function(what, config) {
    var options;

    if (config.APP && config.APP.emberDataSails) {
      options = config.APP.emberDataSails;

    } else {
      options = {};

      // if no scriptPath or sailsHost is defined, default to...
      if(!options.scriptPath && !options.sailsHost) {
        options.scriptPath = "//localhost:1337/js/dependencies/sails.io.js";
      }
    }

    if (what === 'body') {

      // If scriptPath is specified, assume that the user wants to load sails.io.js from an external host.
      if (options.scriptPath) {

        return '<script type="text/javascript" id="eds-sails-io-script" src="' + options.scriptPath + '"></script>' +
          '<script type="text/javascript">io.sails.autoConnect = false; io.sails.emberDataSailsReady = true;</script>';
      }
    }

    if (what === 'body-footer') {

      // If host is not specified, assume that user wants ember-cli to package it up as part of the asset pipeline.
      // Note that sails.io.js must be installed either manually or `bower install sails.io.js` for this to work.

      if(!options.scriptPath && options.sailsHost) {
        return '<script type="text/javascript">io.sails.url = "' + options.sailsHost + '";io.sails.autoConnect = false; io.sails.emberDataSailsReady = true;</script>';
      }
    }
  }
};
