import os
from pymilvus import MilvusClient, DataType, connections, Collection
from sentence_transformers import SentenceTransformer

DEFAULT_QWEN_DIM = 1024
MILVUS_HOST = os.getenv("MILVUS_HOST", "localhost")


def _deduplicate_and_rank_results(results, limit):
    content_map = {}
    for r in results:
        key = r["content"]
        if key not in content_map or r["score"] > content_map[key]["score"]:
            content_map[key] = r
    return sorted(content_map.values(), key=lambda x: x["score"], reverse=True)[:limit]


class EmbeddingModelWrapper:
    def __init__(self, model_name="Qwen/Qwen3-Embedding-0.6B", device="mps", dim=DEFAULT_QWEN_DIM):
        self.model = SentenceTransformer(model_name, device=device)
        self.dim = dim

    def encode(self, text, label=None):
        if label:
            print(f"Encoding: {label} ...")
        return self.model.encode([text])[0] if text else [0.0] * self.dim


class MilvusDbManager:
    def __init__(self, collection_name, dim=DEFAULT_QWEN_DIM):
        self.collection_name = collection_name
        self.dim = dim
        self.client = MilvusClient(uri=f"http://{MILVUS_HOST}:19530")
        self.encoder = EmbeddingModelWrapper(dim=dim)

    def initialize(self):
        if self.client.has_collection(self.collection_name):
            print(f"Collection '{self.collection_name}' already exists.")
            return
        self._create_schema()
        self._prepare_index_params()
        self._create_collection()

    def _create_schema(self):
        self.schema = self.client.create_schema(enable_dynamic_field=True)

        self.schema.add_field("id", DataType.INT64, is_primary=True, auto_id=True)
        self.schema.add_field("title", DataType.VARCHAR, max_length=512)
        self.schema.add_field("section", DataType.VARCHAR, max_length=64)
        self.schema.add_field("parent_title", DataType.VARCHAR, max_length=512)
        self.schema.add_field("parent_section", DataType.VARCHAR, max_length=64)
        self.schema.add_field("content", DataType.VARCHAR, max_length=65535)
        self.schema.add_field("question1", DataType.VARCHAR, max_length=65535)
        self.schema.add_field("question2", DataType.VARCHAR, max_length=65535)
        self.schema.add_field("tags", DataType.VARCHAR, max_length=256)
        self.schema.add_field("year", DataType.VARCHAR, max_length=256)
        self.schema.add_field("source_file", DataType.VARCHAR, max_length=256)
        self.schema.add_field("text_role", DataType.VARCHAR, max_length=256)
        self.schema.add_field("is_material_chunk", DataType.BOOL)

        self.schema.add_field("content_vector", DataType.FLOAT_VECTOR, dim=self.dim)
        self.schema.add_field("question1_vector", DataType.FLOAT_VECTOR, dim=self.dim)
        self.schema.add_field("question2_vector", DataType.FLOAT_VECTOR, dim=self.dim)
        self.schema.add_field("tags_vector", DataType.FLOAT_VECTOR, dim=self.dim)

    def _prepare_index_params(self):
        self.index_params = self.client.prepare_index_params()
        self.index_params.add_index("id", index_type="STL_SORT")
        for field in ["question1_vector", "question2_vector", "content_vector", "tags_vector"]:
            self.index_params.add_index(field, index_type="HNSW", metric_type="COSINE", params={"M": 16, "efConstruction": 100})

    def _create_collection(self):
        self.client.create_collection(
            collection_name=self.collection_name,
            schema=self.schema,
            index_params=self.index_params
        )

    def encode_fields(self, chunk: dict) -> dict:
        return {
            "content_vector": self.encoder.encode(chunk.get("content"), "content"),
            "question1_vector": self.encoder.encode(chunk.get("question1"), "question1"),
            "question2_vector": self.encoder.encode(chunk.get("question2"), "question2"),
            "tags_vector": self.encoder.encode(chunk.get("tags"), "tags"),
        }

    def build_insert_data(self, chunk: dict) -> dict:
        vectors = self.encode_fields(chunk)
        return {
            **chunk,
            **vectors
        }

    def insert_chunk(self, chunk: dict):
        print(f"Inserting chunk: {chunk.get('title', '')}")
        data = [self.build_insert_data(chunk)]
        self.client.insert(collection_name=self.collection_name, data=data)

    def search(self, query_text, limit=10):
        connections.connect(host=MILVUS_HOST)
        Collection(name=self.collection_name).load()
        query_vector = self.encoder.encode(query_text, label="query")

        all_results = []
        output_fields = [
            "content", "title", "section", "tags",
            "question1", "question2", "source_file"
        ]

        for field, weight in zip([
            "tags_vector",
            "question1_vector", "question2_vector",
            "content_vector"
        ], [1.8, 1.2, 1.0, 1.5]):
            raw = Collection(self.collection_name).search(
                data=[query_vector], anns_field=field,
                param={"metric_type": "COSINE", "params": {"ef": 128}},
                limit=limit, output_fields=output_fields
            )
            for hits in raw:
                for hit in hits:
                    all_results.append({
                        "content": hit.entity.get("content"),
                        "title": hit.entity.get("title"),
                        "section": hit.entity.get("section"),
                        "tag": hit.entity.get("tags"),
                        "question1": hit.entity.get("question1"),
                        "question2": hit.entity.get("question2"),
                        "source_file": hit.entity.get("source_file"),
                        "field": field,
                        "page_num": 5,
                        "score": hit.distance * weight
                    })

        return _deduplicate_and_rank_results(all_results, limit=limit)

    def delete_collection(self):
        connections.connect(host=MILVUS_HOST)
        Collection(name=self.collection_name).drop()


def main():
    manager = MilvusDbManager(collection_name="test_chunks")
    manager.initialize()

    test_chunk = {
        "title": "测试标题",
        "section": "1.1",
        "parent_title": "测试父标题",
        "parent_section": "1",
        "content": "这是一个用于测试的段落内容。",
        "question1": "这个段落在讲什么？",
        "question2": "这个内容有什么应用？",
        "tags": "测试",
        "source_file": "test_doc.txt"
    }

    manager.insert_chunk(test_chunk)

    print("\n=== 搜索结果 ===")
    results = manager.search("这个段落讲了什么？")
    for res in results:
        print(f"[内容] {res['content']}")
        print(f"[标题] {res['title']}")
        print(f"[分数] {res['score']:.4f}")
        print("-" * 40)


if __name__ == "__main__":
    manager = MilvusDbManager("specs_architecture")
    manager.delete_collection()