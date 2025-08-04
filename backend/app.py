import json
import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import shutil
import subprocess
import uuid
from datetime import datetime
from pathlib import Path
import threading

from flask import Flask, request, jsonify, Response
from flask import send_from_directory
from flask_cors import CORS

from backend.src.service.split_md_into_chunks import MarkdownChunker
from backend.src.infrastructure.milvus_db import MilvusDbManager
from backend.src.service.question_generator import generate_questions_for_chunk
from backend.src.utils.vector_utils import prepare_chunk_for_insert
from backend.src.service.split_md_into_chunks import match_explanation_pairs
from backend.src.infrastructure.envoke_llm import LLMAPIFactory

app = Flask(__name__)
CORS(app)

import os

# 目录配置
BASE_DIR = os.getcwd()

# 确保目录存在
PDF_DIR = os.path.join(BASE_DIR, 'uploads')
UPLOAD_DIR = os.path.join(BASE_DIR, 'uploads')
PROCESSED_DIR = os.path.join(BASE_DIR, 'processed_pdfs')
TEMP_DIR = os.path.join(BASE_DIR, 'temp')

# 创建必要的目录
for dir_path in [PDF_DIR, UPLOAD_DIR, PROCESSED_DIR, TEMP_DIR]:
    os.makedirs(dir_path, exist_ok=True)
    print(f"确保目录存在: {dir_path}")

# 确保目录存在
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)
os.makedirs(TEMP_DIR, exist_ok=True)

# 全局线程管理字典
active_processing_threads = {}
thread_stop_events = {}

@app.route('/pdfs/<path:filename>')
def serve_pdf(filename):
    """提供PDF文件访问"""
    return send_from_directory(PDF_DIR, filename)


@app.route('/search', methods=['GET'])
def search_endpoint():
    """搜索接口"""
    try:
        query = request.args.get('query', '')
        if not query:
            return jsonify({'error': '查询参数不能为空'}), 400
        
        # 使用Milvus进行搜索
        manager = MilvusDbManager(collection_name="specs_architecture_v1")
        results = manager.search(query, limit=10)
        
        return jsonify({'results': results})
    except Exception as e:
        return jsonify({'error': f'搜索失败: {str(e)}'}), 500


