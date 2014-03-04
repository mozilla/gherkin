/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

define([
  'tests/addons/sinon',
  'components/p/p'
], function (Sinon, P) {

  return {
    makeMockResponder: function (requests) {
      var self = this;
      var requestIndex = 0;

      return function (returnValue, response) {
        P.nextTick(function() {
          // this has to be here to work in IE
          setTimeout(function () {
            self.respond(requests[requestIndex++], response);
          }, 0);
        });

        return returnValue;
      }
    },
    respond: function (req, mock) {
      if (typeof mock === 'undefined') {
        console.log('Mock does not exist!');
      }
      if (req) {
        req.respond(mock.status, mock.headers, mock.body);
      }
    }
  }
});
