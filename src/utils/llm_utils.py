import yaml


def get_llm_config(model_name="qwen", path="config/llm_config.yaml"):
    """
    从 YAML 配置中加载指定模型的 LLM 配置。
    """
    with open(path, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)
    model_key = model_name.upper()
    model_cfg = config.get("LLM", {}).get(model_key, {})
    return model_cfg.get("API_KEY", ""), model_cfg.get("BASE_URL", ""), model_cfg.get("MODEL_TYPE", "")


def collect_stream(generator):
    """
    把 yield 出来的文本流（如 stream_chat）收集成完整字符串。
    """
    return "".join(part for part in generator if part)


def load_template_and_fill(template_path, **kwargs):
    """
    从模板文件中加载 prompt，并将参数通过 format(**kwargs) 注入。
    例如：load_template_and_fill(title="xx", content="xx")
    """
    with open(template_path, "r", encoding="utf-8") as f:
        template = f.read()
    return template.format(**kwargs)
