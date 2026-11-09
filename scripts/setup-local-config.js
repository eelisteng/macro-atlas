#!/usr/bin/env node
'use strict';

/**
 * 从环境变量生成小程序运行所需的本地私有配置。
 *
 * 微信小程序运行时没有 process.env，JSON 配置也不能读环境变量，因此采用
 * 「构建前生成」：本脚本把环境变量写成两个本地文件，二者均在 .gitignore 中，
 * 绝不进入版本库或云端代码包。
 *
 * 用法：
 *   cp .env.example .env.local   # 填入真实值
 *   npm run setup
 *
 * 或直接 export（显式环境变量优先于 .env.local，适合 CI）：
 *   WX_APPID=... WB_CLOUD_ENDPOINT=... WB_PUBLISHABLE_KEY=... WB_OAUTH_CLIENT_ID=... npm run setup
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REQUIRED = [
    'WX_APPID',
    'WB_CLOUD_ENDPOINT',
    'WB_PUBLISHABLE_KEY',
    'WB_OAUTH_CLIENT_ID',
];

// 轻量 .env 解析：只填补 process.env 里尚未显式设置的值。
function loadEnvFile(filename) {
    const file = path.join(ROOT, filename);
    if (!fs.existsSync(file)) return;
    fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach(function (raw) {
        const line = raw.trim();
        if (!line || line.charAt(0) === '#') return;
        const pos = line.indexOf('=');
        if (pos < 0) return;
        const key = line.slice(0, pos).trim();
        let value = line.slice(pos + 1).trim();
        const first = value.charAt(0);
        const last = value.charAt(value.length - 1);
        if (value.length >= 2 && ((first === '"' && last === '"') || (first === "'" && last === "'"))) {
            value = value.slice(1, -1);
        }
        if (value && !process.env[key]) process.env[key] = value;
    });
}

// .env.local 优先于 .env；两者都只是 process.env 的兜底。
loadEnvFile('.env.local');
loadEnvFile('.env');

const invalid = REQUIRED.filter(function (key) {
    const value = process.env[key] || '';
    return !value || value.charAt(0) === '<' || value.indexOf('your-') === 0;
});
if (invalid.length) {
    console.error('[setup] 缺少或无效的环境变量：' + invalid.join(', '));
    console.error('[setup] 请复制 .env.example 为 .env.local 并填写，或直接 export 后重试。');
    process.exit(1);
}

const endpoint = process.env.WB_CLOUD_ENDPOINT.replace(/\/+$/, '');
if (!/^https:\/\/[^\s/]+$/.test(endpoint)) {
    console.error('[setup] WB_CLOUD_ENDPOINT 必须是 https:// 开头的域名，不带路径和结尾斜杠。');
    process.exit(1);
}

// 1) 小程序运行时读取的本地配置，由 utils/public-config.js 加载。
const localEnv =
    '// 自动生成，请勿提交：由 scripts/setup-local-config.js 从环境变量写入。\n' +
    'module.exports = {\n' +
    '    endpoint: ' + JSON.stringify(endpoint) + ',\n' +
    '    publishableKey: ' + JSON.stringify(process.env.WB_PUBLISHABLE_KEY) + ',\n' +
    '    workBuddyOAuthClientId: ' + JSON.stringify(process.env.WB_OAUTH_CLIENT_ID) + ',\n' +
    '};\n';
fs.writeFileSync(path.join(ROOT, 'utils/local-env.js'), localEnv, { encoding: 'utf8', mode: 0o600 });

// 2) 开发者工具私有配置：真实 AppID 覆盖 project.config.json 的占位值。
//    微信官方规则：project.private.config.json 同名字段优先级高于 project.config.json。
const privateConfig = {
    projectname: '宏观图鉴',
    appid: process.env.WX_APPID,
    setting: { urlCheck: false },
};
fs.writeFileSync(
    path.join(ROOT, 'project.private.config.json'),
    JSON.stringify(privateConfig, null, 2) + '\n',
    { encoding: 'utf8', mode: 0o600 }
);

function mask(value) {
    return value.length <= 8 ? '****' : value.slice(0, 4) + '…' + value.slice(-4);
}

console.log('[setup] 已生成（均已被 .gitignore 排除）：');
console.log('  utils/local-env.js');
console.log('  project.private.config.json');
REQUIRED.forEach(function (key) {
    console.log('  ' + key + ' = ' + mask(process.env[key]));
});
console.log('[setup] 现在可以用微信开发者工具导入项目并编译。');
