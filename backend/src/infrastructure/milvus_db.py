import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))
from pymilvus import MilvusClient, DataType, connections, Collection
from sentence_transformers import SentenceTransformer
from src.service.keyword_generator import generate_keyword_for_query

DEFAULT_QWEN_DIM = 1024
MILVUS_HOST = os.getenv("MILVUS_HOST", "localhost")


def _deduplicate_and_rank_results(results, limit):
    content_map = {}
    for r in results:
        key = r["content"]
        if key not in content_map or r["score"] > content_map[key]["score"]:
            content_map[key] = r
    return sorted(content_map.values(), key=lambda x: x["score"], reverse=True)[:limit]

def _deduplicate_by_id_and_rank_results(results):
    "按照id去重并排序结"
    id_map = {}
    for r in results:
        key = r["id"]
        if key not in id_map or r["score"] < id_map[key]["score"]:
            id_map[key] = r
    return sorted(id_map.values(), key=lambda x: x["score"])

def get_topN_data_for_keyword(top_n,results):
    """
    按matched_keyword分组，对每个关键词对应的数据取top数据
    Args:
        results: 搜索结果列表
        top_n: 每个关键词组取的top数量
    Returns:
        按关键词分组后取top的结果列表
    """
    # 按matched_keyword分组
    keyword_groups = {}
    for result in results:
        keyword = result.get('matched_keyword', '')
        if keyword not in keyword_groups:
            keyword_groups[keyword] = []
        keyword_groups[keyword].append(result)
    # 对每个关键词组取top_n数据
    final_results = []
    for keyword, group_results in keyword_groups.items():
        # 按score排序（score越小越好）
        sorted_group = sorted(group_results, key=lambda x: x.get('score', float('inf')))
        # 取每个关键词的top_n结果
        final_results.extend(sorted_group[:top_n])

    # 最终结果按score排序
    return sorted(final_results, key=lambda x: x.get('score', float('inf')))


