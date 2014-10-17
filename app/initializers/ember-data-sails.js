import WithLoggerMixin from 'ember-data-sails/mixins/with-logger';
import {LEVELS} from 'ember-data-sails/mixins/with-logger';

export default {
  name: 'ember-data-sails',
  before: 'sails-socket-service',

  initialize: function(container, application) {
    var methods = {};
    var minLevel = application.SAILS_LOG_LEVEL;
    var shouldLog = false;
    LEVELS.forEach(function(level){
      if(level === minLevel){
        shouldLog = true;
      }
      if(!shouldLog){
        methods[level] = Ember.K;
      }
    });
    WithLoggerMixin.reopen(methods);
  }
}
