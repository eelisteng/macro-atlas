#!/usr/bin/env node
'use strict';

/**
 * 提交前自检：扫描受版本控制的文本文件，防止 AppID / 云凭据被再次写进仓库。
 * 跳过 vendor SDK 与二进制素材目录——SDK 里的是厂商自带常量，不是本项目凭据。
 *
 *   npm run check:secrets
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// 前缀用拼接构造，避免仓库里出现凭据前缀的字面量（同时也不会被本脚本误判）。
const RULES = [
    { label: '真实 AppID', re: /wx[0-9a-f]{16}/g },
    { label: 'publishableKey', re: new RegExp('wbpk' + '_[A-Za-z0-9_-]{12,}', 'g') },
    { label: 'OAuth clientId', re: new RegExp('cb' + '_[A-Za-z0-9_-]{16,}', 'g') },
    { label: 'WorkBuddy app 标识', re: new RegExp('wbapp' + '_[A-Za-z0-9]{10,}', 'g') },
];

const SKIP = /^(node_modules|miniprogram_npm|\.workbuddy|docs)\//;
const TEXT = /\.(js|json|md|py|sql|wxml|wxss|ya?ml|txt)$/i;

function git(args) {
    return spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
}

const listed = git(['ls-files']);
if (listed.status !== 0) {
    console.error('[check] 无法读取 git 文件列表：' + (listed.stderr || '').trim());
    process.exit(1);
}

const files = listed.stdout.split('\n').filter(Boolean)
    .filter(function (file) { return !SKIP.test(file); })
    .filter(function (file) { return TEXT.test(file) || file.indexOf('.env') === 0 || file === '.gitignore'; });

let hits = 0;
files.forEach(function (file) {
    let text;
    try {
        text = fs.readFileSync(path.join(ROOT, file), 'utf8');
    } catch (error) {
        return;
    }
    RULES.forEach(function (rule) {
        const matched = text.match(rule.re);
        if (matched) {
            hits += matched.length;
            console.error('  ✗ ' + file + ' → ' + rule.label + '：' + matched.slice(0, 2).join(', '));
        }
    });
});

// 确认私有文件确实被忽略；--no-index 让仍被跟踪的文件也能被检出。
const MUST_BE_IGNORED = [
    '.env.local',
    '.env',
    'project.private.config.json',
    'utils/local-env.js',
    '.workbuddy/miniprogram-scaffold.json',
    'node_modules/.package-lock.json',
];
const ignored = git(['check-ignore', '--no-index'].concat(MUST_BE_IGNORED));
const ignoredSet = new Set((ignored.stdout || '').split('\n').filter(Boolean));
MUST_BE_IGNORED.forEach(function (file) {
    if (!ignoredSet.has(file)) {
        hits += 1;
        console.error('  ✗ 未被 .gitignore 覆盖：' + file);
    }
});

if (hits) {
    console.error('[check] 发现 ' + hits + ' 处风险，请修正后再提交。');
    process.exit(1);
}
console.log('[check] 通过：' + files.length + ' 个受版本控制的文本文件无硬编码凭据，私有文件均已忽略。');
