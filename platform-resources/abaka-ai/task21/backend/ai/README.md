# Abaka AI Task21 AI 杈呭姪鍒嗘瀽锛圱ask21鍔╂墜锛?
## 鐩爣

鏈洰褰曟矇娣€ Task21 AI 鍒嗘瀽鏂规銆丳rompt 妯℃澘鍜岃皟璇曞彛寰勩€? 
AI 浠呮彁渚涘缓璁紝涓嶈嚜鍔ㄥ啓鍏ャ€佷笉鑷姩淇濆瓨銆佷笉鑷姩鎻愪氦銆佷笉鑷姩閫佸銆?
## 瑙勫垯鐗堟湰涓庢柟妗?
- Prompt 瑙勫垯鐗堟湰锛歚abaka-task21-ai-v5-removed-text-multiset`锛堣 `prompt.md` 涓?`backend/prompt.js`锛夈€?
- 榛樿锛歚two_stage`
  - 闃舵涓€ `vision_extract`锛氳瑙夋ā鍨嬪彧鎻愬彇浜嬪疄锛坴isual observations锛夈€?  - 鍙€夐樁娈?`ocr_extract`锛歄CR 妯″瀷鎻愬彇鍥句腑鏂囧瓧绾跨储锛堥粯璁ゅ叧闂級銆?  - 闃舵浜?`reasoning_decide`锛氭帹鐞嗘ā鍨嬫牴鎹鍒欒緭鍑烘渶缁堢粨鏋溿€?- 淇濈暀锛歚single_model`
  - 鍗曟ā鍨嬬洿鎺ュ畬鎴愬浘鍍忕悊瑙?+ 瑙勫垯鍒ゆ柇锛屼究浜庡揩閫熷姣斻€?
褰撳墠榛樿妯″瀷锛?- `aiVisionModel=qwen3.6-plus`
- `aiReasoningModel=qwen3.6-plus`
- `aiSingleModel=qwen3.6-plus`
- `aiOcrEnabled=false`
- `aiOcrModel=""`锛圤CR 涓撶敤妯″瀷寰呮枃瀛楁彁鍙栧畼鏂规枃妗ｈ繘涓€姝ユ牳瀵癸級

鍊欓€夋ā鍨嬶紙鍩轰簬瑙嗚鐞嗚В瀹樻柟鏂囨。涓庢埅鍥惧彛寰勶級锛?- 瑙嗚/鍗曟ā鍨嬪€欓€夛細`qwen3.6-plus`銆乣qwen3.6-flash`銆乣qwen3-vl-plus`銆乣qwen3-vl-flash`銆乣qwen3.5-plus`銆乣qwen3.5-flash`銆乣qwen-vl-max`銆乣qwen-vl-plus`
- 鎺ㄧ悊鍊欓€夛細`qwen3.6-plus`銆乣qwen3.6-flash`銆乣qwen3.5-plus`銆乣qwen3.5-flash`
- 浠ヤ笅鏃у悕涓嶅啀浣滀负榛樿鎴栧€欓€夛細`qwen-vl-max-latest`銆乣qwen-vl-ocr-latest`銆乣qvq-plus-latest`

## 鍓嶇涓庡悗绔弬鏁?
Options锛圓baka AI Task21 璇︽儏锛夆€淎I 璋冭瘯鈥濅繚瀛橈細

- `aiAnalysisMode`
- `aiVisionModel`
- `aiOcrEnabled`
- `aiOcrModel`
- `aiReasoningModel`
- `aiSingleModel`
- `aiEnableThinking`锛堥粯璁?`false`锛?- `aiRequestTimeoutMs`锛堥粯璁?`60000`锛?
鍓嶇璋冪敤 `/api/abaka-ai/task21/ai/analyze` 鏃舵樉寮忔惡甯︿笂杩板弬鏁般€? 
鍓嶇涓嶄繚瀛?API Key銆?
## thinking 绛栫暐

- 榛樿鏄惧紡浼狅細`enable_thinking=false`銆?- 鐢ㄦ埛寮€鍚悗鏄惧紡浼狅細`enable_thinking=true`銆?- 榛樿涓嶉潤榛樼Щ闄ゅ弬鏁帮紱鑻ユā鍨嬩笉鏀寔浼氳繑鍥炴竻鏅伴敊璇€?- 浠呭綋 `ABAKA_TASK21_AI_ALLOW_THINKING_PARAM_FALLBACK=true` 鏃跺厑璁哥Щ闄ゅ弬鏁板洖閫€銆?
## 褰撳墠瑙勫垯鎽樿

- `same_font` 鏀寔锛歚true | false | unsure | error | same underlying font+artistic effect`銆?- `image_b_texts_removed` 閲囩敤 T/B/R/D 澶氶噸闆嗚鍒欙細
  - `D == T => true`
  - `D` 涓虹┖ => `null`
  - `D` 闈炵┖涓?`D != T => specify`
- `image_b_texts_removed` 鍒犻櫎鍒ゆ柇鍙瘮杈?`image_b` 涓?`image_b_removed`锛宍image_a` 涓嶅弬涓庛€?- `specify` 鏀寔锛歚all instances of xxx / 1 instance of xxx / N instances of xxx`銆?- `other_changes` 鍙瘮杈?`image_b_removed` 涓?`image_b`锛屽缓璁嫳鏂囩煭鍙ワ紙绾?30 璇嶄互鍐咃級銆?
## 璋冭瘯杈撳嚭

杩斿洖骞跺睍绀猴細

- `analysisMode`
- `visionModel / ocrModel / reasoningModel / singleModel`
- `stages.vision / stages.ocr / stages.reasoning / stages.single`锛堟ā鍨嬨€乧allMode銆乼hinking銆佽€楁椂銆乽sage锛?- `usage.total` 涓庡吋瀹瑰钩閾?tokens
- `thinking.enableThinking / explicitDisableSent / fallbackUsed / paramName / paramLocation`
- `requestId`銆乣elapsedMs`
- 鍥剧墖缁熻锛坄image_a/image_b/image_b_removed`锛?- 浠锋牸浼扮畻

## 瀹夊叏杈圭晫

- 涓嶈褰曞畬鏁村浘鐗?URL銆佸畬鏁?dataUrl銆乼oken/cookie/authorization銆?- 鏃ュ織涓?UI 浠呭睍绀鸿劚鏁忔憳瑕併€?- 鏈厤缃?API Key 鏃跺彲浣跨敤 mock 妯″紡楠岃瘉娴佺▼銆?
## 瀹樻柟鏂囨。鏍稿

- 娑夊強妯″瀷鍒楄〃涓?thinking 鍙傛暟锛屽厛鏌?`docs/external-docs-aliyun-bailian.md` 绱㈠紩涓殑瀹樻柟鍏ュ彛銆?- 瑙嗚鐞嗚В浼樺厛鏍稿锛歔https://help.aliyun.com/zh/model-studio/vision](https://help.aliyun.com/zh/model-studio/vision)
- 褰撳墠瀹炵幇鍙傛暟鍚嶏細`enable_thinking`锛屼綅缃細璇锋眰浣?root锛圤penAI compatible Chat锛夈€?
