import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

try:
    from opencc import OpenCC
except Exception:
    OpenCC = None


TRADITIONAL_TO_SIMPLIFIED_PHRASES = (
    ("音樂", "音乐"),
    ("放鬆", "放松"),
    ("聽聽", "听听"),
    ("聽音", "听音"),
    ("頁面", "页面"),
    ("標註", "标注"),
    ("檢質", "检质"),
)

TRADITIONAL_TO_SIMPLIFIED_CHARS = {
    "這": "这",
    "個": "个",
    "聽": "听",
    "說": "说",
    "語": "语",
    "時": "时",
    "間": "间",
    "問": "问",
    "題": "题",
    "開": "开",
    "關": "关",
    "還": "还",
    "會": "会",
    "為": "为",
    "與": "与",
    "對": "对",
    "裡": "里",
    "後": "后",
    "發": "发",
    "聲": "声",
    "輸": "输",
    "寫": "写",
    "讀": "读",
    "頁": "页",
    "標": "标",
    "註": "注",
    "檢": "检",
    "質": "质",
    "錄": "录",
    "麼": "么",
    "嗎": "吗",
    "氣": "气",
    "車": "车",
    "門": "门",
    "過": "过",
    "邊": "边",
    "線": "线",
    "麵": "面",
    "體": "体",
    "樂": "乐",
    "鬆": "松",
    "臺": "台",
    "灣": "湾",
    "龍": "龙",
    "應": "应",
    "網": "网",
    "電": "电",
    "腦": "脑",
    "歡": "欢",
    "講": "讲",
    "種": "种",
    "樣": "样",
    "從": "从",
    "點": "点",
    "罰": "罚",
    "碼": "码",
    "轉": "转",
    "換": "换",
    "畫": "画",
    "冊": "册",
    "佈": "布",
    "證": "证",
    "號": "号",
    "覺": "觉",
    "來": "来",
    "愛": "爱",
    "頭": "头",
    "見": "见",
    "場": "场",
    "風": "风",
}

OPENCC_CONVERTER = OpenCC("t2s") if OpenCC is not None else None


def count_replacement_chars(text):
    return str(text or "").count("\ufffd")


def is_text_likely_mojibake(text):
    value = str(text or "").strip()
    if not value:
        return False
    replacement_count = count_replacement_chars(value)
    if replacement_count >= 3:
        return True
    if replacement_count >= 1 and len(value) <= 32:
        return True
    return replacement_count > 0 and (replacement_count / max(len(value), 1)) >= 0.08


def sanitize_text(text):
    value = str(text or "")
    for prefix in ("http://", "https://"):
        while prefix in value:
            start = value.find(prefix)
            end = start
            while end < len(value) and not value[end].isspace() and value[end] not in "\"'<>":
                end += 1
            value = value[:start] + "[url-redacted]" + value[end:]
    replacements = [
        ("access_token", "access_token=[redacted]"),
        ("refresh_token", "refresh_token=[redacted]"),
        ("signature", "signature=[redacted]"),
        ("ossaccesskeyid", "ossaccesskeyid=[redacted]"),
        ("api_key", "api_key=[redacted]"),
        ("authorization", "authorization=[redacted]"),
        ("cookie", "cookie=[redacted]"),
    ]
    lowered = value.lower()
    for key, replacement in replacements:
        if key in lowered:
            value = replacement
            break
    return " ".join(value.split())[:240]


def fallback_traditional_to_simplified(text):
    value = str(text or "")
    if not value:
        return value
    for traditional, simplified in TRADITIONAL_TO_SIMPLIFIED_PHRASES:
        value = value.replace(traditional, simplified)
    output = []
    for char in value:
        output.append(TRADITIONAL_TO_SIMPLIFIED_CHARS.get(char, char))
    return "".join(output)


def normalize_to_simplified_chinese(text):
    value = str(text or "")
    if not value:
        return {
            "text": value,
            "changed": False,
            "source": "",
        }
    if OPENCC_CONVERTER is not None:
        try:
            normalized = str(OPENCC_CONVERTER.convert(value) or "")
            return {
                "text": normalized,
                "changed": normalized != value,
                "source": "opencc",
            }
        except Exception:
            pass
    normalized = fallback_traditional_to_simplified(value)
    return {
        "text": normalized,
        "changed": normalized != value,
        "source": "fallback",
    }


def emit(payload, exit_code=0):
    text = json.dumps(payload, ensure_ascii=False)
    sys.stdout.buffer.write(text.encode("utf-8"))
    sys.stdout.buffer.flush()
    raise SystemExit(exit_code)


def fail(code, message, provider_status=None, raw_status=""):
    payload = {
        "success": False,
        "code": code,
        "message": sanitize_text(message),
    }
    if provider_status is not None:
        payload["providerStatus"] = int(provider_status)
    if raw_status:
        payload["rawStatus"] = str(raw_status)
    emit(payload, 1)


def parse_stdin():
    raw = sys.stdin.read()
    try:
        return json.loads(raw or "{}")
    except json.JSONDecodeError:
        fail("invalid-json", "Fun-ASR Python 输入 JSON 解析失败。")


