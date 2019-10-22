#!/usr/bin/env node
const path = require('path')
const pack = (webpackConfig, helpConfig, nodeModulesPath) => {
    if (nodeModulesPath && nodeModulesPath.length) {
        nodeModulesPath.map(o => module.paths.push(o))
    }

    const webpack = require('webpack')

    webpack(webpackConfig).watch(
        helpConfig.watchOptions || {},
        helpConfig.watchCallback ||
            function(err, stats) {
                console.log(
                    err ||
                        stats.toString({
                            color: true
                        })
                )
            }
    )
}

process.on('message', c => {
    pack(c.webpackConfig, c.helpConfig, c.nodeModulesPath)
})
