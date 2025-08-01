from backend.app import save_chunks_to_milvus
from backend.src.infrastructure.milvus_db import MilvusDbManager
from backend.src.service.question_generator import generate_questions_for_chunk
from backend.src.service.split_md_into_chunks import MarkdownChunker

file_name = "JGJ289-2012_建筑外墙外保温防火隔离带技术规程"
with open(
        f"./data/output/{file_name}/auto/{file_name}.md",
        "r", encoding="utf-8") as f:
    md_text = f.read()

mdc = MarkdownChunker(md_text)
chunks = mdc.run()

manager = MilvusDbManager("specs_architecture")
manager.initialize()

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

print(f"开始存储 {len(chunks)} 个chunks到Milvus...")
save_chunks_to_milvus(chunks, file_name, "specs_architecture")
