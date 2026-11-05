# Qwen 角色配音试听

本轮使用 `qwen-audio-3.1-tts-plus`（华北2／北京）为最新故事清单的 15 个说话人设计独立音色。试听确认后已完整替换全部 603 条正式语音，版本 1.1.1。

## 角色方向

| 角色 | 声线与表演方向 |
| --- | --- |
| 凌风 | 清亮少年男声，克制幽默，认真时坚定 |
| 沧澜 | 清爽沉稳的少女中低音，可靠、不甜腻 |
| 小红 | 明亮利落的少年男声，分析清楚，偶有逞强 |
| 冉冉 | 轻盈圆润，带笑意，温柔但有主见 |
| 星星 | 通透柔和，含蓄、细腻 |
| 王瑞 | 温暖厚实，稳重，保留少年感 |
| 丁丁 | 清脆敏捷，稍快，充满冲劲 |
| 猴子 | 松弛随和，略沙，带自然幽默 |
| 路先森 | 平稳圆润，一本正经地讲冷笑话 |
| 老陈 | 清亮热情，年轻，偶尔害羞 |
| 果哥 | 结实偏低，慢半拍的松弛感 |
| 田楚 | 干净偏冷，克制、尊重对手 |
| 朱老师 | 温和年长男声，略沙哑，从容清楚 |
| 毛毛 | 明亮轻巧的中性精灵声，不尖锐 |
| 旁白 | 温暖清晰的成年女声，叙述克制 |

实际试听按原剧情选择日常、激动、柔和三组台词，使用不同的表演指令。上述文字是设计目标，最终效果需试听判断。不会通过对同一个声音简单变速变调来凑角色。

## 文件与运行

- `tools/qwen-voice-profiles.json`：角色音色描述。
- `tools/qwen-story-voices.py`：专属音色创建、复用、状态查询与试听合成。
- `tools/package-qwen-audition.py`：信号检查、音量留余量、角色合辑与试听页。
- `output/qwen-voice-audition/voices.json`：实际创建的音色 ID，生成后保留用于全剧声音一致性。
- `output/qwen-voice-audition/samples.json`：实际台词、指令、请求 ID 和 API 返回用量。
- `output/qwen-voice-audition/index.html`：全部角色试听页。
- `output/qwen-voice-audition/role-showcase.mp3`：部分角色速览，顺序见试听页。

密钥由项目根目录 `.env` 读取；该文件已被 Git 忽略，权限为仅当前用户读写。脚本不把密钥、带签名音频地址或完整 API 响应写入日志。试听只在开发电脑调用服务，密钥不进入小游戏。

```sh
python3 tools/qwen-story-voices.py --check
python3 tools/qwen-story-voices.py --design --audition
python3 tools/package-qwen-audition.py
```

默认试听正文预算为 5000 个计费字符。已有音色和相同台词／指令的成功录音会复用；修改音色描述会创建新的设计，旧音色不会自动删除。创建请求遇到网络中断后，应先查询恢复结果，避免重复创建。模型错误会停止流程，不自动切换为别的模型。

## 官方依据

[声音设计指南](https://help.aliyun.cn/zh/model-studio/voice-design-user-guide)说明文字设计音色免费；后续合成按目标模型计费，音色与创建时的目标模型绑定。[HTTP 合成接口](https://help.aliyun.com/zh/model-studio/qwen-audio-tts-http-api)支持角色指令和临时音频 URL。源 WAV 请求启用 AIGC 标识；试听页明确标注 AI 合成。

[北京地域计费](https://help.aliyun.com/zh/model-studio/model-pricing)：Plus 为每万计费字符 1.4 元，汉字计 2 个字符。试听费用按接口实际返回字符数计算；未将免费额度视作必然可用。

试听阶段保留原配音；玩家确认后已按固定音色与逐句表演指令完成全量替换，并通过微信分包与回归检查。

## 本轮结果

15 个专属音色已创建，45 条实际对白均生成并解码成功，原始试听总时长 226.72 秒。接口累计返回 2010 个计费字符，按北京 Plus 原价估算 0.2814 元（未扣免费额度；最终以账单为准）。

试听页包含 15 个角色合辑。53 秒速览顺序：凌风、沧澜、小红、毛毛、猴子、果哥、朱老师、旁白。播放器会在开始另一段时暂停当前音频。全部处理发生在独立试听目录，未修改正式游戏音频和剧情存档。

自动检查包括可解码、时长、有效信号、音色 ID 独立和素材完整性。原始模型音频在少量位置达到满幅，试听处理为峰值留出余量；不将信号检查视作发音、情感和自然度的人工验收。

浏览器验证：16 个播放器均加载成功（15 个角色加速览），开始另一段会自动暂停前一段，未发现媒体错误。试听可直接打开 `output/qwen-voice-audition/index.html`，无需保留本地服务器。

## 完整台词生成（1.1.1）

玩家确认试听后，完整 603 条台词均使用上述 15 个已确认音色。全量生成脚本为 `tools/build-qwen-story-voices.py`：复用试听与已完成的母版，四个并发请求，按台词原有表情使用同样的语气指令，固定随机种子。每句请求 ID、用量与参数写入独立元数据文件，避免并发更新丢失。

`tools/install-qwen-story-voices.py` 先检查每条母版是否可解码、包含有效信号且与台词/说话人一致，再处理响度、压缩为单声道 24 kHz / 48 kbps MP3。替换前备份旧素材，生成新的来源与 SHA-256 索引。6 个章节分包逐个检查大小。

```sh
python3 tools/build-qwen-story-voices.py
python3 tools/install-qwen-story-voices.py
npm run build:wechat
python3 tools/audit-story-voices.py
npm test
```

重新生成时保持 `output/qwen-full` 与已确认的 `output/qwen-voice-audition/voices.json`，可以复用已有语音和专属音色，避免重新创建声音或重复调用。


完整替换结果：603 条，15 个说话人，约 44.27 分钟。MP3 合计 15.57 MiB，48 kbps；微信主包 2.21 MiB，全部文件 17.78 MiB。6 个语音分包最大约 3.33 MiB。完整解码检查 603 条通过，压缩后最高峰值 0.838。

验证日志：`output/qwen-full/tests.log`（完整回归），`output/qwen-full/audio-audit.log`（逐条音频检查），`output/qwen-full/report.json`（时长与大小）。自动检查不代替真机听感和每句发音审听。版本更新为 1.1.1，未上传发布。
