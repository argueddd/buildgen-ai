import re
from typing import List, Dict

def split_markdown_with_parent_titles(md_text: str) -> List[Dict]:
    """
    按 Markdown 中的 # 标题切片，提取 section、title、parent_section 和 parent_title。
    子章节会自动继承上级标题名作为 parent_title。
    """
    chunks = []
    lines = md_text.splitlines()

    current_section = None
    current_title = None
    current_parent = None
    current_buffer = []
    parent_titles = {}

    def flush_buffer():
        if current_section and current_buffer:
            chunks.append({
                "section": current_section,
                "title": current_title,
                "parent_section": current_parent,
                "parent_title": parent_titles.get(current_parent, ""),
                "content": "\n".join(current_buffer).strip()
            })

    for line in lines:
        header_match = re.match(r'^#\s+(\d+(?:\.\d+)?)(.*)', line.strip())
        if header_match:
            # 存储上一段
            flush_buffer()

            section_num = header_match.group(1).strip()     # e.g. '6.1'
            section_title = header_match.group(2).strip()   # e.g. '抗流挂性'
            parent_sec = section_num.split('.')[0]          # e.g. '6'

            # 如果是主章节（例如 "6"），则记录 parent_title
            if '.' not in section_num:
                parent_titles[section_num] = section_title

            current_section = section_num
            current_title = section_title
            current_parent = parent_sec
            current_buffer = [line]
        else:
            current_buffer.append(line)

    # 最后一段处理
    flush_buffer()
    return chunks

# 示例使用
if __name__ == "__main__":
    with open("./data/output/JC-T2706-2022_石膏保温砂浆.md", "r", encoding="utf-8") as f:
        md_text = f.read()

    chunks = split_markdown_with_parent_titles(md_text)

    for c in chunks:
        print(f"【{c['section']} - {c['title']}】（归属于 {c['parent_section']}：{c['parent_title']}）")
        print(c['content'][:100] + '...\n')