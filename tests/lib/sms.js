/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

define([
  'intern!tdd',
  'intern/chai!assert',
  'tests/addons/environment',
  'tests/lib/push-constants'
], function (tdd, assert, Environment) {

  var PHONE_NUMBER = '14071234567';
  var INVITE_USER_MESSAGE_ID = '1';

  with (tdd) {
    suite('sms', function () {
      var accountHelper;
      var respond;
      var client;
      var RequestMocks;

      beforeEach(function () {
        var env = new Environment();
        accountHelper = env.accountHelper;
        respond = env.respond;
        client = env.client;
        RequestMocks = env.RequestMocks;
      });

      test('#send connect device', function () {

        return accountHelper.newVerifiedAccount()
          .then(function (account) {

            return respond(client.sendSms(
              account.signIn.sessionToken,
              PHONE_NUMBER,
              INVITE_USER_MESSAGE_ID
            ), RequestMocks.sendSmsConnectDevice);
          })
          .then(
            function(res) {
              // TODO Define the actual response
              assert.equal(res.phoneNumber, PHONE_NUMBER);
              assert.equal(res.messageId, INVITE_USER_MESSAGE_ID);
              assert.equal(res.sent, true);
            },
            function (err) {
              console.log(err);
              assert.notOk();
            }
          );
      });
    });
  }
});

