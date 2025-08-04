import json
import os
import re
import uuid
from datetime import datetime
from typing import List, Dict

from tqdm import tqdm




class MarkdownSectionClassifier:
    """
    用于判断当前 Markdown 所在部分属于“正文”还是“条文说明”。
    """
    def __init__(self):
        self.in_explanation_section = False

    def update_state(self, line: str):
        if line.strip().lstrip("#").strip() == "条文说明":
            self.in_explanation_section = True

    def classify(self) -> str:
        return "条文说明" if self.in_explanation_section else "正文"


class MarkdownChunker:
    """
    将 Markdown 文本切分为结构化章节块，并标注 text_role（正文 / 条文说明）。
    对于内容长度小于 min_content_chars 的块，尝试合并子章节以增强上下文。
    """
    def __init__(self, md_text: str, min_content_chars: int = 50):
        self.md_text = md_text
        self.min_content_chars = min_content_chars
        self.lines = md_text.splitlines()
        self.chunks = []
        self.parent_titles = {}

        self.current_section = None
        self.current_title = None
        self.current_parent = None
        self.current_buffer = []
        self.classifier = MarkdownSectionClassifier()

    def _flush_buffer(self):
        if self.current_section and any(line.strip() for line in self.current_buffer):  # 避免空 chunk
            content = "\n".join(self.current_buffer).strip()
            self.chunks.append({
                "section": self.current_section,
                "title": self.current_title,
                "parent_section": self.current_parent,
                "parent_title": self.parent_titles.get(self.current_parent, ""),
                "content": content,
                "text_role": self.classifier.classify()
            })

    def _parse_lines(self):
        for line in self.lines:
            if line.strip().lstrip("#").strip() == "条文说明":
                self.classifier.update_state(line)
                continue  # 不参与 chunk，纯粹标记状态切换

            self.classifier.update_state(line)

            header_match = re.match(r'^#\s+(\d+(?:\.\d+)?)(.*)', line.strip())
            if header_match:
                self._flush_buffer()
                section_num = header_match.group(1).strip()
                section_title = header_match.group(2).strip()
                parent_sec = section_num.split('.')[0]

                if '.' not in section_num:
                    self.parent_titles[section_num] = section_title

                self.current_section = section_num
                self.current_title = section_title
                self.current_parent = parent_sec
                self.current_buffer = [line]
            else:
                self.current_buffer.append(line)

        self._flush_buffer()

    def _merge_chunks(self):
        merged = []
        i = 0
        while i < len(self.chunks):
            base = self.chunks[i]
            merged_content_parts = []

            base_lines = base["content"].splitlines()
            base_body = "\n".join(line for line in base_lines if not line.strip().startswith("#")).strip()
            if base_body:
                merged_content_parts.append(base_body)

            final_section = base["section"]
            final_title = base["title"]
            final_parent_section = base["parent_section"]
            final_parent_title = base["parent_title"]
            text_role = base.get("text_role", "正文")

            j = i + 1
            while len("\n\n".join(merged_content_parts)) < self.min_content_chars and j < len(self.chunks):
                next_chunk = self.chunks[j]
                if next_chunk["section"].startswith(base["section"] + ".") and next_chunk["text_role"] == text_role:
                    next_lines = next_chunk["content"].splitlines()
                    next_body = "\n".join(line for line in next_lines if not line.strip().startswith("#")).strip()
                    if next_body:
                        merged_content_parts.append(next_body)

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
                "content": "\n\n".join(merged_content_parts).strip(),
                "text_role": text_role
            })

            i = j

        return merged

    def run(self) -> List[Dict]:
        self._parse_lines()
        return self._merge_chunks()

def match_explanation_pairs(chunks: List[Dict]) -> List[Dict]:
    """
    匹配正文与条文说明的对应关系，基于 section 编号。
    返回一个包含两类 text_role 对应条目的列表。
    """
    section_map = {}
    for chunk in chunks:
        key = chunk["section"]
        if key not in section_map:
            section_map[key] = {}
        section_map[key][chunk["text_role"]] = chunk

    result = []
    for section, roles in section_map.items():
        if "正文" in roles or "条文说明" in roles:
            # 获取标题，优先使用正文的标题
            title = ""
            if "正文" in roles:
                title = roles["正文"]["title"]
            elif "条文说明" in roles:
                title = roles["条文说明"]["title"]
            
            result.append({
                "section": section,
                "title": title,
                "正文": roles.get("正文", {}).get("content", ""),  # 返回content字段的文本内容
                "条文说明": roles.get("条文说明", {}).get("content", "")  # 返回content字段的文本内容
            })
    return result

# 示例使用
if __name__ == "__main__":
    from backend.app import update_processing_status, save_chunks_to_milvus
    from backend.src.service.question_generator import generate_questions_for_chunk
    output_dir = "data/output"

    # 获取所有子文件夹
    folder_names = [name for name in os.listdir(output_dir) if os.path.isdir(os.path.join(output_dir, name))]

    # tqdm 包装子文件夹遍历
    for source_name in tqdm(folder_names, desc="Processing source folders", ncols=100):
        filename = source_name+".pdf"

        path = f"./data/output/{source_name}/auto/{source_name}.md"
        file_id = str(uuid.uuid4())
        with open(path, "r", encoding="utf-8") as f:
            md_content = f.read()

        mdc = MarkdownChunker(md_content)
        chunks = mdc.run()

        # 为每个chunk生成问题和tags
        print("为chunks生成问题和tags...")
        for i, chunk in enumerate(chunks):
            try:
                print(f"处理chunk {i + 1}/{len(chunks)}...")
                # 生成问题
                questions_tag_dict = generate_questions_for_chunk(chunk)
                print(f"生成结果: {questions_tag_dict}")
                # 将问题和tags添加到chunk中
                chunk.update(questions_tag_dict)
            except Exception as e:
                print(f"为chunk {i + 1}生成问题失败: {e}")
                # 如果生成失败，添加空的tags
                chunk.update({
                    'question1': '',
                    'question2': '',
                    'question3': '',
                    'tags': ''
                })

        update_processing_status(file_id, 'processing', f'存储到数据库 ({len(chunks)} chunks)...', 5, 5)
        print(f"开始存储 {len(chunks)} 个chunks到Milvus...")
        save_chunks_to_milvus(chunks, filename, "specs_architecture_v1")

        # 完成: 更新处理信息为完成状态
        processed_info = {
            'id': file_id,
            'original_name': filename,
            'filename': filename,
            'upload_date': datetime.now().isoformat(),
            'file_size': os.path.getsize(path),
            'chunks_count': len(chunks),
            'status': 'completed',
            'md_content': md_content,
            'chunks': chunks,
            'processing_steps': {
                'current_step': 5,
                'total_steps': 5,
                'description': '处理完成'
            }
        }

        # 保存完成信息
        info_file = os.path.join("./processed_pdfs", f"{file_id}.json")
        with open(info_file, 'w', encoding='utf-8') as f:
            json.dump(processed_info, f, ensure_ascii=False, indent=2)