'use strict';

var _suman = require('suman');

var _suman2 = _interopRequireDefault(_suman);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var Test = _suman2.default.init(module);

Test.create('first', function (it) {

  it('is passing', _suman2.default.autoPass);
});

/// zoom //
