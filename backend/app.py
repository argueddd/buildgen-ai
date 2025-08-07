import os
import json
import yaml
from flask import Flask, request, jsonify, Response, send_from_directory
from flask_cors import CORS

from src.service.pdf_service import PDFService
from src.service.search_service import SearchService
from src.service.chat_service import ChatService
from src.utils.llm_utils import get_first_model_key

app = Flask(__name__)
CORS(app)

# 目录配置
BASE_DIR = os.getcwd()
UPLOAD_DIR = os.path.join(BASE_DIR, 'uploads')
PROCESSED_DIR = os.path.join(BASE_DIR, 'processed_pdfs')

# 全局变量：当前选中的模型名称
current_model_name = get_first_model_key()

# 初始化服务
pdf_service = PDFService(BASE_DIR,current_model_name)
search_service = SearchService(PROCESSED_DIR)
chat_service = ChatService()

# PDF文件服务接口
@app.route('/pdfs/<path:filename>')
def serve_pdf(filename):
    """提供PDF文件访问"""
    return send_from_directory(os.path.join(BASE_DIR, 'uploads'), filename)

@app.route('/uploads/<path:filename>')
def serve_uploaded_pdf(filename):
    """提供上传的PDF文件访问"""
    return send_from_directory(UPLOAD_DIR, filename)

# 搜索接口
@app.route('/search', methods=['GET', 'POST'])
def search_endpoint():
    """搜索接口"""
    if request.method == 'GET':
        try:
            query = request.args.get('query', '')
            results = search_service.search(query,model_name= current_model_name)
            return jsonify({'results': results})
        except ValueError as e:
            return jsonify({'error': str(e)}), 400
        except Exception as e:
            return jsonify({'error': f'搜索失败: {str(e)}'}), 500
    
    elif request.method == 'POST':
        try:
            data = request.get_json()
            query = data.get('query', '')
            keywords = data.get('keywords', [])
            filter_type = data.get('filterType', 'topN')
            top_n = data.get('topN', 10)
            threshold = data.get('threshold', 0.7)
            
            if not query:
                return jsonify({'error': 'Query parameter is required'}), 400
            
            results = search_service.search_with_settings(query, current_model_name, keywords, filter_type, top_n, threshold)
            return jsonify({'results': results})
        except ValueError as e:
            return jsonify({'error': str(e)}), 400
        except Exception as e:
            return jsonify({'error': f'搜索失败: {str(e)}'}), 500

# 获取关键词拆分结果接口
@app.route('/keywords/extract', methods=['GET'])
def extract_keywords_endpoint():
    """获取查询关键词的拆分结果"""
    try:
        query = request.args.get('query', '')
        if not query:
            return jsonify({'error': '查询参数不能为空'}), 400
        
        keywords = search_service.extract_keywords(query, model_name=current_model_name)
        return jsonify({'keywords': keywords})
    except Exception as e:
        return jsonify({'error': f'关键词提取失败: {str(e)}'}), 500

# 关键词检索接口
@app.route('/search/keywords', methods=['POST'])
def keyword_search_endpoint():
    """基于选定关键词进行检索"""
    try:
        data = request.get_json()
        selected_keywords = data.get('keywords', [])
        filter_type = data.get('filterType', 'topN')
        top_n = data.get('topN', 10)
        threshold = data.get('threshold', 0.7)
        
        if not selected_keywords:
            return jsonify({'error': '请选择至少一个关键词'}), 400
        
        results = search_service.search_by_keywords(selected_keywords, filter_type, top_n, threshold)
        return jsonify({'results': results})
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': f'关键词检索失败: {str(e)}'}), 500

@app.route('/explanations/<source_file>', methods=['GET'])
def get_explanation_pairs_by_source(source_file):
    """根据源文件名获取解释对"""
    try:
        result = search_service.get_explanation_pairs_by_source(source_file)
        return jsonify(result)
    except FileNotFoundError as e:
        return jsonify({'error': str(e)}), 404
    except Exception as e:
        return jsonify({'error': f'获取解释对失败: {str(e)}'}), 500

