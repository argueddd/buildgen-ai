
import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))
from src.infrastructure.milvus_db import MilvusDbManager

manager = MilvusDbManager(collection_name="specs_architecture_v1")
results = manager.search("木头保温杯", limit=5)


print(f"[搜索结果] {len(results)}")
