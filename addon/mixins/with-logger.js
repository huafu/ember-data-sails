import Ember from 'ember';

export var LEVELS = 'debug info notice warn error'.split(' ');

var levelMap = {
  notice: 'log'
};
var methods = {};

LEVELS.forEach(function (level) {
  methods[level] = Ember.Logger[levelMap[level] || level].bind(Ember.Logger, '[ed-sails]');
});

/**
 * Mix logging methods in our class depending on the configured log level
 * @since 0.0.10
 * @class WithLoggerMixin
 * @extends Ember.Logger
 * @extensionFor Ember.Object
 */
export default Ember.Mixin.create(methods);
