from tqdm import tqdm
from src.milvus_db import MilvusDbManager
from src.service.question_generator import generate_questions_for_chunk
from src.utils.io_utils import load_markdown_chunks
from src.utils.vector_utils import prepare_chunk_for_insert

if __name__ == '__main__':
    source_name = "JC-T2706-2022_石膏保温砂浆"
    source_base_info = {
        "year": "2022",
        "source_file": source_name,
    }
    chunks = load_markdown_chunks(source_name)
    manager = MilvusDbManager("specs_architecture")
    manager.initialize()

    for chunk in tqdm(chunks, desc="Generating & Inserting", ncols=100):
        questions_tag_dict = generate_questions_for_chunk(chunk)
        data = prepare_chunk_for_insert(chunk, questions_tag_dict, source_base_info)
        manager.insert_chunk(data)