class EmbeddingModelWrapper:
    def __init__(self, model_name="./models/Qwen3-Embedding-0.6B", device="cpu", dim=DEFAULT_QWEN_DIM):
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

    def search(self, query_text, model_name=None,limit=10):
        # 首先使用关键词扩展
        try:
            expanded_keywords = generate_keyword_for_query(model_name,query=query_text)
            print(f"关键词扩展结果 {expanded_keywords}")
        except Exception as e:
            print(f"关键词扩展失败，使用原始查询: {e}")
            expanded_keywords = {}
        
        # 收集所有扩展的关键�?
        all_keywords = [query_text]  # 包含原始查询
        
        if expanded_keywords:
            for keyword_type, keywords in expanded_keywords.items():
                if isinstance(keywords, list):
                    all_keywords.extend(keywords)
        
        print(f"总共查询关键词数量 {len(all_keywords)}")
        
        connections.connect(host=MILVUS_HOST)
        Collection(name=self.collection_name).load()
        
        all_results = []
        # 在search方法中修改output_fields
        output_fields = [
            "content", "title", "section", "tags",
            "question1", "question2", "source_file",
            "text_role"  # 添加text_role字段
        ]
        
        # 遍历所有关键词进行查询
        for keyword in all_keywords:
            if not keyword or not keyword.strip():
                continue
                
            query_vector = self.encoder.encode(keyword, label=f"keyword: {keyword}")
            
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
                            "id": hit.entity.get("id"),
                            "content": hit.entity.get("content"),
                            "title": hit.entity.get("title"),
                            "section": hit.entity.get("section"),
                            "tag": hit.entity.get("tags"),
                            "question1": hit.entity.get("question1"),
                            "question2": hit.entity.get("question2"),
                            "source_file": hit.entity.get("source_file"),
                            "field": field,
                            "page_num": 5,
                            "score": hit.distance * weight,
                            "matched_keyword": keyword,
                            "text_role": hit.entity.get("text_role") # 记录匹配的关键词
                        })
        
        # 按照id去重并排序
        return _deduplicate_by_id_and_rank_results(all_results)
    
    def search_by_keywords_tags_only(self, keywords, filter_type='topN', top_n=10, threshold=0.7):
        """基于关键词列表进行检索，只使用tags_vector进行匹配"""
        connections.connect(host=MILVUS_HOST)
        Collection(name=self.collection_name).load()
        
        all_results = []
        output_fields = [
            "content", "title", "section", "tags",
            "question1", "question2", "source_file",
            "text_role"
        ]
        
        # 设置搜索限制
        limit = top_n if filter_type == 'topN' else 100
        
        # 遍历所有关键词，只在tags_vector中搜索
        for keyword in keywords:
            if not keyword or not keyword.strip():
                continue
            query_vector = self.encoder.encode(keyword, label=f"keyword: {keyword}")
            
            # 只在tags_vector中搜索，权重设为1.0
            raw = Collection(self.collection_name).search(
                data=[query_vector], anns_field="tags_vector",
                param={"metric_type": "COSINE", "params": {"ef": 128}},
                limit=limit, output_fields=output_fields
            )
            
            for hits in raw:
                for hit in hits:
                    # 应用阈值筛选
                    if filter_type == 'threshold' and hit.distance > threshold:
                        continue
                        
                    all_results.append({
                        "id": hit.entity.get("id"),
                        "content": hit.entity.get("content"),
                        "title": hit.entity.get("title"),
                        "section": hit.entity.get("section"),
                        "tag": hit.entity.get("tags"),
                        "question1": hit.entity.get("question1"),
                        "question2": hit.entity.get("question2"),
                        "source_file": hit.entity.get("source_file"),
                        "field": "tags_vector",
                        "page_num": 5,
                        "score": hit.distance,
                        "matched_keyword": keyword,
                        "text_role": hit.entity.get("text_role")
                    })
        
        # 按照id去重并排序
        deduplicated_results = _deduplicate_by_id_and_rank_results(all_results)
            
        return deduplicated_results

    def search_with_keywords(self, query, keywords, filter_type='topN', top_n=10, threshold=0.7):
        """
        混合检索：结合查询文本和指定关键词进行搜索
        参考search方法的实现逻辑，使用关键词扩展和多字段权重搜索
        """
        # 收集所有扩展的关键词
        all_keywords = [query]

        for keyword in keywords:
            if not keyword or not keyword.strip():
                continue
            all_keywords.append(keyword)
        
        print(f"总共查询关键词数量 {len(all_keywords)}")
        
        connections.connect(host=MILVUS_HOST)
        Collection(name=self.collection_name).load()
        
        all_results = []
        # 在search方法中修改output_fields
        output_fields = [
            "content", "title", "section", "tags",
            "question1", "question2", "source_file",
            "text_role"  # 添加text_role字段
        ]
        
        # 设置搜索限制
        limit = top_n if filter_type == 'topN' else 100
        
        # 遍历所有关键词进行查询
        for keyword in all_keywords:
            if not keyword or not keyword.strip():
                continue
                
            query_vector = self.encoder.encode(keyword, label=f"keyword: {keyword}")
            
            for field, weight in zip([
                "tags_vector",
                "question1_vector", "question2_vector",
                "content_vector"
            ], [1.8, 1.2, 1.0, 1.5]):
                try:
                    raw = Collection(self.collection_name).search(
                        data=[query_vector], anns_field=field,
                        param={"metric_type": "COSINE", "params": {"ef": 128}},
                        limit=limit, output_fields=output_fields
                    )
                    for hits in raw:
                        for hit in hits:
                            # 应用阈值筛选
                            if filter_type == 'threshold' and hit.distance * weight > threshold:
                                continue
                                
                            all_results.append({
                                "id": hit.entity.get("id"),
                                "content": hit.entity.get("content"),
                                "title": hit.entity.get("title"),
                                "section": hit.entity.get("section"),
                                "tag": hit.entity.get("tags"),
                                "question1": hit.entity.get("question1"),
                                "question2": hit.entity.get("question2"),
                                "source_file": hit.entity.get("source_file"),
                                "field": field,
                                "page_num": 5,
                                "score": hit.distance * weight,
                                "matched_keyword": keyword,
                                "text_role": hit.entity.get("text_role")  # 记录匹配的关键词
                            })
                except Exception as e:
                    print(f"在字段 {field} 中搜索关键词 '{keyword}' 失败: {e}")
                    continue
        
        # 按照id去重并排序
        deduplicated_results = _deduplicate_by_id_and_rank_results(all_results)
            
        return deduplicated_results

    def delete_by_expr(self, expr):
        """根据表达式删除数"""
        try:
            connections.connect(host=MILVUS_HOST)
            collection = Collection(self.collection_name)
            collection.delete(expr)
            collection.flush()
            print(f"已删除数据 {expr}")
            return True
        except Exception as e:
            print(f"删除数据失败: {e}")
            return False

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
        "content": "这是一个用于测试的段落内容",
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
