import json
import re

def parse_questions(text, max_count=3):
    """
    从模型输出中提取 3 个按编号开头的问题，返回列表形式。
    支持 1.、1）、1) 等格式。
    """
    pattern = r"(?:^|\n)\s*\d+[.、\)]\s*(.+?)(?=\n\s*\d+[.、\)]|\Z)"
    matches = re.findall(pattern, text.strip(), flags=re.DOTALL)
    questions = [q.strip() for q in matches[:3]]  # 最多取前3个
    return {
        f"question{i + 1}": questions[i] if i < len(questions) else ""
        for i in range(max_count)
    }


def extract_json_block(text):
    # 从 LLM 输出中提取 JSON 段（支持 ```json ``` 包裹或裸 JSON）。
    match = re.search(r"```json\s*($begin:math:display$.*?$end:math:display$|\{.*?\})\s*```", text, re.DOTALL)
    if match:
        return json.loads(match.group(1).strip())
    # 匹配裸 JSON 格式（不含 markdown 包裹）
    match = re.search(r"(\[.*\]|\{.*\})", text, re.DOTALL)
    if match:
        return json.loads(match.group(1).strip())
    return ""



def fill_questions_into_chunk(chunk: dict, questions: list) -> dict:
    """
    将解析出的问题填入 chunk 对应字段，返回更新后的 chunk。
    """
    for i in range(3):
        chunk[f"question{i+1}"] = questions[i] if i < len(questions) else ""
    return chunk


if __name__ == "__main__":
    llm_ans = """
    1. 石膏保温砂浆的适用范围是否仅限于民用建筑室内非潮湿区域？  
    2. 石膏保温砂浆的技术要求应包含哪些具体性能指标？
    3. 在石膏保温砂浆的分类与标记中，如何根据使用部位进行产品标识？
    """
    a = parse_questions(llm_ans)
    pass
