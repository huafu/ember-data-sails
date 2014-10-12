/*global io*/
import Ember from 'ember';
import { initialize } from 'ember-data-sails/initializers/sails-socket';

var container, application;

module('SailsSocketInitializer', {
  setup:    function () {
    window.io = {
      socket: {
        socket: {
          open: false
        }
      }
    };
    Ember.run(function () {
      container = new Ember.Container();
      application = Ember.Application.create();
      application.deferReadiness();
    });
  },
  teardown: function () {
    delete window.io;
  }
});

// Replace this with your real tests.
asyncTest('it waits for the socket to be open', function () {
  expect(3);
  application.deferReadiness = function () {
    ok(true, 'deferReadiness should have been called');
    setTimeout(function () {
      io.socket.socket.open = true;
    }, 100);
  };
  application.advanceReadiness = function () {
    start();
    ok(true, 'advanceReadiness should have been called');
    ok(io.socket.socket.open, 'advanceReadiness should have been called when the socket is open');
  };
  initialize(container, application);
});

