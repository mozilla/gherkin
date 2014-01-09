/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

define([
  'tests/intern',
  'intern!tdd',
  'intern/chai!assert',
  'client/FxAccountClient',
  'intern/node_modules/dojo/has!host-node?intern/node_modules/dojo/node!xmlhttprequest',
  'tests/addons/sinonResponder',
  'tests/mocks/request',
  'client/lib/request',
  'components/p/p'
], function (tdd, assert, FxAccountClient, XHR, SinonResponder, RequestMocks, Request, p) {

  with (tdd) {
    suite('fxa client', function () {
      // TODO read this from some platform independent config
      var baseUri = 'http://127.0.0.1:9000/v1';
      //var baseUri = 'https://api-accounts-latest.dev.lcip.org/v1';
      var useRemoteServer = false;
      var client;
      var restmailClient;
      var respond;

      function noop(val) { return val; }

      beforeEach(function () {
        var xhr;

        if (useRemoteServer) {
          xhr = XHR.XMLHttpRequest;
          respond = noop;
        } else {
          var requests = [];
          xhr = SinonResponder.useFakeXMLHttpRequest();
          xhr.onCreate = function (xhr) {
            requests.push(xhr);
          };
          respond = makeMockResponder(requests);
        }
        client = new FxAccountClient(baseUri, { xhr: xhr });
        restmailClient = new Request('http://restmail.net', xhr);
      });

      /**
       * Create Account
       */
      test('#create account', function () {
        var email = "test" + Date.now() + "@restmail.net";
        var password = "iliketurtles";

        return respond(client.signUp(email, password), RequestMocks.signUp)
          .then(function (res, b, c) {
            assert.ok(res.uid);
          });
      });

      /**
       * Sign In
       */
      test('#sign in', function () {
        var email = "test" + Date.now() + "@restmail.net";
        var password = "iliketurtles";

        return respond(client.signUp(email, password), RequestMocks.signUp)
          .then(function () {

            return respond(client.signIn(email, password), RequestMocks.signIn);
          })
          .then(function (res) {
            assert.ok(res.sessionToken);
          });
      });

      /**
       * Sign In with Keys
       */
      test('#sign in with keys', function () {
        var email = "test" + Date.now() + "@restmail.net";
        var password = "iliketurtles";
        var signUpRequest =  client.signUp(email, password)
          .then(function (res) {
            var signInRequest = client.signIn(email, password, {keys: true});

            setTimeout(function() {
              SinonResponder.respond(requests[1], RequestMocks.signInWithKeys);
            }, 200);

            return signInRequest;
          })
          .then(function (res) {
            assert.ok(res.sessionToken);
            assert.ok(res.keyFetchToken);
            assert.ok(res.unwrapBKey);
            return true;
          });

        setTimeout(function() {
          SinonResponder.respond(requests[0], RequestMocks.signUp);
        }, 200);

        return signUpRequest;
      });

      /**
       * Verify Email
       */
      test('#verify email', function () {
        var user = 'test3' + Date.now();
        var email = user + '@restmail.net';
        var password = 'iliketurtles';
        var uid;

        return respond(client.signUp(email, password), RequestMocks.signUp)
          .then(function (result) {
            uid = result.uid;
            assert.ok(uid, "uid is returned");

            return respond(waitForEmail(user), RequestMocks.mail);
          })
          .then(function (emails) {
            var code = emails[0].html.match(/code=([A-Za-z0-9]+)/)[1];
            assert.ok(code, "code is returned");

            return respond(client.verifyCode(uid, code), RequestMocks.verifyCode);
          })
      });

      /**
       * Check Verification Status
       */
      test('#check verification status', function () {
        var user = 'test4' + Date.now();
        var email = user + '@restmail.net';
        var password = 'iliketurtles';
        var uid;
        var sessionToken;

        return respond(client.signUp(email, password), RequestMocks.signUp)
          .then(function (result) {
            uid = result.uid;
            assert.ok(uid, "uid is returned");

            return respond(client.signIn(email, password), RequestMocks.signIn);
          })
          .then(function (result) {
            assert.ok(result.sessionToken, "sessionToken is returned");
            sessionToken = result.sessionToken;

            return respond(client.recoveryEmailStatus(sessionToken),
                    RequestMocks.recoveryEmailUnverified);
          })
          .then(function (result) {
            assert.equal(result.verified, false, "Email should not be verified.");

            return respond(waitForEmail(user), RequestMocks.mail);
          })
          .then(function (emails) {
            var code = emails[0].html.match(/code=([A-Za-z0-9]+)/)[1];
            assert.ok(code, "code is returned: " + code);

            return respond(client.verifyCode(uid, code),
                    RequestMocks.verifyCode);
          })
          .then(function (result) {

            return respond(client.recoveryEmailStatus(sessionToken),
                    RequestMocks.recoveryEmailVerified);
          })
          .then(function (result) {
            assert.equal(result.verified, true, "Email should be verified.");
            return true;
          })
      });

      /**
       * Password Reset
       */
      test('#reset password', function () {
        var user = 'test5' + Date.now();
        var email = user + '@restmail.net';
        var password = 'iliketurtles';
        var uid;
        var passwordForgotToken;
        var accountResetToken;

        setTimeout(function() {
          SinonResponder.respond(requests[0], RequestMocks.signUp);
        }, 200);

        return client.signUp(email, password)
          .then(function (result) {
            uid = result.uid;
            assert.ok(uid, "uid is returned");

            setTimeout(function() {
              SinonResponder.respond(requests[1], RequestMocks.passwordForgotSendCode);
            }, 200);

            return client.passwordForgotSendCode(email);
          })
          .then(function (result) {
            passwordForgotToken = result.passwordForgotToken;
            assert.ok(passwordForgotToken, "passwordForgotToken is returned");

            setTimeout(function() {
              SinonResponder.respond(requests[2], RequestMocks.resetMail);
            }, 200);

            return waitForEmail(user, 2);
          })
          .then(function (emails) {

            var code = emails[1].html.match(/code=([A-Za-z0-9]+)/)[1];
            assert.ok(code, "code is returned: " + code);

            setTimeout(function() {
              SinonResponder.respond(requests[3], RequestMocks.passwordForgotVerifyCode);
            }, 200);

            return client.passwordForgotVerifyCode(code, passwordForgotToken);
          })
          .then(function (result) {
            accountResetToken = result.accountResetToken;
            var newPassword = 'newturles';

            assert.ok(accountResetToken, "accountResetToken is returned");
            setTimeout(function() {
              SinonResponder.respond(requests[4], RequestMocks.accountReset);
            }, 200);

            return client.accountReset(email, newPassword, accountResetToken);
          })
          .then(function (result) {
            assert.ok(result, '{}');
            return true;
          })
      });

      function makeMockResponder(requests) {
        var requestIndex = 0;

        return function(returnValue, response) {
          setTimeout(function() {
            SinonResponder.respond(requests[requestIndex++], response);
          }, 200);

          return returnValue;
        }
      }

      // utility function that waits for a restmail email to arrive
      function waitForEmail(user, number) {
        if (!number) number = 1;
        console.log('Waiting for email...');

        return restmailClient.send('/mail/' + user, 'GET')
          .then(function(result) {
            if (result.length === number) {
              return result;
            } else {
              var deferred = p.defer();

              setTimeout(function() {
                waitForEmail(user, number)
                  .then(function(emails) {
                    deferred.resolve(emails);
                  }, function(err) {
                    deferred.reject(err);
                  });
              }, 1000);
              return deferred.promise;
            }
          });
      }

    });
  }
});
