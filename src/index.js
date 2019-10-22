#!/usr/bin/env node
console.log('[WPE] build tools')
const path = require('path')
const fs = require('fs')
const assert = require('assert')
const merge = require('webpack-merge')
const fastGlob = require('fast-glob')
const { fork } = require('child_process')
const mm = require('micromatch')
const packageJson = require('../package.json')
const currentPath = process.cwd()
const program = require('commander')
const DO = {
    WEBPACK_HELPER_CONFIG_NAME:
        'webpack.helper.json' /** webpack helper的配置文件 */,
    WEBPACK_CONFIG_PATTERN: ['*webpack*.js'] /** webpack的配置文件 */,
    DEV_CONFIG_PATTERN: ['*dev*.js'] /**开发环境 */,
    PRO_CONFIG_PATTERN: ['*pro*.js'] /** 正式打包*/,
    ENTRY_PATTERN: ['./index.js'] /**  默认打包入口文件 */
}
program
    .version('0.0.1')
    .usage('[options]')
    .option('-d, --dev', 'run webpack in development mode')
    .option('-p, --prod', 'run webpack in production mode')
    .option('-a, --all', 'run webpack in both development and production mode')
    .parse(process.argv)

/**
 * @description 获取上下文
 */
const getContext = () => {
    const allParentPaths = path
        .dirname(process.cwd())
        .split(path.sep)
        .map((o, i, a) => a.slice(0, i + 1).join(path.sep))
        .reverse()
    module.paths.push(path.resolve(path.join(__dirname, '../', 'node_modules')))
    const projectPath = allParentPaths.find(o => {
        // module.paths.push(path.join(o, 'node_modules'))
        return fastGlob.sync(DO.WEBPACK_HELPER_CONFIG_NAME, { cwd: o }).length
    })
    const nodeModulesPath = allParentPaths
        .map(o => {
            const t = path.join(o, 'node_modules')
            if (fs.existsSync(t)) return t
            else return
        })
        .filter(t => t)
    assert.ok(
        projectPath,
        "can't find WEBPACK_HELPER_CONFIG file, default config is webpack.helper.json in root path"
    )
    const parentPaths = allParentPaths.filter(o => ~o.indexOf(projectPath))
    parentPaths.unshift(currentPath)
    parentPaths.reverse()
    const helpConfig = require(path.join(
        projectPath,
        DO.WEBPACK_HELPER_CONFIG_NAME
    ))

    const configsGroup = parentPaths.reduce((result, o) => {
        const tempConfigs = fastGlob.sync(
            helpConfig.WEBPACK_CONFIG_PATTERN || DO.WEBPACK_CONFIG_PATTERN,
            { cwd: o }
        )
        try {
            tempConfigs.map(io => {
                result[io] = result[io] || []
                result[io] = result[io].concat([require(path.join(o, io))])
            })
        } catch (e) {
            console.error(e)
        }
        return result
    }, {})

    const entry = fastGlob.sync(helpConfig.ENTRY_PATTERN || DO.ENTRY_PATTERN, {
        cwd: currentPath
    })
    return { configsGroup, helpConfig, projectPath, entry, nodeModulesPath }
}

/**
 * @description 获取配置列表
 * @param  {} program
 * @param  {} configsGroup
 * @param  {} helpConfig
 */
const getFilteredConfigsList = ({
    program,
    configsGroup,
    helpConfig,
    entry
}) => {
    const result = []
    for (const item in configsGroup) {
        const filters = []
        if (program.dev) {
            filters.concat(
                helpConfig.DEV_CONFIG_PATTERN || DO.DEV_CONFIG_PATTERN
            )
        } else if (program.prod) {
            filters.concat(
                helpConfig.PRO_CONFIG_PATTERN || DO.PRO_CONFIG_PATTERN
            )
        } else if (program.all || 1) {
            filters.concat(
                helpConfig.DEV_CONFIG_PATTERN || DO.DEV_CONFIG_PATTERN
            )
            filters.concat(
                helpConfig.PRO_CONFIG_PATTERN || DO.PRO_CONFIG_PATTERN
            )
        }
        if (mm(item, filters)) {
            result.push(
                merge.strategy(helpConfig.mergeStrategy)([
                    { entry },
                    ...configsGroup[item]
                ])
            )
        }
    }
    return result
}
const start = () => {
    const {
        configsGroup,
        helpConfig,
        projectPath,
        entry,
        nodeModulesPath
    } = getContext()
    const configsList = getFilteredConfigsList({
        program,
        configsGroup,
        helpConfig,
        entry
    })
    configsList.map(o => {
        const cp = fork(`${__dirname}/pack.js`)
        cp.send({ webpackConfig: o, helpConfig, nodeModulesPath })
    })
}
if (require.main === module) {
    start()
} else {
    exports.getContext = getContext
    exports.getFilteredConfigsList = getFilteredConfigsList
}
