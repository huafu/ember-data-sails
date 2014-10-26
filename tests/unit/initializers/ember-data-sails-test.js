import Ember from 'ember';
import { initialize } from 'ember-data-sails/initializers/ember-data-sails';

var container, application;

module('EmberDataSailsInitializer', {
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
  deepEqual(cont.typeInjections.get('controller').pop(), {
    fullName: 'service:sails-socket',
    property: 'sailsSocket'
  }, 'the service should have injection setup on all controllers');
  deepEqual(cont.typeInjections.get('adapter').pop(), {
    fullName: 'service:sails-socket',
    property: 'sailsSocket'
  }, 'the service should have injection setup on all adapters');
  deepEqual(cont.typeInjections.get('route').pop(), {
    fullName: 'service:sails-socket',
    property: 'sailsSocket'
  }, 'the service should have injection setup on all routes');
});

