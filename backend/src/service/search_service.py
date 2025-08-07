from src.infrastructure.milvus_db import MilvusDbManager
from src.service.split_md_into_chunks import match_explanation_pairs
from src.service.keyword_generator import generate_keyword_for_query
import os
import json

class SearchService:
    def __init__(self, processed_dir):
        self.processed_dir = processed_dir
    
    def search(self, query, model_name=None, limit=10):
        """搜索接口"""
        if not query:
            raise ValueError('查询参数不能为空')
        
        manager = MilvusDbManager(collection_name="specs_architecture_v1")
        results = manager.search(query,model_name, limit=limit)
        
        # 过滤掉content为空的结果
        filtered_results = [result for result in results if result.get('content') and result.get('content').strip()]
        
        return filtered_results
    
    def extract_keywords(self, query, model_name=None):
        """提取查询关键词的拆分结果"""
        if not query:
            raise ValueError('查询参数不能为空')
        
        try:
            keywords = generate_keyword_for_query(model_name, query=query)
            return keywords
        except Exception as e:
            print(f"关键词提取失败: {e}")
            # 如果关键词提取失败，返回原始查询作为备选
            return {
                "material_keywords": [query],
                "functional_keywords": [],
                "component_keywords": [],
                "process_keywords": [],
                "similar_task_keywords": [],
                "combinational_keywords": []
            }
    
    def search_by_keywords(self, selected_keywords, filter_type='topN', top_n=10, threshold=0.7):
        """基于选定关键词进行检索，只使用tags_vector"""
        if not selected_keywords:
            raise ValueError('请选择至少一个关键词')

        print("执行带参数的关键词检索")
        manager = MilvusDbManager(collection_name="specs_architecture_v1")
        results = manager.search_by_keywords_tags_only(selected_keywords, filter_type, top_n, threshold)
        
        # 过滤掉content为空的结果
        filtered_results = [result for result in results if result.get('content') and result.get('content').strip()]
        
        return filtered_results
    
    def search_with_settings(self, query, model_name, keywords=None, filter_type='topN', top_n=10, threshold=0.7):
        """带设置的搜索，支持混合检索时指定关键词"""
        try:
            print("执行带参数的混合检索")
            manager = MilvusDbManager(collection_name="specs_architecture_v1")
            if keywords:
                results = manager.search_with_keywords(query, keywords, filter_type, top_n, threshold)
            else:
                raise ValueError('请选择至少一个关键词')
            
            # 过滤掉content为空的结果
            filtered_results = [result for result in results if result.get('content') and result.get('content').strip()]
            
            return filtered_results
        except Exception as e:
            print(f"搜索失败: {e}")
            raise e
    
    def get_explanation_pairs_by_source(self, source_file):
        """根据源文件名获取解释对"""
        if os.path.exists(self.processed_dir):
            for filename in os.listdir(self.processed_dir):
                if filename.endswith('.json'):
                    info_file = os.path.join(self.processed_dir, filename)
                    try:
                        with open(info_file, 'r', encoding='utf-8') as f:
                            info = json.load(f)
                        
                        if info.get('original_name', '') == source_file:
                            chunks = info.get('chunks', [])
                            explanation_pairs = match_explanation_pairs(chunks)
                            
                            return {
                                'source_file': source_file,
                                'file_id': info['id'],
                                'explanation_pairs': explanation_pairs
                            }
                    except Exception as e:
                        print(f"读取文件信息失败 {filename}: {e}")
                        continue
        
        raise FileNotFoundError('未找到指定的源文件')
