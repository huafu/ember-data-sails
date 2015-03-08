/* jshint node: true */
'use strict';

module.exports = {
  name: 'ember-data-sails',

  contentFor: function (what, config) {
    var options;
    if (what === 'body') {
      if (config.APP && config.APP.emberDataSails) {
        options = config.APP.emberDataSails;
      }
      else {
        options = {};
      }
      if (!options.host) {
        options.host = '';
      }
      if (!options.scriptPath) {
        options.scriptPath = '/js/dependencies/sails.io.js';
      }
      return '<script type="text/javascript" id="eds-sails-io-script" src="' + options.host + options.scriptPath + '"></script>' +
        '<script type="text/javascript">io.sails.autoConnect = false; io.sails.emberDataSailsReady = true;</script>';
    }
  }
};
