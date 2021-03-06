/**
 * Construct a new deployment config instance.
 *
 * @class DeploymentConfig
 * @classdesc Stores all global deployment configuration properties
 *
 * @constructor
 * @param {Boolean} production Indicates whether we deploy in production mode or
 *     development mode. In development mode, also the development dependencies
 *     will be included.
 * @param {Boolean} includePeerDependencies Indicates whether to include peer dependencies with the package
 * @param {Boolean} flatten Indicates whether to create a flat dependency structure in which dependencies are as high as possible in the graph
 * @param {String} nodePackage Name of the Node.js package to use from Nixpkgs
 * @param {String} outputDir Directory in which the nix expression will be written
 */
function DeploymentConfig(production, includePeerDependencies, flatten, nodePackage, outputDir) {
    this.production = production;
    this.includePeerDependencies = includePeerDependencies;
    this.flatten = flatten;
    this.nodePackage = nodePackage;
    this.outputDir = outputDir;
}

exports.DeploymentConfig = DeploymentConfig;
