import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from src.infrastructure.milvus_db import MilvusDbManager
from flask import send_from_directory
import tempfile
import shutil
from pathlib import Path
import subprocess
from src.service.split_md_into_chunks import split_markdown_merge_recursively
from src.service.question_generator import generate_questions_for_chunk
from src.utils.vector_utils import prepare_chunk_for_insert
import uuid
from datetime import datetime
import json

app = Flask(__name__)
CORS(app)

PDF_DIR = '/data/JG'  # This path was a point of contention and needed user to verify/change
UPLOAD_DIR = '../uploads'  # 原始PDF存储
PROCESSED_DIR = './processed_pdfs'  # 已处理的PDF信息存储
TEMP_DIR = './temp'

# 确保目录存在
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)
os.makedirs(TEMP_DIR, exist_ok=True)


@app.route('/pdfs/<path:filename>')
def serve_pdf(filename):
    file_path = os.path.join(PDF_DIR, filename)
    print("file_path", file_path)
    if not os.path.isfile(file_path):
        return jsonify({'error': '文件不存在'}), 404
    return send_from_directory(PDF_DIR, filename)


@app.route('/search', methods=['GET'])
def search_endpoint():
    print("hi, this is search endpoint")
    query = request.args.get('query')
    limit = int(request.args.get('limit', 5))

    if not query:
        return jsonify({"error": "缺少参数 query"}), 400

    manager = MilvusDbManager(collection_name="specs_architecture")
    results = manager.search(query_text=query, limit=limit)

    print("search results:", results)  # Added for debugging
    return jsonify({"results": results})


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

        # 启动后台处理
        import threading
        thread = threading.Thread(target=process_pdf_background, args=(pdf_path, file_id, original_filename, pdf_filename))
        thread.daemon = True
        thread.start()

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


def process_pdf_background(pdf_path, file_id, original_filename, pdf_filename):
    """后台处理PDF文件"""
    try:
        print(f"开始后台处理PDF: {pdf_filename}")
        
        # 步骤1: 文件验证 (1/5)
        update_processing_status(file_id, 'processing', '文件验证中...', 1, 5)
        if not os.path.exists(pdf_path):
            update_processing_status(file_id, 'failed', 'PDF文件不存在')
            return
        
        # 创建临时目录用于处理
        temp_dir = os.path.join(TEMP_DIR, file_id)
        os.makedirs(temp_dir, exist_ok=True)

        # 步骤2: PDF解析 (2/5)
        update_processing_status(file_id, 'processing', 'PDF解析中...', 2, 5)
        print(f"开始解析PDF: {pdf_filename}")
        
        # 步骤3: PDF转Markdown (3/5)
        update_processing_status(file_id, 'processing', 'PDF转Markdown中...', 3, 5)
        print(f"开始转换PDF: {pdf_filename}")
        md_path = convert_pdf_to_markdown(pdf_path, temp_dir)

        if not md_path:
            update_processing_status(file_id, 'failed', f'PDF转换失败: {pdf_filename}')
            return

        # 步骤4: 内容切片 (4/5)
        update_processing_status(file_id, 'processing', '内容切片中...', 4, 5)
        print("开始切片处理...")
        
        # 读取Markdown内容
        with open(md_path, 'r', encoding='utf-8') as f:
            md_content = f.read()

        # 分割成chunks
        chunks = split_markdown_merge_recursively(md_content)
        
        # 为每个chunk生成问题和tags
        print("为chunks生成问题和tags...")
        for i, chunk in enumerate(chunks):
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

        # 更新JSON文件
        info_file = os.path.join(PROCESSED_DIR, f"{file_id}.json")
        with open(info_file, 'w', encoding='utf-8') as f:
            json.dump(processed_info, f, ensure_ascii=False, indent=2)

        # 清理临时文件
        shutil.rmtree(temp_dir, ignore_errors=True)
        
        print(f"PDF处理完成: {pdf_filename}, {len(chunks)} chunks")

    except Exception as e:
        print(f"PDF后台处理失败: {e}")
        update_processing_status(file_id, 'failed', str(e))


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
            "-o", output_dir
        ]

        subprocess.run(cmd, check=True, capture_output=True, text=True)

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


def save_chunks_to_milvus(chunks, source_filename, collection_name):
    """将chunks存储到Milvus数据库"""
    try:
        manager = MilvusDbManager(collection_name=collection_name)
        manager.initialize()

        source_base_info = {
            "year": source_filename.split('-')[1][:4] if '-' in source_filename else "",
            "source_file": source_filename,
        }

        for chunk in chunks:
            # 生成问题
            questions_tag_dict = generate_questions_for_chunk(chunk)

            # 准备数据
            data = prepare_chunk_for_insert(chunk, questions_tag_dict, source_base_info)

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
        return jsonify({'error': f'获取处理信息失败: {str(e)}'}), 500


@app.route('/processed/<file_id>/markdown', methods=['GET'])
def get_processed_markdown(file_id):
    """获取已处理PDF的Markdown内容"""
    try:
        info_file = os.path.join(PROCESSED_DIR, f"{file_id}.json")
        if not os.path.exists(info_file):
            return jsonify({'error': '处理信息不存在'}), 404

        with open(info_file, 'r', encoding='utf-8') as f:
            info = json.load(f)

        return jsonify({'markdown': info.get('md_content', '')})

    except Exception as e:
        return jsonify({'error': f'获取Markdown失败: {str(e)}'}), 500


@app.route('/processing-status', methods=['GET'])
def get_processing_status():
    """获取所有正在处理的PDF状态"""
    try:
        processing_files = []
        
        if os.path.exists(PROCESSED_DIR):
            for filename in os.listdir(PROCESSED_DIR):
                if filename.endswith('.json'):
                    info_file = os.path.join(PROCESSED_DIR, filename)
                    try:
                        with open(info_file, 'r', encoding='utf-8') as f:
                            info = json.load(f)
                        
                        if info.get('status') in ['uploading', 'processing']:
                            processing_files.append({
                                'id': info['id'],
                                'status': info['status'],
                                'original_name': info['original_name']
                            })
                    except Exception as e:
                        print(f"读取处理信息失败 {filename}: {e}")
                        continue

        return jsonify({'processing_files': processing_files})

    except Exception as e:
        return jsonify({'error': f'获取处理状态失败: {str(e)}'}), 500


if __name__ == '__main__':
    app.run(host="0.0.0.0", debug=True, port=8010)