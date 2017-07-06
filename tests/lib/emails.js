/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

define([
  'intern!tdd',
  'intern/chai!assert',
  'tests/addons/environment'
], function (tdd, assert, Environment) {

  var user2;
  var user2Email;

  with (tdd) {
    suite('emails', function () {
      var accountHelper;
      var respond;
      var mail;
      var client;
      var RequestMocks;
      var account;

      beforeEach(function () {
        var env = new Environment();
        accountHelper = env.accountHelper;
        respond = env.respond;
        mail = env.mail;
        client = env.client;
        RequestMocks = env.RequestMocks;

        user2 = 'anotherEmail' + new Date().getTime();
        user2Email = user2 + '@restmail.net';
      });

      function newVerifiedAccount(emailDomain) {
        return accountHelper.newVerifiedAccount(emailDomain)
          .then(function (res) {
            account = res;
            // signin confirmation flow
            return respond(mail.wait(account.input.user, 2), RequestMocks.mailUnverifiedSignin);
          })
          .then(function (emails) {
            var code = emails[1].html.match(/code=([A-Za-z0-9]+)/)[1];

            return respond(client.verifyCode(account.signIn.uid, code), RequestMocks.verifyCode);
          });
      }

      function recoveryEmailCreate() {
        return newVerifiedAccount()
          .then(
            function () {
              return respond(client.recoveryEmailCreate(
                account.signIn.sessionToken,
                user2Email
              ), RequestMocks.recoveryEmailCreate);
            },
            handleError
          );
      }

      function handleError(err) {
        console.log(err);
        assert.notOk();
      }

      test('#recoveryEmailSecondaryEmailEnabled enabled for valid email and verified session', function () {
        return newVerifiedAccount()
          .then(
            function () {
              return respond(client.recoveryEmailSecondaryEmailEnabled(
                account.signIn.sessionToken
              ), RequestMocks.recoveryEmailSecondaryEmailEnabledTrue);
            },
            handleError
          )
          .then(
            function (res) {
              assert.ok(res);
              assert.equal(res.ok, true, 'secondary emails enabled for verified session and valid email');
            },
            handleError
          );
      });

      test('#recoveryEmailSecondaryEmailEnabled disabled for valid email and unverified session', function () {
        // accountHelper.newVerifiedAccount helper creates account with unverified session
        return accountHelper.newVerifiedAccount()
          .then(
            function (res) {
              return respond(client.recoveryEmailSecondaryEmailEnabled(
                res.signIn.sessionToken
              ), RequestMocks.recoveryEmailSecondaryEmailEnabledFalse);
            },
            handleError
          )
          .then(
            function (res) {
              assert.ok(res);
              assert.equal(res.ok, false, 'secondary emails disabled for unverified session and valid email');
            },
            handleError
          );
      });

      test('#recoveryEmailSecondaryEmailEnabled disabled for invalid email', function () {
        return newVerifiedAccount('@featurenotenabledforthisdomain.com')
          .then(
            function () {
              return respond(client.recoveryEmailSecondaryEmailEnabled(
                account.signIn.sessionToken
              ), RequestMocks.recoveryEmailSecondaryEmailEnabledFalse);
            },
            handleError
          )
          .then(
            function (res) {
              assert.ok(res);
              assert.equal(res.ok, false, 'secondary emails disabled for invalid email');
            },
            handleError
          );
      });

      test('#recoveryEmailCreate', function () {
        return recoveryEmailCreate()
          .then(
            function (res) {
              assert.ok(res);
            },
            handleError
          );
      });

      test('#recoveryEmails', function () {
        return recoveryEmailCreate()
          .then(
            function (res) {
              assert.ok(res);
              return respond(client.recoveryEmails(
                account.signIn.sessionToken
              ), RequestMocks.recoveryEmailsUnverified);
            },
            handleError
          )
          .then(
            function (res) {
              assert.ok(res);
              assert.equal(res.length, 2, 'returned two emails');
              assert.equal(res[1].verified, false, 'returned not verified');
            },
            handleError
          );
      });

      test('#verifyCode', function () {
        return recoveryEmailCreate()
          .then(
            function (res) {
              assert.ok(res);

              return respond(mail.wait(user2, 1), RequestMocks.mailUnverifiedEmail);
            },
            handleError
          )
          .then(function (emails) {
            var code = emails[0].html.match(/code=([A-Za-z0-9]+)/)[1];

            return respond(client.verifyCode(account.signIn.uid, code, {type: 'secondary'}), RequestMocks.verifyCode);
          })
          .then(
            function (res) {
              assert.ok(res);

              return respond(client.recoveryEmails(
                account.signIn.sessionToken
              ), RequestMocks.recoveryEmailsVerified);
            },
            handleError
          )
          .then(
            function (res) {
              assert.ok(res);
              assert.equal(res.length, 2, 'returned one email');
              assert.equal(res[1].verified, true, 'returned not verified');
            },
            handleError
          );
      });

      test('#recoveryEmailDestroy', function () {
        return recoveryEmailCreate()
          .then(
            function (res) {
              assert.ok(res);

              return respond(client.recoveryEmails(
                account.signIn.sessionToken
              ), RequestMocks.recoveryEmailsUnverified);
            },
            handleError
          )
          .then(
            function (res) {
              assert.ok(res);
              assert.equal(res.length, 2, 'returned two email');
              assert.equal(res[1].verified, false, 'returned not verified');

              return respond(client.recoveryEmailDestroy(
                account.signIn.sessionToken,
                user2Email
              ), RequestMocks.recoveryEmailDestroy);
            },
            handleError
          )
          .then(
            function (res) {
              assert.ok(res);

              return respond(client.recoveryEmails(
                account.signIn.sessionToken
              ), RequestMocks.recoveryEmails);
            },
            handleError
          )
          .then(
            function (res) {
              assert.ok(res);
              assert.equal(res.length, 1, 'returned one email');
            },
            handleError
          );
      });
    });
  }
});

