/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

define([
  'intern!tdd',
  'intern/chai!assert',
  'tests/addons/environment'
], function (tdd, assert, Environment) {

  const USER_SECONDARY_EMAIL = 'another@email.com';

  with (tdd) {
    suite('emails', function () {
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

      test('#createEmail, #getEmails and #deleteEmail', function () {
        var account;
        return accountHelper.newVerifiedAccount()
          .then(function (accountRes) {
            account = accountRes;
            return respond(client.createEmail(
              account.signIn.sessionToken,
              USER_SECONDARY_EMAIL
            ), RequestMocks.createEmail);
          })
          .then(
            function(res) {
              assert.ok(res);
              return respond(client.getEmails(
                account.signIn.sessionToken
              ), RequestMocks.getEmails);
            },
            function (err) {
              console.log(err);
              assert.notOk();
            }
          )
          .then(
            function(res) {
              assert.ok(res);
              assert.equal(res.length, 2, 'returned two emails');
              return respond(client.deleteEmail(
                account.signIn.sessionToken,
                USER_SECONDARY_EMAIL
              ), RequestMocks.deleteEmail);
            },
            function (err) {
              console.log(err);
              assert.notOk();
            }
          )
          .then(
            function(res) {
              assert.ok(res);
              return respond(client.getEmails(
                account.signIn.sessionToken
              ), RequestMocks.getEmailsOne);
            },
            function (err) {
              console.log(err);
              assert.notOk();
            }
          )
          .then(
            function(res) {
              assert.ok(res);
              assert.equal(res.length, 1, 'returned one email');
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