@app.route('/upload-pdf', methods=['POST'])
def upload_pdf():
    """PDF上传接口（立即返回，后台处理）"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': '没有文件'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': '没有选择文件'}), 400

        if not file.filename.lower().endswith('.pdf'):
            return jsonify({'error': '只支持PDF文件'}), 400

        # 生成唯一ID，但保持原文件名
        file_id = str(uuid.uuid4())
        original_filename = file.filename
        pdf_filename = original_filename  # 保持原文件名
        pdf_path = os.path.join(UPLOAD_DIR, pdf_filename)

        # 保存上传的PDF
        file.save(pdf_path)

        # 创建初始处理信息（状态为uploading）
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
        info_file = os.path.join(PROCESSED_DIR, f"{file_id}.json")
        with open(info_file, 'w', encoding='utf-8') as f:
            json.dump(processed_info, f, ensure_ascii=False, indent=2)

        # 创建线程停止事件
        stop_event = threading.Event()
        thread_stop_events[file_id] = stop_event

        # 启动后台处理
        thread = threading.Thread(target=process_pdf_background, args=(pdf_path, file_id, original_filename, pdf_filename, stop_event))
        thread.daemon = True
        thread.start()
        
        # 记录活跃线程
        active_processing_threads[file_id] = thread

        return jsonify({
            'success': True,
            'message': 'PDF上传成功，正在后台处理中...',
            'filename': pdf_filename,
            'file_id': file_id,
            'status': 'uploading'
        })

    except Exception as e:
        print(f"PDF上传失败: {e}")
        return jsonify({'error': f'PDF上传失败: {str(e)}'}), 500


@app.route('/upload-pdfs-batch', methods=['POST'])
def upload_pdfs_batch():
    """批量PDF上传接口"""
    try:
        if 'files' not in request.files:
            return jsonify({'error': '没有文件'}), 400

        files = request.files.getlist('files')
        if not files:
            return jsonify({'error': '没有选择文件'}), 400

        results = []
        
        for file in files:
            if file.filename == '':
                continue
                
            if not file.filename.lower().endswith('.pdf'):
                results.append({
                    'filename': file.filename,
                    'success': False,
                    'error': '只支持PDF文件'
                })
                continue

            try:
                # 生成唯一ID，但保持原文件名
                file_id = str(uuid.uuid4())
                original_filename = file.filename
                pdf_filename = original_filename
                pdf_path = os.path.join(UPLOAD_DIR, pdf_filename)

                # 如果文件已存在，生成新的文件名
                counter = 1
                base_name, ext = os.path.splitext(pdf_filename)
                while os.path.exists(pdf_path):
                    pdf_filename = f"{base_name}_{counter}{ext}"
                    pdf_path = os.path.join(UPLOAD_DIR, pdf_filename)
                    counter += 1

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
                info_file = os.path.join(PROCESSED_DIR, f"{file_id}.json")
                with open(info_file, 'w', encoding='utf-8') as f:
                    json.dump(processed_info, f, ensure_ascii=False, indent=2)

                # 创建线程停止事件
                stop_event = threading.Event()
                thread_stop_events[file_id] = stop_event

                # 启动后台处理
                thread = threading.Thread(target=process_pdf_background, args=(pdf_path, file_id, original_filename, pdf_filename, stop_event))
                thread.daemon = True
                thread.start()
                
                # 记录活跃线程
                active_processing_threads[file_id] = thread

                results.append({
                    'filename': original_filename,
                    'success': True,
                    'file_id': file_id,
                    'status': 'uploading'
                })

            except Exception as e:
                print(f"处理文件 {file.filename} 失败: {e}")
                results.append({
                    'filename': file.filename,
                    'success': False,
                    'error': str(e)
                })

        return jsonify({
            'success': True,
            'message': f'批量上传完成，共处理 {len(results)} 个文件',
            'results': results
        })

    except Exception as e:
        print(f"批量PDF上传失败: {e}")
        return jsonify({'error': f'批量PDF上传失败: {str(e)}'}), 500


def process_pdf_background(pdf_path, file_id, original_filename, pdf_filename, stop_event=None):
    """后台处理PDF文件（支持中断）"""
    try:
        print(f"开始后台处理PDF: {pdf_filename}")
        
        # 检查是否需要停止
        if stop_event and stop_event.is_set():
            print(f"处理被中断: {pdf_filename}")
            return
            
        # 步骤1: 文件验证 (1/5)
        update_processing_status(file_id, 'processing', '文件验证中...', 1, 5)
        if not os.path.exists(pdf_path):
            update_processing_status(file_id, 'failed', 'PDF文件不存在')
            return
        
        # 创建临时目录用于处理
        temp_dir = os.path.join(TEMP_DIR, file_id)
        os.makedirs(temp_dir, exist_ok=True)

        # 检查是否需要停止
        if stop_event and stop_event.is_set():
            print(f"处理被中断: {pdf_filename}")
            update_processing_status(file_id, 'cancelled', '处理已取消')
            return

        # 步骤2: PDF解析 (2/5)
        update_processing_status(file_id, 'processing', 'PDF解析中...', 2, 5)
        print(f"开始解析PDF: {pdf_filename}")
        
        # 检查是否需要停止
        if stop_event and stop_event.is_set():
            print(f"处理被中断: {pdf_filename}")
            update_processing_status(file_id, 'cancelled', '处理已取消')
            return
        
        # 步骤3: PDF转Markdown (3/5)
        update_processing_status(file_id, 'processing', 'PDF转Markdown中...', 3, 5)
        print(f"开始转换PDF: {pdf_filename}")
        md_path = convert_pdf_to_markdown(pdf_path, temp_dir)

        if not md_path:
            update_processing_status(file_id, 'failed', f'PDF转换失败: {pdf_filename}')
            return

        # 检查是否需要停止
        if stop_event and stop_event.is_set():
            print(f"处理被中断: {pdf_filename}")
            update_processing_status(file_id, 'cancelled', '处理已取消')
            return

        # 步骤4: 内容切片 (4/5)
        update_processing_status(file_id, 'processing', '内容切片中...', 4, 5)
        print("开始切片处理...")
        
        # 读取Markdown内容
        with open(md_path, 'r', encoding='utf-8') as f:
            md_content = f.read()

        # 分割成chunks
        mdc = MarkdownChunker(md_content)
        chunks = mdc.run()
        
        # 为每个chunk生成问题和tags
        print("为chunks生成问题和tags...")
        for i, chunk in enumerate(chunks):
            # 检查是否需要停止
            if stop_event and stop_event.is_set():
                print(f"处理被中断: {pdf_filename}")
                update_processing_status(file_id, 'cancelled', '处理已取消')
                return
                
            try:
                print(f"处理chunk {i+1}/{len(chunks)}...")
                # 生成问题
                questions_tag_dict = generate_questions_for_chunk(chunk)
                print(f"生成结果: {questions_tag_dict}")
                # 将问题和tags添加到chunk中
                chunk.update(questions_tag_dict)
            except Exception as e:
                print(f"为chunk {i+1}生成问题失败: {e}")
                # 如果生成失败，添加空的tags
                chunk.update({
                    'question1': '',
                    'question2': '',
                    'question3': '',
                    'tags': ''
                })

        # 检查是否需要停止
        if stop_event and stop_event.is_set():
            print(f"处理被中断: {pdf_filename}")
            update_processing_status(file_id, 'cancelled', '处理已取消')
            return

        # 步骤5: 存储到数据库 (5/5)
        update_processing_status(file_id, 'processing', f'存储到数据库 ({len(chunks)} chunks)...', 5, 5)
        print(f"开始存储 {len(chunks)} 个chunks到Milvus...")
        save_chunks_to_milvus(chunks, pdf_filename, "specs_architecture_v1")

        # 完成: 更新处理信息为完成状态
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

        # 保存完成信息
        info_file = os.path.join(PROCESSED_DIR, f"{file_id}.json")
        with open(info_file, 'w', encoding='utf-8') as f:
            json.dump(processed_info, f, ensure_ascii=False, indent=2)

        # 清理临时文件
        shutil.rmtree(temp_dir, ignore_errors=True)
        
        print(f"PDF处理完成: {pdf_filename}, {len(chunks)} chunks")

    except Exception as e:
        print(f"PDF处理失败: {e}")
        update_processing_status(file_id, 'failed', f'处理失败: {str(e)}')
    finally:
        # 清理线程记录
        if file_id in active_processing_threads:
            del active_processing_threads[file_id]
        if file_id in thread_stop_events:
            del thread_stop_events[file_id]


def update_processing_status(file_id, status, description='', current_step=0, total_steps=0):
    """更新处理状态"""
    try:
        info_file = os.path.join(PROCESSED_DIR, f"{file_id}.json")
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
        print(f"更新处理状态失败: {e}")


def convert_pdf_to_markdown(pdf_path, output_dir):
    """使用mineru将PDF转换为Markdown"""
    try:
        # 假设mineru在系统PATH中，或者指定完整路径
        mineru_exe = "mineru"  # 可能需要修改为完整路径

        cmd = [
            mineru_exe,
            "-p", pdf_path,
            "-o", output_dir,
            "--source", "modelscope"
        ]

        print(cmd)

        subprocess.run(
            cmd,
            check=True,
            capture_output=True,
            text=True,
            encoding="utf-8",  # 明确指定编码为 utf-8
            errors="ignore"  # 忽略无法解码的字符（或用 "replace" 替换为�）
        )

        # 获取PDF文件名（不含扩展名）
        pdf_name = Path(pdf_path).stem

        # mineru生成的结构是: output_dir/{pdf_name}/auto/{pdf_name}.md
        md_path = Path(output_dir) / pdf_name / "auto" / f"{pdf_name}.md"

        if md_path.exists():
            print(f"找到markdown文件: {md_path}")
            return str(md_path)

        # 如果上面的路径不存在，尝试查找其他可能的路径
        md_files = list(Path(output_dir).rglob("*.md"))
        if md_files:
            print(f"找到markdown文件: {md_files[0]}")
            return str(md_files[0])

        print(f"未找到markdown文件，检查目录: {output_dir}")
        return None

    except subprocess.CalledProcessError as e:
        print(f"mineru转换失败: {e}")
        return None
    except Exception as e:
        print(f"转换过程出错: {e}")
        return None


def save_chunks_to_milvus(chunks, source_filename,collection_name):
    """保存chunks到Milvus数据库"""
    try:
        manager = MilvusDbManager(collection_name=collection_name)
        manager.initialize()

        source_base_info = {
            "year": source_filename.split('-')[1][:4] if '-' in source_filename else "",
            "source_file": source_filename,
        }

        for chunk in chunks:

            # 准备数据
            data = prepare_chunk_for_insert(chunk, source_base_info)

            # 插入到Milvus
            manager.insert_chunk(data)

        print(f"成功存储 {len(chunks)} 个chunks到Milvus")

    except Exception as e:
        print(f"存储到Milvus失败: {e}")
        raise


@app.route('/pdf-list', methods=['GET'])
def get_pdf_list():
    """获取已处理的PDF文件列表"""
    try:
        pdf_files = []

        # 从processed_pdfs目录读取处理信息
        if os.path.exists(PROCESSED_DIR):
            for filename in os.listdir(PROCESSED_DIR):
                if filename.endswith('.json'):
                    info_file = os.path.join(PROCESSED_DIR, filename)
                    try:
                        with open(info_file, 'r', encoding='utf-8') as f:
                            info = json.load(f)

                        pdf_files.append({
                            'id': info['id'],
                            'name': info['original_name'],
                            'date': info['upload_date'][:10],  # 取日期部分
                            'size': f"{info['file_size'] / 1024 / 1024:.1f} MB",
                            'status': info['status'],
                            'fileUrl': f'/uploads/{info["filename"]}',
                            'chunksCount': info['chunks_count'],
                            'fileId': info['id']
                        })
                    except Exception as e:
                        print(f"读取处理信息失败 {filename}: {e}")
                        continue

        # 按上传时间倒序排列
        pdf_files.sort(key=lambda x: x['date'], reverse=True)

        return jsonify({'pdfs': pdf_files})

    except Exception as e:
        return jsonify({'error': f'获取文件列表失败: {str(e)}'}), 500


@app.route('/uploads/<path:filename>')
def serve_uploaded_pdf(filename):
    """提供上传的PDF文件访问"""
    return send_from_directory(UPLOAD_DIR, filename)


@app.route('/processed/<file_id>', methods=['GET'])
def get_processed_info(file_id):
    """获取已处理PDF的详细信息"""
    try:
        info_file = os.path.join(PROCESSED_DIR, f"{file_id}.json")
        if not os.path.exists(info_file):
            return jsonify({'error': '文件不存在'}), 404

        with open(info_file, 'r', encoding='utf-8') as f:
            info = json.load(f)

        return jsonify(info)

    except Exception as e:
        return jsonify({'error': f'获取文件信息失败: {str(e)}'}), 500


@app.route('/processed/<file_id>/markdown', methods=['GET'])
def get_processed_markdown(file_id):
    """获取已处理PDF的Markdown内容"""
    try:
        info_file = os.path.join(PROCESSED_DIR, f"{file_id}.json")
        if not os.path.exists(info_file):
            return jsonify({'error': '文件不存在'}), 404

        with open(info_file, 'r', encoding='utf-8') as f:
            info = json.load(f)

        md_content = info.get('md_content', '')
        return jsonify({'markdown': md_content})

    except Exception as e:
        return jsonify({'error': f'获取Markdown内容失败: {str(e)}'}), 500


@app.route('/processing-status', methods=['GET'])
def get_processing_status():
    """获取所有文件的处理状态"""
    try:
        processing_files = []
        
        if os.path.exists(PROCESSED_DIR):
            for filename in os.listdir(PROCESSED_DIR):
                if filename.endswith('.json'):
                    info_file = os.path.join(PROCESSED_DIR, filename)
                    try:
                        with open(info_file, 'r', encoding='utf-8') as f:
                            info = json.load(f)
                        
                        # 只返回正在处理的文件
                        if info['status'] in ['uploading', 'processing']:
                            processing_files.append({
                                'id': info['id'],
                                'name': info['original_name'],
                                'status': info['status'],
                                'processing_steps': info.get('processing_steps', {})
                            })
                    except Exception as e:
                        print(f"读取处理状态失败 {filename}: {e}")
                        continue
        
        return jsonify({'processing_files': processing_files})
    
    except Exception as e:
        return jsonify({'error': f'获取处理状态失败: {str(e)}'}), 500


@app.route('/delete-pdf/<file_id>', methods=['DELETE'])
def delete_pdf(file_id):
    """删除PDF文件及相关数据，并终止处理线程"""
    try:
        # 1. 检查并终止正在处理的线程
        if file_id in active_processing_threads:
            print(f"发现正在处理的线程，准备终止: {file_id}")
            
            # 设置停止事件
            if file_id in thread_stop_events:
                thread_stop_events[file_id].set()
                print(f"已设置停止事件: {file_id}")
            
            # 等待线程结束（最多等待5秒）
            thread = active_processing_threads[file_id]
            thread.join(timeout=5.0)
            
            if thread.is_alive():
                print(f"警告: 线程 {file_id} 未能在5秒内正常结束")
            else:
                print(f"线程 {file_id} 已成功终止")
            
            # 清理线程记录
            if file_id in active_processing_threads:
                del active_processing_threads[file_id]
            if file_id in thread_stop_events:
                del thread_stop_events[file_id]
        
        # 2. 获取PDF信息
        info_file = os.path.join(PROCESSED_DIR, f"{file_id}.json")
        if not os.path.exists(info_file):
            return jsonify({'error': '文件不存在'}), 404

        with open(info_file, 'r', encoding='utf-8') as f:
            info = json.load(f)
        
        pdf_filename = info.get('filename')
        original_name = info.get('original_name')
        
        # 3. 删除uploads文件夹中的PDF文件
        pdf_path = os.path.join(UPLOAD_DIR, pdf_filename)
        if os.path.exists(pdf_path):
            os.remove(pdf_path)
            print(f"已删除PDF文件: {pdf_path}")
        
        # 4. 删除temp中的相关文件
        temp_dir = os.path.join(TEMP_DIR, file_id)
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
            print(f"已删除临时目录: {temp_dir}")
        
        # 5. 删除数据库中source_file为该PDF名称的所有数据
        try:
            manager = MilvusDbManager(collection_name="specs_architecture_v1")
            # 去掉文件扩展名，使用不带后缀的文件名进行删除
            filename_without_ext = os.path.splitext(original_name)[0]
            delete_expr = f'source_file == "{filename_without_ext}"'
            manager.delete_by_expr(delete_expr)
            print(f"已删除Milvus中的数据: {filename_without_ext}")
        except Exception as e:
            print(f"删除Milvus数据失败: {e}")
            # 不阻断删除流程，继续删除其他文件
        
        # 6. 删除processed_pdfs中的JSON文件
        if os.path.exists(info_file):
            os.remove(info_file)
            print(f"已删除处理信息文件: {info_file}")
        
        return jsonify({
            'success': True,
            'message': f'PDF文件 {original_name} 及相关数据已成功删除，处理线程已终止'
        })
        
    except Exception as e:
        print(f"删除PDF失败: {e}")
        return jsonify({'error': f'删除失败: {str(e)}'}), 500


@app.route('/processed/<file_id>/explanations', methods=['GET'])
def get_explanation_pairs(file_id):
    """获取指定文件的解释对"""
    try:
        info_file = os.path.join(PROCESSED_DIR, f"{file_id}.json")
        if not os.path.exists(info_file):
            return jsonify({'error': '文件不存在'}), 404

        with open(info_file, 'r', encoding='utf-8') as f:
            info = json.load(f)
        
        chunks = info.get('chunks', [])
        explanation_pairs = match_explanation_pairs(chunks)
        
        return jsonify({
            'file_id': file_id,
            'explanation_pairs': explanation_pairs
        })
        
    except Exception as e:
        return jsonify({'error': f'获取解释对失败: {str(e)}'}), 500


@app.route('/explanations/<source_file>', methods=['GET'])
def get_explanation_pairs_by_source(source_file):
    """根据源文件名获取解释对"""
    try:
        # 遍历所有处理过的文件，找到匹配的源文件
        if os.path.exists(PROCESSED_DIR):
            for filename in os.listdir(PROCESSED_DIR):
                if filename.endswith('.json'):
                    info_file = os.path.join(PROCESSED_DIR, filename)
                    try:
                        with open(info_file, 'r', encoding='utf-8') as f:
                            info = json.load(f)
                        
                        # 检查是否是目标文件（去掉扩展名比较）
                        original_name_without_ext = os.path.splitext(info.get('original_name', ''))[0]
                        if original_name_without_ext == source_file:
                            chunks = info.get('chunks', [])
                            explanation_pairs = match_explanation_pairs(chunks)
                            
                            return jsonify({
                                'source_file': source_file,
                                'file_id': info['id'],
                                'explanation_pairs': explanation_pairs
                            })
                            
                    except Exception as e:
                        print(f"读取文件信息失败 {filename}: {e}")
                        continue
        
        return jsonify({'error': '未找到指定的源文件'}), 404
        
    except Exception as e:
        return jsonify({'error': f'获取解释对失败: {str(e)}'}), 500


@app.route('/chat/stream', methods=['POST'])
def chat_stream_endpoint():
    """流式智能问答接口"""
    try:
        # 在请求上下文中获取数据
        data = request.get_json()
        question = data.get('question', '')
        context = data.get('context', '')

        if not question:
            return jsonify({'error': '问题不能为空'}), 400

        def generate_response():
            try:
                # 构建提示词
                prompt = f"""基于以下上下文信息回答问题：

上下文：
{context}

问题：{question}

请基于上下文信息给出准确、详细的回答。如果上下文中没有相关信息，请说明无法基于现有信息回答。"""

                # 创建LLM并流式生成回答
                llm = LLMAPIFactory().create_api()
                for chunk in llm.stream_chat(prompt):
                    yield f"data: {json.dumps({'success': True, 'content': chunk}, ensure_ascii=False)}\n\n"

                yield "data: [DONE]\n\n"

            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"

        return Response(generate_response(), mimetype='text/plain')

    except Exception as e:
        return jsonify({'error': f'请求处理失败: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(host="0.0.0.0", debug=True, port=8010)