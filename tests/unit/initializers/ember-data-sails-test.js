import Ember from 'ember';
import { module, test } from 'qunit';
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


test('it setups injections of the socket service', function (assert) {
  initialize(container, application);
  var cont = application.__container__;
  assert.deepEqual(cont.typeInjections.controller.pop(), {
    fullName: 'service:sails-socket',
    property: 'sailsSocket'
  }, 'the service should have injection setup on all controllers');
  assert.deepEqual(cont.typeInjections.adapter.pop(), {
    fullName: 'service:sails-socket',
    property: 'sailsSocket'
  }, 'the service should have injection setup on all adapters');
  assert.deepEqual(cont.typeInjections.route.pop(), {
    fullName: 'service:sails-socket',
    property: 'sailsSocket'
  }, 'the service should have injection setup on all routes');
});