def normalize_language_hints(value):
    if isinstance(value, list):
        source = value
    else:
        source = str(value or "zh").replace(",", " ").split()
    result = []
    for item in source:
        text = str(item or "").strip()
        if text and text not in result:
            result.append(text)
    return result[:8] or ["zh"]


def is_http_url(value):
    try:
        parsed = urllib.parse.urlparse(str(value or ""))
    except Exception:
        return False
    return parsed.scheme in ("http", "https") and bool(parsed.netloc)


def build_sdk_base_http_api_url(payload):
    configured = str(payload.get("baseHttpApiUrl") or "").strip()
    if configured:
      return configured
    base_url = str(os.getenv("DASHSCOPE_BASE_URL") or "https://dashscope.aliyuncs.com/compatible-mode/v1").strip()
    try:
        parsed = urllib.parse.urlparse(base_url)
        return parsed.scheme + "://" + parsed.netloc + "/api/v1"
    except Exception:
        return "https://dashscope.aliyuncs.com/api/v1"


def response_attr(source, key, default=None):
    if source is None:
        return default
    if isinstance(source, dict):
        return source.get(key, default)
    return getattr(source, key, default)


def extract_status_code(response):
    return int(response_attr(response, "status_code", 0) or 0)


def extract_output(response):
    return response_attr(response, "output", {}) or {}


def extract_task_id(response):
    output = extract_output(response)
    return str(response_attr(output, "task_id", "") or response_attr(output, "taskId", "") or "").strip()


def extract_raw_status(response):
    output = extract_output(response)
    return str(
        response_attr(output, "task_status", "")
        or response_attr(output, "taskStatus", "")
        or response_attr(response, "status", "")
        or ""
    ).strip()


def extract_message(response):
    output = extract_output(response)
    return str(
        response_attr(output, "message", "")
        or response_attr(output, "task_message", "")
        or response_attr(output, "taskMessage", "")
        or response_attr(response, "message", "")
        or response_attr(response, "code", "")
        or ""
    ).strip()


def extract_transcription_url(response):
    output = extract_output(response)
    results = response_attr(output, "results", []) or []
    if isinstance(results, list) and results:
        first = results[0]
        return str(
            response_attr(first, "transcription_url", "")
            or response_attr(first, "transcriptionUrl", "")
            or ""
        ).strip()
    return str(
        response_attr(output, "transcription_url", "")
        or response_attr(output, "transcriptionUrl", "")
        or ""
    ).strip()


def is_audio_url_unreachable(text):
    lowered = str(text or "").lower()
    return "url" in lowered and any(keyword in lowered for keyword in ["access", "download", "forbidden", "denied", "signature", "oss", "403", "404"])


def is_invalid_model(text):
    lowered = str(text or "").lower()
    return "model" in lowered and any(keyword in lowered for keyword in ["invalid", "not found", "unsupported", "illegal"])


def classify_provider_failure(status_code, message, raw_status=""):
    if is_invalid_model(message):
        fail("invalid-fun-asr-model", "Fun-ASR 模型名应为 fun-asr。", status_code or None, raw_status)
    if status_code == 403:
        if is_audio_url_unreachable(message):
            fail(
                "fun-asr-audio-url-unreachable",
                "Fun-ASR 调用被拒绝，疑似平台音频 URL 对模型服务不可访问。",
                status_code,
                raw_status,
            )
        fail(
            "fun-asr-forbidden",
            "Fun-ASR 调用被拒绝。可能是 DashScope 权限/地域未开通、API Key 无权限，或平台音频 URL 无法被 Fun-ASR 服务访问。",
            status_code,
            raw_status,
        )
    if is_audio_url_unreachable(message):
        fail(
            "fun-asr-audio-url-unreachable",
            "Fun-ASR 无法访问当前音频链接，请确认平台 audioUrl 对模型服务可访问。",
            status_code or None,
            raw_status,
        )
    fail("fun-asr-provider-error", message or "Fun-ASR 调用失败。", status_code or None, raw_status)


def fetch_json_from_url(url):
    try:
        with urllib.request.urlopen(url, timeout=60) as response:
            raw_bytes = response.read()
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        classify_provider_failure(error.code, body)
    except Exception as error:
        fail("fun-asr-transcription-download-failed", "Fun-ASR 结果读取失败：" + sanitize_text(error))
    should_try_gb18030 = False
    for encoding in ("utf-8-sig", "utf-8"):
        try:
            text = raw_bytes.decode(encoding)
            return json.loads(text or "{}")
        except UnicodeDecodeError:
            continue
        except json.JSONDecodeError:
            should_try_gb18030 = True
            continue
    try:
        fallback_text = raw_bytes.decode("utf-8", errors="replace")
    except Exception:
        fallback_text = ""
    if should_try_gb18030 or is_text_likely_mojibake(fallback_text):
        try:
            return json.loads(raw_bytes.decode("gb18030") or "{}")
        except (UnicodeDecodeError, json.JSONDecodeError):
            pass
    try:
        return json.loads(fallback_text or "{}")
    except json.JSONDecodeError:
        fail("fun-asr-transcription-json-invalid", "Fun-ASR 结果文件 JSON 解析失败。")


