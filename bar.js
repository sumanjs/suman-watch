
const util = require('util');

let obj1 = {

  rolo: 'bar',

};



let obj2 = Object.assign({}, obj1, {
  rolo: ''
});

console.log(util.inspect(obj2));