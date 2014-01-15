/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Learn more about configuring this file at <https://github.com/theintern/intern/wiki/Configuring-Intern>.
// These default settings work OK for most people. The options that *must* be changed below are the
// packages, suites, excludeInstrumentation, and (if you want functional tests) functionalSuites.
define({

  loader: {
    // Packages that should be registered with the loader in each testing environment
    packages: [ { name: 'fxa-js-client', location: 'client' } ]
  },

  suites: [ 'tests/all' ],
  functionalSuites: [ ],
  AUTH_SERVER_URL: typeof process !== 'undefined' ? process.env.AUTH_SERVER_URL : undefined,

  excludeInstrumentation: /(?:.)\//

});
