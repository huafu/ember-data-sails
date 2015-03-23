# ember-data-sails

Adapters and tools for Ember to work well with Sails. Provides `SailsSocketService`, `SailsRESTAdapter`, `SailsSocketAdapter`, `SailsSerializer` and extends the store so that you can subscribe for records while pushing a payload.

**Note**: If you want to use this adapter with a version of SailsJS `< 0.11.0` you have to use version [`0.0.12`](https://github.com/huafu/ember-data-sails/tree/v0.0.12) of this addon.

* `SailsSocketService`: injected in `adapters`, `controllers` and `routes` on `sailsSocket` property, it allow you to do Ember friendly requests using Sails socket. Example:

    ```js
    // in app/controllers/application.js
    this.sailsSocket.request('get', '/someController/someAction', {name: 'Huafu'}})
      .then(function(response) {
        // do something with the response
      });
    ```
    
    It'll use by default the `sails.io.js` located at `<hostname>:1337/js/dependencies/sails.io.js`, but you can change this using configuration in `config/environment.js` file:
    
    ```js
    ENV.APP = {
      // if you want some useful debug information related to sails
      SAILS_LOG_LEVEL: 'debug',
      emberDataSails:  {
        // default is to use same host and port as the ember app:
        host: '//localhost:1337',
        // this is the default and is the path to the sails io script:
        //scriptPath: '/js/dependencies/sails.io.js'
      }
    }
    ```
    
    Also don't forget to add the rules for CSP:
    
    ```js
    // allow to fetch the script
    ENV.contentSecurityPolicy['script-src'] += ' http://localhost:1337';
    // allow the websocket to connect
    ENV.contentSecurityPolicy['connect-src'] += ' http://localhost:1337 ws://localhost:1337';
    ```
    
    
* `DS.SailsSocketAdapter`: use this adapter when you want to use sockets for your model(s)
* `DS.SailsRESTAdapter`: use this adapter when you want to use sockets for your model(s)
* `DS.SailsSerializer`: used by default when you use a Sails adapter, you shouldn't need to access it but it's there in case
* `DS.Store.pushPayload([type], payload, [subscribe=false])`: as the original one from Ember Data, except it accepts an additional parameter which, when set to `true`, will tell the socket adapter to subscribe to the pushed records (see below)
* `DS.Store.subscribe(type, ids)`: tells the sails socket adapter to subscribe to those models (see below) 


## Installation

* `npm install --save-dev ember-data-sails`

## Using

**You must set `sails.config.blueprints.pluralize` to `true` in your Sails API  to make the adapters works**
* The `SailsSocketService` is injected on all `adapters`, `controllers` and `routes` on the `sailsSocket` property
* To use the `SailsSocketAdapter` as the default adapter, or as a model specific adapter, extend it from `SailsSocketAdapter`:
    ```js
    // file: app/adapters/application.js
    import SailsSocketAdapter from 'ember-data-sails/adapters/sails-socket';
    
    export default SailsSocketAdapter.extend({
      /**
       * Whether to use CSRF tokens or not
       */
      useCSRF:              true,
      /**
       * Whether to group multiple find by ID with one request with a `where`
       */
      coalesceFindRequests: true,
      /**
       * The namespace of your API
       */
      namespace:            'api/v1',
      /**
       * If you want to use https://github.com/mphasize/sails-generate-ember-blueprints,
       * you need to override the default serializer to be used
       */
      defaultSerializer: 'rest',
    });
    ```
* To use the `SailsRESTAdapter` as the default adapter, or as a model specific adapter, extend it from `SailsRESTAdapter`:
    ```js
    // file: app/adapters/application.js
    import SailsRESTAdapter from 'ember-data-sails/adapters/sails-rest';
    
    export default SailsRESTAdapter.extend({
      /**
       * The host of your API
       */
      host:                 'localhost:1337',
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

* Write more and fix unit tests!!!
* Auto re-subscribe to subscribed records/models after a connection reset (it's already automatically re-listening for the events on the socket, but if Sails application have rebooted, we need to re-subscribe on the server somehow with the client socket)


## Authors

_While this was first inspired from [ember-data-sails-adapter](https://github.com/bmac/ember-data-sails-adapter), it has now been fully re-written, with a totally different approach, and, as of the day this was written, with more features._

* <img src="https://s.gravatar.com/avatar/950590a0d4bc96f4a239cac955112eeb?s=24" valign="absmiddle"> [Huafu Gandon](http://huafu.github.com)
