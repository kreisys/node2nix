var path = require('path');
var nijs = require('nijs');
var inherit = require('nijs/lib/ast/util/inherit.js').inherit;

/*
 * Prefixes a relative path with ./ if needed so that it can be converted to a
 * value belonging to Nix's file type
 */
function prefixRelativePath(target) {
    if(path.isAbsolute(target) || target.substring(0, 2) == "./" || target.substring(0, 3) == "../") {
        return target;
    } else {
        return "./" + target;
    }
}

function CompositionExpression(nodePackage, nodeEnvNix, packagesNix, supplementNix, generateSupplement) {
    this.nodePackage = nodePackage;
    this.nodeEnvNixPath = prefixRelativePath(nodeEnvNix);
    this.packagesNixPath = prefixRelativePath(packagesNix);
    this.supplementNix = supplementNix;
    this.generateSupplement = generateSupplement;
}

/* CompositionExpression inherits from NixASTNode */
inherit(nijs.NixASTNode, CompositionExpression);

/**
 * @see NixASTNode#toNixAST
 */
CompositionExpression.prototype.toNixAST = function() {
    var globalBuildInputs;

    if(this.generateSupplement) {
        var supplementNixPath = prefixRelativePath(this.supplementNix);

        globalBuildInputs = new nijs.NixFunInvocation({
            funExpr: new nijs.NixExpression("pkgs.lib.attrValues"),
            paramExpr: new nijs.NixFunInvocation({
                funExpr: new nijs.NixImport(new nijs.NixFile({ value: supplementNixPath })),
                paramExpr: {
                  nodeEnv: new nijs.NixInherit(),
                  fetchurl: new nijs.NixInherit("pkgs"),
                  fetchgit: new nijs.NixInherit("pkgs")
                }
            })
        });
    }

    return new nijs.NixFunction({
        argSpec: {
            pkgs: new nijs.NixFunInvocation({
                funExpr: new nijs.NixImport(new nijs.NixExpression("<nixpkgs>")),
                paramExpr: {
                    system: new nijs.NixInherit()
                }
            }),
            system: new nijs.NixAttrReference({
                attrSetExpr: new nijs.NixExpression("builtins"),
                refExpr: new nijs.NixExpression("currentSystem")
            }),
            nodejs: new nijs.NixAttrReference({
                attrSetExpr: new nijs.NixExpression("pkgs"),
                refExpr: this.nodePackage
            })
        },
        body: new nijs.NixLet({
            value: {
                globalBuildInputs: globalBuildInputs,

                nodeEnv: new nijs.NixFunInvocation({
                    funExpr: new nijs.NixImport(new nijs.NixFile({ value: this.nodeEnvNixPath })),
                    paramExpr: {
                        stdenv: new nijs.NixInherit("pkgs"),
                        python2: new nijs.NixInherit("pkgs"),
                        utillinux: new nijs.NixInherit("pkgs"),
                        runCommand: new nijs.NixInherit("pkgs"),
                        writeTextFile: new nijs.NixInherit("pkgs"),
                        nodejs: new nijs.NixInherit()
                    }
                })
            },
            body: new nijs.NixFunInvocation({
                funExpr: new nijs.NixImport(new nijs.NixFile({ value: this.packagesNixPath })),
                paramExpr: {
                    fetchurl: new nijs.NixInherit("pkgs"),
                    fetchgit: new nijs.NixInherit("pkgs"),
                    nodeEnv: new nijs.NixInherit(),
                    globalBuildInputs: globalBuildInputs ? new nijs.NixInherit() : undefined
                }
            })
        })
    });
};

exports.CompositionExpression = CompositionExpression;
