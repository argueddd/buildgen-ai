from src.milvus_db import MilvusDbManager

manager = MilvusDbManager(collection_name="specs_architecture")
results = manager.search("非潮湿环境做保温层", limit=3)

for res in results:
    print(f"[内容] {res['content']}")
    print(f"[标签] {res['tags']}")
    print(f"[分数] {res['score']:.4f}")
    print("-" * 40)