import re
from typing import List, Dict


def split_markdown_with_parent_titles(md_text: str, min_content_chars: int = 50) -> List[Dict]:
    lines = md_text.splitlines()
    chunks = []

    current_section = None
    current_title = None
    current_parent = None
    current_buffer = []
    parent_titles = {}

    def flush_buffer():
        if current_section and current_buffer:
            content = "\n".join(current_buffer).strip()
            chunks.append({
                "section": current_section,
                "title": current_title,
                "parent_section": current_parent,
                "parent_title": parent_titles.get(current_parent, ""),
                "content": content
            })

    for line in lines:
        header_match = re.match(r'^#\s+(\d+(?:\.\d+)?)(.*)', line.strip())
        if header_match:
            flush_buffer()
            section_num = header_match.group(1).strip()
            section_title = header_match.group(2).strip()
            parent_sec = section_num.split('.')[0]

            if '.' not in section_num:
                parent_titles[section_num] = section_title

            current_section = section_num
            current_title = section_title
            current_parent = parent_sec
            current_buffer = [line]
        else:
            current_buffer.append(line)

    flush_buffer()

    # 合并“太小”的 chunk 到下一个
    merged = []
    i = 0
    while i < len(chunks):
        current = chunks[i]
        # 判断是否要合并到下一个
        if len(current["content"]) < min_content_chars and i + 1 < len(chunks):
            next_chunk = chunks[i + 1]
            # 如果当前是 parent，比如 3，下一条是 3.1
            if next_chunk["section"].startswith(current["section"] + "."):
                # 合并当前内容到下一段最前面
                next_chunk["content"] = current["content"] + "\n\n" + next_chunk["content"]
                i += 1  # 跳过当前，继续处理 next_chunk（合并后）
                continue
        merged.append(current)
        i += 1

    return merged

def split_markdown_merge_recursively(md_text: str, min_content_chars: int = 50) -> List[Dict]:
    """
    将 Markdown 文本按标题切分，并将正文内容太少的 chunk 递归合并到下一个子章节中。
    合并后的 chunk 使用最后一个子 chunk 的 section/title 作为标识。
    """
    lines = md_text.splitlines()
    chunks = []

    current_section = None
    current_title = None
    current_parent = None
    current_buffer = []
    parent_titles = {}

    def flush_buffer():
        if current_section and current_buffer:
            content = "\n".join(current_buffer).strip()
            chunks.append({
                "section": current_section,
                "title": current_title,
                "parent_section": current_parent,
                "parent_title": parent_titles.get(current_parent, ""),
                "content": content
            })

    # Step 1: 切分 Markdown 按标题
    for line in lines:
        header_match = re.match(r'^#\s+(\d+(?:\.\d+)?)(.*)', line.strip())
        if header_match:
            flush_buffer()
            section_num = header_match.group(1).strip()
            section_title = header_match.group(2).strip()
            parent_sec = section_num.split('.')[0]

            if '.' not in section_num:
                parent_titles[section_num] = section_title

            current_section = section_num
            current_title = section_title
            current_parent = parent_sec
            current_buffer = [line]
        else:
            current_buffer.append(line)
    flush_buffer()

    # Step 2: 合并逻辑
    merged = []
    i = 0
    while i < len(chunks):
        base = chunks[i]
        merged_content_parts = []

        # 初始：去掉 base 中的标题行，仅保留正文部分
        base_lines = base["content"].splitlines()
        base_body = "\n".join(line for line in base_lines if not line.strip().startswith("#")).strip()
        if base_body:
            merged_content_parts.append(base_body)

        final_section = base["section"]
        final_title = base["title"]
        final_parent_section = base["parent_section"]
        final_parent_title = base["parent_title"]

        j = i + 1
        while len("\n\n".join(merged_content_parts)) < min_content_chars and j < len(chunks):
            next_chunk = chunks[j]
            # 判断是否为子章节（以当前为父章节）
            if next_chunk["section"].startswith(base["section"] + "."):
                # 去掉 next_chunk 的标题，只取正文
                next_lines = next_chunk["content"].splitlines()
                next_body = "\n".join(line for line in next_lines if not line.strip().startswith("#")).strip()
                if next_body:
                    merged_content_parts.append(next_body)
                # 更新最终以这个 chunk 为主
                final_section = next_chunk["section"]
                final_title = next_chunk["title"]
                final_parent_section = next_chunk["parent_section"]
                final_parent_title = next_chunk["parent_title"]
                j += 1
            else:
                break

        merged.append({
            "section": final_section,
            "title": final_title,
            "parent_section": final_parent_section,
            "parent_title": final_parent_title,
            "content": "\n\n".join(merged_content_parts).strip()
        })

        i = j  # 跳过已合并的 chunk

    return merged


# 示例使用
if __name__ == "__main__":
    with open("./data/output/JC-T2706-2022_石膏保温砂浆.md", "r", encoding="utf-8") as f:
        md_text = f.read()

    chunks = split_markdown_merge_recursively(md_text)

    for c in chunks:
        print(f"【{c['section']} - {c['title']}】（归属于 {c['parent_section']}：{c['parent_title']}）")
        print(c['content'][:100] + '...\n')