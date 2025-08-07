import json
import os
import shutil
import uuid
import threading
from datetime import datetime
from pathlib import Path

from src.service.split_md_into_chunks import MarkdownChunker
from src.infrastructure.milvus_db import MilvusDbManager
from src.service.question_generator import generate_questions_for_chunk
from src.utils.vector_utils import prepare_chunk_for_insert
from src.service.convet_pdf2md_mineru import convert_pdf_to_markdown

class PDFService:
    def __init__(self, base_dir,llm_model_name):
        self.base_dir = base_dir
        self.upload_dir = os.path.join(base_dir, 'uploads')
        self.processed_dir = os.path.join(base_dir, 'processed_pdfs')
        self.temp_dir = os.path.join(base_dir, 'temp')
        self.active_processing_threads = {}
        self.thread_stop_events = {}
        self.llm_model_name = llm_model_name
        
        # 确保目录存在
        for dir_path in [self.upload_dir, self.processed_dir, self.temp_dir]:
            os.makedirs(dir_path, exist_ok=True)
    
    def upload_pdf(self, file):
        """处理单个PDF上传"""
        if not file.filename.lower().endswith('.pdf'):
            raise ValueError('只支持PDF文件')
        
        file_id = str(uuid.uuid4())
        original_filename = file.filename
        pdf_filename = original_filename
        pdf_path = os.path.join(self.upload_dir, pdf_filename)
        
        # 保存上传的PDF
        file.save(pdf_path)
        
        # 创建初始处理信息
        processed_info = {
            'id': file_id,
            'original_name': original_filename,
            'filename': pdf_filename,
            'upload_date': datetime.now().isoformat(),
            'file_size': os.path.getsize(pdf_path),
            'chunks_count': 0,
            'status': 'uploading',
            'md_content': '',
            'chunks': [],
            'processing_steps': {
                'current_step': 0,
                'total_steps': 5,
                'description': '等待处理...'
            }
        }
        
        # 保存初始信息
        info_file = os.path.join(self.processed_dir, f"{file_id}.json")
        with open(info_file, 'w', encoding='utf-8') as f:
            json.dump(processed_info, f, ensure_ascii=False, indent=2)
        
        # 启动后台处理
        self._start_background_processing(pdf_path, file_id, original_filename, pdf_filename)
        
        return {
            'success': True,
            'message': 'PDF上传成功，正在后台处理中...',
            'filename': pdf_filename,
            'file_id': file_id,
            'status': 'uploading'
        }
    
    def upload_pdfs_batch(self, files):
        """批量PDF上传"""
        results = []
        
        for file in files:
            if file.filename == '':
                continue
                
            try:
                result = self.upload_pdf(file)
                results.append({
                    'filename': file.filename,
                    'success': True,
                    'file_id': result['file_id'],
                    'status': result['status']
                })
            except Exception as e:
                results.append({
                    'filename': file.filename,
                    'success': False,
                    'error': str(e)
                })
        
        return {
            'success': True,
            'message': f'批量上传完成，共处理 {len(results)} 个文件',
            'results': results
        }
    
    def _start_background_processing(self, pdf_path, file_id, original_filename, pdf_filename):
        """启动后台处理线程"""
        stop_event = threading.Event()
        self.thread_stop_events[file_id] = stop_event
        
        thread = threading.Thread(
            target=self._process_pdf_background,
            args=(pdf_path, file_id, original_filename, pdf_filename, stop_event)
        )
        thread.daemon = True
        thread.start()
        
        self.active_processing_threads[file_id] = thread
    
    def _process_pdf_background(self, pdf_path, file_id, original_filename, pdf_filename, stop_event=None):
        """后台处理PDF文件"""
        try:
            print(f"开始后台处理PDF: {pdf_filename}")
            
            if stop_event and stop_event.is_set():
                return
            
            # 步骤1: 文件验证
            self._update_processing_status(file_id, 'processing', '文件验证中..', 1, 5)
            if not os.path.exists(pdf_path):
                self._update_processing_status(file_id, 'failed', 'PDF文件不存在')
                return
            
            # 创建临时目录
            temp_dir = os.path.join(self.temp_dir, file_id)
            os.makedirs(temp_dir, exist_ok=True)
            
            if stop_event and stop_event.is_set():
                self._update_processing_status(file_id, 'cancelled', '处理已取消')
                return
            
            # 步骤2-3: PDF转Markdown
            self._update_processing_status(file_id, 'processing', 'PDF转Markdown�?..', 3, 5)
            md_path = convert_pdf_to_markdown(pdf_path, temp_dir)
            
            if not md_path:
                self._update_processing_status(file_id, 'failed', f'PDF转换失败: {pdf_filename}')
                return
            
            if stop_event and stop_event.is_set():
                self._update_processing_status(file_id, 'cancelled', '处理已取消')
                return
            
            # 步骤4: 内容切片
            self._update_processing_status(file_id, 'processing', '内容切片�?..', 4, 5)
            
            with open(md_path, 'r', encoding='utf-8') as f:
                md_content = f.read()
            
            mdc = MarkdownChunker(md_content)
            chunks = mdc.run()
            
            # 为每个chunk生成问题和tags
            for i, chunk in enumerate(chunks):
                if stop_event and stop_event.is_set():
                    self._update_processing_status(file_id, 'cancelled', '处理已取消')
                    return
                
                try:
                    questions_tag_dict = generate_questions_for_chunk(chunk,self.llm_model_name)
                    chunk.update(questions_tag_dict)
                except Exception as e:
                    print(f"为chunk {i+1}生成问题失败: {e}")
                    chunk.update({
                        'question1': '',
                        'question2': '',
                        'question3': '',
                        'tags': ''
                    })
            
            if stop_event and stop_event.is_set():
                self._update_processing_status(file_id, 'cancelled', '处理已取消')
                return
            
            # 步骤5: 存储到数据库
            self._update_processing_status(file_id, 'processing', f'存储到数据库 ({len(chunks)} chunks)...', 5, 5)
            self._save_chunks_to_milvus(chunks, pdf_filename, "specs_architecture_v1")
            
            # 完成处理
            processed_info = {
                'id': file_id,
                'original_name': original_filename,
                'filename': pdf_filename,
                'upload_date': datetime.now().isoformat(),
                'file_size': os.path.getsize(pdf_path),
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
            
            info_file = os.path.join(self.processed_dir, f"{file_id}.json")
            with open(info_file, 'w', encoding='utf-8') as f:
                json.dump(processed_info, f, ensure_ascii=False, indent=2)
            
            # 清理临时文件
            shutil.rmtree(temp_dir, ignore_errors=True)
            
            print(f"PDF处理完成: {pdf_filename}, {len(chunks)} chunks")
            
        except Exception as e:
            print(f"PDF处理失败: {e}")
            self._update_processing_status(file_id, 'failed', f'处理失败: {str(e)}')
        finally:
            # 清理线程记录
            if file_id in self.active_processing_threads:
                del self.active_processing_threads[file_id]
            if file_id in self.thread_stop_events:
                del self.thread_stop_events[file_id]
    
    def _update_processing_status(self, file_id, status, description='', current_step=0, total_steps=0):
        """更新处理状态"""
        try:
            info_file = os.path.join(self.processed_dir, f"{file_id}.json")
            if os.path.exists(info_file):
                with open(info_file, 'r', encoding='utf-8') as f:
                    info = json.load(f)
                
                info['status'] = status
                info['processing_steps'] = {
                    'current_step': current_step,
                    'total_steps': total_steps,
                    'description': description
                }
                
                with open(info_file, 'w', encoding='utf-8') as f:
                    json.dump(info, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"更新处理状态失�? {e}")
    
    def _save_chunks_to_milvus(self, chunks, source_filename, collection_name):
        """保存chunks到Milvus数据库"""
        try:
            manager = MilvusDbManager(collection_name=collection_name)
            manager.initialize()
            
            source_base_info = {
                "year": source_filename.split('-')[1][:4] if '-' in source_filename else "",
                "source_file": source_filename,
            }
            
            for chunk in chunks:
                data = prepare_chunk_for_insert(chunk, source_base_info)
                manager.insert_chunk(data)
            
            print(f"成功存储 {len(chunks)} 个chunks到Milvus")
            
        except Exception as e:
            print(f"存储到Milvus失败: {e}")
            raise
    
    def get_pdf_list(self):
        """获取已处理的PDF文件列表"""
        pdf_files = []
        
        if os.path.exists(self.processed_dir):
            for filename in os.listdir(self.processed_dir):
                if filename.endswith('.json'):
                    info_file = os.path.join(self.processed_dir, filename)
                    try:
                        with open(info_file, 'r', encoding='utf-8') as f:
                            info = json.load(f)
                        
                        pdf_files.append({
                            'id': info['id'],
                            'name': info['original_name'],
                            'date': info['upload_date'][:10],
                            'size': f"{info['file_size'] / 1024 / 1024:.1f} MB",
                            'status': info['status'],
                            'fileUrl': f'/uploads/{info["filename"]}',
                            'chunksCount': info['chunks_count'],
                            'fileId': info['id']
                        })
                    except Exception as e:
                        print(f"读取处理信息失败 {filename}: {e}")
                        continue
        
        pdf_files.sort(key=lambda x: x['date'], reverse=True)
        return pdf_files
    
    def get_processed_info(self, file_id):
        """获取已处理PDF的详细信息"""
        info_file = os.path.join(self.processed_dir, f"{file_id}.json")
        if not os.path.exists(info_file):
            raise FileNotFoundError('文件不存在')
        
        with open(info_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def get_processed_markdown(self, file_id):
        """获取已处理PDF的Markdown内容"""
        info = self.get_processed_info(file_id)
        return info.get('md_content', '')
    
    def get_processing_status(self):
        """获取所有文件的处理状态"""
        processing_files = []
        
        if os.path.exists(self.processed_dir):
            for filename in os.listdir(self.processed_dir):
                if filename.endswith('.json'):
                    info_file = os.path.join(self.processed_dir, filename)
                    try:
                        with open(info_file, 'r', encoding='utf-8') as f:
                            info = json.load(f)
                        
                        if info['status'] in ['uploading', 'processing']:
                            processing_files.append({
                                'id': info['id'],
                                'name': info['original_name'],
                                'status': info['status'],
                                'processing_steps': info.get('processing_steps', {})
                            })
                    except Exception as e:
                        print(f"读取处理状态失败{filename}: {e}")
                        continue
        
        return processing_files
    
    def delete_pdf(self, file_id):
        """删除PDF文件及相关数据"""
        # 终止正在处理的线程
        if file_id in self.active_processing_threads:
            if file_id in self.thread_stop_events:
                self.thread_stop_events[file_id].set()
            
            thread = self.active_processing_threads[file_id]
            thread.join(timeout=5.0)
            
            if file_id in self.active_processing_threads:
                del self.active_processing_threads[file_id]
            if file_id in self.thread_stop_events:
                del self.thread_stop_events[file_id]
        
        # 获取PDF信息
        info = self.get_processed_info(file_id)
        pdf_filename = info.get('filename')
        original_name = info.get('original_name')
        
        # 删除文件
        pdf_path = os.path.join(self.upload_dir, pdf_filename)
        if os.path.exists(pdf_path):
            os.remove(pdf_path)
        
        # 删除临时目录
        temp_dir = os.path.join(self.temp_dir, file_id)
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
        
        # 删除数据库数�?
        try:
            manager = MilvusDbManager(collection_name="specs_architecture_v1")
            filename_without_ext = os.path.splitext(original_name)[0]
            delete_expr = f'source_file == "{filename_without_ext}"'
            manager.delete_by_expr(delete_expr)
        except Exception as e:
            print(f"删除Milvus数据失败: {e}")
        
        # 删除处理信息文件
        info_file = os.path.join(self.processed_dir, f"{file_id}.json")
        if os.path.exists(info_file):
            os.remove(info_file)
        
        return f'PDF文件 {original_name} 及相关数据已成功删除'
