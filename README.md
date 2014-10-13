ember-data-sails
================

Adapters and tools for Ember to work well with Sails.

## Installation

* `npm install --save-dev ember-sails-adapter`
* If you plan on using sockets:
  * `ember generate ember-data-sails`
  * add `app.import('vendor/js/sails.io.js');` to your `Brocfile.js`

## Using

* The `SailsSocketService` is injected on all `adapters`, `controllers` and `routes` on the `sailsSocket` property
* To use the `SailsSocketAdapter` as the default adapter, or as a model specific adapter, extend it from `SailsSocketAdapter`:
    ```js
    import SailsSocketAdapter from 'ember-data-sails/adapters/sails-socket';
    
    export default SailsSocketAdapter.extend({
      /**
       * The namespace of your API
       */
      namespace:            'api/v1',
      /**
       * Whether to use CSRF tokens or not
       */
      useCSRF:              true,
      /**
       * Whether to group multiple find by ID with one request with a `where`
       */
      coalesceFindRequests: true
    });
    ```
    **You must set `sails.config.blueprints.pluralize`to `true` in your Sails API  to make the adapter works**
