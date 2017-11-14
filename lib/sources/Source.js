var url = require('url');
var semver = require('semver');
var nijs = require('nijs');
var inherit = require('nijs/lib/ast/util/inherit.js').inherit;

/**
 * Creates a new source instance. This function should never be used directly,
 * instead use: Source.constructSource to construct a source object.
 *
 * @class Source
 * @extends NixASTNode
 * @classdesc Represents a file that is obtained from an external source
 *
 * @constructor
 * @param {String} baseDir Directory in which the referrer's package.json configuration resides
 * @param {String} versionSpec Version specifier of the Node.js package to fetch
 */
function Source(baseDir, versionSpec) {
    this.baseDir = baseDir;
    this.versionSpec = versionSpec;
}

/* Source inherits from NixASTNode */
inherit(nijs.NixASTNode, Source);

/**
 * Constructs a specific kind of source by inspecting the version specifier.
 *
 * @param {String} baseDir Directory in which the referrer's package.json configuration resides
 * @param {String} outputDir Directory in which the nix expression will be written
 * @param {String} dependencyName Name of the dependency
 * @param {String} versionSpec Version specifier of the Node.js package to fetch
 */
Source.constructSource = function(baseDir, outputDir, dependencyName, versionSpec) {
    // Load modules here, to prevent cycles in the include process
    var GitSource = require('./GitSource.js').GitSource;
    var HTTPSource = require('./HTTPSource.js').HTTPSource;
    var LocalSource = require('./LocalSource.js').LocalSource;
    var NPMRegistrySource = require('./NPMRegistrySource.js').NPMRegistrySource;

    var parsedVersionSpec = semver.validRange(versionSpec, true);
    var parsedUrl = url.parse(versionSpec);

    if(parsedVersionSpec !== null) { // If the version is valid semver range, fetch the package from the NPM registry
        return new NPMRegistrySource(baseDir, dependencyName, parsedVersionSpec);
    } else if(parsedUrl.protocol == "github:") { // If the version is a GitHub repository, compose the corresponding Git URL and do a Git checkout
        return new GitSource(baseDir, dependencyName, GitSource.composeGitURL("git://github.com", parsedUrl));
    } else if(parsedUrl.protocol == "gist:") { // If the version is a GitHub gist repository, compose the corresponding Git URL and do a Git checkout
        return new GitSource(baseDir, dependencyName, GitSource.composeGitURL("https://gist.github.com", parsedUrl));
    } else if(parsedUrl.protocol == "bitbucket:") { // If the version is a Bitbucket repository, compose the corresponding Git URL and do a Git checkout
        return new GitSource(baseDir, dependencyName, GitSource.composeGitURL("git://bitbucket.org", parsedUrl));
    } else if(parsedUrl.protocol == "gitlab:") { // If the version is a Gitlab repository, compose the corresponding Git URL and do a Git checkout
        return new GitSource(baseDir, dependencyName, GitSource.composeGitURL("git://gitlab.com", parsedUrl));
    } else if(typeof parsedUrl.protocol == "string" && parsedUrl.protocol.substr(0, 3) == "git") { // If the version is a Git URL do a Git checkout
        return new GitSource(baseDir, dependencyName, versionSpec);
    } else if(parsedUrl.protocol == "http:" || parsedUrl.protocol == "https:") { // If the version is an HTTP URL do a download
        return new HTTPSource(baseDir, dependencyName, versionSpec);
    } else if(versionSpec.match(/^[a-zA-Z0-9_\-]+\/[a-zA-Z0-9\.]+[#[a-zA-Z0-9_\-]+]?$/)) { // If the version is a GitHub repository, compose the corresponding Git URL and do a Git checkout
        return new GitSource(baseDir, dependencyName, "git://github.com/"+versionSpec);
    } else if(parsedUrl.protocol == "file:") { // If the version is a file URL, simply compose a Nix path
        return new LocalSource(baseDir, outputDir, parsedUrl.path);
    } else if(versionSpec.substr(0, 3) == "../" || versionSpec.substr(0, 2) == "~/" || versionSpec.substr(0, 2) == "./" || versionSpec.substr(0, 1) == "/") { // If the version is a path, simply compose a Nix path
        return new LocalSource(baseDir, outputDir, versionSpec);
    } else { // In all other cases, just try the registry. Sometimes invalid semver ranges are encountered or a tag has been provided (e.g. 'latest', 'unstable')
        return new NPMRegistrySource(baseDir, dependencyName, versionSpec);
    }
};

/**
 * Fetches the package metadata from the external source.
 *
 * @method
 * @param {function(String)} callback Callback that gets invoked when the work
 *     is done. In case of an error, it will set the first parameter to contain
 *     an error message.
 */
Source.prototype.fetch = function(callback) {
    callback("fetch() is not implemented, please use a prototype that inherits from Source");
};

/**
 * @see NixASTNode#toNixAST
 */
Source.prototype.toNixAST = function() {
    return {
        name: this.config.name.replace("@", "_at_").replace("/", "_slash_"), // Escape characters from scoped package names that aren't allowed
        packageName: this.config.name,
        version: this.config.version
    };
};

exports.Source = Source;
