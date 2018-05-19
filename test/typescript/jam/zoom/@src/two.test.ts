#!/usr/bin/env node
'use strict';

import suman, {ItFn} from 'suman';
const Test = suman.init(module);

////////////////////////////////////////////

Test.create(function (it: ItFn) {

  5..times(function () {

    it('details', t => {

    });

  });

});