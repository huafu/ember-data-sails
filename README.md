ember-data-sails
================

Adapters and tools for Ember to work well with Sails.

## Installation

* `npm install --save-dev ember-sails-adapter`
* If you plan on using sockets:
  * `ember generate ember-data-sails`
  * add `app.import('vendor/js/sails.io.js');` to your `Brocfile.js`

## Using

**You must set `sails.config.blueprints.pluralize` to `true` in your Sails API  to make the adapters works**

* The `SailsSocketService` is injected on all `adapters`, `controllers` and `routes` on the `sailsSocket` property
* To use the `SailsSocketAdapter` as the default adapter, or as a model specific adapter, extend it from `SailsSocketAdapter`:
    ```js
    // file: app/adapters/application.js
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
* To use the `SailsRESTAdapter` as the default adapter, or as a model specific adapter, extend it from `SailsRESTAdapter`:
    ```js
    // file: app/adapters/application.js
    import SailsRESTAdapter from 'ember-data-sails/adapters/sails-rest';
    
    export default SailsRESTAdapter.extend({
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

* **NEW** - Since `0.0.11` you can ask the API to subscribe to some models, useful when you want for example to
preload some data at the application start from some serialized JSON in a `<meta>` tag.
While it's easy to push data into the store with `store.pushPayload`, then the records are not
subscribed until you save them or get them again from Sails using the socket adapter.
**To push a payload and automatically subscribe to the pushed records, you can give an additional
parameter to `pushPayload` method of the store which if `true` will automatically subscribe the models
and records it can.** This will use `subscribeMethod`, and `subscribePath`
properties of the adapter to do a request on the API.
    * `subscribeMethod`: `get`, `post`, ... defaults to `post`
    * `subscribeEndpoint`: the endpoint to do the request on, defaults to `/socket/subscribe`
    * Of course you'll need to create a basic controller in your Sails API. Here is an example:
    
        ```js
        // api/controllers/SocketController.js
        module.exports = {
          subscribe: function (req, res, next) {
            var ids, data = req.allParams(), model, subscribed = {};
            for (var name in data) {
              if (data.hasOwnProperty(name)) {
                model = sails.models[name];
                if (model) {
                  ids = data[name];
                  model.subscribe(req, ids);
                }
                else {
                  sails.logger.warn('trying to subscribe to unknown model: ' + name);
                }
              }
            }
            res.json({});
          }
        };


## TODO

* Write unit tests!!!
* Auto re-subscribe to subscribed records/models after a connection reset (it's already automatically re-listening for the events on the socket, but if Sails application have rebooted, we need to re-subscribe on the server somehow with the client socket)


## Authors

_While this was first inspired from [ember-data-sails-adapter](https://github.com/bmac/ember-data-sails-adapter), it has now been fully re-written, with a totally different approach, and, as of the day this was written, with more features._

* ![Huafu Gandon](https://s.gravatar.com/avatar/950590a0d4bc96f4a239cac955112eeb?s=24) [Huafu Gandon](https://github.com/huafu)