# PDF上传接口
@app.route('/upload-pdf', methods=['POST'])
def upload_pdf():
    """PDF上传接口"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': '没有文件'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': '没有选择文件'}), 400
        
        result = pdf_service.upload_pdf(file)
        return jsonify(result)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
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
        
        result = pdf_service.upload_pdfs_batch(files)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': f'批量PDF上传失败: {str(e)}'}), 500

# PDF管理接口
@app.route('/pdf-list', methods=['GET'])
def get_pdf_list():
    """获取已处理的PDF文件列表"""
    try:
        pdf_files = pdf_service.get_pdf_list()
        return jsonify({'pdfs': pdf_files})
    except Exception as e:
        return jsonify({'error': f'获取文件列表失败: {str(e)}'}), 500

@app.route('/processed/<file_id>', methods=['GET'])
def get_processed_info(file_id):
    """获取已处理PDF的详细信息"""
    try:
        info = pdf_service.get_processed_info(file_id)
        return jsonify(info)
    except FileNotFoundError:
        return jsonify({'error': '文件不存在'}), 404
    except Exception as e:
        return jsonify({'error': f'获取文件信息失败: {str(e)}'}), 500

@app.route('/processed/<file_id>/markdown', methods=['GET'])
def get_processed_markdown(file_id):
    """获取已处理PDF的Markdown内容"""
    try:
        md_content = pdf_service.get_processed_markdown(file_id)
        return jsonify({'markdown': md_content})
    except FileNotFoundError:
        return jsonify({'error': '文件不存在'}), 404
    except Exception as e:
        return jsonify({'error': f'获取Markdown内容失败: {str(e)}'}), 500

@app.route('/processing-status', methods=['GET'])
def get_processing_status():
    """获取所有文件的处理状态"""
    try:
        processing_files = pdf_service.get_processing_status()
        return jsonify({'processing_files': processing_files})
    except Exception as e:
        return jsonify({'error': f'获取处理状态失败: {str(e)}'}), 500

@app.route('/delete-pdf/<file_id>', methods=['DELETE'])
def delete_pdf(file_id):
    """删除PDF文件及相关数据"""
    try:
        message = pdf_service.delete_pdf(file_id)
        return jsonify({'success': True, 'message': message})
    except FileNotFoundError:
        return jsonify({'error': '文件不存在'}), 404
    except Exception as e:
        return jsonify({'error': f'删除失败: {str(e)}'}), 500

# 聊天接口
@app.route('/chat/stream', methods=['POST'])
def chat_stream_endpoint():
    """流式智能问答接口"""
    global current_model_name
    try:
        data = request.get_json()
        question = data.get('question', '')
        context = data.get('context', '')
        
        def generate_response():
            try:
                for chunk in chat_service.stream_chat(question, context, current_model_name):
                    yield f"data: {json.dumps({'success': True, 'content': chunk}, ensure_ascii=False)}\n\n"
                yield "data: [DONE]\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"
        
        return Response(generate_response(), mimetype='text/plain')
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': f'请求处理失败: {str(e)}'}), 500

# 配置管理接口
@app.route('/api/config', methods=['GET'])
def get_config():
    """获取当前配置"""
    global current_model_name
    try:
        from backend.src.utils.llm_utils import get_all_models, get_model_config_by_key
        
        config_path = os.path.join(BASE_DIR, 'config', 'llm_config.yaml')
        
        # 获取所有可用模型
        available_models = get_all_models(config_path,current_model_name)
        
        # 获取当前活跃模型配置
        current_config = None
        
        # 使用全局变量中的当前模型
        if current_model_name:
            for model in available_models:
                if model['key'] == current_model_name:
                    model['is_active'] = True
                    current_config = {
                        'API_KEY': model['api_key'],
                        'BASE_URL': model['base_url'],
                        'MODEL_TYPE': model['model_type']
                    }
                else:
                    model['is_active'] = False
        
        return jsonify({
            'success': True,
            'config': current_config,
            'available_models': available_models
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'获取配置失败: {str(e)}'
        }), 500

@app.route('/api/config/<model_key>', methods=['DELETE'])
def delete_config(model_key):
    """删除指定模型配置"""
    try:
        config_path = os.path.join(BASE_DIR, 'config', 'llm_config.yaml')
        if not os.path.exists(config_path):
            return jsonify({
                'success': False,
                'error': '配置文件不存在'
            }), 404
        
        # 读取现有配置
        with open(config_path, 'r', encoding='utf-8') as f:
            config_data = yaml.safe_load(f) or {}
        
        # 检查模型是否存在
        if model_key not in config_data:
            return jsonify({
                'success': False,
                'error': f'模型配置 {model_key} 不存在'
            }), 404
        
        # 删除指定模型配置
        del config_data[model_key]
        
        # 保存更新后的配置
        with open(config_path, 'w', encoding='utf-8') as f:
            yaml.dump(config_data, f, default_flow_style=False, allow_unicode=True)
        
        return jsonify({
            'success': True,
            'message': f'模型配置 {model_key} 删除成功'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'删除配置失败: {str(e)}'
        }), 500

@app.route('/api/config', methods=['POST'])
def save_config():
    """保存配置"""
    try:

        
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'error': '无效的请求数据'
            }), 400
        
        api_key = data.get('API_KEY', '')
        base_url = data.get('BASE_URL', '')
        model_type = data.get('MODEL_TYPE', '')
        model_key = data.get('MODEL_KEY', model_type)  # 使用MODEL_KEY或MODEL_TYPE作为键
        set_as_active = data.get('SET_AS_ACTIVE', True)  # 默认设置为活跃配置
        
        if not all([api_key, base_url, model_type]):
            return jsonify({
                'success': False,
                'error': '所有字段都是必需的'
            }), 400
        
        # 创建配置目录
        config_dir = os.path.join(BASE_DIR, 'config')
        os.makedirs(config_dir, exist_ok=True)
        
        config_path = os.path.join(config_dir, 'llm_config.yaml')
        
        # 读取现有配置或创建新配置
        config_data = {}
        if os.path.exists(config_path):
            with open(config_path, 'r', encoding='utf-8') as f:
                config_data = yaml.safe_load(f) or {}
        
        # 更新或添加指定模型的配置
        config_data[model_key] = {
            'API_KEY': api_key,
            'BASE_URL': base_url,
            'MODEL_TYPE': model_type
        }
        
        # 保存配置文件
        with open(config_path, 'w', encoding='utf-8') as f:
            yaml.dump(config_data, f, default_flow_style=False, allow_unicode=True)
        
        # 如果需要设置为活跃配置，则设置全局变量
        if set_as_active:
            global current_model_name
            current_model_name = model_key
        
        return jsonify({
            'success': True,
            'message': '配置保存成功' + ('并已设置为活跃配置' if set_as_active else '')
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'保存配置失败: {str(e)}'
        }), 500

@app.route('/api/config/set-active/<model_key>', methods=['POST'])
def set_active_config(model_key):
    """设置活跃的模型配置"""
    global current_model_name
    try:
        from backend.src.utils.llm_utils import get_model_config_by_key
        
        config_path = os.path.join(BASE_DIR, 'config', 'llm_config.yaml')
        
        # 检查模型是否存在
        model_config = get_model_config_by_key(model_key, config_path)
        if not model_config:
            return jsonify({
                'success': False,
                'error': f'模型配置 {model_key} 不存在'
            }), 404
        
        # 设置全局变量
        current_model_name = model_key
        print(current_model_name)
        
        return jsonify({
            'success': True,
            'message': f'已将 {model_key} 设置为活跃配置'
        })
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'设置活跃配置失败: {str(e)}'
        }), 500

if __name__ == '__main__':
    app.run(host="0.0.0.0", debug=True, port=8010)