def extract_heard_text(payload):
    direct_text = str(payload.get("text") or response_attr(payload.get("output", {}), "text", "") or "").strip()
    if direct_text:
        return direct_text
    candidates = []
    for key in ("transcripts", "sentences", "segments", "utterances"):
        items = payload.get(key)
        if not isinstance(items, list):
            continue
        for item in items:
            if not isinstance(item, dict):
                continue
            text = str(item.get("text") or item.get("transcript") or item.get("content") or "").strip()
            if text:
                candidates.append(text)
    return "".join(candidates).strip()


def main():
    payload = parse_stdin()
    audio_url = str(payload.get("audioUrl") or "").strip()
    model = str(payload.get("model") or "fun-asr").strip() or "fun-asr"
    timeout_ms = max(1000, min(300000, int(float(payload.get("timeoutMs") or 60000))))
    language_hints = normalize_language_hints(payload.get("languageHints"))
    api_key = str(os.getenv("DASHSCOPE_API_KEY") or "").strip()

    if not api_key:
        fail("missing-api-key", "缺少 DASHSCOPE_API_KEY。")
    if not is_http_url(audio_url):
        fail("invalid-audio-url", "audioUrl 必须是公网可访问的 http/https 地址。")

    try:
        import dashscope
        from dashscope.audio.asr import Transcription
    except Exception as error:
        fail(
            "fun-asr-python-dependency-missing",
            "Fun-ASR Python 依赖未安装，请先安装 requirements.txt。 " + sanitize_text(error),
        )

    dashscope.api_key = api_key
    if hasattr(dashscope, "base_http_api_url"):
        dashscope.base_http_api_url = build_sdk_base_http_api_url(payload)

    try:
        task_response = Transcription.async_call(
            model=model,
            file_urls=[audio_url],
            language_hints=language_hints,
        )
    except Exception as error:
        fail("fun-asr-sdk-call-failed", "Fun-ASR SDK 调用失败：" + sanitize_text(error))

    submit_status = extract_status_code(task_response)
    task_id = extract_task_id(task_response)
    raw_status = extract_raw_status(task_response) or "SUBMITTED"
    message = extract_message(task_response)

    if submit_status not in (0, 200):
        classify_provider_failure(submit_status, message, raw_status)
    if not task_id:
        fail("fun-asr-task-id-missing", "Fun-ASR 未返回 task_id。", submit_status or None, raw_status)

    deadline_at = time.time() + (timeout_ms / 1000.0)
    fetch_response = task_response

    while time.time() < deadline_at:
        current_status = (extract_raw_status(fetch_response) or raw_status).upper()
        if current_status in ("SUCCEEDED", "SUCCESS"):
            break
        if current_status in ("FAILED", "FAIL", "CANCELED", "CANCELLED"):
            classify_provider_failure(extract_status_code(fetch_response), extract_message(fetch_response), current_status)
        time.sleep(1.0)
        try:
            fetch_response = Transcription.fetch(task=task_id)
        except Exception as error:
            fail("fun-asr-fetch-failed", "Fun-ASR 查询任务失败：" + sanitize_text(error), raw_status=current_status)
        raw_status = extract_raw_status(fetch_response) or current_status

    final_status = (extract_raw_status(fetch_response) or raw_status or "").upper()
    if final_status not in ("SUCCEEDED", "SUCCESS"):
        fail("timeout", "Fun-ASR 等待识别结果超时。", raw_status=final_status or raw_status)

    transcription_url = extract_transcription_url(fetch_response)
    heard_text = ""
    if transcription_url:
        transcript_payload = fetch_json_from_url(transcription_url)
        heard_text = extract_heard_text(transcript_payload)
    if not heard_text:
        heard_text = extract_heard_text(extract_output(fetch_response))
    if not heard_text:
        fail("fun-asr-empty-text", "Fun-ASR 未返回可用转写文本。", raw_status=final_status)
    normalize_result = normalize_to_simplified_chinese(heard_text)
    heard_text = normalize_result["text"]
    if is_text_likely_mojibake(heard_text):
        fail(
            "fun-asr-mojibake-text",
            "Fun-ASR 返回文本疑似编码异常，请检查 Python stdout UTF-8 配置或结果文件编码。",
            raw_status=final_status,
        )

    emit(
        {
            "success": True,
            "model": model,
            "heardText": heard_text,
            "simplifiedChineseNormalized": normalize_result["changed"] is True,
            "simplifiedChineseSource": normalize_result["source"],
            "taskId": task_id,
            "rawStatus": final_status,
        }
    )


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as error:
        sys.stderr.buffer.write(("[FunASR Python] " + sanitize_text(error) + "\n").encode("utf-8"))
        sys.stderr.buffer.flush()
        fail("fun-asr-python-unhandled", "Fun-ASR Python 执行失败：" + sanitize_text(error))
