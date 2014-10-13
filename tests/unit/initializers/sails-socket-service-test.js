import Ember from 'ember';
import { initialize } from 'ember-data-sails/initializers/sails-socket-service';

var container, application;

module('SailsSocketServiceInitializer', {
  setup: function () {
    Ember.run(function () {
      container = new Ember.Container();
      application = Ember.Application.create();
      application.deferReadiness();
    });
  }
});


test('it setups injections of the socket service', function () {
  initialize(container, application);
  var cont = application.__container__;
  deepEqual(cont.injections['adapter:sails-socket'], [
    {
      fullName: 'service:sails-socket',
      property: 'sailsSocket'
    }
  ], 'the service should have injection setup on the adapter');
  deepEqual(cont.typeInjections.get('controller').pop(), {
    fullName: 'service:sails-socket',
    property: 'sailsSocket'
  }, 'the service should have injection setup on all controllers');
  deepEqual(cont.typeInjections.get('route').pop(), {
    fullName: 'service:sails-socket',
    property: 'sailsSocket'
  }, 'the service should have injection setup on all routes');
});

