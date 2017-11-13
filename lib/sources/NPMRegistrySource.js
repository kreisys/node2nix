var path = require('path');
var child_process = require('child_process');
var slasp = require('slasp');
var semver = require('semver');
var nijs = require('nijs');
var base64js = require('base64-js');
var RegClient = require('npm-registry-client');
var Source = require('./Source.js').Source;
var inherit = require('nijs/lib/ast/util/inherit.js').inherit;
var npm = require('npm');
var getAuthToken = require('registry-auth-token');
var getRegistryUrl = require('registry-auth-token/registry-url');

var client;

/* Initialize client on first startup or return the existing one */

function initClient(callback) {
    if(client === undefined) {
        slasp.sequence([
            function(callback) {
                /* Load NPM's configuration */
                npm.load(callback);
            },

            function(callback, config) {
                client = new RegClient(config);
                callback(null, client);
            }
        ], callback)
    } else {
        callback(null, client);
    }
}

/**
 * Constructs a new NPMRegistrySource instance.
 *
 * @class NPMRegistrySource
 * @extends Source
 * @classdesc Represents a dependency source that is obtained from the metadata of a package in the NPM registry
 *
 * @constructor
 * @param {String} baseDir Directory in which the referrer's package.json configuration resides
 * @param {String} dependencyName Name of the dependency
 * @param {String} versionSpec Version specifier of the Node.js package to fetch
 * @param {String} registryURL URL of the NPM registry
 */
function NPMRegistrySource(baseDir, dependencyName, versionSpec, registryURL) {
    Source.call(this, baseDir, versionSpec);
    this.dependencyName = dependencyName;
    this.registryURL = registryURL;
    this.baseDir = path.join(baseDir, dependencyName);
}

/* NPMRegistrySource inherits from Source */
inherit(Source, NPMRegistrySource);

/**
 * @see Source#fetch
 */
NPMRegistrySource.prototype.fetch = function(callback) {
    var self = this;

    if(self.versionSpec == "") // An empty versionSpec translates to *
        self.versionSpec = "*";

    slasp.sequence([
        initClient,

        function(callback, client) {
            /* Fetch package.json from the registry using the dependency name and version specification */
            //const npmConfigReversed = Object.assign.apply(Object, npm.config.list.reverse());
            const npmrc = Object.assign.apply(Object, npm.config.list.reverse());
            const registryUrl = getRegistryUrl(self.dependencyName, npmrc);
            const url = registryUrl + self.dependencyName.replace("/", "%2F"); // Escape / to make scoped packages work
            const auth = getAuthToken(url, npmrc);


            client.get(url, {auth}, function(err, data, raw, res) {
                if(err) {
                    callback(err);
                } else if(data == undefined || data.versions === undefined) {
                    callback("Error fetching package: " + self.dependencyName + " from NPM registry!");
                } else {
                    callback(null, data);
                }
            });
        },

        function(callback, result) {
            /* Fetch the right version (and corresponding metadata) from the versions object */
            var versionIdentifiers = Object.keys(result.versions);
            var version;

            if(semver.validRange(self.versionSpec, true) === null) { // If the version specifier is not a valid semver range, we consider it a tag which we need to resolve to a version
                version = result['dist-tags'][self.versionSpec];
            } else {
                version = self.versionSpec;
            }

            // Take the right version's metadata from the versions object
            var resolvedVersion = semver.maxSatisfying(versionIdentifiers, version, true);

            if(resolvedVersion === null) {
                callback("Cannot resolve version: "+ self.dependencyName + "@" + version);
            } else {
                self.config = result.versions[resolvedVersion];
                self.identifier = self.config.name + "-" + self.config.version;

                // Determine the output hash. If the package provides a sha512 hash use it, otherwise fall back to sha1

                if(self.config.dist.integrity !== undefined && self.config.dist.integrity.substr(0, 7) === "sha512-") {
                    var hash = base64js.toByteArray(self.config.dist.integrity.substring(7));
                    var sha512base16 = new Buffer(hash).toString('hex');
                    self.hashType = "sha512";
                    self.sha512 = "";

                    /* Execute nix-hash to convert hexadecimal notation to Nix's base 32 notation */
                    var nixHash = child_process.spawn("nix-hash", [ "--type", "sha512", "--to-base32", sha512base16 ]);

                    nixHash.stdout.on("data", function(data) {
                        self.sha512 += data;
                    });
                    nixHash.stderr.on("data", function(data) {
                        process.stderr.write(data);
                    });
                    nixHash.on("close", function(code) {
                        if(code == 0) {
                            self.sha512 = self.sha512.substring(0, self.sha512.length - 1);
                            callback();
                        } else {
                            callback("nix-hash exited with status: "+code);
                        }
                    });
                } else {
                    self.hashType = "sha1";
                    self.sha1 = self.config.dist.shasum; // SHA1 hashes are in hexadecimal notation which we can just adopt verbatim
                    callback();
                }
            }
        }
    ], callback);
};

/**
 * @see NixASTNode#toNixAST
 */
NPMRegistrySource.prototype.toNixAST = function() {
    var ast = Source.prototype.toNixAST.call(this);

    var paramExpr = {
        url: this.config.dist.tarball
    };

    switch(this.hashType) {
        case "sha1":
            paramExpr.sha1 = this.sha1;
            break;
        case "sha512":
            paramExpr.sha512 = this.sha512;
            break;
    }

    ast["src"] = new nijs.NixFunInvocation({
        funExpr: new nijs.NixExpression("fetchurl"),
        paramExpr: paramExpr
    });

    return ast;
};

exports.NPMRegistrySource = NPMRegistrySource;
