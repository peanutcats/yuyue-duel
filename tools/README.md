# 网页开发与验证

- 本机预览：`python3 tools/serve.py [端口]`，默认 8765。
- 自动回归：`node --test --test-concurrency=2 tools/*.test.js`，覆盖物理、技能、发球、训练、联机快照、TURN 与静态资源依赖。
- 浏览器验收：在本机预览上使用 Playwright CLI 的 `run-code --filename tools/web-release.browser.js`，检查手势解锁、15 首音乐、2D / 3D 对局、训练、技能说明和手机布局。截图保存于 `output/playwright/`。
- 配乐：`node tools/build-score.js` 重新制作，`node tools/score-audit.js` 解码检查并生成试听；需要 FFmpeg / ffprobe。
- 故事：`build-story-v3.js` 编排剧本；`export-story-art.js` 导出故事场景。
- 美术与说明：`export-character-art.js`、`gen-skill-icons.js`、`gen-skill-doc.js` 导出资源。

`output/` 为本机测试与试听结果，不进入提交或静态部署。
