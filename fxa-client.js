// Details: https://github.com/jrburke/almond#exporting-a-public-api
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        //Allow using this built library as an AMD module
        //in another project. That other project will only
        //see this AMD call, not the internal modules in
        //the closure below.
        define([], factory);
    } else {
        //Browser globals case. Just assign the
        //result to a property on the global.
        root.FxAccountClient = factory();
    }
}(this, function () {/**
 * almond 0.2.5 Copyright (c) 2011-2012, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        hasOwn = Object.prototype.hasOwnProperty,
        aps = [].slice;

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that "directory" and not name of the baseName's
                //module. For instance, baseName of "one/two/three", maps to
                //"one/two/three.js", but we want the directory, "one/two" for
                //this normalization.
                baseParts = baseParts.slice(0, baseParts.length - 1);

                name = baseParts.concat(name.split("/"));

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            } else if (name.indexOf('./') === 0) {
                // No baseName, so this is ID is resolved relative
                // to baseUrl, pull off the leading dot.
                name = name.substring(2);
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            return req.apply(undef, aps.call(arguments, 0).concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (hasProp(waiting, name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!hasProp(defined, name) && !hasProp(defining, name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (typeof callback === 'function') {

            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (hasProp(defined, depName) ||
                           hasProp(waiting, depName) ||
                           hasProp(defining, depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback.apply(defined[name], args);

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            //Using a non-zero value because of concern for what old browsers
            //do, and latest browsers "upgrade" to 4 if lower value is used:
            //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
            //If want a value immediately, use require('id') instead -- something
            //that works in almond on the global level, but not guaranteed and
            //unlikely to work in other AMD implementations.
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 4);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        config = cfg;
        if (config.deps) {
            req(config.deps, config.callback);
        }
        return req;
    };

    define = function (name, deps, callback) {

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        if (!hasProp(defined, name) && !hasProp(waiting, name)) {
            waiting[name] = [name, deps, callback];
        }
    };

    define.amd = {
        jQuery: true
    };
}());

define("components/almond/almond", function(){});

define('sjcl',[], function () {"use strict";  return sjcl; });
/*!
 * Copyright 2013 Robert Katić
 * Released under the MIT license
 * https://github.com/rkatic/p/blob/master/LICENSE
 *
 * High-priority-tasks code-portion based on https://github.com/kriskowal/asap
 * Long-Stack-Support code-portion based on https://github.com/kriskowal/q
 */
;(function( factory ){
	// CommonJS
	if ( typeof module !== "undefined" && module && module.exports ) {
		module.exports = factory();

	// RequireJS
	} else if ( typeof define === "function" && define.amd ) {
		define( 'p',factory );

	// global
	} else {
		P = factory();
	}
})(function() {
	"use strict";

	var withStack = withStackThrowing,
		pStartingLine = captureLine(),
		pFileName,
		currentTrace = null;

	function withStackThrowing( error ) {
		if ( !error.stack ) {
			try {
				throw error;
			} catch ( e ) {}
		}
		return error;
	}

	if ( new Error().stack ) {
		withStack = function( error ) {
			return error;
		};
	}

	function getTrace() {
		var stack = withStack( new Error() ).stack;
		if ( !stack ) {
			return null;
		}

		var stacks = [ filterStackString( stack, 1 ) ];

		if ( currentTrace ) {
			stacks = stacks.concat( currentTrace );

			if ( stacks.length === 128 ) {
				stacks.pop();
			}
		}

		return stacks;
	}

	function getFileNameAndLineNumber( stackLine ) {
		var m =
			/at .+ \((.+):(\d+):(?:\d+)\)$/.exec( stackLine ) ||
			/at ([^ ]+):(\d+):(?:\d+)$/.exec( stackLine ) ||
			/@(.+):(\d+):(?:\d+)$/.exec( stackLine );

		return m ? { fileName: m[1], lineNumber: Number(m[2]) } : null;
	}

	function captureLine() {
		var stack = withStack( new Error() ).stack;
		if ( !stack ) {
			return 0;
		}

		var lines = stack.split("\n");
		var firstLine = lines[0].indexOf("@") > 0 ? lines[1] : lines[2];
		var pos = getFileNameAndLineNumber( firstLine );
		if ( !pos ) {
			return 0;
		}

		pFileName = pos.fileName;
		return pos.lineNumber;
	}

	function filterStackString( stack, ignoreFirstLines ) {
		var lines = stack.split("\n");
		var goodLines = [];

		for ( var i = ignoreFirstLines|0, l = lines.length; i < l; ++i ) {
			var line = lines[i];

			if ( line && !isNodeFrame(line) && !isInternalFrame(line) ) {
				goodLines.push( line );
			}
		}

		return goodLines.join("\n");
	}

	function isNodeFrame( stackLine ) {
		return stackLine.indexOf("(module.js:") !== -1 ||
			   stackLine.indexOf("(node.js:") !== -1;
	}

	function isInternalFrame( stackLine ) {
		var pos = getFileNameAndLineNumber( stackLine );
		return !!pos &&
			pos.fileName === pFileName &&
			pos.lineNumber >= pStartingLine &&
			pos.lineNumber <= pEndingLine;
	}

	var STACK_JUMP_SEPARATOR = "\nFrom previous event:\n";

	function makeStackTraceLong( error ) {
		if ( error instanceof Error ) {
			var stack = error.stack;

			if ( !stack ) {
				stack = withStack( error ).stack;

			} else if ( ~stack.indexOf(STACK_JUMP_SEPARATOR) ) {
				return;
			}

			if ( stack ) {
				error.stack = [ filterStackString( stack, 0 ) ]
					.concat( currentTrace || [] )
					.join(STACK_JUMP_SEPARATOR);
			}
		}
	}

	//__________________________________________________________________________

	var
		isNodeJS = ot(typeof process) && process != null &&
			({}).toString.call(process) === "[object process]",

		hasSetImmediate = typeof setImmediate === "function",

		gMutationObserver =
			ot(typeof MutationObserver) && MutationObserver ||
			ot(typeof WebKitMutationObserver) && WebKitMutationObserver,

		head = new TaskNode(),
		tail = head,
		flushing = false,
		nFreeTaskNodes = 0,

		requestFlush =
			isNodeJS ? requestFlushForNodeJS :
			gMutationObserver ? makeRequestCallFromMutationObserver( flush ) :
			makeRequestCallFromTimer( flush ),

		pendingErrors = [],
		requestErrorThrow = makeRequestCallFromTimer( throwFirstError ),

		handleError,

		domain,

		call = ot.call,
		apply = ot.apply;

	tail.next = head;

	function TaskNode() {
		this.f = null;
		this.a = null;
		this.b = null;
		this.next = null;
	}

	function ot( type ) {
		return type === "object" || type === "function";
	}

	function throwFirstError() {
		if ( pendingErrors.length ) {
			throw pendingErrors.shift();
		}
	}

	function flush() {
		while ( head !== tail ) {
			var h = head = head.next;

			if ( nFreeTaskNodes >= 1024 ) {
				tail.next = tail.next.next;
			} else {
				++nFreeTaskNodes;
			}

			var f = h.f;
			var a = h.a;
			var b = h.b;
			h.f = null;
			h.a = null;
			h.b = null;

			f( a, b );
		}

		flushing = false;
		currentTrace = null;
	}

	function schedule( f, a, b ) {
		var node = tail.next;

		if ( node === head ) {
			tail.next = node = new TaskNode();
			node.next = head;
		} else {
			--nFreeTaskNodes;
		}

		tail = node;

		node.f = f;
		node.a = a;
		node.b = b;

		if ( !flushing ) {
			flushing = true;
			requestFlush();
		}
	}

	function requestFlushForNodeJS() {
		var currentDomain = process.domain;

		if ( currentDomain ) {
			if ( !domain ) domain = (1,require)("domain");
			domain.active = process.domain = null;
		}

		if ( flushing && hasSetImmediate ) {
			setImmediate( flush );

		} else {
			process.nextTick( flush );
		}

		if ( currentDomain ) {
			domain.active = process.domain = currentDomain;
		}
	}

	function makeRequestCallFromMutationObserver( callback ) {
		var toggle = 1;
		var node = document.createTextNode("");
		var observer = new gMutationObserver( callback );
		observer.observe( node, {characterData: true} );

		return function() {
			toggle = -toggle;
			node.data = toggle;
		};
	}

	function makeRequestCallFromTimer( callback ) {
		return function() {
			var timeoutHandle = setTimeout( handleTimer, 0 );
			var intervalHandle = setInterval( handleTimer, 50 );

			function handleTimer() {
				clearTimeout( timeoutHandle );
				clearInterval( intervalHandle );
				callback();
			}
		};
	}

	if ( isNodeJS ) {
		handleError = function( e ) {
			currentTrace = null;
			requestFlush();
			throw e;
		};

	} else {
		handleError = function( e ) {
			pendingErrors.push( e );
			requestErrorThrow();
		}
	}

	//__________________________________________________________________________

	var FULFILLED = 1;
	var REJECTED = 2;

	var OP_CALL = -1;
	var OP_THEN = -2;
	var OP_MULTIPLE = -3;
	var OP_END = -4;

	var VOID = P(void 0);

	function DoneEb( e ) {
		if ( P.onerror ) {
			(1,P.onerror)( e );

		} else {
			throw e;
		}
	}

	function P( x ) {
		return x instanceof Promise ?
			x :
			Resolve( new Promise(), x );
	}

	P.longStackSupport = false;

	function Fulfill( p, value ) {
		if ( p._state > 0 ) {
			return;
		}

		p._state = FULFILLED;
		p._value = value;
		p._domain = null;

		HandleSettled( p );
	}

	function Reject( p, reason ) {
		if ( p._state > 0 ) {
			return;
		}

		if ( currentTrace ) {
			makeStackTraceLong( reason );
		}

		p._state = REJECTED;
		p._value = reason;

		if ( isNodeJS ) {
			p._domain = process.domain;
		}

		if ( p._op === OP_END ) {
			handleError( reason );

		} else {
			HandleSettled( p );
		}
	}

	function Propagate( parent, p ) {
		if ( p._state > 0 ) {
			return;
		}

		p._state = parent._state;
		p._value = parent._value;
		p._domain = parent._domain;

		HandleSettled( p );
	}

	function Resolve( p, x ) {
		if ( p._state > 0 ) {
			return p;
		}

		if ( x instanceof Promise ) {
			ResolveWithPromise( p, x );

		} else {
			var type = typeof x;

			if ( type === "object" && x !== null || type === "function" ) {
				ResolveWithObject( p, x )

			} else {
				Fulfill( p, x );
			}
		}

		return p;
	}

	function ResolveWithPromise( p, x ) {
		if ( x === p ) {
			Reject( p, new TypeError("You can't resolve a promise with itself") );

		} else if ( x._state > 0 ) {
			Propagate( x, p );

		} else {
			OnSettled( x, OP_THEN, p );
		}
	}

	function ResolveWithObject( p, x ) {
		var then = GetThen( p, x );

		if ( typeof then === "function" ) {
			TryResolver( resolverFor(p, false), then, x );

		} else {
			Fulfill( p, x );
		}
	}

	function GetThen( p, x ) {
		try {
			return x.then;

		} catch ( e ) {
			Reject( p, e );
			return null;
		}
	}

	function TryResolver( d, resolver, x ) {
		try {
			call.call( resolver, x, d.resolve, d.reject );

		} catch ( e ) {
			d.reject( e );
		}
	}

	function HandleSettled( p ) {
		if ( p._pending !== null ) {
			HandlePending( p, p._op, p._pending );
			p._pending = null;
		}
	}

	function HandlePending( p, op, pending ) {
		if ( op >= 0 ) {
			pending._cb( p, op );

		} else if ( op === OP_CALL ) {
			pending( p );

		} else if ( op === OP_THEN ) {
			schedule( Then, p, pending );

		} else {
			for ( var i = 0, l = pending.length; i < l; i += 2 ) {
				HandlePending( p, pending[i], pending[i + 1] );
			}
		}
	}

	function OnSettled( p, op, pending ) {
		if ( p._state > 0 ) {
			HandlePending( p, op, pending );

		} else if ( p._pending === null ) {
			p._pending = pending;
			p._op = op;

		} else if ( p._op === OP_MULTIPLE ) {
			p._pending.push( op, pending );

		} else {
			p._pending = [ p._op, p._pending, op, pending ];
			p._op = OP_MULTIPLE;
		}
	}

	function Then( parent, p ) {
		var cb = parent._state === FULFILLED ? p._cb : p._eb;
		p._cb = null;
		p._eb = null;

		if ( p._trace ) {
			currentTrace = p._trace;
			p._trace = null;
		}

		if ( cb === null ) {
			Propagate( parent, p );

		} else {
			HandleCallback( p, cb, parent._value, parent._domain || p._domain );
		}
	}

	function HandleCallback( p, cb, value, domain ) {
		if ( domain ) {
			if ( domain._disposed ) return;
			domain.enter();
		}

		try {
			value = cb( value );

		} catch ( e ) {
			Reject( p, e );
			p = null;
		}

		if ( p ) Resolve( p, value );
		if ( domain ) domain.exit();
	}

	function resolverFor( promise, nodelike ) {
		var trace = P.longStackSupport ? getTrace() : null;

		function resolve( error, y ) {
			if ( promise ) {
				var p = promise;
				promise = null;

				if ( trace ) {
					if ( currentTrace ) {
						trace = null;

					} else {
						currentTrace = trace;
					}
				}

				if ( error ) {
					Reject( p, nodelike ? error : y );

				} else {
					Resolve( p, y );
				}

				if ( trace ) {
					currentTrace = trace = null;
				}
			}
		}

		return nodelike ? resolve : {
			promise: promise,

			resolve: function( y ) {
				resolve( false, y );
			},

			reject: function( reason ) {
				resolve( true, reason );
			}
		};
	}

	P.defer = defer;
	function defer() {
		return resolverFor( new Promise(), false );
	}

	P.reject = reject;
	function reject( reason ) {
		var promise = new Promise();
		Reject( promise, reason );
		return promise;
	}

	function Promise() {
		this._state = 0;
		this._value = void 0;
		this._domain = null;
		this._cb = null;
		this._eb = null;
		this._op = 0;
		this._pending = null;
		this._trace = null;
	}

	Promise.prototype.then = function( onFulfilled, onRejected ) {
		var promise = new Promise();

		promise._cb = typeof onFulfilled === "function" ? onFulfilled : null;
		promise._eb = typeof onRejected === "function" ? onRejected : null;

		if ( P.longStackSupport ) {
			promise._trace = getTrace();
		}

		if ( isNodeJS ) {
			promise._domain = process.domain;
		}

		if ( this._state > 0 ) {
			schedule( Then, this, promise );

		} else {
			OnSettled( this, OP_THEN, promise );
		}

		return promise;
	};

	Promise.prototype.done = function( cb, eb ) {
		var p = this;

		if ( cb || eb ) {
			p = p.then( cb, eb );
		}

		p.then( null, DoneEb )._op = OP_END;
	};

	Promise.prototype.fail = function( eb ) {
		return this.then( null, eb );
	};

	Promise.prototype.fin = function( finback ) {
		var self = this;

		function fb() {
			return finback();
		}

		return self.then( fb, fb ).then(function() {
			return self;
		});
	};

	Promise.prototype.spread = function( cb, eb ) {
		return this.then( all ).then(function( args ) {
			return apply.call( cb, void 0, args );
		}, eb);
	};

	Promise.prototype.timeout = function( ms, msg ) {
		var promise = new Promise();

		if ( this._state > 0 ) {
			Propagate( this, promise );

		} else {
			var timedout = false;
			var trace = P.longStackSupport ? getTrace() : null;

			var timeoutId = setTimeout(function() {
				timedout = true;
				currentTrace = trace;
				Reject( promise, new Error(msg || "Timed out after " + ms + " ms") );
				currentTrace = null;
			}, ms);

			OnSettled(this, OP_CALL, function( p ) {
				if ( !timedout ) {
					schedule( Propagate, p, promise );
					clearTimeout( timeoutId );
				}
			});
		}

		return promise;
	};

	Promise.prototype.delay = function( ms ) {
		var promise = new Promise();

		OnSettled(this, OP_CALL, function( p ) {
			if ( p._state === FULFILLED ) {
				setTimeout(function() {
					Propagate( p, promise );
				}, ms);

			} else {
				schedule( Propagate, p, promise );
			}
		});

		return promise;
	};

	Promise.prototype.all = function() {
		return this.then( all );
	};

	Promise.prototype.allSettled = function() {
		return this.then( allSettled );
	};

	Promise.prototype.inspect = function() {
		switch ( this._state ) {
			case FULFILLED: return { state: "fulfilled", value: this._value };
			case REJECTED:  return { state: "rejected", reason: this._value };
			default:		return { state: "pending" };
		}
	};

	Promise.prototype.nodeify = function( nodeback ) {
		if ( nodeback ) {
			this.done(function( value ) {
				nodeback( null, value );
			}, nodeback);
			return void 0;

		} else {
			return this;
		}
	};

	function _allSettled_cb( p, i ) {
		this._value[ i ] = p.inspect();
		if ( ++this._state === 0 ) {
			if ( this._pending === null ) {
				this._state = FULFILLED;
			} else {
				schedule( Fulfill, this, this._value );
			}
		}
	}

	function _all_cb( p, i ) {
		if ( this._state < 0 ) {
			if ( p._state === REJECTED ) {
				this._state = 0;
				if ( this._pending === null ) {
					Propagate( p, this );
				} else {
					schedule( Propagate, p, this );
				}

			} else {
				this._value[ i ] = p._value;
				if ( ++this._state === 0 ) {
					if ( this._pending === null ) {
						this._state = FULFILLED;
					} else {
						schedule( Fulfill, this, this._value );
					}
				}
			}
		}
	}

	var nextIsAllSettled = false;

	P.all = all;
	function all( input ) {
		var promise = new Promise();
		promise._cb = nextIsAllSettled ? _allSettled_cb : _all_cb;
		nextIsAllSettled = false;

		var len = input.length|0;

		promise._state = len ? -len : FULFILLED;
		promise._value = new Array( len );

		for ( var i = 0; i < len && promise._state < 0; ++i ) {
			OnSettled( P(input[i]), i, promise );
		}

		return promise;
	}

	P.allSettled = allSettled;
	function allSettled( input ) {
		nextIsAllSettled = true;
		return all( input );
	}

	P.spread = spread;
	function spread( values, cb, eb ) {
		return all( values ).then(function( args ) {
			return apply.call( cb, void 0, args );
		}, eb);
	}

	P.promised = promised;
	function promised( f ) {
		function onFulfilled( thisAndArgs ) {
			return call.apply( f, thisAndArgs );
		}

		return function() {
			var len = arguments.length;
			var thisAndArgs = new Array( len + 1 );
			thisAndArgs[0] = this;
			for ( var i = 0; i < len; ++i ) {
				thisAndArgs[ i + 1 ] = arguments[ i ];
			}
			return all( thisAndArgs ).then( onFulfilled );
		};
	}

	P.denodeify = denodeify;
	function denodeify( f ) {
		return function() {
			var promise = new Promise();

			var i = arguments.length;
			var args = new Array( i + 1 );
			args[i] = resolverFor( promise, true );
			while ( i-- ) {
				args[i] = arguments[i];
			}

			TryApply( promise, f, this, args );

			return promise;
		};
	}

	function TryApply( p, f, that, args ) {
		try {
			apply.call( f, that, args );

		} catch ( e ) {
			Reject( p, e );
		}
	}

	P.onerror = null;

	P.nextTick = function nextTick( task ) {
		// We don't use .done to avoid P.onerror.
		VOID.then(function() {
			task.call();
		})._op = OP_END;
	};

	var pEndingLine = captureLine();

	return P;
});

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
define('client/lib/hawk',['sjcl'], function (sjcl) {
  'use strict';

  /*
   HTTP Hawk Authentication Scheme
   Copyright (c) 2012-2013, Eran Hammer <eran@hueniverse.com>
   MIT Licensed
   */


  // Declare namespace

  var hawk = {};

  hawk.client = {

    // Generate an Authorization header for a given request

    /*
     uri: 'http://example.com/resource?a=b'
     method: HTTP verb (e.g. 'GET', 'POST')
     options: {

     // Required

     credentials: {
     id: 'dh37fgj492je',
     key: 'aoijedoaijsdlaksjdl',
     algorithm: 'sha256'                                 // 'sha1', 'sha256'
     },

     // Optional

     ext: 'application-specific',                        // Application specific data sent via the ext attribute
     timestamp: Date.now() / 1000,                       // A pre-calculated timestamp in seconds
     nonce: '2334f34f',                                  // A pre-generated nonce
     localtimeOffsetMsec: 400,                           // Time offset to sync with server time (ignored if timestamp provided)
     payload: '{"some":"payload"}',                      // UTF-8 encoded string for body hash generation (ignored if hash provided)
     contentType: 'application/json',                    // Payload content-type (ignored if hash provided)
     hash: 'U4MKKSmiVxk37JCCrAVIjV=',                    // Pre-calculated payload hash
     app: '24s23423f34dx',                               // Oz application id
     dlg: '234sz34tww3sd'                                // Oz delegated-by application id
     }
     */

    header: function (uri, method, options) {
      /*eslint complexity: [2, 21] */
      var result = {
        field: '',
        artifacts: {}
      };

      // Validate inputs

      if (!uri || (typeof uri !== 'string' && typeof uri !== 'object') ||
        !method || typeof method !== 'string' ||
        !options || typeof options !== 'object') {

        result.err = 'Invalid argument type';
        return result;
      }

      // Application time

      var timestamp = options.timestamp || Math.floor((hawk.utils.now() + (options.localtimeOffsetMsec || 0)) / 1000);

      // Validate credentials

      var credentials = options.credentials;
      if (!credentials ||
        !credentials.id ||
        !credentials.key ||
        !credentials.algorithm) {

        result.err = 'Invalid credential object';
        return result;
      }

      if (hawk.utils.baseIndexOf(hawk.crypto.algorithms, credentials.algorithm) === -1) {
        result.err = 'Unknown algorithm';
        return result;
      }

      // Parse URI

      if (typeof uri === 'string') {
        uri = hawk.utils.parseUri(uri);
      }

      // Calculate signature

      var artifacts = {
        ts: timestamp,
        nonce: options.nonce || hawk.utils.randomString(6),
        method: method,
        resource: uri.relative,
        host: uri.hostname,
        port: uri.port,
        hash: options.hash,
        ext: options.ext,
        app: options.app,
        dlg: options.dlg
      };

      result.artifacts = artifacts;

      // Calculate payload hash

      if (!artifacts.hash &&
        options.hasOwnProperty('payload')) {

        artifacts.hash = hawk.crypto.calculatePayloadHash(options.payload, credentials.algorithm, options.contentType);
      }

      var mac = hawk.crypto.calculateMac('header', credentials, artifacts);

      // Construct header

      var hasExt = artifacts.ext !== null && artifacts.ext !== undefined && artifacts.ext !== '';       // Other falsey values allowed
      var header = 'Hawk id="' + credentials.id +
        '", ts="' + artifacts.ts +
        '", nonce="' + artifacts.nonce +
        (artifacts.hash ? '", hash="' + artifacts.hash : '') +
        (hasExt ? '", ext="' + hawk.utils.escapeHeaderAttribute(artifacts.ext) : '') +
        '", mac="' + mac + '"';

      if (artifacts.app) {
        header += ', app="' + artifacts.app +
          (artifacts.dlg ? '", dlg="' + artifacts.dlg : '') + '"';
      }

      result.field = header;

      return result;
    },


    // Validate server response

    /*
     request:    object created via 'new XMLHttpRequest()' after response received
     artifacts:  object recieved from header().artifacts
     options: {
     payload:    optional payload received
     required:   specifies if a Server-Authorization header is required. Defaults to 'false'
     }
     */

    authenticate: function (request, credentials, artifacts, options) {

      options = options || {};

      if (request.getResponseHeader('www-authenticate')) {

        // Parse HTTP WWW-Authenticate header

        var attrsAuth = hawk.utils.parseAuthorizationHeader(request.getResponseHeader('www-authenticate'), ['ts', 'tsm', 'error']);
        if (!attrsAuth) {
          return false;
        }

        if (attrsAuth.ts) {
          var tsm = hawk.crypto.calculateTsMac(attrsAuth.ts, credentials);
          if (tsm !== attrsAuth.tsm) {
            return false;
          }

          hawk.utils.setNtpOffset(attrsAuth.ts - Math.floor((new Date()).getTime() / 1000));     // Keep offset at 1 second precision
        }
      }

      // Parse HTTP Server-Authorization header

      if (!request.getResponseHeader('server-authorization') &&
        !options.required) {

        return true;
      }

      var attributes = hawk.utils.parseAuthorizationHeader(request.getResponseHeader('server-authorization'), ['mac', 'ext', 'hash']);
      if (!attributes) {
        return false;
      }

      var modArtifacts = {
        ts: artifacts.ts,
        nonce: artifacts.nonce,
        method: artifacts.method,
        resource: artifacts.resource,
        host: artifacts.host,
        port: artifacts.port,
        hash: attributes.hash,
        ext: attributes.ext,
        app: artifacts.app,
        dlg: artifacts.dlg
      };

      var mac = hawk.crypto.calculateMac('response', credentials, modArtifacts);
      if (mac !== attributes.mac) {
        return false;
      }

      if (!options.hasOwnProperty('payload')) {
        return true;
      }

      if (!attributes.hash) {
        return false;
      }

      var calculatedHash = hawk.crypto.calculatePayloadHash(options.payload, credentials.algorithm, request.getResponseHeader('content-type'));
      return (calculatedHash === attributes.hash);
    },

    message: function (host, port, message, options) {

      // Validate inputs

      if (!host || typeof host !== 'string' ||
        !port || typeof port !== 'number' ||
        message === null || message === undefined || typeof message !== 'string' ||
        !options || typeof options !== 'object') {

        return null;
      }

      // Application time

      var timestamp = options.timestamp || Math.floor((hawk.utils.now() + (options.localtimeOffsetMsec || 0)) / 1000);

      // Validate credentials

      var credentials = options.credentials;
      if (!credentials ||
        !credentials.id ||
        !credentials.key ||
        !credentials.algorithm) {

        // Invalid credential object
        return null;
      }

      if (hawk.crypto.algorithms.indexOf(credentials.algorithm) === -1) {
        return null;
      }

      // Calculate signature

      var artifacts = {
        ts: timestamp,
        nonce: options.nonce || hawk.utils.randomString(6),
        host: host,
        port: port,
        hash: hawk.crypto.calculatePayloadHash(message, credentials.algorithm)
      };

      // Construct authorization

      var result = {
        id: credentials.id,
        ts: artifacts.ts,
        nonce: artifacts.nonce,
        hash: artifacts.hash,
        mac: hawk.crypto.calculateMac('message', credentials, artifacts)
      };

      return result;
    },

    authenticateTimestamp: function (message, credentials, updateClock) {           // updateClock defaults to true

      var tsm = hawk.crypto.calculateTsMac(message.ts, credentials);
      if (tsm !== message.tsm) {
        return false;
      }

      if (updateClock !== false) {
        hawk.utils.setNtpOffset(message.ts - Math.floor((new Date()).getTime() / 1000));    // Keep offset at 1 second precision
      }

      return true;
    }
  };


  hawk.crypto = {

    headerVersion: '1',

    algorithms: ['sha1', 'sha256'],

    calculateMac: function (type, credentials, options) {
      var normalized = hawk.crypto.generateNormalizedString(type, options);
      var hmac = new sjcl.misc.hmac(credentials.key, sjcl.hash.sha256);
      hmac.update(normalized);

      return sjcl.codec.base64.fromBits(hmac.digest());
    },

    generateNormalizedString: function (type, options) {

      var normalized = 'hawk.' + hawk.crypto.headerVersion + '.' + type + '\n' +
        options.ts + '\n' +
        options.nonce + '\n' +
        (options.method || '').toUpperCase() + '\n' +
        (options.resource || '') + '\n' +
        options.host.toLowerCase() + '\n' +
        options.port + '\n' +
        (options.hash || '') + '\n';

      if (options.ext) {
        normalized += options.ext.replace('\\', '\\\\').replace('\n', '\\n');
      }

      normalized += '\n';

      if (options.app) {
        normalized += options.app + '\n' +
          (options.dlg || '') + '\n';
      }

      return normalized;
    },

    calculatePayloadHash: function (payload, algorithm, contentType) {
      var hash = new sjcl.hash.sha256();
      hash.update('hawk.' + hawk.crypto.headerVersion + '.payload\n')
        .update(hawk.utils.parseContentType(contentType) + '\n')
        .update(payload || '')
        .update('\n');

      return sjcl.codec.base64.fromBits(hash.finalize());
    },

    calculateTsMac: function (ts, credentials) {
      var hmac = new sjcl.misc.hmac(credentials.key, sjcl.hash.sha256);
      hmac.update('hawk.' + hawk.crypto.headerVersion + '.ts\n' + ts + '\n');

      return sjcl.codec.base64.fromBits(hmac.digest());
    }
  };


  hawk.utils = {

    storage: {                                      // localStorage compatible interface
      _cache: {},
      setItem: function (key, value) {

        hawk.utils.storage._cache[key] = value;
      },
      getItem: function (key) {

        return hawk.utils.storage._cache[key];
      }
    },

    setStorage: function (storage) {

      var ntpOffset = hawk.utils.getNtpOffset() || 0;
      hawk.utils.storage = storage;
      hawk.utils.setNtpOffset(ntpOffset);
    },

    setNtpOffset: function (offset) {

      try {
        hawk.utils.storage.setItem('hawk_ntp_offset', offset);
      }
      catch (err) {
        console.error('[hawk] could not write to storage.');
        console.error(err);
      }
    },

    getNtpOffset: function () {

      return parseInt(hawk.utils.storage.getItem('hawk_ntp_offset') || '0', 10);
    },

    now: function () {

      return (new Date()).getTime() + hawk.utils.getNtpOffset();
    },

    escapeHeaderAttribute: function (attribute) {

      return attribute.replace(/\\/g, '\\\\').replace(/\"/g, '\\"');
    },

    parseContentType: function (header) {

      if (!header) {
        return '';
      }

      return header.split(';')[0].replace(/^\s+|\s+$/g, '').toLowerCase();
    },

    parseAuthorizationHeader: function (header, keys) {

      if (!header) {
        return null;
      }

      var headerParts = header.match(/^(\w+)(?:\s+(.*))?$/);       // Header: scheme[ something]
      if (!headerParts) {
        return null;
      }

      var scheme = headerParts[1];
      if (scheme.toLowerCase() !== 'hawk') {
        return null;
      }

      var attributesString = headerParts[2];
      if (!attributesString) {
        return null;
      }

      var attributes = {};
      var verify = attributesString.replace(/(\w+)="([^"\\]*)"\s*(?:,\s*|$)/g, function ($0, $1, $2) {

        // Check valid attribute names

        if (keys.indexOf($1) === -1) {
          return;
        }

        // Allowed attribute value characters: !#$%&'()*+,-./:;<=>?@[]^_`{|}~ and space, a-z, A-Z, 0-9

        if ($2.match(/^[ \w\!#\$%&'\(\)\*\+,\-\.\/\:;<\=>\?@\[\]\^`\{\|\}~]+$/) === null) {
          return;
        }

        // Check for duplicates

        if (attributes.hasOwnProperty($1)) {
          return;
        }

        attributes[$1] = $2;
        return '';
      });

      if (verify !== '') {
        return null;
      }

      return attributes;
    },

    randomString: function (size) {

      var randomSource = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      var len = randomSource.length;

      var result = [];
      for (var i = 0; i < size; ++i) {
        result[i] = randomSource[Math.floor(Math.random() * len)];
      }

      return result.join('');
    },

    baseIndexOf: function(array, value, fromIndex) {
      var index = (fromIndex || 0) - 1,
        length = array ? array.length : 0;

      while (++index < length) {
        if (array[index] === value) {
          return index;
        }
      }
      return -1;
    },

    parseUri: function (input) {

      // Based on: parseURI 1.2.2
      // http://blog.stevenlevithan.com/archives/parseuri
      // (c) Steven Levithan <stevenlevithan.com>
      // MIT License

      var keys = ['source', 'protocol', 'authority', 'userInfo', 'user', 'password', 'hostname', 'port', 'resource', 'relative', 'pathname', 'directory', 'file', 'query', 'fragment'];

      var uriRegex = /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?(((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?)(?:#(.*))?)/;
      var uriByNumber = uriRegex.exec(input);
      var uri = {};

      var i = 15;
      while (i--) {
        uri[keys[i]] = uriByNumber[i] || '';
      }

      if (uri.port === null ||
        uri.port === '') {

        uri.port = (uri.protocol.toLowerCase() === 'http' ? '80' : (uri.protocol.toLowerCase() === 'https' ? '443' : ''));
      }

      return uri;
    }
  };


  return hawk;
});

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
define('client/lib/errors',[], function () {
  return {
    INVALID_TIMESTAMP: 111,
    INCORRECT_EMAIL_CASE: 120
  };
});

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
define('client/lib/request',['./hawk', 'p', './errors'], function (hawk, P, ERRORS) {
  'use strict';
  /* global XMLHttpRequest */

  /**
   * @class Request
   * @constructor
   * @param {String} baseUri Base URI
   * @param {Object} xhr XMLHttpRequest constructor
   * @param {Object} [options={}] Options
   *   @param {Number} [options.localtimeOffsetMsec]
   *   Local time offset with the remote auth server's clock
   */
  function Request (baseUri, xhr, options) {
    if (!options) {
      options = {};
    }
    this.baseUri = baseUri;
    this._localtimeOffsetMsec = options.localtimeOffsetMsec;
    this.xhr = xhr || XMLHttpRequest;
    this.timeout = options.timeout || 30 * 1000;
  }

  /**
   * @method send
   * @param {String} path Request path
   * @param {String} method HTTP Method
   * @param {Object} credentials HAWK Headers
   * @param {Object} jsonPayload JSON Payload
   * @param {Object} [options={}] Options
   *   @param {String} [options.retrying]
   *   Flag indicating if the request is a retry
   *   @param {Array} [options.headers]
   *   A set of extra headers to add to the request
   * @return {Promise} A promise that will be fulfilled with JSON `xhr.responseText` of the request
   */
  Request.prototype.send = function request(path, method, credentials, jsonPayload, options) {
    /*eslint complexity: [2, 8] */
    var deferred = P.defer();
    var xhr = new this.xhr();
    var uri = this.baseUri + path;
    var payload = null;
    var self = this;
    options = options || {};

    if (jsonPayload) {
      payload = JSON.stringify(jsonPayload);
    }

    try {
      xhr.open(method, uri);
    } catch (e) {
      return P.reject({ error: 'Unknown error', message: e.toString(), errno: 999 });
    }

    xhr.timeout = this.timeout;

    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        var result = xhr.responseText;
        try {
          result = JSON.parse(xhr.responseText);
        } catch (e) { }

        if (result.errno) {
          // Try to recover from a timeskew error and not already tried
          if (result.errno === ERRORS.INVALID_TIMESTAMP && !options.retrying) {
            var serverTime = result.serverTime;
            self._localtimeOffsetMsec = (serverTime * 1000) - new Date().getTime();

            // add to options that the request is retrying
            options.retrying = true;

            return self.send(path, method, credentials, jsonPayload, options)
              .then(deferred.resolve, deferred.reject);

          } else {
            return deferred.reject(result);
          }
        }

        if (typeof xhr.status === 'undefined' || xhr.status !== 200) {
          if (result.length === 0) {
            return deferred.reject({ error: 'Timeout error', errno: 999 });
          } else {
            return deferred.reject({ error: 'Unknown error', message: result, errno: 999, code: xhr.status });
          }
        }

        deferred.resolve(result);
      }
    };

    // calculate Hawk header if credentials are supplied
    if (credentials) {
      var hawkHeader = hawk.client.header(uri, method, {
                          credentials: credentials,
                          payload: payload,
                          contentType: 'application/json',
                          localtimeOffsetMsec: this._localtimeOffsetMsec || 0
                        });
      xhr.setRequestHeader('authorization', hawkHeader.field);
    }

    xhr.setRequestHeader('Content-Type', 'application/json');

    if (options && options.headers) {
      // set extra headers for this request
      for (var header in options.headers) {
        xhr.setRequestHeader(header, options.headers[header]);
      }
    }

    xhr.send(payload);

    return deferred.promise;
  };

  return Request;

});

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
define('client/lib/hkdf',['sjcl', 'p'], function (sjcl, P) {
  'use strict';

  /**
   * hkdf - The HMAC-based Key Derivation Function
   * based on https://github.com/mozilla/node-hkdf
   *
   * @class hkdf
   * @param {bitArray} ikm Initial keying material
   * @param {bitArray} info Key derivation data
   * @param {bitArray} salt Salt
   * @param {integer} length Length of the derived key in bytes
   * @return promise object- It will resolve with `output` data
   */
  function hkdf(ikm, info, salt, length) {

    var mac = new sjcl.misc.hmac(salt, sjcl.hash.sha256);
    mac.update(ikm);

    // compute the PRK
    var prk = mac.digest();

    // hash length is 32 because only sjcl.hash.sha256 is used at this moment
    var hashLength = 32;
    var num_blocks = Math.ceil(length / hashLength);
    var prev = sjcl.codec.hex.toBits('');
    var output = '';

    for (var i = 0; i < num_blocks; i++) {
      var hmac = new sjcl.misc.hmac(prk, sjcl.hash.sha256);

      var input = sjcl.bitArray.concat(
        sjcl.bitArray.concat(prev, info),
        sjcl.codec.utf8String.toBits((String.fromCharCode(i + 1)))
      );

      hmac.update(input);

      prev = hmac.digest();
      output += sjcl.codec.hex.fromBits(prev);
    }

    var truncated = sjcl.bitArray.clamp(sjcl.codec.hex.toBits(output), length * 8);

    return P(truncated);
  }

  return hkdf;

});

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
define('client/lib/pbkdf2',['sjcl', 'p'], function (sjcl, P) {
  'use strict';

  /**
   * @class pbkdf2
   * @constructor
   */
  var pbkdf2 = {
    /**
     * @method derive
     * @param  {bitArray} input The password hex buffer.
     * @param  {bitArray} salt The salt string buffer.
     * @return {int} iterations the derived key bit array.
     */
    derive: function(input, salt, iterations, len) {
      var result = sjcl.misc.pbkdf2(input, salt, iterations, len, sjcl.misc.hmac);
      return P(result);
    }
  };

  return pbkdf2;

});

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
define('client/lib/credentials',['./request', 'sjcl', 'p', './hkdf', './pbkdf2'], function (Request, sjcl, P, hkdf, pbkdf2) {
  'use strict';

  // Key wrapping and stretching configuration.
  var NAMESPACE = 'identity.mozilla.com/picl/v1/';
  var PBKDF2_ROUNDS = 1000;
  var STRETCHED_PASS_LENGTH_BYTES = 32 * 8;

  var HKDF_SALT = sjcl.codec.hex.toBits('00');
  var HKDF_LENGTH = 32;

  /**
   * Key Wrapping with a name
   *
   * @method kw
   * @static
   * @param {String} name The name of the salt
   * @return {bitArray} the salt combination with the namespace
   */
  function kw(name) {
    return sjcl.codec.utf8String.toBits(NAMESPACE + name);
  }

  /**
   * Key Wrapping with a name and an email
   *
   * @method kwe
   * @static
   * @param {String} name The name of the salt
   * @param {String} email The email of the user.
   * @return {bitArray} the salt combination with the namespace
   */
  function kwe(name, email) {
    return sjcl.codec.utf8String.toBits(NAMESPACE + name + ':' + email);
  }

  /**
   * @class credentials
   * @constructor
   */
  return {
    /**
     * Setup credentials
     *
     * @method setup
     * @param {String} emailInput
     * @param {String} passwordInput
     * @return {Promise} A promise that will be fulfilled with `result` of generated credentials
     */
    setup: function (emailInput, passwordInput) {
      var result = {};
      var email = kwe('quickStretch', emailInput);
      var password = sjcl.codec.utf8String.toBits(passwordInput);

      result.emailUTF8 = emailInput;
      result.passwordUTF8 = passwordInput;

      return pbkdf2.derive(password, email, PBKDF2_ROUNDS, STRETCHED_PASS_LENGTH_BYTES)
        .then(
        function (quickStretchedPW) {
          result.quickStretchedPW = quickStretchedPW;

          return hkdf(quickStretchedPW, kw('authPW'), HKDF_SALT, HKDF_LENGTH)
            .then(
            function (authPW) {
              result.authPW = authPW;

              return hkdf(quickStretchedPW, kw('unwrapBkey'), HKDF_SALT, HKDF_LENGTH);
            }
          );
        }
      )
        .then(
        function (unwrapBKey) {
          result.unwrapBKey = unwrapBKey;
          return result;
        }
      );
    },
    /**
     * Wrap
     *
     * @method wrap
     * @param {bitArray} bitArray1
     * @param {bitArray} bitArray2
     * @return {bitArray} wrap result of the two bitArrays
     */
    xor: function (bitArray1, bitArray2) {
      var result = [];

      for (var i = 0; i < bitArray1.length; i++) {
        result[i] = bitArray1[i] ^ bitArray2[i];
      }

      return result;
    },
    /**
     * Unbundle the WrapKB
     * @param {String} key Bundle Key in hex
     * @param {String} bundle Key bundle in hex
     * @returns {*}
     */
    unbundleKeyFetchResponse: function (key, bundle) {
      var self = this;
      var bitBundle = sjcl.codec.hex.toBits(bundle);

      return this.deriveBundleKeys(key, 'account/keys')
        .then(
          function (keys) {
            var ciphertext = sjcl.bitArray.bitSlice(bitBundle, 0, 8 * 64);
            var expectedHmac = sjcl.bitArray.bitSlice(bitBundle, 8 * -32);
            var hmac = new sjcl.misc.hmac(keys.hmacKey, sjcl.hash.sha256);
            hmac.update(ciphertext);

            if (!sjcl.bitArray.equal(hmac.digest(), expectedHmac)) {
              throw new Error('Bad HMac');
            }

            var keyAWrapB = self.xor(sjcl.bitArray.bitSlice(bitBundle, 0, 8 * 64), keys.xorKey);

            return {
              kA: sjcl.codec.hex.fromBits(sjcl.bitArray.bitSlice(keyAWrapB, 0, 8 * 32)),
              wrapKB: sjcl.codec.hex.fromBits(sjcl.bitArray.bitSlice(keyAWrapB, 8 * 32))
            };
          }
        );
    },
    /**
     * Derive the HMAC and XOR keys required to encrypt a given size of payload.
     * @param {String} key Hex Bundle Key
     * @param {String} keyInfo Bundle Key Info
     * @returns {Object} hmacKey, xorKey
     */
    deriveBundleKeys: function(key, keyInfo) {
      var bitKeyInfo = kw(keyInfo);
      var salt = sjcl.codec.hex.toBits('');
      key = sjcl.codec.hex.toBits(key);

      return hkdf(key, bitKeyInfo, salt, 3 * 32)
        .then(
          function (keyMaterial) {

            return {
              hmacKey: sjcl.bitArray.bitSlice(keyMaterial, 0, 8 * 32),
              xorKey: sjcl.bitArray.bitSlice(keyMaterial, 8 * 32)
            };
          }
        );
    }
  };

});

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
define('client/lib/hawkCredentials',['sjcl', './hkdf'], function (sjcl, hkdf) {
  'use strict';

  var PREFIX_NAME = 'identity.mozilla.com/picl/v1/';
  var bitSlice = sjcl.bitArray.bitSlice;
  var salt = sjcl.codec.hex.toBits('');

  /**
   * @class hawkCredentials
   * @method deriveHawkCredentials
   * @param {String} tokenHex
   * @param {String} context
   * @param {int} size
   * @returns {Promise}
   */
  function deriveHawkCredentials(tokenHex, context, size) {
    var token = sjcl.codec.hex.toBits(tokenHex);
    var info = sjcl.codec.utf8String.toBits(PREFIX_NAME + context);

    return hkdf(token, info, salt, size || 3 * 32)
      .then(function(out) {
        var authKey = bitSlice(out, 8 * 32, 8 * 64);
        var bundleKey = bitSlice(out, 8 * 64);

        return {
          algorithm: 'sha256',
          id: sjcl.codec.hex.fromBits(bitSlice(out, 0, 8 * 32)),
          key: authKey,
          bundleKey: bundleKey
        };
      });
  }

  return deriveHawkCredentials;
});

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// This module does the handling for the metrics context
// activity event metadata.

define('client/lib/metricsContext',[], function () {
  'use strict';

  return {
    marshall: function (data) {
      return {
        flowId: data.flowId,
        flowBeginTime: data.flowBeginTime
      };
    }
  };
});

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
define('client/FxAccountClient',[
  'sjcl',
  'p',
  './lib/credentials',
  './lib/errors',
  './lib/hawkCredentials',
  './lib/metricsContext',
  './lib/request',
], function (sjcl, P, credentials, ERRORS, hawkCredentials, metricsContext, Request) {
  'use strict';

  var VERSION = 'v1';
  var uriVersionRegExp = new RegExp('/' + VERSION + '$');
  var HKDF_SIZE = 2 * 32;

  function isUndefined(val) {
    return typeof val === 'undefined';
  }

  function isNull(val) {
    return val === null;
  }

  function isEmptyObject(val) {
    return Object.prototype.toString.call(val) === '[object Object]' && ! Object.keys(val).length;
  }

  function isEmptyString(val) {
    return val === '';
  }

  function required(val, name) {
    if (isUndefined(val) ||
        isNull(val) ||
        isEmptyObject(val) ||
        isEmptyString(val)) {
      throw new Error('Missing ' + name);
    }
  }

  /**
   * @class FxAccountClient
   * @constructor
   * @param {String} uri Auth Server URI
   * @param {Object} config Configuration
   */
  function FxAccountClient(uri, config) {
    if (! uri && ! config) {
      throw new Error('Firefox Accounts auth server endpoint or configuration object required.');
    }

    if (typeof uri !== 'string') {
      config = uri || {};
      uri = config.uri;
    }

    if (typeof config === 'undefined') {
      config = {};
    }

    if (! uri) {
      throw new Error('FxA auth server uri not set.');
    }

    if (!uriVersionRegExp.test(uri)) {
      uri = uri + '/' + VERSION;
    }

    this.request = new Request(uri, config.xhr, { localtimeOffsetMsec: config.localtimeOffsetMsec });
  }

  FxAccountClient.VERSION = VERSION;

  /**
   * @method signUp
   * @param {String} email Email input
   * @param {String} password Password input
   * @param {Object} [options={}] Options
   *   @param {Boolean} [options.keys]
   *   If `true`, calls the API with `?keys=true` to get the keyFetchToken
   *   @param {String} [options.service]
   *   Opaque alphanumeric token to be included in verification links
   *   @param {String} [options.redirectTo]
   *   a URL that the client should be redirected to after handling the request
   *   @param {String} [options.preVerified]
   *   set email to be verified if possible
   *   @param {String} [options.resume]
   *   Opaque url-encoded string that will be included in the verification link
   *   as a querystring parameter, useful for continuing an OAuth flow for
   *   example.
   *   @param {String} [options.lang]
   *   set the language for the 'Accept-Language' header
   *   @param {Object} [options.metricsContext={}] Metrics context metadata
   *     @param {String} options.metricsContext.flowId identifier for the current event flow
   *     @param {Number} options.metricsContext.flowBeginTime flow.begin event time
   * @return {Promise} A promise that will be fulfilled with JSON `xhr.responseText` of the request
   */
  FxAccountClient.prototype.signUp = function (email, password, options) {
    var self = this;

    return P()
      .then(function () {
        required(email, 'email');
        required(password, 'password');

        return credentials.setup(email, password);
      })
      .then(
        function (result) {
          /*eslint complexity: [2, 13] */
          var endpoint = '/account/create';
          var data = {
            email: result.emailUTF8,
            authPW: sjcl.codec.hex.fromBits(result.authPW)
          };
          var requestOpts = {};

          if (options) {
            if (options.service) {
              data.service = options.service;
            }

            if (options.redirectTo) {
              data.redirectTo = options.redirectTo;
            }

            // preVerified is used for unit/functional testing
            if (options.preVerified) {
              data.preVerified = options.preVerified;
            }

            if (options.resume) {
              data.resume = options.resume;
            }

            if (options.keys) {
              endpoint += '?keys=true';
            }

            if (options.lang) {
              requestOpts.headers = {
                'Accept-Language': options.lang
              };
            }

            if (options.metricsContext) {
              data.metricsContext = metricsContext.marshall(options.metricsContext);
            }
          }

          return self.request.send(endpoint, 'POST', null, data, requestOpts)
            .then(
              function(accountData) {
                if (options && options.keys) {
                  accountData.unwrapBKey = sjcl.codec.hex.fromBits(result.unwrapBKey);
                }
                return accountData;
              }
            );
        }
      );
  };

  /**
   * @method signIn
   * @param {String} email Email input
   * @param {String} password Password input
   * @param {Object} [options={}] Options
   *   @param {Boolean} [options.keys]
   *   If `true`, calls the API with `?keys=true` to get the keyFetchToken
   *   @param {Boolean} [options.skipCaseError]
   *   If `true`, the request will skip the incorrect case error
   *   @param {String} [options.service]
   *   Service being signed into
   *   @param {String} [options.reason]
   *   Reason for sign in. Can be one of: `signin`, `password_check`,
   *   `password_change`, `password_reset`
   *   @param {String} [options.redirectTo]
   *   a URL that the client should be redirected to after handling the request
   *   @param {String} [options.resume]
   *   Opaque url-encoded string that will be included in the verification link
   *   as a querystring parameter, useful for continuing an OAuth flow for
   *   example.
   *   @param {Object} [options.metricsContext={}] Metrics context metadata
   *     @param {String} options.metricsContext.flowId identifier for the current event flow
   *     @param {Number} options.metricsContext.flowBeginTime flow.begin event time
   *   @param {String} [options.unblockCode]
   *   Login unblock code.
   * @return {Promise} A promise that will be fulfilled with JSON `xhr.responseText` of the request
   */
  FxAccountClient.prototype.signIn = function (email, password, options) {
    var self = this;
    options = options || {};

    return P()
      .then(function () {
        required(email, 'email');
        required(password, 'password');

        return credentials.setup(email, password);
      })
      .then(
        function (result) {
          var endpoint = '/account/login';

          if (options.keys) {
            endpoint += '?keys=true';
          }

          var data = {
            email: result.emailUTF8,
            authPW: sjcl.codec.hex.fromBits(result.authPW)
          };

          if (options.metricsContext) {
            data.metricsContext = metricsContext.marshall(options.metricsContext);
          }

          if (options.reason) {
            data.reason = options.reason;
          }

          if (options.redirectTo) {
            data.redirectTo = options.redirectTo;
          }

          if (options.resume) {
            data.resume = options.resume;
          }

          if (options.service) {
            data.service = options.service;
          }

          if (options.unblockCode) {
            data.unblockCode = options.unblockCode;
          }

          return self.request.send(endpoint, 'POST', null, data)
            .then(
              function(accountData) {
                if (options.keys) {
                  accountData.unwrapBKey = sjcl.codec.hex.fromBits(result.unwrapBKey);
                }
                return accountData;
              },
              function(error) {
                if (error && error.email && error.errno === ERRORS.INCORRECT_EMAIL_CASE && !options.skipCaseError) {
                  options.skipCaseError = true;

                  return self.signIn(error.email, password, options);
                } else {
                  throw error;
                }
              }
            );
        }
      );
  };

  /**
   * @method verifyCode
   * @param {String} uid Account ID
   * @param {String} code Verification code
   * @param {Object} [options={}] Options
   *   @param {String} [options.service]
   *   Service being signed into
   *   @param {String} [options.reminder]
   *   Reminder that was used to verify the account
   *   @param {String} [options.type]
   *   Type of code being verified, only supports `secondary` otherwise will verify account/sign-in
   *   @param {Boolean} [options.marketingOptIn]
   *   If `true`, notifies marketing of opt-in intent.
   * @return {Promise} A promise that will be fulfilled with JSON `xhr.responseText` of the request
   */
  FxAccountClient.prototype.verifyCode = function(uid, code, options) {
    var self = this;

    return P()
      .then(function () {
        required(uid, 'uid');
        required(code, 'verify code');

        var data = {
          uid: uid,
          code: code
        };

        if (options) {
          if (options.service) {
            data.service = options.service;
          }

          if (options.reminder) {
            data.reminder = options.reminder;
          }

          if (options.type) {
            data.type = options.type;
          }

          if (options.marketingOptIn) {
            data.marketingOptIn = true;
          }
        }

        return self.request.send('/recovery_email/verify_code', 'POST', null, data);
      });
  };

  /**
   * @method recoveryEmailStatus
   * @param {String} sessionToken sessionToken obtained from signIn
   * @return {Promise} A promise that will be fulfilled with JSON `xhr.responseText` of the request
   */
  FxAccountClient.prototype.recoveryEmailStatus = function(sessionToken) {
    var self = this;

    return P()
      .then(function () {
        required(sessionToken, 'sessionToken');

        return hawkCredentials(sessionToken, 'sessionToken',  HKDF_SIZE);
      })
      .then(function(creds) {
        return self.request.send('/recovery_email/status', 'GET', creds);
      });
  };

  /**
   * Re-sends a verification code to the account's recovery email address.
   *
   * @method recoveryEmailResendCode
   * @param {String} sessionToken sessionToken obtained from signIn
   * @param {Object} [options={}] Options
   *   @param {String} [options.email]
   *   Code will be resent to this email, only used for secondary email codes
   *   @param {String} [options.service]
   *   Opaque alphanumeric token to be included in verification links
   *   @param {String} [options.redirectTo]
   *   a URL that the client should be redirected to after handling the request
   *   @param {String} [options.resume]
   *   Opaque url-encoded string that will be included in the verification link
   *   as a querystring parameter, useful for continuing an OAuth flow for
   *   example.
   *   @param {String} [options.lang]
   *   set the language for the 'Accept-Language' header
   * @return {Promise} A promise that will be fulfilled with JSON `xhr.responseText` of the request
   */
  FxAccountClient.prototype.recoveryEmailResendCode = function(sessionToken, options) {
    var self = this;
    var data = {};
    var requestOpts = {};

    return P()
      .then(function () {
        required(sessionToken, 'sessionToken');

        if (options) {
          if (options.email) {
            data.email = options.email;
          }

          if (options.service) {
            data.service = options.service;
          }

          if (options.redirectTo) {
            data.redirectTo = options.redirectTo;
          }

          if (options.resume) {
            data.resume = options.resume;
          }

          if (options.lang) {
            requestOpts.headers = {
              'Accept-Language': options.lang
            };
          }
        }

        return hawkCredentials(sessionToken, 'sessionToken',  HKDF_SIZE);
      })
      .then(function(creds) {
        return self.request.send('/recovery_email/resend_code', 'POST', creds, data, requestOpts);
      });
  };

  /**
   * Used to ask the server to send a recovery code.
   * The API returns passwordForgotToken to the client.
   *
   * @method passwordForgotSendCode
   * @param {String} email
   * @param {Object} [options={}] Options
   *   @param {String} [options.service]
   *   Opaque alphanumeric token to be included in verification links
   *   @param {String} [options.redirectTo]
   *   a URL that the client should be redirected to after handling the request
   *   @param {String} [options.resume]
   *   Opaque url-encoded string that will be included in the verification link
   *   as a querystring parameter, useful for continuing an OAuth flow for
   *   example.
   *   @param {String} [options.lang]
   *   set the language for the 'Accept-Language' header
   *   @param {Object} [options.metricsContext={}] Metrics context metadata
   *     @param {String} options.metricsContext.flowId identifier for the current event flow
   *     @param {Number} options.metricsContext.flowBeginTime flow.begin event time
   * @return {Promise} A promise that will be fulfilled with JSON `xhr.responseText` of the request
   */
  FxAccountClient.prototype.passwordForgotSendCode = function(email, options) {
    var self = this;
    var data = {
      email: email
    };
    var requestOpts = {};

    return P()
      .then(function () {
        required(email, 'email');

        if (options) {
          if (options.service) {
            data.service = options.service;
          }

          if (options.redirectTo) {
            data.redirectTo = options.redirectTo;
          }

          if (options.resume) {
            data.resume = options.resume;
          }

          if (options.lang) {
            requestOpts.headers = {
              'Accept-Language': options.lang
            };
          }

          if (options.metricsContext) {
            data.metricsContext = metricsContext.marshall(options.metricsContext);
          }
        }

        return self.request.send('/password/forgot/send_code', 'POST', null, data, requestOpts);
      });
  };

  /**
   * Re-sends a verification code to the account's recovery email address.
   * HAWK-authenticated with the passwordForgotToken.
   *
   * @method passwordForgotResendCode
   * @param {String} email
   * @param {String} passwordForgotToken
   * @param {Object} [options={}] Options
   *   @param {String} [options.service]
   *   Opaque alphanumeric token to be included in verification links
   *   @param {String} [options.redirectTo]
   *   a URL that the client should be redirected to after handling the request
   *   @param {String} [options.resume]
   *   Opaque url-encoded string that will be included in the verification link
   *   as a querystring parameter, useful for continuing an OAuth flow for
   *   example.
   *   @param {String} [options.lang]
   *   set the language for the 'Accept-Language' header
   *   @param {Object} [options.metricsContext={}] Metrics context metadata
   *     @param {String} options.metricsContext.flowId identifier for the current event flow
   *     @param {Number} options.metricsContext.flowBeginTime flow.begin event time
   * @return {Promise} A promise that will be fulfilled with JSON `xhr.responseText` of the request
   */
  FxAccountClient.prototype.passwordForgotResendCode = function(email, passwordForgotToken, options) {
    var self = this;
    var data = {
      email: email
    };
    var requestOpts = {};

    return P()
      .then(function () {
        required(email, 'email');
        required(passwordForgotToken, 'passwordForgotToken');

        if (options) {
          if (options.service) {
            data.service = options.service;
          }

          if (options.redirectTo) {
            data.redirectTo = options.redirectTo;
          }

          if (options.resume) {
            data.resume = options.resume;
          }

          if (options.lang) {
            requestOpts.headers = {
              'Accept-Language': options.lang
            };
          }

          if (options.metricsContext) {
            data.metricsContext = metricsContext.marshall(options.metricsContext);
          }
        }

        return hawkCredentials(passwordForgotToken, 'passwordForgotToken',  HKDF_SIZE);
      })
      .then(function(creds) {
        return self.request.send('/password/forgot/resend_code', 'POST', creds, data, requestOpts);
      });
  };

  /**
   * Submits the verification token to the server.
   * The API returns accountResetToken to the client.
   * HAWK-authenticated with the passwordForgotToken.
   *
   * @method passwordForgotVerifyCode
   * @param {String} code
   * @param {String} passwordForgotToken
   * @param {Object} [options.metricsContext={}] Metrics context metadata
   *     @param {String} options.metricsContext.flowId identifier for the current event flow
   *     @param {Number} options.metricsContext.flowBeginTime flow.begin event time
   * @return {Promise} A promise that will be fulfilled with JSON `xhr.responseText` of the request
   */
  FxAccountClient.prototype.passwordForgotVerifyCode = function(code, passwordForgotToken, options) {
    var self = this;

    return P()
      .then(function () {
        required(code, 'reset code');
        required(passwordForgotToken, 'passwordForgotToken');

        return hawkCredentials(passwordForgotToken, 'passwordForgotToken',  HKDF_SIZE);
      })
      .then(function(creds) {
        var data = {
          code: code
        };

        if (options && options.metricsContext) {
          data.metricsContext = metricsContext.marshall(options.metricsContext);
        }

        return self.request.send('/password/forgot/verify_code', 'POST', creds, data);
      });
  };

  /**
   * Returns the status for the passwordForgotToken.
   * If the request returns a success response, the token has not yet been consumed.

   * @method passwordForgotStatus
   * @param {String} passwordForgotToken
   * @return {Promise} A promise that will be fulfilled with JSON `xhr.responseText` of the request
   */
  FxAccountClient.prototype.passwordForgotStatus = function(passwordForgotToken) {
    var self = this;

    return P()
      .then(function () {
        required(passwordForgotToken, 'passwordForgotToken');

        return hawkCredentials(passwordForgotToken, 'passwordForgotToken',  HKDF_SIZE);
      })
      .then(function(creds) {
        return self.request.send('/password/forgot/status', 'GET', creds);
      });
  };

  /**
   * The API returns reset result to the client.
   * HAWK-authenticated with accountResetToken
   *
   * @method accountReset
   * @param {String} email
   * @param {String} newPassword
   * @param {String} accountResetToken
   * @param {Object} [options={}] Options
   *   @param {Boolean} [options.keys]
   *   If `true`, a new `keyFetchToken` is provisioned. `options.sessionToken`
   *   is required if `options.keys` is true.
   *   @param {Boolean} [options.sessionToken]
   *   If `true`, a new `sessionToken` is provisioned.
   *   @param {Object} [options.metricsContext={}] Metrics context metadata
   *     @param {String} options.metricsContext.flowId identifier for the current event flow
   *     @param {Number} options.metricsContext.flowBeginTime flow.begin event time
   * @return {Promise} A promise that will be fulfilled with JSON `xhr.responseText` of the request
   */
  FxAccountClient.prototype.accountReset = function(email, newPassword, accountResetToken, options) {
    var self = this;
    var data = {};
    var unwrapBKey;

    options = options || {};

    if (options.sessionToken) {
      data.sessionToken = options.sessionToken;
    }

    if (options.metricsContext) {
      data.metricsContext = metricsContext.marshall(options.metricsContext);
    }

    return P()
      .then(function () {
        required(email, 'email');
        required(newPassword, 'new password');
        required(accountResetToken, 'accountResetToken');

        if (options.keys) {
          required(options.sessionToken, 'sessionToken');
        }

        return credentials.setup(email, newPassword);
      })
      .then(
        function (result) {
          if (options.keys) {
            unwrapBKey = sjcl.codec.hex.fromBits(result.unwrapBKey);
          }

          data.authPW = sjcl.codec.hex.fromBits(result.authPW);

          return hawkCredentials(accountResetToken, 'accountResetToken',  HKDF_SIZE);
        }
      ).then(
        function (creds) {
          var queryParams = '';
          if (options.keys) {
            queryParams = '?keys=true';
          }

          var endpoint = '/account/reset' + queryParams;
          return self.request.send(endpoint, 'POST', creds, data)
            .then(
              function(accountData) {
                if (options.keys && accountData.keyFetchToken) {
                  accountData.unwrapBKey = unwrapBKey;
                }

                return accountData;
              }
            );
        }
      );
  };

  /**
   * Get the base16 bundle of encrypted kA|wrapKb.
   *
   * @method accountKeys
   * @param {String} keyFetchToken
   * @param {String} oldUnwrapBKey
   * @return {Promise} A promise that will be fulfilled with JSON of {kA, kB}  of the key bundle
   */
  FxAccountClient.prototype.accountKeys = function(keyFetchToken, oldUnwrapBKey) {
    var self = this;

    return P()
      .then(function () {
        required(keyFetchToken, 'keyFetchToken');
        required(oldUnwrapBKey, 'oldUnwrapBKey');

        return hawkCredentials(keyFetchToken, 'keyFetchToken',  3 * 32);
      })
      .then(function(creds) {
        var bundleKey = sjcl.codec.hex.fromBits(creds.bundleKey);

        return self.request.send('/account/keys', 'GET', creds)
          .then(
            function(payload) {

              return credentials.unbundleKeyFetchResponse(bundleKey, payload.bundle);
            });
      })
      .then(function(keys) {
        return {
          kB: sjcl.codec.hex.fromBits(
            credentials.xor(
              sjcl.codec.hex.toBits(keys.wrapKB),
              sjcl.codec.hex.toBits(oldUnwrapBKey)
            )
          ),
          kA: keys.kA
        };
      });
  };

  /**
   * This deletes the account completely. All stored data is erased.
   *
   * @method accountDestroy
   * @param {String} email Email input
   * @param {String} password Password input
   * @param {Object} [options={}] Options
   *   @param {Boolean} [options.skipCaseError]
   *   If `true`, the request will skip the incorrect case error
   * @return {Promise} A promise that will be fulfilled with JSON `xhr.responseText` of the request
   */
  FxAccountClient.prototype.accountDestroy = function(email, password, options) {
    var self = this;
    options = options || {};

    return P()
      .then(function () {
        required(email, 'email');
        required(password, 'password');

        return credentials.setup(email, password);
      })
      .then(
        function (result) {
          var data = {
            email: result.emailUTF8,
            authPW: sjcl.codec.hex.fromBits(result.authPW)
          };

          return self.request.send('/account/destroy', 'POST', null, data)
            .then(
              function(response) {
                return response;
              },
              function(error) {
                // if incorrect email case error
                if (error && error.email && error.errno === ERRORS.INCORRECT_EMAIL_CASE && !options.skipCaseError) {
                  options.skipCaseError = true;

                  return self.accountDestroy(error.email, password, options);
                } else {
                  throw error;
                }
              }
            );
        }
      );
  };

  /**
   * Gets the status of an account by uid.
   *
   * @method accountStatus
   * @param {String} uid User account id
   * @return {Promise} A promise that will be fulfilled with JSON `xhr.responseText` of the request
   */
  FxAccountClient.prototype.accountStatus = function(uid) {
    var self = this;

    return P()
      .then(function () {
        required(uid, 'uid');

        return self.request.send('/account/status?uid=' + uid, 'GET');
      });
  };

  /**
   * Gets the status of an account by email.
   *
   * @method accountStatusByEmail
   * @param {String} email User account email
   * @return {Promise} A promise that will be fulfilled with JSON `xhr.responseText` of the request
   */
  FxAccountClient.prototype.accountStatusByEmail = function(email) {
    var self = this;

    return P()
      .then(function () {
        required(email, 'email');

        return self.request.send('/account/status', 'POST', null, {email: email});
      });
  };

  /**
   * Destroys this session, by invalidating the sessionToken.
   *
   * @method sessionDestroy
   * @param {String} sessionToken User session token
   * @param {Object} [options={}] Options
   *   @param {String} [options.customSessionToken] Override which session token to destroy for this same user
   * @return {Promise} A promise that will be fulfilled with JSON `xhr.responseText` of the request
   */
  FxAccountClient.prototype.sessionDestroy = function(sessionToken, options) {
    var self = this;
    var data = {};
    options = options || {};

    if (options.customSessionToken) {
      data.customSessionToken = options.customSessionToken;
    }

    return P()
      .then(function () {
        required(sessionToken, 'sessionToken');

        return hawkCredentials(sessionToken, 'sessionToken',  HKDF_SIZE);
      })
      .then(function(creds) {
        return self.request.send('/session/destroy', 'POST', creds, data);
      });
  };

  /**
   * Responds successfully if the session status is valid, requires the sessionToken.
   *
   * @method sessionStatus
   * @param {String} sessionToken User session token
   * @return {Promise} A promise that will be fulfilled with JSON `xhr.responseText` of the request
   */
  FxAccountClient.prototype.sessionStatus = function(sessionToken) {
    var self = this;

    return P()
      .then(function () {
        required(sessionToken, 'sessionToken');

        return hawkCredentials(sessionToken, 'sessionToken',  HKDF_SIZE);
      })
      .then(function(creds) {
        return self.request.send('/session/status', 'GET', creds);
      });
  };

  /**
   * Sign a BrowserID public key
   *
   * @method certificateSign
   * @param {String} sessionToken User session token
   * @param {Object} publicKey The key to sign
   * @param {int} duration Time interval from now when the certificate will expire in milliseconds
   * @param {Object} [options={}] Options
   *   @param {String} [service=''] The requesting service, sent via the query string
   * @return {Promise} A promise that will be fulfilled with JSON `xhr.responseText` of the request
   */
  FxAccountClient.prototype.certificateSign = function(sessionToken, publicKey, duration, options) {
    var self = this;
    var data = {
      publicKey: publicKey,
      duration: duration
    };

    return P()
      .then(function () {
        required(sessionToken, 'sessionToken');
        required(publicKey, 'publicKey');
        required(duration, 'duration');

        return hawkCredentials(sessionToken, 'sessionToken',  HKDF_SIZE);
      })
      .then(function(creds) {
        options = options || {};

        var queryString = '';
        if (options.service) {
          queryString = '?service=' + encodeURIComponent(options.service);
        }

        return self.request.send('/certificate/sign' + queryString, 'POST', creds, data);
      });
  };

  /**
   * Change the password from one known value to another.
   *
   * @method passwordChange
   * @param {String} email
   * @param {String} oldPassword
   * @param {String} newPassword
   * @param {Object} [options={}] Options
   *   @param {Boolean} [options.keys]
   *   If `true`, calls the API with `?keys=true` to get a new keyFetchToken
   *   @param {String} [options.sessionToken]
   *   If a `sessionToken` is passed, a new sessionToken will be returned
   *   with the same `verified` status as the existing sessionToken.
   * @return {Promise} A promise that will be fulfilled with JSON `xhr.responseText` of the request
   */
  FxAccountClient.prototype.passwordChange = function(email, oldPassword, newPassword, options) {
    var self = this;
    options = options || {};

    return P()
      .then(function () {
        required(email, 'email');
        required(oldPassword, 'old password');
        required(newPassword, 'new password');

        return self._passwordChangeStart(email, oldPassword);
      })
      .then(function (credentials) {

        var oldCreds = credentials;

        return self._passwordChangeKeys(oldCreds)
          .then(function (keys) {

            return self._passwordChangeFinish(email, newPassword, oldCreds, keys, options);
          });
      });

  };

  /**
   * First step to change the password.
   *
   * @method passwordChangeStart
   * @private
   * @param {String} email
   * @param {String} oldPassword
   * @param {Object} [options={}] Options
   *   @param {Boolean} [options.skipCaseError]
   *   If `true`, the request will skip the incorrect case error
   * @return {Promise} A promise that will be fulfilled with JSON of `xhr.responseText` and `oldUnwrapBKey`
   */
  FxAccountClient.prototype._passwordChangeStart = function(email, oldPassword, options) {
    var self = this;
    options = options || {};

    return P()
      .then(function () {
        required(email, 'email');
        required(oldPassword, 'old password');

        return credentials.setup(email, oldPassword);
      })
      .then(function (oldCreds) {
        var data = {
          email: oldCreds.emailUTF8,
          oldAuthPW: sjcl.codec.hex.fromBits(oldCreds.authPW)
        };

        return self.request.send('/password/change/start', 'POST', null, data)
          .then(
            function(passwordData) {
              passwordData.oldUnwrapBKey = sjcl.codec.hex.fromBits(oldCreds.unwrapBKey);
              return passwordData;
            },
            function(error) {
              // if incorrect email case error
              if (error && error.email && error.errno === ERRORS.INCORRECT_EMAIL_CASE && !options.skipCaseError) {
                options.skipCaseError = true;

                return self._passwordChangeStart(error.email, oldPassword, options);
              } else {
                throw error;
              }
            }
          );
      });
  };

  function checkCreds(creds) {
    required(creds, 'credentials');
    required(creds.oldUnwrapBKey, 'credentials.oldUnwrapBKey');
    required(creds.keyFetchToken, 'credentials.keyFetchToken');
    required(creds.passwordChangeToken, 'credentials.passwordChangeToken');
  }

  /**
   * Second step to change the password.
   *
   * @method _passwordChangeKeys
   * @private
   * @param {Object} oldCreds This object should consists of `oldUnwrapBKey`, `keyFetchToken` and `passwordChangeToken`.
   * @return {Promise} A promise that will be fulfilled with JSON of `xhr.responseText`
   */
  FxAccountClient.prototype._passwordChangeKeys = function(oldCreds) {
    var self = this;

    return P()
      .then(function () {
        checkCreds(oldCreds);
      })
      .then(function () {
        return self.accountKeys(oldCreds.keyFetchToken, oldCreds.oldUnwrapBKey);
      });
  };

  /**
   * Third step to change the password.
   *
   * @method _passwordChangeFinish
   * @private
   * @param {String} email
   * @param {String} newPassword
   * @param {Object} oldCreds This object should consists of `oldUnwrapBKey`, `keyFetchToken` and `passwordChangeToken`.
   * @param {Object} keys This object should contain the unbundled keys
   * @param {Object} [options={}] Options
   *   @param {Boolean} [options.keys]
   *   If `true`, calls the API with `?keys=true` to get the keyFetchToken
   *   @param {String} [options.sessionToken]
   *   If a `sessionToken` is passed, a new sessionToken will be returned
   *   with the same `verified` status as the existing sessionToken.
   * @return {Promise} A promise that will be fulfilled with JSON of `xhr.responseText`
   */
  FxAccountClient.prototype._passwordChangeFinish = function(email, newPassword, oldCreds, keys, options) {
    options = options || {};
    var self = this;

    return P()
      .then(function () {
        required(email, 'email');
        required(newPassword, 'new password');
        checkCreds(oldCreds);
        required(keys, 'keys');
        required(keys.kB, 'keys.kB');

        var defers = [];
        defers.push(credentials.setup(email, newPassword));
        defers.push(hawkCredentials(oldCreds.passwordChangeToken, 'passwordChangeToken',  HKDF_SIZE));

        if (options.sessionToken) {
          // Unbundle session data to get session id
          defers.push(hawkCredentials(options.sessionToken, 'sessionToken',  HKDF_SIZE));
        }

        return P.all(defers);
      })
      .spread(function (newCreds, hawkCreds, sessionData) {
        var newWrapKb = sjcl.codec.hex.fromBits(
          credentials.xor(
            sjcl.codec.hex.toBits(keys.kB),
            newCreds.unwrapBKey
          )
        );

        var queryParams = '';
        if (options.keys) {
          queryParams = '?keys=true';
        }

        var sessionTokenId;
        if (sessionData && sessionData.id) {
          sessionTokenId = sessionData.id;
        }

        return self.request.send('/password/change/finish' + queryParams, 'POST', hawkCreds, {
          wrapKb: newWrapKb,
          authPW: sjcl.codec.hex.fromBits(newCreds.authPW),
          sessionToken: sessionTokenId
        })
        .then(function (accountData) {
          if (options.keys && accountData.keyFetchToken) {
            accountData.unwrapBKey = sjcl.codec.hex.fromBits(newCreds.unwrapBKey);
          }
          return accountData;
        });
      });
  };

  /**
   * Get 32 bytes of random data. This should be combined with locally-sourced entropy when creating salts, etc.
   *
   * @method getRandomBytes
   * @return {Promise} A promise that will be fulfilled with JSON `xhr.responseText` of the request
   */
  FxAccountClient.prototype.getRandomBytes = function() {

    return this.request.send('/get_random_bytes', 'POST');
  };

  /**
   * Add a new device
   *
   * @method deviceRegister
   * @param {String} sessionToken User session token
   * @param {String} deviceName Name of device
   * @param {String} deviceType Type of device (mobile|desktop)
   * @param {Object} [options={}] Options
   *   @param {string} [options.deviceCallback] Device's push endpoint.
   *   @param {string} [options.devicePublicKey] Public key used to encrypt push messages.
   *   @param {string} [options.deviceAuthKey] Authentication secret used to encrypt push messages.
   * @return {Promise} A promise that will be fulfilled with JSON `xhr.responseText` of the request
   */
  FxAccountClient.prototype.deviceRegister = function (sessionToken, deviceName, deviceType, options) {
    var request = this.request;
    options = options || {};

    return P()
      .then(function () {
        required(sessionToken, 'sessionToken');
        required(deviceName, 'deviceName');
        required(deviceType, 'deviceType');

        return hawkCredentials(sessionToken, 'sessionToken',  HKDF_SIZE);
      })
      .then(function(creds) {
        var data = {
          name: deviceName,
          type: deviceType
        };

        if (options.deviceCallback) {
          data.pushCallback = options.deviceCallback;
        }

        if (options.devicePublicKey && options.deviceAuthKey) {
          data.pushPublicKey = options.devicePublicKey;
          data.pushAuthKey = options.deviceAuthKey;
        }

        return request.send('/account/device', 'POST', creds, data);
      });
  };

  /**
   * Update the name of an existing device
   *
   * @method deviceUpdate
   * @param {String} sessionToken User session token
   * @param {String} deviceId User-unique identifier of device
   * @param {String} deviceName Name of device
   * @param {Object} [options={}] Options
   *   @param {string} [options.deviceCallback] Device's push endpoint.
   *   @param {string} [options.devicePublicKey] Public key used to encrypt push messages.
   *   @param {string} [options.deviceAuthKey] Authentication secret used to encrypt push messages.
   * @return {Promise} A promise that will be fulfilled with JSON `xhr.responseText` of the request
   */
  FxAccountClient.prototype.deviceUpdate = function (sessionToken, deviceId, deviceName, options) {
    var request = this.request;
    options = options || {};

    return P()
      .then(function () {
        required(sessionToken, 'sessionToken');
        required(deviceId, 'deviceId');
        required(deviceName, 'deviceName');

        return hawkCredentials(sessionToken, 'sessionToken',  HKDF_SIZE);
      })
      .then(function(creds) {
        var data = {
          id: deviceId,
          name: deviceName
        };

        if (options.deviceCallback) {
          data.pushCallback = options.deviceCallback;
        }

        if (options.devicePublicKey && options.deviceAuthKey) {
          data.pushPublicKey = options.devicePublicKey;
          data.pushAuthKey = options.deviceAuthKey;
        }

        return request.send('/account/device', 'POST', creds, data);
      });
  };

  /**
   * Unregister an existing device
   *
   * @method deviceDestroy
   * @param {String} sessionToken Session token obtained from signIn
   * @param {String} deviceId User-unique identifier of device
   * @return {Promise} A promise that will be fulfilled with JSON `xhr.responseText` of the request
   */
  FxAccountClient.prototype.deviceDestroy = function (sessionToken, deviceId) {
    var request = this.request;

    return P()
      .then(function () {
        required(sessionToken, 'sessionToken');
        required(deviceId, 'deviceId');

        return hawkCredentials(sessionToken, 'sessionToken',  HKDF_SIZE);
      })
      .then(function(creds) {
        var data = {
          id: deviceId
        };

        return request.send('/account/device/destroy', 'POST', creds, data);
      });
  };

  /**
   * Get a list of all devices for a user
   *
   * @method deviceList
   * @param {String} sessionToken sessionToken obtained from signIn
   * @return {Promise} A promise that will be fulfilled with JSON `xhr.responseText` of the request
   */
  FxAccountClient.prototype.deviceList = function (sessionToken) {
    var request = this.request;

    return P()
      .then(function () {
        required(sessionToken, 'sessionToken');

        return hawkCredentials(sessionToken, 'sessionToken',  HKDF_SIZE);
      })
      .then(function(creds) {
        return request.send('/account/devices', 'GET', creds);
      });
  };

  /**
   * Get a list of user's sessions
   *
   * @method sessions
   * @param {String} sessionToken sessionToken obtained from signIn
   * @return {Promise} A promise that will be fulfilled with JSON `xhr.responseText` of the request
   */
  FxAccountClient.prototype.sessions = function (sessionToken) {
    var request = this.request;

    return P()
      .then(function () {
        required(sessionToken, 'sessionToken');

        return hawkCredentials(sessionToken, 'sessionToken',  HKDF_SIZE);
      })
      .then(function(creds) {
        return request.send('/account/sessions', 'GET', creds);
      });
  };

  /**
   * Send an unblock code
   *
   * @method sendUnblockCode
   * @param {String} email email where to send the login authorization code
   * @param {Object} [options={}] Options
   *   @param {Object} [options.metricsContext={}] Metrics context metadata
   *     @param {String} options.metricsContext.flowId identifier for the current event flow
   *     @param {Number} options.metricsContext.flowBeginTime flow.begin event time
   * @return {Promise} A promise that will be fulfilled with JSON `xhr.responseText` of the request
   */
  FxAccountClient.prototype.sendUnblockCode = function (email, options) {
    var self = this;

    return P()
      .then(function () {
        required(email, 'email');

        var data = {
          email: email
        };

        if (options && options.metricsContext) {
          data.metricsContext = metricsContext.marshall(options.metricsContext);
        }

        return self.request.send('/account/login/send_unblock_code', 'POST', null, data);
      });
  };

  /**
   * Reject a login unblock code. Code will be deleted from the server
   * and will not be able to be used again.
   *
   * @method rejectLoginAuthorizationCode
   * @param {String} uid Account ID
   * @param {String} unblockCode unblock code
   * @return {Promise} A promise that will be fulfilled with JSON `xhr.responseText` of the request
   */
  FxAccountClient.prototype.rejectUnblockCode = function (uid, unblockCode) {
    var self = this;

    return P()
      .then(function () {
        required(uid, 'uid');
        required(unblockCode, 'unblockCode');

        var data = {
          uid: uid,
          unblockCode: unblockCode
        };

        return self.request.send('/account/login/reject_unblock_code', 'POST', null, data);
      });
  };

  /**
   * Send an sms.
   *
   * @method sendSms
   * @param {String} sessionToken SessionToken obtained from signIn
   * @param {String} phoneNumber Phone number sms will be sent to
   * @param {String} messageId Corresponding message id that will be sent
   * @param {Object} [options={}] Options
   *   @param {String} [options.lang] Language that sms will be sent in
   *   @param {Array} [options.features] Array of features to be enabled for the request
   *   @param {Object} [options.metricsContext={}] Metrics context metadata
   *     @param {String} options.metricsContext.flowId identifier for the current event flow
   *     @param {Number} options.metricsContext.flowBeginTime flow.begin event time
   */
  FxAccountClient.prototype.sendSms = function (sessionToken, phoneNumber, messageId, options) {
    var request = this.request;

    return P()
      .then(function () {
        required(sessionToken, 'sessionToken');
        required(phoneNumber, 'phoneNumber');
        required(messageId, 'messageId');

        return hawkCredentials(sessionToken, 'sessionToken',  HKDF_SIZE);
      })
      .then(function(creds) {
        var data = {
          phoneNumber: phoneNumber,
          messageId: messageId
        };
        var requestOpts = {};

        if (options) {
          if (options.lang) {
            requestOpts.headers = {
              'Accept-Language': options.lang
            };
          }

          if (options.features) {
            data.features = options.features;
          }

          if (options.metricsContext) {
            data.metricsContext = metricsContext.marshall(options.metricsContext);
          }
        }

        return request.send('/sms', 'POST', creds, data, requestOpts);
      });
  };

  /**
   * Get SMS status for the current user.
   *
   * @method smsStatus
   * @param {String} sessionToken SessionToken obtained from signIn
   * @param {Object} [options={}] Options
   *   @param {String} [options.country] country Country to force for testing.
   */
  FxAccountClient.prototype.smsStatus = function (sessionToken, options) {
    var request = this.request;
    options = options || {};

    return P()
      .then(function () {
        required(sessionToken, 'sessionToken');

        return hawkCredentials(sessionToken, 'sessionToken',  HKDF_SIZE);
      })
      .then(function (creds) {
        var url = '/sms/status';
        if (options.country) {
          url += '?country=' + encodeURIComponent(options.country);
        }
        return request.send(url, 'GET', creds);
      });
  };

  /**
   * Consume a signinCode.
   *
   * @method consumeSigninCode
   * @param {String} code The signinCode entered by the user
   * @param {String} flowId Identifier for the current event flow
   * @param {Number} flowBeginTime Timestamp for the flow.begin event
   */
  FxAccountClient.prototype.consumeSigninCode = function (code, flowId, flowBeginTime) {
    var self = this;

    return P()
      .then(function () {
        required(code, 'code');
        required(flowId, 'flowId');
        required(flowBeginTime, 'flowBeginTime');

        return self.request.send('/signinCodes/consume', 'POST', null, {
          code: code,
          metricsContext: {
            flowId: flowId,
            flowBeginTime: flowBeginTime
          }
        });
      });
  };

  /**
   * Get the recovery emails associated with the signed in account.
   *
   * @method recoveryEmails
   * @param {String} sessionToken SessionToken obtained from signIn
   */
  FxAccountClient.prototype.recoveryEmails = function (sessionToken) {
    var request = this.request;

    return P()
      .then(function () {
        required(sessionToken, 'sessionToken');

        return hawkCredentials(sessionToken, 'sessionToken',  HKDF_SIZE);
      })
      .then(function(creds) {
        return request.send('/recovery_emails', 'GET', creds);
      });
  };

  /**
   * Create a new recovery email for the signed in account.
   *
   * @method recoveryEmailCreate
   * @param {String} sessionToken SessionToken obtained from signIn
   * @param {String} email new email to be added
   */
  FxAccountClient.prototype.recoveryEmailCreate = function (sessionToken, email) {
    var request = this.request;

    return P()
      .then(function () {
        required(sessionToken, 'sessionToken');
        required(sessionToken, 'email');

        return hawkCredentials(sessionToken, 'sessionToken',  HKDF_SIZE);
      })
      .then(function(creds) {
        var data = {
          email: email
        };

        return request.send('/recovery_email', 'POST', creds, data);
      });
  };

  /**
   * Remove the recovery email for the signed in account.
   *
   * @method recoveryEmailDestroy
   * @param {String} sessionToken SessionToken obtained from signIn
   * @param {String} email email to be removed
   */
  FxAccountClient.prototype.recoveryEmailDestroy = function (sessionToken, email) {
    var request = this.request;

    return P()
      .then(function () {
        required(sessionToken, 'sessionToken');
        required(sessionToken, 'email');

        return hawkCredentials(sessionToken, 'sessionToken',  HKDF_SIZE);
      })
      .then(function(creds) {
        var data = {
          email: email
        };

        return request.send('/recovery_email/destroy', 'POST', creds, data);
      });
  };

  /**
   * Check to see if the secondary email feature is enabled for this user.
   *
   * @method recoveryEmailSecondaryEmailEnabled
   * @param {String} sessionToken SessionToken obtained from signIn
   */
  FxAccountClient.prototype.recoveryEmailSecondaryEmailEnabled = function (sessionToken) {
    var request = this.request;

    return P()
      .then(function () {
        required(sessionToken, 'sessionToken');

        return hawkCredentials(sessionToken, 'sessionToken',  HKDF_SIZE);
      })
      .then(function(creds) {
        return request.send('/recovery_email/check_can_add_secondary_address', 'GET', creds);
      });
  };

  /**
   * Check for a required argument. Exposed for unit testing.
   *
   * @param {Value} val - value to check
   * @param {String} name - name of value
   * @throws {Error} if argument is falsey, or an empty object
   */
  FxAccountClient.prototype._required = required;

  return FxAccountClient;
});

    //The modules for your project will be inlined above
    //this snippet. Ask almond to synchronously require the
    //module value for 'main' here and return it as the
    //value to use for the public API for the built file.
    return requirejs('client/FxAccountClient');
}));
