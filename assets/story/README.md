# 星光回响：场景与配音素材

本目录中的故事、场景图形与台词为本项目创作。场景由 `js/story-art.js` 的几何图形绘制；`node tools/export-story-art.js` 导出 8 张 SVG，游戏使用相同图形直接绘入 Canvas，因此不会加载一套仅供展示的替代背景。

| 文件 | 用途 |
| --- | --- |
| notice.svg | 招新与日常约定的公告栏 |
| archive.svg | 旧录像、合影与开放日档案 |
| rainhall.svg | 风雨中的老球馆 |
| blackout.svg | 停电后安全撤离与检查 |
| hearing.svg | 球馆公开说明会 |
| community.svg | 社区开放日 |
| locker.svg | 决赛前后的更衣室 |
| dawnhall.svg | 清晨重新开门的球馆 |

## 当前配音：Qwen-Audio-TTS（1.1.1）

全部 603 条台词使用 `qwen-audio-3.1-tts-plus` 合成，15 个说话人沿用玩家确认的专属设计音色。每句依据剧情表情添加语气指令。音色方案见 `tools/qwen-voice-profiles.json`，确认记录与试听见 `QWEN_VOICE_REDESIGN.md`。

采用北京地域的阿里云百炼接口。开发时发送原创台词并保存 WAV 母版，玩家运行时只播放本地 MP3，游戏包中不包含 API 密钥。原始响应启用 AIGC 标识；打包音频附有 AI 合成来源备注，游戏对白区显示“合成配音”。

`voice-script.json` 是当前剧本导出的完整录音任务；`voice-manifest.json` 保存每条 MP3 的模型、音色 ID、说话人、时长、SHA-256 和分包位置。音频为单声道 24 kHz / 48 kbps MP3，分成 6 个按章节加载的资源包。可以关闭、重听、跳过，切后台会停止播放。

## 再生成

```sh
node tools/story-voice-script.js
python3 tools/build-qwen-story-voices.py
python3 tools/install-qwen-story-voices.py
npm run build:wechat
python3 tools/audit-story-voices.py
```

API 凭证只配置于本机已忽略的 `.env`；脚本不会输出密钥。`output/qwen-full` 保存可继续使用的逐句母版和请求元数据，`previous-assets` 备份替换前的素材。每次只合成缺失或已修改的内容。

旧 Kokoro 生成工具与许可文本仅供历史素材追溯，当前包体使用 Qwen 配音。剧情翻纸、开门、脚步、键盘、雨声、电灯和巴士音效仍由 `tools/sound-design.js` 程序合成。

[阿里云声音设计指南](https://help.aliyun.cn/zh/model-studio/voice-design-user-guide) · [Qwen-Audio-TTS HTTP 接口](https://help.aliyun.com/zh/model-studio/qwen-audio-tts-http-api)

本次完整录音约 44.27 分钟，MP3 合计 15.57 MiB；603 条录音均通过解码与信号检查。
