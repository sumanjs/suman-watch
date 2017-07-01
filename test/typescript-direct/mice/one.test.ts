'use strict';

import suman, {ItFn} from 'suman';
const Test = suman.init(module);

///////////////////////

Test.create(function (it: ItFn) {

  (99 as Number).times(function () {

    it('details', t => {

    });

  });

});