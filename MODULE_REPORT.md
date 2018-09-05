## Module Report
### Unknown Global

**Global**: `Ember.Logger`

**Location**: `addon/mixins/with-logger.js` at line 13

```js

LEVELS.forEach(function (level) {
	methods[level] = bind(Ember.Logger, levelMap[level] || level, '[ed-sails]');
});

```
