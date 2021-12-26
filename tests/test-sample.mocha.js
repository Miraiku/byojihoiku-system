var assert = require('assert');
var myModule = require('./test-module');

describe('myModule', function () {
    describe('greet', function () {
        it('引数に応じて決まった文字列を返すこと', function () {
            assert.equal(myModule.greet('taro'), 'Hello,taro');
        });
    });
});