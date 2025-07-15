import os
from tqdm import tqdm
from src.infrastructure.milvus_db import MilvusDbManager
from src.service.question_generator import generate_questions_for_chunk
from src.utils.io_utils import load_markdown_chunks
from src.utils.vector_utils import prepare_chunk_for_insert

if __name__ == '__main__':
    output_dir = "data/output"

    # 获取所有子文件夹
    folder_names = [name for name in os.listdir(output_dir) if os.path.isdir(os.path.join(output_dir, name))]

    # tqdm 包装子文件夹遍历
    for source_name in tqdm(folder_names, desc="Processing source folders", ncols=100):
        source_path = os.path.join(output_dir, source_name)

        source_base_info = {
            "year": source_name.split('-')[1][:4] if '-' in source_name else "",
            "source_file": source_name,
        }

        chunks = load_markdown_chunks(source_name)
        manager = MilvusDbManager("specs_architecture_v1")
        manager.initialize()

        for chunk in tqdm(chunks, desc=f"Inserting chunks: {source_name}", leave=False, ncols=100):
            questions_tag_dict = generate_questions_for_chunk(chunk)
            data = prepare_chunk_for_insert(chunk, questions_tag_dict, source_base_info)
            manager.insert_chunk(data)