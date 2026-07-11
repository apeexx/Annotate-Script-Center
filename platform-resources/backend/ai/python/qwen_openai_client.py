#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import socket
import sys
import urllib.error
import urllib.request


def read_payload():
    raw = sys.stdin.read()
    return json.loads(raw or "{}")


def write_output(payload):
    sys.stdout.write(json.dumps(payload, ensure_ascii=False))
    sys.stdout.flush()


def extract_text_part(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
      pieces = []
      for item in content:
          if isinstance(item, str):
              pieces.append(item)
          elif isinstance(item, dict) and isinstance(item.get("text"), str):
              pieces.append(item.get("text"))
      return "".join(pieces)
    return ""


def extract_delta_text(payload):
    choices = payload.get("choices")
    if not isinstance(choices, list) or len(choices) <= 0:
        return ""
    choice = choices[0] if isinstance(choices[0], dict) else {}
    delta = choice.get("delta")
    if isinstance(delta, dict):
        value = extract_text_part(delta.get("content"))
        if value:
            return value
    message = choice.get("message")
    if isinstance(message, dict):
        value = extract_text_part(message.get("content"))
        if value:
            return value
    return ""


def summarize_last_chunk(payload):
    choice = {}
    choices = payload.get("choices")
    if isinstance(choices, list) and len(choices) > 0 and isinstance(choices[0], dict):
        choice = choices[0]
    delta = choice.get("delta") if isinstance(choice.get("delta"), dict) else {}
    usage = payload.get("usage") if isinstance(payload.get("usage"), dict) else {}
    return {
        "hasChoices": bool(choice),
        "finishReason": str(choice.get("finish_reason") or ""),
        "deltaKeys": list(delta.keys())[:12],
        "usageKeys": list(usage.keys())[:12],
    }


def normalize_error_summary(value):
    return str(value or "").replace("\r", " ").replace("\n", " ").strip()[:500]


def request_stream(api_base, api_key, request_body, timeout_ms):
    base = str(api_base or "").rstrip("/")
    endpoint = base + "/chat/completions"
    req = urllib.request.Request(
        endpoint,
        method="POST",
        data=json.dumps(request_body, ensure_ascii=False).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer " + str(api_key or ""),
        },
    )

    raw_sse_text = []
    aggregated_text = []
    usage = {}
    parsed_chunks_count = 0
    finish_reason = ""
    last_chunk_summary = None
    provider_error = None

    timeout_seconds = max(1.0, float(timeout_ms or 60000) / 1000.0)
    with urllib.request.urlopen(req, timeout=timeout_seconds) as response:
        for raw_line in response:
            try:
                line = raw_line.decode("utf-8", errors="replace")
            except Exception:
                line = str(raw_line)
            stripped = line.strip()
            if not stripped.startswith("data:"):
                continue
            raw_sse_text.append(line if line.endswith("\n") else line + "\n")
            payload_text = stripped[5:].strip()
            if not payload_text or payload_text == "[DONE]":
                continue
            try:
                payload = json.loads(payload_text)
            except Exception:
                continue
            parsed_chunks_count += 1
            if isinstance(payload.get("error"), dict):
                provider_error = payload.get("error")
            text = extract_delta_text(payload)
            if text:
                aggregated_text.append(text)
            if isinstance(payload.get("usage"), dict):
                usage = payload.get("usage")
            choices = payload.get("choices")
            if isinstance(choices, list) and len(choices) > 0 and isinstance(choices[0], dict):
                finish_reason = str(choices[0].get("finish_reason") or finish_reason)
            last_chunk_summary = summarize_last_chunk(payload)

    text = "".join(aggregated_text)
    raw_text = "".join(raw_sse_text)
    return {
        "success": True,
        "text": text,
        "usage": usage,
        "rawSseText": raw_text,
        "rawResponseText": raw_text,
        "parsedChunksCount": parsed_chunks_count,
        "extractedTextLength": len(text.strip()),
        "finishReason": finish_reason,
        "lastChunkSummary": last_chunk_summary,
        "providerError": provider_error,
    }


def main():
    try:
        payload = read_payload()
        api_base = payload.get("apiBase") or payload.get("baseUrl") or ""
        api_key = payload.get("apiKey") or ""
        request_body = payload.get("requestBody") or {}
        timeout_ms = payload.get("timeoutMs") or 60000
        if not api_key:
            write_output(
                {
                    "success": False,
                    "code": "missing-api-key",
                    "statusCode": 503,
                    "message": "missing-api-key",
                    "summary": "missing-api-key",
                }
            )
            return
        write_output(request_stream(api_base, api_key, request_body, timeout_ms))
    except urllib.error.HTTPError as error:
        body = ""
        try:
            body = error.read().decode("utf-8", errors="replace")
        except Exception:
            body = str(error)
        write_output(
            {
                "success": False,
                "code": "provider-http-error",
                "statusCode": int(getattr(error, "code", 502) or 502),
                "providerStatus": int(getattr(error, "code", 502) or 502),
                "message": "Qwen 接口请求失败（HTTP %s）。" % str(getattr(error, "code", 502) or 502),
                "summary": normalize_error_summary(body),
                "responseBody": body[:20000],
            }
        )
    except urllib.error.URLError as error:
        reason = getattr(error, "reason", error)
        code = "timeout" if isinstance(reason, socket.timeout) else "python-runtime-error"
        status_code = 504 if code == "timeout" else 502
        write_output(
            {
                "success": False,
                "code": code,
                "statusCode": status_code,
                "message": "Qwen 请求超时。" if code == "timeout" else "Qwen Python 请求失败。",
                "summary": normalize_error_summary(reason),
            }
        )
    except socket.timeout as error:
        write_output(
            {
                "success": False,
                "code": "timeout",
                "statusCode": 504,
                "message": "Qwen 请求超时。",
                "summary": normalize_error_summary(error),
            }
        )
    except Exception as error:
        write_output(
            {
                "success": False,
                "code": "python-runtime-error",
                "statusCode": 502,
                "message": "Qwen Python 执行失败。",
                "summary": normalize_error_summary(error),
            }
        )


if __name__ == "__main__":
    main()
