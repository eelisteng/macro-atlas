// 云服务配置加载器：本文件不含任何凭据，可安全提交。
// 小程序运行时没有 process.env，所以真实值由 `npm run setup` 从环境变量
// 生成到 ./local-env.js（已在 .gitignore 中排除），此处只做加载与校验。
let localConfig;
try {
    localConfig = require('./local-env');
} catch (error) {
    throw new Error('[宏观图鉴] 缺少本地配置：请先设置环境变量并执行 npm run setup');
}

['endpoint', 'publishableKey', 'workBuddyOAuthClientId'].forEach(function (key) {
    if (!localConfig[key]) {
        throw new Error('[宏观图鉴] 本地配置缺少 ' + key + '，请重新执行 npm run setup');
    }
});

module.exports = {
    endpoint: localConfig.endpoint,
    publishableKey: localConfig.publishableKey,
    workBuddyOAuthClientId: localConfig.workBuddyOAuthClientId,
};
