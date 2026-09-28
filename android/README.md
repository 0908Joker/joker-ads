# 得污 Android 安装包

应用直接加载唯一 VPS 主站 `https://b12sl5x.cn/#/appcenter`，不打包历史 Vue 构建，也不依赖旧 Pages H5。服务器上更新四个栏目、身份卡及邀请功能后，APK 使用同一份页面。

- 名称：得污；图标沿用 `public/brand/logo.png`。
- 包名：`cn.b12sl5x.dewu`；版本：`1.0.0`（versionCode 1）。
- Android 8.0 / API 26 起；需要可用且更新的 Android System WebView。
- 身份数据保存在此 APK 自己的 WebView 存储中，常规关闭和重新打开保留；它与浏览器、旧 APK 的本地存储相互独立，不会自动搬走旧端的身份数据。
- 只申请联网权限。身份卡复制由系统剪贴板处理，图片由系统文件保存窗口处理；原生消息入口仅允许主站 HTTPS 且仅主框架调用。第三方链接和下载交给系统浏览器。
- 没有旧 APK 的签名密钥，因此这是使用新包名、新签名的独立安装包；不是旧包的覆盖升级。以后同包名更新必须保留同一签名密钥。

## 构建

使用 JDK 17、Android SDK Platform 35 / Build Tools 35.0.0、Gradle 8.11.1、Android Gradle Plugin 8.9.2。版本组合见 [Android 官方兼容表](https://developer.android.com/build/releases/agp-8-9-0-release-notes)。

```bash
cd android
./gradlew --no-daemon assembleRelease testDebugUnitTest lintRelease
```

Windows 使用 `gradlew.bat`。SDK 通过 `ANDROID_HOME` 或未入库的 `local.properties` 配置。输出 `app/build/outputs/apk/release/app-release-unsigned.apk`；CI 只保存未签名产物，不持有正式私钥。

正式签名在本地完成。`scripts/sign-android.ps1` 使用本机受保护的签名目录；密码由 Windows 当前用户加密保存，不进入 Git。安装交付以签名验证及 SHA-256 记录为准。

```powershell
./scripts/sign-android.ps1 -Jdk <JDK目录> -BuildTools <SDK/build-tools/35.0.0> `
  -InputApk android/app/build/outputs/apk/release/app-release-unsigned.apk `
  -OutputApk <交付目录>/dewu-server-1.0.0.apk -KeyDirectory <仓库外的签名目录>
```

只有首次创建签名时添加 `-CreateKey`。后续版本复用原目录；不在密钥缺失时自动生成新的签名。DPAPI 密码文件绑定当前 Windows 用户，搬到其他电脑前需要从原电脑安全导出签名资料。

2026-09-29 交付：`dewu-server-1.0.0.apk`，SHA-256 `164d986ab696f78bde7d9445648ec71469bd4c15bb348ab92c0c136db0bd5a15`。`assembleRelease`、两项 URL 策略单元测试、`lintRelease`、APK 签名验证已通过。Lint 仍有旧固定依赖版本和原有图标形状/密度提示，未屏蔽检查。

## 验证范围

构建包含主站 URL 白名单和外部链接方案的单元测试、Android Lint，以及服务器页面独立验证。没有连接 Android 真机或模拟器时，不把编译成功当作实际手机端验收；图片保存、系统文件选择、视频全屏、升级保留身份还应在目标手机确认。
