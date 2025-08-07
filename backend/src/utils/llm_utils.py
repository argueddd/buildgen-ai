import yaml
import os


def load_config(path="config/llm_config.yaml"):
    """
    加载配置文件
    """
    if not os.path.exists(path):
        return {}
    
    with open(path, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)
    
    return config or {}

def get_first_model_key(path="config/llm_config.yaml"):
    """
    获取配置文件中的第一个模型键值
    """
    config = load_config(path)
    if config:
        return next(iter(config.keys()), None)
    return None

def get_active_model_key(path="config/llm_config.yaml"):
    """
    获取当前活跃的模型键值
    """
    from backend.app import current_model_name

    if current_model_name is None:
        return get_first_model_key(path)

    return current_model_name

def get_model_config_by_key(model_key, path="config/llm_config.yaml"):
    """
    通过模型键值直接获取模型配置
    """
    config = load_config(path)
    if not config or model_key not in config:
        return None
    
    model_cfg = config[model_key]
    return {
        'key': model_key,
        'api_key': model_cfg.get("API_KEY", ""),
        'base_url': model_cfg.get("BASE_URL", ""),
        'model_type': model_cfg.get("MODEL_TYPE", "")
    }

def get_all_models(path="config/llm_config.yaml", active_key=None):
    """
    获取所有可用的模型配置
    """
    config = load_config(path)
    
    models = []
    for model_key, model_config in config.items():
        if isinstance(model_config, dict):
            models.append({
                'key': model_key,
                'model_type': model_config.get('MODEL_TYPE', model_key),
                'base_url': model_config.get('BASE_URL', ''),
                'api_key': model_config.get('API_KEY', ''),
                'is_active': model_key == active_key
            })
    
    return models

def get_current_model_config(model_name=None):
    """获取当前活跃的模型配置"""
    config_path = os.path.join(os.getcwd(), 'config', 'llm_config.yaml')

    # 如果指定了模型名称，使用指定的模型
    if model_name:
        model_config = get_model_config_by_key(model_name, config_path)
        if not model_config:
            raise ValueError(f'模型配置 {model_name} 不存在')
        return model_config['api_key'], model_config['base_url'], model_config['model_type']
    
    # 如果没指定模型，回退到配置文件方式
    active_model_key = get_active_model_key(config_path)
    print(f'当前活跃的模型为：{active_model_key}')
    if not active_model_key:
        raise ValueError('没有找到活跃的模型配置')

    model_config = get_model_config_by_key(active_model_key, config_path)

    if not model_config:
        raise ValueError(f'模型配置 {active_model_key} 不存在')

    return model_config['api_key'], model_config['base_url'], model_config['model_type']

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
